begin;
set local lock_timeout='10s';
set local statement_timeout='60s';

-- 1. quote_checkout with meal support and active account guard
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
  meal_amount bigint:=0; meal_name text; total_meal bigint:=0;
begin
  perform private.require_active_account();
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
  if p_request ? 'meals' and jsonb_typeof(p_request->'meals') is distinct from 'array' then raise exception using message='quote.invalid'; end if;
  if jsonb_array_length(coalesce(p_request->'meals','[]'::jsonb))>jsonb_array_length(p_request->'passengers')*12 then raise exception using message='quote.invalid'; end if;
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
  foreach k in array array['baggage','seats','meals'] loop
    seen:='{}';
    for extra in select value from jsonb_array_elements(coalesce(p_request->k,'[]'::jsonb)) loop
      if coalesce(extra->>case when k='seats' then 'seatId' else 'offerId' end,'')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception using message='quote.invalid'; end if;
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
      bag:=0;seat_fee:=0;bag_name:=null;seat_code:=null;meal_amount:=0;meal_name:=null;
      select value into extra from jsonb_array_elements(p_request->'baggage') where value->>'flightId'=f.id::text and value->>'passengerId'=traveller->>'id';
      if extra is not null then
        select * into offer from public.flight_addon_offers where id=(extra->>'offerId')::uuid and flight_id=f.id and is_active and max_quantity_per_passenger>=1;
        if not found then raise exception using message='quote.offerUnavailable'; end if;
        select * into product from public.addon_products where id=offer.product_id and is_active and category='baggage';
        if not found or offer.currency<>'VND' then raise exception using message='quote.offerUnavailable'; end if;
        bag:=offer.unit_amount;bag_name:=product.name;
      end if;
      select value into extra from jsonb_array_elements(coalesce(p_request->'meals','[]'::jsonb)) where value->>'flightId'=f.id::text and value->>'passengerId'=traveller->>'id';
      if extra is not null then
        select * into offer from public.flight_addon_offers where id=(extra->>'offerId')::uuid and flight_id=f.id and is_active and max_quantity_per_passenger=1;
        if not found then raise exception using message='quote.offerUnavailable'; end if;
        select * into product from public.addon_products where id=offer.product_id and is_active and category='meal';
        if not found or offer.currency<>'VND' then raise exception using message='quote.offerUnavailable'; end if;
        meal_amount:=offer.unit_amount;meal_name:=product.name;
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
      total_meal:=total_meal+meal_amount;
      item:=jsonb_build_object('passengerId',traveller->>'id','flightId',f.id,'passengerType',kind,'requiresSeat',kind<>'infant',
        'base',b,'tax',t,'fee',fee,'baggage',bag,'seat',seat_fee,'baggageName',bag_name,'seatCode',seat_code);
      if p_request ? 'meals' then item:=item||jsonb_build_object('meal',meal_amount,'mealName',meal_name); end if;
      lines:=lines||jsonb_build_array(item);
    end loop;
    select count(*) into available from public.flight_seats fs where fs.flight_id=f.id and fs.cabin_class=fare.cabin_class and not fs.is_blocked
      and not exists(select 1 from public.seat_reservations r where r.flight_seat_id=fs.id and (r.status='confirmed' or (r.status='held' and r.expires_at>v_now)));
    if needed>available then raise exception using message='quote.soldOut'; end if;
  end loop;
  if (trip='one_way' and j<>1) or (trip='round_trip' and (j<>2 or outbound_origin<>final_dest or outbound_dest<>inbound_origin))
    or (trip='multi_city' and j<2) then raise exception using message='quote.invalid'; end if;
  total:=total_base+total_tax+total_fee+total_bag+total_seat+total_meal;
  if total>9007199254740991 or total<=0 then raise exception using message='quote.invalid'; end if;
  return jsonb_build_object('currency','VND','base',total_base,'tax',total_tax,'fee',total_fee,'baggage',total_bag,'seat',total_seat,'total',total,
    'quotedAt',v_now,'expiresAt',v_now+interval '5 minutes','lines',lines)
    ||case when p_request ? 'meals' then jsonb_build_object('meal',total_meal) else '{}'::jsonb end;
exception when others then
  if sqlerrm in ('quote.authRequired','quote.invalid','quote.unavailable','quote.offerUnavailable','quote.seatUnavailable','quote.seatIneligible','quote.soldOut') then raise; end if;
  raise exception using message='quote.invalid',errcode='P0001';
