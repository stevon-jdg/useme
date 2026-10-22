-- Phase 4, migration 4: errand records.
--
-- Customers read their own errands, admins read all. Nobody inserts or updates directly:
-- creating an errand, its price quote, the runner feed and every status change become
-- functions in Phase 5. Runners get no read policy yet, so they cannot see errand details.
-- distance_km is the customer-typed value until real route distance arrives in Phase 6.

create type public.errand_status as enum (
  'searching', 'assigned', 'heading_to_pickup', 'arrived_at_pickup', 'in_progress',
  'awaiting_confirmation', 'completed', 'cancelled', 'disputed'
);

create table public.errands (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references public.profiles (id) on delete restrict,
  category_id          text not null references public.errand_categories (id),
  service_area_id      uuid not null references public.service_areas (id),
  title                text not null check (char_length(title) between 3 and 80),
  description          text check (description is null or char_length(description) <= 600),
  instructions         text check (instructions is null or char_length(instructions) <= 400),
  pickup_text          text not null,
  destination_text     text,
  transport_id         text not null references public.transport_categories (id),
  distance_km          numeric(6, 2) not null check (distance_km > 0),
  extra_stops          smallint not null default 0 check (extra_stops between 0 and 5),
  -- Integer kobo. Kept apart from the service cost, which lives on the quote in Phase 5.
  shopping_budget_kobo bigint not null default 0 check (shopping_budget_kobo >= 0),
  status               public.errand_status not null default 'searching',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index errands_customer_idx on public.errands (customer_id, created_at desc);
create index errands_status_idx on public.errands (status);

create trigger errands_set_updated_at
  before update on public.errands
  for each row execute function public.set_updated_at();

alter table public.errands enable row level security;
revoke all on public.errands from anon, authenticated;
grant select on public.errands to authenticated;

create policy errands_select on public.errands
  for select to authenticated
  using (customer_id = (select auth.uid()) or public.is_admin());
