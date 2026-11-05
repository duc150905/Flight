-- Candidate migration and seeded future checkout flights required. All writes roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data)
values ('00000000-0000-4000-8000-000000000096','checkout-meals@example.invalid','{}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000096',true);
create function pg_temp.meal_quote(req jsonb, expected text default null) returns jsonb language plpgsql as $$
declare result jsonb; actual text;
begin
 begin result:=public.quote_checkout(req); exception when others then actual:=sqlerrm; end;
 if actual is distinct from expected then raise exception 'Meal quote expected %, got %',expected,actual; end if;
 return result;
end $$;
create function pg_temp.meal_create(rid uuid, req jsonb, expected text default null) returns jsonb language plpgsql as $$
declare result jsonb; actual text;
begin
 begin result:=public.create_booking(rid,req); exception when others then actual:=sqlerrm; end;
 if actual is distinct from expected then raise exception 'Meal booking expected %, got %',expected,actual; end if;
 return result;
end $$;
do $$
declare f uuid; fare uuid; other uuid; product uuid; meal uuid; second_meal uuid; bag uuid;
 req jsonb; old_q jsonb; empty_q jsonb; q jsonb; selection jsonb; booking_req jsonb; result jsonb; pending jsonb;
 rid uuid:=gen_random_uuid(); bid uuid; count_before bigint; bag_amount bigint; closed_rid uuid:=gen_random_uuid();
