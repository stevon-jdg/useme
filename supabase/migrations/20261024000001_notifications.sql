-- In-app notifications. Rows are created only by database triggers when something happens that a person
-- should hear about. People read their own and mark them read. Nobody writes them from the browser.

create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null,
  title      text not null check (char_length(title) <= 120),
  body       text check (body is null or char_length(body) <= 300),
  link       text check (link is null or (link like '/%' and char_length(link) <= 200)),
  errand_id  uuid references public.errands (id) on delete cascade,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Mark everything read, or only the listed ones.
create function public.mark_notifications_read(p_ids bigint[] default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  update public.notifications
     set read_at = now()
   where user_id = v_uid and read_at is null and (p_ids is null or id = any (p_ids));
end;
$$;

revoke all on function public.mark_notifications_read(bigint[]) from public, anon;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;

-- Internal helper used by the triggers below. Not callable from the browser.
create function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text, p_errand uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null then
    return;
  end if;
  insert into public.notifications (user_id, kind, title, body, link, errand_id)
  values (p_user, p_kind, left(p_title, 120), left(p_body, 300), p_link, p_errand);
end;
$$;
revoke all on function public.notify(uuid, text, text, text, text, uuid) from public, anon, authenticated;

-- 1. Errand status changes tell the customer, and tell the runner when the customer cancels.
create function public.notify_errand_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_runner uuid;
  v_link text := '/app/errands/' || new.id;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select runner_id into v_runner from public.errand_assignments
   where errand_id = new.id order by accepted_at desc limit 1;

  if new.status = 'cancelled' then
    if v_actor is distinct from new.customer_id then
      perform public.notify(new.customer_id, 'errand', 'Errand cancelled', coalesce(new.cancelled_reason, 'This errand was cancelled.'), v_link, new.id);
    elsif v_runner is not null and old.status <> 'searching' then
      perform public.notify(v_runner, 'errand', 'Errand cancelled', 'The customer cancelled this errand.', '/runner', new.id);
    end if;
    return new;
  end if;

  if v_actor is not distinct from new.customer_id then
    return new;
  end if;

  case new.status::text
    when 'assigned' then perform public.notify(new.customer_id, 'errand', 'Runner accepted', 'A runner has taken your errand.', v_link, new.id);
    when 'heading_to_pickup' then perform public.notify(new.customer_id, 'errand', 'Runner is on the way', 'Your runner is heading to the pickup.', v_link, new.id);
    when 'arrived_at_pickup' then perform public.notify(new.customer_id, 'errand', 'Runner has arrived', 'Your runner is at the pickup.', v_link, new.id);
    when 'in_progress' then perform public.notify(new.customer_id, 'errand', 'On the way to the destination', 'Your errand is in progress.', v_link, new.id);
    when 'awaiting_confirmation' then perform public.notify(new.customer_id, 'errand', 'Almost done', 'Confirm the delivery with your code.', v_link, new.id);
    when 'completed' then perform public.notify(new.customer_id, 'errand', 'Errand completed', 'Thank you. You can rate your runner.', v_link, new.id);
    else null;
  end case;
  return new;
end;
$$;
create trigger errands_notify after update of status on public.errands
  for each row execute function public.notify_errand_status();

-- 2. New chat messages tell the other person. Unread messages on one errand share one notification.
create function public.notify_errand_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid;
  v_runner uuid;
  v_to uuid;
  v_link text;
begin
  select customer_id into v_customer from public.errands where id = new.errand_id;
  select runner_id into v_runner from public.errand_assignments
   where errand_id = new.errand_id order by accepted_at desc limit 1;
  if new.sender_id = v_customer then
    v_to := v_runner;
    v_link := '/runner';
  else
    v_to := v_customer;
    v_link := '/app/errands/' || new.errand_id;
  end if;
  if v_to is null then
    return new;
  end if;

  update public.notifications
     set body = left(new.body, 300), created_at = now()
   where user_id = v_to and kind = 'message' and errand_id = new.errand_id and read_at is null;
  if not found then
    perform public.notify(v_to, 'message', 'New message', new.body, v_link, new.errand_id);
  end if;
  return new;
end;
$$;
create trigger errand_messages_notify after insert on public.errand_messages
  for each row execute function public.notify_errand_message();

-- 3. A new request offered to a runner.
create function public.notify_dispatch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    perform public.notify(new.runner_id, 'dispatch', 'New errand request', 'Open the app to accept or decline.', '/runner', new.errand_id);
  end if;
  return new;
end;
$$;
create trigger errand_dispatches_notify after insert on public.errand_dispatches
  for each row execute function public.notify_dispatch();

-- 4. Runner application decisions.
create function public.notify_runner_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  case new.status::text
    when 'approved' then perform public.notify(new.user_id, 'runner', 'You are approved', 'You can now go online and receive errands.', '/runner');
    when 'more_info_required' then perform public.notify(new.user_id, 'runner', 'We need more from you', coalesce(new.review_note, 'Open your application to see what is missing.'), '/app/runner-application');
    when 'rejected' then perform public.notify(new.user_id, 'runner', 'Application not approved', coalesce(new.review_note, 'Open your application for details.'), '/app/runner-application');
    when 'suspended' then perform public.notify(new.user_id, 'runner', 'Account suspended', coalesce(new.review_note, 'Contact UseMe support.'), '/app/runner-application');
    else null;
  end case;
  return new;
end;
$$;
create trigger runner_profiles_notify after update of status on public.runner_profiles
  for each row execute function public.notify_runner_status();

-- 5. A resolved problem report.
create function public.notify_report_resolved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid;
begin
  if new.status = 'resolved' and old.status = 'open' then
    select customer_id into v_customer from public.errands where id = new.errand_id;
    perform public.notify(
      new.reporter_id, 'report', 'Your report was resolved', new.resolution_note,
      case when v_customer = new.reporter_id then '/app/errands/' || new.errand_id else '/runner' end,
      new.errand_id
    );
  end if;
  return new;
end;
$$;
create trigger support_reports_notify after update of status on public.support_reports
  for each row execute function public.notify_report_resolved();

-- Realtime, so the bell updates the moment something arrives. Row Level Security still limits it to your own rows.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
