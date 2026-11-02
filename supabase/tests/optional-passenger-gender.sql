-- Rollback-only schema check: no real booking or passenger is created/read.
begin;
create temporary table gender_probe (like public.booking_passengers including constraints) on commit drop;
do $$
begin
  insert into gender_probe (id,booking_id,ordinal,given_names,family_name,date_of_birth,gender,created_at,updated_at)
    values (gen_random_uuid(),gen_random_uuid(),1,'Demo','Traveller','2000-01-01','female',now(),now());
  insert into gender_probe (id,booking_id,ordinal,given_names,family_name,date_of_birth,gender,created_at,updated_at)
    values (gen_random_uuid(),gen_random_uuid(),2,'Demo','Traveller','2000-01-01',null,now(),now());
  begin
    insert into gender_probe (id,booking_id,ordinal,given_names,family_name,date_of_birth,gender,created_at,updated_at)
      values (gen_random_uuid(),gen_random_uuid(),3,'Demo','Traveller','2000-01-01','invalid',now(),now());
    raise exception 'Invalid gender unexpectedly accepted';
  exception when check_violation then null;
  end;
  if not (select relrowsecurity from pg_class where oid='public.booking_passengers'::regclass) then
    raise exception 'Passenger RLS disabled';
  end if;
  if has_table_privilege('authenticated','public.booking_passengers','INSERT') then
    raise exception 'Direct passenger INSERT unexpectedly granted';
  end if;
end $$;
select 'gender nullable, constrained; RLS enabled and direct INSERT denied' as result;
rollback;
