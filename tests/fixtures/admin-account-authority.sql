-- Run only in a rollback transaction as postgres after the account migration.
-- These are disposable auth fixtures; no existing account is granted/revoked/banned.
begin;
set local statement_timeout='30s';
do $access_test$
declare admin_id uuid:=gen_random_uuid();customer_id uuid:=gen_random_uuid();second_id uuid:=gen_random_uuid();op uuid;n integer;begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,created_at,updated_at)
 values(admin_id,'access-admin-'||admin_id||'@example.invalid',now(),'{"full_name":"Fixture Admin"}',now(),now()),
 (customer_id,'access-customer-'||customer_id||'@example.invalid',now(),'{"full_name":"Fixture Customer","role":"admin"}',now(),now()),
 (second_id,'access-second-'||second_id||'@example.invalid',now(),'{"full_name":"Fixture Second"}',now(),now());
 insert into private.user_roles(user_id,role) values(admin_id,'admin');
 perform set_config('request.jwt.claim.sub',customer_id::text,true);
 if public.is_admin() then raise exception 'user_metadata escalated privileges';end if;
 begin perform public.admin_list_accounts();raise exception 'ordinary user directory accepted';exception when insufficient_privilege then null;end;
 begin perform public.admin_set_account_role(customer_id,'admin');raise exception 'ordinary user grant accepted';exception when insufficient_privilege then null;end;
 if has_function_privilege('authenticated','public.admin_finish_suspension(uuid,uuid)','execute') then raise exception 'client can finalize Auth operation';end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 if not exists(select 1 from public.admin_list_accounts(200,0) where id=customer_id and email='access-customer-'||customer_id||'@example.invalid' and role='customer') then
  -- Directory uses stable UUID paging; use private auth fixture join instead if real users exceed first page.
  select count(*) into n from auth.users where id<customer_id and deleted_at is null;
  if not exists(select 1 from public.admin_list_accounts(200,(n/200)*200) where id=customer_id and email='access-customer-'||customer_id||'@example.invalid' and role='customer') then raise exception 'directory email/role mismatch';end if;
 end if;
 begin perform public.admin_set_account_role(admin_id,'customer');raise exception 'self/last admin revoke accepted';exception when insufficient_privilege then null;end;
 begin perform public.admin_prepare_suspension(admin_id,true);raise exception 'self/last admin suspend accepted';exception when insufficient_privilege then null;end;
 perform public.admin_set_account_role(second_id,'admin');
 perform public.admin_set_account_role(second_id,'admin');
 select count(*) into n from private.admin_audit_logs where entity_id=second_id and action='role.grant';if n<>1 then raise exception 'idempotent grant audit mismatch';end if;
 perform set_config('request.jwt.claim.sub',second_id::text,true);if not public.is_admin() then raise exception 'grant not authoritative';end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);perform public.admin_set_account_role(second_id,'customer');
 perform set_config('request.jwt.claim.sub',second_id::text,true);if public.is_admin() then raise exception 'revoked role retained authority';end if;
 begin perform public.admin_list_accounts();raise exception 'revoked admin directory accepted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);op:=public.admin_prepare_suspension(customer_id,true);
 if private.account_is_active(customer_id) then raise exception 'prepare did not block account';end if;
 if public.admin_prepare_suspension(customer_id,true)<>op then raise exception 'pending retry is not idempotent';end if;
 begin perform public.admin_finish_suspension(customer_id,op);raise exception 'unconfirmed Auth status accepted';exception when others then if sqlerrm<>'Auth account status is not confirmed' then raise;end if;end;
 update auth.users set banned_until=now()+interval '100 years' where id=customer_id;
 perform public.admin_finish_suspension(customer_id,op);
 perform set_config('request.jwt.claim.sub',customer_id::text,true);
 begin perform public.get_payment_state(gen_random_uuid());raise exception 'suspended owner RPC accepted';exception when insufficient_privilege then null;end;
 execute 'set local role authenticated';
 select count(*) into n from public.profiles where id=customer_id;
 execute 'reset role';
 if n<>0 then raise exception 'suspended JWT retained profile RLS access';end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 begin update auth.users set banned_until=null where id=customer_id;raise exception 'stale unban accepted';exception when others then if sqlerrm<>'Account suspension must be reactivated through the admin workflow' then raise;end if;end;
 op:=public.admin_prepare_suspension(customer_id,false);
 if private.account_is_active(customer_id) then raise exception 'reactivation enabled access before Auth confirmation';end if;
 update auth.users set banned_until=null where id=customer_id;
 perform public.admin_finish_suspension(customer_id,op);
 if not private.account_is_active(customer_id) then raise exception 'reactivated account blocked';end if;
 select count(*) into n from private.admin_audit_logs where entity_id=customer_id and action in ('role.suspend','role.reactivate');
 if n<>2 then raise exception 'suspension audit mismatch';end if;
 raise notice 'Account authority rollback fixtures passed';
end $access_test$;
rollback;
