begin;
-- Financial/action rows reference only the dedicated synthetic 2050 flight.
delete from private.mock_action_requests where booking_id in(select booking_id from public.booking_segments where flight_id='00000000-0000-4000-8000-000000000610');
delete from public.refunds where booking_id in(select booking_id from public.booking_segments where flight_id='00000000-0000-4000-8000-000000000610');
delete from public.payments where booking_id in(select booking_id from public.booking_segments where flight_id='00000000-0000-4000-8000-000000000610');
commit;
-- Then always run booking-race-cleanup.sql to remove remaining fixture rows.
