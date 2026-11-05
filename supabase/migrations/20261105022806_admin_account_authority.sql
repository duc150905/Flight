begin;
set local lock_timeout='10s';
set local statement_timeout='60s';

create table private.account_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 suspended boolean not null default false,
 operation_id uuid,
 desired_suspended boolean,
 operation_actor uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 check ((operation_id is null) = (desired_suspended is null))
);
alter table private.account_access enable row level security;
revoke all on private.account_access from public,anon,authenticated;

create function private.account_is_active(p_user_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=p_user_id and u.deleted_at is null
   and (u.banned_until is null or u.banned_until<=now())
   and not exists(select 1 from private.account_access a where a.user_id=u.id and a.suspended))
$$;
revoke all on function private.account_is_active(uuid) from public,anon,authenticated;
grant execute on function private.account_is_active(uuid) to authenticated;
create function private.require_active_account(p_user_id uuid default auth.uid()) returns void
language plpgsql stable security definer set search_path='' as $$ begin
 if not private.account_is_active(p_user_id) then raise exception 'Account access denied' using errcode='42501';end if;
end $$;
revoke all on function private.require_active_account(uuid) from public,anon,authenticated;
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select private.account_is_active(auth.uid()) and exists(select 1 from private.user_roles r where r.user_id=auth.uid() and r.role='admin')
$$;

-- Restrictive policies compose with existing owner/admin policies, including stale JWTs.
do $policies$ declare t record;begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity loop
  execute format('create policy account_active_gate on public.%I as restrictive for all to authenticated using ((select private.account_is_active())) with check ((select private.account_is_active()))',t.relname);
 end loop;
end $policies$;

-- SECURITY DEFINER owner APIs bypass RLS, so gate entry functions as well.
do $owner_functions$ declare r record;definition text;expected text;begin
 foreach expected in array array['quote_checkout','create_booking','get_pending_booking','find_booking_request','get_payment_state','get_mock_payment_state','start_mock_payment','resolve_mock_payment','cancel_booking','refund_mock_booking','begin_vnpay_payment','claim_vnpay_sync','claim_vnpay_refund'] loop
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='private' and p.proname=expected and l.lanname='plpgsql') then raise exception 'Expected PL/pgSQL owner API missing: %',expected;end if;
 end loop;
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'
 and p.proname=any(array['quote_checkout','create_booking','get_pending_booking','find_booking_request','get_payment_state','get_mock_payment_state','start_mock_payment','resolve_mock_payment','cancel_booking','refund_mock_booking']) loop
  definition:=pg_get_functiondef(r.oid);
  definition:=regexp_replace(definition,'\m[Bb][Ee][Gg][Ii][Nn]\M','begin perform private.require_active_account();');
  if position('perform private.require_active_account' in definition)=0 then raise exception 'Owner account guard was not injected';end if;
  execute definition;
 end loop;
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'
 and p.proname=any(array['begin_vnpay_payment','claim_vnpay_sync','claim_vnpay_refund']) loop
  definition:=pg_get_functiondef(r.oid);
  definition:=regexp_replace(definition,'\m[Bb][Ee][Gg][Ii][Nn]\M','begin if p_owner_id is not null then perform private.require_active_account(p_owner_id); end if;');
  if position('perform private.require_active_account' in definition)=0 then raise exception 'Owner account guard was not injected';end if;
  execute definition;
 end loop;
end $owner_functions$;

create function private.admin_list_accounts(p_limit integer default 200,p_offset integer default 0)
returns table(id uuid,email text,full_name text,phone text,role text,suspended boolean,created_at timestamptz,pending_suspended boolean)
language plpgsql stable security definer set search_path='' as $$ begin
 perform private.require_admin();
 return query select u.id,u.email::text,p.full_name,coalesce(p.contact_phone,u.phone)::text,
 case when r.user_id is null then 'customer' else 'admin' end,
 coalesce(a.suspended,false) or coalesce(u.banned_until>now(),false),u.created_at,a.desired_suspended
 from auth.users u left join public.profiles p on p.id=u.id left join private.user_roles r on r.user_id=u.id and r.role='admin'
 left join private.account_access a on a.user_id=u.id where u.deleted_at is null
 order by u.id limit greatest(1,least(coalesce(p_limit,200),200)) offset greatest(0,coalesce(p_offset,0));
end $$;
create function public.admin_list_accounts(p_limit integer default 200,p_offset integer default 0)
returns table(id uuid,email text,full_name text,phone text,role text,suspended boolean,created_at timestamptz,pending_suspended boolean)
language sql stable security invoker set search_path='' as $$ select * from private.admin_list_accounts(p_limit,p_offset) $$;
revoke all on function private.admin_list_accounts(integer,integer),public.admin_list_accounts(integer,integer) from public,anon,authenticated;
grant execute on function private.admin_list_accounts(integer,integer),public.admin_list_accounts(integer,integer) to authenticated;

create function private.admin_set_account_role(p_user_id uuid,p_role text) returns void
language plpgsql security definer set search_path='' as $$ declare actor uuid;old_admin boolean;begin
 perform pg_advisory_xact_lock(hashtextextended('admin-account-authority',0));
 actor:=private.require_admin();
 if p_role is null or p_role not in ('admin','customer') then raise exception 'Invalid role';end if;
 if not exists(select 1 from auth.users where id=p_user_id and deleted_at is null) then raise exception 'Account not found';end if;
 old_admin:=exists(select 1 from private.user_roles where user_id=p_user_id);
 if p_role='customer' and old_admin then
  if p_user_id=actor then raise exception 'Self revocation is not allowed' using errcode='42501';end if;
  if (select count(*) from private.user_roles where private.account_is_active(user_id))<=1 and private.account_is_active(p_user_id) then raise exception 'Last active administrator is protected';end if;
  delete from private.user_roles where user_id=p_user_id;
 elsif p_role='admin' and not old_admin then
  perform private.require_active_account(p_user_id);
  insert into private.user_roles(user_id,role,granted_by) values(p_user_id,'admin',actor);
 else return;
 end if;
 perform private.write_admin_audit_log(case when p_role='admin' then 'role.grant' else 'role.revoke' end,'user_roles',p_user_id,jsonb_build_object('role',p_role));
