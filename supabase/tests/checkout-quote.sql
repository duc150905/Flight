-- Run inside BEGIN/ROLLBACK. Only synthetic changes are retained in this transaction.
create function pg_temp.expect_quote(req jsonb, expected text default null) returns jsonb language plpgsql as $$
declare result jsonb; actual text;
begin
  begin result := public.quote_checkout(req); exception when others then actual:=sqlerrm; end;
  if actual is distinct from expected then raise exception 'Quote test: expected %, got %', expected,actual; end if;
  return result;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
declare f uuid; fare uuid; offer uuid; seat uuid; req jsonb; result jsonb; price bigint; users_before bigint; bookings_before bigint;
begin
  select fl.id,fa.id into f,fare from public.flight_instances fl join public.flight_fares fa on fa.flight_id=fl.id
    where fl.flight_number='F0103' and fl.departure_at>now() and fa.fare_code='DEMO_STANDARD' order by fl.departure_at limit 1;
  if f is null then raise exception 'Seed future F0103 checkout demo first'; end if;
  req:=jsonb_build_object('tripType','one_way','counts',jsonb_build_object('adults',1,'children',0,'infants',0),
    'segments',jsonb_build_array(jsonb_build_object('flightId',f,'fareId',fare,'journeyIndex',1,'legIndex',1)),
    'passengers','[{"id":"adult-1","dateOfBirth":"1990-01-01"}]'::jsonb,'baggage','[]'::jsonb,'seats','[]'::jsonb);
  select count(*) into bookings_before from public.bookings;
  select count(*) into users_before from auth.users;
  result:=pg_temp.expect_quote(req);
  if (result->>'total')::bigint<>1250000 or result->>'currency'<>'VND' then raise exception 'Wrong basic quote'; end if;
  perform pg_temp.expect_quote(req||'{"total":1,"base":1}'::jsonb);
  perform pg_temp.expect_quote(req||'{"passengers":[]}'::jsonb,'quote.invalid');
  perform pg_temp.expect_quote(req||'{"tripType":"round_trip"}'::jsonb,'quote.invalid');
  perform pg_temp.expect_quote(jsonb_set(req,'{segments,0,flightId}',to_jsonb(upper(f::text))),'quote.invalid');
  perform pg_temp.expect_quote(jsonb_set(req,'{passengers,0,dateOfBirth}','"2099-01-01"'),'quote.invalid');
  select id,unit_amount into offer,price from public.flight_addon_offers where flight_id=f and is_active order by unit_amount limit 1;
  req:=jsonb_set(req,'{baggage}',jsonb_build_array(jsonb_build_object('passengerId','adult-1','flightId',f,'offerId',offer)));
  result:=pg_temp.expect_quote(req);if (result->>'total')::bigint<>1250000+price then raise exception 'Wrong baggage total'; end if;
  update public.flight_addon_offers set is_active=false where id=offer;
  perform pg_temp.expect_quote(req,'quote.offerUnavailable');update public.flight_addon_offers set is_active=true where id=offer;
  select id into seat from public.flight_seats where flight_id=f and seat_code='2A';
  req:=jsonb_set(req,'{seats}',jsonb_build_array(jsonb_build_object('passengerId','adult-1','flightId',f,'seatId',seat)));
  result:=pg_temp.expect_quote(req);if (result->>'seat')::bigint<>50000 then raise exception 'Wrong seat total'; end if;
  update public.flight_seats set is_blocked=true where id=seat;
  perform pg_temp.expect_quote(req,'quote.seatUnavailable');update public.flight_seats set is_blocked=false where id=seat;
  perform pg_temp.expect_quote(jsonb_set(req,'{seats}',(req->'seats')||(req->'seats')),'quote.invalid');
  update public.flight_seats set is_blocked=true where flight_id=f;
  perform pg_temp.expect_quote(jsonb_set(req,'{seats}','[]'),'quote.soldOut');
  update public.flight_seats set is_blocked=false where flight_id=f and seat_code<>'4F';
  update public.flight_instances set sales_close_at=now()-interval '1 minute' where id=f;
  perform pg_temp.expect_quote(req,'quote.unavailable');
  if (select count(*) from public.bookings)<>bookings_before or (select count(*) from auth.users)<>users_before then raise exception 'Quote wrote transactional data'; end if;
