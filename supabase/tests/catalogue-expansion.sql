-- Read-only assertions for the dedicated expansion inventory. No customer data returned.
begin isolation level repeatable read read only;
do $$
begin
  if (select count(*) from public.aircraft where registration_code like 'FLY-%-%-%')<>36 then
    raise exception 'Expected 36 dedicated aircraft'; end if;
  if exists(select 1 from public.flight_instances f join public.aircraft a on a.id=f.aircraft_id
    where a.registration_code like 'FLY-%-%-%' and (
      f.arrival_at<=f.departure_at or f.sales_close_at>f.departure_at or
      not exists(select 1 from public.flight_fares ff where ff.flight_id=f.id and ff.fare_code='ECO_SAVER') or
      not exists(select 1 from public.flight_seats fs where fs.flight_id=f.id) or
      (select count(*) from public.flight_addon_offers o join public.addon_products p on p.id=o.product_id
        where o.flight_id=f.id and p.category='baggage' and o.is_active and p.is_active)<>2)) then
    raise exception 'Incomplete or invalid inventory'; end if;
  if exists(select 1 from public.flight_fares ff join public.flight_instances f on f.id=ff.flight_id
    join public.aircraft a on a.id=f.aircraft_id where a.registration_code like 'FLY-%-%-%'
    and not exists(select 1 from public.flight_seats fs where fs.flight_id=f.id and fs.cabin_class=ff.cabin_class and not fs.is_blocked)) then
    raise exception 'Fare cabin has no compatible seats'; end if;
  if exists(select 1 from public.flight_seats fs join public.flight_instances f on f.id=fs.flight_id
    join public.aircraft a on a.id=f.aircraft_id join public.seats s on s.id=fs.seat_id
    where a.registration_code like 'FLY-%-%-%' and
      (s.aircraft_id<>f.aircraft_id or s.seat_code<>fs.seat_code or s.row_number<>fs.row_number or s.column_number<>fs.column_number or s.cabin_class<>fs.cabin_class)) then
    raise exception 'Seat geometry differs from template'; end if;
  if exists(select 1 from (select f.departure_at,
      lag(f.arrival_at) over(partition by f.aircraft_id order by f.departure_at) previous_arrival
    from public.flight_instances f join public.aircraft a on a.id=f.aircraft_id
    where a.registration_code like 'FLY-%-%-%') rotation
    where previous_arrival>departure_at-interval '90 minutes') then
    raise exception 'Aircraft rotations overlap or turnaround is too short'; end if;
  if exists(select 1 from public.airlines where name ~* 'demo|synthetic|mô phỏng') or
    exists(select 1 from public.aircraft where model_name ~* 'demo|synthetic|mô phỏng' or registration_code ~* 'demo') or
    exists(select 1 from public.flight_fares where name ~* 'demo|synthetic|mô phỏng') or
    exists(select 1 from public.addon_products where name ~* 'demo|synthetic|mô phỏng' or description ~* 'demo|synthetic|mô phỏng') then
    raise exception 'Legacy catalogue display labels remain'; end if;
end $$;
select jsonb_build_object('inventory_checks','passed','route_directions',count(distinct (f.departure_airport_id,f.arrival_airport_id)),
  'flights',count(*),'first_departure',min(f.departure_at),'last_departure',max(f.departure_at)) as verification
from public.flight_instances f join public.aircraft a on a.id=f.aircraft_id where a.registration_code like 'FLY-%-%-%';
select dep.iata_code as origin,arr.iata_code as destination,f.flight_number,
  to_char(f.departure_at at time zone dep.timezone,'DD/MM/YYYY HH24:MI') as departure_local,
  to_char(f.arrival_at at time zone arr.timezone,'DD/MM/YYYY HH24:MI') as arrival_local,
  ff.adult_base_amount+ff.adult_tax_amount+ff.adult_fee_amount as adult_total_vnd
from public.flight_instances f join public.aircraft a on a.id=f.aircraft_id
join public.airports dep on dep.id=f.departure_airport_id join public.airports arr on arr.id=f.arrival_airport_id
join public.flight_fares ff on ff.flight_id=f.id and ff.fare_code='ECO_SAVER'
where a.registration_code like 'FLY-%-%-%' and f.departure_at::date='2026-11-06'
  and (dep.iata_code,arr.iata_code) in (('DAD','PQC'),('DAD','ICN'),('HAN','NRT'),('SGN','DPS'))
order by dep.iata_code,arr.iata_code;
commit;
