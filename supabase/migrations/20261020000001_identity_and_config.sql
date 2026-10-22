-- Phase 4, migration 1: identity, roles, audit log and admin-editable configuration.
--
-- Security model in one paragraph:
--   Every table has Row Level Security on. Browsers get SELECT (and a very small UPDATE on
--   profiles). Anything that changes roles, verification or audit data happens inside
--   SECURITY DEFINER functions that check who is calling. The service_role key is never
--   used by the web app.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('customer', 'runner', 'admin', 'super_admin');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created by trigger at sign-up
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text not null default '' check (char_length(full_name) <= 80),
  phone        text check (phone is null or char_length(phone) <= 20),
  avatar_path  text,
  suspended_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_roles: who may do what. No client can write here.
-- ---------------------------------------------------------------------------

create table public.user_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = p_role
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role in ('admin', 'super_admin')
  );
$$;

-- Sign-up trigger: make the profile and give the ordinary customer role. Nothing else.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(left(new.raw_user_meta_data ->> 'full_name', 80), ''),
    left(new.raw_user_meta_data ->> 'phone', 20)
  );
  insert into public.user_roles (user_id, role) values (new.id, 'customer');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- audit_logs: append-only record of sensitive actions
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id);

-- Internal only. Called from other SECURITY DEFINER functions, never from the browser.
create function public.log_audit(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------------
-- Configuration tables. Public read of active rows, admin write.
-- ---------------------------------------------------------------------------

create table public.service_areas (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name       text not null,
  state      text not null,
  center_lat double precision not null check (center_lat between -90 and 90),
  center_lng double precision not null check (center_lng between -180 and 180),
  radius_km  numeric not null check (radius_km > 0),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger service_areas_set_updated_at
  before update on public.service_areas
  for each row execute function public.set_updated_at();

create table public.transport_categories (
  id                    text primary key check (id ~ '^[a-z_]+$'),
  label                 text not null,
  max_km                numeric not null check (max_km > 0),
  requires_vehicle_check boolean not null default false,
  active                boolean not null default true
);

create table public.errand_categories (
  id                text primary key check (id ~ '^[a-z_]+$'),
  label             text not null,
  description       text not null,
  needs_pickup      boolean not null default true,
  needs_destination boolean not null default true,
  allows_budget     boolean not null default false,
  active            boolean not null default true
);

-- Starting values. Administrators can edit them. Distances and the Jalingo centre point are
-- approximate and should be reviewed before launch.
insert into public.service_areas (slug, name, state, center_lat, center_lng, radius_km)
values ('jalingo', 'Jalingo', 'Taraba', 8.8937, 11.3596, 12);

insert into public.transport_categories (id, label, max_km, requires_vehicle_check) values
  ('walking',    'Walking',    3,  false),
  ('bicycle',    'Bicycle',    6,  false),
  ('keke',       'Keke',       15, true),
  ('motorcycle', 'Motorcycle', 20, true),
  ('car',        'Car',        30, true);

insert into public.errand_categories (id, label, description, needs_pickup, needs_destination, allows_budget) values
  ('pickup_delivery',  'Pickup and delivery',          'Collect something from one place and drop it at another.', true, true,  false),
  ('shopping',         'Shopping',                     'A runner buys items for you and brings them to you.',      true, true,  true),
  ('market_run',       'Market run',                   'Provisions and produce from the market, delivered to you.',true, true,  true),
  ('queue_collection', 'Queue and collection',         'Wait in line or collect an item on your behalf.',          true, false, false),
  ('custom',           'Personal or business errand',  'Something else that is lawful and safe. Describe it clearly.', true, false, false);

-- ---------------------------------------------------------------------------
-- Row Level Security and privileges
-- Supabase grants broad default privileges, so we revoke first and grant only what is needed.
-- ---------------------------------------------------------------------------

alter table public.profiles             enable row level security;
alter table public.user_roles           enable row level security;
alter table public.audit_logs           enable row level security;
alter table public.service_areas        enable row level security;
alter table public.transport_categories enable row level security;
alter table public.errand_categories    enable row level security;

revoke all on public.profiles, public.user_roles, public.audit_logs,
              public.service_areas, public.transport_categories, public.errand_categories
  from anon, authenticated;

-- profiles: read your own, update only three harmless columns. Admins read all.
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_path) on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- user_roles: read only. All changes go through functions below.
grant select on public.user_roles to authenticated;

create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- audit_logs: admins read, nobody writes from the browser.
grant select on public.audit_logs to authenticated;

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.is_admin());

-- Config tables: anyone may read active rows, admins manage them.
grant select on public.service_areas, public.transport_categories, public.errand_categories to anon, authenticated;
grant insert, update, delete on public.service_areas, public.transport_categories, public.errand_categories to authenticated;

create policy service_areas_read on public.service_areas
  for select to anon, authenticated using (active or public.is_admin());
create policy service_areas_admin_write on public.service_areas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy transport_categories_read on public.transport_categories
  for select to anon, authenticated using (active or public.is_admin());
create policy transport_categories_admin_write on public.transport_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy errand_categories_read on public.errand_categories
  for select to anon, authenticated using (active or public.is_admin());
create policy errand_categories_admin_write on public.errand_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Role management. Only a super_admin may create or remove admins.
-- The runner role is never granted here. It comes only from approving an application.
-- ---------------------------------------------------------------------------

create function public.grant_role(p_user uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('super_admin') then
    raise exception 'Only a super administrator can change administrator roles' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'super_admin') then
    raise exception 'Only admin and super_admin can be granted here' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (p_user, p_role, (select auth.uid()))
  on conflict do nothing;

  perform public.log_audit('role.granted', 'user', p_user::text, jsonb_build_object('role', p_role));
end;
$$;

create function public.revoke_role(p_user uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('super_admin') then
    raise exception 'Only a super administrator can change administrator roles' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'super_admin') then
    raise exception 'Only admin and super_admin can be revoked here' using errcode = '22023';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'You cannot remove your own administrator role' using errcode = '22023';
  end if;

  delete from public.user_roles where user_id = p_user and role = p_role;

  perform public.log_audit('role.revoked', 'user', p_user::text, jsonb_build_object('role', p_role));
end;
$$;

revoke execute on function public.grant_role(uuid, public.app_role) from public, anon;
revoke execute on function public.revoke_role(uuid, public.app_role) from public, anon;
grant  execute on function public.grant_role(uuid, public.app_role) to authenticated;
grant  execute on function public.revoke_role(uuid, public.app_role) to authenticated;

revoke execute on function public.log_audit(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.has_role(public.app_role) from public, anon;
revoke execute on function public.is_admin() from public;
grant  execute on function public.has_role(public.app_role) to authenticated;
-- anon needs is_admin() because the read policies on the config tables call it. It returns false for anon.
grant  execute on function public.is_admin() to anon, authenticated;
