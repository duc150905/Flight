begin;
grant usage on schema private to service_role;
create function private.vnpay_lock(p_id uuid) returns public.bookings language plpgsql security definer set search_path='' as $$
declare owner_id uuid;begin
 select user_id into owner_id from public.bookings where id=p_id;
 if owner_id is null then raise exception 'booking.notFound';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 return private.lock_mock_booking(p_id);
end $$;
revoke all on function private.vnpay_lock(uuid) from public,anon,authenticated;
create function private.begin_vnpay_payment(p_booking_id uuid,p_owner_id uuid,p_request_id uuid,p_ip text) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;p public.payments%rowtype;a private.vnpay_attempts%rowtype;v_now timestamptz:=clock_timestamp();begin
 if p_request_id is null or p_owner_id is null then raise exception 'payment.invalid';end if;
 if not exists(select 1 from public.bookings where id=p_booking_id and user_id=p_owner_id) then raise exception 'booking.notFound';end if;
 b:=private.vnpay_lock(p_booking_id);
 if b.status<>'pending_payment' or b.expires_at<=v_now+interval '30 seconds' or b.total_amount<5000 or b.total_amount>9999999999 then raise exception 'payment.ineligible';end if;
 if exists(select 1 from private.booking_payment_routes where booking_id=b.id and provider<>'vnpay_sandbox') then raise exception 'payment.provider';end if;
 select * into p from public.payments where booking_id=b.id and (idempotency_key=p_request_id or status in ('pending','succeeded')) order by created_at desc limit 1;
 if p.id is null then
  insert into public.payments(booking_id,idempotency_key,request_hash,booking_version,amount,provider,provider_reference,created_at)
  values(b.id,p_request_id,'vnpay_sandbox:'||b.id,b.version,b.total_amount,'vnpay_sandbox',replace(gen_random_uuid()::text,'-',''),v_now) returning * into p;
  insert into private.vnpay_attempts(payment_id,txn_ref,create_date,ip_addr,expires_at)
  values(p.id,p.provider_reference,to_char(v_now at time zone 'Asia/Ho_Chi_Minh','YYYYMMDDHH24MISS'),p_ip::inet::text,b.expires_at);
  insert into public.booking_events(booking_id,event_type,safe_message,metadata) values(b.id,'payment_started','VNPAY Sandbox payment started.',jsonb_build_object('payment_id',p.id));
 end if;
 if p.status<>'pending' then raise exception 'payment.ineligible';end if;
 select * into strict a from private.vnpay_attempts where payment_id=p.id;
 return jsonb_build_object('bookingId',b.id,'paymentId',p.id,'ref',a.txn_ref,'amount',p.amount,'created',a.create_date,'expiresAt',a.expires_at,'ip',a.ip_addr);
end $$;
revoke all on function private.begin_vnpay_payment(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.begin_vnpay_payment(uuid,uuid,uuid,text) to service_role;
create function public.begin_vnpay_payment(p_booking_id uuid,p_owner_id uuid,p_request_id uuid,p_ip text) returns jsonb language sql security invoker set search_path='' as $$ select private.begin_vnpay_payment(p_booking_id,p_owner_id,p_request_id,p_ip) $$;
revoke all on function public.begin_vnpay_payment(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.begin_vnpay_payment(uuid,uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
