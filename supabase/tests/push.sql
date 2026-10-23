-- Tests for push subscriptions. One transaction, rolled back. Look for "PUSH PASSED".
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'p1@t.local', '{"full_name":"P One"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'p2@t.local', '{"full_name":"P Two"}');
do $$
declare
  a uuid := '00000000-0000-0000-0000-0000000000b1';
  b uuid := '00000000-0000-0000-0000-0000000000b2';
  n int; refused boolean := false;
  ep text := 'https://push.example.com/send/abcdefghijklmnopqrstuvwxyz';
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.save_push_subscription(ep, repeat('k', 40), repeat('a', 20));
  select count(*) into n from public.push_subscriptions;
  if n <> 1 then raise exception 'FAILED: owner should see 1 row, saw %', n; end if;
  raise notice 'pass: owner saves and sees own subscription';

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.push_subscriptions;
  if n <> 0 then raise exception 'FAILED: another user can see subscriptions'; end if;
  perform public.delete_push_subscription(ep);
  execute 'reset role';
  select count(*) into n from public.push_subscriptions;
  if n <> 1 then raise exception 'FAILED: another user deleted a subscription'; end if;
  raise notice 'pass: other users cannot see or delete it';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (a, ep || 'x', repeat('k', 40), repeat('a', 20));
  exception when others then refused := true; end;
  if not refused then raise exception 'FAILED: direct insert allowed'; end if;
  raise notice 'pass: direct writes are refused';
  perform public.delete_push_subscription(ep);
  execute 'reset role';
  select count(*) into n from public.push_subscriptions;
  if n <> 0 then raise exception 'FAILED: owner could not delete'; end if;
  raise notice 'pass: owner deletes own subscription';

  execute 'set local role anon';
  refused := false;
  begin perform public.save_push_subscription(ep, repeat('k', 40), repeat('a', 20)); exception when others then refused := true; end;
  execute 'reset role';
  if not refused then raise exception 'FAILED: anon can subscribe'; end if;
  raise notice 'pass: anon cannot subscribe';
  raise notice 'PUSH PASSED';
end $$;
rollback;
