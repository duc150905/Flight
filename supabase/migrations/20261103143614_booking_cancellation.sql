begin;
set local lock_timeout='10s';set local statement_timeout='60s';
create or replace function private.mock_cancel_policy(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare b public.bookings%rowtype;allowed boolean;before_cutoff boolean;fee bigint;n int;refund bigint:=0;
begin
 select * into b from public.bookings where id=p_id and user_id=auth.uid();
 if not found then raise exception using message='booking.notFound';end if;
 if b.status='pending_payment' and b.expires_at>clock_timestamp() then return jsonb_build_object('allowed',true,'fee',0,'refundAmount',0,'reason','');end if;
 if b.status='cancelled' then return jsonb_build_object('allowed',false,'fee',coalesce((b.refund_policy_snapshot->>'cancellation_fee_amount')::bigint,0),'refundAmount',coalesce((b.refund_policy_snapshot->>'refund_due_amount')::bigint,0),'reason','state');end if;
 if b.status<>'confirmed' then return jsonb_build_object('allowed',false,'fee',0,'refundAmount',0,'reason','state');end if;
 select count(*),bool_and(coalesce((ps.cancellation_rules_snapshot->>'allowed')::boolean,false)),
 bool_and(clock_timestamp()<least((s.flight_snapshot->>'departure_at')::timestamptz,f.departure_at)-make_interval(mins=>coalesce((ps.cancellation_rules_snapshot->>'cutoff_minutes')::int,60))),
 coalesce(sum(least(greatest(coalesce((ps.cancellation_rules_snapshot->>'fee_amount')::bigint,0),0),ps.base_amount+ps.tax_amount+ps.fee_amount)),0)
 into n,allowed,before_cutoff,fee from public.booking_passenger_segments ps join public.booking_segments s on s.id=ps.segment_id join public.flight_instances f on f.id=s.flight_id where ps.booking_id=b.id;
 if n=0 or not coalesce(allowed,false) then return jsonb_build_object('allowed',false,'fee',0,'refundAmount',0,'reason','fare');end if;
 if not coalesce(before_cutoff,false) then return jsonb_build_object('allowed',false,'fee',0,'refundAmount',0,'reason','cutoff');end if;
 if exists(select 1 from public.payments where booking_id=b.id and status='succeeded') then refund:=greatest(0,b.total_amount-fee);end if;
 return jsonb_build_object('allowed',true,'fee',fee,'refundAmount',refund,'reason','');
end $$;
revoke all on function private.mock_cancel_policy(uuid) from public,anon,authenticated;
create function private.cancel_booking(p_booking_id uuid,p_request_id uuid,p_expected_fee bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;policy jsonb;hash text;v_now timestamptz;
begin
 if p_request_id is null or p_expected_fee is null or p_expected_fee<0 or p_expected_fee>9007199254740991 then raise exception using message='mock.invalid';end if;
 b:=private.lock_mock_booking(p_booking_id);
 hash:=encode(sha256(convert_to('cancel:'||p_booking_id::text||':'||p_expected_fee::text,'UTF8')),'hex');
 if not private.claim_mock_action(b.id,p_request_id,hash) or b.status='cancelled' then return private.mock_booking_state(b.id);end if;
 policy:=private.mock_cancel_policy(b.id);
 if not (policy->>'allowed')::boolean then raise exception using message='mock.ineligible';end if;
 if (policy->>'fee')::bigint<>p_expected_fee then raise exception using message='mock.priceChanged';end if;
 v_now:=clock_timestamp();
 update public.bookings set status='cancelled',cancelled_at=v_now,cancellation_reason='customer_requested_demo',version=version+1,
 refund_policy_snapshot=refund_policy_snapshot||jsonb_build_object('cancellation_fee_amount',(policy->>'fee')::bigint,'refund_due_amount',(policy->>'refundAmount')::bigint) where id=b.id;
 update public.seat_reservations set status='released',released_at=v_now where booking_id=b.id and status in ('held','confirmed');
 insert into public.booking_events(booking_id,actor_user_id,event_type,from_status,to_status,safe_message)
 values(b.id,auth.uid(),'cancelled',b.status,'cancelled','Whole demo booking cancelled.');
 return private.mock_booking_state(b.id);
end $$;
revoke all on function private.cancel_booking(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function private.cancel_booking(uuid,uuid,bigint) to authenticated;
create function public.cancel_booking(p_booking_id uuid,p_request_id uuid,p_expected_fee bigint) returns jsonb
language sql volatile security invoker set search_path='' as $$select private.cancel_booking(p_booking_id,p_request_id,p_expected_fee)$$;
revoke all on function public.cancel_booking(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.cancel_booking(uuid,uuid,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
