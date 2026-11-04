do $$declare b uuid;r jsonb;c jsonb;begin
 b:=pg_temp.mock_booking();
 if exists(select 1 from private.booking_confirmation_mail where booking_id=b) then raise exception 'Emailed pending order';end if;
 r:=public.start_mock_payment(b,gen_random_uuid());
 perform public.resolve_mock_payment((r->'payments'->0->>'id')::uuid,gen_random_uuid(),'succeeded');
 if (select count(*) from private.booking_confirmation_mail where booking_id=b)<>1 then raise exception 'No unique mail';end if;
 if has_function_privilege('authenticated','public.claim_booking_mail(text)','execute') then raise exception 'Mail exposed';end if;
end $$;
