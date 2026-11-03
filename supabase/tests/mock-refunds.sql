do $$declare bid uuid:=pg_temp.mock_booking();state jsonb;pid uuid;rid uuid:=gen_random_uuid();due bigint;actual text;begin
 state:=public.start_mock_payment(bid,gen_random_uuid());pid:=(state->'payments'->0->>'id')::uuid;
 state:=public.resolve_mock_payment(pid,gen_random_uuid(),'succeeded');
 actual:=null;begin perform public.refund_mock_booking(bid,rid,'succeeded');exception when others then actual:=sqlerrm;end;
 if actual is distinct from 'mock.ineligible' then raise exception 'Refund before cancellation allowed';end if;
 state:=public.cancel_booking(bid,gen_random_uuid(),(state->'cancellation'->>'fee')::bigint);due:=(state->'cancellation'->>'refundAmount')::bigint;
 state:=public.refund_mock_booking(bid,rid,'pending');
 if state->'refunds'->0->>'status'<>'pending' or (state->'refunds'->0->>'amount')::bigint<>due then raise exception 'Wrong refund amount';end if;
 state:=public.refund_mock_booking(bid,gen_random_uuid(),'failed');
 if state->'refunds'->0->>'status'<>'failed' then raise exception 'Failure simulation missing';end if;
 rid:=gen_random_uuid();state:=public.refund_mock_booking(bid,rid,'succeeded');perform public.refund_mock_booking(bid,rid,'succeeded');
 perform public.refund_mock_booking(bid,gen_random_uuid(),'failed');
 if (select count(*) from public.refunds where booking_id=bid)<>1 or (select status from public.refunds where booking_id=bid)<>'succeeded'
 or (select count(*) from public.booking_events where booking_id=bid and event_type='refund_succeeded')<>1 then raise exception 'Refund duplicated/reversed';end if;
 bid:=pg_temp.mock_booking();perform public.cancel_booking(bid,gen_random_uuid(),0);actual:=null;
 begin perform public.refund_mock_booking(bid,gen_random_uuid(),'succeeded');exception when others then actual:=sqlerrm;end;
 if actual is distinct from 'mock.ineligible' then raise exception 'Unpaid refund allowed';end if;
 if has_function_privilege('anon','public.refund_mock_booking(uuid,uuid,text)','execute') then raise exception 'Anon refund';end if;
end $$;
