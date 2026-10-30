-- Migration: Expose is_admin RPC in public schema for client-side authorization checks
-- Securely delegates to private.is_admin() without exposing the private.user_roles table directly.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin();
$$;

comment on function public.is_admin() is 'Returns true if the current authenticated caller has the admin role in private.user_roles.';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

