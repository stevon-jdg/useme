-- Tests that price changes are audited. One transaction, rolled back. Look for "PRICING AUDIT PASSED".
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'pa@t.local', '{"full_name":"Price Admin"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'pc@t.local', '{"full_name":"Price Cust"}');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000a1', 'admin');
do $$
declare
  ad uuid := '00000000-0000-0000-0000-0000000000a1';
  cu uuid := '00000000-0000-0000-0000-0000000000a2';
  n int; refused boolean := false; d jsonb;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ad, 'role', 'authenticated')::text, true);
  update public.pricing_settings set platform_fee_percent = 15 where id;
  update public.pricing_category_fees set task_fee_kobo = 25000 where category_id = 'pickup_delivery';
  select count(*) into n from public.audit_logs where action = 'pricing_update';
  if n <> 2 then raise exception 'FAILED: expected 2 audit rows, got %', n; end if;
  select details into d from public.audit_logs where target_id = 'pickup_delivery';
  if (d->'old'->>'task_fee_kobo')::bigint <> 20000 or (d->'new'->>'task_fee_kobo')::bigint <> 25000 then raise exception 'FAILED: old and new values wrong: %', d; end if;
  raise notice 'pass: admin price changes are logged with old and new values';

  update public.pricing_settings set platform_fee_percent = 15 where id;
  select count(*) into n from public.audit_logs where action = 'pricing_update';
  if n <> 2 then raise exception 'FAILED: a no-op change was logged'; end if;
  raise notice 'pass: unchanged saves are not logged';

  perform set_config('request.jwt.claims', json_build_object('sub', cu, 'role', 'authenticated')::text, true);
  update public.pricing_settings set platform_fee_percent = 1 where id;
  execute 'reset role';
  if (select platform_fee_percent from public.pricing_settings where id) <> 15 then raise exception 'FAILED: customer changed pricing'; end if;
  raise notice 'pass: customers cannot change pricing';
  raise notice 'PRICING AUDIT PASSED';
end $$;
rollback;
