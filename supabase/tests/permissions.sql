-- Permission tests for the Phase 4 database.
-- Safe on a real project: everything runs in one transaction that is rolled back at the end.
--   Local:     see supabase/tests/README.md
--   Supabase:  paste into the SQL editor and run, then look for "ALL PASSED" in the messages.
-- A failed check raises an error and stops the script.

begin;

create schema tests;
grant usage on schema tests to public;

-- Runs SQL as a user (or anon when null) and returns how many rows it returned or changed.
create function tests.rows_as(p_user uuid, p_sql text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  if p_user is null then
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '', true);
  else
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  end if;
  execute 'with q as (' || p_sql || ') select count(*) from q' into n;
  execute 'reset role';
  return n;
exception when others then
  execute 'reset role';
  raise;
end $$;

-- Runs a statement as a user and reports whether the database refused it.
create function tests.refused_as(p_user uuid, p_sql text) returns boolean
language plpgsql as $$
begin
  if p_user is null then
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '', true);
  else
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  end if;
  begin
    execute p_sql;
  exception when others then
    execute 'reset role';
    return true;
  end;
  execute 'reset role';
  return false;
end $$;

-- True when the database either refuses the query or returns no rows. Supabase lets anon query
-- some tables and hides the rows with policies, while a plain database may refuse outright.
create function tests.sees_nothing(p_user uuid, p_sql text) returns boolean
language plpgsql as $$
begin
  return tests.rows_as(p_user, p_sql) = 0;
exception when others then
  return true;
end $$;

