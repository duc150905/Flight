-- Preserve each SELECT predicate while evaluating one policy per role/action.
begin;
set local lock_timeout='10s';
set local statement_timeout='30s';
do $policies$
declare t record; p record;
begin
  for t in
    select tablename,string_agg('('||qual||')',' OR ' order by policyname) as predicate,
      bool_or('anon'::name=any(roles)) as allow_anon
    from pg_catalog.pg_policies
    where schemaname='public' and cmd='SELECT' and tablename in
      ('profiles','airports','airlines','destinations','addon_products','flight_instances','flight_fares',
       'flight_addon_offers','bookings','booking_segments','booking_passengers','booking_passenger_segments',
       'seat_reservations','booking_addons','payments','refunds','booking_events')
    group by tablename having count(*)>1
  loop
    for p in select policyname from pg_catalog.pg_policies
      where schemaname='public' and tablename=t.tablename and cmd='SELECT'
    loop execute format('drop policy %I on public.%I',p.policyname,t.tablename); end loop;
    execute format('create policy read_authorized on public.%I for select to %s using(%s)',
      t.tablename,case when t.allow_anon then 'anon,authenticated' else 'authenticated' end,t.predicate);
  end loop;
end $policies$;

-- Some hosted projects include this platform event-trigger helper in public.
-- It needs no client EXECUTE permission; retain the event trigger's behavior.
do $platform_helper$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public,anon,authenticated;
  end if;
end $platform_helper$;
notify pgrst,'reload schema';
commit;
