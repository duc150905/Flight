begin;
set local lock_timeout='10s'; set local statement_timeout='60s';
create or replace function private.quote_checkout(p_request jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  v_now timestamptz:=statement_timestamp(); seg jsonb; traveller jsonb; extra jsonb; person jsonb;
  f public.flight_instances%rowtype; fare public.flight_fares%rowtype; s public.flight_seats%rowtype;
  offer public.flight_addon_offers%rowtype; product public.addon_products%rowtype;
  origin public.airports%rowtype; dest public.airports%rowtype;
  dob date; day date; first_day date; age integer; kind text; companion text;
  adults integer; children integer; infants integer; n integer; j integer:=1; leg integer:=0;
  prev_arrival timestamptz; prev_dest uuid; outbound_origin uuid; outbound_dest uuid; inbound_origin uuid; final_dest uuid;
  needed integer; available integer; used_companions text[]; lines jsonb:='[]'; item jsonb;
  b bigint; t bigint; fee bigint; bag bigint; seat_fee bigint; total_base bigint:=0; total_tax bigint:=0;
  total_fee bigint:=0; total_bag bigint:=0; total_seat bigint:=0; total bigint;
  bag_name text; seat_code text; trip text; seen text[]:='{}'; k text;
begin
  if auth.uid() is null then raise exception using message='quote.authRequired'; end if;
  if p_request is null or jsonb_typeof(p_request)<>'object' or octet_length(p_request::text)>100000 then raise exception using message='quote.invalid'; end if;
  trip:=p_request->>'tripType';
  if trip is null or trip not in ('one_way','round_trip','multi_city') then raise exception using message='quote.invalid'; end if;
  foreach k in array array['adults','children','infants'] loop
    if jsonb_typeof(p_request->'counts'->k) is distinct from 'number' or (p_request->'counts'->>k)!~'^[0-9]{1,2}$' then raise exception using message='quote.invalid'; end if;
  end loop;
  adults:=(p_request->'counts'->>'adults')::int; children:=(p_request->'counts'->>'children')::int; infants:=(p_request->'counts'->>'infants')::int;
  if adults<1 or adults+children>9 or infants>adults then raise exception using message='quote.invalid'; end if;
  foreach k in array array['segments','passengers','baggage','seats'] loop
    if jsonb_typeof(p_request->k) is distinct from 'array' then raise exception using message='quote.invalid'; end if;
  end loop;
  n:=jsonb_array_length(p_request->'passengers');
  if n<>adults+children+infants or jsonb_array_length(p_request->'segments') not between 1 and 12
    or jsonb_array_length(p_request->'baggage')>n*12 or jsonb_array_length(p_request->'seats')>n*12
    then raise exception using message='quote.invalid'; end if;
  for traveller in select value from jsonb_array_elements(p_request->'passengers') loop
    k:=traveller->>'id';
    if k is null or k=any(seen) or not (
      k in (select 'adult-'||generate_series(1,adults)) or k in (select 'child-'||generate_series(1,children))
      or k in (select 'infant-'||generate_series(1,infants)))
      or coalesce(traveller->>'dateOfBirth','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      then raise exception using message='quote.invalid'; end if;
    dob:=(traveller->>'dateOfBirth')::date; seen:=array_append(seen,k);
  end loop;
  foreach k in array array['baggage','seats'] loop
    seen:='{}';
    for extra in select value from jsonb_array_elements(p_request->k) loop
      if coalesce(extra->>case when k='baggage' then 'offerId' else 'seatId' end,'')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception using message='quote.invalid'; end if;
      if not exists(select 1 from jsonb_array_elements(p_request->'passengers') p where p->>'id'=extra->>'passengerId')
        or not exists(select 1 from jsonb_array_elements(p_request->'segments') l where l->>'flightId'=extra->>'flightId')
        or coalesce(extra->>'passengerId','')||':'||coalesce(extra->>'flightId','')=any(seen)
        then raise exception using message='quote.invalid'; end if;
      seen:=array_append(seen,(extra->>'passengerId')||':'||(extra->>'flightId'));
    end loop;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_request->'segments') l group by l->>'flightId' having count(*)>1)
    or exists(select 1 from jsonb_array_elements(p_request->'seats') l group by l->>'seatId' having count(*)>1)
    then raise exception using message='quote.invalid'; end if;
  for seg in select value from jsonb_array_elements(p_request->'segments') loop
    foreach k in array array['flightId','fareId'] loop
      if coalesce(seg->>k,'')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception using message='quote.invalid'; end if;
    end loop;
    if jsonb_typeof(seg->'journeyIndex') is distinct from 'number' or jsonb_typeof(seg->'legIndex') is distinct from 'number'
      or coalesce(seg->>'journeyIndex','')!~'^[0-9]{1,2}$' or coalesce(seg->>'legIndex','')!~'^[0-9]{1,2}$' then raise exception using message='quote.invalid'; end if;
    if leg>0 and (seg->>'journeyIndex')::int=j+1 and (seg->>'legIndex')::int=1 then j:=j+1;leg:=0; end if;
    if (seg->>'journeyIndex')::int<>j or (seg->>'legIndex')::int<>leg+1 then raise exception using message='quote.invalid'; end if;
    leg:=leg+1;
    select * into f from public.flight_instances where id=(seg->>'flightId')::uuid;
    if not found or f.published_at is null or f.status not in ('scheduled','delayed') or f.sales_close_at<=v_now or f.departure_at<=v_now then raise exception using message='quote.unavailable'; end if;
    select * into fare from public.flight_fares where id=(seg->>'fareId')::uuid and flight_id=f.id and is_active;
    if not found or fare.currency<>'VND' then raise exception using message='quote.unavailable'; end if;
    select * into origin from public.airports where id=f.departure_airport_id and is_active;
    if not found then raise exception using message='quote.unavailable'; end if;
    select * into dest from public.airports where id=f.arrival_airport_id and is_active;
    if not found then raise exception using message='quote.unavailable'; end if;
    if prev_arrival is not null and (f.departure_at<=prev_arrival or (leg>1 and origin.id<>prev_dest)) then raise exception using message='quote.invalid'; end if;
    if j=1 and leg=1 then outbound_origin:=origin.id;first_day:=(f.departure_at at time zone origin.timezone)::date; end if;
    if j=1 then outbound_dest:=dest.id; end if;
    if j=2 and leg=1 then inbound_origin:=origin.id; end if;
    prev_arrival:=f.arrival_at;prev_dest:=dest.id;final_dest:=dest.id;
    day:=(f.departure_at at time zone origin.timezone)::date;needed:=0;used_companions:='{}';
    for traveller in select value from jsonb_array_elements(p_request->'passengers') loop
      dob:=(traveller->>'dateOfBirth')::date;
      if dob>(v_now at time zone origin.timezone)::date or dob>day then raise exception using message='quote.invalid'; end if;
      age:=extract(year from age(day,dob)); kind:=case when age<2 then 'infant' when age<12 then 'child' else 'adult' end;
      if split_part(traveller->>'id','-',1) <> (case when extract(year from age(first_day,dob))<2 then 'infant' when extract(year from age(first_day,dob))<12 then 'child' else 'adult' end) then raise exception using message='quote.invalid'; end if;
      companion:=null;
      if kind='infant' then
        companion:=traveller->>'accompanyingPassengerId';
        select value into person from jsonb_array_elements(p_request->'passengers') where value->>'id'=companion;
        if person is null or companion=traveller->>'id' or companion=any(used_companions)
          or extract(year from age(day,(person->>'dateOfBirth')::date))<18 then raise exception using message='quote.invalid'; end if;
        used_companions:=array_append(used_companions,companion);
      else needed:=needed+1; end if;
      b:=(to_jsonb(fare)->>(kind||'_base_amount'))::bigint;
      t:=(to_jsonb(fare)->>(kind||'_tax_amount'))::bigint;
      fee:=(to_jsonb(fare)->>(kind||'_fee_amount'))::bigint;
      bag:=0;seat_fee:=0;bag_name:=null;seat_code:=null;
      select value into extra from jsonb_array_elements(p_request->'baggage') where value->>'flightId'=f.id::text and value->>'passengerId'=traveller->>'id';
      if extra is not null then
        select * into offer from public.flight_addon_offers where id=(extra->>'offerId')::uuid and flight_id=f.id and is_active and max_quantity_per_passenger>=1;
        if not found then raise exception using message='quote.offerUnavailable'; end if;
        select * into product from public.addon_products where id=offer.product_id and is_active and category='baggage';
        if not found or offer.currency<>'VND' then raise exception using message='quote.offerUnavailable'; end if;
        bag:=offer.unit_amount;bag_name:=product.name;
      end if;
      select value into extra from jsonb_array_elements(p_request->'seats') where value->>'flightId'=f.id::text and value->>'passengerId'=traveller->>'id';
      if extra is not null then
        select * into s from public.flight_seats where id=(extra->>'seatId')::uuid and flight_id=f.id and cabin_class=fare.cabin_class and not is_blocked;
        if not found or s.currency<>'VND' or exists(select 1 from public.seat_reservations r where r.flight_seat_id=s.id and (r.status='confirmed' or (r.status='held' and r.expires_at>v_now))) then raise exception using message='quote.seatUnavailable'; end if;
        if kind='infant' or (s.is_exit_row and (age<18 or exists(select 1 from jsonb_array_elements(p_request->'passengers') p
          where p->>'accompanyingPassengerId'=traveller->>'id' and extract(year from age(day,(p->>'dateOfBirth')::date))<2))) then raise exception using message='quote.seatIneligible'; end if;
        seat_fee:=s.selection_fee_amount;seat_code:=s.seat_code;
      end if;
      total_base:=total_base+b;total_tax:=total_tax+t;total_fee:=total_fee+fee;total_bag:=total_bag+bag;total_seat:=total_seat+seat_fee;
      item:=jsonb_build_object('passengerId',traveller->>'id','flightId',f.id,'passengerType',kind,'requiresSeat',kind<>'infant',
        'base',b,'tax',t,'fee',fee,'baggage',bag,'seat',seat_fee,'baggageName',bag_name,'seatCode',seat_code);
      lines:=lines||jsonb_build_array(item);
    end loop;
    select count(*) into available from public.flight_seats fs where fs.flight_id=f.id and fs.cabin_class=fare.cabin_class and not fs.is_blocked
      and not exists(select 1 from public.seat_reservations r where r.flight_seat_id=fs.id and (r.status='confirmed' or (r.status='held' and r.expires_at>v_now)));
    if needed>available then raise exception using message='quote.soldOut'; end if;
  end loop;
  if (trip='one_way' and j<>1) or (trip='round_trip' and (j<>2 or outbound_origin<>final_dest or outbound_dest<>inbound_origin))
    or (trip='multi_city' and j<2) then raise exception using message='quote.invalid'; end if;
  total:=total_base+total_tax+total_fee+total_bag+total_seat;
  if total>9007199254740991 or total<=0 then raise exception using message='quote.invalid'; end if;
  return jsonb_build_object('currency','VND','base',total_base,'tax',total_tax,'fee',total_fee,'baggage',total_bag,'seat',total_seat,'total',total,
    'quotedAt',v_now,'expiresAt',v_now+interval '5 minutes','lines',lines);
exception when others then
  if sqlerrm in ('quote.authRequired','quote.invalid','quote.unavailable','quote.offerUnavailable','quote.seatUnavailable','quote.seatIneligible','quote.soldOut') then raise; end if;
  raise exception using message='quote.invalid',errcode='P0001';
end $$;
revoke all on function private.quote_checkout(jsonb) from public,anon,authenticated;
grant execute on function private.quote_checkout(jsonb) to authenticated;
create or replace function public.quote_checkout(p_request jsonb) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.quote_checkout(p_request) $$;
revoke all on function public.quote_checkout(jsonb) from public,anon,authenticated;
grant execute on function public.quote_checkout(jsonb) to authenticated;
notify pgrst,'reload schema';

commit;
