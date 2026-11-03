-- Include inside BEGIN/ROLLBACK, followed by one mock-*.sql suite.
insert into auth.users(id,email,raw_user_meta_data) values ('00000000-0000-4000-8000-000000000081','mock-test@example.invalid','{"full_name":"Mock Test"}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000081',true);
create function pg_temp.mock_booking(p_flex boolean default true) returns uuid language plpgsql as $$
declare f record; req jsonb; q jsonb; receipt jsonb;
begin
 select fi.id,fa.id fare into f from public.flight_instances fi join public.flight_fares fa on fa.flight_id=fi.id
 where fi.flight_number='F0103' and fi.departure_at>now()+interval '1 hour' and fa.fare_code=case when p_flex then 'DEMO_FLEX' else 'DEMO_STANDARD' end order by fi.departure_at limit 1;
 if f.id is null then raise exception 'Missing mock checkout fixture'; end if;
 req:=jsonb_build_object('tripType','one_way','counts','{"adults":1,"children":0,"infants":0}'::jsonb,
 'segments',jsonb_build_array(jsonb_build_object('flightId',f.id,'fareId',f.fare,'journeyIndex',1,'legIndex',1)),
 'passengers','[{"id":"adult-1","dateOfBirth":"1990-01-01"}]'::jsonb,'baggage','[]'::jsonb,'seats','[]'::jsonb);
 q:=public.quote_checkout(req);
 req:=jsonb_build_object('checkout',req,'expectedQuote',q,'contact','{"contactName":"Mock Test","contactEmail":"mock@example.invalid","contactPhone":"0901234567"}'::jsonb,
 'travellers','[{"id":"adult-1","values":{"givenNames":"Mock","familyName":"Test","dateOfBirth":"1990-01-01"}}]'::jsonb);
 receipt:=public.create_booking(gen_random_uuid(),req);return (receipt->>'id')::uuid;
end $$;
