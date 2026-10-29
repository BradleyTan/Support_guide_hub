-- Checks knowledge_articles (migration 0011) under the team rules (0014): starter uniqueness, search, members share
-- and edit but can't delete, pending people see nothing. The team library holds real articles, so counts are scoped
-- to this test's rows. Rolls back; returns 'knowledge: all checks passed'.
begin;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.invalid'),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@test.invalid'),
  ('00000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-c@test.invalid');
delete from public.team_members where role = 'owner';
insert into public.team_members (user_id, email, role, status) values
  ('00000000-0000-4000-8000-00000000000a', 'rls-a@test.invalid', 'owner', 'approved'),
  ('00000000-0000-4000-8000-00000000000b', 'rls-b@test.invalid', 'member', 'approved'),
  ('00000000-0000-4000-8000-00000000000c', 'rls-c@test.invalid', 'member', 'pending');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.knowledge_articles (id, starter_slug, starter_version, title, category, tell_customer) values
  ('00000000-0000-4000-8000-0000000000b1', 'debtor-aging', 1, 'Debtor aging zqxj', 'Customers (AR)', 'It shows how much each customer owes you and for how long.'),
  ('00000000-0000-4000-8000-0000000000b2', null, null, 'My own note on petty cash zqxj', 'Bank & cash', 'Small cash spending kept in a box.');
do $$
declare n int;
begin
  select count(*) into n from public.knowledge_articles where user_id = '00000000-0000-4000-8000-00000000000a'; if n <> 2 then raise exception 'A should see 2 articles, got %', n; end if;
  -- One copy per starter article per person, even when the first copy is in the bin.
  update public.knowledge_articles set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000b1';
  begin
    insert into public.knowledge_articles (starter_slug, starter_version, title, category, tell_customer) values ('debtor-aging', 1, 'Again', 'Customers (AR)', 'x');
    raise exception 'duplicate starter slug accepted';
  exception when unique_violation then null;
  end;
  update public.knowledge_articles set deleted_at = null where id = '00000000-0000-4000-8000-0000000000b1';
  -- Search: words and similar spelling; deleted articles are left out.
  select count(*) into n from public.search_knowledge('aging zqxj') where id = '00000000-0000-4000-8000-0000000000b1'; if n <> 1 then raise exception 'search aging: expected our article'; end if;
  select count(*) into n from public.search_knowledge('debter agin zqxj', 50) where id = '00000000-0000-4000-8000-0000000000b1'; if n <> 1 then raise exception 'typo search missed our article'; end if;
  perform public.search_knowledge(''''); perform public.search_knowledge('%'); perform public.search_knowledge(''); perform public.search_knowledge('a');
  update public.knowledge_articles set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000b1';
  select count(*) into n from public.search_knowledge('aging zqxj', 50) where id = '00000000-0000-4000-8000-0000000000b1'; if n <> 0 then raise exception 'search found a binned article'; end if;
  update public.knowledge_articles set deleted_at = null where id = '00000000-0000-4000-8000-0000000000b1';
  -- Bad values are refused.
  begin
    insert into public.knowledge_articles (title, category, tell_customer) values ('x', 'Payroll', 'x');
    raise exception 'unknown category accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.knowledge_articles (starter_slug, title, category, tell_customer) values ('Not A Slug', 'x', 'Basics', 'x');
    raise exception 'bad slug accepted';
  exception when check_violation then null;
  end;
end $$;

-- Member B: sees, finds and edits A's articles, but can't delete them or write as A.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.knowledge_articles where user_id = '00000000-0000-4000-8000-00000000000a'; if n <> 2 then raise exception 'B should see A''s 2 articles, got %', n; end if;
  select count(*) into n from public.search_knowledge('petty cash zqxj', 50) where id = '00000000-0000-4000-8000-0000000000b2'; if n <> 1 then raise exception 'B does not find A''s article'; end if;
  update public.knowledge_articles set what_it_is = 'Edited by B' where id = '00000000-0000-4000-8000-0000000000b2';
  get diagnostics n = row_count; if n <> 1 then raise exception 'B cannot edit A''s article'; end if;
  delete from public.knowledge_articles where user_id = '00000000-0000-4000-8000-00000000000a';
  get diagnostics n = row_count; if n <> 0 then raise exception 'B deleted A''s articles'; end if;
  begin
    insert into public.knowledge_articles (user_id, title, category, tell_customer) values ('00000000-0000-4000-8000-00000000000a', 'Spoof', 'Basics', 'x');
    raise exception 'B wrote an article as A';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Pending C: nothing visible, nothing written.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.knowledge_articles; if n <> 0 then raise exception 'C sees articles'; end if;
  select count(*) into n from public.search_knowledge('petty cash'); if n <> 0 then raise exception 'C finds articles in search'; end if;
  update public.knowledge_articles set title = 'hacked'; get diagnostics n = row_count; if n <> 0 then raise exception 'C edited articles'; end if;
  begin
    insert into public.knowledge_articles (title, category, tell_customer) values ('C note', 'Basics', 'x');
    raise exception 'C wrote an article';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.knowledge_articles where user_id = '00000000-0000-4000-8000-00000000000a' and title in ('Debtor aging zqxj', 'My own note on petty cash zqxj');
  if n <> 2 then raise exception 'A''s articles were lost or renamed'; end if;
  select count(*) into n from public.knowledge_articles where id = '00000000-0000-4000-8000-0000000000b2' and what_it_is = 'Edited by B' and updated_by = '00000000-0000-4000-8000-00000000000b';
  if n <> 1 then raise exception 'A does not see B''s edit'; end if;
end $$;
reset role;
set local role anon;
do $$ begin perform public.search_knowledge('aging'); raise exception 'anon can search articles'; exception when insufficient_privilege then null; end $$;
do $$ declare n int; begin
  select count(*) into n from public.knowledge_articles; if n <> 0 then raise exception 'anon sees articles'; end if;
exception when insufficient_privilege then null;
end $$;
select 'knowledge: all checks passed' as result;
rollback;
