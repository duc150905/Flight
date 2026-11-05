-- Read-only search scenarios. Every date is local to the departure airport.
-- Run after the 06 Nov–05 Dec 2026 catalogue expansion.
-- Uses the public discovery role. Seat/addon inventory is checked separately
-- by catalogue-expansion.sql; discovery does not bypass authenticated seat RPCs.
begin isolation level repeatable read read only;
set local role anon;

with requested(scenario,trip_type,step,origin,destination,day) as (values
  ('Phu Quoc - Nha Trang','round_trip',1,'PQC','CXR',date '2026-11-07'),
  ('Phu Quoc - Nha Trang','round_trip',2,'CXR','PQC',date '2026-11-11'),
  ('Singapore - Bangkok','round_trip',1,'SIN','BKK',date '2026-11-08'),
  ('Singapore - Bangkok','round_trip',2,'BKK','SIN',date '2026-11-12'),
  ('Seoul - Tokyo','round_trip',1,'ICN','NRT',date '2026-11-10'),
  ('Seoul - Tokyo','round_trip',2,'NRT','ICN',date '2026-11-15'),
  ('Domestic four legs','multi_city',1,'DAD','PQC',date '2026-11-07'),
  ('Domestic four legs','multi_city',2,'PQC','CXR',date '2026-11-09'),
  ('Domestic four legs','multi_city',3,'CXR','DLI',date '2026-11-11'),
  ('Domestic four legs','multi_city',4,'DLI','DAD',date '2026-11-13'),
  ('International three legs','multi_city',1,'DAD','SIN',date '2026-11-08'),
  ('International three legs','multi_city',2,'SIN','BKK',date '2026-11-10'),
  ('International three legs','multi_city',3,'BKK','DAD',date '2026-11-12'),
  ('Southeast Asia five legs','multi_city',1,'SGN','KUL',date '2026-11-09'),
  ('Southeast Asia five legs','multi_city',2,'KUL','SIN',date '2026-11-11'),
  ('Southeast Asia five legs','multi_city',3,'SIN','BKK',date '2026-11-13'),
  ('Southeast Asia five legs','multi_city',4,'BKK','KUL',date '2026-11-15'),
  ('Southeast Asia five legs','multi_city',5,'KUL','SGN',date '2026-11-17'),
  ('Northeast Asia five legs','multi_city',1,'SGN','ICN',date '2026-11-07'),
  ('Northeast Asia five legs','multi_city',2,'ICN','NRT',date '2026-11-10'),
  ('Northeast Asia five legs','multi_city',3,'NRT','HAN',date '2026-11-13'),
  ('Northeast Asia five legs','multi_city',4,'HAN','DAD',date '2026-11-15'),
  ('Northeast Asia five legs','multi_city',5,'DAD','SGN',date '2026-11-17')
), chosen as (
  select r.*, candidate.* from requested r
  left join lateral (
    select f.id as flight_id, f.flight_number, f.departure_at, f.arrival_at,
      to_char(f.departure_at at time zone dep.timezone,'DD/MM/YYYY HH24:MI') as departure_local,
      to_char(f.arrival_at at time zone arr.timezone,'DD/MM/YYYY HH24:MI') as arrival_local,
      dep.timezone as departure_timezone, arr.timezone as arrival_timezone,
      fare.adult_base_amount+fare.adult_tax_amount+fare.adult_fee_amount as adult_total_vnd,
      fare.baggage_allowance
    from public.flight_instances f
    join public.airports dep on dep.id=f.departure_airport_id and dep.is_active
    join public.airports arr on arr.id=f.arrival_airport_id and arr.is_active
    join public.airlines carrier on carrier.id=f.airline_id and carrier.is_active
    join public.flight_fares fare on fare.flight_id=f.id and fare.is_active
      and fare.cabin_class='economy' and fare.fare_code='ECO_FLEX'
    where dep.iata_code=r.origin and arr.iata_code=r.destination
      and (f.departure_at at time zone dep.timezone)::date=r.day
      and f.status in ('scheduled','delayed') and f.published_at is not null
      and f.sales_close_at>now() and f.departure_at>now()
    order by f.departure_at,f.id limit 1
  ) candidate on true
), sequenced as (
  select *,lag(arrival_at) over(partition by scenario order by step) as previous_arrival
  from chosen
)
select scenario,trip_type,count(*) as expected_legs,
  count(flight_id) as found_legs,
  bool_and(flight_id is not null and arrival_at>departure_at
    and (previous_arrival is null or departure_at>previous_arrival)) as passed,
  sum(adult_total_vnd) as one_adult_flex_total_vnd,
  jsonb_agg(jsonb_build_object('step',step,'origin',origin,'destination',destination,
    'flight_number',flight_number,'departure_local',departure_local,'arrival_local',arrival_local,
    'departure_timezone',departure_timezone,'arrival_timezone',arrival_timezone,
    'adult_flex_total_vnd',adult_total_vnd,'baggage_allowance',baggage_allowance) order by step) as legs
from sequenced group by scenario,trip_type order by scenario;
commit;
