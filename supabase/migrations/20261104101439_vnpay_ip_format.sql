begin;
create function private.normalize_vnpay_ip() returns trigger language plpgsql set search_path='' as $$
begin new.ip_addr:=host(new.ip_addr::inet);return new;end $$;
revoke all on function private.normalize_vnpay_ip() from public,anon,authenticated;
create trigger normalize_gateway_ip before insert or update of ip_addr on private.vnpay_attempts for each row execute function private.normalize_vnpay_ip();
update private.vnpay_attempts set ip_addr=host(ip_addr::inet) where ip_addr like '%/%';
commit;