begin
 select fl.id,fa.id into f,fare from public.flight_instances fl join public.flight_fares fa on fa.flight_id=fl.id
 where fl.flight_number='F0103' and fl.departure_at>now()+interval '1 hour' and fa.fare_code='DEMO_STANDARD'
 order by fl.departure_at limit 1;
 if f is null then raise exception 'Missing future F0103 demo fixture'; end if;
 select id into other from public.flight_instances where id<>f order by departure_at desc limit 1;
 select o.id,o.unit_amount into bag,bag_amount from public.flight_addon_offers o join public.addon_products p on p.id=o.product_id
 where o.flight_id=f and o.is_active and p.is_active and p.category='baggage' order by o.unit_amount limit 1;
 if bag is null or other is null then raise exception 'Missing other flight/baggage fixture'; end if;
 req:=jsonb_build_object('tripType','one_way','counts','{"adults":1,"children":0,"infants":0}'::jsonb,
 'segments',jsonb_build_array(jsonb_build_object('flightId',f,'fareId',fare,'journeyIndex',1,'legIndex',1)),
 'passengers','[{"id":"adult-1","dateOfBirth":"1990-01-01"}]'::jsonb,'baggage','[]'::jsonb,'seats','[]'::jsonb);
 old_q:=pg_temp.meal_quote(req);
 if old_q ? 'meal' or old_q->'lines'->0 ? 'meal' or old_q->'lines'->0 ? 'mealName' then raise exception 'Legacy quote shape changed'; end if;
 empty_q:=pg_temp.meal_quote(req||'{"meals":[]}'::jsonb);
 if empty_q->>'meal' is distinct from '0' or empty_q->'lines'->0->>'meal' is distinct from '0' or empty_q->'lines'->0->'mealName' is distinct from 'null'::jsonb
 then raise exception 'Explicit empty meals did not opt into meal shape'; end if;
 if (empty_q-'meal'-'lines'-'quotedAt'-'expiresAt') is distinct from (old_q-'lines'-'quotedAt'-'expiresAt')
 or ((empty_q->'lines'->0)-'meal'-'mealName') is distinct from (old_q->'lines'->0) then raise exception 'Old quote fields changed'; end if;
 insert into public.addon_products(code,name,category) values ('ROLLBACK_MEAL_96','Rollback meal','meal') returning id into product;
 insert into public.flight_addon_offers(flight_id,product_id,unit_amount,max_quantity_per_passenger)
 values(f,product,123456,1) returning id into meal;
 insert into public.flight_addon_offers(flight_id,product_id,unit_amount,max_quantity_per_passenger)
 values(other,product,654321,1) returning id into second_meal;
 selection:=jsonb_build_array(jsonb_build_object('passengerId','adult-1','flightId',f,'offerId',meal));
 req:=req||jsonb_build_object('meals',selection,'baggage',jsonb_build_array(jsonb_build_object('passengerId','adult-1','flightId',f,'offerId',bag)));
 q:=pg_temp.meal_quote(jsonb_set(req,'{meals,0,unitAmount}','1')||'{"meal":1,"total":1}'::jsonb);
 if (q->>'meal')::bigint<>123456 or q->'lines'->0->>'mealName'<>'Rollback meal'
 or (q->>'total')::bigint<>(old_q->>'total')::bigint+bag_amount+123456 then raise exception 'Meal price not authoritative'; end if;
 perform pg_temp.meal_quote(jsonb_set(req,'{meals}','null'),'quote.invalid');
 perform pg_temp.meal_quote(jsonb_set(req,'{meals}','{}'),'quote.invalid');
 perform pg_temp.meal_quote(jsonb_set(req,'{meals}',selection||selection),'quote.invalid');
 perform pg_temp.meal_quote(jsonb_set(req,'{meals,0,passengerId}','"missing"'),'quote.invalid');
 perform pg_temp.meal_quote(jsonb_set(req,'{meals,0,flightId}',to_jsonb(other)),'quote.invalid');
 perform pg_temp.meal_quote(jsonb_set(req,'{meals,0,offerId}',to_jsonb(second_meal)),'quote.offerUnavailable');
 perform pg_temp.meal_quote(jsonb_set(req,'{meals,0,offerId}',to_jsonb(bag)),'quote.offerUnavailable');
 perform pg_temp.meal_quote(jsonb_set(req,'{baggage,0,offerId}',to_jsonb(meal)),'quote.offerUnavailable');
 perform pg_temp.meal_quote(jsonb_set(req,'{meals,0,offerId}',to_jsonb(gen_random_uuid())),'quote.offerUnavailable');
 update public.flight_addon_offers set is_active=false where id=meal;
 perform pg_temp.meal_quote(req,'quote.offerUnavailable');
 update public.flight_addon_offers set is_active=true where id=meal;
 update public.addon_products set is_active=false where id=product;
 perform pg_temp.meal_quote(req,'quote.offerUnavailable');
 update public.addon_products set is_active=true where id=product;
 -- Each traveller, including a lap infant, can independently select one meal.
 perform pg_temp.meal_quote(req||jsonb_build_object('counts','{"adults":1,"children":0,"infants":1}'::jsonb,
 'passengers',(req->'passengers')||jsonb_build_array(jsonb_build_object('id','infant-1','dateOfBirth',(current_date-interval '6 months')::date,'accompanyingPassengerId','adult-1')),
 'meals',selection||jsonb_build_array((selection->0)||'{"passengerId":"infant-1"}'::jsonb)));
 -- Catalogue support remains bounded and existing product/offer categories cannot be swapped.
 begin update public.addon_products set category='baggage',weight_kg=20 where id=product;
 raise exception 'Product category swap accepted'; exception when check_violation then null; end;
 begin update public.flight_addon_offers set product_id=(select product_id from public.flight_addon_offers where id=bag) where id=meal;
 raise exception 'Offer category swap accepted'; exception when check_violation then null; end;
 begin update public.flight_addon_offers set max_quantity_per_passenger=2 where id=meal;
 raise exception 'Multiple meal quantity accepted'; exception when check_violation then null; end;
 begin insert into public.addon_products(code,name,category) values ('ROLLBACK_INSURANCE_96','Unsupported','insurance_demo');
 raise exception 'Unsupported active insurance accepted'; exception when check_violation then null; end;
 booking_req:=jsonb_build_object('checkout',req,'expectedQuote',q,
 'contact','{"contactName":"Meal Test","contactEmail":"meal@example.invalid","contactPhone":"+84901234567"}'::jsonb,
 'travellers','[{"id":"adult-1","values":{"givenNames":"Meal","familyName":"Test","dateOfBirth":"1990-01-01"}}]'::jsonb);
 select count(*) into count_before from public.bookings;
 update public.flight_addon_offers set unit_amount=unit_amount+1 where id=meal;
 perform pg_temp.meal_create(gen_random_uuid(),booking_req,'booking.priceChanged');
 if (select count(*) from public.bookings)<>count_before then raise exception 'Price change left partial booking'; end if;
 update public.flight_addon_offers set unit_amount=unit_amount-1 where id=meal;
 -- The lost-response recovery fence remains enforced with meals.
 perform public.find_booking_request(closed_rid);
 perform pg_temp.meal_create(closed_rid,booking_req,'booking.requestClosed');
 result:=pg_temp.meal_create(rid,booking_req); bid:=(result->>'id')::uuid;
 if pg_temp.meal_create(rid,booking_req)->>'id'<>bid::text then raise exception 'Meal retry duplicated booking'; end if;
 perform pg_temp.meal_create(rid,jsonb_set(booking_req,'{checkout,meals}','[]'),'booking.requestConflict');
 if (select count(*) from public.bookings)<>count_before+1 or (select addon_amount from public.bookings where id=bid)<>bag_amount+123456
 or (select total_amount from public.bookings where id=bid)<>(q->>'total')::bigint then raise exception 'Meal booking amounts incorrect'; end if;
 if (select count(*) from public.booking_addons where booking_id=bid)<>2
 or not exists(select 1 from public.booking_addons where booking_id=bid and offer_id=meal and category_snapshot='meal'
 and product_name_snapshot='Rollback meal' and quantity=1 and unit_amount=123456 and total_amount=123456) then raise exception 'Meal snapshot missing'; end if;
 update public.addon_products set name='Renamed meal' where id=product;
 update public.flight_addon_offers set unit_amount=999999 where id=meal;
 pending:=public.get_pending_booking(bid);
 if (pending->>'baggage')::bigint<>bag_amount+123456 or (pending->>'baggageOnly')::bigint<>bag_amount
 or (pending->>'meal')::bigint<>123456 or (pending->>'total')::bigint<>(q->>'total')::bigint
 or not exists(select 1 from jsonb_array_elements(pending->'addons') a where a->>'category'='meal' and a->>'name'='Rollback meal' and a->>'amount'='123456')
 then raise exception 'Pending snapshot totals or legacy baggage alias incorrect'; end if;
 -- Legacy client create must still compare its unchanged old expectedQuote successfully.
 req:=req-'meals'; req:=jsonb_set(req,'{baggage}','[]');
 booking_req:=jsonb_set(jsonb_set(booking_req,'{checkout}',req),'{expectedQuote}',pg_temp.meal_quote(req));
 result:=pg_temp.meal_create(gen_random_uuid(),booking_req);
 pending:=public.get_pending_booking((result->>'id')::uuid);
 if pending->>'meal'<>'0' or pending->>'baggageOnly'<>'0' then raise exception 'Legacy pending default meal incorrect'; end if;
 insert into private.account_access(user_id,suspended) values ('00000000-0000-4000-8000-000000000096',true);
 -- Quote/create map guarded permission errors to their existing domain error; pending keeps 42501.
 perform pg_temp.meal_quote(req,'quote.invalid');
 perform pg_temp.meal_create(gen_random_uuid(),booking_req,'booking.invalid');
 begin perform public.get_pending_booking(bid); raise exception 'Suspended account read pending booking';
 exception when insufficient_privilege then null; end;
 if has_function_privilege('anon','public.quote_checkout(jsonb)','execute') or has_function_privilege('anon','public.create_booking(uuid,jsonb)','execute')
 or has_function_privilege('anon','public.get_pending_booking(uuid)','execute') then raise exception 'Anonymous owner API exposed'; end if;
