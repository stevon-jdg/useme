-- Tests for the cash ledger. One transaction, rolled back. Look for "WALLET PASSED".
begin;
create schema wt;
grant usage on schema wt to public;
create function wt.as_user(p uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;
create function wt.back() returns void language plpgsql as $$ begin execute 'reset role'; end $$;
create function wt.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', label; end if;
  raise notice 'pass: %', label;
end $$;
create function wt.refused(p uuid, q text) returns boolean language plpgsql as $$
begin
  perform wt.as_user(p);
  begin execute q; exception when others then perform wt.back(); return true; end;
  perform wt.back();
  return false;
end $$;
grant execute on all functions in schema wt to public;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'wc@t.local', '{"full_name":"W Cust"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'wr@t.local', '{"full_name":"W Run"}'),
  ('00000000-0000-0000-0000-0000000000d3', 'wr2@t.local', '{"full_name":"W Run Two"}'),
  ('00000000-0000-0000-0000-0000000000d4', 'wa@t.local', '{"full_name":"W Admin"}');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000d2', 'runner'), ('00000000-0000-0000-0000-0000000000d3', 'runner'),
  ('00000000-0000-0000-0000-0000000000d4', 'admin');
insert into public.runner_profiles (user_id, legal_name, date_of_birth, status, service_area_id)
select u, 'Wallet Runner', date '1995-01-01', 'approved', (select id from public.service_areas where slug = 'jalingo')
from (values ('00000000-0000-0000-0000-0000000000d2'::uuid), ('00000000-0000-0000-0000-0000000000d3'::uuid)) v(u);

do $$
declare
  c  uuid := '00000000-0000-0000-0000-0000000000d1';
  r  uuid := '00000000-0000-0000-0000-0000000000d2';
  r2 uuid := '00000000-0000-0000-0000-0000000000d3';
  ad uuid := '00000000-0000-0000-0000-0000000000d4';
  e uuid; w jsonb; n int;
begin
  for i in 1..2 loop
    insert into public.errands (customer_id, category_id, service_area_id, title, pickup_text, transport_id, distance_km, status, suggested_fare_kobo)
    select c, (select id from public.errand_categories limit 1), (select id from public.service_areas where slug = 'jalingo'),
           'Test errand ' || i, 'Market', null, 2.6, 'completed', 100000
    returning id into e;
    insert into public.errand_assignments (errand_id, runner_id, fare_kobo, commission_kobo, ended_at, end_reason)
    values (e, r, 100000, 12000, now(), 'completed');
  end loop;

  perform wt.as_user(r);
  w := public.my_wallet();
  perform wt.back();
  perform wt.check((w->>'runner_jobs')::int = 2 and (w->>'runner_owed_kobo')::bigint = 24000 and (w->>'runner_kept_kobo')::bigint = 176000, 'runner sees 2 jobs and owes 24000');

  perform wt.as_user(c);
  w := public.my_wallet();
  perform wt.back();
  perform wt.check((w->>'customer_spent_kobo')::bigint = 200000 and (w->>'customer_orders')::int = 2, 'customer sees total spent');

  perform wt.check(wt.refused(r, format('select public.admin_record_settlement(%L, 1000)', r)), 'runner cannot record a settlement');
  perform wt.check(wt.refused(c, 'select * from public.admin_runner_balances()'), 'customer cannot list balances');
  perform wt.check(wt.refused(r, 'insert into public.commission_settlements (runner_id, amount_kobo, recorded_by) values (null, 1, null)'), 'runner cannot write the table');

  perform wt.as_user(ad);
  perform public.admin_record_settlement(r, 10000, 'cash handed over');
  perform wt.back();
  perform wt.check(wt.refused(ad, format('select public.admin_record_settlement(%L, 14001)', r)), 'cannot settle more than owed');
  perform wt.check(wt.refused(ad, format('select public.admin_record_settlement(%L, 0)', r)), 'cannot settle zero');

  perform wt.as_user(r);
  w := public.my_wallet();
  select count(*) into n from public.commission_settlements;
  perform wt.back();
  perform wt.check((w->>'runner_owed_kobo')::bigint = 14000 and n = 1, 'owed falls to 14000 and runner sees own settlement');

  perform wt.as_user(r2);
  select count(*) into n from public.commission_settlements;
  perform wt.back();
  perform wt.check(n = 0, 'another runner sees no settlements');

  perform wt.as_user(ad);
  select count(*) into n from public.admin_runner_balances() where runner_id = r and owed_kobo = 14000;
  perform wt.back();
  perform wt.check(n = 1, 'admin balances list shows 14000 owed');

  raise notice 'WALLET PASSED';
end $$;
rollback;
