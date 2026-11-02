-- Rollback-only SQL test suite for TV3 Admin RPCs and Audit Logs
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function pg_temp.fixture_id(n integer) returns uuid language sql immutable
as $$ select md5('flight-admin-rpc-test-20261102:' || n::text)::uuid $$;

create function pg_temp.assert_true(passed boolean, message text) returns void language plpgsql
as $$ begin
  if passed is distinct from true then raise exception 'Assertion failed: %', message; end if;
end $$;

create function pg_temp.expect_error(command text, expected_state text) returns void language plpgsql
as $$ declare actual_state text; begin
  begin execute command;
  exception when others then
    get stacked diagnostics actual_state = returned_sqlstate;
    if actual_state = expected_state then return; end if;
    raise exception 'Expected SQLSTATE %, got %: %', expected_state, actual_state, sqlerrm;
  end;
  raise exception 'Expected SQLSTATE %, command succeeded: %', expected_state, command;
end $$;

-- Verify no public SECURITY DEFINER function is executable by clients
do $sec$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ) then
    raise exception 'An exposed SECURITY DEFINER function is executable by clients';
  end if;
end $sec$;

-- Setup test users (1 = customer, 2 = admin) and base airports/airline
insert into auth.users (id, email, raw_user_meta_data) values
  (pg_temp.fixture_id(1), 'customer-rpc@example.invalid', '{"full_name":"Customer User"}'),
  (pg_temp.fixture_id(2), 'admin-rpc@example.invalid', '{"full_name":"Admin User"}');

insert into private.user_roles (user_id, role)
values (pg_temp.fixture_id(2), 'admin');

insert into public.airports (id, iata_code, name, city, country_code, timezone, is_active) values
  (pg_temp.fixture_id(10), 'QRA', 'Test Origin Airport', 'Origin City', 'VN', 'Asia/Ho_Chi_Minh', true),
  (pg_temp.fixture_id(11), 'QRB', 'Test Arrival Airport', 'Arrival City', 'VN', 'Asia/Ho_Chi_Minh', true);

insert into public.airlines (id, iata_code, name, is_active) values
  (pg_temp.fixture_id(20), 'R1', 'RPC Airline One', true),
  (pg_temp.fixture_id(21), 'R2', 'RPC Airline Two', true);

-- 1. Non-admin customer must be rejected with 42501 on all admin RPCs
select set_config('request.jwt.claim.sub', pg_temp.fixture_id(1)::text, true);
set local role authenticated;

select pg_temp.assert_true(not public.is_admin(), 'customer is not admin');
select pg_temp.expect_error(
  $q$select * from public.admin_upsert_aircraft(null, pg_temp.fixture_id(20), 'VN-RPC1', 'A320', true)$q$,
  '42501'
);
select pg_temp.expect_error(
  $q$select * from public.admin_list_audit_logs()$q$,
  '42501'
);

reset role;

-- 2. Switch to authenticated Admin role
select set_config('request.jwt.claim.sub', pg_temp.fixture_id(2)::text, true);
set local role authenticated;

select pg_temp.assert_true(public.is_admin(), 'admin user has admin privileges');

-- Create aircraft via RPC
do $admin_flow$
declare
  v_aircraft public.aircraft;
  v_seat_count integer;
  v_flight public.flight_instances;
  v_fare public.flight_fares;
  v_seat_id uuid;
  v_updated_seat public.flight_seats;