create function tests.check(p_ok boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_ok is not true then
    raise exception 'FAILED: %', p_label;
  end if;
  raise notice 'pass: %', p_label;
end $$;

grant execute on all functions in schema tests to public;

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000a001', 'alice@test.local', '{"full_name":"Alice Customer","phone":"08031234567"}'),
  ('00000000-0000-0000-0000-00000000b002', 'bob@test.local',   '{"full_name":"Bob Customer"}'),
  ('00000000-0000-0000-0000-00000000c003', 'rita@test.local',  '{"full_name":"Rita Runner"}'),
  ('00000000-0000-0000-0000-00000000d004', 'adam@test.local',  '{"full_name":"Adam Admin"}'),
  ('00000000-0000-0000-0000-00000000e005', 'sue@test.local',   '{"full_name":"Sue Super"}'),
  -- Hostile signup: tries to give itself admin through metadata it controls.
  ('00000000-0000-0000-0000-00000000f006', 'mal@test.local',   '{"full_name":"Mal Hacker","role":"admin","roles":["super_admin"]}');

insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000d004', 'admin'),
  ('00000000-0000-0000-0000-00000000e005', 'super_admin'),
  ('00000000-0000-0000-0000-00000000e005', 'admin');

-- ---------------------------------------------------------------- tests
do $$
declare
  alice uuid := '00000000-0000-0000-0000-00000000a001';
  bob   uuid := '00000000-0000-0000-0000-00000000b002';
  rita  uuid := '00000000-0000-0000-0000-00000000c003';
  adam  uuid := '00000000-0000-0000-0000-00000000d004';
  sue   uuid := '00000000-0000-0000-0000-00000000e005';
  mal   uuid := '00000000-0000-0000-0000-00000000f006';
  area  uuid;
  err_alice uuid;
begin
  select id into area from public.service_areas where slug = 'jalingo';

  -- ---- signup
  perform tests.check((select count(*) from public.profiles where id = alice) = 1, 'signup creates a profile');
  perform tests.check(exists (select 1 from public.user_roles where user_id = alice and role = 'customer'), 'signup grants the customer role');
  perform tests.check(not exists (select 1 from public.user_roles where user_id = mal and role in ('admin', 'super_admin', 'runner')), 'signup metadata cannot grant admin or runner');

  -- ---- profiles
  perform tests.check(tests.rows_as(alice, 'select 1 from public.profiles') = 1, 'customer sees only their own profile');
  perform tests.check(tests.rows_as(adam, 'select 1 from public.profiles') = 6, 'admin sees all profiles');
  perform tests.check(tests.refused_as(null, 'select * from public.profiles'), 'anon cannot read profiles');
  perform tests.check(tests.rows_as(alice, 'update public.profiles set full_name = ''Alice Renamed'' where id = ''' || alice || ''' returning 1') = 1, 'customer can edit their own name');
  perform tests.check(tests.rows_as(alice, 'update public.profiles set full_name = ''Hijack'' where id = ''' || bob || ''' returning 1') = 0, 'customer cannot edit another profile');
  perform tests.check(tests.refused_as(alice, 'update public.profiles set id = gen_random_uuid() where id = ''' || alice || ''''), 'customer cannot change their profile id');
  perform tests.check(tests.refused_as(alice, 'update public.profiles set suspended_at = null where id = ''' || alice || ''''), 'customer cannot touch the suspension flag');
  perform tests.check(tests.refused_as(alice, 'delete from public.profiles where id = ''' || alice || ''''), 'customer cannot delete their profile');

  -- ---- roles
  perform tests.check(tests.refused_as(alice, 'insert into public.user_roles (user_id, role) values (''' || alice || ''', ''admin'')'), 'customer cannot insert a role');
  perform tests.check(tests.refused_as(alice, 'update public.user_roles set role = ''admin'' where user_id = ''' || alice || ''''), 'customer cannot update a role');
  perform tests.check(tests.refused_as(alice, 'delete from public.user_roles where user_id = ''' || alice || ''''), 'customer cannot delete a role');
  perform tests.check(tests.rows_as(alice, 'select 1 from public.user_roles') = 1, 'customer sees only their own roles');
  perform tests.check(tests.refused_as(alice, 'select public.grant_role(''' || alice || ''', ''admin'')'), 'customer cannot call grant_role');
  perform tests.check(tests.refused_as(adam, 'select public.grant_role(''' || alice || ''', ''admin'')'), 'plain admin cannot call grant_role');
  perform tests.check(not tests.refused_as(sue, 'select public.grant_role(''' || bob || ''', ''admin'')'), 'super admin can grant admin');
  perform tests.check(exists (select 1 from public.user_roles where user_id = bob and role = 'admin'), 'the admin role was granted');
  perform tests.check(tests.refused_as(sue, 'select public.grant_role(''' || bob || ''', ''runner'')'), 'grant_role refuses the runner role');
  perform tests.check(tests.refused_as(adam, 'select public.revoke_role(''' || bob || ''', ''admin'')'), 'plain admin cannot revoke roles');
  perform tests.check(not tests.refused_as(sue, 'select public.revoke_role(''' || bob || ''', ''admin'')'), 'super admin can revoke admin');
  perform tests.check(tests.refused_as(sue, 'select public.revoke_role(''' || sue || ''', ''super_admin'')'), 'super admin cannot remove their own role');

  -- ---- audit log
  perform tests.check(tests.rows_as(alice, 'select 1 from public.audit_logs') = 0, 'customer sees no audit rows');
  perform tests.check(tests.rows_as(adam, 'select 1 from public.audit_logs') >= 2, 'admin sees audit rows');
  perform tests.check(tests.refused_as(adam, 'insert into public.audit_logs (action, target_type) values (''x'', ''y'')'), 'admin cannot write audit rows directly');
  perform tests.check(tests.refused_as(sue, 'delete from public.audit_logs'), 'nobody can delete audit rows');
  perform tests.check(tests.refused_as(alice, 'select public.log_audit(''x'', ''y'', null, ''{}''::jsonb)'), 'customer cannot call log_audit');

  -- ---- configuration data
  perform tests.check(tests.rows_as(null, 'select 1 from public.service_areas') = 1, 'anon can read the service area');
  perform tests.check(tests.rows_as(null, 'select 1 from public.transport_categories') = 5, 'anon can read transport types');
  perform tests.check(tests.rows_as(null, 'select 1 from public.errand_categories') = 5, 'anon can read errand categories');
  perform tests.check(tests.rows_as(alice, 'update public.service_areas set name = ''Hacked'' returning 1') = 0, 'customer cannot edit service areas');
  perform tests.check(tests.refused_as(null, 'update public.service_areas set name = ''Hacked'''), 'anon cannot edit service areas');
  perform tests.check(tests.rows_as(adam, 'update public.transport_categories set max_km = 4 where id = ''walking'' returning 1') = 1, 'admin can edit transport types');

  -- ---- runner application: input rules
  perform tests.check(tests.refused_as(rita, 'select public.set_runner_availability(true)'), 'an unapproved user cannot go available');
  perform tests.check(tests.refused_as(rita, format($f$select public.save_runner_application('Rita Runner', '2015-01-01', %L, 'Mum', '08030000000', true, true, array['walking'])$f$, area)), 'under 18 is rejected');
  perform tests.check(tests.refused_as(rita, format($f$select public.save_runner_application('Rita Runner', '1999-01-01', %L, 'Mum', '08030000000', true, true, array['spaceship'])$f$, area)), 'an unknown transport type is rejected');
  perform tests.check(tests.refused_as(rita, format($f$select public.save_runner_application('Rita Runner', '1999-01-01', %L, 'Mum', '08030000000', true, true, array[]::text[])$f$, area)), 'at least one transport type is required');
  perform tests.check(not tests.refused_as(rita, format($f$select public.save_runner_application('Rita Runner', '1999-01-01', %L, 'Mum', '08030000000', true, true, array['walking','keke'], '{"keke":"TRB-123"}'::jsonb)$f$, area)), 'a valid application saves');

  -- ---- runner application: cannot cheat the workflow
  perform tests.check(tests.refused_as(rita, 'update public.runner_profiles set status = ''approved'' where user_id = ''' || rita || ''''), 'runner cannot approve themselves directly');
  perform tests.check(tests.refused_as(rita, 'insert into public.runner_profiles (user_id, legal_name, date_of_birth, status) values (''' || mal || ''', ''Fake Person'', ''1990-01-01'', ''approved'')'), 'runner cannot insert a profile for someone else');
  perform tests.check(tests.refused_as(rita, 'select public.admin_review_runner(''' || rita || ''', ''approved'', null)'), 'runner cannot call admin_review_runner');
  perform tests.check(tests.refused_as(rita, 'select public.submit_runner_application()'), 'cannot submit without an identity document');
  perform tests.check(tests.refused_as(rita, 'select public.register_runner_document(''id_document'', ''' || bob || '/id.jpg'')'), 'cannot register a document in someone else''s folder');
  perform tests.check(tests.refused_as(rita, 'select public.register_runner_document(''passport_of_doom'', ''' || rita || '/x.jpg'')'), 'unknown document kind is rejected');
  perform tests.check(not tests.refused_as(rita, 'select public.register_runner_document(''id_document'', ''' || rita || '/id.jpg'')'), 'runner can register an identity document');
  perform tests.check(not tests.refused_as(rita, 'select public.register_runner_document(''selfie'', ''' || rita || '/selfie.jpg'')'), 'runner can register a selfie');
  perform tests.check(tests.refused_as(rita, 'select public.submit_runner_application()'), 'a keke runner cannot submit without a vehicle licence');
  perform tests.check(not tests.refused_as(rita, 'select public.register_runner_document(''vehicle_licence'', ''' || rita || '/licence.jpg'')'), 'runner can register a vehicle licence');
  perform tests.check(not tests.refused_as(rita, 'select public.submit_runner_application()'), 'a complete application submits');
  perform tests.check(tests.refused_as(rita, 'select public.submit_runner_application()'), 'cannot submit twice');
  perform tests.check(tests.refused_as(rita, format($f$select public.save_runner_application('Rita Changed', '1999-01-01', %L, 'Mum', '08030000000', true, true, array['car'])$f$, area)), 'cannot edit after submitting');

  -- ---- who can see applications and documents
  perform tests.check(tests.rows_as(alice, 'select 1 from public.runner_profiles') = 0, 'customer cannot see runner applications');
  perform tests.check(tests.rows_as(alice, 'select 1 from public.runner_documents') = 0, 'customer cannot see runner documents');
  perform tests.check(tests.rows_as(rita, 'select 1 from public.runner_documents') = 3, 'runner sees their own documents');
  perform tests.check(tests.rows_as(adam, 'select 1 from public.runner_documents') = 3, 'admin sees runner documents');

  -- ---- admin review rules
  -- Adam gets a submitted application of his own, to prove an admin cannot approve themselves.
  insert into public.runner_profiles (user_id, legal_name, date_of_birth, status)
    values (adam, 'Adam Admin', '1990-01-01', 'submitted');
  perform tests.check(tests.refused_as(adam, 'select public.admin_review_runner(''' || adam || ''', ''approved'', null)'), 'admin cannot approve their own application');
  perform tests.check((select status from public.runner_profiles where user_id = adam) = 'submitted', 'self-approval attempt changed nothing');
  perform tests.check(tests.refused_as(adam, 'select public.admin_review_runner(''' || rita || ''', ''rejected'', null)'), 'rejection requires a note');
  perform tests.check(tests.refused_as(adam, 'select public.admin_review_runner(''' || rita || ''', ''suspended'', ''too early'')'), 'cannot suspend a runner who is not approved');
  perform tests.check(tests.refused_as(adam, 'select public.admin_review_runner(''' || rita || ''', ''banana'', null)'), 'unknown decision is rejected');
  perform tests.check(not tests.refused_as(adam, 'select public.admin_review_runner(''' || rita || ''', ''under_review'', null)'), 'admin can start review');
  perform tests.check(not tests.refused_as(adam, 'select public.admin_review_runner(''' || rita || ''', ''approved'', ''Checked in person'')'), 'admin can approve');
  perform tests.check(exists (select 1 from public.user_roles where user_id = rita and role = 'runner'), 'approval grants the runner role');
  perform tests.check((select tier from public.runner_profiles where user_id = rita) = 'verified', 'approval starts at the verified tier');
  perform tests.check((select verified_at is not null from public.runner_capabilities where runner_id = rita and transport_id = 'walking'), 'walking is confirmed without vehicle papers');
  perform tests.check((select verified_at is null from public.runner_capabilities where runner_id = rita and transport_id = 'keke'), 'keke stays unconfirmed until an admin checks it');
  perform tests.check(exists (select 1 from public.audit_logs where action = 'runner.approved' and target_id = rita::text), 'approval is in the audit log');
  perform tests.check(tests.refused_as(alice, 'select public.admin_verify_capability(''' || rita || ''', ''keke'', true)'), 'customer cannot verify a capability');
  perform tests.check(not tests.refused_as(adam, 'select public.admin_verify_capability(''' || rita || ''', ''keke'', true)'), 'admin can verify the keke licence');
  perform tests.check((select verified_at is not null from public.runner_capabilities where runner_id = rita and transport_id = 'keke'), 'keke is now confirmed');

  -- ---- availability, suspension, reinstatement
  perform tests.check(not tests.refused_as(rita, 'select public.set_runner_availability(true)'), 'approved runner can go available');
  perform tests.check((select available from public.runner_profiles where user_id = rita), 'availability was saved');
  perform tests.check(tests.refused_as(adam, 'select public.admin_set_suspended(''' || rita || ''', true, null)'), 'suspension requires a note');
  perform tests.check(tests.refused_as(adam, 'select public.admin_set_suspended(''' || adam || ''', true, ''self'')'), 'admin cannot suspend themselves');
  perform tests.check(tests.refused_as(alice, 'select public.admin_set_suspended(''' || rita || ''', true, ''spite'')'), 'customer cannot suspend anyone');
  perform tests.check(not tests.refused_as(adam, 'select public.admin_set_suspended(''' || rita || ''', true, ''Complaint under review'')'), 'admin can suspend an account');
  perform tests.check(not exists (select 1 from public.user_roles where user_id = rita and role = 'runner'), 'suspension removes the runner role');
  perform tests.check(not (select available from public.runner_profiles where user_id = rita), 'suspension takes the runner offline');
  perform tests.check((select status from public.runner_profiles where user_id = rita) = 'suspended', 'suspension marks the application suspended');
  perform tests.check(tests.refused_as(rita, 'select public.set_runner_availability(true)'), 'suspended runner cannot go available');
  perform tests.check(not tests.refused_as(adam, 'select public.admin_set_suspended(''' || rita || ''', false, null)'), 'admin can lift the account suspension');
  perform tests.check(not tests.refused_as(adam, 'select public.admin_review_runner(''' || rita || ''', ''reinstated'', null)'), 'admin can reinstate the runner');
  perform tests.check(exists (select 1 from public.user_roles where user_id = rita and role = 'runner'), 'reinstatement restores the runner role');

  -- ---- private document storage
  perform tests.check(not tests.refused_as(alice, 'insert into storage.objects (bucket_id, name, owner) values (''runner-documents'', ''' || alice || '/id.jpg'', ''' || alice || ''')'), 'user can upload into their own folder');
  perform tests.check(tests.refused_as(alice, 'insert into storage.objects (bucket_id, name, owner) values (''runner-documents'', ''' || bob || '/id.jpg'', ''' || alice || ''')'), 'user cannot upload into someone else''s folder');
  insert into storage.objects (bucket_id, name, owner) values ('runner-documents', bob::text || '/id.jpg', bob);
  perform tests.check(tests.rows_as(alice, 'select 1 from storage.objects') = 1, 'user reads only their own files');
  perform tests.check(tests.rows_as(adam, 'select 1 from storage.objects') = 2, 'admin reads every runner document');
  perform tests.check(tests.sees_nothing(null, 'select 1 from storage.objects'), 'anon cannot read stored files');
  perform tests.check((select not public from storage.buckets where id = 'runner-documents'), 'the document bucket is private');

  -- ---- errands (inserted as the owner role, because customers cannot insert directly yet)
  insert into public.errands (customer_id, category_id, service_area_id, title, pickup_text, destination_text, transport_id, distance_km)
    values (alice, 'pickup_delivery', area, 'Alice parcel', 'Market', 'Home', 'keke', 2.4) returning id into err_alice;
  insert into public.errands (customer_id, category_id, service_area_id, title, pickup_text, destination_text, transport_id, distance_km)
    values (bob, 'pickup_delivery', area, 'Bob parcel', 'Shop', 'Office', 'keke', 1.2);
  perform tests.check(tests.rows_as(alice, 'select 1 from public.errands') = 1, 'customer sees only their own errands');
  perform tests.check(tests.rows_as(bob, 'select 1 from public.errands') = 1, 'another customer sees only theirs');
  perform tests.check(tests.rows_as(rita, 'select 1 from public.errands') = 0, 'a runner cannot read errands directly');
  perform tests.check(tests.rows_as(adam, 'select 1 from public.errands') = 2, 'admin sees all errands');
  perform tests.check(tests.refused_as(null, 'select * from public.errands'), 'anon cannot read errands');
  perform tests.check(tests.refused_as(alice, format($f$insert into public.errands (customer_id, category_id, service_area_id, title, pickup_text, transport_id, distance_km) values (%L, 'custom', %L, 'Free ride', 'x', 'keke', 1)$f$, alice, area)), 'customer cannot insert errands directly');
  perform tests.check(tests.refused_as(alice, 'update public.errands set status = ''completed'' where id = ''' || err_alice || ''''), 'customer cannot change an errand status directly');
  perform tests.check(tests.refused_as(alice, 'delete from public.errands'), 'customer cannot delete errands');

  raise notice 'ALL PASSED';
end $$;

rollback;
