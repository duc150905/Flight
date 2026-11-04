-- Generated via scripts/generate-catalogue-seed.mjs. Never execute this template directly.
-- Only catalogue writes; no roles, grants, policies, customer orders or payments.
begin isolation level repeatable read;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create function pg_temp.catalogue_id(label text) returns uuid language sql immutable as $$
  select md5('flyora-catalogue-v1:' || label)::uuid
$$;

-- Hash all non-catalogue application tables without returning customer data.
create function pg_temp.protected_fingerprint() returns jsonb language plpgsql as $$
declare r record; digest text; result jsonb := '{}';
begin
  for r in select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind in ('r','p') and (n.nspname='private' or
      (n.nspname='public' and c.relname <> all(array[
       'airports','airlines','destinations','aircraft','seats','flight_instances','flight_fares',
       'flight_seats','addon_products','flight_addon_offers']))) order by 1,2
  loop
    execute format('select md5(coalesce(string_agg(h, '''' order by h),'''')) from (select md5(to_jsonb(t)::text) h from %I.%I t) x',r.nspname,r.relname) into digest;
    result := result || jsonb_build_object(r.nspname||'.'||r.relname,digest);
  end loop;
  return result;
end $$;
create temp table catalogue_guard on commit drop as select pg_temp.protected_fingerprint() as fingerprint;

create function pg_temp.populate_catalogue(data jsonb, first_day date, days integer) returns void language plpgsql as $$
declare r jsonb; origin record; destination record; carrier uuid; plane uuid;
  idx integer := 0; inserted_planes integer; reg text; wide boolean; outbound timestamptz; flight uuid; day date;
  international boolean; direction integer;
