-- Safe on flight-dev: all fixture data and changes are rolled back.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $test$
declare actual integer;
begin
  select count(*) into actual from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind='r' and n.nspname in ('public','private');
  if actual <> 22 then raise exception 'Expected 22 business tables; found %', actual; end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in ('public','private') and not c.relrowsecurity)
  then raise exception 'A business table is missing RLS'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
      and (has_function_privilege('anon',p.oid,'EXECUTE')
        or has_function_privilege('authenticated',p.oid,'EXECUTE')))
  then raise exception 'An exposed SECURITY DEFINER function is executable by clients'; end if;
end $test$;

create function pg_temp.fixture_id(n integer) returns uuid language sql immutable
as $$ select md5('flight-foundation-test-20261029:' || n::text)::uuid $$;
create function pg_temp.assert_true(passed boolean, message text) returns void language plpgsql
as $$ begin
  if passed is distinct from true then raise exception 'Assertion failed: %', message; end if;
end $$;
create function pg_temp.expect_error(command text, expected_state text) returns void language plpgsql
as $$ declare actual_state text; begin
  begin execute command;
  exception when others then
    get stacked diagnostics actual_state=returned_sqlstate;
    if actual_state=expected_state then return; end if;
    raise exception 'Expected SQLSTATE %, got %: %',expected_state,actual_state,sqlerrm;
  end;
  raise exception 'Expected SQLSTATE %, command succeeded: %',expected_state,command;
end $$;

-- Fake auth records exist only inside this rolled-back transaction. No email is sent.
insert into auth.users(id,email,raw_user_meta_data) values
  (pg_temp.fixture_id(1),'flight-rls-a@example.invalid','{"full_name":"Test A","role":"admin"}'),
  (pg_temp.fixture_id(2),'flight-rls-b@example.invalid','{"full_name":7}'),
  (pg_temp.fixture_id(3),'flight-rls-admin@example.invalid','{"full_name":"Test Admin"}');
insert into auth.users(id,email,raw_user_meta_data)
values(pg_temp.fixture_id(4),'flight-rls-name@example.invalid',jsonb_build_object('full_name','A'||repeat(' ',99)||'B'));
insert into private.user_roles(user_id,role) values(pg_temp.fixture_id(3),'admin');
select pg_temp.assert_true((select full_name='Traveler' from public.profiles where id=pg_temp.fixture_id(2)),
  'malformed name metadata must not break signup');
select pg_temp.assert_true((select full_name='Traveler' from public.profiles where id=pg_temp.fixture_id(4)),
  'truncated whitespace name must not break signup');
insert into public.airports(id,iata_code,name,city,country_code,timezone,is_active) values
  (pg_temp.fixture_id(11),'QAA','Test A','Test A','VN','Asia/Ho_Chi_Minh',true),
  (pg_temp.fixture_id(12),'QAB','Test B','Test B','VN','Asia/Ho_Chi_Minh',true),
  (pg_temp.fixture_id(13),'QAC','Inactive','Test C','VN','Asia/Ho_Chi_Minh',false);
insert into public.airlines(id,iata_code,name) values(pg_temp.fixture_id(21),'Q1','Test Airline');
insert into public.aircraft(id,airline_id,registration_code,model_name)
values(pg_temp.fixture_id(31),pg_temp.fixture_id(21),'FLIGHT-RLS-TEST','Test model');
insert into public.seats(id,aircraft_id,seat_code,row_number,column_number,cabin_class,position)
values(pg_temp.fixture_id(41),pg_temp.fixture_id(31),'1A',1,1,'economy','window'),
  (pg_temp.fixture_id(42),pg_temp.fixture_id(31),'1B',1,2,'economy','aisle');
insert into public.flight_instances(id,airline_id,aircraft_id,flight_number,departure_airport_id,
  arrival_airport_id,departure_at,arrival_at,sales_close_at,status,published_at)
select pg_temp.fixture_id(50+n),pg_temp.fixture_id(21),pg_temp.fixture_id(31),'Q1TEST'||n,
  pg_temp.fixture_id(11),pg_temp.fixture_id(12),now()+n*interval '3 days',
  now()+n*interval '3 days'+interval '2 hours',now()+n*interval '3 days'-interval '1 hour',
  case when n=1 then 'scheduled' else 'draft' end::public.flight_status,
  case when n=1 then now() end from generate_series(1,2) n;