end $$;
do $$
declare outbound record; inbound record; req jsonb; result jsonb; birthday date;
begin
 select fl.*,fa.id as fare_id into outbound from public.flight_instances fl join public.flight_fares fa on fa.flight_id=fl.id
   where fl.flight_number='F0101' and fl.departure_at>now() and fa.fare_code='DEMO_STANDARD' order by fl.departure_at limit 1;
 select fl.*,fa.id as fare_id into inbound from public.flight_instances fl join public.flight_fares fa on fa.flight_id=fl.id
   where fl.flight_number='F0102' and fl.departure_at>outbound.departure_at and fa.fare_code='DEMO_STANDARD' order by fl.departure_at limit 1;
 birthday:=((outbound.departure_at at time zone 'Asia/Ho_Chi_Minh')::date+2)-interval '12 years';
 req:=jsonb_build_object('tripType','round_trip','counts','{"adults":1,"children":1,"infants":0}'::jsonb,
   'segments',jsonb_build_array(jsonb_build_object('flightId',outbound.id,'fareId',outbound.fare_id,'journeyIndex',1,'legIndex',1),jsonb_build_object('flightId',inbound.id,'fareId',inbound.fare_id,'journeyIndex',2,'legIndex',1)),
   'passengers',jsonb_build_array('{"id":"adult-1","dateOfBirth":"1990-01-01"}'::jsonb,jsonb_build_object('id','child-1','dateOfBirth',birthday)), 'baggage','[]'::jsonb,'seats','[]'::jsonb);
 result:=pg_temp.expect_quote(req);
 if result->'lines'->1->>'passengerType'<>'child' or result->'lines'->3->>'passengerType'<>'adult' then raise exception 'Per-leg child birthday failed'; end if;
 birthday:=birthday+interval '10 years';
 req:=jsonb_set(req,'{counts}','{"adults":1,"children":0,"infants":1}');
 req:=jsonb_set(req,'{passengers,1}',jsonb_build_object('id','infant-1','dateOfBirth',birthday,'accompanyingPassengerId','adult-1'));
 result:=pg_temp.expect_quote(req);
 if (result->'lines'->1->>'requiresSeat')::boolean or not (result->'lines'->3->>'requiresSeat')::boolean then raise exception 'Per-leg infant seat requirement failed'; end if;
 perform pg_temp.expect_quote(jsonb_set(req,'{passengers,1,accompanyingPassengerId}','"missing"'),'quote.invalid');
 update public.flight_seats set is_blocked=true where flight_id=inbound.id and seat_code<>'2A';
 perform pg_temp.expect_quote(req,'quote.soldOut');
