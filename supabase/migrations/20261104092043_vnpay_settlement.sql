begin;
alter table private.vnpay_attempts add column gateway_paid boolean not null default false;
create function private.apply_vnpay_result(p_ref text,p_amount bigint,p_success boolean,p_transaction_no text,p_pay_date text,p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;p public.payments%rowtype;a private.vnpay_attempts%rowtype;bid uuid;needed int;held int;eligible boolean;v_now timestamptz:=clock_timestamp();begin
 select x.booking_id into bid from public.payments x join private.vnpay_attempts y on y.payment_id=x.id where y.txn_ref=p_ref;
 if bid is null then return jsonb_build_object('RspCode','01','Message','Order not found');end if;
 b:=private.vnpay_lock(bid);
 select x.* into p from public.payments x join private.vnpay_attempts y on y.payment_id=x.id where y.txn_ref=p_ref for update of x;
 select * into a from private.vnpay_attempts where payment_id=p.id for update;
 if p.provider<>'vnpay_sandbox' or p.amount<>p_amount then return jsonb_build_object('RspCode','04','Message','Invalid amount');end if;
 if a.gateway_paid then
  if p_success and a.transaction_no is distinct from p_transaction_no then raise exception 'payment.reference';end if;
  return jsonb_build_object('RspCode','02','Message','Already recorded');
 end if;
 if p_success then
  if p_transaction_no!~'^[1-9][0-9]{0,14}$' or p_pay_date!~'^[0-9]{14}$' then raise exception 'payment.invalid';end if;
  select count(*) into needed from public.booking_passenger_segments where booking_id=bid and requires_seat;
  select count(*) into held from public.seat_reservations r join public.booking_passenger_segments ps on ps.id=r.passenger_segment_id
   join public.flight_seats fs on fs.id=r.flight_seat_id join public.booking_segments s on s.id=ps.segment_id
   where r.booking_id=bid and ps.requires_seat and r.status='held' and r.expires_at>v_now and not fs.is_blocked and fs.cabin_class=s.cabin_class;
  eligible:=b.status='pending_payment' and b.expires_at>v_now and b.version=p.booking_version and needed=held and needed>0
   and not exists(select 1 from public.booking_segments s join public.flight_instances f on f.id=s.flight_id where s.booking_id=bid and (f.status not in ('scheduled','delayed') or f.departure_at<=v_now));
  update private.vnpay_attempts set gateway_paid=true,transaction_no=p_transaction_no,pay_date=p_pay_date,last_code=p_code,settlement=case when eligible then 'ticketed' else 'compensation' end where payment_id=p.id;
  if not exists(select 1 from public.payments where booking_id=bid and status='succeeded' and id<>p.id) then
   update public.payments set status='succeeded',paid_at=v_now,failure_code=null where id=p.id;
  end if;
  insert into public.booking_events(booking_id,event_type,safe_message,metadata) values(bid,'payment_succeeded','VNPAY Sandbox payment recorded.',jsonb_build_object('payment_id',p.id,'requires_review',not eligible));
  if eligible then
   update public.seat_reservations set status='confirmed',confirmed_at=v_now where booking_id=bid and status='held';
   update public.bookings set status='confirmed',confirmed_at=v_now,version=version+1 where id=bid;
   insert into public.booking_events(booking_id,event_type,from_status,to_status,safe_message) values(bid,'confirmed','pending_payment','confirmed','Sandbox booking confirmed.');
  end if;
 else
  if p.status='pending' then
   update public.payments set status='failed',failure_code='vnpay_'||p_code where id=p.id;
   update private.vnpay_attempts set settlement='failed',last_code=p_code where payment_id=p.id;
   insert into public.booking_events(booking_id,event_type,safe_message,metadata) values(bid,'payment_failed','VNPAY Sandbox payment failed.',jsonb_build_object('payment_id',p.id));
  end if;
 end if;
 return jsonb_build_object('RspCode','00','Message','Success');
end $$;
revoke all on function private.apply_vnpay_result(text,bigint,boolean,text,text,text) from public,anon,authenticated;
grant execute on function private.apply_vnpay_result(text,bigint,boolean,text,text,text) to service_role;
create function public.apply_vnpay_result(p_ref text,p_amount bigint,p_success boolean,p_transaction_no text,p_pay_date text,p_code text) returns jsonb language sql security invoker set search_path='' as $$ select private.apply_vnpay_result(p_ref,p_amount,p_success,p_transaction_no,p_pay_date,p_code) $$;
revoke all on function public.apply_vnpay_result(text,bigint,boolean,text,text,text) from public,anon,authenticated;
grant execute on function public.apply_vnpay_result(text,bigint,boolean,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