insert into public.flight_fares(id,flight_id,fare_code,cabin_class,name,adult_base_amount,child_base_amount,infant_base_amount)
select pg_temp.fixture_id(60+n),pg_temp.fixture_id(50+n),'TEST','economy','Test Fare',100000,80000,10000
from generate_series(1,2) n;
insert into public.flight_seats(id,flight_id,seat_id,seat_code,row_number,column_number,cabin_class,position,is_exit_row)
select pg_temp.fixture_id(70+n),pg_temp.fixture_id(51),pg_temp.fixture_id(40+n),'1'||chr(64+n),1,n,
  'economy','window',false from generate_series(1,2) n;
insert into public.bookings(id,user_id,booking_code,create_request_id,create_request_hash,trip_type,
  contact_name,contact_email,contact_phone,base_amount,tax_amount,fee_amount,seat_amount,addon_amount,total_amount,
  refund_policy_snapshot,expires_at)
select pg_temp.fixture_id(80+n),pg_temp.fixture_id(n),'TEST-FOUNDATION-'||n,pg_temp.fixture_id(200+n),
  'test-request-hash','one_way','Test Contact','flight-rls@example.invalid','+84900000000',100000,0,0,0,0,100000,
  '{}',now()+interval '10 minutes' from generate_series(1,2) n;
insert into public.booking_segments(id,booking_id,flight_id,fare_id,journey_number,leg_number,flight_snapshot,fare_code_snapshot,cabin_class)
select pg_temp.fixture_id(90+n),pg_temp.fixture_id(80+n),pg_temp.fixture_id(51),pg_temp.fixture_id(61),1,1,'{}','TEST','economy'
from generate_series(1,2) n;
insert into public.booking_passengers(id,booking_id,ordinal,given_names,family_name,date_of_birth)
select pg_temp.fixture_id(100+n),pg_temp.fixture_id(80+n),1,'Test','Passenger','2000-01-01'
from generate_series(1,2) n;
insert into public.booking_passenger_segments(id,booking_id,segment_id,passenger_id,flight_id,passenger_type,
  requires_seat,base_amount,tax_amount,fee_amount,allowance_snapshot,cancellation_rules_snapshot)
select pg_temp.fixture_id(110+n),pg_temp.fixture_id(80+n),pg_temp.fixture_id(90+n),pg_temp.fixture_id(100+n),
  pg_temp.fixture_id(51),'adult',true,100000,0,0,'{}','{}' from generate_series(1,2) n;
insert into public.seat_reservations(id,booking_id,passenger_segment_id,flight_id,flight_seat_id,expires_at)
select pg_temp.fixture_id(120+n),pg_temp.fixture_id(80+n),pg_temp.fixture_id(110+n),pg_temp.fixture_id(51),
  pg_temp.fixture_id(70+n),now()+interval '10 minutes' from generate_series(1,2) n;
insert into public.addon_products(id,code,name,category)
values(pg_temp.fixture_id(131),'FLIGHT-RLS-MEAL','Test Meal','meal');
insert into public.flight_addon_offers(id,flight_id,product_id,unit_amount,max_quantity_per_passenger)
values(pg_temp.fixture_id(141),pg_temp.fixture_id(51),pg_temp.fixture_id(131),50000,2);
insert into public.booking_addons(id,booking_id,passenger_segment_id,flight_id,offer_id,
  product_name_snapshot,category_snapshot,quantity,unit_amount)
select pg_temp.fixture_id(150+n),pg_temp.fixture_id(80+n),pg_temp.fixture_id(110+n),pg_temp.fixture_id(51),
  pg_temp.fixture_id(141),'Test Meal','meal',2,50000 from generate_series(1,2) n;
insert into public.payments(id,booking_id,idempotency_key,request_hash,booking_version,amount)
select pg_temp.fixture_id(160+n),pg_temp.fixture_id(80+n),pg_temp.fixture_id(210+n),'test-hash',1,100000
from generate_series(1,2) n;
update public.payments set status='succeeded',paid_at=now() where id=pg_temp.fixture_id(162);
insert into public.refunds(id,booking_id,payment_id,idempotency_key,amount,reason)
values(pg_temp.fixture_id(171),pg_temp.fixture_id(82),pg_temp.fixture_id(162),pg_temp.fixture_id(221),50000,'Test refund');
insert into public.booking_events(booking_id,event_type,safe_message,customer_visible) values
  (pg_temp.fixture_id(81),'created','Public A',true),(pg_temp.fixture_id(81),'created','Hidden A',false),
  (pg_temp.fixture_id(82),'created','Public B',true);

