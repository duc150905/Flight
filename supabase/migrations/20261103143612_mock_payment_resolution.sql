begin;
set local lock_timeout='10s'; set local statement_timeout='60s';
create table private.mock_action_requests(
 user_id uuid not null references auth.users(id),request_id uuid not null,booking_id uuid not null references public.bookings(id),
 request_hash text not null,created_at timestamptz not null default now(),primary key(user_id,request_id)
);
alter table private.mock_action_requests enable row level security;
revoke all on private.mock_action_requests from public,anon,authenticated;
create index mock_action_booking_idx on private.mock_action_requests(booking_id);
create function private.claim_mock_action(p_booking uuid,p_request uuid,p_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare inserted uuid; old_hash text;
begin
 if auth.uid() is null or p_request is null or not exists(select 1 from public.bookings where id=p_booking and user_id=auth.uid()) then raise exception using message='mock.invalid';end if;
 insert into private.mock_action_requests(user_id,request_id,booking_id,request_hash) values(auth.uid(),p_request,p_booking,p_hash)
 on conflict do nothing returning request_id into inserted;
 if inserted is not null then return true;end if;
 select request_hash into old_hash from private.mock_action_requests where user_id=auth.uid() and request_id=p_request;
 if old_hash is distinct from p_hash then raise exception using message='mock.conflict';end if;
 return false;
end $$;
revoke all on function private.claim_mock_action(uuid,uuid,text) from public,anon,authenticated;
create function private.resolve_mock_payment(p_payment_id uuid,p_request_id uuid,p_outcome text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;p public.payments%rowtype;bid uuid;v_now timestamptz; needed int;held int;outcome text;hash text;
begin
 if p_outcome is null or p_outcome not in ('pending','succeeded','failed','cancelled') or p_request_id is null then raise exception using message='mock.invalid';end if;
 select booking_id into bid from public.payments where id=p_payment_id;
 b:=private.lock_mock_booking(bid);
 hash:=encode(sha256(convert_to('payment:'||p_payment_id::text||':'||p_outcome,'UTF8')),'hex');
 if not private.claim_mock_action(bid,p_request_id,hash) then return private.mock_booking_state(bid);end if;
 select * into p from public.payments where id=p_payment_id and booking_id=b.id for update;
 if p.provider<>'mock' or p.amount<>b.total_amount or p.currency<>b.currency then raise exception using message='mock.invalid';end if;
 if p.status<>'pending' then return private.mock_booking_state(bid);end if;
 v_now:=clock_timestamp();outcome:=p_outcome;
 if b.status<>'pending_payment' then outcome:='cancelled';
 elsif b.expires_at<=v_now then
  perform private.expire_locked_booking(bid);return private.mock_booking_state(bid);
 elsif p.booking_version<>b.version then outcome:='cancelled';
 end if;
 if outcome='pending' then return private.mock_booking_state(bid);end if;
 if outcome='succeeded' then
  select count(*) into needed from public.booking_passenger_segments where booking_id=bid and requires_seat;
  select count(*) into held from public.seat_reservations r join public.flight_seats fs on fs.id=r.flight_seat_id
   join public.booking_passenger_segments ps on ps.id=r.passenger_segment_id
   join public.booking_segments s on s.id=ps.segment_id
   where r.booking_id=bid and r.status='held' and r.expires_at>v_now and not fs.is_blocked and fs.cabin_class=s.cabin_class;
  if needed<>held or exists(select 1 from public.booking_segments s join public.flight_instances f on f.id=s.flight_id
   where s.booking_id=bid and (f.status not in ('scheduled','delayed') or f.departure_at<=v_now)) then outcome:='failed';end if;
 end if;
 update public.payments set status=outcome::public.payment_status,paid_at=case when outcome='succeeded' then v_now end,
 failure_code=case when outcome='failed' then 'mock_failed' when outcome='cancelled' then 'mock_cancelled' end where id=p.id;
 insert into public.booking_events(booking_id,actor_user_id,event_type,safe_message,metadata)
 values(bid,auth.uid(),case outcome when 'succeeded' then 'payment_succeeded' when 'failed' then 'payment_failed' else 'payment_cancelled' end,'Mock payment result recorded.',jsonb_build_object('payment_id',p.id));
 if outcome='succeeded' then
  update public.seat_reservations set status='confirmed',confirmed_at=v_now where booking_id=bid and status='held';
  update public.bookings set status='confirmed',confirmed_at=v_now,version=version+1 where id=bid;
  insert into public.booking_events(booking_id,actor_user_id,event_type,from_status,to_status,safe_message)
  values(bid,auth.uid(),'confirmed','pending_payment','confirmed','Demo booking confirmed.');
 end if;
 return private.mock_booking_state(bid);
end $$;
revoke all on function private.resolve_mock_payment(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.resolve_mock_payment(uuid,uuid,text) to authenticated;
create function public.resolve_mock_payment(p_payment_id uuid,p_request_id uuid,p_outcome text) returns jsonb
language sql volatile security invoker set search_path='' as $$select private.resolve_mock_payment(p_payment_id,p_request_id,p_outcome)$$;
revoke all on function public.resolve_mock_payment(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.resolve_mock_payment(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
