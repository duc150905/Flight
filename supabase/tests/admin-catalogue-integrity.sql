-- Run only as a rollback fixture against the candidate forward migration.
begin;
insert into auth.users(id,email,raw_user_meta_data) values ('00000000-0000-4000-8000-000000000091','catalogue-test@example.invalid','{}');
insert into private.user_roles(user_id,role) values ('00000000-0000-4000-8000-000000000091','admin');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);

do $$
declare
  al uuid; dep uuid; arr uuid; ac uuid; f public.flight_instances;
  original_seat uuid; fare public.flight_fares; b uuid; blocked boolean; n integer;
  template jsonb := '[{"seat_code":"1A","row_number":1,"column_number":1,"cabin_class":"economy","position":"window"},{"seat_code":"2A","row_number":2,"column_number":1,"cabin_class":"economy","position":"window"}]';
  six_abreast jsonb := '[{"seat_code":"1A","row_number":1,"column_number":1,"cabin_class":"economy","position":"window"},{"seat_code":"1B","row_number":1,"column_number":2,"cabin_class":"economy","position":"middle"},{"seat_code":"1C","row_number":1,"column_number":3,"cabin_class":"economy","position":"aisle"},{"seat_code":"1D","row_number":1,"column_number":4,"cabin_class":"economy","position":"aisle"},{"seat_code":"1E","row_number":1,"column_number":5,"cabin_class":"economy","position":"middle"},{"seat_code":"1F","row_number":1,"column_number":6,"cabin_class":"economy","position":"window"}]';
  four_abreast jsonb := '[{"seat_code":"1A","row_number":1,"column_number":1,"cabin_class":"business","position":"window"},{"seat_code":"1C","row_number":1,"column_number":2,"cabin_class":"business","position":"aisle"},{"seat_code":"1D","row_number":1,"column_number":3,"cabin_class":"business","position":"aisle"},{"seat_code":"1F","row_number":1,"column_number":4,"cabin_class":"business","position":"window"}]';
