-- Flight database foundation, approved 2026-10-29.
-- Intentionally deny direct checkout writes. Business write RPCs ship separately.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '90s';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;
grant usage on schema public to anon, authenticated;

create type public.cabin_class as enum ('economy','premium_economy','business','first');
create type public.seat_position as enum ('window','middle','aisle');
create type public.flight_status as enum ('draft','scheduled','delayed','departed','arrived','cancelled');
create type public.trip_type as enum ('one_way','round_trip','multi_city');
create type public.booking_status as enum ('pending_payment','confirmed','cancelled','expired');
create type public.passenger_type as enum ('adult','child','infant');
create type public.document_type as enum ('national_id','passport');
create type public.reservation_status as enum ('held','confirmed','released','expired');
create type public.addon_category as enum ('baggage','meal','insurance_demo');
create type public.payment_status as enum ('pending','succeeded','failed','cancelled');
create type public.refund_status as enum ('pending','succeeded','failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 2 and 100),
  contact_phone text check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  avatar_path text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table private.user_roles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null check (role='admin'),
  granted_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.airports (
  id uuid primary key default gen_random_uuid(),
  iata_code text not null unique check (iata_code ~ '^[A-Z]{3}$'),
  name text not null check (length(btrim(name))>0), city text not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  timezone text not null, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.airlines (
  id uuid primary key default gen_random_uuid(),
  iata_code text not null unique check (iata_code ~ '^[A-Z0-9]{2}$'),
  name text not null check (length(btrim(name))>0), logo_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.destinations (
  id uuid primary key default gen_random_uuid(), airport_id uuid not null references public.airports(id),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null, description text, image_path text,
  is_featured boolean not null default false, sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.aircraft (
  id uuid primary key default gen_random_uuid(), airline_id uuid not null references public.airlines(id),
  registration_code text not null unique, model_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.seats (
  id uuid primary key default gen_random_uuid(), aircraft_id uuid not null references public.aircraft(id),
  seat_code text not null, row_number smallint not null check (row_number>0),
  column_number smallint not null check (column_number>0),
  cabin_class public.cabin_class not null, position public.seat_position not null,
  is_exit_row boolean not null default false, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(aircraft_id,seat_code), unique(aircraft_id,row_number,column_number)
);
create table public.flight_instances (
  id uuid primary key default gen_random_uuid(), airline_id uuid not null references public.airlines(id),
  aircraft_id uuid not null references public.aircraft(id), flight_number text not null,
  departure_airport_id uuid not null references public.airports(id),
  arrival_airport_id uuid not null references public.airports(id),
  departure_at timestamptz not null, arrival_at timestamptz not null, sales_close_at timestamptz not null,
  status public.flight_status not null default 'draft', published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (departure_airport_id<>arrival_airport_id), check (arrival_at>departure_at),
  check (sales_close_at<=departure_at), check (status<>'draft' or published_at is null),
  unique(airline_id,flight_number,departure_at)
);
create table public.flight_fares (
  id uuid primary key default gen_random_uuid(), flight_id uuid not null references public.flight_instances(id),
  fare_code text not null, cabin_class public.cabin_class not null, name text not null,
  adult_base_amount bigint not null check(adult_base_amount>=0),
  child_base_amount bigint not null check(child_base_amount>=0),
  infant_base_amount bigint not null check(infant_base_amount>=0),
  adult_tax_amount bigint not null default 0 check(adult_tax_amount>=0),
  child_tax_amount bigint not null default 0 check(child_tax_amount>=0),
  infant_tax_amount bigint not null default 0 check(infant_tax_amount>=0),
  adult_fee_amount bigint not null default 0 check(adult_fee_amount>=0),
  child_fee_amount bigint not null default 0 check(child_fee_amount>=0),
  infant_fee_amount bigint not null default 0 check(infant_fee_amount>=0),
  currency text not null default 'VND' check(currency='VND'),
  baggage_allowance jsonb not null default '{"cabin_pieces":0,"cabin_kg":0,"checked_pieces":0,"checked_kg":0}',
  cancellation_allowed boolean not null default false,
  cancellation_cutoff_minutes integer not null default 60 check(cancellation_cutoff_minutes>=0),
  cancellation_fee_amount bigint not null default 0 check(cancellation_fee_amount>=0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(jsonb_typeof(baggage_allowance)='object'),
  check ((jsonb_typeof(baggage_allowance->'cabin_pieces')='number'
    and baggage_allowance->'cabin_pieces'>='0'::jsonb
    and jsonb_typeof(baggage_allowance->'cabin_kg')='number'
    and baggage_allowance->'cabin_kg'>='0'::jsonb
    and jsonb_typeof(baggage_allowance->'checked_pieces')='number'
    and baggage_allowance->'checked_pieces'>='0'::jsonb
    and jsonb_typeof(baggage_allowance->'checked_kg')='number'
    and baggage_allowance->'checked_kg'>='0'::jsonb) is true),
  unique(flight_id,fare_code), unique(id,flight_id)
);
create table public.flight_seats (
  id uuid primary key default gen_random_uuid(), flight_id uuid not null references public.flight_instances(id),
  seat_id uuid not null references public.seats(id), seat_code text not null,
  row_number smallint not null check(row_number>0), column_number smallint not null check(column_number>0),
  cabin_class public.cabin_class not null, position public.seat_position not null,
  is_exit_row boolean not null, is_blocked boolean not null default false,
  selection_fee_amount bigint not null default 0 check(selection_fee_amount>=0),
  currency text not null default 'VND' check(currency='VND'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(flight_id,seat_code), unique(flight_id,seat_id), unique(id,flight_id)
);
create table public.addon_products (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  category public.addon_category not null, description text, weight_kg numeric(6,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (category<>'baggage' or (weight_kg is not null and weight_kg>0)),
  check (weight_kg is null or weight_kg>0)
);
create table public.flight_addon_offers (
  id uuid primary key default gen_random_uuid(), flight_id uuid not null references public.flight_instances(id),
  product_id uuid not null references public.addon_products(id), unit_amount bigint not null check(unit_amount>=0),
  currency text not null default 'VND' check(currency='VND'),
  max_quantity_per_passenger smallint not null check(max_quantity_per_passenger>0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(flight_id,product_id), unique(id,flight_id)
);
create table public.bookings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete restrict,
  booking_code text not null unique check(length(booking_code) between 6 and 32),
  create_request_id uuid not null, create_request_hash text not null,
  trip_type public.trip_type not null, status public.booking_status not null default 'pending_payment',
  contact_name text not null, contact_email text not null, contact_phone text not null,
  currency text not null default 'VND' check(currency='VND'),
  base_amount bigint not null check(base_amount>=0), tax_amount bigint not null check(tax_amount>=0),
  fee_amount bigint not null check(fee_amount>=0), seat_amount bigint not null check(seat_amount>=0),
  addon_amount bigint not null check(addon_amount>=0), total_amount bigint not null check(total_amount>0),
  version integer not null default 1 check(version>=1),
  refund_policy_snapshot jsonb not null check(jsonb_typeof(refund_policy_snapshot)='object'),
  expires_at timestamptz not null, confirmed_at timestamptz, cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,create_request_id),
  check(total_amount::numeric=base_amount::numeric+tax_amount+fee_amount+seat_amount+addon_amount),
  check(status<>'confirmed' or confirmed_at is not null),
  check(status<>'cancelled' or cancelled_at is not null)
);
create table public.booking_segments (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id),
  flight_id uuid not null references public.flight_instances(id), fare_id uuid not null,
  journey_number smallint not null check(journey_number>=1), leg_number smallint not null check(leg_number>=1),
  flight_snapshot jsonb not null check(jsonb_typeof(flight_snapshot)='object'),
  fare_code_snapshot text not null, cabin_class public.cabin_class not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(booking_id,journey_number,leg_number), unique(id,booking_id,flight_id),
  foreign key(fare_id,flight_id) references public.flight_fares(id,flight_id)
);
create table public.booking_passengers (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id),
  ordinal smallint not null check(ordinal>=1), given_names text not null, family_name text not null,
  date_of_birth date not null, nationality_code text check(nationality_code ~ '^[A-Z]{2}$'),
  document_type public.document_type, document_number text, document_expiry_date date,
  document_issuer_country text check(document_issuer_country ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(booking_id,ordinal), unique(id,booking_id),
  check((document_type is null)=(document_number is null))
);
create table public.booking_passenger_segments (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id),
  segment_id uuid not null, passenger_id uuid not null, flight_id uuid not null,
  passenger_type public.passenger_type not null, requires_seat boolean not null,
  accompanying_passenger_id uuid,
  base_amount bigint not null check(base_amount>=0), tax_amount bigint not null check(tax_amount>=0),
  fee_amount bigint not null check(fee_amount>=0), currency text not null default 'VND' check(currency='VND'),
  allowance_snapshot jsonb not null check(jsonb_typeof(allowance_snapshot)='object'),
  cancellation_rules_snapshot jsonb not null check(jsonb_typeof(cancellation_rules_snapshot)='object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(segment_id,passenger_id), unique(id,booking_id,flight_id),
  foreign key(segment_id,booking_id,flight_id) references public.booking_segments(id,booking_id,flight_id),
  foreign key(passenger_id,booking_id) references public.booking_passengers(id,booking_id),
  foreign key(accompanying_passenger_id,booking_id) references public.booking_passengers(id,booking_id),
  check ((passenger_type='infant' and not requires_seat and accompanying_passenger_id is not null)
    or (passenger_type<>'infant' and requires_seat and accompanying_passenger_id is null)),
  check (accompanying_passenger_id is null or accompanying_passenger_id<>passenger_id)
);
create table public.seat_reservations (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id),
  passenger_segment_id uuid not null, flight_id uuid not null, flight_seat_id uuid not null,
  status public.reservation_status not null default 'held', selection_amount bigint not null default 0 check(selection_amount>=0),
  currency text not null default 'VND' check(currency='VND'),
  expires_at timestamptz, confirmed_at timestamptz, released_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(passenger_segment_id,booking_id,flight_id) references public.booking_passenger_segments(id,booking_id,flight_id),
  foreign key(flight_seat_id,flight_id) references public.flight_seats(id,flight_id),
  check(status<>'held' or expires_at is not null), check(status<>'confirmed' or confirmed_at is not null)
);
create table public.booking_addons (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id),
  passenger_segment_id uuid not null, flight_id uuid not null, offer_id uuid not null,
  product_name_snapshot text not null, category_snapshot public.addon_category not null,
  weight_kg_snapshot numeric(6,2), quantity smallint not null check(quantity>0),
  unit_amount bigint not null check(unit_amount>=0),
  total_amount bigint generated always as (quantity::bigint*unit_amount) stored,
  currency text not null default 'VND' check(currency='VND'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(passenger_segment_id,offer_id),
  foreign key(passenger_segment_id,booking_id,flight_id) references public.booking_passenger_segments(id,booking_id,flight_id),
  foreign key(offer_id,flight_id) references public.flight_addon_offers(id,flight_id)
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id),
  idempotency_key uuid not null, request_hash text not null, booking_version integer not null check(booking_version>=1),
  amount bigint not null check(amount>0), currency text not null default 'VND' check(currency='VND'),
  provider text not null default 'mock' check(provider='mock'), provider_reference text,
  status public.payment_status not null default 'pending', failure_code text, paid_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(booking_id,idempotency_key), unique(provider,provider_reference), unique(id,booking_id),
  check(status<>'succeeded' or paid_at is not null)
);
create table public.refunds (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id),
  payment_id uuid not null unique, idempotency_key uuid not null,
  amount bigint not null check(amount>0), currency text not null default 'VND' check(currency='VND'),
  reason text not null, status public.refund_status not null default 'pending', provider_reference text unique,
  completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(booking_id,idempotency_key),
  foreign key(payment_id,booking_id) references public.payments(id,booking_id),
  check(status<>'succeeded' or completed_at is not null)
);
create table public.booking_events (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id),
  actor_user_id uuid references auth.users(id),
  event_type text not null check(event_type in ('created','checkout_updated','seat_changed','payment_started',
    'payment_succeeded','payment_failed','payment_cancelled','confirmed','cancelled','expired','refund_started','refund_succeeded','refund_failed')),
  from_status public.booking_status, to_status public.booking_status,
  customer_visible boolean not null default true, safe_message text not null,
  metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);
create table private.admin_audit_logs (
  id uuid primary key default gen_random_uuid(), actor_user_id uuid references auth.users(id),
  action text not null, entity_type text not null, entity_id uuid,
  safe_changes jsonb not null default '{}' check(jsonb_typeof(safe_changes)='object'),
  created_at timestamptz not null default now()
);

-- Query/FK indexes; primary/unique constraints above already create their indexes.
create index destinations_airport_idx on public.destinations(airport_id);
create index aircraft_airline_idx on public.aircraft(airline_id);
create index flight_search_idx on public.flight_instances(departure_airport_id,arrival_airport_id,departure_at,id)
  where published_at is not null and status in ('scheduled','delayed');
create index flight_aircraft_time_idx on public.flight_instances(aircraft_id,departure_at);
create index flight_arrival_airport_idx on public.flight_instances(arrival_airport_id);
create index flight_seats_template_idx on public.flight_seats(seat_id);
create index flight_offers_product_idx on public.flight_addon_offers(product_id);
create index bookings_owner_history_idx on public.bookings(user_id,created_at desc,id desc);
create index bookings_expiry_idx on public.bookings(expires_at,id) where status='pending_payment';
create index booking_segments_flight_idx on public.booking_segments(flight_id);
create index booking_segments_fare_idx on public.booking_segments(fare_id);
create index passenger_segments_booking_idx on public.booking_passenger_segments(booking_id);
create index passenger_segments_passenger_idx on public.booking_passenger_segments(passenger_id);
create unique index reservations_active_seat_uq on public.seat_reservations(flight_seat_id) where status in ('held','confirmed');
create unique index reservations_active_passenger_uq on public.seat_reservations(passenger_segment_id) where status in ('held','confirmed');
create index reservations_booking_idx on public.seat_reservations(booking_id);
create index reservations_expiry_idx on public.seat_reservations(expires_at,id) where status='held';
create index booking_addons_booking_idx on public.booking_addons(booking_id);
create index booking_addons_offer_idx on public.booking_addons(offer_id);
create index payments_booking_history_idx on public.payments(booking_id,created_at desc,id desc);
create unique index payments_one_success_uq on public.payments(booking_id) where status='succeeded';
create unique index payments_one_pending_uq on public.payments(booking_id) where status='pending';
create index booking_events_history_idx on public.booking_events(booking_id,created_at desc,id desc);
create index admin_audit_actor_idx on private.admin_audit_logs(actor_user_id,created_at desc,id desc);
create index admin_audit_entity_idx on private.admin_audit_logs(entity_type,entity_id,created_at desc,id desc);

-- Helpers are intentionally outside the exposed public schema.
create function private.is_admin() returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from private.user_roles r where r.user_id=(select auth.uid()) and r.role='admin') $$;
revoke all on function private.is_admin() from public,anon,authenticated;
grant execute on function private.is_admin() to anon,authenticated;

create function private.set_updated_at() returns trigger language plpgsql security invoker set search_path=''
as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
revoke all on function private.set_updated_at() from public,anon,authenticated;

create function private.create_auth_profile() returns trigger language plpgsql security definer set search_path=''
as $$
declare display_name text;
begin
  if jsonb_typeof(new.raw_user_meta_data->'full_name')='string' then
    display_name=btrim(left(btrim(new.raw_user_meta_data->>'full_name'),100));
  end if;
  if display_name is null or length(display_name)<2 then display_name='Traveler'; end if;
  insert into public.profiles(id,full_name) values(new.id,display_name) on conflict(id) do nothing;
  return new;
end $$;
revoke all on function private.create_auth_profile() from public,anon,authenticated;
create trigger flight_create_auth_profile after insert on auth.users for each row execute function private.create_auth_profile();
-- Backfill only missing profiles; never overwrite an existing profile.
insert into public.profiles(id,full_name)
select u.id,case when jsonb_typeof(u.raw_user_meta_data->'full_name')='string'
  and length(btrim(left(btrim(u.raw_user_meta_data->>'full_name'),100)))>=2
  then btrim(left(btrim(u.raw_user_meta_data->>'full_name'),100))
  else 'Traveler' end from auth.users u on conflict(id) do nothing;

create function private.validate_airport_timezone() returns trigger language plpgsql security invoker set search_path=''
as $$ begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone)
  then raise exception 'Invalid IANA timezone' using errcode='23514'; end if;
  return new;
