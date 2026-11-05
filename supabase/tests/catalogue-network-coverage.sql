-- Public search coverage for the C4 Flyora inventory, no customer data.
begin isolation level repeatable read read only;
set local role anon;
with hubs as (
 select id from public.airports where iata_code in ('SGN','HAN','DAD') and is_active
), routes as (
 select h.id as origin,a.id as destination from hubs h cross join public.airports a where a.id<>h.id and a.is_active
 union
 select a.id,h.id from hubs h cross join public.airports a where a.id<>h.id and a.is_active
), dates as (
 select date '2026-11-06'+n as day from generate_series(0,29) n
), cabins(cabin) as (values ('economy'),('premium_economy'),('business'),('first')),
coverage as (
 select f.departure_airport_id as origin,f.arrival_airport_id as destination,
  (f.departure_at at time zone dep.timezone)::date as day,fa.cabin_class::text as cabin,count(*) as offers
 from public.flight_instances f
 join public.airports dep on dep.id=f.departure_airport_id and dep.is_active
 join public.airports arr on arr.id=f.arrival_airport_id and arr.is_active
 join public.airlines a on a.id=f.airline_id and a.is_active and a.iata_code='F0'
 join public.flight_fares fa on fa.flight_id=f.id and fa.is_active
 where f.flight_number like 'F08%' and f.published_at is not null
 and f.status in ('scheduled','delayed') and f.sales_close_at>now() and f.departure_at>now()
 group by 1,2,3,4
)
select count(*) as expected_route_date_cabins,
 count(*) filter(where c.offers is null) as missing_route_date_cabins,
 (select count(*) from coverage) as network_route_date_cabins,
 17040 as expected_network_route_date_cabins,
 count(distinct (r.origin,r.destination)) as hub_directions,
 (select count(*) from public.airports where is_active) as active_airports
from routes r cross join dates d cross join cabins ca
left join coverage c on c.origin=r.origin and c.destination=r.destination and c.day=d.day and c.cabin=ca.cabin;
commit;
