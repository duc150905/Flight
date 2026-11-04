begin;
create function private.claim_vnpay_sync(p_booking_id uuid,p_owner_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;p public.payments%rowtype;a private.vnpay_attempts%rowtype;qid text:=replace(gen_random_uuid()::text,'-','');begin
 if p_owner_id is not null and not exists(select 1 from public.bookings where id=p_booking_id and user_id=p_owner_id) then raise exception 'booking.notFound';end if;
 b:=private.vnpay_lock(p_booking_id);
 select x.* into p from public.payments x join private.vnpay_attempts y on y.payment_id=x.id where x.booking_id=b.id and not y.gateway_paid and y.sync_after<=clock_timestamp() and y.sync_count<48 and y.expires_at>clock_timestamp()-interval '24 hours' order by x.created_at limit 1;
 if p.id is null then return null;end if;
 update private.vnpay_attempts set sync_count=sync_count+1,sync_after=clock_timestamp()+make_interval(secs=>least(1800,30*power(2,least(sync_count,6)))::int),last_query_id=qid where payment_id=p.id returning * into a;
 return jsonb_build_object('bookingId',b.id,'ref',a.txn_ref,'amount',p.amount,'created',a.create_date,'queryId',qid,'ip',a.ip_addr);
end $$;
revoke all on function private.claim_vnpay_sync(uuid,uuid) from public,anon,authenticated;
grant execute on function private.claim_vnpay_sync(uuid,uuid) to service_role;
create function public.claim_vnpay_sync(p_booking_id uuid,p_owner_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.claim_vnpay_sync(p_booking_id,p_owner_id) $$;
revoke all on function public.claim_vnpay_sync(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_vnpay_sync(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
