do $$ declare bid uuid:=pg_temp.mock_booking(); state jsonb; pid uuid; rid uuid:=gen_random_uuid(); actual text; begin
 state:=public.start_mock_payment(bid,gen_random_uuid());pid:=(state->'payments'->0->>'id')::uuid;
 state:=public.resolve_mock_payment(pid,rid,'pending');
 if state->'booking'->>'status'<>'pending_payment' then raise exception 'Pending confirmed too early'; end if;
 begin perform public.resolve_mock_payment(pid,rid,'succeeded');exception when others then actual:=sqlerrm;end;
 if actual is distinct from 'mock.conflict' then raise exception 'Conflicting action reused';end if;
 rid:=gen_random_uuid();state:=public.resolve_mock_payment(pid,rid,'succeeded');perform public.resolve_mock_payment(pid,rid,'succeeded');
 if state->'booking'->>'status'<>'confirmed' or state->'payments'->0->>'status'<>'succeeded'
 or exists(select 1 from public.seat_reservations where booking_id=bid and status<>'confirmed')
 or (select count(*) from public.booking_events where booking_id=bid and event_type='confirmed')<>1 then raise exception 'Atomic confirmation failed';end if;
 -- A failed attempt can retry but a terminal attempt cannot be changed.
 bid:=pg_temp.mock_booking();state:=public.start_mock_payment(bid,gen_random_uuid());pid:=(state->'payments'->0->>'id')::uuid;
 perform public.resolve_mock_payment(pid,gen_random_uuid(),'failed');
 state:=public.resolve_mock_payment(pid,gen_random_uuid(),'succeeded');
 if state->'booking'->>'status'<>'pending_payment' then raise exception 'Failed payment changed to success';end if;
 state:=public.start_mock_payment(bid,gen_random_uuid());pid:=(state->'payments'->0->>'id')::uuid;
 if (select count(distinct created_at) from public.payments where booking_id=bid)<>2 then raise exception 'Retry attempts have indistinguishable creation times';end if;
 update public.bookings set expires_at=now()-interval '1 second' where id=bid;
 state:=public.resolve_mock_payment(pid,gen_random_uuid(),'succeeded');
 if state->'booking'->>'status'<>'expired' or state->'payments'->0->>'status'<>'cancelled' then raise exception 'Late result state: %, payments: %',state->'booking'->>'status',state->'payments';end if;
 if has_function_privilege('anon','public.resolve_mock_payment(uuid,uuid,text)','execute') then raise exception 'Anon resolution';end if;
 bid:=pg_temp.mock_booking();state:=public.start_mock_payment(bid,gen_random_uuid());pid:=(state->'payments'->0->>'id')::uuid;
 state:=public.resolve_mock_payment(pid,gen_random_uuid(),'cancelled');
 if state->'booking'->>'status'<>'pending_payment' or state->'payments'->0->>'status'<>'cancelled' then raise exception 'Cancelling attempt cancelled order';end if;
 state:=public.start_mock_payment(bid,gen_random_uuid());pid:=(state->'payments'->0->>'id')::uuid;
 update public.payments set amount=amount+1 where id=pid;actual:=null;
 begin perform public.resolve_mock_payment(pid,gen_random_uuid(),'succeeded');exception when others then actual:=sqlerrm;end;
 if actual is distinct from 'mock.invalid' then raise exception 'Wrong amount confirmed';end if;
end $$;
