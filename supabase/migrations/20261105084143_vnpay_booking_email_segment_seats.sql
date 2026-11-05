begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- Version only newly enqueued emails. Existing snapshots and Resend retries
-- remain immutable, including already delivered emails.
create or replace function private.enqueue_booking_confirmation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='confirmed' and old.status<>'confirmed' then
  insert into private.booking_confirmation_mail(booking_id,snapshot)
  values(new.id,jsonb_build_object(
   'version',2,'tripType',new.trip_type,'code',new.booking_code,
   'email',new.contact_email,'total',new.total_amount,
   'segments',(
    select coalesce(jsonb_agg(jsonb_build_object(
     'journeyNumber',s.journey_number,'legNumber',s.leg_number,
     'flight',s.flight_snapshot,
     'passengers',(
      select coalesce(jsonb_agg(jsonb_build_object(
       'name',p.given_names||' '||p.family_name,
       'requiresSeat',ps.requires_seat,
       'seat',(
        select fs.seat_code from public.seat_reservations r
        join public.flight_seats fs on fs.id=r.flight_seat_id and fs.flight_id=ps.flight_id
        where r.booking_id=new.id and r.passenger_segment_id=ps.id and r.status='confirmed'
        order by r.created_at,r.id limit 1
       ),
       'addons',(
        select coalesce(jsonb_agg(jsonb_build_object('name',a.product_name_snapshot,'quantity',a.quantity) order by a.id),'[]'::jsonb)
        from public.booking_addons a where a.booking_id=new.id and a.passenger_segment_id=ps.id
       )
      ) order by p.ordinal),'[]'::jsonb)
      from public.booking_passenger_segments ps
      join public.booking_passengers p on p.id=ps.passenger_id and p.booking_id=new.id
      where ps.booking_id=new.id and ps.segment_id=s.id
     )
    ) order by s.journey_number,s.leg_number),'[]'::jsonb)
    from public.booking_segments s where s.booking_id=new.id
   )
  )) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function private.enqueue_booking_confirmation() from public,anon,authenticated;
commit;
