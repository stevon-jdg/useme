-- Phase 4, migration 2: runner application, human verification and approval.
--
-- Note on tables: the brief lists a separate runner_verifications table. Verification state
-- lives on runner_profiles instead (status, reviewer, note, timestamps) and every decision is
-- also written to audit_logs, so there is one source of truth and a full history.
--
-- Uploading a document is NOT verification. A document row only records that a file exists.
-- A person approves the application, and that is what grants the runner role.

create type public.verification_status as enum (
  'draft', 'submitted', 'under_review', 'more_info_required', 'approved', 'rejected', 'suspended'
);

create table public.runner_profiles (
  user_id                 uuid primary key references public.profiles (id) on delete cascade,
  legal_name              text not null check (char_length(legal_name) between 2 and 120),
  date_of_birth           date not null,
  service_area_id         uuid references public.service_areas (id),
  emergency_contact_name  text check (emergency_contact_name is null or char_length(emergency_contact_name) <= 120),
  emergency_contact_phone text check (emergency_contact_phone is null or char_length(emergency_contact_phone) <= 20),
  emergency_consent_at    timestamptz,
  conduct_accepted_at     timestamptz,
  status                  public.verification_status not null default 'draft',
  submitted_at            timestamptz,
  reviewed_by             uuid references public.profiles (id) on delete set null,
  reviewed_at             timestamptz,
  review_note             text,
  available               boolean not null default false,
  tier                    text not null default 'verified' check (tier in ('verified', 'trusted', 'elite')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger runner_profiles_set_updated_at
  before update on public.runner_profiles
  for each row execute function public.set_updated_at();

create table public.runner_capabilities (
  runner_id    uuid not null references public.runner_profiles (user_id) on delete cascade,
  transport_id text not null references public.transport_categories (id),
  plate_number text check (plate_number is null or char_length(plate_number) <= 20),
  verified_at  timestamptz,
  verified_by  uuid references public.profiles (id) on delete set null,
  primary key (runner_id, transport_id)
);

create table public.runner_documents (
  id           uuid primary key default gen_random_uuid(),
  runner_id    uuid not null references public.runner_profiles (user_id) on delete cascade,
  kind         text not null check (kind in ('id_document', 'selfie', 'vehicle_licence', 'vehicle_registration')),
  storage_path text not null unique,
  created_at   timestamptz not null default now()
);

create index runner_documents_runner_idx on public.runner_documents (runner_id, kind);

alter table public.runner_profiles     enable row level security;
alter table public.runner_capabilities enable row level security;
alter table public.runner_documents    enable row level security;

revoke all on public.runner_profiles, public.runner_capabilities, public.runner_documents from anon, authenticated;
grant select on public.runner_profiles, public.runner_capabilities, public.runner_documents to authenticated;

create policy runner_profiles_select on public.runner_profiles
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy runner_capabilities_select on public.runner_capabilities
  for select to authenticated using (runner_id = (select auth.uid()) or public.is_admin());
create policy runner_documents_select on public.runner_documents
  for select to authenticated using (runner_id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------------------
-- Applicant functions
-- ---------------------------------------------------------------------------

create function public.save_runner_application(
  p_legal_name text,
  p_date_of_birth date,
  p_service_area_id uuid,
  p_emergency_name text,
  p_emergency_phone text,
  p_emergency_consent boolean,
  p_conduct_accepted boolean,
  p_transports text[],
  p_plates jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_status public.verification_status;
  v_transport text;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and suspended_at is not null) then
    raise exception 'This account is suspended' using errcode = '42501';
  end if;

  select status into v_status from public.runner_profiles where user_id = v_uid;
  if v_status is not null and v_status not in ('draft', 'more_info_required') then
    raise exception 'This application can no longer be edited (status: %)', v_status using errcode = '55000';
  end if;

  if p_date_of_birth > (current_date - interval '18 years') then
    raise exception 'Runners must be at least 18 years old' using errcode = '22023';
  end if;
  if not exists (select 1 from public.service_areas where id = p_service_area_id and active) then
    raise exception 'Choose an active service area' using errcode = '22023';
  end if;
  if coalesce(array_length(p_transports, 1), 0) = 0 then
    raise exception 'Choose at least one way you will travel' using errcode = '22023';
  end if;
  foreach v_transport in array p_transports loop
    if not exists (select 1 from public.transport_categories where id = v_transport and active) then
      raise exception 'Unknown transport type: %', v_transport using errcode = '22023';
    end if;
  end loop;

  insert into public.runner_profiles as rp (
    user_id, legal_name, date_of_birth, service_area_id,
    emergency_contact_name, emergency_contact_phone, emergency_consent_at, conduct_accepted_at
  )
  values (
    v_uid, trim(p_legal_name), p_date_of_birth, p_service_area_id,
    nullif(trim(p_emergency_name), ''), nullif(trim(p_emergency_phone), ''),
    case when p_emergency_consent then now() end,
    case when p_conduct_accepted then now() end
  )
  on conflict (user_id) do update set
    legal_name = excluded.legal_name,
    date_of_birth = excluded.date_of_birth,
    service_area_id = excluded.service_area_id,
    emergency_contact_name = excluded.emergency_contact_name,
    emergency_contact_phone = excluded.emergency_contact_phone,
    emergency_consent_at = case
      when p_emergency_consent then coalesce(rp.emergency_consent_at, now()) end,
    conduct_accepted_at = case
      when p_conduct_accepted then coalesce(rp.conduct_accepted_at, now()) end;

  delete from public.runner_capabilities
   where runner_id = v_uid and not (transport_id = any (p_transports));

  insert into public.runner_capabilities (runner_id, transport_id, plate_number)
  select v_uid, t, nullif(trim(p_plates ->> t), '')
  from unnest(p_transports) as t
  on conflict (runner_id, transport_id) do update set plate_number = excluded.plate_number;
end;
$$;

-- Records that a file was uploaded. The path must start with the caller's own user id.
create function public.register_runner_document(p_kind text, p_storage_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_status public.verification_status;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select status into v_status from public.runner_profiles where user_id = v_uid;
  if v_status is null then
    raise exception 'Save your application details before uploading documents' using errcode = '55000';
  end if;
  if v_status not in ('draft', 'more_info_required') then
    raise exception 'This application can no longer be edited' using errcode = '55000';
  end if;
  if split_part(p_storage_path, '/', 1) <> v_uid::text then
    raise exception 'Upload path must start with your own user id' using errcode = '42501';
  end if;

  insert into public.runner_documents (runner_id, kind, storage_path)
  values (v_uid, p_kind, p_storage_path);
end;
$$;

create function public.submit_runner_application()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.runner_profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select * into v_row from public.runner_profiles where user_id = v_uid;
  if not found then
    raise exception 'Save your application details first' using errcode = '55000';
  end if;
  if v_row.status not in ('draft', 'more_info_required') then
    raise exception 'This application was already submitted' using errcode = '55000';
  end if;
  if v_row.emergency_consent_at is null or v_row.emergency_contact_name is null or v_row.emergency_contact_phone is null then
    raise exception 'An emergency contact and consent to store it are required' using errcode = '22023';
  end if;
  if v_row.conduct_accepted_at is null then
    raise exception 'Accept the runner code of conduct first' using errcode = '22023';
  end if;
  if not exists (select 1 from public.runner_documents where runner_id = v_uid and kind = 'id_document') then
    raise exception 'Upload an identity document first' using errcode = '22023';
  end if;
  if not exists (select 1 from public.runner_documents where runner_id = v_uid and kind = 'selfie') then
    raise exception 'Upload a selfie first' using errcode = '22023';
  end if;
  -- Walking and bicycle runners are not asked for vehicle papers.
  if exists (
    select 1
    from public.runner_capabilities c
    join public.transport_categories t on t.id = c.transport_id
    where c.runner_id = v_uid and t.requires_vehicle_check
  ) and not exists (
    select 1 from public.runner_documents where runner_id = v_uid and kind = 'vehicle_licence'
  ) then
    raise exception 'Upload a vehicle licence for your selected transport' using errcode = '22023';
  end if;

  update public.runner_profiles
     set status = 'submitted', submitted_at = now(), review_note = null
   where user_id = v_uid;

  perform public.log_audit('runner.submitted', 'runner', v_uid::text, '{}'::jsonb);
end;
$$;

-- Availability can only be switched on by an approved runner on a non-suspended account.
create function public.set_runner_availability(p_available boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if p_available and not (
    public.has_role('runner')
    and exists (select 1 from public.runner_profiles where user_id = v_uid and status = 'approved')
    and not exists (select 1 from public.profiles where id = v_uid and suspended_at is not null)
  ) then
    raise exception 'Only approved runners can go available' using errcode = '42501';
  end if;

  update public.runner_profiles set available = p_available where user_id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Administrator functions
-- ---------------------------------------------------------------------------

create function public.admin_review_runner(p_runner uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.verification_status;
  v_next public.verification_status;
  v_actor uuid := (select auth.uid());
begin
  if not public.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;

  select status into v_current from public.runner_profiles where user_id = p_runner for update;
  if v_current is null then
    raise exception 'Runner application not found' using errcode = 'P0002';
  end if;

  v_next := case p_decision
    when 'under_review'       then 'under_review'
    when 'approved'           then 'approved'
    when 'more_info_required' then 'more_info_required'
    when 'rejected'           then 'rejected'
    when 'suspended'          then 'suspended'
    when 'reinstated'         then 'approved'
  end;
  if v_next is null then
    raise exception 'Unknown decision: %', p_decision using errcode = '22023';
  end if;

  -- Allowed moves only. A draft cannot be approved, an approved runner can only be suspended.
  if not (
       (v_current = 'submitted'          and p_decision in ('under_review', 'approved', 'more_info_required', 'rejected'))
    or (v_current = 'under_review'       and p_decision in ('approved', 'more_info_required', 'rejected'))
    or (v_current = 'approved'           and p_decision = 'suspended')
    or (v_current = 'suspended'          and p_decision = 'reinstated')
  ) then
    raise exception 'Cannot move an application from % using %', v_current, p_decision using errcode = '55000';
  end if;

  if p_decision in ('more_info_required', 'rejected', 'suspended') and nullif(trim(p_note), '') is null then
    raise exception 'A note is required for this decision' using errcode = '22023';
  end if;

  update public.runner_profiles
     set status = v_next,
         reviewed_by = v_actor,
         reviewed_at = now(),
         review_note = nullif(trim(p_note), ''),
         available = case when v_next = 'approved' then available else false end
   where user_id = p_runner;

  if v_next = 'approved' then
    insert into public.user_roles (user_id, role, granted_by)
    values (p_runner, 'runner', v_actor)
    on conflict do nothing;

    -- Transport types that need no vehicle check are confirmed automatically.
    update public.runner_capabilities c
       set verified_at = now(), verified_by = v_actor
      from public.transport_categories t
     where c.runner_id = p_runner and t.id = c.transport_id
       and not t.requires_vehicle_check and c.verified_at is null;
  elsif v_next in ('rejected', 'suspended') then
    delete from public.user_roles where user_id = p_runner and role = 'runner';
  end if;

  perform public.log_audit(
    'runner.' || p_decision, 'runner', p_runner::text,
    jsonb_build_object('from', v_current, 'to', v_next, 'note', nullif(trim(p_note), ''))
  );
end;
$$;

-- Confirms (or withdraws) the check for one vehicle type, for example a keke licence.
create function public.admin_verify_capability(p_runner uuid, p_transport text, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;

  update public.runner_capabilities
     set verified_at = case when p_verified then now() end,
         verified_by = case when p_verified then (select auth.uid()) end
   where runner_id = p_runner and transport_id = p_transport;
  if not found then
    raise exception 'Capability not found' using errcode = 'P0002';
  end if;

  perform public.log_audit(
    'runner.capability_verified', 'runner', p_runner::text,
    jsonb_build_object('transport', p_transport, 'verified', p_verified)
  );
end;
$$;

-- Account-level suspension of any user. A suspended runner also loses the runner role.
create function public.admin_set_suspended(p_user uuid, p_suspended boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'You cannot suspend your own account' using errcode = '22023';
  end if;
  if p_suspended and nullif(trim(p_note), '') is null then
    raise exception 'A note is required to suspend an account' using errcode = '22023';
  end if;

  update public.profiles
     set suspended_at = case when p_suspended then now() end
   where id = p_user;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  if p_suspended then
    update public.runner_profiles
       set available = false,
           status = case when status = 'approved' then 'suspended'::public.verification_status else status end
     where user_id = p_user;
    delete from public.user_roles where user_id = p_user and role = 'runner';
  end if;

  perform public.log_audit(
    case when p_suspended then 'user.suspended' else 'user.reactivated' end,
    'user', p_user::text, jsonb_build_object('note', nullif(trim(p_note), ''))
  );
end;
$$;

-- Execute rights: signed-in users only. Each function checks the caller itself.
revoke execute on function
  public.save_runner_application(text, date, uuid, text, text, boolean, boolean, text[], jsonb),
  public.register_runner_document(text, text),
  public.submit_runner_application(),
  public.set_runner_availability(boolean),
  public.admin_review_runner(uuid, text, text),
  public.admin_verify_capability(uuid, text, boolean),
  public.admin_set_suspended(uuid, boolean, text)
  from public, anon;

grant execute on function
  public.save_runner_application(text, date, uuid, text, text, boolean, boolean, text[], jsonb),
  public.register_runner_document(text, text),
  public.submit_runner_application(),
  public.set_runner_availability(boolean),
  public.admin_review_runner(uuid, text, text),
  public.admin_verify_capability(uuid, text, boolean),
  public.admin_set_suspended(uuid, boolean, text)
  to authenticated;