begin
  v_aircraft := public.admin_upsert_aircraft(
    null,
    pg_temp.fixture_id(20),
    'vn-rpc1',
    'Airbus A321 Test',
    true
  );

  perform pg_temp.assert_true(v_aircraft.registration_code = 'VN-RPC1', 'registration code normalized to uppercase');

  v_seat_count := public.admin_upsert_aircraft_seats(
    v_aircraft.id,
    '[
      {"seat_code":"1A","row_number":1,"column_number":1,"cabin_class":"business","position":"window","is_exit_row":false,"is_active":true},
      {"seat_code":"2A","row_number":2,"column_number":1,"cabin_class":"economy","position":"window","is_exit_row":false,"is_active":true},
      {"seat_code":"2B","row_number":2,"column_number":2,"cabin_class":"economy","position":"aisle","is_exit_row":true,"is_active":true}
    ]'::jsonb
  );

  perform pg_temp.assert_true(v_seat_count = 3, 'upserted 3 template seats');

  -- Create and publish a flight instance -> auto-provisions flight_seats
  v_flight := public.admin_save_flight_instance(
    null,
    pg_temp.fixture_id(20),
    v_aircraft.id,
    'r1100',
    pg_temp.fixture_id(10),
    pg_temp.fixture_id(11),
    now() + interval '5 days',
    now() + interval '5 days 2 hours',
    null,
    'scheduled',
    true
  );

  perform pg_temp.assert_true(
    v_flight.flight_number = 'R1100' and v_flight.published_at is not null,
    'flight published and flight_number normalized'
  );

  perform pg_temp.assert_true(
    (select count(*) = 3 from public.flight_seats where flight_id = v_flight.id),
    'flight_seats automatically provisioned from aircraft template'
  );

  -- Overlapping flight on the same aircraft must fail with 23P01
  perform pg_temp.expect_error(
    format(
      $f$select * from public.admin_save_flight_instance(
        null, %L::uuid, %L::uuid, 'R1102', %L::uuid, %L::uuid,
        now() + interval '5 days 1 hour', now() + interval '5 days 3 hours', null, 'scheduled', true
      )$f$,
      pg_temp.fixture_id(20), v_aircraft.id, pg_temp.fixture_id(10), pg_temp.fixture_id(11)
    ),
    '23P01'
  );

  -- Changing seat template after flight is published must fail with 23514
  perform pg_temp.expect_error(
    format(
      $f$select public.admin_upsert_aircraft_seats(
        %L::uuid,
        '[{"seat_code":"1A","row_number":1,"column_number":1,"cabin_class":"economy","position":"window"}]'::jsonb
      )$f$,
      v_aircraft.id
    ),
    '23514'
  );

  -- Create fare via RPC
  v_fare := public.admin_save_flight_fare(
    null,
    v_flight.id,
    'eco_std',
    'economy',
    'Economy Standard',
    1000000,
    750000,
    100000,
    150000,
    100000,
    0,
    50000,
    50000,
    0,
    '{"cabin_pieces":1,"cabin_kg":7,"checked_pieces":1,"checked_kg":20}'::jsonb,
    true,
    120,
    200000,
    true
  );

  perform pg_temp.assert_true(v_fare.fare_code = 'ECO_STD', 'fare created with normalized code');

  -- Block a flight seat and update its selection fee
  select id into v_seat_id
  from public.flight_seats
  where flight_id = v_flight.id and seat_code = '2A';

  v_updated_seat := public.admin_update_flight_seat(v_seat_id, true, 75000);
  perform pg_temp.assert_true(
    v_updated_seat.is_blocked = true and v_updated_seat.selection_fee_amount = 75000,
    'flight seat blocked and fee updated'
  );

  -- Close sales without hard deleting
  v_flight := public.admin_set_flight_sales(v_flight.id, false, null);
  perform pg_temp.assert_true(
    v_flight.sales_close_at <= clock_timestamp(),
    'flight sales closed immediately'
  );

  -- Audit logs must record all admin mutations
  perform pg_temp.assert_true(
    (select count(*) >= 6 from public.admin_list_audit_logs(null, null, 50, 0) where actor_user_id = pg_temp.fixture_id(2)),
    'audit logs recorded for admin RPC actions'
  );
end $admin_flow$;

reset role;
rollback;
select 'TV3 admin RPC and audit log assertions passed; all fixtures rolled back' as result;

