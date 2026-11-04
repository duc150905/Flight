do $$declare b uuid;r jsonb;q jsonb;begin
 b:=pg_temp.mock_booking();r:=public.begin_vnpay_payment(b,'00000000-0000-4000-8000-000000000081',gen_random_uuid(),'127.0.0.1');
 q:=public.claim_vnpay_sync(b,'00000000-0000-4000-8000-000000000081');
 if q->>'ref' is distinct from r->>'ref' then raise exception 'Missing query';end if;
 if public.claim_vnpay_sync(b,'00000000-0000-4000-8000-000000000081') is not null then raise exception 'No cooldown';end if;
 if has_function_privilege('authenticated','public.claim_vnpay_sync(uuid,uuid)','execute') then raise exception 'Claim exposed';end if;
end $$;
