begin;
-- Synthetic auth user and all booking changes are rolled back.
insert into auth.users(id,email,raw_user_meta_data) values ('00000000-0000-4000-8000-000000000051','booking-test@example.invalid','{"full_name":"Booking Test"}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000051',true);
create function pg_temp.expect_create(rid uuid, req jsonb, expected text default null) returns jsonb language plpgsql as $$
declare result jsonb; actual text;
begin
 begin result:=public.create_booking(rid,req); exception when others then actual:=sqlerrm; end;
 if actual is distinct from expected then raise exception 'Create expected %, got %',expected,actual; end if;
 return result;
end $$;
do $$
declare fl record; seat uuid; offer uuid; req jsonb; q jsonb; result jsonb; rid uuid:=gen_random_uuid(); count_before int; changed jsonb;
begin
 select f.id,fa.id fare into fl from public.flight_instances f join public.flight_fares fa on fa.flight_id=f.id
 where f.flight_number='F0103' and f.departure_at>now()+interval '1 hour' and fa.fare_code='DEMO_STANDARD' order by f.departure_at limit 1;
 if fl.id is null then raise exception 'Missing demo fixture'; end if;
 select id into seat from public.flight_seats where flight_id=fl.id and not is_blocked and not is_exit_row order by row_number,column_number limit 1;
 select o.id into offer from public.flight_addon_offers o join public.addon_products p on p.id=o.product_id where o.flight_id=fl.id and o.is_active and p.is_active and p.category='baggage' order by o.unit_amount limit 1;
 if offer is null then raise exception 'Missing baggage fixture'; end if;
 req:=jsonb_build_object('tripType','one_way','counts','{"adults":1,"children":0,"infants":0}'::jsonb,
 'segments',jsonb_build_array(jsonb_build_object('flightId',fl.id,'fareId',fl.fare,'journeyIndex',1,'legIndex',1)),
 'passengers','[{"id":"adult-1","dateOfBirth":"1990-01-01"}]'::jsonb,'baggage','[]'::jsonb,
 'seats',jsonb_build_array(jsonb_build_object('passengerId','adult-1','flightId',fl.id,'seatId',seat)));
 req:=jsonb_set(req,'{baggage}',jsonb_build_array(jsonb_build_object('passengerId','adult-1','flightId',fl.id,'offerId',offer)));
 q:=public.quote_checkout(req);
 req:=jsonb_build_object('checkout',req,'expectedQuote',q,'contact','{"contactName":"Test Person","contactEmail":"test@example.invalid","contactPhone":"+84901234567"}'::jsonb,
 'travellers','[{"id":"adult-1","values":{"givenNames":"Test","familyName":"Person","dateOfBirth":"1990-01-01"}}]'::jsonb);
 select count(*) into count_before from public.bookings;
 perform pg_temp.expect_create(gen_random_uuid(),jsonb_set(req,'{travellers,0,values,givenNames}','""'),'booking.invalid');
 if (select count(*) from public.bookings)<>count_before then raise exception 'Partial booking persisted'; end if;
 changed:=jsonb_set(req,'{expectedQuote,total}','1');
 perform pg_temp.expect_create(gen_random_uuid(),changed,'booking.priceChanged');
 update public.flight_fares set adult_base_amount=adult_base_amount+1000 where id=fl.fare;
 perform pg_temp.expect_create(gen_random_uuid(),req,'booking.priceChanged');
 update public.flight_fares set adult_base_amount=adult_base_amount-1000 where id=fl.fare;
 perform pg_temp.expect_create(gen_random_uuid(),req #- '{expectedQuote,expiresAt}','booking.quoteExpired');
 perform pg_temp.expect_create(gen_random_uuid(),jsonb_set(req,'{travellers,0,values,nationalityCode}','"ZZ"'),'booking.invalid');
 -- International documents validated by server, not just by the form.
 update public.airports set country_code='SG' where id=(select arrival_airport_id from public.flight_instances where id=fl.id);
 perform pg_temp.expect_create(gen_random_uuid(),req,'booking.invalid');
 update public.airports set country_code='VN' where id=(select arrival_airport_id from public.flight_instances where id=fl.id);
 result:=pg_temp.expect_create(rid,req);
 if result->>'status'<>'pending_payment' or (result->>'total')::bigint<>(q->>'total')::bigint then raise exception 'Bad booking'; end if;
 if (select count(*) from public.booking_segments where booking_id=(result->>'id')::uuid)<>1
 or (select count(*) from public.booking_passengers where booking_id=(result->>'id')::uuid)<>1
 or (select count(*) from public.booking_addons where booking_id=(result->>'id')::uuid)<>1
 or (select count(*) from public.seat_reservations where booking_id=(result->>'id')::uuid and status='held')<>1 then raise exception 'Incomplete booking'; end if;
 if pg_temp.expect_create(rid,req)->>'id'<>result->>'id' then raise exception 'Retry duplicated booking'; end if;
 update public.flight_fares set adult_base_amount=adult_base_amount+1000 where id=fl.fare;
 if (select total_amount from public.bookings where id=(result->>'id')::uuid)<>(q->>'total')::bigint then raise exception 'Historical price changed'; end if;
 perform pg_temp.expect_create(rid,jsonb_set(req,'{contact,contactName}','"Different Person"'),'booking.requestConflict');
 perform pg_temp.expect_create(gen_random_uuid(),req,'quote.seatUnavailable');
 if (select count(*) from public.bookings)<>count_before+1 then raise exception 'Failed request left data'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 perform pg_temp.expect_create(gen_random_uuid(),req,'booking.authRequired');
 if has_function_privilege('anon','public.create_booking(uuid,jsonb)','execute') then raise exception 'Anonymous create permission'; end if;
end $$;
rollback;