end $$;
revoke all on function private.quote_checkout(jsonb) from public,anon,authenticated;
grant execute on function private.quote_checkout(jsonb) to authenticated;

-- 2. create_booking with meal support and active account guard
create or replace function private.create_booking(p_request_id uuid,p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); hash text; existing public.bookings%rowtype; payload jsonb; q jsonb; expected jsonb;
 person jsonb; values_ jsonb; seg jsonb; line jsonb; extra jsonb; k text; f public.flight_instances%rowtype;
 fare public.flight_fares%rowtype; origin public.airports%rowtype; dest public.airports%rowtype;
 bid uuid:=gen_random_uuid(); pid uuid; sid uuid; psid uuid; ids jsonb:='{}'; ordinal_ int:=0;
 expiry timestamptz; v_now timestamptz; international boolean; last_arrival date;
 nationality text; issuer text; doc text; doc_expiry date; gender_ text;
begin
 perform private.require_active_account();
 if uid is null then raise exception using message='booking.authRequired'; end if;
 if p_request_id is null or jsonb_typeof(p_request) is distinct from 'object' or octet_length(p_request::text)>150000 then raise exception using message='booking.invalid'; end if;
 hash:=encode(sha256(convert_to(p_request::text,'UTF8')),'hex');
 -- Account-scoped idempotency; transaction lock also serializes concurrent retries.
 perform pg_advisory_xact_lock(hashtextextended(uid::text||':'||p_request_id::text,0));
 select * into existing from public.bookings where user_id=uid and create_request_id=p_request_id;
 if found then
  if existing.create_request_hash<>hash then raise exception using message='booking.requestConflict'; end if;
  return private.booking_receipt(existing.id);
 end if;
 payload:=p_request->'checkout'; expected:=p_request->'expectedQuote';
 -- Validate shapes before casts/locks; re-quote below after inventory locks.
 perform private.quote_checkout(payload);
 perform 1 from public.flight_instances where id in (select (value->>'flightId')::uuid from jsonb_array_elements(payload->'segments')) order by id for update;
 perform 1 from public.flight_fares where id in (select (value->>'fareId')::uuid from jsonb_array_elements(payload->'segments')) order by id for share;
 perform 1 from public.flight_seats where flight_id in (select (value->>'flightId')::uuid from jsonb_array_elements(payload->'segments')) order by id for share;
 perform 1 from public.flight_addon_offers where id in (select (value->>'offerId')::uuid from jsonb_array_elements((payload->'baggage')||coalesce(payload->'meals','[]'::jsonb))) order by id for share;
 perform 1 from public.addon_products where id in (select product_id from public.flight_addon_offers where id in
  (select (value->>'offerId')::uuid from jsonb_array_elements((payload->'baggage')||coalesce(payload->'meals','[]'::jsonb)))) order by id for share;
 perform 1 from public.airports where id in (select departure_airport_id from public.flight_instances where id in
  (select (value->>'flightId')::uuid from jsonb_array_elements(payload->'segments')) union select arrival_airport_id from public.flight_instances where id in
  (select (value->>'flightId')::uuid from jsonb_array_elements(payload->'segments'))) order by id for share;
 v_now:=clock_timestamp();
 update public.seat_reservations set status='expired',released_at=v_now
 where status='held' and expires_at<=v_now and flight_id in (select (value->>'flightId')::uuid from jsonb_array_elements(payload->'segments'));
 q:=private.quote_checkout(payload);
 if jsonb_typeof(expected) is distinct from 'object' or (expected-'quotedAt'-'expiresAt') is distinct from (q-'quotedAt'-'expiresAt') then raise exception using message='booking.priceChanged'; end if;
 if jsonb_typeof(expected->'expiresAt') is distinct from 'string' or jsonb_typeof(expected->'quotedAt') is distinct from 'string'
 or (expected->>'expiresAt')::timestamptz<=v_now or (expected->>'expiresAt')::timestamptz<=(expected->>'quotedAt')::timestamptz
 or (expected->>'quotedAt')::timestamptz>v_now+interval '1 minute'
 or (expected->>'expiresAt')::timestamptz>(expected->>'quotedAt')::timestamptz+interval '5 minutes' then raise exception using message='booking.quoteExpired'; end if;
 select least(v_now+interval '15 minutes',min(sales_close_at)) into expiry from public.flight_instances
 where id in (select (value->>'flightId')::uuid from jsonb_array_elements(payload->'segments'));
 if expiry<=v_now then raise exception using message='quote.unavailable'; end if;
 if jsonb_typeof(p_request->'contact') is distinct from 'object'
 or length(btrim(coalesce(p_request->'contact'->>'contactName',''))) not between 2 and 100
 or length(coalesce(p_request->'contact'->>'contactEmail',''))>254
 or coalesce(p_request->'contact'->>'contactEmail','')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or coalesce(p_request->'contact'->>'contactPhone','')!~'^(\+[1-9][0-9]{6,14}|[0-9]{7,15})$'
 or jsonb_typeof(p_request->'travellers') is distinct from 'array'
 or jsonb_array_length(p_request->'travellers')<>jsonb_array_length(payload->'passengers') then raise exception using message='booking.invalid'; end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_request->'travellers'))<>jsonb_array_length(payload->'passengers')
 or exists(select 1 from jsonb_array_elements(p_request->'travellers') t where not exists(select 1 from jsonb_array_elements(payload->'passengers') p
 where p->>'id'=t->>'id' and p->>'dateOfBirth'=t->'values'->>'dateOfBirth')) then raise exception using message='booking.invalid'; end if;
 select bool_or(a.country_code<>d.country_code),max((fi.arrival_at at time zone d.timezone)::date) into international,last_arrival
 from public.flight_instances fi join public.airports a on a.id=fi.departure_airport_id join public.airports d on d.id=fi.arrival_airport_id
 where fi.id in (select (value->>'flightId')::uuid from jsonb_array_elements(payload->'segments'));
 insert into public.bookings(id,user_id,booking_code,create_request_id,create_request_hash,trip_type,contact_name,contact_email,contact_phone,
 base_amount,tax_amount,fee_amount,seat_amount,addon_amount,total_amount,refund_policy_snapshot,expires_at)
 values(bid,uid,'FY'||upper(substr(replace(bid::text,'-',''),1,30)),p_request_id,hash,(payload->>'tripType')::public.trip_type,
 btrim(p_request->'contact'->>'contactName'),lower(btrim(p_request->'contact'->>'contactEmail')),p_request->'contact'->>'contactPhone',
 (q->>'base')::bigint,(q->>'tax')::bigint,(q->>'fee')::bigint,(q->>'seat')::bigint,(q->>'baggage')::bigint+coalesce((q->>'meal')::bigint,0),(q->>'total')::bigint,
 '{"source":"per_passenger_segment_snapshot"}',expiry);
 for person in select value from jsonb_array_elements(payload->'passengers') loop
  select value->'values' into values_ from jsonb_array_elements(p_request->'travellers') where value->>'id'=person->>'id';
  foreach k in array array['givenNames','familyName'] loop
   if length(btrim(coalesce(values_->>k,''))) not between 1 and 100 or (values_->>k)~'[[:cntrl:]]' then raise exception using message='booking.invalid'; end if;
  end loop;
  nationality:=nullif(upper(btrim(values_->>'nationalityCode')),''); issuer:=nullif(upper(btrim(values_->>'passportIssuerCountry')),'');
  doc:=nullif(btrim(values_->>'passportNumber'),''); doc_expiry:=nullif(values_->>'passportExpiryDate','')::date;
  gender_:=nullif(values_->>'gender','');
  if (gender_ is not null and gender_ not in ('male','female','unspecified'))
   or not private.valid_booking_country(nationality) or not private.valid_booking_country(issuer)
   or (international and (nationality is null or doc is null or issuer is null or doc_expiry is null))
   or ((doc is not null or issuer is not null or doc_expiry is not null) and (doc is null or issuer is null or doc_expiry is null))
   or (doc is not null and (length(doc)>50 or doc~'[[:cntrl:]]')) or doc_expiry<last_arrival then raise exception using message='booking.invalid'; end if;
  ordinal_:=ordinal_+1; pid:=gen_random_uuid(); ids:=ids||jsonb_build_object(person->>'id',pid);
  insert into public.booking_passengers(id,booking_id,ordinal,given_names,family_name,date_of_birth,nationality_code,document_type,document_number,document_expiry_date,document_issuer_country,gender)
  values(pid,bid,ordinal_,btrim(values_->>'givenNames'),btrim(values_->>'familyName'),(person->>'dateOfBirth')::date,nationality,
  case when doc is not null then 'passport'::public.document_type end,doc,doc_expiry,issuer,gender_);
 end loop;
 for seg in select value from jsonb_array_elements(payload->'segments') loop
  select * into f from public.flight_instances where id=(seg->>'flightId')::uuid;
  select * into fare from public.flight_fares where id=(seg->>'fareId')::uuid;
  select * into origin from public.airports where id=f.departure_airport_id;
  select * into dest from public.airports where id=f.arrival_airport_id;
  sid:=gen_random_uuid();
  insert into public.booking_segments(id,booking_id,flight_id,fare_id,journey_number,leg_number,flight_snapshot,fare_code_snapshot,cabin_class)
  values(sid,bid,f.id,fare.id,(seg->>'journeyIndex')::int,(seg->>'legIndex')::int,
  jsonb_build_object('flight_number',f.flight_number,'airline_name',(select name from public.airlines where id=f.airline_id),
  'departure_iata',origin.iata_code,'arrival_iata',dest.iata_code,'departure_at',f.departure_at,'arrival_at',f.arrival_at,
  'departure_timezone',origin.timezone,'arrival_timezone',dest.timezone,'fare_name',fare.name),fare.fare_code,fare.cabin_class);
  for line in select value from jsonb_array_elements(q->'lines') where value->>'flightId'=f.id::text loop
   select value into person from jsonb_array_elements(payload->'passengers') where value->>'id'=line->>'passengerId';
   psid:=gen_random_uuid();
   insert into public.booking_passenger_segments(id,booking_id,segment_id,passenger_id,flight_id,passenger_type,requires_seat,accompanying_passenger_id,
   base_amount,tax_amount,fee_amount,allowance_snapshot,cancellation_rules_snapshot)
   values(psid,bid,sid,(ids->>(line->>'passengerId'))::uuid,f.id,(line->>'passengerType')::public.passenger_type,(line->>'requiresSeat')::boolean,
   case when line->>'passengerType'='infant' then (ids->>(person->>'accompanyingPassengerId'))::uuid end,
   (line->>'base')::bigint,(line->>'tax')::bigint,(line->>'fee')::bigint,fare.baggage_allowance,
   jsonb_build_object('allowed',fare.cancellation_allowed,'cutoff_minutes',fare.cancellation_cutoff_minutes,'fee_amount',fare.cancellation_fee_amount));
   for extra in select value from jsonb_array_elements((payload->'baggage')||coalesce(payload->'meals','[]'::jsonb)) where value->>'flightId'=f.id::text and value->>'passengerId'=line->>'passengerId' loop
    insert into public.booking_addons(booking_id,passenger_segment_id,flight_id,offer_id,product_name_snapshot,category_snapshot,weight_kg_snapshot,quantity,unit_amount)
    select bid,psid,f.id,o.id,p.name,p.category,p.weight_kg,1,o.unit_amount from public.flight_addon_offers o join public.addon_products p on p.id=o.product_id where o.id=(extra->>'offerId')::uuid;
   end loop;
  end loop;
 end loop;
 perform private.allocate_booking_seats(bid,payload);
 insert into public.booking_events(booking_id,actor_user_id,event_type,to_status,safe_message) values(bid,uid,'created','pending_payment','Booking created; awaiting payment.');
 return private.booking_receipt(bid);
