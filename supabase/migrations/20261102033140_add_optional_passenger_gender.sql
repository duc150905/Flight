-- Optional demographic field shown in the reference traveller form.
-- Existing passengers remain NULL; booking/RLS access rules are unchanged.
alter table public.booking_passengers add column gender text
  constraint booking_passengers_gender_check check (gender in ('male', 'female', 'unspecified'));
comment on column public.booking_passengers.gender is
  'Optional passenger gender selected during checkout; NULL for existing or unprovided values.';