end $$;
revoke all on function private.validate_airport_timezone() from public,anon,authenticated;
create trigger validate_airport_timezone before insert or update of timezone on public.airports
  for each row execute function private.validate_airport_timezone();

-- Uniform timestamp and RLS setup is limited to these explicit business tables.
do $setup$
declare t text;
begin
  foreach t in array array['profiles','airports','airlines','destinations','aircraft','seats','flight_instances',
    'flight_fares','flight_seats','addon_products','flight_addon_offers','bookings','booking_segments',
    'booking_passengers','booking_passenger_segments','seat_reservations','booking_addons','payments','refunds','booking_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public,anon,authenticated',t);
    if t<>'booking_events' then
      execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',t);
    end if;
  end loop;
  foreach t in array array['user_roles','admin_audit_logs'] loop
    execute format('alter table private.%I enable row level security',t);
    execute format('revoke all on table private.%I from public,anon,authenticated',t);
  end loop;
end $setup$;
create trigger set_updated_at before update on private.user_roles for each row execute function private.set_updated_at();

-- Profiles: column grants prevent changing the owner/timestamps even on own row.
grant select on public.profiles to authenticated;
grant update(full_name,contact_phone,avatar_path) on public.profiles to authenticated;
create policy profile_read_own on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy profile_read_admin on public.profiles for select to authenticated using((select private.is_admin()));
create policy profile_update_own on public.profiles for update to authenticated
  using(id=(select auth.uid())) with check(id=(select auth.uid()));

