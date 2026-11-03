begin;
set local lock_timeout='10s';
set local statement_timeout='60s';

-- Private helper; creation owns the transaction and has already locked inventory.
-- Task 1 requires an explicit seat. Task 2 replaces this with free auto allocation.
create function private.allocate_booking_seats(p_booking uuid,p_checkout jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare ps record; choice jsonb;
begin
 for ps in select bps.*,bp.ordinal from public.booking_passenger_segments bps
 join public.booking_passengers bp on bp.id=bps.passenger_id
 where bps.booking_id=p_booking and bps.requires_seat order by bps.flight_id,bp.ordinal loop
  choice:=p_checkout->'seats'->(ps.ordinal-1);
  select value into choice from jsonb_array_elements(p_checkout->'seats') c
  where c->>'flightId'=ps.flight_id::text and c->>'passengerId'=p_checkout->'passengers'->(ps.ordinal-1)->>'id';
  if choice is null then raise exception using message='booking.seatRequired'; end if;
  insert into public.seat_reservations(booking_id,passenger_segment_id,flight_id,flight_seat_id,selection_amount,expires_at)
  select p_booking,ps.id,ps.flight_id,(choice->>'seatId')::uuid,fs.selection_fee_amount,b.expires_at
  from public.flight_seats fs cross join public.bookings b where fs.id=(choice->>'seatId')::uuid and b.id=p_booking;
 end loop;
end $$;
revoke all on function private.allocate_booking_seats(uuid,jsonb) from public,anon,authenticated;

create function private.booking_receipt(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'bookingCode',booking_code,'status',status,'total',total_amount,
 'currency',currency,'expiresAt',expires_at,'serverNow',statement_timestamp())
 from public.bookings where id=p_id and user_id=auth.uid()
$$;
revoke all on function private.booking_receipt(uuid) from public,anon,authenticated;

create function private.create_booking(p_request_id uuid,p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); hash text; existing public.bookings%rowtype; payload jsonb; q jsonb; expected jsonb;
 person jsonb; values_ jsonb; seg jsonb; line jsonb; extra jsonb; k text; f public.flight_instances%rowtype;
 fare public.flight_fares%rowtype; origin public.airports%rowtype; dest public.airports%rowtype;
 bid uuid:=gen_random_uuid(); pid uuid; sid uuid; psid uuid; ids jsonb:='{}'; ordinal_ int:=0;
 expiry timestamptz; v_now timestamptz; international boolean; last_arrival date;
 nationality text; issuer text; doc text; doc_expiry date; gender_ text;
begin
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
 perform 1 from public.flight_addon_offers where id in (select (value->>'offerId')::uuid from jsonb_array_elements(payload->'baggage')) order by id for share;
 perform 1 from public.addon_products where id in (select product_id from public.flight_addon_offers where id in
  (select (value->>'offerId')::uuid from jsonb_array_elements(payload->'baggage'))) order by id for share;
 perform 1 from public.airports where id in (select departure_airport_id from public.flight_instances where id in
  (select (value->>'flightId')::uuid from jsonb_array_elements(payload->'segments')) union select arrival_airport_id from public.flight_instances where id in
  (select (value->>'flightId')::uuid from jsonb_array_elements(payload->'segments'))) order by id for share;
 v_now:=clock_timestamp();
 update public.seat_reservations set status='expired',released_at=v_now
 where status='held' and expires_at<=v_now and flight_id in (select (value->>'flightId')::uuid from jsonb_array_elements(payload->'segments'));
 q:=private.quote_checkout(payload);
 if jsonb_typeof(expected) is distinct from 'object' or (expected-'quotedAt'-'expiresAt') is distinct from (q-'quotedAt'-'expiresAt') then raise exception using message='booking.priceChanged'; end if;
 if (expected->>'expiresAt')::timestamptz<=v_now or (expected->>'quotedAt')::timestamptz>v_now+interval '1 minute'
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
 (q->>'base')::bigint,(q->>'tax')::bigint,(q->>'fee')::bigint,(q->>'seat')::bigint,(q->>'baggage')::bigint,(q->>'total')::bigint,
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
   or (nationality is not null and nationality!~'^[A-Z]{2}$') or (issuer is not null and issuer!~'^[A-Z]{2}$')
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
   select value into extra from jsonb_array_elements(payload->'baggage') where value->>'flightId'=f.id::text and value->>'passengerId'=line->>'passengerId';
   if extra is not null then
    insert into public.booking_addons(booking_id,passenger_segment_id,flight_id,offer_id,product_name_snapshot,category_snapshot,weight_kg_snapshot,quantity,unit_amount)
    select bid,psid,f.id,o.id,p.name,p.category,p.weight_kg,1,o.unit_amount from public.flight_addon_offers o join public.addon_products p on p.id=o.product_id where o.id=(extra->>'offerId')::uuid;
   end if;
  end loop;
 end loop;
 perform private.allocate_booking_seats(bid,payload);
 insert into public.booking_events(booking_id,actor_user_id,event_type,to_status,safe_message) values(bid,uid,'created','pending_payment','Booking created; awaiting payment.');
 return private.booking_receipt(bid);
exception when others then
 if sqlerrm like 'quote.%' or sqlerrm in ('booking.authRequired','booking.invalid','booking.requestConflict','booking.priceChanged','booking.quoteExpired','booking.seatRequired') then raise; end if;
 if sqlstate in ('23505','40001','40P01','55P03') then raise exception using message='booking.inventoryChanged'; end if;
 raise exception using message='booking.invalid';
end $$;
revoke all on function private.create_booking(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.create_booking(uuid,jsonb) to authenticated;
create function public.create_booking(p_request_id uuid,p_request jsonb) returns jsonb
language sql volatile security invoker set search_path='' as $$ select private.create_booking(p_request_id,p_request) $$;
revoke all on function public.create_booking(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_booking(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
