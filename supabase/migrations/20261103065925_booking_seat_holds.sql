begin;
set local lock_timeout='10s'; set local statement_timeout='60s';
-- A recovery probe that finds no order closes that request UUID permanently.
-- This prevents a delayed HTTP create arriving after the app starts another try.
create table private.closed_booking_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, closed_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table private.closed_booking_requests enable row level security;
revoke all on private.closed_booking_requests from public,anon,authenticated;
create function private.reject_closed_booking_request() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.closed_booking_requests where user_id=new.user_id and request_id=new.create_request_id)
 then raise exception using message='booking.requestClosed'; end if;
 return new;
end $$;
revoke all on function private.reject_closed_booking_request() from public,anon,authenticated;
create trigger bookings_request_not_closed before insert on public.bookings
for each row execute function private.reject_closed_booking_request();
create or replace function private.booking_receipt(p_id uuid) returns jsonb
language sql volatile security definer set search_path='' as $$
 select jsonb_build_object('id',id,'bookingCode',booking_code,'status',status,'total',total_amount,
 'currency',currency,'expiresAt',expires_at,'serverNow',clock_timestamp())
 from public.bookings where id=p_id and user_id=auth.uid()
$$;
revoke all on function private.booking_receipt(uuid) from public,anon,authenticated;
create or replace function private.allocate_booking_seats(p_booking uuid,p_checkout jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare ps record; chosen uuid; charge bigint; v_now timestamptz:=clock_timestamp();
begin
 -- Explicit choices first. Then passengers who cannot use exit rows, then others.
 -- Inventory flight rows are already locked by create_booking, in UUID order.
 for ps in select bps.*,bp.ordinal,bp.date_of_birth,sg.cabin_class,b.expires_at,
  (select (c->>'seatId')::uuid from jsonb_array_elements(p_checkout->'seats') c where c->>'flightId'=bps.flight_id::text
   and c->>'passengerId'=p_checkout->'passengers'->(bp.ordinal-1)->>'id') selected,
  (extract(year from age((f.departure_at at time zone a.timezone)::date,bp.date_of_birth))>=18
   and not exists(select 1 from public.booking_passenger_segments infant where infant.segment_id=bps.segment_id and infant.accompanying_passenger_id=bps.passenger_id)) exit_ok
  from public.booking_passenger_segments bps join public.booking_passengers bp on bp.id=bps.passenger_id
  join public.booking_segments sg on sg.id=bps.segment_id join public.bookings b on b.id=bps.booking_id
  join public.flight_instances f on f.id=bps.flight_id join public.airports a on a.id=f.departure_airport_id
  where bps.booking_id=p_booking and bps.requires_seat
  order by bps.flight_id,(select c->>'seatId' from jsonb_array_elements(p_checkout->'seats') c where c->>'flightId'=bps.flight_id::text
   and c->>'passengerId'=p_checkout->'passengers'->(bp.ordinal-1)->>'id') is null,exit_ok,bp.ordinal loop
  chosen:=null; charge:=0;
  select fs.id,case when ps.selected is null then 0 else fs.selection_fee_amount end into chosen,charge
  from public.flight_seats fs where fs.flight_id=ps.flight_id and fs.cabin_class=ps.cabin_class and not fs.is_blocked
   and fs.currency='VND' and (ps.selected is null or fs.id=ps.selected) and (not fs.is_exit_row or ps.exit_ok)
   and not exists(select 1 from public.seat_reservations r where r.flight_seat_id=fs.id and (r.status='confirmed' or (r.status='held' and r.expires_at>v_now)))
  order by fs.is_exit_row,fs.row_number,fs.column_number,fs.id limit 1;
  if chosen is null then raise exception using message=case when ps.selected is null then 'quote.soldOut' else 'quote.seatUnavailable' end; end if;
  insert into public.seat_reservations(booking_id,passenger_segment_id,flight_id,flight_seat_id,selection_amount,expires_at)
  values(p_booking,ps.id,ps.flight_id,chosen,charge,ps.expires_at);
 end loop;
end $$;
revoke all on function private.allocate_booking_seats(uuid,jsonb) from public,anon,authenticated;

create function private.get_pending_booking(p_booking_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare b public.bookings%rowtype; v_now timestamptz; result jsonb;
begin
 if auth.uid() is null then raise exception using message='booking.authRequired'; end if;
 if not exists(select 1 from public.bookings where id=p_booking_id and user_id=auth.uid()) then raise exception using message='booking.notFound'; end if;
 -- Same lock order as creation: flights, then booking/holds. Never lock foreign orders.
 perform 1 from public.flight_instances where id in (select flight_id from public.booking_segments where booking_id=p_booking_id) order by id for update;
 select * into b from public.bookings where id=p_booking_id and user_id=auth.uid() for update;
 v_now:=clock_timestamp();
 if b.status='pending_payment' and b.expires_at<=v_now then
  update public.bookings set status='expired',version=version+1 where id=b.id;
  update public.seat_reservations set status='expired',released_at=v_now where booking_id=b.id and status='held';
  insert into public.booking_events(booking_id,actor_user_id,event_type,from_status,to_status,safe_message)
   values(b.id,auth.uid(),'expired','pending_payment','expired','Booking hold expired.');
 end if;
 result:=private.booking_receipt(b.id)||jsonb_build_object('serverNow',clock_timestamp(),
 'contact',jsonb_build_object('name',b.contact_name,'email',b.contact_email,'phone',b.contact_phone),
 'base',b.base_amount,'tax',b.tax_amount,'fee',b.fee_amount,'baggage',b.addon_amount,'seat',b.seat_amount,
 'passengers',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'ordinal',p.ordinal,'givenNames',p.given_names,'familyName',p.family_name,'gender',p.gender) order by p.ordinal),'[]') from public.booking_passengers p where p.booking_id=b.id),
 'segments',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'flightId',s.flight_id,'journeyIndex',s.journey_number,'legIndex',s.leg_number,'snapshot',s.flight_snapshot) order by s.journey_number,s.leg_number),'[]') from public.booking_segments s where s.booking_id=b.id),
 'passengerSegments',(select coalesce(jsonb_agg(jsonb_build_object('id',ps.id,'passengerId',ps.passenger_id,'flightId',ps.flight_id,'passengerType',ps.passenger_type,'requiresSeat',ps.requires_seat,'accompanyingPassengerId',ps.accompanying_passenger_id,'allowance',ps.allowance_snapshot)),'[]') from public.booking_passenger_segments ps where ps.booking_id=b.id),
 'seats',(select coalesce(jsonb_agg(jsonb_build_object('passengerSegmentId',r.passenger_segment_id,'flightId',r.flight_id,'seatCode',fs.seat_code,'amount',r.selection_amount,'status',r.status)),'[]') from public.seat_reservations r join public.flight_seats fs on fs.id=r.flight_seat_id where r.booking_id=b.id),
 'addons',(select coalesce(jsonb_agg(jsonb_build_object('passengerSegmentId',a.passenger_segment_id,'flightId',a.flight_id,'name',a.product_name_snapshot,'weightKg',a.weight_kg_snapshot,'amount',a.total_amount)),'[]') from public.booking_addons a where a.booking_id=b.id));
 return result;
