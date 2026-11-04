do $$declare b uuid;r jsonb;s jsonb;begin
 b:=pg_temp.mock_booking();
 r:=public.begin_vnpay_payment(b,'00000000-0000-4000-8000-000000000081',gen_random_uuid(),'127.0.0.1');
 s:=public.begin_vnpay_payment(b,'00000000-0000-4000-8000-000000000081',gen_random_uuid(),'127.0.0.2');
 if r<>s then raise exception 'Retry duplicated attempt';end if;
 if (select count(*) from public.payments where booking_id=b)<>1 then raise exception 'Duplicate attempt';end if;
 if has_function_privilege('authenticated','public.begin_vnpay_payment(uuid,uuid,uuid,text)','execute') then raise exception 'Service RPC exposed';end if;
 begin perform public.begin_vnpay_payment(b,'00000000-0000-4000-8000-000000000082',gen_random_uuid(),'127.0.0.1');raise exception 'Wrong owner allowed';
 exception when others then if sqlerrm<>'booking.notFound' then raise;end if;end;
end $$;
