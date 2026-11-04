begin;
create table private.booking_confirmation_mail(
 booking_id uuid primary key references public.bookings(id) on delete cascade,
 snapshot jsonb not null,sender text,state text not null default 'queued' check(state in ('queued','sending','sent','review')),
 attempts int not null default 0,first_attempt timestamptz,next_attempt timestamptz not null default now(),lease_until timestamptz,
 provider_id text,last_error text,sent_at timestamptz
);
alter table private.booking_confirmation_mail enable row level security;
revoke all on private.booking_confirmation_mail from public,anon,authenticated;
create function private.enqueue_booking_confirmation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='confirmed' and old.status<>'confirmed' then
  insert into private.booking_confirmation_mail(booking_id,snapshot)
  values(new.id,jsonb_build_object('code',new.booking_code,'email',new.contact_email,'total',new.total_amount,
   'flights',(select coalesce(jsonb_agg(flight_snapshot order by journey_number,leg_number),'[]') from public.booking_segments where booking_id=new.id),
   'passengers',(select coalesce(jsonb_agg(jsonb_build_object('name',given_names||' '||family_name) order by ordinal),'[]') from public.booking_passengers where booking_id=new.id),
   'seats',(select coalesce(jsonb_agg(jsonb_build_object('seat',f.seat_code,'flightId',r.flight_id)),'[]') from public.seat_reservations r join public.flight_seats f on f.id=r.flight_seat_id where r.booking_id=new.id and r.status='confirmed'),
   'addons',(select coalesce(jsonb_agg(jsonb_build_object('name',product_name_snapshot,'quantity',quantity)),'[]') from public.booking_addons where booking_id=new.id))) on conflict do nothing;
 end if;return new;
end $$;
revoke all on function private.enqueue_booking_confirmation() from public,anon,authenticated;
create trigger booking_confirmed_email after update of status on public.bookings for each row execute function private.enqueue_booking_confirmation();
create function private.claim_booking_mail(p_sender text) returns jsonb language plpgsql security definer set search_path='' as $$
declare m private.booking_confirmation_mail%rowtype;begin
 update private.booking_confirmation_mail set state='review' where state in ('queued','sending') and (attempts>=6 or first_attempt<clock_timestamp()-interval '23 hours');
 select x.* into m from private.booking_confirmation_mail x join public.bookings b on b.id=x.booking_id where b.status='confirmed' and x.state in ('queued','sending') and x.next_attempt<=clock_timestamp() and (x.lease_until is null or x.lease_until<clock_timestamp()) order by x.next_attempt limit 1 for update of x skip locked;
 if m.booking_id is null then return null;end if;
 update private.booking_confirmation_mail set state='sending',attempts=attempts+1,first_attempt=coalesce(first_attempt,clock_timestamp()),lease_until=clock_timestamp()+interval '2 minutes',next_attempt=clock_timestamp()+interval '5 minutes',sender=coalesce(sender,p_sender) where booking_id=m.booking_id returning * into m;
 return jsonb_build_object('bookingId',m.booking_id,'snapshot',m.snapshot,'sender',m.sender);
end $$;
create function private.finish_booking_mail(p_booking_id uuid,p_provider_id text,p_error text) returns void language plpgsql security definer set search_path='' as $$
begin
 update private.booking_confirmation_mail set state=case when nullif(p_provider_id,'') is not null then 'sent' when p_error='conflict' then 'review' else 'queued' end,
 provider_id=nullif(p_provider_id,''),last_error=p_error,lease_until=null,sent_at=case when nullif(p_provider_id,'') is not null then clock_timestamp() end where booking_id=p_booking_id and state='sending';
end $$;
revoke all on function private.claim_booking_mail(text),private.finish_booking_mail(uuid,text,text) from public,anon,authenticated;
grant execute on function private.claim_booking_mail(text),private.finish_booking_mail(uuid,text,text) to service_role;
create function public.claim_booking_mail(p_sender text) returns jsonb language sql security invoker set search_path='' as $$select private.claim_booking_mail(p_sender)$$;
create function public.finish_booking_mail(p_booking_id uuid,p_provider_id text,p_error text) returns void language sql security invoker set search_path='' as $$select private.finish_booking_mail(p_booking_id,p_provider_id,p_error)$$;
revoke all on function public.claim_booking_mail(text),public.finish_booking_mail(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_booking_mail(text),public.finish_booking_mail(uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
