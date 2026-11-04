do $$declare b uuid; s jsonb;begin
 b:=pg_temp.mock_booking();
 insert into public.payments(booking_id,idempotency_key,request_hash,booking_version,amount,provider)
 select id,gen_random_uuid(),'test',version,total_amount,'vnpay_sandbox' from public.bookings where id=b;
 s:=public.get_payment_state(b);
 if s->>'provider'<>'vnpay_sandbox' then raise exception 'Missing provider';end if;
 update public.payments set status='failed' where booking_id=b;
 begin
  insert into public.payments(booking_id,idempotency_key,request_hash,booking_version,amount)
  select id,gen_random_uuid(),'test',version,total_amount from public.bookings where id=b;
  raise exception 'Provider switch allowed';
 exception when check_violation then null;end;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000082',true);
 begin perform public.get_payment_state(b);raise exception 'Wrong owner allowed';
 exception when others then if sqlerrm<>'booking.notFound' then raise;end if;end;
end $$;
