begin;
-- Read-only reconciliation ledger. Paging and search happen before the API row cap.
create function private.admin_vnpay_review_page(p_query text default '', p_state text default 'all', p_limit integer default 20, p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 perform private.require_admin();
 if p_limit is null or p_offset is null or p_limit not between 1 and 100 or p_offset < 0 then raise exception 'Invalid reconciliation page'; end if;
 if p_state is null or p_state not in ('all','unknown','review','processing','failed','succeeded','ready','submitted','compensation') then raise exception 'Invalid reconciliation state'; end if;
 with ledger as (
  select b.id booking_id,b.booking_code,p.id payment_id,p.amount,p.currency,p.status payment_status,p.created_at,p.paid_at,p.provider_reference,
    a.settlement,a.gateway_paid,a.transaction_no,a.txn_ref,r.id refund_id,r.status refund_status,r.amount refund_amount,
    r.provider_reference refund_provider_reference,r.completed_at,j.state refund_state,coalesce(j.last_code,a.last_code) last_code
  from public.payments p join public.bookings b on b.id=p.booking_id
  join private.vnpay_attempts a on a.payment_id=p.id
  left join public.refunds r on r.payment_id=p.id
  left join private.vnpay_refund_jobs j on j.refund_id=r.id
 ), filtered as (
  select * from ledger x
  where (p_state='all' or x.refund_state=p_state or (p_state='compensation' and x.settlement='compensation'))
   and not exists (
    select 1 from regexp_split_to_table(lower(trim(coalesce(p_query,''))), '\s+') token
    where token<>'' and position(token in lower(concat_ws(' ',x.booking_id,x.booking_code,x.payment_id,x.refund_id,x.settlement,x.payment_status,x.refund_state,x.refund_status,x.transaction_no,x.txn_ref,x.provider_reference,x.refund_provider_reference,x.last_code)))=0
   )
 ), page as (
  select * from filtered order by created_at desc,payment_id,refund_id nulls first limit p_limit offset p_offset
 )
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x) - 'created_at' order by x.created_at desc,x.payment_id,x.refund_id nulls first) from page x),'[]'::jsonb),
   'total',(select count(*) from filtered),'page',p_offset/p_limit+1,'page_size',p_limit) into result;
 return result;
end $$;
revoke all on function private.admin_vnpay_review_page(text,text,integer,integer) from public,anon,authenticated;
grant execute on function private.admin_vnpay_review_page(text,text,integer,integer) to authenticated;
create function public.admin_vnpay_review_page(p_query text default '',p_state text default 'all',p_limit integer default 20,p_offset integer default 0)
returns jsonb language sql security invoker set search_path='' as $$ select private.admin_vnpay_review_page(p_query,p_state,p_limit,p_offset) $$;
revoke all on function public.admin_vnpay_review_page(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.admin_vnpay_review_page(text,text,integer,integer) to authenticated;
-- Cash captured at the provider includes late/duplicate compensation captures whose public payment is not succeeded.
create function private.admin_payment_ledger_page(p_limit integer default 500,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_admin();
 if p_limit is null or p_offset is null or p_limit not between 1 and 500 or p_offset<0 then raise exception 'Invalid payment ledger page'; end if;
 with ledger as (
  select p.*,case when p.provider='vnpay_sandbox' then coalesce(a.gateway_paid,false) else p.status='succeeded' end captured,
   case when p.provider='vnpay_sandbox' and a.gateway_paid and a.pay_date ~ '^[0-9]{14}$' then
    make_timestamp(substring(a.pay_date,1,4)::int,substring(a.pay_date,5,2)::int,substring(a.pay_date,7,2)::int,
     substring(a.pay_date,9,2)::int,substring(a.pay_date,11,2)::int,substring(a.pay_date,13,2)::double precision) at time zone 'Asia/Ho_Chi_Minh'
    when p.provider<>'vnpay_sandbox' and p.status='succeeded' then p.paid_at else null end captured_at
  from public.payments p left join private.vnpay_attempts a on a.payment_id=p.id
 ), page as (select * from ledger order by created_at,id limit p_limit offset p_offset)
 select jsonb_build_object('items',coalesce((select jsonb_agg(x order by x.created_at,x.id) from page x),'[]'::jsonb),'total',(select count(*) from ledger)) into result;
 return result;
end $$;
revoke all on function private.admin_payment_ledger_page(integer,integer) from public,anon,authenticated;
grant execute on function private.admin_payment_ledger_page(integer,integer) to authenticated;
create function public.admin_payment_ledger_page(p_limit integer default 500,p_offset integer default 0)
returns jsonb language sql security invoker set search_path='' as $$select private.admin_payment_ledger_page(p_limit,p_offset)$$;
revoke all on function public.admin_payment_ledger_page(integer,integer) from public,anon,authenticated;
grant execute on function public.admin_payment_ledger_page(integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
