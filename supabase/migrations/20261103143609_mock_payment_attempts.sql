begin;
set local lock_timeout='10s'; set local statement_timeout='60s';
create function private.lock_mock_booking(p_id uuid) returns public.bookings
language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;
begin
 if auth.uid() is null then raise exception using message='booking.authRequired'; end if;
 if not exists(select 1 from public.bookings where id=p_id and user_id=auth.uid()) then raise exception using message='booking.notFound'; end if;
 perform 1 from public.flight_instances where id in(select flight_id from public.booking_segments where booking_id=p_id) order by id for update;
 select * into b from public.bookings where id=p_id and user_id=auth.uid() for update;
 perform private.expire_locked_booking(p_id);
 select * into b from public.bookings where id=p_id and user_id=auth.uid();
 return b;
end $$;
revoke all on function private.lock_mock_booking(uuid) from public,anon,authenticated;
create function private.mock_cancel_policy(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('allowed',false,'fee',0,'refundAmount',0,'reason','unsupported')
$$;
revoke all on function private.mock_cancel_policy(uuid) from public,anon,authenticated;
create function private.mock_booking_state(p_id uuid) returns jsonb
language sql volatile security definer set search_path='' as $$
 select jsonb_build_object('booking',private.booking_receipt(b.id),'cancellation',private.mock_cancel_policy(b.id),
 'payments',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'status',p.status,'amount',p.amount,'currency',p.currency,
 'failureCode',p.failure_code,'createdAt',p.created_at) order by p.created_at desc,p.id desc),'[]') from public.payments p where p.booking_id=b.id),
 'refunds',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'status',r.status,'amount',r.amount,'currency',r.currency,'completedAt',r.completed_at)),'[]') from public.refunds r where r.booking_id=b.id))
 from public.bookings b where b.id=p_id and b.user_id=auth.uid()
$$;
revoke all on function private.mock_booking_state(uuid) from public,anon,authenticated;
create function private.get_mock_payment_state(p_booking_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.lock_mock_booking(p_booking_id);
 return private.mock_booking_state(p_booking_id);
end $$;
revoke all on function private.get_mock_payment_state(uuid) from public,anon,authenticated;
grant execute on function private.get_mock_payment_state(uuid) to authenticated;
create function public.get_mock_payment_state(p_booking_id uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$ select private.get_mock_payment_state(p_booking_id) $$;
revoke all on function public.get_mock_payment_state(uuid) from public,anon,authenticated;
grant execute on function public.get_mock_payment_state(uuid) to authenticated;
create function private.start_mock_payment(p_booking_id uuid,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; pid uuid;
begin
 if p_request_id is null then raise exception using message='mock.invalid'; end if;
 b:=private.lock_mock_booking(p_booking_id);
 if b.status<>'pending_payment' then return private.mock_booking_state(b.id); end if;
 if exists(select 1 from public.payments where booking_id=b.id and (idempotency_key=p_request_id or status in ('pending','succeeded'))) then return private.mock_booking_state(b.id); end if;
 insert into public.payments(booking_id,idempotency_key,request_hash,booking_version,amount,provider_reference,created_at)
 values(b.id,p_request_id,encode(sha256(convert_to(b.id::text||':mock_card','UTF8')),'hex'),b.version,b.total_amount,'mock_'||gen_random_uuid()::text,clock_timestamp()) returning id into pid;
 insert into public.booking_events(booking_id,actor_user_id,event_type,safe_message,metadata)
 values(b.id,auth.uid(),'payment_started','Mock payment started.',jsonb_build_object('payment_id',pid));
 return private.mock_booking_state(b.id);
end $$;
revoke all on function private.start_mock_payment(uuid,uuid) from public,anon,authenticated;
grant execute on function private.start_mock_payment(uuid,uuid) to authenticated;
create function public.start_mock_payment(p_booking_id uuid,p_request_id uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$ select private.start_mock_payment(p_booking_id,p_request_id) $$;
revoke all on function public.start_mock_payment(uuid,uuid) from public,anon,authenticated;
grant execute on function public.start_mock_payment(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
