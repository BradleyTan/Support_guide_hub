-- Checks similar_guides and increment_guide_uses follow the team rules (migration 0014): members share guides,
-- pending people see and change nothing. Rolls back; returns 'functions: all checks passed'.
begin;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.invalid'),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@test.invalid'),
  ('00000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-c@test.invalid');
insert into public.team_members (user_id, email, role, status) values
  ('00000000-0000-4000-8000-00000000000a', 'rls-a@test.invalid', 'member', 'approved'),
  ('00000000-0000-4000-8000-00000000000b', 'rls-b@test.invalid', 'member', 'approved'),
  ('00000000-0000-4000-8000-00000000000c', 'rls-c@test.invalid', 'member', 'pending');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.guides (id, title, product, error_message) values
  ('00000000-0000-4000-8000-0000000000a1', 'Workstations can''t connect to SQL Server after a Windows update', 'AutoCount Accounting', 'The server was not found or was not accessible'),
  ('00000000-0000-4000-8000-0000000000a2', 'Invoice prints blank after moving to a new PC', 'AutoCount Account Book', null);
select set_config('test.g', '00000000-0000-4000-8000-0000000000a2', true);
do $$
declare n int; u int;
begin
  -- The team library may hold similar guides, so check ours is among the matches.
  select count(*) into n from public.similar_guides('SQL Server connection after Windows update', '', 20) where id = '00000000-0000-4000-8000-0000000000a1';
  if n <> 1 then raise exception 'A: SQL guide not among the matches'; end if;
  select count(*) into n from public.similar_guides('abc', ''); if n <> 0 then raise exception 'short titles should not match'; end if;
  perform public.increment_guide_uses(current_setting('test.g')::uuid);
  select uses into u from public.guides where id = current_setting('test.g')::uuid; if u <> 1 then raise exception 'uses not incremented: %', u; end if;
end $$;
-- Member B finds A's guide and its opens count too.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.similar_guides('SQL Server connection after Windows update', '', 20) where id = '00000000-0000-4000-8000-0000000000a1';
  if n <> 1 then raise exception 'B does not find A''s guide via similar_guides'; end if;
  perform public.increment_guide_uses(current_setting('test.g')::uuid);
end $$;
-- Pending C finds nothing and can't move the counter.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.similar_guides('SQL Server connection after Windows update', ''); if n <> 0 then raise exception 'C sees guides via similar_guides'; end if;
  perform public.increment_guide_uses(current_setting('test.g')::uuid);
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
declare u int;
begin
  select uses into u from public.guides where id = current_setting('test.g')::uuid; if u <> 2 then raise exception 'expected 2 uses (A and B), got %', u; end if;
end $$;
reset role;
set local role anon;
do $$ begin perform public.similar_guides('SQL Server', ''); raise exception 'anon can call similar_guides'; exception when insufficient_privilege then null; end $$;
select 'functions: all checks passed' as result;
rollback;