exception when others then
 if sqlerrm like 'quote.%' or sqlerrm in ('booking.authRequired','booking.invalid','booking.requestConflict','booking.requestClosed','booking.priceChanged','booking.quoteExpired','booking.seatRequired') then raise; end if;
 if sqlstate in ('23505','40001','40P01','55P03') then raise exception using message='booking.inventoryChanged'; end if;
 raise exception using message='booking.invalid';
end $$;
revoke all on function private.create_booking(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.create_booking(uuid,jsonb) to authenticated;

-- 3. get_pending_booking with meal support and active account guard
create or replace function private.get_pending_booking(p_booking_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare b public.bookings%rowtype; v_now timestamptz; result jsonb;
begin
 perform private.require_active_account();
 if auth.uid() is null then raise exception using message='booking.authRequired'; end if;
 if not exists(select 1 from public.bookings where id=p_booking_id and user_id=auth.uid()) then raise exception using message='booking.notFound'; end if;
 -- Same lock order as creation: flights, then booking/holds. Never lock foreign orders.
 perform 1 from public.flight_instances where id in (select flight_id from public.booking_segments where booking_id=p_booking_id) order by id for update;
 select * into b from public.bookings where id=p_booking_id and user_id=auth.uid() for update;
 v_now:=clock_timestamp();
 if b.status='pending_payment' and b.expires_at<=v_now then
  update public.bookings set status='expired',version=version+1 where id=b.id;
  update public.seat_reservations set status='expired',released_at=v_now where booking_id=b.id and status='held';
  insert into public.booking_events(booking_id,actor_user_id,event_type,from_status,to_status,safe_message)
   values(b.id,auth.uid(),'expired','pending_payment','expired','Booking hold expired.');
 end if;
 result:=private.booking_receipt(b.id)||jsonb_build_object('serverNow',clock_timestamp(),
 'contact',jsonb_build_object('name',b.contact_name,'email',b.contact_email,'phone',b.contact_phone),
 'base',b.base_amount,'tax',b.tax_amount,'fee',b.fee_amount,'baggage',b.addon_amount,'seat',b.seat_amount,
 'baggageOnly',(select coalesce(sum(a.total_amount),0) from public.booking_addons a where a.booking_id=b.id and a.category_snapshot='baggage'),
 'meal',(select coalesce(sum(a.total_amount),0) from public.booking_addons a where a.booking_id=b.id and a.category_snapshot='meal'),
 'passengers',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'ordinal',p.ordinal,'givenNames',p.given_names,'familyName',p.family_name,'gender',p.gender) order by p.ordinal),'[]') from public.booking_passengers p where p.booking_id=b.id),
 'segments',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'flightId',s.flight_id,'journeyIndex',s.journey_number,'legIndex',s.leg_number,'snapshot',s.flight_snapshot) order by s.journey_number,s.leg_number),'[]') from public.booking_segments s where s.booking_id=b.id),
 'passengerSegments',(select coalesce(jsonb_agg(jsonb_build_object('id',ps.id,'passengerId',ps.passenger_id,'flightId',ps.flight_id,'passengerType',ps.passenger_type,'requiresSeat',ps.requires_seat,'accompanyingPassengerId',ps.accompanying_passenger_id,'allowance',ps.allowance_snapshot)),'[]') from public.booking_passenger_segments ps where ps.booking_id=b.id),
 'seats',(select coalesce(jsonb_agg(jsonb_build_object('passengerSegmentId',r.passenger_segment_id,'flightId',r.flight_id,'seatCode',fs.seat_code,'amount',r.selection_amount,'status',r.status)),'[]') from public.seat_reservations r join public.flight_seats fs on fs.id=r.flight_seat_id where r.booking_id=b.id),
 'addons',(select coalesce(jsonb_agg(jsonb_build_object('passengerSegmentId',a.passenger_segment_id,'flightId',a.flight_id,'name',a.product_name_snapshot,'category',a.category_snapshot,'weightKg',a.weight_kg_snapshot,'amount',a.total_amount)),'[]') from public.booking_addons a where a.booking_id=b.id));
 return result;
