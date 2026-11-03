set local role authenticated;
do $$declare bid uuid:=pg_temp.mock_booking();s jsonb;pid uuid;begin
 s:=public.start_mock_payment(bid,gen_random_uuid());pid:=(s->'payments'->0->>'id')::uuid;
 s:=public.resolve_mock_payment(pid,gen_random_uuid(),'succeeded');
 s:=public.cancel_booking(bid,gen_random_uuid(),(s->'cancellation'->>'fee')::bigint);
 s:=public.refund_mock_booking(bid,gen_random_uuid(),'succeeded');
 if s->'refunds'->0->>'status'<>'succeeded' then raise exception 'Authenticated lifecycle failed';end if;
 perform set_config('mock.test_booking',bid::text,true);
 perform set_config('mock.test_payment',pid::text,true);
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000082',true);
set local role authenticated;
do $$declare actual text;denied boolean:=false;begin
 begin perform public.get_mock_payment_state(current_setting('mock.test_booking')::uuid);exception when others then actual:=sqlerrm;end;
 if actual is distinct from 'booking.notFound' then raise exception 'Cross-owner access';end if;
 actual:=null;begin perform public.resolve_mock_payment(current_setting('mock.test_payment')::uuid,gen_random_uuid(),'succeeded');exception when others then actual:=sqlerrm;end;
 if actual is distinct from 'booking.notFound' then raise exception 'Cross-owner resolve';end if;
 actual:=null;begin perform public.cancel_booking(current_setting('mock.test_booking')::uuid,gen_random_uuid(),0);exception when others then actual:=sqlerrm;end;
 if actual is distinct from 'booking.notFound' then raise exception 'Cross-owner cancel';end if;
 actual:=null;begin perform public.refund_mock_booking(current_setting('mock.test_booking')::uuid,gen_random_uuid(),'succeeded');exception when others then actual:=sqlerrm;end;
 if actual is distinct from 'booking.notFound' then raise exception 'Cross-owner refund';end if;
 if exists(select 1 from public.payments where booking_id=current_setting('mock.test_booking')::uuid) then raise exception 'Cross-owner payment RLS';end if;
 begin update public.payments set status='succeeded' where booking_id=current_setting('mock.test_booking')::uuid;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Direct payment writes allowed';end if;
end $$;
reset role;
set local role anon;
do $$declare denied boolean:=false;begin
 begin perform public.start_mock_payment(current_setting('mock.test_booking')::uuid,gen_random_uuid());exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous mock payment';end if;
end $$;
reset role;