-- Small editable catalogues: allow only active public rows, admin controls writes.
do $catalog$
declare t text;
begin
  foreach t in array array['airports','airlines','addon_products'] loop
    execute format('grant select on public.%I to anon,authenticated',t);
    execute format('grant insert,update on public.%I to authenticated',t);
    execute format('create policy catalogue_read_active on public.%I for select to anon,authenticated using(is_active)',t);
    execute format('create policy catalogue_read_admin on public.%I for select to authenticated using((select private.is_admin()))',t);
    execute format('create policy catalogue_insert_admin on public.%I for insert to authenticated with check((select private.is_admin()))',t);
    execute format('create policy catalogue_update_admin on public.%I for update to authenticated using((select private.is_admin())) with check((select private.is_admin()))',t);
  end loop;
end $catalog$;
grant select on public.destinations to anon,authenticated;
grant insert,update on public.destinations to authenticated;
create policy destinations_read_active on public.destinations for select to anon,authenticated
using(is_active and exists(select 1 from public.airports a where a.id=airport_id and a.is_active));
create policy destinations_read_admin on public.destinations for select to authenticated using((select private.is_admin()));
create policy destinations_insert_admin on public.destinations for insert to authenticated with check((select private.is_admin()));
create policy destinations_update_admin on public.destinations for update to authenticated
using((select private.is_admin())) with check((select private.is_admin()));

