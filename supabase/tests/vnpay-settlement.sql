do $$declare b uuid;r jsonb;result jsonb;begin
 b:=pg_temp.mock_booking();r:=public.begin_vnpay_payment(b,'00000000-0000-4000-8000-000000000081',gen_random_uuid(),'127.0.0.1');
 result:=public.apply_vnpay_result(r->>'ref',(r->>'amount')::bigint,true,'123456','20261104120000','00');
 if result->>'RspCode'<>'00' or (select status from public.bookings where id=b)<>'confirmed' then raise exception 'Not confirmed';end if;
 result:=public.apply_vnpay_result(r->>'ref',(r->>'amount')::bigint,true,'123456','20261104120000','00');
 if result->>'RspCode'<>'02' then raise exception 'Duplicate not detected';end if;
 if (select count(*) from public.booking_events where booking_id=b and event_type='confirmed')<>1 then raise exception 'Duplicate event';end if;
 b:=pg_temp.mock_booking();r:=public.begin_vnpay_payment(b,'00000000-0000-4000-8000-000000000081',gen_random_uuid(),'127.0.0.1');
 update public.bookings set expires_at=now()-interval '1 hour' where id=b;
 result:=public.apply_vnpay_result(r->>'ref',(r->>'amount')::bigint,true,'123457','20261104120000','00');
 if (select settlement from private.vnpay_attempts where payment_id=(r->>'paymentId')::uuid)<>'compensation' or (select status from public.bookings where id=b)<>'expired' then raise exception 'Late payment revived booking';end if;
 if has_function_privilege('authenticated','public.apply_vnpay_result(text,bigint,boolean,text,text,text)','execute') then raise exception 'Client can settle';end if;
end $$;