end $$;
revoke all on function private.get_pending_booking(uuid) from public,anon,authenticated;
grant execute on function private.get_pending_booking(uuid) to authenticated;

-- 4. enforce_checkout_catalogue_capability
create or replace function private.enforce_checkout_catalogue_capability()
returns trigger language plpgsql security invoker set search_path='' as $$
declare new_category public.addon_category; old_category public.addon_category;
begin
 if tg_op='UPDATE' and (to_jsonb(new)-'updated_at') is not distinct from (to_jsonb(old)-'updated_at') then return new; end if;
 if tg_table_name='addon_products' then
  if tg_op='UPDATE' and new.category is distinct from old.category then
   raise exception 'Cannot change an existing add-on product category' using errcode='23514';
  end if;
  -- Preserve reference-only inactive insurance rows used by idempotent seeds.
  if tg_op='INSERT' and new.category not in ('baggage','meal') and not new.is_active then return new; end if;
  if new.category not in ('baggage','meal') then
   raise exception 'Insurance is read-only: checkout supports baggage and meals only' using errcode='23514';
  end if;
 else
  if new.max_quantity_per_passenger<>1 then
   raise exception 'Checkout supports one add-on choice per category per passenger per leg; max quantity must be 1' using errcode='23514';
  end if;
  select p.category into new_category from public.addon_products p where p.id=new.product_id;
  if tg_op='UPDATE' then
   select p.category into old_category from public.addon_products p where p.id=old.product_id;
   if new_category is distinct from old_category then
    raise exception 'Cannot change an existing add-on offer category' using errcode='23514';
   end if;
  end if;
  if new_category is null or new_category not in ('baggage','meal') then
   raise exception 'Insurance is read-only: checkout supports baggage and meals only' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.enforce_checkout_catalogue_capability() from public,anon,authenticated;
notify pgrst,'reload schema';

commit;
