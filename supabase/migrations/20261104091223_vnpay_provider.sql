begin;
set local lock_timeout='10s';set local statement_timeout='60s';
alter table public.payments drop constraint payments_provider_check;
alter table public.payments add constraint payments_provider_check check(provider in ('mock','vnpay_sandbox'));
create table private.booking_payment_routes(
 booking_id uuid primary key references public.bookings(id) on delete cascade,
 provider text not null check(provider in ('mock','vnpay_sandbox'))
);
insert into private.booking_payment_routes select distinct booking_id,provider from public.payments;
alter table private.booking_payment_routes enable row level security;
revoke all on private.booking_payment_routes from public,anon,authenticated;
create function private.freeze_payment_provider() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.booking_id<>old.booking_id or new.provider<>old.provider or new.amount<>old.amount or new.currency<>old.currency or new.booking_version<>old.booking_version) then raise check_violation using message='payment.immutable';end if;
 perform 1 from public.bookings where id=new.booking_id for update;
 insert into private.booking_payment_routes values(new.booking_id,new.provider) on conflict do nothing;
 if not exists(select 1 from private.booking_payment_routes where booking_id=new.booking_id and provider=new.provider) then raise check_violation using message='payment.provider';end if;
 return new;
end $$;
revoke all on function private.freeze_payment_provider() from public,anon,authenticated;
create trigger payment_provider_route before insert or update on public.payments for each row execute function private.freeze_payment_provider();
create table private.vnpay_attempts(
 payment_id uuid primary key references public.payments(id) on delete cascade,
 txn_ref text not null unique,transaction_no text unique,pay_date text,
 create_date text not null,ip_addr text not null,expires_at timestamptz not null,
 settlement text not null default 'waiting' check(settlement in ('waiting','ticketed','compensation','failed')),
 sync_after timestamptz not null default now(),sync_count int not null default 0,lease_until timestamptz,
 last_query_id text,last_code text
);
alter table private.vnpay_attempts enable row level security;
revoke all on private.vnpay_attempts from public,anon,authenticated;
create index vnpay_sync_due on private.vnpay_attempts(sync_after) where settlement='waiting';
create table private.vnpay_refund_jobs(
 refund_id uuid primary key references public.refunds(id) on delete cascade,
 state text not null default 'ready' check(state in ('ready','submitted','unknown','processing','succeeded','failed','review')),
 request_id text not null unique,request_date text not null,transaction_type text not null check(transaction_type in ('02','03')),
 transaction_no text,last_code text,submitted_at timestamptz,updated_at timestamptz not null default now()
);
alter table private.vnpay_refund_jobs enable row level security;
revoke all on private.vnpay_refund_jobs from public,anon,authenticated;
create or replace function private.cancel_attempts_on_booking_end() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('expired','cancelled') and new.status<>old.status then
  with stopped as(update public.payments set status='cancelled',failure_code=case when new.status='expired' then 'hold_expired' else 'booking_cancelled' end
   where booking_id=new.id and provider='mock' and status='pending' returning id)
  insert into public.booking_events(booking_id,event_type,safe_message,metadata)
  select new.id,'payment_cancelled','Mock payment cancelled.',jsonb_build_object('payment_id',id) from stopped;
 end if;return new;
end $$;
create function private.get_payment_state(p_booking_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;begin
 perform private.lock_mock_booking(p_booking_id);
 s:=private.mock_booking_state(p_booking_id);
 return s||jsonb_build_object('provider',(select provider from private.booking_payment_routes where booking_id=p_booking_id),
 'settlement',(select a.settlement from private.vnpay_attempts a join public.payments p on p.id=a.payment_id where p.booking_id=p_booking_id order by p.created_at desc limit 1),
 'refundState',(select j.state from private.vnpay_refund_jobs j join public.refunds r on r.id=j.refund_id where r.booking_id=p_booking_id));
end $$;
revoke all on function private.get_payment_state(uuid) from public,anon,authenticated;
grant execute on function private.get_payment_state(uuid) to authenticated;
create function public.get_payment_state(p_booking_id uuid) returns jsonb language sql volatile security invoker set search_path='' as $$ select private.get_payment_state(p_booking_id) $$;
revoke all on function public.get_payment_state(uuid) from public,anon,authenticated;
grant execute on function public.get_payment_state(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