-- Raw inventory/model information is admin-read-only. Safe seat map is an RPC.
do $inventory$
declare t text;
begin
  foreach t in array array['aircraft','seats','flight_seats'] loop
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy inventory_read_admin on public.%I for select to authenticated using((select private.is_admin()))',t);
  end loop;
end $inventory$;
grant select on public.flight_instances,public.flight_fares,public.flight_addon_offers to anon,authenticated;
create policy flights_read_published on public.flight_instances for select to anon,authenticated using(published_at is not null);
create policy flights_read_admin on public.flight_instances for select to authenticated using((select private.is_admin()));
create policy fares_read_active on public.flight_fares for select to anon,authenticated
using(is_active and exists(select 1 from public.flight_instances f where f.id=flight_id and f.published_at is not null));
create policy fares_read_admin on public.flight_fares for select to authenticated using((select private.is_admin()));
create policy offers_read_active on public.flight_addon_offers for select to anon,authenticated
using(is_active and exists(select 1 from public.flight_instances f where f.id=flight_id and f.published_at is not null)
  and exists(select 1 from public.addon_products p where p.id=product_id and p.is_active));
create policy offers_read_admin on public.flight_addon_offers for select to authenticated using((select private.is_admin()));
grant insert,update on public.flight_addon_offers to authenticated;
create policy offers_insert_admin on public.flight_addon_offers for insert to authenticated with check((select private.is_admin()));
create policy offers_update_admin on public.flight_addon_offers for update to authenticated
using((select private.is_admin())) with check((select private.is_admin()));

