begin;
insert into auth.users(id,email,raw_user_meta_data) values ('00000000-0000-4000-8000-000000000052','holds-test@example.invalid','{"full_name":"Holds Test"}');
insert into auth.users(id,email,raw_user_meta_data) values ('00000000-0000-4000-8000-000000000099','other-test@example.invalid','{"full_name":"Other Test"}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000052',true);
do $$
declare fl record; payload jsonb; req jsonb; q jsonb; result jsonb; detail jsonb; bid uuid; seat uuid; rid uuid:=gen_random_uuid(); actual text;
begin
 select f.id,fa.id fare into fl from public.flight_instances f join public.flight_fares fa on fa.flight_id=f.id
 where f.flight_number='F0103' and f.departure_at>now()+interval '1 hour' and fa.fare_code='DEMO_STANDARD' order by f.departure_at limit 1;
 select id into seat from public.flight_seats where flight_id=fl.id and not is_blocked and not is_exit_row order by row_number,column_number limit 1;
 payload:=jsonb_build_object('tripType','one_way','counts','{"adults":2,"children":1,"infants":1}'::jsonb,
 'segments',jsonb_build_array(jsonb_build_object('flightId',fl.id,'fareId',fl.fare,'journeyIndex',1,'legIndex',1)),
 'passengers',jsonb_build_array('{"id":"adult-1","dateOfBirth":"1990-01-01"}'::jsonb,'{"id":"adult-2","dateOfBirth":"1992-01-01"}'::jsonb,
 jsonb_build_object('id','child-1','dateOfBirth',(current_date-interval '8 years')::date),jsonb_build_object('id','infant-1','dateOfBirth',(current_date-interval '6 months')::date,'accompanyingPassengerId','adult-1')),
 'baggage','[]'::jsonb,'seats',jsonb_build_array(jsonb_build_object('passengerId','adult-2','flightId',fl.id,'seatId',seat)));
 q:=public.quote_checkout(payload);
 req:=jsonb_build_object('checkout',payload,'expectedQuote',q,'contact','{"contactName":"Test Person","contactEmail":"test@example.invalid","contactPhone":"+84901234567"}'::jsonb,
 'travellers',(select jsonb_agg(jsonb_build_object('id',p->>'id','values',jsonb_build_object('givenNames','Test','familyName','Person','dateOfBirth',p->>'dateOfBirth'))) from jsonb_array_elements(payload->'passengers') p));
 result:=public.create_booking(rid,req); bid:=(result->>'id')::uuid;
 if (select count(*) from public.seat_reservations where booking_id=bid and status='held')<>3 then raise exception 'Infant occupied a seat or adult missing'; end if;
 if (select count(distinct flight_seat_id) from public.seat_reservations where booking_id=bid)<>3 then raise exception 'Duplicate assignment'; end if;
 if (select count(*) from public.seat_reservations r join public.booking_passenger_segments ps on ps.id=r.passenger_segment_id join public.booking_passengers p on p.id=ps.passenger_id
 where r.booking_id=bid and p.ordinal<>2 and r.selection_amount<>0)<>0 then raise exception 'Automatic seats charged'; end if;
 if not exists(select 1 from public.seat_reservations r join public.booking_passenger_segments ps on ps.id=r.passenger_segment_id join public.booking_passengers p on p.id=ps.passenger_id
 where r.booking_id=bid and p.ordinal=2 and r.flight_seat_id=seat) then raise exception 'Selected seat stolen by automatic allocation'; end if;
 if exists(select 1 from public.seat_reservations r join public.flight_seats fs on fs.id=r.flight_seat_id join public.booking_passenger_segments ps on ps.id=r.passenger_segment_id
 where r.booking_id=bid and fs.is_exit_row and (ps.passenger_type='child' or exists(select 1 from public.booking_passenger_segments infant where infant.segment_id=ps.segment_id and infant.accompanying_passenger_id=ps.passenger_id))) then raise exception 'Ineligible exit allocation'; end if;
 detail:=public.get_pending_booking(bid);
 if jsonb_array_length(detail->'passengers')<>4 or jsonb_array_length(detail->'seats')<>3 then raise exception 'Saved details incomplete'; end if;
 if (public.find_booking_request(rid)->>'id')::uuid<>bid then raise exception 'Request recovery failed'; end if;
 -- A missing recovery request is closed, so a late create cannot duplicate it.
 rid:=gen_random_uuid();
 if public.find_booking_request(rid) is not null then raise exception 'Missing request unexpectedly found'; end if;
 begin perform public.create_booking(rid,jsonb_set(req,'{checkout,seats}','[]')); exception when others then actual:=sqlerrm; end;
 -- Quote mismatch may be detected before closure; either way no second booking.
 if actual not in ('booking.requestClosed','booking.priceChanged','quote.seatUnavailable') then raise exception 'Late request was not rejected: %',actual; end if;
 actual:=null;
 select create_request_id into rid from public.bookings where id=bid;
 -- Expire both booking and holds; only synthetic booking rows touched.
 update public.bookings set expires_at=now()-interval '1 second' where id=bid;
 update public.seat_reservations set expires_at=now()-interval '1 second' where booking_id=bid;
 detail:=public.get_pending_booking(bid);
 if detail->>'status'<>'expired' or exists(select 1 from public.seat_reservations where booking_id=bid and status='held') then raise exception 'Expiry failed'; end if;
 if (select count(*) from public.booking_events where booking_id=bid and event_type='expired')<>1 then raise exception 'Missing expiry event'; end if;
 perform public.get_pending_booking(bid);
 if (select count(*) from public.booking_events where booking_id=bid and event_type='expired')<>1 then raise exception 'Expiry duplicated'; end if;
 -- The same request never creates a new booking, including after expiry.
 if public.create_booking(rid,req)->>'id'<>bid::text then raise exception 'Expired retry duplicated'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
 if public.find_booking_request(rid) is not null then raise exception 'Cross-owner request leak'; end if;
 begin perform public.get_pending_booking(bid); exception when others then actual:=sqlerrm; end;
 if actual is distinct from 'booking.notFound' then raise exception 'Cross-owner read allowed'; end if;
 if has_function_privilege('anon','public.get_pending_booking(uuid)','execute') or has_function_privilege('authenticated','private.allocate_booking_seats(uuid,jsonb)','execute')
 or has_table_privilege('authenticated','public.bookings','insert') or has_table_privilege('authenticated','public.seat_reservations','insert') then raise exception 'Unsafe privileges'; end if;
end $$;
rollback;