end $$;
revoke all on function private.get_pending_booking(uuid) from public,anon,authenticated;
grant execute on function private.get_pending_booking(uuid) to authenticated;
create function public.get_pending_booking(p_booking_id uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$ select private.get_pending_booking(p_booking_id) $$;
revoke all on function public.get_pending_booking(uuid) from public,anon,authenticated;
grant execute on function public.get_pending_booking(uuid) to authenticated;

create function private.find_booking_request(p_request_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare bid uuid;
begin
 if auth.uid() is null then raise exception using message='booking.authRequired'; end if;
 if p_request_id is null then raise exception using message='booking.invalid'; end if;
 -- Wait for a still-running create before reporting "not found" after a lost response.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_request_id::text,0));
 select id into bid from public.bookings where user_id=auth.uid() and create_request_id=p_request_id;
 if bid is null then
  insert into private.closed_booking_requests(user_id,request_id) values(auth.uid(),p_request_id) on conflict do nothing;
 end if;
 return private.booking_receipt(bid);
end $$;
revoke all on function private.find_booking_request(uuid) from public,anon,authenticated;
grant execute on function private.find_booking_request(uuid) to authenticated;
create function public.find_booking_request(p_request_id uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$ select private.find_booking_request(p_request_id) $$;
revoke all on function public.find_booking_request(uuid) from public,anon,authenticated;
grant execute on function public.find_booking_request(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