begin
  insert into public.airlines(iata_code,name) values ('Z9','Catalogue rollback airline') returning id into al;
  insert into public.airports(iata_code,name,city,country_code,timezone) values ('ZZA','Rollback origin','Rollback','VN','Asia/Ho_Chi_Minh') returning id into dep;
  insert into public.airports(iata_code,name,city,country_code,timezone) values ('ZZB','Rollback destination','Rollback','VN','Asia/Ho_Chi_Minh') returning id into arr;
  ac := (public.admin_upsert_aircraft(null,al,'ROLLBACK-CATALOGUE','Rollback aircraft',true)).id;
  perform public.admin_upsert_aircraft_seats(ac,template);
  select id into original_seat from public.seats where aircraft_id=ac and seat_code='1A';
  perform public.admin_upsert_aircraft_seats(ac,jsonb_build_array(template->0));
  select count(*) into n from public.seats where aircraft_id=ac and is_active;
  if n<>1 then raise exception 'REGRESSION: template shrink retained omitted active seats (% active)',n; end if;
  if not exists(select 1 from public.seats where id=original_seat and is_active) then raise exception 'REGRESSION: stable seat identity lost'; end if;
  -- A cabin replacement of an unused template must update the retained seat, not duplicate it.
  perform public.admin_upsert_aircraft_seats(ac,jsonb_build_array((template->0)||'{"cabin_class":"business"}'::jsonb));
  if not exists(select 1 from public.seats where id=original_seat and cabin_class='business') then raise exception 'REGRESSION: cabin replacement lost seat identity'; end if;
  perform public.admin_upsert_aircraft_seats(ac,six_abreast);
  perform public.admin_upsert_aircraft_seats(ac,four_abreast);
  if (select count(*) from public.seats where aircraft_id=ac and is_active)<>4 then raise exception 'REGRESSION: six-to-four cabin replacement has wrong seat count'; end if;
  if not exists(select 1 from public.seats where aircraft_id=ac and seat_code='1C' and column_number=2 and is_active) then raise exception 'REGRESSION: retained seat geometry did not move'; end if;
  perform public.admin_upsert_aircraft_seats(ac,six_abreast);
  if (select count(*) from public.seats where aircraft_id=ac and is_active)<>6 then raise exception 'REGRESSION: four-to-six cabin replacement has wrong seat count'; end if;
  if not exists(select 1 from public.seats where id=original_seat and is_active) then raise exception 'REGRESSION: cabin expansion changed retained seat identity'; end if;
  perform public.admin_upsert_aircraft_seats(ac,jsonb_build_array((template->0)||'{"cabin_class":"business"}'::jsonb));
  begin
    perform public.admin_upsert_aircraft_seats(ac,jsonb_build_array(template->0,template->0));
    raise exception 'REGRESSION: duplicate seat codes accepted';
  exception when check_violation then null; end;
  begin
    perform public.admin_upsert_aircraft_seats(ac,jsonb_build_array(template->0,(template->0)||'{"seat_code":"1B"}'::jsonb));
    raise exception 'REGRESSION: duplicate active seat positions accepted';
  exception when check_violation then null; end;
  f := public.admin_save_flight_instance(null,al,ac,'Z9001',dep,arr,'2037-01-01 08:00Z','2037-01-01 10:00Z',null,'scheduled',false);
  if f.published_at is not null then raise exception 'REGRESSION: scheduled publish=false was published'; end if;
  if (select count(*) from public.flight_seats where flight_id=f.id)<>1 then raise exception 'REGRESSION: inventory copied omitted template seats'; end if;
  begin
    perform public.admin_upsert_aircraft_seats(ac,template);
    raise exception 'REGRESSION: template with flight inventory was editable';
  exception when check_violation then null; end;
  begin
    perform public.admin_save_flight_fare(p_flight_id=>f.id,p_fare_code=>'NO_ECO',p_cabin_class=>'economy',p_name=>'Missing economy',p_adult_base_amount=>100,p_child_base_amount=>100,p_infant_base_amount=>0);
    raise exception 'REGRESSION: active fare accepted a missing cabin';
  exception when check_violation then null; end;
  update public.flight_seats set is_blocked=true where flight_id=f.id;
  begin
    perform public.admin_save_flight_fare(p_flight_id=>f.id,p_fare_code=>'BLOCKED_BUS',p_cabin_class=>'business',p_name=>'Blocked business',p_adult_base_amount=>100,p_child_base_amount=>100,p_infant_base_amount=>0);
    raise exception 'REGRESSION: active fare accepted an entirely blocked cabin';
  exception when check_violation then null; end;
  update public.flight_seats set is_blocked=false where flight_id=f.id;
  fare := public.admin_save_flight_fare(p_flight_id=>f.id,p_fare_code=>'BUS',p_cabin_class=>'business',p_name=>'Business',p_adult_base_amount=>100,p_child_base_amount=>100,p_infant_base_amount=>0);
  begin
    perform public.admin_update_flight_seat((select id from public.flight_seats where flight_id=f.id limit 1),true,null);
    raise exception 'REGRESSION: last unblocked seat was blocked while its cabin fare remained active';
  exception when check_violation then null; end;
  f := public.admin_save_flight_instance(f.id,al,ac,f.flight_number,dep,arr,f.departure_at,f.arrival_at,f.sales_close_at,'scheduled',true);
  begin
    perform public.admin_save_flight_instance(f.id,al,ac,f.flight_number,dep,arr,f.departure_at,f.arrival_at,f.sales_close_at,'departed',false);
    raise exception 'REGRESSION: departed flight allowed unpublication';
  exception when check_violation then null; end;
  if f.published_at is null then raise exception 'REGRESSION: publish=true did not publish'; end if;
  f := public.admin_save_flight_instance(f.id,al,ac,f.flight_number,dep,arr,f.departure_at,f.arrival_at,f.sales_close_at,'scheduled',false);
  if f.published_at is not null then raise exception 'REGRESSION: existing flight did not unpublish'; end if;
  f := public.admin_save_flight_instance(f.id,al,ac,f.flight_number,dep,arr,f.departure_at,f.arrival_at,f.sales_close_at,'scheduled',true);
  insert into public.bookings(user_id,booking_code,create_request_id,create_request_hash,trip_type,contact_name,contact_email,contact_phone,base_amount,tax_amount,fee_amount,seat_amount,addon_amount,total_amount,refund_policy_snapshot,expires_at)
    values(auth.uid(),'CATALOGUETEST',gen_random_uuid(),'catalogue-test','one_way','Test','catalogue-test@example.invalid','0901234567',100,0,0,0,0,100,'{}',now()+interval '10 minutes') returning id into b;
  insert into public.booking_segments(booking_id,flight_id,fare_id,journey_number,leg_number,flight_snapshot,fare_code_snapshot,cabin_class)
    values(b,f.id,fare.id,1,1,'{}','BUS','business');
  begin
    perform public.admin_save_flight_instance(f.id,al,ac,f.flight_number,dep,arr,f.departure_at,f.arrival_at,f.sales_close_at,'scheduled',false);
    raise exception 'REGRESSION: active booking allowed unpublication';
  exception when check_violation then null; end;
  -- New baggage configuration is exactly one; no historic snapshots are rewritten.
  insert into public.addon_products(code,name,category,weight_kg) values ('ROLLBACK_BAG','Rollback baggage','baggage',20) returning id into b;
  begin
    insert into public.flight_addon_offers(flight_id,product_id,unit_amount,max_quantity_per_passenger) values(f.id,b,100,2);
    raise exception 'REGRESSION: baggage quantity 2 accepted';
  exception when check_violation then null; end;
  begin
    insert into public.addon_products(code,name,category) values ('ROLLBACK_MEAL','Rollback meal','meal');
    raise exception 'REGRESSION: unsupported meal configuration accepted';
  exception when check_violation then null; end;
  insert into public.addon_products(code,name,category,is_active) values ('ROLLBACK_MEAL_INACTIVE','Read-only meal','meal',false) returning id into b;
  update public.addon_products set is_active=false where id=b; -- idempotent seed no-op
  begin
    update public.addon_products set is_active=true where id=b;
    raise exception 'REGRESSION: unsupported meal activation accepted';
  exception when check_violation then null; end;
  begin
    update public.addon_products set name='Changed read-only meal' where id=b;
    raise exception 'REGRESSION: unsupported meal editing accepted';
  exception when check_violation then null; end;
  begin
    update public.airlines set logo_path='airlines/arbitrary-new.png' where id=al;
    raise exception 'REGRESSION: arbitrary relative logo accepted';
  exception when check_violation then null; end;
  update public.airlines set logo_path='https://example.invalid/logo.png' where id=al;
  insert into public.destinations(airport_id,slug,title,image_path) values (dep,'rollback-catalogue','Rollback destination','destinations/da-nang.jpg') returning id into b;
  begin
    update public.destinations set image_path='destinations/arbitrary-new.jpg' where id=b;
    raise exception 'REGRESSION: arbitrary relative destination picture accepted';
  exception when check_violation then null; end;
  update public.destinations set image_path='https://example.invalid/destination.jpg' where id=b;
  raise notice 'Catalogue regression rollback suite passed';
end $$;
rollback;
