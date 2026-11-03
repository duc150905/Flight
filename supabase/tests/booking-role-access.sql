begin;
insert into auth.users(id,email,raw_user_meta_data) values ('00000000-0000-4000-8000-000000000053','role-test@example.invalid','{"full_name":"Role Test"}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000053',true);
set local role authenticated;
do $$
declare req jsonb; q jsonb; receipt jsonb; f uuid; fare uuid; rid uuid:=gen_random_uuid();
begin
 select fi.id,fa.id into f,fare from public.flight_instances fi join public.flight_fares fa on fa.flight_id=fi.id
 where fi.flight_number='F0103' and fi.departure_at>now()+interval '1 hour' and fa.fare_code='DEMO_STANDARD' order by fi.departure_at limit 1;
 req:=jsonb_build_object('tripType','one_way','counts','{"adults":1,"children":0,"infants":0}'::jsonb,
 'segments',jsonb_build_array(jsonb_build_object('flightId',f,'fareId',fare,'journeyIndex',1,'legIndex',1)),
 'passengers','[{"id":"adult-1","dateOfBirth":"1990-01-01"}]'::jsonb,'baggage','[]'::jsonb,'seats','[]'::jsonb);
 q:=public.quote_checkout(req);
 req:=jsonb_build_object('checkout',req,'expectedQuote',q,'contact','{"contactName":"Role Test","contactEmail":"role@example.invalid","contactPhone":"0901234567"}'::jsonb,
 'travellers','[{"id":"adult-1","values":{"givenNames":"Role","familyName":"Test","dateOfBirth":"1990-01-01"}}]'::jsonb);
 receipt:=public.create_booking(rid,req);
 if public.get_pending_booking((receipt->>'id')::uuid)->>'id'<>receipt->>'id' then raise exception 'Authenticated read failed'; end if;
 if public.find_booking_request(rid)->>'id'<>receipt->>'id' then raise exception 'Authenticated recovery failed'; end if;
 if (select count(*) from public.bookings where id=(receipt->>'id')::uuid)<>1 then raise exception 'Owner RLS read failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
set local role authenticated;
do $$ begin if exists(select 1 from public.bookings where user_id='00000000-0000-4000-8000-000000000053') then raise exception 'Cross-owner RLS leak'; end if; end $$;
reset role;
set local role anon;
do $$ declare denied boolean:=false; begin
 begin perform public.create_booking(gen_random_uuid(),'{}'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Anonymous RPC allowed'; end if;
end $$;
reset role;
rollback;
