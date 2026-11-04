do $$declare b uuid;r jsonb;s jsonb;c jsonb;begin
 b:=pg_temp.mock_booking();r:=public.begin_vnpay_payment(b,'00000000-0000-4000-8000-000000000081',gen_random_uuid(),'127.0.0.1');
 perform public.apply_vnpay_result(r->>'ref',(r->>'amount')::bigint,true,'123456','20261104120000','00');
 s:=public.get_payment_state(b);perform public.cancel_booking(b,gen_random_uuid(),(s->'cancellation'->>'fee')::bigint);
 c:=public.claim_vnpay_refund(b,'00000000-0000-4000-8000-000000000081');
 if c is null or c->>'type'<>'03' then raise exception 'Missing net refund';end if;
 if public.claim_vnpay_refund(b,'00000000-0000-4000-8000-000000000081') is not null then raise exception 'Double submission';end if;
 perform public.apply_vnpay_refund((c->>'refundId')::uuid,'unknown','timeout','');
 if public.claim_vnpay_refund(b,'00000000-0000-4000-8000-000000000081') is not null then raise exception 'Unknown refund resent';end if;
 perform public.apply_vnpay_refund((c->>'refundId')::uuid,'succeeded','00','23456');
 perform public.apply_vnpay_refund((c->>'refundId')::uuid,'failed','09','');
 if (select status from public.refunds where id=(c->>'refundId')::uuid)<>'succeeded' then raise exception 'Refund reversed';end if;
 if has_function_privilege('authenticated','public.claim_vnpay_refund(uuid,uuid)','execute') then raise exception 'Refund claim exposed';end if;
end $$;
