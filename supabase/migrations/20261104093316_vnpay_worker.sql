begin;
create extension if not exists pg_net with schema extensions;
alter table private.vnpay_refund_jobs add column sync_after timestamptz not null default now();
alter table private.vnpay_refund_jobs add column sync_count int not null default 0;
create function private.vnpay_worker_batch() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(id),'[]'::jsonb) from(select distinct p.booking_id id from public.payments p join private.vnpay_attempts a on a.payment_id=p.id join public.bookings b on b.id=p.booking_id
 left join public.refunds r on r.payment_id=p.id left join private.vnpay_refund_jobs j on j.refund_id=r.id
 where (not a.gateway_paid and a.sync_count<48 and a.sync_after<=clock_timestamp() and a.expires_at>clock_timestamp()-interval '24 hours')
 or (a.gateway_paid and (a.settlement='compensation' or b.status='cancelled') and (j.refund_id is null or j.state='ready' or (j.state in ('submitted','unknown','processing') and j.sync_after<=clock_timestamp() and j.sync_count<20))) order by id limit 3) x
$$;
create function private.claim_vnpay_refund_sync(p_booking_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;r public.refunds%rowtype;j private.vnpay_refund_jobs%rowtype;a private.vnpay_attempts%rowtype;begin
 b:=private.vnpay_lock(p_booking_id);
 select f.* into r from public.refunds f join private.vnpay_refund_jobs x on x.refund_id=f.id where f.booking_id=b.id and x.state in ('submitted','unknown','processing') and x.updated_at<clock_timestamp()-interval '1 minute' and x.sync_after<=clock_timestamp() order by f.created_at limit 1 for update of f;
 if r.id is null then return null;end if;
 select * into a from private.vnpay_attempts where payment_id=r.payment_id;
 update private.vnpay_refund_jobs set sync_after=clock_timestamp()+interval '5 minutes',sync_count=sync_count+1,state=case when sync_count>=19 then 'review' else state end where refund_id=r.id returning * into j;
 if j.state='review' then return null;end if;
 return jsonb_build_object('refundId',r.id,'requestId',replace(gen_random_uuid()::text,'-',''),'date',to_char(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh','YYYYMMDDHH24MISS'),'ref',a.txn_ref,'amount',r.amount,'type',j.transaction_type,'transactionNo',a.transaction_no,'created',a.create_date,'ip',a.ip_addr);
end $$;
create function private.admin_vnpay_review() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Forbidden';end if;
 return(select coalesce(jsonb_agg(x),'[]') from(select b.booking_code,p.id payment_id,p.amount,a.settlement,a.gateway_paid,a.transaction_no,j.state refund_state,j.last_code
 from public.payments p join public.bookings b on b.id=p.booking_id join private.vnpay_attempts a on a.payment_id=p.id left join public.refunds r on r.payment_id=p.id left join private.vnpay_refund_jobs j on j.refund_id=r.id
 where a.settlement='compensation' or j.state in ('unknown','processing','review','failed') order by p.created_at desc limit 100)x);
end $$;
revoke all on function private.vnpay_worker_batch(),private.claim_vnpay_refund_sync(uuid),private.admin_vnpay_review() from public,anon,authenticated;
grant execute on function private.vnpay_worker_batch(),private.claim_vnpay_refund_sync(uuid) to service_role;
grant execute on function private.admin_vnpay_review() to authenticated;
create function public.vnpay_worker_batch() returns jsonb language sql security invoker set search_path='' as $$select private.vnpay_worker_batch()$$;
create function public.claim_vnpay_refund_sync(p_booking_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.claim_vnpay_refund_sync(p_booking_id)$$;
create function public.admin_vnpay_review() returns jsonb language sql security invoker set search_path='' as $$select private.admin_vnpay_review()$$;
revoke all on function public.vnpay_worker_batch(),public.claim_vnpay_refund_sync(uuid),public.admin_vnpay_review() from public,anon,authenticated;
grant execute on function public.vnpay_worker_batch(),public.claim_vnpay_refund_sync(uuid) to service_role;
grant execute on function public.admin_vnpay_review() to authenticated;
create function private.dispatch_payment_worker() returns void language plpgsql security definer set search_path='' as $$
declare base_url text;worker_secret text;begin
 select decrypted_secret into base_url from vault.decrypted_secrets where name='flyora_functions_url';
 select decrypted_secret into worker_secret from vault.decrypted_secrets where name='flyora_worker_secret';
 if base_url is null or worker_secret is null then return;end if;
 perform net.http_post(url:=base_url||'/vnpay-worker',headers:=jsonb_build_object('Authorization','Bearer '||worker_secret,'Content-Type','application/json'),body:='{}'::jsonb,timeout_milliseconds:=90000);
end $$;
revoke all on function private.dispatch_payment_worker() from public,anon,authenticated;
select cron.schedule('flyora-payments-worker','* * * * *','select private.dispatch_payment_worker()');
notify pgrst,'reload schema';
commit;
