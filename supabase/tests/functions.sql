-- Checks similar_guides and increment_guide_uses respect RLS. Rolls back; returns 'functions: all checks passed'.
begin;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.invalid'),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@test.invalid');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.guides (title, product, error_message) values
  ('Workstations can''t connect to SQL Server after a Windows update', 'AutoCount Accounting', 'The server was not found or was not accessible'),
  ('Invoice prints blank after moving to a new PC', 'AutoCount Account Book', null);
select set_config('test.g', (select id::text from public.guides where title like 'Invoice%'), true);
do $$
declare n int; top text; u int;
begin
  select title into top from public.similar_guides('SQL Server connection after Windows update', '') limit 1;
  if top is null or top not like 'Workstations%' then raise exception 'A: expected SQL guide as top match, got %', top; end if;
  select count(*) into n from public.similar_guides('abc', ''); if n <> 0 then raise exception 'short titles should not match'; end if;
  perform public.increment_guide_uses(current_setting('test.g')::uuid);
  select uses into u from public.guides where id = current_setting('test.g')::uuid; if u <> 1 then raise exception 'uses not incremented: %', u; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.similar_guides('SQL Server connection after Windows update', ''); if n <> 0 then raise exception 'B sees A guides via similar_guides'; end if;
  perform public.increment_guide_uses(current_setting('test.g')::uuid);
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
declare u int;
begin
  select uses into u from public.guides where id = current_setting('test.g')::uuid; if u <> 1 then raise exception 'B changed A uses counter: %', u; end if;
end $$;
reset role;
set local role anon;
do $$ begin perform public.similar_guides('SQL Server', ''); raise exception 'anon can call similar_guides'; exception when insufficient_privilege then null; end $$;
select 'functions: all checks passed' as result;
rollback;