end $$;
do $$
declare f uuid; fare uuid; seat uuid; req jsonb; user_id uuid; booking uuid; segment uuid; passenger uuid; ps uuid; reservation uuid;
begin
 select fl.id,fa.id into f,fare from public.flight_instances fl join public.flight_fares fa on fa.flight_id=fl.id
   where fl.flight_number='F0101' and fl.departure_at>now() and fa.fare_code='DEMO_STANDARD' order by fl.departure_at limit 1;
 select id into seat from public.flight_seats where flight_id=f and seat_code='2A';
 req:=jsonb_build_object('tripType','one_way','counts','{"adults":1,"children":0,"infants":0}'::jsonb,'segments',jsonb_build_array(jsonb_build_object('flightId',f,'fareId',fare,'journeyIndex',1,'legIndex',1)),
   'passengers','[{"id":"adult-1","dateOfBirth":"1990-01-01"}]'::jsonb,'baggage','[]'::jsonb,'seats',jsonb_build_array(jsonb_build_object('passengerId','adult-1','flightId',f,'seatId',seat)));
 update public.flight_seats set is_exit_row=true where id=seat;
 perform pg_temp.expect_quote(jsonb_set(req,'{passengers,0,dateOfBirth}',to_jsonb(((now() at time zone 'UTC')::date-interval '17 years')::date::text)),'quote.seatIneligible');
 update public.flight_seats set is_exit_row=false where id=seat;
 select id into user_id from auth.users limit 1;
 if user_id is null then raise exception 'Need one existing user for rollback reservation FK test'; end if;
 insert into public.bookings(user_id,booking_code,create_request_id,create_request_hash,trip_type,contact_name,contact_email,contact_phone,base_amount,tax_amount,fee_amount,seat_amount,addon_amount,total_amount,refund_policy_snapshot,expires_at)
 values(user_id,'QTEST'||replace(gen_random_uuid()::text,'-','')::varchar(20),gen_random_uuid(),'test','one_way','Demo','demo@example.invalid','0900000000',1000000,180000,70000,0,0,1250000,'{}',now()+interval '10 minutes') returning id into booking;
 insert into public.booking_segments(booking_id,flight_id,fare_id,journey_number,leg_number,flight_snapshot,fare_code_snapshot,cabin_class)
 values(booking,f,fare,1,1,'{}','DEMO_STANDARD','economy') returning id into segment;
 insert into public.booking_passengers(booking_id,ordinal,given_names,family_name,date_of_birth) values(booking,1,'Demo','Test','1990-01-01') returning id into passenger;
 insert into public.booking_passenger_segments(booking_id,segment_id,passenger_id,flight_id,passenger_type,requires_seat,base_amount,tax_amount,fee_amount,allowance_snapshot,cancellation_rules_snapshot)
 values(booking,segment,passenger,f,'adult',true,1000000,180000,70000,'{}','{}') returning id into ps;
 insert into public.seat_reservations(booking_id,passenger_segment_id,flight_id,flight_seat_id,expires_at) values(booking,ps,f,seat,now()+interval '10 minutes') returning id into reservation;
 perform pg_temp.expect_quote(req,'quote.seatUnavailable');
 update public.seat_reservations set status='confirmed',confirmed_at=now() where id=reservation;
 perform pg_temp.expect_quote(req,'quote.seatUnavailable');
 update public.seat_reservations set status='held',expires_at=now()-interval '1 minute' where id=reservation;
 perform pg_temp.expect_quote(req);
end $$;
set local role authenticated;
do $$
declare f uuid; fare uuid; result jsonb;
begin
 select fl.id,fa.id into f,fare from public.flight_instances fl join public.flight_fares fa on fa.flight_id=fl.id
 where fl.flight_number='F0101' and fl.departure_at>now() and fa.fare_code='DEMO_STANDARD' order by fl.departure_at limit 1;
 result:=public.quote_checkout(jsonb_build_object('tripType','one_way','counts','{"adults":1,"children":0,"infants":0}'::jsonb,
 'segments',jsonb_build_array(jsonb_build_object('flightId',f,'fareId',fare,'journeyIndex',1,'legIndex',1)),
 'passengers','[{"id":"adult-1","dateOfBirth":"1990-01-01"}]'::jsonb,'baggage','[]'::jsonb,'seats','[]'::jsonb));
 if (result->>'total')::bigint<>1250000 then raise exception 'Authenticated role quote failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.expect_quote('{}','quote.authRequired');
do $$ begin
 if has_function_privilege('anon','public.quote_checkout(jsonb)','EXECUTE') or has_function_privilege('anon','private.quote_checkout(jsonb)','EXECUTE') then raise exception 'Anonymous quote privilege'; end if;
 if not has_function_privilege('authenticated','public.quote_checkout(jsonb)','EXECUTE') then raise exception 'Missing authenticated quote'; end if;
end $$;
