-- Tests for problem reports. One transaction, rolled back. Look for "SUPPORT PASSED".
begin;
create schema st;
grant usage on schema st to public;
create function st.as_user(p uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;
create function st.back() returns void language plpgsql as $$ begin execute 'reset role'; end $$;
create function st.check(ok boolean, label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAILED: %', label; end if; raise notice 'pass: %', label; end $$;
create function st.refused(p uuid, q text) returns boolean language plpgsql as $$
begin
  perform st.as_user(p);
  begin execute q; exception when others then perform st.back(); return true; end;
  perform st.back(); return false;
end $$;
grant execute on all functions in schema st to public;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a5', 'sc@t.local', '{"full_name":"S Cust"}'),
  ('00000000-0000-0000-0000-0000000000a6', 'sr@t.local', '{"full_name":"S Run"}'),
  ('00000000-0000-0000-0000-0000000000a7', 'so@t.local', '{"full_name":"S Other"}'),
  ('00000000-0000-0000-0000-0000000000a8', 'sa@t.local', '{"full_name":"S Admin"}');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a6', 'runner'), ('00000000-0000-0000-0000-0000000000a8', 'admin');
insert into public.runner_profiles (user_id, legal_name, date_of_birth, status, service_area_id)
values ('00000000-0000-0000-0000-0000000000a6', 'Support Runner', date '1995-01-01', 'approved', (select id from public.service_areas where slug = 'jalingo'));

do $$
declare
  c uuid := '00000000-0000-0000-0000-0000000000a5';
  r uuid := '00000000-0000-0000-0000-0000000000a6';
  o uuid := '00000000-0000-0000-0000-0000000000a7';
  ad uuid := '00000000-0000-0000-0000-0000000000a8';
  e uuid; rid uuid; n int;
begin
  insert into public.errands (customer_id, category_id, service_area_id, title, pickup_text, transport_id, distance_km, status, suggested_fare_kobo)
  values (c, (select id from public.errand_categories limit 1), (select id from public.service_areas where slug = 'jalingo'), 'Report me', 'Market', null, 2, 'completed', 100000)
  returning id into e;
  insert into public.errand_assignments (errand_id, runner_id, fare_kobo, commission_kobo, ended_at, end_reason)
  values (e, r, 100000, 12000, now(), 'completed');

  perform st.as_user(c);
  rid := public.report_problem(e, 'wrong_fee', 'Runner asked for more');
  perform st.back();
  perform st.check(rid is not null, 'customer can report a problem');
  perform st.check(st.refused(c, format('select public.report_problem(%L, %L)', e, 'other')), 'a second open report is refused');
  perform st.check(st.refused(c, format('select public.report_problem(%L, %L)', e, 'made_up')), 'unknown reason is refused');

  perform st.as_user(r);
  perform public.report_problem(e, 'no_show', null);
  perform st.back();
  perform st.check(true, 'the runner can report on the same errand');

  perform st.check(st.refused(o, format('select public.report_problem(%L, %L)', e, 'other')), 'a stranger cannot report');

  perform st.as_user(o);
  select count(*) into n from public.support_reports;
  perform st.back();
  perform st.check(n = 0, 'a stranger sees no reports');
  perform st.as_user(c);
  select count(*) into n from public.support_reports;
  perform st.back();
  perform st.check(n = 1, 'a reporter sees only their own report');

  perform st.check(st.refused(c, format('select public.admin_resolve_report(%L, %L)', rid, 'done by me')), 'a customer cannot resolve');
  perform st.check(st.refused(c, 'select * from public.admin_list_reports()'), 'a customer cannot list all reports');

  perform st.as_user(ad);
  select count(*) into n from public.admin_list_reports() where status = 'open';
  perform st.check(n = 2, 'admin sees both open reports');
  perform public.admin_resolve_report(rid, 'Refunded the extra cash');
  perform st.back();
  perform st.check(st.refused(ad, format('select public.admin_resolve_report(%L, %L)', rid, 'again please')), 'resolving twice is refused');
  perform st.check(st.refused(ad, format('select public.admin_resolve_report(%L, %L)', rid, 'x')), 'a note is required');

  perform st.as_user(c);
  perform public.report_problem(e, 'other', 'Another thing');
  perform st.back();
  perform st.check(true, 'after resolving, a new report can be opened');
  raise notice 'SUPPORT PASSED';
end $$;
rollback;