begin
  if first_day <= (now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'Expansion must start on a future Vietnam date'; end if;
  for r in select * from jsonb_array_elements(data->'airports') loop
    if not exists(select 1 from pg_timezone_names where name=r->>6) then raise exception 'Invalid timezone'; end if;
    insert into public.airports(id,iata_code,name,city,country_code,timezone)
      values(pg_temp.catalogue_id('airport:'||(r->>0)),r->>0,r->>1,r->>3,r->>5,r->>6) on conflict do nothing;
    if not exists(select 1 from public.airports where iata_code=r->>0 and country_code=r->>5 and timezone=r->>6 and is_active) then
      raise exception 'Airport geography conflicts: %',r->>0; end if;
  end loop;
  for r in select * from jsonb_array_elements(data->'airlines') loop
    insert into public.airlines(id,iata_code,name) values(pg_temp.catalogue_id('airline:'||(r->>0)),r->>0,r->>1) on conflict do nothing;
  end loop;
  for r in select * from jsonb_array_elements(data->'destinations') loop
    insert into public.destinations(id,airport_id,slug,title,description,is_featured,sort_order)
      select pg_temp.catalogue_id('destination:'||(r->>1)),id,r->>1,r->>2,r->>4,false,100
      from public.airports where iata_code=r->>0 on conflict do nothing;
  end loop;
  for r in select * from jsonb_array_elements(data->'products') loop
    insert into public.addon_products(id,code,name,category,weight_kg,description)
      values(pg_temp.catalogue_id('product:'||(r->>0)),r->>0,r->>1,(r->>3)::public.addon_category,(r->>4)::numeric,
        case when r->>3='baggage' then 'Hành lý ký gửi mua thêm cho từng hành khách và chặng bay.' else 'Suất ăn đặt trước cho từng hành khách và chặng bay.' end)
      on conflict do nothing;
    if not exists(select 1 from public.addon_products where code=r->>0 and category::text=r->>3
      and weight_kg is not distinct from (r->>4)::numeric and is_active) then raise exception 'Product conflicts: %',r->>0; end if;
  end loop;

  -- Only legacy catalogue labels are changed; IDs, fare codes, money and policy stay intact.
  update public.airlines set name='Flyora Airways' where iata_code='F0' and name='Flight Checkout Demo';
  update public.aircraft set model_name='Flyora Regional 24',registration_code='FLY-TV2-24'
    where id='50c20c1d-acc8-4e2f-885a-ded54e98b7cd' and model_name='Demo 24-seat aircraft';
  update public.flight_fares set name=case name when 'Demo Standard' then 'Phổ thông Tiết kiệm' else 'Phổ thông Linh hoạt' end
    where name in ('Demo Standard','Demo Flex');
  update public.addon_products set name='Hành lý ký gửi '||weight_kg::integer||' kg',
    description='Hành lý ký gửi mua thêm cho từng hành khách và chặng bay.'
    where name like 'Demo checked baggage %';
  update public.addon_products set name=case code when 'INS_BASIC_DEMO' then 'Bảo vệ hành trình Cơ bản' else 'Bảo vệ hành trình Nâng cao' end,
    description='Quyền lợi bảo vệ hành trình theo gói đã chọn.'
    where code in ('INS_BASIC_DEMO','INS_PLUS_DEMO') and (name ~* 'demo' or description ~* 'demo|mô phỏng');

  create temp table catalogue_new_flights(id uuid primary key, base bigint, international boolean) on commit drop;
  for r in select * from jsonb_array_elements(data->'routePairs') loop
    idx := idx+1;
    select * into strict origin from public.airports where iata_code=r->>0 and is_active;
    select * into strict destination from public.airports where iata_code=r->>1 and is_active;
    select id into strict carrier from public.airlines where iata_code=r->>2 and is_active;
    wide := (r->>3)::integer>=240;
    reg := 'FLY-'||(r->>2)||'-'||(r->>0)||'-'||(r->>1);
    plane := pg_temp.catalogue_id('aircraft:'||reg);
    insert into public.aircraft(id,airline_id,registration_code,model_name)
      values(plane,carrier,reg,case when wide then 'Airbus A350-900'
        when r->>2 in ('SQ','MH') then 'Boeing 737-8'
        when r->>2='TG' then 'Airbus A320-200' else 'Airbus A321neo' end) on conflict do nothing;
    get diagnostics inserted_planes = row_count;
    if not exists(select 1 from public.aircraft where id=plane and airline_id=carrier and registration_code=reg and is_active) then
      raise exception 'Dedicated aircraft conflicts: %',reg; end if;
    -- An existing aircraft layout is never rewritten or replenished.
    if inserted_planes=1 then
      insert into public.seats(id,aircraft_id,seat_code,row_number,column_number,cabin_class,position,is_exit_row)
      select pg_temp.catalogue_id('seat:'||reg||':'||n||chr(64+c)),plane,n||chr(64+c),n,c,
        (case when n<=case when wide then 5 else 2 end then 'business'
         when wide and n<=8 then 'premium_economy' else 'economy' end)::public.cabin_class,
        (case when c in (1,6) then 'window' when c in (3,4) then 'aisle' else 'middle' end)::public.seat_position,
        n=case when wide then 15 else 12 end
      from generate_series(1,case when wide then 27 else 20 end) n cross join generate_series(1,6) c
      where n>case when wide then 5 else 2 end or c in (1,3,4,6);
    end if;
    international := origin.country_code<>destination.country_code;
    for day in select first_day+n from generate_series(0,days-1) n loop
      outbound := (day + time '06:30' + make_interval(mins=>(idx%4)*45)) at time zone origin.timezone;
      for direction in 0..1 loop
        flight := pg_temp.catalogue_id('flight:'||(r->>0)||':'||(r->>1)||':'||day||':'||direction);
        with inserted as (
          insert into public.flight_instances(id,airline_id,aircraft_id,flight_number,departure_airport_id,arrival_airport_id,
            departure_at,arrival_at,sales_close_at,status,published_at)
          select flight,carrier,plane,(r->>2)||(7000+idx*2+direction),
            case when direction=0 then origin.id else destination.id end,
            case when direction=0 then destination.id else origin.id end,
            t.departure,t.departure+make_interval(mins=>(r->>3)::integer+direction*10),t.departure-interval '1 hour','scheduled',now()
          from (select outbound+case when direction=0 then interval '0' else make_interval(mins=>(r->>3)::integer+90) end departure) t
          on conflict do nothing returning id
        ) insert into catalogue_new_flights select id,(r->>4)::bigint,international from inserted;
        if not exists(select 1 from public.flight_instances where id=flight) then
          raise exception 'Flight identity conflicts: % % %',r->>0,r->>1,day; end if;
      end loop;
    end loop;
  end loop;

  insert into public.flight_fares(id,flight_id,fare_code,cabin_class,name,
    adult_base_amount,child_base_amount,infant_base_amount,adult_tax_amount,child_tax_amount,infant_tax_amount,
    adult_fee_amount,child_fee_amount,infant_fee_amount,baggage_allowance,
    cancellation_allowed,cancellation_cutoff_minutes,cancellation_fee_amount)
  select pg_temp.catalogue_id('fare:'||nf.id||':'||ft.code),nf.id,ft.code,ft.cabin::public.cabin_class,ft.name,
    round(nf.base*ft.multiplier,-3)::bigint,round(nf.base*ft.multiplier*0.75,-3)::bigint,round(nf.base*ft.multiplier*0.10,-3)::bigint,
    case when nf.international then 500000 else 180000 end,case when nf.international then 375000 else 135000 end,0,
    case when nf.international then 150000 else 90000 end,case when nf.international then 150000 else 90000 end,20000,
    jsonb_build_object('cabin_pieces',1,'cabin_kg',case when ft.cabin='business' then 12 else 7 end,
      'checked_pieces',case when ft.kg=0 then 0 else 1 end,'checked_kg',ft.kg),
    ft.cancel,180,ft.cancel_fee
  from catalogue_new_flights nf cross join (values
    ('ECO_SAVER','economy','Phổ thông Tiết kiệm',1.00,0,false,0),
    ('ECO_FLEX','economy','Phổ thông Linh hoạt',1.35,23,true,350000),
    ('PREM_ECO','premium_economy','Phổ thông Đặc biệt',1.85,32,true,250000),
    ('BIZ_FLEX','business','Thương gia Linh hoạt',2.80,32,true,150000)
  ) ft(code,cabin,name,multiplier,kg,cancel,cancel_fee)
  where exists(select 1 from public.flight_instances f join public.seats s on s.aircraft_id=f.aircraft_id
    where f.id=nf.id and s.cabin_class::text=ft.cabin and s.is_active);

  insert into public.flight_seats(id,flight_id,seat_id,seat_code,row_number,column_number,cabin_class,position,is_exit_row,is_blocked,selection_fee_amount)
  select pg_temp.catalogue_id('flight-seat:'||nf.id||':'||s.seat_code),nf.id,s.id,s.seat_code,s.row_number,s.column_number,s.cabin_class,s.position,s.is_exit_row,
    false,case when s.cabin_class='business' then 0 when s.is_exit_row then 100000
      when s.position='window' then 70000 else 50000 end
  from catalogue_new_flights nf join public.flight_instances f on f.id=nf.id join public.seats s on s.aircraft_id=f.aircraft_id and s.is_active;

  insert into public.flight_addon_offers(id,flight_id,product_id,unit_amount,max_quantity_per_passenger)
  select pg_temp.catalogue_id('offer:'||nf.id||':'||p.code),nf.id,p.id,(product.value->>5)::bigint,1
    from catalogue_new_flights nf cross join jsonb_array_elements(data->'products') product(value)
    join public.addon_products p on p.code=product.value->>0 and p.is_active;

  if exists(select 1 from catalogue_new_flights nf where
    not exists(select 1 from public.flight_fares where flight_id=nf.id and fare_code='ECO_SAVER') or
    not exists(select 1 from public.flight_seats where flight_id=nf.id) or
    (select count(*) from public.flight_addon_offers where flight_id=nf.id)<>jsonb_array_length(data->'products')) then
      raise exception 'Incomplete generated flight inventory'; end if;
  drop table catalogue_new_flights;
end $$;

create temp table catalogue_parameters on commit drop as select /* CATALOGUE_JSON */::jsonb data, /* START_DATE */ first_day, /* DAYS */ days;
do $$
declare p record; i integer; previous_counts jsonb; current_counts jsonb;
begin
  select * into p from catalogue_parameters;
  for i in 1../* REPEAT */ loop
    perform pg_temp.populate_catalogue(p.data,p.first_day,p.days);
    select jsonb_build_object('flights',(select count(*) from public.flight_instances),'fares',(select count(*) from public.flight_fares),
      'seats',(select count(*) from public.flight_seats),'offers',(select count(*) from public.flight_addon_offers)) into current_counts;
    if i>1 and current_counts<>previous_counts then raise exception 'Repeat created duplicate inventory'; end if;
    previous_counts := current_counts;
  end loop;
  if pg_temp.protected_fingerprint()<>(select fingerprint from catalogue_guard) then
    raise exception 'Non-catalogue application data changed: rolling back'; end if;
end $$;
select jsonb_build_object('first_day',first_day,'last_day',first_day+days-1,'protected_data_unchanged',
  pg_temp.protected_fingerprint()=(select fingerprint from catalogue_guard),
  'counts',jsonb_build_object('airports',(select count(*) from public.airports),'airlines',(select count(*) from public.airlines),
    'destinations',(select count(*) from public.destinations),'aircraft',(select count(*) from public.aircraft),
    'seats',(select count(*) from public.seats),'flights',(select count(*) from public.flight_instances),
    'fares',(select count(*) from public.flight_fares),'flight_seats',(select count(*) from public.flight_seats),
    'products',(select count(*) from public.addon_products),'offers',(select count(*) from public.flight_addon_offers))) as expansion_result
from catalogue_parameters;
/* FINISH */
