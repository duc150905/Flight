begin;
create or replace function private.vnpay_worker_batch() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(id),'[]'::jsonb) from(select distinct p.booking_id id from public.payments p join private.vnpay_attempts a on a.payment_id=p.id join public.bookings b on b.id=p.booking_id
 left join public.refunds r on r.payment_id=p.id left join private.vnpay_refund_jobs j on j.refund_id=r.id
 where (not a.gateway_paid and a.sync_count<48 and a.sync_after<=clock_timestamp() and a.expires_at>clock_timestamp()-interval '24 hours')
 or (a.gateway_paid and (a.settlement='compensation' or (b.status='cancelled' and coalesce((b.refund_policy_snapshot->>'refund_due_amount')::bigint,0)>0))
 and (j.refund_id is null or j.state='ready' or (j.state in ('submitted','unknown','processing') and j.sync_after<=clock_timestamp() and j.sync_count<20))) order by id limit 3) x
$$;
create or replace function private.get_payment_state(p_booking_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;begin
 perform private.lock_mock_booking(p_booking_id);s:=private.mock_booking_state(p_booking_id);
 return s||jsonb_build_object('provider',(select provider from private.booking_payment_routes where booking_id=p_booking_id),
 'settlement',(select a.settlement from private.vnpay_attempts a join public.payments p on p.id=a.payment_id where p.booking_id=p_booking_id order by p.created_at desc limit 1),
 'refundState',(select j.state from private.vnpay_refund_jobs j join public.refunds r on r.id=j.refund_id where r.booking_id=p_booking_id order by case j.state when 'review' then 0 when 'unknown' then 1 when 'failed' then 2 when 'submitted' then 3 when 'processing' then 4 when 'ready' then 5 else 6 end limit 1),
 'refundJobs',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'amount',r.amount,'state',j.state) order by r.created_at),'[]') from private.vnpay_refund_jobs j join public.refunds r on r.id=j.refund_id where r.booking_id=p_booking_id));
end $$;
commit;
