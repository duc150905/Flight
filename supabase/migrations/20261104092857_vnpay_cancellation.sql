begin;
create function private.ensure_vnpay_refund(p_payment uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;p public.payments%rowtype;a private.vnpay_attempts%rowtype;rid uuid;due bigint;begin
 select * into p from public.payments where id=p_payment and provider='vnpay_sandbox';if p.id is null then return null;end if;
 b:=private.vnpay_lock(p.booking_id);
 select * into a from private.vnpay_attempts where payment_id=p.id for update;
 if not a.gateway_paid then return null;end if;
 due:=case when a.settlement='compensation' then p.amount when b.status='cancelled' then coalesce((b.refund_policy_snapshot->>'refund_due_amount')::bigint,0) else 0 end;
 if due<=0 or due>p.amount then return null;end if;
 insert into public.refunds(booking_id,payment_id,idempotency_key,amount,reason)
 values(b.id,p.id,gen_random_uuid(),due,case when a.settlement='compensation' then 'vnpay_late_or_duplicate_payment' else 'vnpay_customer_cancellation' end)
 on conflict(payment_id) do nothing;
 select id into rid from public.refunds where payment_id=p.id;
 insert into private.vnpay_refund_jobs(refund_id,request_id,request_date,transaction_type)
 values(rid,replace(gen_random_uuid()::text,'-',''),to_char(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh','YYYYMMDDHH24MISS'),case when due=p.amount then '02' else '03' end) on conflict do nothing;
 return rid;
end $$;
revoke all on function private.ensure_vnpay_refund(uuid) from public,anon,authenticated;
create function private.vnpay_cancel_intent() returns trigger language plpgsql security definer set search_path='' as $$
declare pid uuid;begin
 if new.status='cancelled' and old.status<>'cancelled' then
  for pid in select p.id from public.payments p join private.vnpay_attempts a on a.payment_id=p.id where p.booking_id=new.id and a.gateway_paid loop perform private.ensure_vnpay_refund(pid);end loop;
 end if;return new;
end $$;
revoke all on function private.vnpay_cancel_intent() from public,anon,authenticated;
create trigger vnpay_cancel_refund_intent after update of status on public.bookings for each row execute function private.vnpay_cancel_intent();
notify pgrst,'reload schema';
commit;
