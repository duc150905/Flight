begin;
-- Refuse to delete anything outside the dedicated test identities/flight.
do $$ begin
 if exists(select 1 from public.bookings b join public.booking_segments s on s.booking_id=b.id
 where b.user_id in ('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000062') and s.flight_id<>'00000000-0000-4000-8000-000000000610')
 then raise exception 'Unexpected test ownership; inspect before cleanup'; end if;
end $$;
delete from public.booking_addons where booking_id in (select id from public.bookings where user_id in ('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000062'));
delete from public.seat_reservations where booking_id in (select id from public.bookings where user_id in ('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000062'));
delete from public.booking_passenger_segments where booking_id in (select id from public.bookings where user_id in ('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000062'));
delete from public.booking_segments where booking_id in (select id from public.bookings where user_id in ('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000062'));
delete from public.booking_passengers where booking_id in (select id from public.bookings where user_id in ('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000062'));
delete from public.booking_events where booking_id in (select id from public.bookings where user_id in ('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000062'));
delete from public.bookings where user_id in ('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000062');
delete from public.flight_seats where flight_id='00000000-0000-4000-8000-000000000610';
delete from public.flight_fares where flight_id='00000000-0000-4000-8000-000000000610';
delete from public.flight_instances where id='00000000-0000-4000-8000-000000000610' and flight_number='QA_HOLD_RACE_2050';
delete from auth.users where id in ('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000062') and email in ('race-a@example.invalid','race-b@example.invalid');
commit;
