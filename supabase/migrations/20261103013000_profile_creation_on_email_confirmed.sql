-- Migration: Create public.profiles only after email confirmation (TV3 & Auth)
-- Prevents unconfirmed or abandoned registrations from polluting public.profiles and Admin lists.

begin;

-- 1. Update trigger function to only insert into public.profiles if email is confirmed
create or replace function private.create_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text;
begin
  -- Do not create a public.profiles entry if email confirmation is still pending
  if new.email_confirmed_at is null and new.confirmed_at is null then
    return new;
  end if;

  if jsonb_typeof(new.raw_user_meta_data->'full_name') = 'string' then
    display_name := btrim(left(btrim(new.raw_user_meta_data->>'full_name'), 100));
  end if;
  if display_name is null or length(display_name) < 2 then
    display_name := 'Traveler';
  end if;

  insert into public.profiles (id, full_name)
  values (new.id, display_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.create_auth_profile() from public, anon, authenticated;

-- 2. Trigger on both insert and confirmation update
drop trigger if exists flight_create_auth_profile on auth.users;

create trigger flight_create_auth_profile
  after insert or update of email_confirmed_at, confirmed_at on auth.users
  for each row
  execute function private.create_auth_profile();

-- 3. Clean up unconfirmed profiles that have no associated bookings
delete from public.profiles
where id in (
  select u.id from auth.users u
  where u.email_confirmed_at is null
    and u.confirmed_at is null
)
and id not in (
  select user_id from public.bookings
);

commit;

