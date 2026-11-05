-- Isolated rollback-only fixture; never calls a payment/refund gateway or edits existing orders.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000093','reconciliation-admin@example.invalid','{}'),
 ('00000000-0000-4000-8000-000000000094','reconciliation-customer@example.invalid','{}');
insert into private.user_roles(user_id,role) values ('00000000-0000-4000-8000-000000000093','admin');
create function pg_temp.recon_assert(ok boolean,message text) returns void language plpgsql as $$begin
 if ok is distinct from true then raise exception 'Reconciliation assertion: %',message;end if;
end $$;
create function pg_temp.recon_denied(command text) returns void language plpgsql as $$begin
 begin execute command; exception when insufficient_privilege then return; end;
 raise exception 'Reconciliation read unexpectedly authorized';
end $$;
create temporary table recon_fixture(id uuid primary key, ordinal integer);
with fixture_booking as (
 insert into public.bookings(user_id,booking_code,create_request_id,create_request_hash,trip_type,contact_name,contact_email,contact_phone,
  base_amount,tax_amount,fee_amount,seat_amount,addon_amount,total_amount,refund_policy_snapshot,expires_at)
 values('00000000-0000-4000-8000-000000000094','RECONROLLBACK121',gen_random_uuid(),'fixture','one_way','Reconciliation fixture','fixture@example.invalid','0901234567',100,0,0,0,0,100,'{}',now()+interval '1 day') returning id
), inserted as (
 insert into public.payments(booking_id,idempotency_key,request_hash,booking_version,amount,provider,status,paid_at,created_at,provider_reference)
 select b.id,gen_random_uuid(),'recon-fixture-'||n,1,100,'vnpay_sandbox',case when n=1 then 'succeeded'::public.payment_status when n=121 then 'pending'::public.payment_status else 'failed'::public.payment_status end,
  case when n=1 then '2026-11-04T05:00:00Z'::timestamptz end,'2026-09-01T00:00:00Z'::timestamptz+n*interval '1 second','RECON-CAPTURE-'||n
 from fixture_booking b cross join generate_series(1,121) n returning id,request_hash
) insert into recon_fixture select id,substring(request_hash from '[0-9]+$')::integer from inserted;
insert into private.vnpay_attempts(payment_id,txn_ref,transaction_no,pay_date,create_date,ip_addr,expires_at,settlement,gateway_paid)
 select f.id,'RECON-REF-'||f.ordinal,'RECON-TXN-'||f.ordinal,'20261104120000','20260901070000','127.0.0.1',now()+interval '1 day','compensation',true from recon_fixture f;
insert into public.refunds(booking_id,payment_id,idempotency_key,amount,reason,provider_reference,status,completed_at)
 select p.booking_id,p.id,gen_random_uuid(),100,'rollback_fixture','RECON-REFUND-'||f.ordinal,
  case when f.ordinal=121 then 'succeeded'::public.refund_status else 'pending'::public.refund_status end,
  case when f.ordinal=121 then '2026-11-05T04:00:00Z'::timestamptz end
 from public.payments p join recon_fixture f on f.id=p.id;
insert into private.vnpay_refund_jobs(refund_id,state,request_id,request_date,transaction_type,last_code)
 select r.id,case when f.ordinal=121 then 'succeeded' when f.ordinal=120 then 'unknown' else 'review' end,'RECON-JOB-'||f.ordinal,'20261105070000','02','00'
 from public.refunds r join recon_fixture f on f.id=r.payment_id;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000093',true);
set local role authenticated;
do $$declare result jsonb; row jsonb;begin
 result:=public.admin_vnpay_review_page('RECONROLLBACK121','all',20,100);
 perform pg_temp.recon_assert((result->>'total')::integer=121,'server count must exceed old cap');
 perform pg_temp.recon_assert(jsonb_array_length(result->'items')=20,'page after row 100 must remain available');
 result:=public.admin_vnpay_review_page('RECON-TXN-121 RECON-REFUND-121','succeeded',20,0);
 perform pg_temp.recon_assert((result->>'total')::integer=1,'token/ref/status search returns exact row beyond old cap');
 row:=result->'items'->0;
 perform pg_temp.recon_assert(row->>'completed_at' is not null and row->>'refund_provider_reference'='RECON-REFUND-121','completion and provider reference exposed');
 result:=public.admin_vnpay_review_page('RECONROLLBACK121','unknown',20,0);
 perform pg_temp.recon_assert((result->>'total')::integer=1,'unknown refund job remains distinct');
 result:=public.admin_vnpay_review_page('RECONROLLBACK121','review',20,0);
 perform pg_temp.recon_assert((result->>'total')::integer=119,'review jobs are not implied completed');
 result:=public.admin_payment_ledger_page(500,0);
 select value into row from jsonb_array_elements(result->'items') where value->>'provider_reference'='RECON-CAPTURE-121';
 perform pg_temp.recon_assert(row->>'status'='pending' and (row->>'captured')::boolean,'duplicate capture stays pending in public status but cash evidence exists');
 perform pg_temp.recon_assert((row->>'captured_at')::timestamptz='2026-11-04T05:00:00Z'::timestamptz,'capture timestamp interprets provider date in Vietnam timezone');
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000094',true);
set local role authenticated;
select pg_temp.recon_denied('select public.admin_payment_ledger_page()');
select pg_temp.recon_denied('select public.admin_vnpay_review_page()');
reset role;
insert into private.account_access(user_id,suspended) values ('00000000-0000-4000-8000-000000000093',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000093',true);
set local role authenticated;
select pg_temp.recon_denied('select public.admin_payment_ledger_page()');
select pg_temp.recon_denied('select public.admin_vnpay_review_page()');
reset role;
select pg_temp.recon_assert(not has_function_privilege('anon','public.admin_payment_ledger_page(integer,integer)','execute'),'anonymous payment ledger denied');
select pg_temp.recon_assert(not has_function_privilege('anon','public.admin_vnpay_review_page(text,text,integer,integer)','execute'),'anonymous reconciliation denied');
rollback;
