do $$ declare bid uuid:=pg_temp.mock_booking(); rid uuid:=gen_random_uuid(); state jsonb; pid uuid; begin
 state:=public.start_mock_payment(bid,rid);pid:=(state->'payments'->0->>'id')::uuid;
 if pid is null or state->'payments'->0->>'status'<>'pending' or (state->'payments'->0->>'amount')::bigint<>(state->'booking'->>'total')::bigint then raise exception 'Invalid mock attempt'; end if;
 perform public.start_mock_payment(bid,rid);perform public.start_mock_payment(bid,gen_random_uuid());
 if (select count(*) from public.payments where booking_id=bid)<>1 then raise exception 'Duplicate pending attempts'; end if;
 if (select provider from public.payments where id=pid)<>'mock' then raise exception 'Real provider used'; end if;
 update public.bookings set expires_at=now()-interval '1 second' where id=bid;
 state:=public.start_mock_payment(bid,gen_random_uuid());
 if state->'booking'->>'status'<>'expired' or state->'payments'->0->>'status'<>'cancelled' then raise exception 'Expired payment accepted'; end if;
 if has_function_privilege('anon','public.start_mock_payment(uuid,uuid)','execute') then raise exception 'Anon access'; end if;
end $$;