grant select on public.bookings to authenticated;
create policy bookings_read_own on public.bookings for select to authenticated using(user_id=(select auth.uid()));
create policy bookings_read_admin on public.bookings for select to authenticated using((select private.is_admin()));
do $ownership$
declare t text;
begin
  foreach t in array array['booking_segments','booking_passengers','booking_passenger_segments',
    'seat_reservations','booking_addons','payments','refunds'] loop
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy booking_read_own on public.%I for select to authenticated using(exists(select 1 from public.bookings b where b.id=booking_id and b.user_id=(select auth.uid())))',t);
    execute format('create policy booking_read_admin on public.%I for select to authenticated using((select private.is_admin()))',t);
  end loop;
end $ownership$;
grant select on public.booking_events to authenticated;
create policy events_read_own on public.booking_events for select to authenticated
using(customer_visible and exists(select 1 from public.bookings b where b.id=booking_id and b.user_id=(select auth.uid())));
create policy events_read_admin on public.booking_events for select to authenticated using((select private.is_admin()));

-- Only a published flight's safe inventory is returned; never expose holder IDs.
create function private.get_seat_map(p_flight_id uuid)
returns table(flight_seat_id uuid,seat_code text,row_number smallint,column_number smallint,
  cabin_class public.cabin_class,"position" public.seat_position,is_exit_row boolean,
  selection_fee_amount bigint,currency text,availability text)
