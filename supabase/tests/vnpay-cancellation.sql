do $$declare b uuid;r jsonb;s jsonb;begin
 b:=pg_temp.mock_booking();r:=public.begin_vnpay_payment(b,'00000000-0000-4000-8000-000000000081',gen_random_uuid(),'127.0.0.1');
 perform public.apply_vnpay_result(r->>'ref',(r->>'amount')::bigint,true,'123456','20261104120000','00');
 s:=public.get_payment_state(b);perform public.cancel_booking(b,gen_random_uuid(),(s->'cancellation'->>'fee')::bigint);
 if not exists(select 1 from private.vnpay_refund_jobs j join public.refunds f on f.id=j.refund_id where f.booking_id=b and j.state='ready' and f.amount=(s->'cancellation'->>'refundAmount')::bigint) then raise exception 'No durable net refund';end if;
 perform public.cancel_booking(b,gen_random_uuid(),0);
 if (select count(*) from public.refunds where booking_id=b)<>1 then raise exception 'Duplicate refund';end if;
end $$;
