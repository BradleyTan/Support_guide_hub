-- Checks search_guides (words, typos, meaning, filters) and that it respects RLS. Rolls back.
begin;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.invalid'),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@test.invalid');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.guides (title, product, module, error_message, symptom, tags, embedding) values
  ('Workstations can''t connect to SQL Server after a Windows update', 'AutoCount Accounting', 'Database', 'The server was not found or was not accessible', 'Cannot open account book', array['sql-server'], array_fill(0.05::real, array[384])::extensions.vector),
  ('PCB in a bonus month differs from the LHDN calculator', 'AutoCount Payroll', 'Payroll Processing', null, 'Payslip tax differs', array['pcb'], null);
do $$
declare c text; m text[]; n int;
begin
  select code, matched_by into c, m from public.search_guides('server not accessible') limit 1;
  if c is null or m is null or not ('words' = any(m)) then raise exception 'words match failed: % %', c, m; end if;
  select count(*) into n from public.search_guides('SQL Servre not acessible'); if n = 0 then raise exception 'typo match failed'; end if;
  select matched_by into m from public.search_guides('zzzz qqqq', array_fill(0.05::real, array[384])::extensions.vector) limit 1;
  if m is null or not ('meaning' = any(m)) then raise exception 'meaning match failed: %', m; end if;
  select count(*) into n from public.search_guides('server', null, 'AutoCount Payroll'); if n <> 0 then raise exception 'product filter failed'; end if;
  select count(*) into n from public.search_guides('bonus', null, null, null, null, 'pcb'); if n <> 1 then raise exception 'tag filter failed (%)', n; end if;
  select count(*) into n from public.search_guides(''); if n <> 0 then raise exception 'empty query returned rows'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.search_guides('server not accessible', array_fill(0.05::real, array[384])::extensions.vector);
  if n <> 0 then raise exception 'B can find A guides'; end if;
end $$;
reset role;
set local role anon;
do $$ begin perform public.search_guides('server'); raise exception 'anon can search'; exception when insufficient_privilege then null; end $$;
select 'search_guides: all checks passed' as result;
rollback;
