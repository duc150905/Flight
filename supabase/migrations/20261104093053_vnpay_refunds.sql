begin;
create function private.claim_vnpay_refund(p_booking_id uuid,p_owner_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;p public.payments%rowtype;a private.vnpay_attempts%rowtype;r public.refunds%rowtype;j private.vnpay_refund_jobs%rowtype;pid uuid;begin
 if p_owner_id is not null and not exists(select 1 from public.bookings where id=p_booking_id and user_id=p_owner_id) then raise exception 'booking.notFound';end if;
 b:=private.vnpay_lock(p_booking_id);
 for pid in select x.id from public.payments x join private.vnpay_attempts y on y.payment_id=x.id where x.booking_id=b.id and y.gateway_paid loop perform private.ensure_vnpay_refund(pid);end loop;
 select f.* into r from public.refunds f join private.vnpay_refund_jobs x on x.refund_id=f.id where f.booking_id=b.id and x.state='ready' order by f.created_at limit 1 for update of f;
 if r.id is null then return null;end if;
 select * into p from public.payments where id=r.payment_id;
 select * into strict a from private.vnpay_attempts where payment_id=p.id;
 if r.amount<=0 or r.amount>p.amount or not a.gateway_paid then raise exception 'payment.amount';end if;
 update private.vnpay_refund_jobs set state='submitted',submitted_at=clock_timestamp(),updated_at=clock_timestamp(),request_date=to_char(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh','YYYYMMDDHH24MISS') where refund_id=r.id and state='ready' returning * into j;
 if j.refund_id is null then return null;end if;
 insert into public.booking_events(booking_id,event_type,safe_message,metadata) values(b.id,'refund_started','VNPAY Sandbox refund submitted.',jsonb_build_object('refund_id',r.id));
 return jsonb_build_object('refundId',r.id,'requestId',j.request_id,'date',j.request_date,'ref',a.txn_ref,'amount',r.amount,'type',j.transaction_type,'transactionNo',a.transaction_no,'created',a.create_date,'ip',a.ip_addr);
end $$;
revoke all on function private.claim_vnpay_refund(uuid,uuid) from public,anon,authenticated;
grant execute on function private.claim_vnpay_refund(uuid,uuid) to service_role;
create function public.claim_vnpay_refund(p_booking_id uuid,p_owner_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.claim_vnpay_refund(p_booking_id,p_owner_id)$$;
revoke all on function public.claim_vnpay_refund(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_vnpay_refund(uuid,uuid) to service_role;
create function private.apply_vnpay_refund(p_refund_id uuid,p_state text,p_code text,p_transaction_no text) returns void language plpgsql security definer set search_path='' as $$
declare r public.refunds%rowtype;j private.vnpay_refund_jobs%rowtype;begin
 if p_state not in ('unknown','processing','succeeded','failed','review') then raise exception 'payment.invalid';end if;
 select * into r from public.refunds where id=p_refund_id;
 if r.id is null then raise exception 'payment.notFound';end if;
 perform private.vnpay_lock(r.booking_id);
 select * into r from public.refunds where id=p_refund_id for update;
 select * into strict j from private.vnpay_refund_jobs where refund_id=r.id for update;
 if j.state='succeeded' then return;end if;
 if j.state='ready' then raise exception 'payment.notSubmitted';end if;
 if p_state='succeeded' and p_transaction_no!~'^[1-9][0-9]{0,14}$' then raise exception 'payment.reference';end if;
 update private.vnpay_refund_jobs set state=p_state,last_code=p_code,transaction_no=coalesce(nullif(p_transaction_no,''),transaction_no),updated_at=clock_timestamp() where refund_id=r.id;
 update public.refunds set status=case when p_state='succeeded' then 'succeeded'::public.refund_status when p_state='failed' then 'failed'::public.refund_status else 'pending'::public.refund_status end,
 completed_at=case when p_state='succeeded' then clock_timestamp() end,provider_reference=case when p_state='succeeded' then 'vnpay_'||p_transaction_no else provider_reference end where id=r.id;
 if p_state in ('succeeded','failed') and j.state<>p_state then
  insert into public.booking_events(booking_id,event_type,safe_message,metadata) values(r.booking_id,case when p_state='succeeded' then 'refund_succeeded' else 'refund_failed' end,'VNPAY Sandbox refund result recorded.',jsonb_build_object('refund_id',r.id));
 end if;
end $$;
revoke all on function private.apply_vnpay_refund(uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.apply_vnpay_refund(uuid,text,text,text) to service_role;
create function public.apply_vnpay_refund(p_refund_id uuid,p_state text,p_code text,p_transaction_no text) returns void language sql security invoker set search_path='' as $$select private.apply_vnpay_refund(p_refund_id,p_state,p_code,p_transaction_no)$$;
revoke all on function public.apply_vnpay_refund(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.apply_vnpay_refund(uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