language sql volatile security definer set search_path=''
as $$
  select s.id,s.seat_code,s.row_number,s.column_number,s.cabin_class,s.position,s.is_exit_row,
    s.selection_fee_amount,s.currency,
    case when s.is_blocked then 'blocked'
      when exists(select 1 from public.seat_reservations r where r.flight_seat_id=s.id and r.status='confirmed') then 'booked'
      when exists(select 1 from public.seat_reservations r where r.flight_seat_id=s.id and r.status='held' and r.expires_at>clock_timestamp()) then 'held'
      else 'available' end
  from public.flight_seats s join public.flight_instances f on f.id=s.flight_id
  where s.flight_id=p_flight_id and (f.published_at is not null or private.is_admin())
  order by s.row_number,s.column_number
$$;
revoke all on function private.get_seat_map(uuid) from public,anon,authenticated;
grant execute on function private.get_seat_map(uuid) to anon,authenticated;
create function public.get_seat_map(p_flight_id uuid)
returns table(flight_seat_id uuid,seat_code text,row_number smallint,column_number smallint,
  cabin_class public.cabin_class,"position" public.seat_position,is_exit_row boolean,
  selection_fee_amount bigint,currency text,availability text)
language sql volatile security invoker set search_path=''
as $$ select * from private.get_seat_map(p_flight_id) $$;
revoke all on function public.get_seat_map(uuid) from public,anon,authenticated;
grant execute on function public.get_seat_map(uuid) to anon,authenticated;

-- API schema cache refresh is delivered on transaction commit.
notify pgrst,'reload schema';
commit;