-- Constraints execute as the database owner, separately from role-based RLS tests.
select pg_temp.expect_error($q$update public.airports set timezone='Not/A_Timezone' where id=pg_temp.fixture_id(11)$q$,'23514');
select pg_temp.expect_error($q$update public.flight_fares set adult_base_amount=-1 where id=pg_temp.fixture_id(61)$q$,'23514');
select pg_temp.expect_error($q$update public.flight_fares set baggage_allowance='{}' where id=pg_temp.fixture_id(61)$q$,'23514');
select pg_temp.expect_error($q$update public.flight_fares set baggage_allowance='{"cabin_pieces":1,"cabin_kg":7,"checked_pieces":1,"checked_kg":-1}' where id=pg_temp.fixture_id(61)$q$,'23514');
select pg_temp.expect_error($q$update public.bookings set total_amount=1 where id=pg_temp.fixture_id(81)$q$,'23514');
select pg_temp.expect_error($q$update public.booking_segments set fare_id=pg_temp.fixture_id(62) where id=pg_temp.fixture_id(91)$q$,'23503');
select pg_temp.expect_error($q$update public.booking_passenger_segments set passenger_id=pg_temp.fixture_id(102) where id=pg_temp.fixture_id(111)$q$,'23503');
select pg_temp.expect_error($q$update public.seat_reservations set flight_seat_id=pg_temp.fixture_id(71) where id=pg_temp.fixture_id(122)$q$,'23505');
select pg_temp.expect_error($q$update public.payments set amount=0 where id=pg_temp.fixture_id(161)$q$,'23514');
select pg_temp.expect_error($q$insert into public.payments(booking_id,idempotency_key,request_hash,booking_version,amount) values(pg_temp.fixture_id(81),pg_temp.fixture_id(230),'another-hash',1,100000)$q$,'23505');
select pg_temp.expect_error($q$insert into public.payments(booking_id,idempotency_key,request_hash,booking_version,amount,status,paid_at) values(pg_temp.fixture_id(82),pg_temp.fixture_id(231),'another-hash',1,100000,'succeeded',now())$q$,'23505');
select pg_temp.expect_error($q$update public.refunds set booking_id=pg_temp.fixture_id(81) where id=pg_temp.fixture_id(171)$q$,'23503');
select pg_temp.assert_true((select total_amount=100000 from public.booking_addons where id=pg_temp.fixture_id(151)), 'add-on total must be generated');

set local role anon;
select pg_temp.assert_true(current_user='anon','anon tests must execute as anon');
select pg_temp.assert_true((select count(*)=2 from public.airports where id in(pg_temp.fixture_id(11),pg_temp.fixture_id(12),pg_temp.fixture_id(13))), 'anon sees active airports only');
select pg_temp.assert_true((select count(*)=1 from public.flight_instances where id in(pg_temp.fixture_id(51),pg_temp.fixture_id(52))), 'anon cannot read drafts');
select pg_temp.assert_true((select count(*)=1 from public.flight_fares where id in(pg_temp.fixture_id(61),pg_temp.fixture_id(62))), 'draft fares remain private');
select pg_temp.assert_true((select count(*)=2 and bool_and(availability='held') from public.get_seat_map(pg_temp.fixture_id(51))), 'safe seat map exposes held availability');
select pg_temp.assert_true((select count(*)=0 from public.get_seat_map(pg_temp.fixture_id(52))), 'draft seat map must be hidden');
select pg_temp.expect_error('select * from public.bookings','42501');
select pg_temp.expect_error('select * from public.profiles','42501');
select pg_temp.expect_error('select * from public.flight_seats','42501');
select pg_temp.expect_error('select * from private.user_roles','42501');
reset role;

