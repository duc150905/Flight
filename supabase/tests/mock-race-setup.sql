-- Run after booking-race-setup.sql; dedicated flight/user IDs only.
begin;
update public.flight_fares set cancellation_allowed=true,cancellation_fee_amount=200000 where flight_id='00000000-0000-4000-8000-000000000610';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000061',true);
do $$declare req jsonb;q jsonb;r jsonb;begin
 req:='{"tripType":"one_way","counts":{"adults":1,"children":0,"infants":0},"segments":[{"flightId":"00000000-0000-4000-8000-000000000610","fareId":"00000000-0000-4000-8000-000000000611","journeyIndex":1,"legIndex":1}],"passengers":[{"id":"adult-1","dateOfBirth":"1990-01-01"}],"baggage":[],"seats":[]}';
 q:=public.quote_checkout(req);
 req:=jsonb_build_object('checkout',req,'expectedQuote',q,'contact','{"contactName":"Race Test","contactEmail":"race@example.invalid","contactPhone":"0901234567"}'::jsonb,
 'travellers','[{"id":"adult-1","values":{"givenNames":"Race","familyName":"Test","dateOfBirth":"1990-01-01"}}]'::jsonb);
 r:=public.create_booking(gen_random_uuid(),req);perform public.start_mock_payment((r->>'id')::uuid,gen_random_uuid());
end $$;
commit;
