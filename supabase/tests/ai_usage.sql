-- Tests for the AI usage limit. One transaction, rolled back. Look for "AI USAGE PASSED".
begin;
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000f1', 'ai@t.local', '{"full_name":"AI Tester"}');
do $$
declare
  u uuid := '00000000-0000-0000-0000-0000000000f1';
  n int := 0;
  refused boolean := false;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  for i in 1..30 loop perform public.record_ai_parse(); n := n + 1; end loop;
  begin perform public.record_ai_parse(); exception when others then refused := true; end;
  if not refused then raise exception 'FAILED: the 31st read in an hour should be refused'; end if;
  raise notice 'pass: 30 reads allowed, the 31st is refused';
  refused := false;
  begin
    if (select count(*) from public.ai_parse_usage) > 0 then raise exception 'FAILED: users can read the usage table'; end if;
    refused := true;
  exception when insufficient_privilege then refused := true; end;
  if not refused then raise exception 'FAILED: users can read the usage table'; end if;
  raise notice 'pass: users cannot read the usage table';
  execute 'reset role';
  execute 'set local role anon';
  refused := false;
  begin perform public.record_ai_parse(); exception when others then refused := true; end;
  execute 'reset role';
  if not refused then raise exception 'FAILED: anon can call record_ai_parse'; end if;
  raise notice 'pass: anon cannot use the AI';
  raise notice 'AI USAGE PASSED';
end $$;
rollback;
