-- Checks the activity log and insight functions (migration 0006) count correctly and follow the team rules (0014):
-- the logs are team-wide for members, invisible to pending people, and only the owner clears them.
-- The team library holds real activity, so every count is scoped to this test's rows (queries start "tst0014").
-- Rolls back; returns 'insights: all checks passed'.
begin;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.invalid'),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@test.invalid');
delete from public.team_members where role = 'owner';
insert into public.team_members (user_id, email, role, status) values
  ('00000000-0000-4000-8000-00000000000a', 'rls-a@test.invalid', 'owner', 'approved'),
  ('00000000-0000-4000-8000-00000000000b', 'rls-b@test.invalid', 'member', 'pending');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select set_config('test.base_opens', (select coalesce(sum(opens), 0)::text from public.weekly_activity(12)), true);
insert into public.guides (title, product) values ('Payslip email not received tst0014', 'AutoCount Payroll');
select set_config('test.g', (select id::text from public.guides where title = 'Payslip email not received tst0014'), true);
do $$
declare n int; u int; t1 timestamptz; t2 timestamptz;
begin
  -- Opening a guide counts and is logged, but doesn't change "last updated".
  update public.guides set updated_at = now() - interval '5 days' where id = current_setting('test.g')::uuid; -- same as created
  select updated_at into t1 from public.guides where id = current_setting('test.g')::uuid;
  perform public.increment_guide_uses(current_setting('test.g')::uuid);
  perform public.increment_guide_uses(current_setting('test.g')::uuid);
  select uses, updated_at into u, t2 from public.guides where id = current_setting('test.g')::uuid;
  if u <> 2 then raise exception 'uses should be 2, got %', u; end if;
  if t2 <> t1 then raise exception 'opening a guide changed updated_at'; end if;
  select count(*) into n from public.guide_events where guide_id = current_setting('test.g')::uuid; if n <> 2 then raise exception 'expected 2 open events, got %', n; end if;
  select opens into n from public.top_guides(90, 1000) where guide_id = current_setting('test.g')::uuid; if n is distinct from 2 then raise exception 'top_guides opens should be 2, got %', n; end if;
  -- A real edit still changes it.
  update public.guides set symptom = 'Employees say the payslip email never arrives' where id = current_setting('test.g')::uuid;
  select updated_at into t2 from public.guides where id = current_setting('test.g')::uuid;
  if t2 = t1 then raise exception 'editing a guide did not change updated_at'; end if;

  -- Searches: repeats within 30 minutes count once; case and spaces are ignored.
  perform public.log_search('TST0014 EPF  rate table', 0);
  perform public.log_search('tst0014 epf rate table', 0);
  perform public.log_search('x', 0); -- too short, ignored
  select count(*) into n from public.search_log where user_id = '00000000-0000-4000-8000-00000000000a'; if n <> 1 then raise exception 'expected 1 logged search, got %', n; end if;
  -- An older search for the same words, and one that found guides.
  insert into public.search_log (query, guide_hits, created_at) values
    ('tst0014 EPF rate table', 0, now() - interval '3 days'),
    ('tst0014 payslip email', 2, now() - interval '2 days'),
    ('tst0014 payslip email', 1, now() - interval '1 day'),
    ('tst0014 old topic', 0, now() - interval '100 days'),
    ('tst0014 old topic', 0, now() - interval '95 days');
  select count(*) into n from public.search_gaps(90, 2, 1000) where query like 'TST0014%' or query like 'tst0014%'; if n <> 1 then raise exception 'expected 1 gap, got %', n; end if;
  select times into n from public.search_gaps(90, 2, 1000) where query = 'TST0014 EPF  rate table'; if n is distinct from 2 then raise exception 'gap should count 2 searches, got %', n; end if;
  -- Once the latest search finds a guide, it is no longer a gap.
  insert into public.search_log (query, guide_hits) values ('tst0014 epf rate table', 1);
  select count(*) into n from public.search_gaps(90, 2, 1000) where query like 'TST0014%' or query like 'tst0014%'; if n <> 0 then raise exception 'gap should clear after a matching search'; end if;

  select sum(opens) into u from public.weekly_activity(12);
  if u <> current_setting('test.base_opens')::int + 2 then raise exception 'weekly opens should grow by 2, got % from %', u, current_setting('test.base_opens'); end if;
  select count(*) into n from public.weekly_activity(12); if n <> 12 then raise exception 'expected 12 weeks, got %', n; end if;
end $$;

-- Pending B sees none of the team's activity and can't log anything.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.guide_events; if n <> 0 then raise exception 'B sees open events'; end if;
  select count(*) into n from public.search_log; if n <> 0 then raise exception 'B sees searches'; end if;
  select count(*) into n from public.search_gaps(90, 1, 20); if n <> 0 then raise exception 'B sees gaps'; end if;
  select count(*) into n from public.top_guides(90, 10); if n <> 0 then raise exception 'B sees top guides'; end if;
  select coalesce(sum(opens + searches), 0) into n from public.weekly_activity(12); if n <> 0 then raise exception 'B sees weekly activity'; end if;
  perform public.increment_guide_uses(current_setting('test.g')::uuid);
  begin
    insert into public.guide_events (guide_id) values (current_setting('test.g')::uuid);
    raise exception 'B logged an open on A guide';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.search_log (user_id, query, guide_hits) values ('00000000-0000-4000-8000-00000000000a', 'spoof', 0);
    raise exception 'B wrote a search into A log';
  exception when insufficient_privilege then null;
  end;
  delete from public.search_log; get diagnostics n = row_count; if n <> 0 then raise exception 'B deleted searches'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.guide_events where guide_id = current_setting('test.g')::uuid; if n <> 2 then raise exception 'B changed open events: %', n; end if;
  select count(*) into n from public.search_log where user_id = '00000000-0000-4000-8000-00000000000a'; if n <> 7 then raise exception 'B changed searches: %', n; end if;
  -- "Clear search history" is the owner's: it clears the team's log.
  delete from public.search_log where id > 0;
  select count(*) into n from public.search_log; if n <> 0 then raise exception 'clear history left % rows', n; end if;
end $$;
reset role;
set local role anon;
do $$ begin perform public.log_search('anon search', 0); raise exception 'anon can log searches'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.search_gaps(); raise exception 'anon can read gaps'; exception when insufficient_privilege then null; end $$;
reset role;
do $$ begin if not exists (select 1 from cron.job where jobname = 'activity-log-cleanup') then raise exception 'cleanup job missing'; end if; end $$;
select 'insights: all checks passed' as result;
rollback;
