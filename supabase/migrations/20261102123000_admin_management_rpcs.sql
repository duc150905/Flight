-- Migration: Admin management RPCs and audit logging (TV3 — Priority 2)
-- Enforces server-side admin authorization, aircraft schedule conflict checks,
-- active booking/hold protections, automatic flight_seats provisioning, and audit logging.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

-- 1. Make public.is_admin() SECURITY INVOKER (delegating to SECURITY DEFINER private.is_admin())
-- so no SECURITY DEFINER function is directly exposed in the public schema.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin();
$$;

comment on function public.is_admin() is
  'Returns true if the current authenticated caller has the admin role in private.user_roles.';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 2. Internal helper to assert admin privileges and write to private.admin_audit_logs
create or replace function private.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

revoke all on function private.require_admin() from public, anon, authenticated;

create or replace function private.write_admin_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_safe_changes jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_log_id uuid;
begin
  if p_action is null or length(btrim(p_action)) = 0 then
    raise exception 'Audit action is required' using errcode = '23514';
  end if;
  if p_entity_type is null or length(btrim(p_entity_type)) = 0 then
    raise exception 'Audit entity_type is required' using errcode = '23514';
  end if;
  insert into private.admin_audit_logs (actor_user_id, action, entity_type, entity_id, safe_changes)
  values (v_uid, btrim(p_action), btrim(p_entity_type), p_entity_id, coalesce(p_safe_changes, '{}'::jsonb))
  returning id into v_log_id;
  return v_log_id;
end;
$$;

revoke all on function private.write_admin_audit_log(text, text, uuid, jsonb) from public, anon, authenticated;

-- Optional audit trigger for direct admin catalogue writes via PostgREST
create or replace function private.audit_catalogue_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is not null and private.is_admin() then
    insert into private.admin_audit_logs (actor_user_id, action, entity_type, entity_id, safe_changes)
    values (
      v_uid,
      tg_table_name || '.' || lower(tg_op),
      tg_table_name,
      new.id,
      case
        when tg_op = 'UPDATE' then jsonb_build_object(
          'is_active', new.is_active,
          'operation', lower(tg_op),
          'before', to_jsonb(old),
          'after', to_jsonb(new)
        )
        else jsonb_build_object(
          'is_active', new.is_active,
          'operation', lower(tg_op),
          'after', to_jsonb(new)
        )
      end
    );
  end if;
  return new;
end;
$$;

revoke all on function private.audit_catalogue_write() from public, anon, authenticated;

do $audit_triggers$
declare
  t text;
begin
  foreach t in array array['airports', 'airlines', 'destinations', 'addon_products', 'flight_addon_offers'] loop
    execute format('drop trigger if exists audit_admin_catalogue_write on public.%I', t);
    execute format(
      'create trigger audit_admin_catalogue_write after insert or update on public.%I for each row execute function private.audit_catalogue_write()',
      t
    );
  end loop;
end $audit_triggers$;

