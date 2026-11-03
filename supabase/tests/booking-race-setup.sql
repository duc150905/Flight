-- Dedicated synthetic flight in 2050, no real flight inventory is held.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000061','race-a@example.invalid','{"full_name":"Race A"}'),
 ('00000000-0000-4000-8000-000000000062','race-b@example.invalid','{"full_name":"Race B"}');
insert into public.flight_instances select (jsonb_populate_record(null::public.flight_instances,to_jsonb(f)||jsonb_build_object(
 'id','00000000-0000-4000-8000-000000000610','flight_number','QA_HOLD_RACE_2050','departure_at','2050-01-02T02:00:00Z',
 'arrival_at','2050-01-02T04:00:00Z','sales_close_at','2050-01-02T01:00:00Z','status','scheduled','published_at',now()))).*
 from public.flight_instances f where f.flight_number='F0103' order by departure_at limit 1;
insert into public.flight_fares select (jsonb_populate_record(null::public.flight_fares,to_jsonb(fa)||jsonb_build_object(
 'id','00000000-0000-4000-8000-000000000611','flight_id','00000000-0000-4000-8000-000000000610'))).*
 from public.flight_fares fa join public.flight_instances f on f.id=fa.flight_id where f.flight_number='F0103' and fa.fare_code='DEMO_STANDARD' order by f.departure_at limit 1;
insert into public.flight_seats select (jsonb_populate_record(null::public.flight_seats,to_jsonb(fs)||jsonb_build_object(
 'id','00000000-0000-4000-8000-000000000612','flight_id','00000000-0000-4000-8000-000000000610','is_blocked',false,'is_exit_row',false))).*
 from public.flight_seats fs join public.flight_instances f on f.id=fs.flight_id where f.flight_number='F0103' and fs.cabin_class='economy' order by f.departure_at,fs.row_number,fs.column_number limit 1;
commit;
