-- Opt-in development fixtures. Run only against flight-dev/local development.
-- Insert-only: no reset, UPDATE, DELETE, auth users, roles or customer bookings.
-- Repeating on the same Vietnam calendar day keeps the same UUIDs and rows.
-- A later day creates a fresh future flight batch, preserving older references.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create or replace function pg_temp.checkout_demo_id(label text) returns uuid
language sql immutable as $$
  select (substr(h,1,8)||'-'||substr(h,9,4)||'-4'||substr(h,14,3)||'-8'||substr(h,18,3)||'-'||substr(h,21,12))::uuid
  from (select md5('flight-checkout-demo-v1:'||label) h) x
$$;
do $$
declare
  batch date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  airline uuid := pg_temp.checkout_demo_id('airline');
  plane uuid := pg_temp.checkout_demo_id('aircraft');
  flight uuid; fare uuid; product uuid; airport uuid; origin uuid; destination uuid;
  departure timestamptz; arrival timestamptz; label text; seat uuid; code text;
  r record; tier record; bag record; row_no integer; col_no integer;
begin
  -- Reuse shared airport records by IATA only when geography/timezone are correct.
  for r in select * from (values
    ('SGN','Tan Son Nhat International Airport','Ho Chi Minh City','VN','Asia/Ho_Chi_Minh'),
    ('HAN','Noi Bai International Airport','Hanoi','VN','Asia/Ho_Chi_Minh'),
    ('SIN','Changi Airport','Singapore','SG','Asia/Singapore')
  ) as x(iata,name,city,country,tz) loop
    insert into public.airports(id,iata_code,name,city,country_code,timezone)
      values(pg_temp.checkout_demo_id('airport:'||r.iata),r.iata,r.name,r.city,r.country,r.tz) on conflict do nothing;
    select id into airport from public.airports where iata_code=r.iata and country_code=r.country and timezone=r.tz and is_active;
    if airport is null then raise exception 'Existing airport % conflicts with demo geography; no records overwritten',r.iata; end if;
  end loop;
  insert into public.airlines(id,iata_code,name) values(airline,'F0','Flyora Airways') on conflict do nothing;
  if not exists(select 1 from public.airlines where id=airline and iata_code='F0' and name='Flyora Airways' and is_active) then
    raise exception 'Reserved demo airline conflicts with an existing row'; end if;
  insert into public.aircraft(id,airline_id,registration_code,model_name)
    values(plane,airline,'FLY-TV2-24','Flyora Regional 24') on conflict do nothing;
  if not exists(select 1 from public.aircraft where id=plane and airline_id=airline and registration_code='FLY-TV2-24' and is_active) then
    raise exception 'Reserved demo aircraft conflicts with an existing row'; end if;
  for row_no in 1..4 loop
    for col_no in 1..6 loop
      code := row_no::text||chr(64+col_no);
      insert into public.seats(id,aircraft_id,seat_code,row_number,column_number,cabin_class,position,is_exit_row)
        values(pg_temp.checkout_demo_id('seat:'||code),plane,code,row_no,col_no,'economy',
          (case when col_no in (1,6) then 'window' when col_no in (3,4) then 'aisle' else 'middle' end)::public.seat_position,false)
        on conflict(id) do nothing;
    end loop;
  end loop;
  for bag in select * from (values ('DEMO_BAG_15',15),('DEMO_BAG_25',25)) as x(code,kg) loop
    product := pg_temp.checkout_demo_id('product:'||bag.code);
    insert into public.addon_products(id,code,name,category,description,weight_kg)
      values(product,bag.code,'Hành lý ký gửi '||bag.kg||' kg','baggage','Hành lý ký gửi mua thêm cho từng hành khách và chặng bay.',bag.kg) on conflict do nothing;
    if not exists(select 1 from public.addon_products p where p.id=product and p.code=bag.code and p.category='baggage' and p.weight_kg=bag.kg and p.is_active) then
      raise exception 'Reserved demo baggage conflicts with an existing row'; end if;
  end loop;
  for r in select * from (values
    ('F0101','SGN','SIN',14,'Asia/Ho_Chi_Minh'),
    ('F0102','SIN','SGN',18,'Asia/Singapore'),
    ('F0103','SGN','HAN',21,'Asia/Ho_Chi_Minh')
  ) as x(number,origin,destination,days,tz) loop
    label := batch::text||':'||r.number;
    flight := pg_temp.checkout_demo_id('flight:'||label);
    select id into origin from public.airports where iata_code=r.origin;
    select id into destination from public.airports where iata_code=r.destination;
    departure := ((batch+r.days)+time '09:00') at time zone r.tz;
    arrival := departure+interval '2 hours';
    insert into public.flight_instances(id,airline_id,aircraft_id,flight_number,departure_airport_id,arrival_airport_id,
      departure_at,arrival_at,sales_close_at,status,published_at)
      values(flight,airline,plane,r.number,origin,destination,departure,arrival,departure-interval '1 hour','scheduled',now())
      on conflict(id) do nothing;
    if not exists(select 1 from public.flight_instances where id=flight and airline_id=airline and aircraft_id=plane
      and departure_airport_id=origin and arrival_airport_id=destination and departure_at=departure and arrival_at=arrival
      and status='scheduled' and published_at is not null and sales_close_at>now()) then
      raise exception 'Demo flight was changed or closed; no existing flight overwritten'; end if;
    for tier in select * from (values ('DEMO_STANDARD',1000000,700000,100000,0),('DEMO_FLEX',1400000,1000000,150000,20))
      as x(code,adult,child,infant,checked_kg) loop
      fare := pg_temp.checkout_demo_id('fare:'||label||':'||tier.code);
      insert into public.flight_fares(id,flight_id,fare_code,cabin_class,name,adult_base_amount,child_base_amount,infant_base_amount,
        adult_tax_amount,child_tax_amount,infant_tax_amount,adult_fee_amount,child_fee_amount,infant_fee_amount,
        baggage_allowance,cancellation_allowed,cancellation_fee_amount)
        values(fare,flight,tier.code,'economy',case when tier.checked_kg=0 then 'Phổ thông Tiết kiệm' else 'Phổ thông Linh hoạt' end,
          tier.adult,tier.child,tier.infant,180000,120000,20000,70000,50000,10000,
          jsonb_build_object('cabin_pieces',1,'cabin_kg',7,'checked_pieces',case when tier.checked_kg=0 then 0 else 1 end,'checked_kg',tier.checked_kg),
          tier.checked_kg>0,200000) on conflict(id) do nothing;
    end loop;
    for row_no in 1..4 loop
      for col_no in 1..6 loop
        code := row_no::text||chr(64+col_no);
        seat := pg_temp.checkout_demo_id('seat:'||code);
        insert into public.flight_seats(id,flight_id,seat_id,seat_code,row_number,column_number,cabin_class,position,is_exit_row,is_blocked,selection_fee_amount)
          values(pg_temp.checkout_demo_id('flight-seat:'||label||':'||code),flight,seat,code,row_no,col_no,'economy',
            (case when col_no in (1,6) then 'window' when col_no in (3,4) then 'aisle' else 'middle' end)::public.seat_position,
            false,code='4F',case when row_no=1 then 100000 else 50000 end) on conflict(id) do nothing;
      end loop;
    end loop;
    for bag in select * from (values ('DEMO_BAG_15',250000),('DEMO_BAG_25',400000)) as x(code,amount) loop
      product := pg_temp.checkout_demo_id('product:'||bag.code);
      insert into public.flight_addon_offers(id,flight_id,product_id,unit_amount,max_quantity_per_passenger)
        values(pg_temp.checkout_demo_id('offer:'||label||':'||bag.code),flight,product,bag.amount,1) on conflict(id) do nothing;
    end loop;
  end loop;
end $$;
commit;
