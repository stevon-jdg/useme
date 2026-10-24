-- Tests for in-app notifications. One transaction, rolled back. Look for "NOTIFICATIONS PASSED".
begin;
create schema nt;
grant usage on schema nt to public;
create function nt.as_user(p uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;
create function nt.claim(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, true); end $$;
create function nt.back() returns void language plpgsql as $$ begin execute 'reset role'; end $$;
create function nt.check(ok boolean, label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAILED: %', label; end if; raise notice 'pass: %', label; end $$;
create function nt.count_for(p uuid, k text) returns int language sql as $$
  select count(*)::int from public.notifications where user_id = p and kind = k $$;
grant execute on all functions in schema nt to public;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f5', 'nc@t.local', '{"full_name":"N Cust"}'),
  ('00000000-0000-0000-0000-0000000000f6', 'nr@t.local', '{"full_name":"N Run"}'),
  ('00000000-0000-0000-0000-0000000000f7', 'no@t.local', '{"full_name":"N Other"}');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000f6', 'runner');
insert into public.runner_profiles (user_id, legal_name, date_of_birth, status, service_area_id)
values ('00000000-0000-0000-0000-0000000000f6', 'Notify Runner', date '1995-01-01', 'submitted', (select id from public.service_areas where slug = 'jalingo'));

do $$
declare
  c uuid := '00000000-0000-0000-0000-0000000000f5';
  r uuid := '00000000-0000-0000-0000-0000000000f6';
  o uuid := '00000000-0000-0000-0000-0000000000f7';
  e uuid; n int; a int;
begin
  insert into public.errands (customer_id, category_id, service_area_id, title, pickup_text, transport_id, distance_km, status, suggested_fare_kobo)
  values (c, (select id from public.errand_categories limit 1), (select id from public.service_areas where slug = 'jalingo'), 'Notify me', 'Market', null, 2, 'searching', 100000)
  returning id into e;
  insert into public.errand_assignments (errand_id, runner_id, fare_kobo, commission_kobo) values (e, r, 100000, 12000);

  -- the runner moves the errand along
  perform nt.claim(r);
  update public.errands set status = 'assigned' where id = e;
  update public.errands set status = 'heading_to_pickup' where id = e;
  perform nt.claim(null);
  perform nt.check(nt.count_for(c, 'errand') = 2, 'customer is told when the runner accepts and heads out');
  perform nt.check(nt.count_for(r, 'errand') = 0, 'runner is not told about their own moves');

  -- a customer cancelling tells the runner, not themselves
  perform nt.claim(c);
  update public.errands set status = 'cancelled' where id = e;
  perform nt.claim(null);
  perform nt.check(nt.count_for(c, 'errand') = 2, 'customer is not told about their own cancel');
  perform nt.check(nt.count_for(r, 'errand') = 1, 'runner is told the customer cancelled');

  -- messages share one unread notification per errand
  insert into public.errand_messages (errand_id, sender_id, body) values (e, r, 'On my way');
  insert into public.errand_messages (errand_id, sender_id, body) values (e, r, 'Almost there');
  perform nt.check(nt.count_for(c, 'message') = 1, 'two unread messages make one notification');
  perform nt.check((select body from public.notifications where user_id = c and kind = 'message') = 'Almost there', 'it shows the latest message');
  insert into public.errand_messages (errand_id, sender_id, body) values (e, c, 'Thanks');
  perform nt.check(nt.count_for(r, 'message') = 1, 'the runner is told about the customer message');

  -- runner application decisions
  update public.runner_profiles set status = 'approved' where user_id = r;
  perform nt.check(nt.count_for(r, 'runner') = 1, 'runner is told they are approved');

  -- reading and privacy
  perform nt.as_user(o);
  select count(*) into n from public.notifications;
  perform nt.back();
  perform nt.check(n = 0, 'a stranger sees no notifications');

  perform nt.as_user(c);
  select count(*) into n from public.notifications where read_at is null;
  perform public.mark_notifications_read();
  select count(*) into a from public.notifications where read_at is null;
  perform nt.back();
  perform nt.check(n >= 3 and a = 0, 'mark all read clears the unread ones');

  perform nt.as_user(o);
  perform public.mark_notifications_read();
  perform nt.back();
  perform nt.check((select count(*) from public.notifications where user_id = r and read_at is null) = 3, 'a stranger cannot mark someone else''s as read');

  perform nt.as_user(c);
  begin insert into public.notifications (user_id, kind, title) values (c, 'x', 'forged'); n := 1; exception when others then n := 0; end;
  perform nt.back();
  perform nt.check(n = 0, 'nobody can write notifications directly');
  raise notice 'NOTIFICATIONS PASSED';
end $$;
rollback;
