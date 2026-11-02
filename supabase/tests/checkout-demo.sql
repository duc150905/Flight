-- Requires checkout-demo seed for today's Asia/Ho_Chi_Minh batch. No writes retained.
begin;
do $$
declare airline uuid; flights integer; fares integer; seats integer; offers integer;
begin
  select id into airline from public.airlines where iata_code='F0' and name='Flight Checkout Demo';
  select count(*) into flights from public.flight_instances where airline_id=airline
    and flight_number in ('F0101','F0102','F0103')
    and (departure_at at time zone 'Asia/Ho_Chi_Minh')::date in
      ((now() at time zone 'Asia/Ho_Chi_Minh')::date+14,(now() at time zone 'Asia/Ho_Chi_Minh')::date+18,(now() at time zone 'Asia/Ho_Chi_Minh')::date+21);
  if flights<>3 then raise exception 'Expected three future demo flights, found %',flights; end if;
  select count(*) into fares from public.flight_fares p join public.flight_instances f on f.id=p.flight_id
    where f.airline_id=airline and f.departure_at>now() and p.fare_code in ('DEMO_STANDARD','DEMO_FLEX');
  if fares<6 then raise exception 'Missing demo fares'; end if;
  select count(*) into seats from public.flight_seats s join public.flight_instances f on f.id=s.flight_id
    where f.airline_id=airline and f.departure_at>now();
  if seats<72 then raise exception 'Missing demo seat maps'; end if;
  select count(*) into offers from public.flight_addon_offers o join public.flight_instances f on f.id=o.flight_id
    where f.airline_id=airline and f.departure_at>now();
  if offers<6 then raise exception 'Missing baggage offers'; end if;
end $$;
set local role anon;
do $$
declare flight uuid; seat_count integer; blocked_count integer;
begin
  select f.id into flight from public.flight_instances f join public.airlines a on a.id=f.airline_id
    where a.iata_code='F0' and f.flight_number='F0101' and f.departure_at>now() order by f.departure_at desc limit 1;
  if flight is null then raise exception 'Public flight read denied'; end if;
  if (select count(*) from public.flight_fares where flight_id=flight and is_active)<>2 then raise exception 'Public fares missing'; end if;
  if (select count(*) from public.flight_addon_offers where flight_id=flight and is_active)<>2 then raise exception 'Public offers missing'; end if;
  select count(*), count(*) filter(where availability='blocked') into seat_count,blocked_count from public.get_seat_map(flight);
  if seat_count<>24 or blocked_count<>1 then raise exception 'Safe public seat map incorrect: %, %',seat_count,blocked_count; end if;
end $$;
select 'three flights, six fares, baggage offers and seat maps verified through public RLS/RPC' as result;
rollback;
