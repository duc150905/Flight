begin;
set local lock_timeout='10s';set local statement_timeout='60s';
create function private.refund_mock_booking(p_booking_id uuid,p_request_id uuid,p_outcome text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;p public.payments%rowtype;r public.refunds%rowtype;due bigint;hash text;v_now timestamptz:=clock_timestamp();
begin
 if p_outcome is null or p_outcome not in ('pending','succeeded','failed') or p_request_id is null then raise exception using message='mock.invalid';end if;
 b:=private.lock_mock_booking(p_booking_id);
 hash:=encode(sha256(convert_to('refund:'||p_booking_id::text||':'||p_outcome,'UTF8')),'hex');
 if not private.claim_mock_action(b.id,p_request_id,hash) then return private.mock_booking_state(b.id);end if;
 due:=coalesce((b.refund_policy_snapshot->>'refund_due_amount')::bigint,0);
 select * into p from public.payments where booking_id=b.id and status='succeeded' and provider='mock' for update;
 if not found or b.status<>'cancelled' or due<=0 or due>p.amount then raise exception using message='mock.ineligible';end if;
 select * into r from public.refunds where payment_id=p.id for update;
 if found and r.status='succeeded' then return private.mock_booking_state(b.id);end if;
 if r.id is null then
  insert into public.refunds(booking_id,payment_id,idempotency_key,amount,reason,provider_reference)
  values(b.id,p.id,p_request_id,due,'mock_customer_cancellation','mock_refund_'||gen_random_uuid()::text) returning * into r;
  insert into public.booking_events(booking_id,actor_user_id,event_type,safe_message,metadata)
  values(b.id,auth.uid(),'refund_started','Mock refund started.',jsonb_build_object('refund_id',r.id));
 end if;
 if r.amount<>due then raise exception using message='mock.invalid';end if;
 if r.status::text<>p_outcome then
  update public.refunds set status=p_outcome::public.refund_status,completed_at=case when p_outcome='succeeded' then v_now end where id=r.id;
  if p_outcome in ('succeeded','failed') then
   insert into public.booking_events(booking_id,actor_user_id,event_type,safe_message,metadata)
   values(b.id,auth.uid(),case when p_outcome='succeeded' then 'refund_succeeded' else 'refund_failed' end,'Mock refund result recorded.',jsonb_build_object('refund_id',r.id));
  end if;
 end if;
 return private.mock_booking_state(b.id);
end $$;
revoke all on function private.refund_mock_booking(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.refund_mock_booking(uuid,uuid,text) to authenticated;
create function public.refund_mock_booking(p_booking_id uuid,p_request_id uuid,p_outcome text) returns jsonb
language sql volatile security invoker set search_path='' as $$select private.refund_mock_booking(p_booking_id,p_request_id,p_outcome)$$;
revoke all on function public.refund_mock_booking(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.refund_mock_booking(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
