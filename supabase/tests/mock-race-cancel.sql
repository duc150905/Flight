begin;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000061',true);
set local role authenticated;
do $$declare bid uuid;begin
 select booking_id into bid from public.booking_segments where flight_id='00000000-0000-4000-8000-000000000610';
 begin perform public.cancel_booking(bid,gen_random_uuid(),0);exception when others then
 if sqlerrm not in ('mock.priceChanged','mock.ineligible') then raise;end if;end;
end $$;
commit;