-- 3. Admin RPC: Read audit logs safely
create or replace function private.admin_list_audit_logs(
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  actor_user_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  safe_changes jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  perform private.require_admin();
  return query
  select
    l.id,
    l.actor_user_id,
    l.action,
    l.entity_type,
    l.entity_id,
    l.safe_changes,
    l.created_at
  from private.admin_audit_logs l
  where (p_entity_type is null or l.entity_type = btrim(p_entity_type))
    and (p_entity_id is null or l.entity_id = p_entity_id)
  order by l.created_at desc, l.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function private.admin_list_audit_logs(text, uuid, integer, integer) from public, anon, authenticated;
grant execute on function private.admin_list_audit_logs(text, uuid, integer, integer) to authenticated;

create or replace function public.admin_list_audit_logs(
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  actor_user_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  safe_changes jsonb,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_audit_logs(p_entity_type, p_entity_id, p_limit, p_offset);
$$;

revoke all on function public.admin_list_audit_logs(text, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_list_audit_logs(text, uuid, integer, integer) to authenticated;

-- 4. Admin RPC: Create or update aircraft
create or replace function private.admin_upsert_aircraft(
  p_aircraft_id uuid default null,
  p_airline_id uuid default null,
  p_registration_code text default null,
  p_model_name text default null,
  p_is_active boolean default true
)
returns public.aircraft
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reg text := upper(btrim(coalesce(p_registration_code, '')));
  v_model text := btrim(coalesce(p_model_name, ''));
  v_existing public.aircraft;
  v_result public.aircraft;
begin
  perform private.require_admin();

  if p_airline_id is null then
    raise exception 'Airline ID is required' using errcode = '23514';
  end if;
  if length(v_reg) = 0 then
    raise exception 'Aircraft registration code is required' using errcode = '23514';
  end if;
  if length(v_model) = 0 then
    raise exception 'Aircraft model name is required' using errcode = '23514';
  end if;

  if p_aircraft_id is null then
    insert into public.aircraft (airline_id, registration_code, model_name, is_active)
    values (p_airline_id, v_reg, v_model, coalesce(p_is_active, true))
    returning * into v_result;

    perform private.write_admin_audit_log(
      'aircraft.create',
      'aircraft',
      v_result.id,
      jsonb_build_object(
        'airline_id', v_result.airline_id,
        'registration_code', v_result.registration_code,
        'model_name', v_result.model_name,
        'is_active', v_result.is_active
      )
    );
  else
    select * into v_existing
    from public.aircraft
    where id = p_aircraft_id
    for update;

    if not found then
      raise exception 'Aircraft not found' using errcode = 'P0002';
    end if;

    if v_existing.airline_id <> p_airline_id and exists (
      select 1 from public.flight_instances f where f.aircraft_id = p_aircraft_id
    ) then
      raise exception 'Cannot change airline of an aircraft already assigned to flights' using errcode = '23514';
    end if;

    if coalesce(p_is_active, true) = false and exists (
      select 1
      from public.flight_instances f
      where f.aircraft_id = p_aircraft_id
        and f.status in ('scheduled', 'delayed')
        and f.arrival_at > clock_timestamp()
    ) then
      raise exception 'Cannot deactivate an aircraft with upcoming scheduled or delayed flights' using errcode = '23514';
    end if;

    update public.aircraft
    set
      airline_id = p_airline_id,
      registration_code = v_reg,
      model_name = v_model,
      is_active = coalesce(p_is_active, true)
    where id = p_aircraft_id
    returning * into v_result;

    perform private.write_admin_audit_log(
      'aircraft.update',
      'aircraft',
      v_result.id,
      jsonb_build_object(
        'airline_id', v_result.airline_id,
        'registration_code', v_result.registration_code,
        'model_name', v_result.model_name,
        'is_active', v_result.is_active,
        'before', to_jsonb(v_existing),
        'after', to_jsonb(v_result)
      )
    );
  end if;

  return v_result;
end;
$$;

revoke all on function private.admin_upsert_aircraft(uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function private.admin_upsert_aircraft(uuid, uuid, text, text, boolean) to authenticated;

create or replace function public.admin_upsert_aircraft(
  p_aircraft_id uuid default null,
  p_airline_id uuid default null,
  p_registration_code text default null,
  p_model_name text default null,
  p_is_active boolean default true
)
returns public.aircraft
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.admin_upsert_aircraft(
    p_aircraft_id, p_airline_id, p_registration_code, p_model_name, p_is_active
  );
$$;

revoke all on function public.admin_upsert_aircraft(uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_upsert_aircraft(uuid, uuid, text, text, boolean) to authenticated;

-- 5. Admin RPC: Upsert aircraft seat template (blocks modification when published/active flights exist)
create or replace function private.admin_upsert_aircraft_seats(
  p_aircraft_id uuid,
  p_seats jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_aircraft public.aircraft;
  v_item jsonb;
  v_seat_code text;
  v_row smallint;
  v_col smallint;
  v_cabin public.cabin_class;
  v_position public.seat_position;
  v_exit boolean;
  v_active boolean;
  v_count integer := 0;
begin
  perform private.require_admin();

  if p_aircraft_id is null then
    raise exception 'Aircraft ID is required' using errcode = '23514';
  end if;
  if p_seats is null or jsonb_typeof(p_seats) <> 'array' or jsonb_array_length(p_seats) = 0 then
    raise exception 'Seat template must be a non-empty JSON array' using errcode = '23514';
  end if;

  select * into v_aircraft
  from public.aircraft
  where id = p_aircraft_id
  for update;

  if not found then
    raise exception 'Aircraft not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.flight_instances f
    where f.aircraft_id = p_aircraft_id
      and (
        f.published_at is not null
        or exists (select 1 from public.flight_seats fs where fs.flight_id = f.id)
      )
  ) then
    raise exception 'Cannot modify seat template for an aircraft that already has published flights or flight seat inventory'
      using errcode = '23514';
  end if;

  for v_item in select * from jsonb_array_elements(p_seats) loop
    v_seat_code := upper(btrim(coalesce(v_item->>'seat_code', '')));
    v_row := (v_item->>'row_number')::smallint;
    v_col := (v_item->>'column_number')::smallint;
    v_cabin := (v_item->>'cabin_class')::public.cabin_class;
    v_position := (v_item->>'position')::public.seat_position;
    v_exit := coalesce((v_item->>'is_exit_row')::boolean, false);
    v_active := coalesce((v_item->>'is_active')::boolean, true);

    if length(v_seat_code) = 0 or v_row is null or v_row <= 0 or v_col is null or v_col <= 0
       or v_cabin is null or v_position is null then
      raise exception 'Invalid seat definition in template array' using errcode = '23514';
    end if;

    insert into public.seats (
      aircraft_id, seat_code, row_number, column_number, cabin_class, position, is_exit_row, is_active
    )
    values (
      p_aircraft_id, v_seat_code, v_row, v_col, v_cabin, v_position, v_exit, v_active
    )
    on conflict (aircraft_id, seat_code) do update
    set
      row_number = excluded.row_number,
      column_number = excluded.column_number,
      cabin_class = excluded.cabin_class,
      position = excluded.position,
      is_exit_row = excluded.is_exit_row,
      is_active = excluded.is_active;

    v_count := v_count + 1;
  end loop;

  perform private.write_admin_audit_log(
    'seats.upsert_template',
    'aircraft',
    p_aircraft_id,
    jsonb_build_object('upserted_seat_count', v_count)
  );

  return v_count;
end;
$$;

revoke all on function private.admin_upsert_aircraft_seats(uuid, jsonb) from public, anon, authenticated;
grant execute on function private.admin_upsert_aircraft_seats(uuid, jsonb) to authenticated;

create or replace function public.admin_upsert_aircraft_seats(
  p_aircraft_id uuid,
  p_seats jsonb
)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.admin_upsert_aircraft_seats(p_aircraft_id, p_seats);
$$;

revoke all on function public.admin_upsert_aircraft_seats(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_upsert_aircraft_seats(uuid, jsonb) to authenticated;

-- 6. Admin RPC: Create or update flight instance (locks aircraft, checks schedule overlaps,
-- protects active bookings/holds, and auto-provisions flight_seats inventory)
create or replace function private.admin_save_flight_instance(
  p_flight_id uuid default null,
  p_airline_id uuid default null,
  p_aircraft_id uuid default null,
  p_flight_number text default null,
  p_departure_airport_id uuid default null,
  p_arrival_airport_id uuid default null,
  p_departure_at timestamptz default null,
  p_arrival_at timestamptz default null,
  p_sales_close_at timestamptz default null,
  p_status public.flight_status default 'draft',
  p_publish boolean default false
)
returns public.flight_instances
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_aircraft public.aircraft;
  v_existing public.flight_instances;
  v_result public.flight_instances;
  v_flight_no text := upper(btrim(coalesce(p_flight_number, '')));
  v_sales_close timestamptz;
  v_status public.flight_status := coalesce(p_status, 'draft');
  v_published_at timestamptz;
  v_has_active_orders boolean := false;
  v_template_seat_count integer := 0;
begin
  perform private.require_admin();

  if p_airline_id is null or p_aircraft_id is null
     or p_departure_airport_id is null or p_arrival_airport_id is null
     or p_departure_at is null or p_arrival_at is null then
    raise exception 'Missing required flight schedule fields' using errcode = '23514';
  end if;

  if length(v_flight_no) < 2 then
    raise exception 'Flight number is required' using errcode = '23514';
  end if;

  if p_departure_airport_id = p_arrival_airport_id then
    raise exception 'Departure and arrival airports must be different' using errcode = '23514';
  end if;

  if p_arrival_at <= p_departure_at then
    raise exception 'Arrival time must be after departure time' using errcode = '23514';
  end if;

  v_sales_close := coalesce(p_sales_close_at, p_departure_at - interval '60 minutes');
  if v_sales_close > p_departure_at then
    raise exception 'Sales close time must not be after departure time' using errcode = '23514';
  end if;

  -- Lock aircraft row to prevent concurrent overlapping schedule creation
  select * into v_aircraft
  from public.aircraft
  where id = p_aircraft_id
  for update;

  if not found then
    raise exception 'Aircraft not found' using errcode = 'P0002';
  end if;

  if v_aircraft.airline_id <> p_airline_id then
    raise exception 'Aircraft does not belong to the specified airline' using errcode = '23514';
  end if;

  if not v_aircraft.is_active and p_flight_id is null then
    raise exception 'Cannot assign an inactive aircraft to a new flight' using errcode = '23514';
  end if;

  -- Check for overlapping flights on the same aircraft
  if exists (
    select 1
    from public.flight_instances f
    where f.aircraft_id = p_aircraft_id
      and f.status <> 'cancelled'
      and (p_flight_id is null or f.id <> p_flight_id)
      and f.departure_at < p_arrival_at
      and p_departure_at < f.arrival_at
  ) then
    raise exception 'Aircraft schedule conflict with another flight on the same aircraft'
      using errcode = '23P01';
  end if;

  select count(*) into v_template_seat_count
  from public.seats s
  where s.aircraft_id = p_aircraft_id
    and s.is_active = true;

  if p_flight_id is not null then
    select * into v_existing
    from public.flight_instances
    where id = p_flight_id
    for update;

    if not found then
      raise exception 'Flight instance not found' using errcode = 'P0002';
    end if;

    v_has_active_orders := exists (
      select 1
      from public.booking_segments bs
      join public.bookings b on b.id = bs.booking_id
      where bs.flight_id = p_flight_id
        and b.status in ('pending_payment', 'confirmed')
    ) or exists (
      select 1
      from public.seat_reservations sr
      where sr.flight_id = p_flight_id
        and (
          sr.status = 'confirmed'
          or (sr.status = 'held' and sr.expires_at > clock_timestamp())
        )
    );

    if v_has_active_orders then
      if v_existing.aircraft_id <> p_aircraft_id
         or v_existing.airline_id <> p_airline_id
         or v_existing.departure_airport_id <> p_departure_airport_id
         or v_existing.arrival_airport_id <> p_arrival_airport_id
         or v_existing.departure_at <> p_departure_at
         or v_existing.arrival_at <> p_arrival_at then
        raise exception 'Cannot change route, aircraft, or schedule of a flight with active bookings or seat holds'
          using errcode = '23514';
      end if;

      if v_status in ('draft', 'cancelled') then
        raise exception 'Cannot revert to draft or cancel a flight while active bookings or seat holds exist'
          using errcode = '23514';
      end if;
    end if;

    if v_existing.aircraft_id <> p_aircraft_id and exists (
      select 1 from public.seat_reservations sr where sr.flight_id = p_flight_id
    ) then
      raise exception 'Cannot change aircraft after seat reservations have been recorded for this flight'
        using errcode = '23514';
    end if;

    if p_publish or v_existing.published_at is not null then
      if v_status = 'draft' then
        v_status := 'scheduled';
      end if;
      v_published_at := coalesce(v_existing.published_at, clock_timestamp());
    else
      v_published_at := null;
    end if;

    if v_published_at is not null and v_template_seat_count = 0 then
      raise exception 'Cannot publish a flight whose aircraft has no active template seats'
        using errcode = '23514';
    end if;

    if v_existing.aircraft_id <> p_aircraft_id then
      delete from public.flight_seats where flight_id = p_flight_id;
    end if;

    update public.flight_instances
    set
      airline_id = p_airline_id,
      aircraft_id = p_aircraft_id,
      flight_number = v_flight_no,
      departure_airport_id = p_departure_airport_id,
      arrival_airport_id = p_arrival_airport_id,
      departure_at = p_departure_at,
      arrival_at = p_arrival_at,
      sales_close_at = v_sales_close,
      status = v_status,
      published_at = v_published_at
    where id = p_flight_id
    returning * into v_result;
  else
    if p_publish then
      if v_status = 'draft' then
        v_status := 'scheduled';
      end if;
      v_published_at := clock_timestamp();
    else
      if v_status <> 'draft' then
        v_published_at := clock_timestamp();
      else
        v_published_at := null;
      end if;
    end if;

    if v_published_at is not null and v_template_seat_count = 0 then
      raise exception 'Cannot publish a flight whose aircraft has no active template seats'
        using errcode = '23514';
    end if;

    insert into public.flight_instances (
      airline_id, aircraft_id, flight_number,
      departure_airport_id, arrival_airport_id,
      departure_at, arrival_at, sales_close_at,
      status, published_at
    )
    values (
      p_airline_id, p_aircraft_id, v_flight_no,
      p_departure_airport_id, p_arrival_airport_id,
      p_departure_at, p_arrival_at, v_sales_close,
      v_status, v_published_at
    )
    returning * into v_result;
  end if;

  -- Provision flight_seats snapshot from aircraft template seats if not already present
  if v_template_seat_count > 0 then
    insert into public.flight_seats (
      flight_id, seat_id, seat_code, row_number, column_number,
      cabin_class, position, is_exit_row, is_blocked, selection_fee_amount, currency
    )
    select
      v_result.id,
      s.id,
      s.seat_code,
      s.row_number,
      s.column_number,
      s.cabin_class,
      s.position,
      s.is_exit_row,
      false,
      case
        when s.cabin_class in ('first', 'business') then 0::bigint
        when s.cabin_class = 'premium_economy' then 60000::bigint
        when s.is_exit_row then 90000::bigint
        when s.position = 'window' then 50000::bigint
        when s.position = 'aisle' then 40000::bigint
        else 30000::bigint
      end,
      'VND'
    from public.seats s
    where s.aircraft_id = v_result.aircraft_id
      and s.is_active = true
    on conflict (flight_id, seat_id) do nothing;
  end if;

  perform private.write_admin_audit_log(
    case when p_flight_id is null then 'flight.create' else 'flight.update' end,
    'flight_instances',
    v_result.id,
    jsonb_build_object(
      'flight_number', v_result.flight_number,
      'aircraft_id', v_result.aircraft_id,
      'departure_at', v_result.departure_at,
      'arrival_at', v_result.arrival_at,
      'sales_close_at', v_result.sales_close_at,
      'status', v_result.status,
      'published', (v_result.published_at is not null),
      'before', case when p_flight_id is not null then to_jsonb(v_existing) else null end,
      'after', to_jsonb(v_result)
    )
  );

  return v_result;
end;
$$;

revoke all on function private.admin_save_flight_instance(
  uuid, uuid, uuid, text, uuid, uuid, timestamptz, timestamptz, timestamptz, public.flight_status, boolean
) from public, anon, authenticated;
grant execute on function private.admin_save_flight_instance(
  uuid, uuid, uuid, text, uuid, uuid, timestamptz, timestamptz, timestamptz, public.flight_status, boolean
) to authenticated;

create or replace function public.admin_save_flight_instance(
  p_flight_id uuid default null,
  p_airline_id uuid default null,
  p_aircraft_id uuid default null,
  p_flight_number text default null,
  p_departure_airport_id uuid default null,
  p_arrival_airport_id uuid default null,
  p_departure_at timestamptz default null,
  p_arrival_at timestamptz default null,
  p_sales_close_at timestamptz default null,
  p_status public.flight_status default 'draft',
  p_publish boolean default false
)
returns public.flight_instances
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.admin_save_flight_instance(
    p_flight_id, p_airline_id, p_aircraft_id, p_flight_number,
    p_departure_airport_id, p_arrival_airport_id,
    p_departure_at, p_arrival_at, p_sales_close_at, p_status, p_publish
  );
$$;

revoke all on function public.admin_save_flight_instance(
  uuid, uuid, uuid, text, uuid, uuid, timestamptz, timestamptz, timestamptz, public.flight_status, boolean
) from public, anon, authenticated;
grant execute on function public.admin_save_flight_instance(
  uuid, uuid, uuid, text, uuid, uuid, timestamptz, timestamptz, timestamptz, public.flight_status, boolean
) to authenticated;

-- 7. Admin RPC: Stop or reopen flight sales without hard-deleting referenced data
create or replace function private.admin_set_flight_sales(
  p_flight_id uuid,
  p_open_sales boolean,
  p_sales_close_at timestamptz default null
)
returns public.flight_instances
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_flight public.flight_instances;
  v_result public.flight_instances;
  v_new_close timestamptz;
begin
  perform private.require_admin();

  select * into v_flight
  from public.flight_instances
  where id = p_flight_id
  for update;

  if not found then
    raise exception 'Flight instance not found' using errcode = 'P0002';
  end if;

  if p_open_sales then
    if v_flight.status in ('cancelled', 'departed', 'arrived') then
      raise exception 'Cannot open sales for a cancelled, departed, or arrived flight'
        using errcode = '23514';
    end if;
    v_new_close := coalesce(p_sales_close_at, v_flight.departure_at - interval '60 minutes');
    if v_new_close > v_flight.departure_at or v_new_close <= clock_timestamp() then
      raise exception 'Reopened sales_close_at must be in the future and not after departure_at'
        using errcode = '23514';
    end if;
    update public.flight_instances
    set
      sales_close_at = v_new_close,
      status = case when status = 'draft' then 'scheduled'::public.flight_status else status end,
      published_at = coalesce(published_at, clock_timestamp())
    where id = p_flight_id
    returning * into v_result;
  else
    v_new_close := least(v_flight.departure_at, coalesce(p_sales_close_at, clock_timestamp()));
    update public.flight_instances
    set sales_close_at = v_new_close
    where id = p_flight_id
    returning * into v_result;
  end if;

  perform private.write_admin_audit_log(
    case when p_open_sales then 'flight.open_sales' else 'flight.close_sales' end,
    'flight_instances',
    v_result.id,
    jsonb_build_object(
      'open_sales', p_open_sales,
      'sales_close_at', v_result.sales_close_at,
      'status', v_result.status,
      'before', jsonb_build_object(
        'open_sales', (v_flight.published_at is not null and v_flight.sales_close_at > clock_timestamp()),
        'sales_close_at', v_flight.sales_close_at,
        'status', v_flight.status
      ),
      'after', jsonb_build_object(
        'open_sales', p_open_sales,
        'sales_close_at', v_result.sales_close_at,
        'status', v_result.status
      )
    )
  );

  return v_result;
end;
$$;

revoke all on function private.admin_set_flight_sales(uuid, boolean, timestamptz) from public, anon, authenticated;
grant execute on function private.admin_set_flight_sales(uuid, boolean, timestamptz) to authenticated;

create or replace function public.admin_set_flight_sales(
  p_flight_id uuid,
  p_open_sales boolean,
  p_sales_close_at timestamptz default null
)
returns public.flight_instances
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.admin_set_flight_sales(p_flight_id, p_open_sales, p_sales_close_at);
$$;

revoke all on function public.admin_set_flight_sales(uuid, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_set_flight_sales(uuid, boolean, timestamptz) to authenticated;

-- 8. Admin RPC: Block/unblock a flight seat or update its selection fee
create or replace function private.admin_update_flight_seat(
  p_flight_seat_id uuid,
  p_is_blocked boolean default null,
  p_selection_fee_amount bigint default null
)
returns public.flight_seats
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_seat public.flight_seats;
  v_result public.flight_seats;
begin
  perform private.require_admin();

  select * into v_seat
  from public.flight_seats
  where id = p_flight_seat_id
  for update;

  if not found then
    raise exception 'Flight seat not found' using errcode = 'P0002';
  end if;

  if coalesce(p_is_blocked, v_seat.is_blocked) = true and exists (
    select 1
    from public.seat_reservations r
    where r.flight_seat_id = p_flight_seat_id
      and (
        r.status = 'confirmed'
        or (r.status = 'held' and r.expires_at > clock_timestamp())
      )
  ) then
    raise exception 'Cannot block a flight seat that is currently held or booked'
      using errcode = '23514';
  end if;

  if p_selection_fee_amount is not null and p_selection_fee_amount < 0 then
    raise exception 'Seat selection fee cannot be negative' using errcode = '23514';
  end if;

  update public.flight_seats
  set
    is_blocked = coalesce(p_is_blocked, is_blocked),
    selection_fee_amount = coalesce(p_selection_fee_amount, selection_fee_amount)
  where id = p_flight_seat_id
  returning * into v_result;

  perform private.write_admin_audit_log(
    'flight_seat.update',
    'flight_seats',
    v_result.id,
    jsonb_build_object(
      'flight_id', v_result.flight_id,
      'seat_code', v_result.seat_code,
      'is_blocked', v_result.is_blocked,
      'selection_fee_amount', v_result.selection_fee_amount,
      'before', jsonb_build_object(
        'seat_code', v_seat.seat_code,
        'is_blocked', v_seat.is_blocked,
        'selection_fee_amount', v_seat.selection_fee_amount
      ),
      'after', jsonb_build_object(
        'seat_code', v_result.seat_code,
        'is_blocked', v_result.is_blocked,
        'selection_fee_amount', v_result.selection_fee_amount
      )
    )
  );

  return v_result;
end;
$$;

revoke all on function private.admin_update_flight_seat(uuid, boolean, bigint) from public, anon, authenticated;
grant execute on function private.admin_update_flight_seat(uuid, boolean, bigint) to authenticated;

create or replace function public.admin_update_flight_seat(
  p_flight_seat_id uuid,
  p_is_blocked boolean default null,
  p_selection_fee_amount bigint default null
)
returns public.flight_seats
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.admin_update_flight_seat(p_flight_seat_id, p_is_blocked, p_selection_fee_amount);
$$;

revoke all on function public.admin_update_flight_seat(uuid, boolean, bigint) from public, anon, authenticated;
grant execute on function public.admin_update_flight_seat(uuid, boolean, bigint) to authenticated;

-- 9. Admin RPC: Create or update flight fare (never hard-deletes referenced fares)
create or replace function private.admin_save_flight_fare(
  p_fare_id uuid default null,
  p_flight_id uuid default null,
  p_fare_code text default null,
  p_cabin_class public.cabin_class default null,
  p_name text default null,
  p_adult_base_amount bigint default null,
  p_child_base_amount bigint default null,
  p_infant_base_amount bigint default null,
  p_adult_tax_amount bigint default 0,
  p_child_tax_amount bigint default 0,
  p_infant_tax_amount bigint default 0,
  p_adult_fee_amount bigint default 0,
  p_child_fee_amount bigint default 0,
  p_infant_fee_amount bigint default 0,
  p_baggage_allowance jsonb default '{"cabin_pieces":1,"cabin_kg":7,"checked_pieces":0,"checked_kg":0}'::jsonb,
  p_cancellation_allowed boolean default false,
  p_cancellation_cutoff_minutes integer default 60,
  p_cancellation_fee_amount bigint default 0,
  p_is_active boolean default true
)
returns public.flight_fares
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_flight public.flight_instances;
  v_existing public.flight_fares;
  v_result public.flight_fares;
  v_code text := upper(btrim(coalesce(p_fare_code, '')));
  v_name text := btrim(coalesce(p_name, ''));
begin
  perform private.require_admin();

  if p_flight_id is null or p_cabin_class is null
     or p_adult_base_amount is null or p_child_base_amount is null or p_infant_base_amount is null then
    raise exception 'Missing required fare fields' using errcode = '23514';
  end if;

  if length(v_code) = 0 or length(v_name) = 0 then
    raise exception 'Fare code and name are required' using errcode = '23514';
  end if;

  select * into v_flight
  from public.flight_instances
  where id = p_flight_id;

  if not found then
    raise exception 'Flight instance not found' using errcode = 'P0002';
  end if;

  if p_fare_id is not null then
    select * into v_existing
    from public.flight_fares
    where id = p_fare_id
    for update;

    if not found then
      raise exception 'Flight fare not found' using errcode = 'P0002';
    end if;

    if v_existing.flight_id <> p_flight_id then
      raise exception 'Fare does not belong to the specified flight' using errcode = '23514';
    end if;

    if (v_existing.cabin_class <> p_cabin_class or v_existing.fare_code <> v_code)
       and exists (select 1 from public.booking_segments bs where bs.fare_id = p_fare_id) then
      raise exception 'Cannot change fare_code or cabin_class of a fare already referenced by bookings'
        using errcode = '23514';
    end if;

    update public.flight_fares
    set
      fare_code = v_code,
      cabin_class = p_cabin_class,
      name = v_name,
      adult_base_amount = p_adult_base_amount,
      child_base_amount = p_child_base_amount,
      infant_base_amount = p_infant_base_amount,
      adult_tax_amount = coalesce(p_adult_tax_amount, 0),
      child_tax_amount = coalesce(p_child_tax_amount, 0),
      infant_tax_amount = coalesce(p_infant_tax_amount, 0),
      adult_fee_amount = coalesce(p_adult_fee_amount, 0),
      child_fee_amount = coalesce(p_child_fee_amount, 0),
      infant_fee_amount = coalesce(p_infant_fee_amount, 0),
      baggage_allowance = coalesce(
        p_baggage_allowance,
        '{"cabin_pieces":1,"cabin_kg":7,"checked_pieces":0,"checked_kg":0}'::jsonb
      ),
      cancellation_allowed = coalesce(p_cancellation_allowed, false),
      cancellation_cutoff_minutes = coalesce(p_cancellation_cutoff_minutes, 60),
      cancellation_fee_amount = coalesce(p_cancellation_fee_amount, 0),
      is_active = coalesce(p_is_active, true)
    where id = p_fare_id
    returning * into v_result;
  else
    insert into public.flight_fares (
      flight_id, fare_code, cabin_class, name,
      adult_base_amount, child_base_amount, infant_base_amount,
      adult_tax_amount, child_tax_amount, infant_tax_amount,
      adult_fee_amount, child_fee_amount, infant_fee_amount,
      currency, baggage_allowance,
      cancellation_allowed, cancellation_cutoff_minutes, cancellation_fee_amount,
      is_active
    )
    values (
      p_flight_id, v_code, p_cabin_class, v_name,
      p_adult_base_amount, p_child_base_amount, p_infant_base_amount,
      coalesce(p_adult_tax_amount, 0), coalesce(p_child_tax_amount, 0), coalesce(p_infant_tax_amount, 0),
      coalesce(p_adult_fee_amount, 0), coalesce(p_child_fee_amount, 0), coalesce(p_infant_fee_amount, 0),
      'VND',
      coalesce(
        p_baggage_allowance,
        '{"cabin_pieces":1,"cabin_kg":7,"checked_pieces":0,"checked_kg":0}'::jsonb
      ),
      coalesce(p_cancellation_allowed, false),
      coalesce(p_cancellation_cutoff_minutes, 60),
      coalesce(p_cancellation_fee_amount, 0),
      coalesce(p_is_active, true)
    )
    returning * into v_result;
  end if;

  perform private.write_admin_audit_log(
    case when p_fare_id is null then 'fare.create' else 'fare.update' end,
    'flight_fares',
    v_result.id,
    jsonb_build_object(
      'flight_id', v_result.flight_id,
      'fare_code', v_result.fare_code,
      'cabin_class', v_result.cabin_class,
      'adult_base_amount', v_result.adult_base_amount,
      'is_active', v_result.is_active,
      'before', case when p_fare_id is not null then to_jsonb(v_existing) else null end,
      'after', to_jsonb(v_result)
    )
  );

  return v_result;
end;
$$;

revoke all on function private.admin_save_flight_fare(
  uuid, uuid, text, public.cabin_class, text,
  bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  jsonb, boolean, integer, bigint, boolean
) from public, anon, authenticated;
grant execute on function private.admin_save_flight_fare(
  uuid, uuid, text, public.cabin_class, text,
  bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  jsonb, boolean, integer, bigint, boolean
) to authenticated;

create or replace function public.admin_save_flight_fare(
  p_fare_id uuid default null,
  p_flight_id uuid default null,
  p_fare_code text default null,
  p_cabin_class public.cabin_class default null,
  p_name text default null,
  p_adult_base_amount bigint default null,
  p_child_base_amount bigint default null,
  p_infant_base_amount bigint default null,
  p_adult_tax_amount bigint default 0,
  p_child_tax_amount bigint default 0,
  p_infant_tax_amount bigint default 0,
  p_adult_fee_amount bigint default 0,
  p_child_fee_amount bigint default 0,
  p_infant_fee_amount bigint default 0,
  p_baggage_allowance jsonb default '{"cabin_pieces":1,"cabin_kg":7,"checked_pieces":0,"checked_kg":0}'::jsonb,
  p_cancellation_allowed boolean default false,
  p_cancellation_cutoff_minutes integer default 60,
  p_cancellation_fee_amount bigint default 0,
  p_is_active boolean default true
)
returns public.flight_fares
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.admin_save_flight_fare(
    p_fare_id, p_flight_id, p_fare_code, p_cabin_class, p_name,
    p_adult_base_amount, p_child_base_amount, p_infant_base_amount,
    p_adult_tax_amount, p_child_tax_amount, p_infant_tax_amount,
    p_adult_fee_amount, p_child_fee_amount, p_infant_fee_amount,
    p_baggage_allowance, p_cancellation_allowed, p_cancellation_cutoff_minutes,
    p_cancellation_fee_amount, p_is_active
  );
$$;

revoke all on function public.admin_save_flight_fare(
  uuid, uuid, text, public.cabin_class, text,
  bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  jsonb, boolean, integer, bigint, boolean
) from public, anon, authenticated;
grant execute on function public.admin_save_flight_fare(
  uuid, uuid, text, public.cabin_class, text,
  bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  jsonb, boolean, integer, bigint, boolean
) to authenticated;

notify pgrst, 'reload schema';
commit;

