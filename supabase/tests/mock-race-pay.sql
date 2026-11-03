begin;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000061',true);
set local role authenticated;
do $$declare pid uuid;begin
 select p.id into pid from public.payments p join public.booking_segments s on s.booking_id=p.booking_id where s.flight_id='00000000-0000-4000-8000-000000000610';
 perform public.resolve_mock_payment(pid,gen_random_uuid(),'succeeded');
end $$;
commit;
