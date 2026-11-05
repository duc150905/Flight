begin;

-- Forward replacements retain the existing admin checks, audit log and inventory guards.
-- Inactive historical seats may share geometry with the current active template.
alter table public.seats drop constraint seats_aircraft_id_row_number_column_number_key;
create unique index seats_active_layout_key on public.seats(aircraft_id,row_number,column_number) where is_active;

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

  -- Treat the payload as a complete replacement, preserving persistent seat IDs.
  if exists (
    select 1 from jsonb_array_elements(p_seats) item
    group by upper(btrim(coalesce(item->>'seat_code', '')))
    having count(*) > 1
  ) then
    raise exception 'Seat template contains duplicate seat codes' using errcode = '23514';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_seats) item
    where coalesce((item->>'is_active')::boolean, true)
    group by (item->>'row_number')::smallint, (item->>'column_number')::smallint
    having count(*) > 1
  ) then
    raise exception 'Seat template contains duplicate active seat positions' using errcode = '23514';
  end if;

  -- Deactivate atomically first so retained seats can safely swap geometry/cabins.
  -- The aircraft lock and existing inventory/publication guard protect all callers.
  update public.seats set is_active = false where aircraft_id = p_aircraft_id and is_active;

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

    if v_has_active_orders and not coalesce(p_publish, false) then
      raise exception 'Cannot unpublish a flight with active bookings or seat holds' using errcode = '23514';
    end if;

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

    if not coalesce(p_publish, false) and v_status in ('departed', 'arrived') then
      raise exception 'Cannot unpublish a departed or arrived flight' using errcode = '23514';
    end if;
    if p_publish and v_status = 'cancelled' then
      raise exception 'Cannot publish a cancelled flight' using errcode = '23514';
    end if;

    if coalesce(p_publish, false) then
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
    if not coalesce(p_publish, false) and v_status in ('departed', 'arrived') then
      raise exception 'Cannot create an unpublished departed or arrived flight' using errcode = '23514';
    end if;
    if p_publish and v_status = 'cancelled' then
      raise exception 'Cannot publish a cancelled flight' using errcode = '23514';
    end if;
    if coalesce(p_publish, false) then
      if v_status = 'draft' then
        v_status := 'scheduled';
      end if;
      v_published_at := clock_timestamp();
    else
      v_published_at := null;
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

  -- An aircraft change must not leave already active fares pointing at absent cabins.
  if exists (
    select 1 from public.flight_fares fare
    where fare.flight_id = v_result.id and fare.is_active
      and not exists (select 1 from public.flight_seats fs
        where fs.flight_id = v_result.id and fs.cabin_class = fare.cabin_class and not fs.is_blocked)
  ) then
    raise exception 'Active fares require unblocked seat inventory in their cabin' using errcode = '23514';
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
  where id = p_flight_id
  for update;

  if not found then
    raise exception 'Flight instance not found' using errcode = 'P0002';
  end if;

  if coalesce(p_is_active, true) and not exists (
    select 1 from public.flight_seats fs
    where fs.flight_id = p_flight_id and fs.cabin_class = p_cabin_class and not fs.is_blocked
  ) then
    raise exception 'Active fare requires unblocked seat inventory in its cabin' using errcode = '23514';
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

-- Direct catalogue writes are still subject to their existing admin RLS policies.
-- These triggers make the supported checkout/media contracts authoritative for every client.
create or replace function private.enforce_checkout_catalogue_capability()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- An idempotent seed/no-op update does not author or activate a service.
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'updated_at') is not distinct from (to_jsonb(old) - 'updated_at') then
    return new;
  end if;
  if tg_table_name = 'addon_products' then
    -- Retain inactive reference products for fresh seeds; unsupported services cannot be edited or activated.
    if tg_op = 'INSERT' and new.category <> 'baggage' and not new.is_active then return new; end if;
    if new.category <> 'baggage' or (tg_op = 'UPDATE' and old.category <> 'baggage') then
      raise exception 'Meals and insurance are read-only: checkout currently supports baggage only' using errcode = '23514';
    end if;
  else
    if new.max_quantity_per_passenger <> 1 then
      raise exception 'Checkout supports one baggage choice per passenger per leg; max quantity must be 1' using errcode = '23514';
    end if;
    if not exists (select 1 from public.addon_products p where p.id = new.product_id and p.category = 'baggage')
       or (tg_op = 'UPDATE' and not exists (select 1 from public.addon_products p where p.id = old.product_id and p.category = 'baggage')) then
      raise exception 'Meals and insurance offers are read-only: checkout currently supports baggage only' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.enforce_checkout_catalogue_capability() from public, anon, authenticated;
create trigger enforce_checkout_product_capability before insert or update on public.addon_products
  for each row execute function private.enforce_checkout_catalogue_capability();
create trigger enforce_checkout_offer_capability before insert or update on public.flight_addon_offers
  for each row execute function private.enforce_checkout_catalogue_capability();

create or replace function private.enforce_catalogue_media()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare value text;
begin
  if tg_table_name = 'airlines' then
    if tg_op = 'UPDATE' and new.logo_path is not distinct from old.logo_path then return new; end if;
    value := nullif(btrim(new.logo_path), '');
    if value is not null and value !~* '^https://[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' then
      raise exception 'Use an HTTPS logo URL; legacy relative airline paths display the initial only' using errcode = '23514';
    end if;
    new.logo_path := value;
  else
    if tg_op = 'UPDATE' and new.image_path is not distinct from old.image_path then return new; end if;
    value := nullif(btrim(new.image_path), '');
    if value is not null and value !~* '^https://[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
      and value not in (
        'destinations/han.jpg','destinations/ha-noi.jpg','destinations/dad.jpg','destinations/da-nang.jpg',
        'destinations/pqc.jpg','destinations/phu-quoc.jpg','destinations/cxr.jpg','destinations/nha-trang.jpg',
        'destinations/dli.jpg','destinations/da-lat.jpg','destinations/hui.jpg','destinations/hue.jpg',
        'destinations/sin.jpg','destinations/singapore.jpg','destinations/bkk.jpg','destinations/bangkok.jpg'
      ) then
      raise exception 'Use an HTTPS image URL or a known bundled destination path such as destinations/da-nang.jpg' using errcode = '23514';
    end if;
    new.image_path := value;
  end if;
  return new;
end $$;
revoke all on function private.enforce_catalogue_media() from public, anon, authenticated;
create trigger enforce_airline_logo before insert or update of logo_path on public.airlines
  for each row execute function private.enforce_catalogue_media();
create trigger enforce_destination_image before insert or update of image_path on public.destinations
  for each row execute function private.enforce_catalogue_media();

create or replace function private.guard_last_unblocked_fare_seat()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- Serialize seat blocking with fare activation and flight/aircraft changes.
  perform 1 from public.flight_instances f where f.id = old.flight_id for update;
  if not old.is_blocked and new.is_blocked
    and exists (select 1 from public.flight_fares fare where fare.flight_id=old.flight_id and fare.cabin_class=old.cabin_class and fare.is_active)
    and not exists (select 1 from public.flight_seats fs where fs.flight_id=old.flight_id and fs.cabin_class=old.cabin_class and not fs.is_blocked and fs.id<>old.id)
  then
    raise exception 'Deactivate fares before blocking the last unblocked seat in this cabin' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.guard_last_unblocked_fare_seat() from public, anon, authenticated;
create trigger guard_last_unblocked_fare_seat before update of is_blocked on public.flight_seats
  for each row execute function private.guard_last_unblocked_fare_seat();

commit;
