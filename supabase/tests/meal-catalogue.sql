-- Read-only verification after the meal capability migration and guarded seed.
begin isolation level repeatable read read only;
do $$
declare menu_codes text[] := array['MEAL_CHICKEN_RICE','MEAL_BEEF_RICE','MEAL_TOFU_RICE',
  'MEAL_CHICKEN_SANDWICH','MEAL_VEGETABLE_PASTA','MEAL_FRUIT_YOGURT'];
begin
  if (select count(*) from public.addon_products p where p.code=any(menu_codes)
      and p.id=md5('flyora-meal-catalogue-v1:product:' || p.code)::uuid
      and p.category='meal' and p.weight_kg is null) <> cardinality(menu_codes) then
    raise exception 'Expected all six meal products with stable identities';
  end if;
  if exists(select 1 from public.flight_instances f cross join public.addon_products p
    where p.code=any(menu_codes) and p.is_active and f.published_at is not null
      and f.status in ('scheduled','delayed') and f.sales_close_at>now() and f.departure_at>now()
      and not exists(select 1 from public.flight_addon_offers o where o.flight_id=f.id and o.product_id=p.id)) then
    raise exception 'Published open flight is missing a meal offer: rerun meal-catalogue.sql after adding flights';
  end if;
  if exists(select 1 from public.flight_addon_offers o join public.addon_products p on p.id=o.product_id
    where p.code=any(menu_codes) and o.is_active and (o.max_quantity_per_passenger<>1 or o.currency<>'VND')) then
    raise exception 'Meal offer quantity/currency exceeds checkout capability';
  end if;
end $$;
select p.code,p.name,count(o.id) as offers,count(o.id) filter(where o.is_active) as active_offers,
  min(o.unit_amount) as minimum_price_vnd,max(o.unit_amount) as maximum_price_vnd
from public.addon_products p left join public.flight_addon_offers o on o.product_id=p.id
where p.code in ('MEAL_CHICKEN_RICE','MEAL_BEEF_RICE','MEAL_TOFU_RICE','MEAL_CHICKEN_SANDWICH','MEAL_VEGETABLE_PASTA','MEAL_FRUIT_YOGURT')
group by p.code,p.name order by p.code;
commit;