select set_config('request.jwt.claim.sub',pg_temp.fixture_id(1)::text,true);
set local role authenticated;
select pg_temp.assert_true(current_user='authenticated','customer tests must execute as authenticated');
select pg_temp.assert_true(not private.is_admin(),'user-editable metadata cannot grant admin');
select pg_temp.assert_true((select count(*)=1 from public.profiles where id in(pg_temp.fixture_id(1),pg_temp.fixture_id(2),pg_temp.fixture_id(3))), 'customer reads own profile only');
select pg_temp.assert_true((select count(*)=1 and bool_and(user_id=pg_temp.fixture_id(1)) from public.bookings where id in(pg_temp.fixture_id(81),pg_temp.fixture_id(82))), 'customer reads own booking only');
do $ownership$ declare t text; actual integer; begin
  foreach t in array array['booking_segments','booking_passengers','booking_passenger_segments','seat_reservations','booking_addons','payments'] loop
    execute format('select count(*) from public.%I where booking_id=pg_temp.fixture_id(82)',t) into actual;
    perform pg_temp.assert_true(actual=0,'cannot read other booking children: '||t);
    execute format('select count(*) from public.%I where booking_id=pg_temp.fixture_id(81)',t) into actual;
    perform pg_temp.assert_true(actual=1,'can read own booking children: '||t);
  end loop;
end $ownership$;
select pg_temp.assert_true((select count(*)=0 from public.refunds where id=pg_temp.fixture_id(171)), 'other customer refund is hidden');
select pg_temp.assert_true((select count(*)=1 from public.booking_events where booking_id in(pg_temp.fixture_id(81),pg_temp.fixture_id(82))), 'hide internal events and other customer events');
select pg_temp.assert_true((select count(*)=0 from public.flight_seats where id in(pg_temp.fixture_id(71),pg_temp.fixture_id(72))), 'raw inventory is admin only');
update public.profiles set full_name='Updated Test A' where id=pg_temp.fixture_id(1);
select pg_temp.assert_true((select full_name='Updated Test A' and updated_at>=created_at from public.profiles where id=pg_temp.fixture_id(1)), 'own profile update and timestamp trigger work');
update public.profiles set full_name='Attack' where id=pg_temp.fixture_id(2);
select pg_temp.expect_error($q$update public.profiles set id=pg_temp.fixture_id(2) where id=pg_temp.fixture_id(1)$q$,'42501');
select pg_temp.expect_error($q$insert into private.user_roles(user_id,role) values(pg_temp.fixture_id(1),'admin')$q$,'42501');
select pg_temp.expect_error($q$update public.payments set status='succeeded',paid_at=now() where id=pg_temp.fixture_id(161)$q$,'42501');
select pg_temp.expect_error($q$update public.bookings set status='confirmed',confirmed_at=now() where id=pg_temp.fixture_id(81)$q$,'42501');
select pg_temp.expect_error($q$insert into public.airlines(iata_code,name) values('Q2','Unauthorized')$q$,'42501');
reset role;
select pg_temp.assert_true((select full_name='Traveler' from public.profiles where id=pg_temp.fixture_id(2)), 'customer cannot edit another profile');

select set_config('request.jwt.claim.sub',pg_temp.fixture_id(3)::text,true);
set local role authenticated;
select pg_temp.assert_true(private.is_admin(),'admin helper reads private roles');
select pg_temp.assert_true((select count(*)=2 from public.bookings where id in(pg_temp.fixture_id(81),pg_temp.fixture_id(82))), 'admin can read both bookings');
select pg_temp.assert_true((select count(*)=3 from public.booking_events where booking_id in(pg_temp.fixture_id(81),pg_temp.fixture_id(82))), 'admin can read internal events');
select pg_temp.assert_true((select count(*)=3 from public.airports where id in(pg_temp.fixture_id(11),pg_temp.fixture_id(12),pg_temp.fixture_id(13))), 'admin can read inactive catalogue');
insert into public.airlines(iata_code,name) values('Q2','Admin Test');
update public.airlines set name='Admin Updated' where iata_code='Q2';
select pg_temp.assert_true((select name='Admin Updated' from public.airlines where iata_code='Q2'), 'admin catalogue insert/update works');
select pg_temp.expect_error($q$update public.payments set amount=1 where id=pg_temp.fixture_id(161)$q$,'42501');
select pg_temp.expect_error($q$delete from public.airlines where iata_code='Q2'$q$,'42501');
select pg_temp.expect_error('select * from private.admin_audit_logs','42501');
reset role;
rollback;
select 'schema, constraints, anon/customer/admin RLS assertions passed; all fixtures rolled back' as result;