end $$;
create function public.admin_set_account_role(p_user_id uuid,p_role text) returns void language sql security invoker set search_path='' as $$ select private.admin_set_account_role(p_user_id,p_role) $$;
revoke all on function private.admin_set_account_role(uuid,text),public.admin_set_account_role(uuid,text) from public,anon,authenticated;
grant execute on function private.admin_set_account_role(uuid,text),public.admin_set_account_role(uuid,text) to authenticated;

-- Preparation commits denial before the external Auth request. An unfinished operation
-- is retried with the same desired state; an opposite request must wait for completion.
create function private.admin_prepare_suspension(p_user_id uuid,p_suspended boolean) returns uuid
language plpgsql security definer set search_path='' as $$ declare actor uuid;a private.account_access%rowtype;op uuid;begin
 perform pg_advisory_xact_lock(hashtextextended('admin-account-authority',0));actor:=private.require_admin();
 if p_suspended is null then raise exception 'Status is required';end if;
 if p_user_id=actor then raise exception 'Self suspension is not allowed' using errcode='42501';end if;
 if not exists(select 1 from auth.users where id=p_user_id and deleted_at is null) then raise exception 'Account not found';end if;
 select * into a from private.account_access where user_id=p_user_id for update;
 if a.operation_id is not null then
  if a.desired_suspended<>p_suspended then raise exception 'Reconcile the pending account operation before changing its status';end if;
  return a.operation_id;
 end if;
 if p_suspended and exists(select 1 from private.user_roles where user_id=p_user_id) and private.account_is_active(p_user_id)
 and (select count(*) from private.user_roles where private.account_is_active(user_id))<=1 then raise exception 'Last active administrator is protected';end if;
 op:=gen_random_uuid();
 insert into private.account_access(user_id,suspended,operation_id,desired_suspended,operation_actor) values(p_user_id,true,op,p_suspended,actor)
 on conflict(user_id) do update set suspended=true,operation_id=op,desired_suspended=p_suspended,operation_actor=actor,updated_at=now();
 perform private.write_admin_audit_log('account.status_requested','account_access',p_user_id,jsonb_build_object('suspended',p_suspended,'operation_id',op));
 return op;
end $$;
create function public.admin_prepare_suspension(p_user_id uuid,p_suspended boolean) returns uuid language sql security invoker set search_path='' as $$select private.admin_prepare_suspension(p_user_id,p_suspended)$$;
revoke all on function private.admin_prepare_suspension(uuid,boolean),public.admin_prepare_suspension(uuid,boolean) from public,anon,authenticated;
grant execute on function private.admin_prepare_suspension(uuid,boolean),public.admin_prepare_suspension(uuid,boolean) to authenticated;

-- Only the server credential can confirm successful Auth administration.
create function private.admin_finish_suspension(p_user_id uuid,p_operation_id uuid) returns void
language plpgsql security definer set search_path='' as $$ declare a private.account_access%rowtype;begin
 perform pg_advisory_xact_lock(hashtextextended('admin-account-authority',0));
 select * into a from private.account_access where user_id=p_user_id for update;
 if a.operation_id is distinct from p_operation_id then raise exception 'Account operation no longer current';end if;
 if a.desired_suspended is null then raise exception 'Account operation missing';end if;
 if not exists(select 1 from auth.users u where u.id=p_user_id and (coalesce(u.banned_until>now(),false)=a.desired_suspended)) then raise exception 'Auth account status is not confirmed';end if;
 update private.account_access set suspended=a.desired_suspended,operation_id=null,desired_suspended=null,operation_actor=null,updated_at=now() where user_id=p_user_id;
 insert into private.admin_audit_logs(actor_user_id,action,entity_type,entity_id,safe_changes)
 values(a.operation_actor,case when a.desired_suspended then 'role.suspend' else 'role.reactivate' end,'account_access',p_user_id,jsonb_build_object('suspended',a.desired_suspended,'operation_id',p_operation_id));
end $$;
create function public.admin_finish_suspension(p_user_id uuid,p_operation_id uuid) returns void language sql security invoker set search_path='' as $$select private.admin_finish_suspension(p_user_id,p_operation_id)$$;
revoke all on function private.admin_finish_suspension(uuid,uuid),public.admin_finish_suspension(uuid,uuid) from public,anon,authenticated;
grant execute on function private.admin_finish_suspension(uuid,uuid),public.admin_finish_suspension(uuid,uuid) to service_role;

-- Reject a delayed old unban after a newer suspension request.
create function private.guard_account_unban() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (new.banned_until is null or new.banned_until<=now()) and exists(select 1 from private.account_access a where a.user_id=new.id and a.suspended and a.desired_suspended is distinct from false) then
  raise exception 'Account suspension must be reactivated through the admin workflow';
 end if;return new;
end$$;
revoke all on function private.guard_account_unban() from public,anon,authenticated;
create trigger guard_account_unban before update of banned_until on auth.users for each row execute function private.guard_account_unban();
notify pgrst,'reload schema';
commit;
