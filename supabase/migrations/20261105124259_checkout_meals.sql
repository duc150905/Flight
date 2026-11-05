begin;
set local lock_timeout='10s';
set local statement_timeout='60s';

-- Patch the installed owner functions rather than restating older definitions:
-- this preserves account-access checks, request fencing, locks and idempotency.
-- Every expected source fragment is asserted, so schema drift aborts atomically.
do $migration$
declare definition text; change record;
begin
 definition:=replace(pg_get_functiondef('private.quote_checkout(jsonb)'::regprocedure),E'\r\n',E'\n');
 if position('perform private.require_active_account()' in definition)=0 then raise exception 'Missing quote active-account guard'; end if;
 for change in select * from (values
 ($from$  bag_name text; seat_code text; trip text; seen text[]:='{}'; k text;$from$,
  $to$  bag_name text; seat_code text; trip text; seen text[]:='{}'; k text;
  meal_amount bigint:=0; meal_name text; total_meal bigint:=0;$to$),
 ($from$  n:=jsonb_array_length(p_request->'passengers');$from$,
  $to$  if p_request ? 'meals' and jsonb_typeof(p_request->'meals') is distinct from 'array' then raise exception using message='quote.invalid'; end if;
  if jsonb_array_length(coalesce(p_request->'meals','[]'::jsonb))>jsonb_array_length(p_request->'passengers')*12 then raise exception using message='quote.invalid'; end if;
  n:=jsonb_array_length(p_request->'passengers');$to$),
 ($from$  foreach k in array array['baggage','seats'] loop$from$,
  $to$  foreach k in array array['baggage','seats','meals'] loop$to$),
 ($from$jsonb_array_elements(p_request->k)$from$,
  $to$jsonb_array_elements(coalesce(p_request->k,'[]'::jsonb))$to$),
 ($from$case when k='baggage' then 'offerId' else 'seatId' end$from$,
  $to$case when k='seats' then 'seatId' else 'offerId' end$to$),
 ($from$      bag:=0;seat_fee:=0;bag_name:=null;seat_code:=null;$from$,
  $to$      bag:=0;seat_fee:=0;bag_name:=null;seat_code:=null;meal_amount:=0;meal_name:=null;$to$),
 ($from$      select value into extra from jsonb_array_elements(p_request->'seats') where value->>'flightId'=f.id::text and value->>'passengerId'=traveller->>'id';$from$,
  $to$      select value into extra from jsonb_array_elements(coalesce(p_request->'meals','[]'::jsonb)) where value->>'flightId'=f.id::text and value->>'passengerId'=traveller->>'id';
      if extra is not null then
        select * into offer from public.flight_addon_offers where id=(extra->>'offerId')::uuid and flight_id=f.id and is_active and max_quantity_per_passenger=1;
        if not found then raise exception using message='quote.offerUnavailable'; end if;
        select * into product from public.addon_products where id=offer.product_id and is_active and category='meal';
        if not found or offer.currency<>'VND' then raise exception using message='quote.offerUnavailable'; end if;
        meal_amount:=offer.unit_amount;meal_name:=product.name;
      end if;
      select value into extra from jsonb_array_elements(p_request->'seats') where value->>'flightId'=f.id::text and value->>'passengerId'=traveller->>'id';$to$),
 ($from$      lines:=lines||jsonb_build_array(item);$from$,
  $to$      total_meal:=total_meal+meal_amount;
      if p_request ? 'meals' then item:=item||jsonb_build_object('meal',meal_amount,'mealName',meal_name); end if;
      lines:=lines||jsonb_build_array(item);$to$),
 ($from$  total:=total_base+total_tax+total_fee+total_bag+total_seat;$from$,
  $to$  total:=total_base+total_tax+total_fee+total_bag+total_seat+total_meal;$to$),
 ($from$    'quotedAt',v_now,'expiresAt',v_now+interval '5 minutes','lines',lines);$from$,
  $to$    'quotedAt',v_now,'expiresAt',v_now+interval '5 minutes','lines',lines)
    ||case when p_request ? 'meals' then jsonb_build_object('meal',total_meal) else '{}'::jsonb end;$to$)
 ) as edits(before_text,after_text) loop
  if position(change.before_text in definition)=0 then raise exception 'Quote migration source drift: %',change.before_text; end if;
  definition:=replace(definition,change.before_text,change.after_text);
 end loop;
 execute definition;

 definition:=replace(pg_get_functiondef('private.create_booking(uuid,jsonb)'::regprocedure),E'\r\n',E'\n');
 if position('perform private.require_active_account()' in definition)=0 then raise exception 'Missing booking active-account guard'; end if;
 for change in select * from (values
 -- Both offer and product locks include all selected categories, in UUID order.
 ($from$jsonb_array_elements(payload->'baggage')$from$,
  $to$jsonb_array_elements((payload->'baggage')||coalesce(payload->'meals','[]'::jsonb))$to$),
 ($from$(q->>'baggage')::bigint,(q->>'total')::bigint$from$,
  $to$(q->>'baggage')::bigint+coalesce((q->>'meal')::bigint,0),(q->>'total')::bigint$to$),
 ($from$   select value into extra from jsonb_array_elements((payload->'baggage')||coalesce(payload->'meals','[]'::jsonb)) where value->>'flightId'=f.id::text and value->>'passengerId'=line->>'passengerId';
   if extra is not null then$from$,
  $to$   for extra in select value from jsonb_array_elements((payload->'baggage')||coalesce(payload->'meals','[]'::jsonb)) where value->>'flightId'=f.id::text and value->>'passengerId'=line->>'passengerId' loop$to$),
 ($from$    select bid,psid,f.id,o.id,p.name,p.category,p.weight_kg,1,o.unit_amount from public.flight_addon_offers o join public.addon_products p on p.id=o.product_id where o.id=(extra->>'offerId')::uuid;
   end if;$from$,
  $to$    select bid,psid,f.id,o.id,p.name,p.category,p.weight_kg,1,o.unit_amount from public.flight_addon_offers o join public.addon_products p on p.id=o.product_id where o.id=(extra->>'offerId')::uuid;
   end loop;$to$)
 ) as edits(before_text,after_text) loop
  if position(change.before_text in definition)=0 then raise exception 'Booking migration source drift: %',change.before_text; end if;
  definition:=replace(definition,change.before_text,change.after_text);
 end loop;
 execute definition;

 definition:=replace(pg_get_functiondef('private.get_pending_booking(uuid)'::regprocedure),E'\r\n',E'\n');
 if position('perform private.require_active_account()' in definition)=0 then raise exception 'Missing pending booking active-account guard'; end if;
 for change in select * from (values
 -- Keep baggage as the aggregate legacy alias so installed clients still balance totals.
 ($from$'baggage',b.addon_amount,'seat',b.seat_amount,$from$,
  $to$'baggage',b.addon_amount,'seat',b.seat_amount,
 'baggageOnly',(select coalesce(sum(a.total_amount),0) from public.booking_addons a where a.booking_id=b.id and a.category_snapshot='baggage'),
 'meal',(select coalesce(sum(a.total_amount),0) from public.booking_addons a where a.booking_id=b.id and a.category_snapshot='meal'),$to$),
 ($from$'name',a.product_name_snapshot,'weightKg',a.weight_kg_snapshot$from$,
  $to$'name',a.product_name_snapshot,'category',a.category_snapshot,'weightKg',a.weight_kg_snapshot$to$)
 ) as edits(before_text,after_text) loop
  if position(change.before_text in definition)=0 then raise exception 'Pending migration source drift: %',change.before_text; end if;
  definition:=replace(definition,change.before_text,change.after_text);
 end loop;
 execute definition;
