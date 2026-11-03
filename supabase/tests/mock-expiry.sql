do $$ declare bid uuid:=pg_temp.mock_booking(); n int; begin
 insert into public.payments(booking_id,idempotency_key,request_hash,booking_version,amount)
 select id,gen_random_uuid(),'test',version,total_amount from public.bookings where id=bid;
 update public.bookings set expires_at=now()-interval '1 second' where id=bid;
 update public.seat_reservations set expires_at=now()-interval '1 second' where booking_id=bid;
 n:=private.expire_pending_bookings();
 if n<1 or (select status from public.bookings where id=bid)<>'expired'
 or exists(select 1 from public.seat_reservations where booking_id=bid and status='held')
 or exists(select 1 from public.payments where booking_id=bid and status='pending') then raise exception 'Expiry reconciliation failed'; end if;
 perform private.expire_pending_bookings();
 if (select count(*) from public.booking_events where booking_id=bid and event_type='expired')<>1 then raise exception 'Duplicate expiry event'; end if;
 if has_function_privilege('authenticated','private.expire_pending_bookings()','execute') then raise exception 'Client can expire other owners'; end if;
 if not exists(select 1 from cron.job where jobname='flyora-expire-pending-bookings' and active) then raise exception 'Cron missing'; end if;
end $$;
