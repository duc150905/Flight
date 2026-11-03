begin;
set local lock_timeout='10s'; set local statement_timeout='60s';
create extension if not exists pg_cron with schema pg_catalog;
create function private.cancel_attempts_on_booking_end() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('expired','cancelled') and new.status<>old.status then
  with stopped as (
   update public.payments set status='cancelled',failure_code=case when new.status='expired' then 'hold_expired' else 'booking_cancelled' end
   where booking_id=new.id and status='pending' returning id
  ) insert into public.booking_events(booking_id,event_type,safe_message,metadata)
   select new.id,'payment_cancelled','Mock payment cancelled.',jsonb_build_object('payment_id',id) from stopped;
 end if;
 return new;
end $$;
revoke all on function private.cancel_attempts_on_booking_end() from public,anon,authenticated;
create trigger booking_end_cancels_mock_attempts after update of status on public.bookings
for each row execute function private.cancel_attempts_on_booking_end();
create function private.expire_locked_booking(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare changed uuid; v_now timestamptz:=clock_timestamp();
begin
 update public.bookings set status='expired',version=version+1 where id=p_id and status='pending_payment' and expires_at<=v_now returning id into changed;
 if changed is null then return false; end if;
 update public.seat_reservations set status='expired',released_at=v_now where booking_id=p_id and status='held';
 insert into public.booking_events(booking_id,event_type,from_status,to_status,safe_message)
 values(p_id,'expired','pending_payment','expired','Booking hold expired.');
 return true;
end $$;
revoke all on function private.expire_locked_booking(uuid) from public,anon,authenticated;
create function private.expire_pending_bookings() returns integer
language plpgsql security definer set search_path='' as $$
declare ids uuid[]; bid uuid; n int:=0;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('flyora-expiry-job',0)) then return 0; end if;
 select array_agg(id) into ids from (select id from public.bookings where status='pending_payment' and expires_at<=clock_timestamp() order by expires_at,id limit 100) due;
 if ids is null then return 0; end if;
 perform 1 from public.flight_instances where id in (select flight_id from public.booking_segments where booking_id=any(ids)) order by id for update;
 perform 1 from public.bookings where id=any(ids) order by id for update;
 foreach bid in array ids loop if private.expire_locked_booking(bid) then n:=n+1; end if; end loop;
 return n;
end $$;
revoke all on function private.expire_pending_bookings() from public,anon,authenticated;
select cron.schedule('flyora-expire-pending-bookings','* * * * *','select private.expire_pending_bookings()');
commit;