end $migration$;

-- The catalogue may author the two services the checkout now snapshots. Category
-- identity is immutable: historical offers must never silently change service type.
create or replace function private.enforce_checkout_catalogue_capability()
returns trigger language plpgsql security invoker set search_path='' as $$
declare new_category public.addon_category; old_category public.addon_category;
begin
 if tg_op='UPDATE' and (to_jsonb(new)-'updated_at') is not distinct from (to_jsonb(old)-'updated_at') then return new; end if;
 if tg_table_name='addon_products' then
  if tg_op='UPDATE' and new.category is distinct from old.category then
   raise exception 'Cannot change an existing add-on product category' using errcode='23514';
  end if;
  -- Preserve reference-only inactive insurance rows used by idempotent seeds.
  if tg_op='INSERT' and new.category not in ('baggage','meal') and not new.is_active then return new; end if;
  if new.category not in ('baggage','meal') then
   raise exception 'Insurance is read-only: checkout supports baggage and meals only' using errcode='23514';
  end if;
 else
  if new.max_quantity_per_passenger<>1 then
   raise exception 'Checkout supports one add-on choice per category per passenger per leg; max quantity must be 1' using errcode='23514';
  end if;
  select p.category into new_category from public.addon_products p where p.id=new.product_id;
  if tg_op='UPDATE' then
   select p.category into old_category from public.addon_products p where p.id=old.product_id;
   if new_category is distinct from old_category then
    raise exception 'Cannot change an existing add-on offer category' using errcode='23514';
   end if;
  end if;
  if new_category is null or new_category not in ('baggage','meal') then
   raise exception 'Insurance is read-only: checkout supports baggage and meals only' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.enforce_checkout_catalogue_capability() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
