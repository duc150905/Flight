-- Run two copies concurrently, replacing ACTOR_UID and LOCK_FIRST in a temp copy.
begin;
select set_config('request.jwt.claim.sub','ACTOR_UID',true);
create temporary table race_outcome(result text);
do $$
declare req jsonb; q jsonb; actual text;
begin
 if LOCK_FIRST then
  perform 1 from public.flight_instances where id='00000000-0000-4000-8000-000000000610' for update;
  perform pg_sleep(2);
 end if;
 begin
  req:='{"tripType":"one_way","counts":{"adults":1,"children":0,"infants":0},"segments":[{"flightId":"00000000-0000-4000-8000-000000000610","fareId":"00000000-0000-4000-8000-000000000611","journeyIndex":1,"legIndex":1}],"passengers":[{"id":"adult-1","dateOfBirth":"1990-01-01"}],"baggage":[],"seats":[{"passengerId":"adult-1","flightId":"00000000-0000-4000-8000-000000000610","seatId":"00000000-0000-4000-8000-000000000612"}]}';
  q:=public.quote_checkout(req);
  req:=jsonb_build_object('checkout',req,'expectedQuote',q,'contact','{"contactName":"Race Test","contactEmail":"race@example.invalid","contactPhone":"0901234567"}'::jsonb,
   'travellers','[{"id":"adult-1","values":{"givenNames":"Race","familyName":"Test","dateOfBirth":"1990-01-01"}}]'::jsonb);
  perform public.create_booking(gen_random_uuid(),req);
  actual:='created';
 exception when others then
  if sqlerrm not in ('quote.seatUnavailable','quote.soldOut','booking.inventoryChanged') then raise; end if;
  actual:='rejected';
 end;
 insert into race_outcome values(actual);
end $$;
select result from race_outcome;
commit;
