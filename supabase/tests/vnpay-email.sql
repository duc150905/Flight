do $$declare b uuid;r jsonb;c jsonb;begin
 b:=pg_temp.mock_booking();
 if exists(select 1 from private.booking_confirmation_mail where booking_id=b) then raise exception 'Emailed pending order';end if;
 r:=public.start_mock_payment(b,gen_random_uuid());
 perform public.resolve_mock_payment((r->'payments'->0->>'id')::uuid,gen_random_uuid(),'succeeded');
 if (select count(*) from private.booking_confirmation_mail where booking_id=b)<>1 then raise exception 'No unique mail';end if;
 if has_function_privilege('authenticated','public.claim_booking_mail(text)','execute') then raise exception 'Mail exposed';end if;
end $$;

-- Real create/confirm path, two flights, two adults and one lap infant.
-- This suite must run inside a rollback transaction: no test email is sent.
do $$
declare outbound record; inbound record; third_leg record; checkout jsonb; request jsonb; quote jsonb;
 receipt jsonb; payment jsonb; bid uuid; mail jsonb; expected text; actual text; s record;
 selected_seat record; seat_index integer;
 outbound_bag uuid; inbound_bag uuid;
begin
 select f.id,fa.id as fare,f.arrival_at into outbound
 from public.flight_instances f join public.flight_fares fa on fa.flight_id=f.id
 join public.airports dep on dep.id=f.departure_airport_id
 join public.airports arr on arr.id=f.arrival_airport_id
 where dep.iata_code='HAN' and arr.iata_code='DAD' and f.departure_at>now()+interval '1 day'
 and f.status='scheduled' and f.published_at is not null and fa.fare_code='ECO_FLEX' and fa.is_active
 order by f.departure_at,f.id limit 1;
 select f.id,fa.id as fare,f.arrival_at into inbound
 from public.flight_instances f join public.flight_fares fa on fa.flight_id=f.id
 join public.airports dep on dep.id=f.departure_airport_id
 join public.airports arr on arr.id=f.arrival_airport_id
 where dep.iata_code='DAD' and arr.iata_code='HAN' and f.departure_at>outbound.arrival_at+interval '1 day'
 and f.status='scheduled' and f.published_at is not null and fa.fare_code='ECO_FLEX' and fa.is_active
 order by f.departure_at,f.id limit 1;
 if outbound.id is null or inbound.id is null then raise exception 'Missing round-trip fixture';end if;
 checkout:=jsonb_build_object('tripType','round_trip','counts','{"adults":2,"children":0,"infants":1}'::jsonb,
 'segments',jsonb_build_array(
  jsonb_build_object('flightId',outbound.id,'fareId',outbound.fare,'journeyIndex',1,'legIndex',1),
  jsonb_build_object('flightId',inbound.id,'fareId',inbound.fare,'journeyIndex',2,'legIndex',1)),
 'passengers','[{"id":"adult-1","dateOfBirth":"1990-01-01"},{"id":"adult-2","dateOfBirth":"1992-01-01"},{"id":"infant-1","dateOfBirth":"2026-01-01","accompanyingPassengerId":"adult-1"}]'::jsonb,
 'baggage','[]'::jsonb,'seats','[]'::jsonb);
 -- Different ends of the aircraft prevent identical seat codes from masking
 -- an accidental swap between outbound and return associations.
 for s in select 1 as journey,outbound.id as flight union all select 2,inbound.id loop
  seat_index:=0;
  for selected_seat in select fs.id from public.flight_seats fs
   where fs.flight_id=s.flight and fs.cabin_class='economy' and not fs.is_blocked and not fs.is_exit_row
   and not exists(select 1 from public.seat_reservations r where r.flight_seat_id=fs.id and r.status in ('held','confirmed'))
   order by case when s.journey=1 then fs.row_number else -fs.row_number end,fs.column_number
   limit 2 loop
    seat_index:=seat_index+1;
    checkout:=jsonb_set(checkout,'{seats}',(checkout->'seats')||jsonb_build_array(
     jsonb_build_object('passengerId','adult-'||seat_index,'flightId',s.flight,'seatId',selected_seat.id)));
  end loop;
  if seat_index<>2 then raise exception 'Not enough distinct fixture seats';end if;
 end loop;
 select o.id into strict outbound_bag from public.flight_addon_offers o
 join public.addon_products p on p.id=o.product_id and p.category='baggage' and p.is_active
 where o.flight_id=outbound.id and o.is_active order by o.unit_amount,o.id limit 1;
 select o.id into strict inbound_bag from public.flight_addon_offers o
 join public.addon_products p on p.id=o.product_id and p.category='baggage' and p.is_active
 where o.flight_id=inbound.id and o.is_active order by o.unit_amount,o.id limit 1;
 checkout:=jsonb_set(checkout,'{baggage}',jsonb_build_array(
  jsonb_build_object('passengerId','adult-1','flightId',outbound.id,'offerId',outbound_bag),
  jsonb_build_object('passengerId','adult-2','flightId',inbound.id,'offerId',inbound_bag)));
 quote:=public.quote_checkout(checkout);
 request:=jsonb_build_object('checkout',checkout,'expectedQuote',quote,
 'contact','{"contactName":"Email Fixture","contactEmail":"email-fixture@example.invalid","contactPhone":"0901234567"}'::jsonb,
 'travellers','[{"id":"adult-1","values":{"givenNames":"Email One","familyName":"Fixture","dateOfBirth":"1990-01-01"}},{"id":"adult-2","values":{"givenNames":"Email Two","familyName":"Fixture","dateOfBirth":"1992-01-01"}},{"id":"infant-1","accompanyingPassengerId":"adult-1","values":{"givenNames":"Email Infant","familyName":"Fixture","dateOfBirth":"2026-01-01"}}]'::jsonb);
 receipt:=public.create_booking(gen_random_uuid(),request);bid:=(receipt->>'id')::uuid;
 payment:=public.start_mock_payment(bid,gen_random_uuid());
 perform public.resolve_mock_payment((payment->'payments'->0->>'id')::uuid,gen_random_uuid(),'succeeded');
 select snapshot into strict mail from private.booking_confirmation_mail where booking_id=bid;
 if mail->>'version'<>'2' or mail->>'tripType'<>'round_trip' or jsonb_array_length(mail->'segments')<>2
 or mail#>>'{segments,0,flight,departure_iata}'<>'HAN'
 or mail#>>'{segments,1,flight,departure_iata}'<>'DAD'
 then raise exception 'Wrong version or flight association';end if;
 if mail#>>'{segments,0,passengers,0,seat}'=mail#>>'{segments,1,passengers,0,seat}'
 then raise exception 'Fixture must use different outbound and return seats';end if;
 if jsonb_array_length(mail#>'{segments,0,passengers,0,addons}')<>1
 or jsonb_array_length(mail#>'{segments,0,passengers,1,addons}')<>0
 or jsonb_array_length(mail#>'{segments,1,passengers,0,addons}')<>0
 or jsonb_array_length(mail#>'{segments,1,passengers,1,addons}')<>1
 then raise exception 'Baggage assigned to wrong passenger or direction';end if;
 for s in select * from public.booking_segments where booking_id=bid order by journey_number loop
  if jsonb_array_length(mail->'segments'->(s.journey_number-1)->'passengers')<>3 then raise exception 'Missing travellers';end if;
  for i in 0..1 loop
   select fs.seat_code into strict expected from public.seat_reservations r
   join public.flight_seats fs on fs.id=r.flight_seat_id
   join public.booking_passenger_segments ps on ps.id=r.passenger_segment_id
   join public.booking_passengers p on p.id=ps.passenger_id
   where r.booking_id=bid and ps.segment_id=s.id and p.ordinal=i+1 and r.status='confirmed';
   actual:=mail->'segments'->(s.journey_number-1)->'passengers'->i->>'seat';
   if actual is distinct from expected then raise exception 'Seat assigned to wrong passenger or direction';end if;
  end loop;
  if mail->'segments'->(s.journey_number-1)->'passengers'->2->>'requiresSeat'<>'false'
  or mail->'segments'->(s.journey_number-1)->'passengers'->2->>'seat' is not null
  then raise exception 'Infant given a seat';end if;
 end loop;
 update public.booking_passengers set given_names='Changed after confirmation' where booking_id=bid;
 if (select snapshot from private.booking_confirmation_mail where booking_id=bid) is distinct from mail
 then raise exception 'Email snapshot changed after confirmation';end if;

 -- A third journey exercises multi-city ordering through the actual DB trigger.
 select f.id,fa.id as fare into third_leg
 from public.flight_instances f join public.flight_fares fa on fa.flight_id=f.id
 join public.airports dep on dep.id=f.departure_airport_id
 join public.airports arr on arr.id=f.arrival_airport_id
 where dep.iata_code='HAN' and arr.iata_code='DAD' and f.departure_at>inbound.arrival_at+interval '1 day'
 and f.status='scheduled' and f.published_at is not null and fa.fare_code='ECO_FLEX' and fa.is_active
 order by f.departure_at,f.id limit 1;
 if third_leg.id is null then raise exception 'Missing multi-city fixture';end if;
 checkout:=checkout||jsonb_build_object('tripType','multi_city','seats','[]'::jsonb,
 'segments',(checkout->'segments')||jsonb_build_array(jsonb_build_object(
 'flightId',third_leg.id,'fareId',third_leg.fare,'journeyIndex',3,'legIndex',1)));
 quote:=public.quote_checkout(checkout);
 request:=request||jsonb_build_object('checkout',checkout,'expectedQuote',quote);
 receipt:=public.create_booking(gen_random_uuid(),request);bid:=(receipt->>'id')::uuid;
 payment:=public.start_mock_payment(bid,gen_random_uuid());
 perform public.resolve_mock_payment((payment->'payments'->0->>'id')::uuid,gen_random_uuid(),'succeeded');
 select snapshot into strict mail from private.booking_confirmation_mail where booking_id=bid;
 if mail->>'tripType'<>'multi_city' or jsonb_array_length(mail->'segments')<>3
 or mail#>>'{segments,0,journeyNumber}'<>'1' or mail#>>'{segments,1,journeyNumber}'<>'2'
 or mail#>>'{segments,2,journeyNumber}'<>'3' or mail#>>'{segments,2,flight,departure_iata}'<>'HAN'
 then raise exception 'Multi-city snapshot ordering failed';end if;
 for s in select bs.journey_number,p.ordinal,fs.seat_code from public.booking_segments bs
 join public.booking_passenger_segments ps on ps.segment_id=bs.id
 join public.booking_passengers p on p.id=ps.passenger_id
 join public.seat_reservations r on r.passenger_segment_id=ps.id and r.status='confirmed'
 join public.flight_seats fs on fs.id=r.flight_seat_id where bs.booking_id=bid loop
  if (mail->'segments'->(s.journey_number-1)->'passengers'->(s.ordinal-1)->>'seat') is distinct from s.seat_code
  then raise exception 'Multi-city seat association failed';end if;
 end loop;
end $$;
