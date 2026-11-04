do $$declare b uuid;r jsonb;c jsonb;begin
 b:=pg_temp.mock_booking();r:=public.begin_vnpay_payment(b,'00000000-0000-4000-8000-000000000081',gen_random_uuid(),'127.0.0.1');
 update public.bookings set expires_at=now()-interval '1 hour' where id=b;
 perform public.apply_vnpay_result(r->>'ref',(r->>'amount')::bigint,true,'123456','20261104120000','00');
 c:=public.claim_vnpay_refund(b,'00000000-0000-4000-8000-000000000081');
 if c->>'type'<>'02' or c->>'amount'<>r->>'amount' then raise exception 'Late full refund missing';end if;
 if public.claim_vnpay_refund(b,null) is not null then raise exception 'Worker resent refund';end if;
 if has_function_privilege('authenticated','public.vnpay_worker_batch()','execute') then raise exception 'Worker exposed';end if;
 begin perform public.admin_vnpay_review();raise exception 'Customer can review others';exception when others then if sqlerrm<>'Forbidden' then raise;end if;end;
end $$;