end $$;

-- Cross-leg and cross-traveller mapping: selection order deliberately differs
-- from passenger/segment order; two pending orders remain inside this rollback.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000096',true);
update private.account_access set suspended=false where user_id='00000000-0000-4000-8000-000000000096';
do $$
declare outbound record; inbound record; third_leg record; product uuid; o1 uuid; o2 uuid; o3 uuid;
 req jsonb; q jsonb; request jsonb; receipt jsonb; bid uuid; line jsonb; expected bigint; actual bigint;
 pending jsonb; addons_expected integer; journeys integer; s record;
begin
 select f.id,fa.id fare,f.arrival_at into outbound from public.flight_instances f
 join public.flight_fares fa on fa.flight_id=f.id
 join public.airports dep on dep.id=f.departure_airport_id join public.airports arr on arr.id=f.arrival_airport_id
 where dep.iata_code='HAN' and arr.iata_code='DAD' and f.departure_at>now()+interval '1 day'
 and f.status='scheduled' and f.published_at is not null and f.sales_close_at>now()
 and fa.fare_code='ECO_FLEX' and fa.is_active order by f.departure_at,f.id limit 1;
 select f.id,fa.id fare,f.arrival_at into inbound from public.flight_instances f
 join public.flight_fares fa on fa.flight_id=f.id
 join public.airports dep on dep.id=f.departure_airport_id join public.airports arr on arr.id=f.arrival_airport_id
 where dep.iata_code='DAD' and arr.iata_code='HAN' and f.departure_at>outbound.arrival_at+interval '1 day'
 and f.status='scheduled' and f.published_at is not null and f.sales_close_at>now()
 and fa.fare_code='ECO_FLEX' and fa.is_active order by f.departure_at,f.id limit 1;
 select f.id,fa.id fare into third_leg from public.flight_instances f
 join public.flight_fares fa on fa.flight_id=f.id
 join public.airports dep on dep.id=f.departure_airport_id join public.airports arr on arr.id=f.arrival_airport_id
 where dep.iata_code='HAN' and arr.country_code='VN' and f.departure_at>inbound.arrival_at+interval '1 day'
 and f.status='scheduled' and f.published_at is not null and f.sales_close_at>now()
 and fa.fare_code='ECO_FLEX' and fa.is_active order by f.departure_at,f.id limit 1;
 if outbound.id is null or inbound.id is null or third_leg.id is null then raise exception 'Missing future domestic round-trip/multi-city fixture'; end if;
 insert into public.addon_products(code,name,category) values ('ROLLBACK_MEAL_LEGS_96','Per-leg meal','meal') returning id into product;
 insert into public.flight_addon_offers(flight_id,product_id,unit_amount,max_quantity_per_passenger) values(outbound.id,product,111000,1) returning id into o1;
 insert into public.flight_addon_offers(flight_id,product_id,unit_amount,max_quantity_per_passenger) values(inbound.id,product,222000,1) returning id into o2;
 insert into public.flight_addon_offers(flight_id,product_id,unit_amount,max_quantity_per_passenger) values(third_leg.id,product,333000,1) returning id into o3;
 req:=jsonb_build_object('tripType','round_trip','counts','{"adults":2,"children":0,"infants":0}'::jsonb,
 'segments',jsonb_build_array(
 jsonb_build_object('flightId',outbound.id,'fareId',outbound.fare,'journeyIndex',1,'legIndex',1),
 jsonb_build_object('flightId',inbound.id,'fareId',inbound.fare,'journeyIndex',2,'legIndex',1)),
 'passengers','[{"id":"adult-1","dateOfBirth":"1990-01-01"},{"id":"adult-2","dateOfBirth":"1992-01-01"}]'::jsonb,
 'baggage','[]'::jsonb,'seats','[]'::jsonb,
 'meals',jsonb_build_array(
 jsonb_build_object('passengerId','adult-2','flightId',inbound.id,'offerId',o2),
 jsonb_build_object('passengerId','adult-1','flightId',outbound.id,'offerId',o1),
 jsonb_build_object('passengerId','adult-1','flightId',inbound.id,'offerId',o2),
 jsonb_build_object('passengerId','adult-2','flightId',outbound.id,'offerId',o1)));
 for journeys in 2..3 loop
  if journeys=3 then
   req:=req||jsonb_build_object('tripType','multi_city',
   'segments',(req->'segments')||jsonb_build_array(jsonb_build_object('flightId',third_leg.id,'fareId',third_leg.fare,'journeyIndex',3,'legIndex',1)),
   'meals',(req->'meals')||jsonb_build_array(jsonb_build_object('passengerId','adult-1','flightId',third_leg.id,'offerId',o3)));
  end if;
  q:=pg_temp.meal_quote(req); expected:=case when journeys=2 then 666000 else 999000 end;
  if (q->>'meal')::bigint is distinct from expected or jsonb_array_length(q->'lines')<>journeys*2 then raise exception 'Per-leg quote meal aggregate incorrect'; end if;
  for line in select value from jsonb_array_elements(q->'lines') loop
   select coalesce(sum(o.unit_amount),0) into actual from jsonb_array_elements(req->'meals') e
   join public.flight_addon_offers o on o.id=(e->>'offerId')::uuid
   where e->>'flightId'=line->>'flightId' and e->>'passengerId'=line->>'passengerId';
   if (line->>'meal')::bigint is distinct from actual then raise exception 'Per-leg traveller quote association incorrect'; end if;
  end loop;
  request:=jsonb_build_object('checkout',req,'expectedQuote',q,
  'contact','{"contactName":"Leg Meal","contactEmail":"legs@example.invalid","contactPhone":"+84901234567"}'::jsonb,
  'travellers','[{"id":"adult-1","values":{"givenNames":"First","familyName":"Traveller","dateOfBirth":"1990-01-01"}},{"id":"adult-2","values":{"givenNames":"Second","familyName":"Traveller","dateOfBirth":"1992-01-01"}}]'::jsonb);
  receipt:=pg_temp.meal_create(gen_random_uuid(),request); bid:=(receipt->>'id')::uuid;
  addons_expected:=case when journeys=2 then 4 else 5 end;
  if (select count(*) from public.booking_addons where booking_id=bid)<>addons_expected
  or (select addon_amount from public.bookings where id=bid)<>expected then raise exception 'Per-leg snapshot count/total incorrect'; end if;
  for s in select a.*,bp.ordinal,bs.journey_number from public.booking_addons a
  join public.booking_passenger_segments ps on ps.id=a.passenger_segment_id
  join public.booking_passengers bp on bp.id=ps.passenger_id join public.booking_segments bs on bs.id=ps.segment_id
  where a.booking_id=bid loop
   if s.category_snapshot<>'meal' or s.unit_amount<>s.journey_number*111000 or s.quantity<>1
   or not exists(select 1 from jsonb_array_elements(req->'meals') e where e->>'flightId'=s.flight_id::text
   and e->>'passengerId'='adult-'||s.ordinal and e->>'offerId'=s.offer_id::text) then raise exception 'Per-leg traveller addon snapshot association incorrect'; end if;
  end loop;
  pending:=public.get_pending_booking(bid);
  if (pending->>'meal')::bigint is distinct from expected or pending->>'baggageOnly' is distinct from '0'
  or (pending->>'baggage')::bigint is distinct from expected or jsonb_array_length(pending->'segments')<>journeys
  then raise exception 'Per-leg pending snapshot aggregate incorrect'; end if;
 end loop;
end $$;
rollback;
