-- Phase 4, migration 5: stop an administrator from reviewing their own runner application.
-- The original function allowed it, which would let an admin who also applies as a runner
-- approve themselves. This replaces the function body only. Existing grants are kept.

create or replace function public.admin_review_runner(p_runner uuid, p_decision text, p_note text default null)
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
  if p_runner = v_actor then
    raise exception 'You cannot review your own application' using errcode = '42501';
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
