-- Checks knowledge_articles (migration 0011): RLS, starter uniqueness and search. Rolls back; returns 'knowledge: all checks passed'.
begin;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.invalid'),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@test.invalid');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.knowledge_articles (starter_slug, starter_version, title, category, tell_customer) values
  ('debtor-aging', 1, 'Debtor aging', 'Customers (AR)', 'It shows how much each customer owes you and for how long.'),
  (null, null, 'My own note on petty cash', 'Bank & cash', 'Small cash spending kept in a box.');
do $$
declare n int; t timestamptz;
begin
  select count(*) into n from public.knowledge_articles; if n <> 2 then raise exception 'A should see 2 articles, got %', n; end if;
  -- One copy per starter article, even when the first copy is in the bin.
  update public.knowledge_articles set deleted_at = now() where starter_slug = 'debtor-aging';
  begin
    insert into public.knowledge_articles (starter_slug, starter_version, title, category, tell_customer) values ('debtor-aging', 1, 'Again', 'Customers (AR)', 'x');
    raise exception 'duplicate starter slug accepted';
  exception when unique_violation then null;
  end;
  update public.knowledge_articles set deleted_at = null where starter_slug = 'debtor-aging';
  -- Search: words and similar spelling; deleted articles are left out.
  select count(*) into n from public.search_knowledge('aging'); if n <> 1 then raise exception 'search aging: expected 1, got %', n; end if;
  select count(*) into n from public.search_knowledge('debter agin'); if n < 1 then raise exception 'typo search found nothing'; end if;
  perform public.search_knowledge(''''); perform public.search_knowledge('%'); perform public.search_knowledge(''); perform public.search_knowledge('a');
  update public.knowledge_articles set deleted_at = now() where starter_slug = 'debtor-aging';
  select count(*) into n from public.search_knowledge('aging'); if n <> 0 then raise exception 'search found a binned article'; end if;
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

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.knowledge_articles; if n <> 0 then raise exception 'B sees A articles'; end if;
  select count(*) into n from public.search_knowledge('petty cash'); if n <> 0 then raise exception 'B finds A articles in search'; end if;
  update public.knowledge_articles set title = 'hacked';
  delete from public.knowledge_articles;
  begin
    insert into public.knowledge_articles (user_id, title, category, tell_customer) values ('00000000-0000-4000-8000-00000000000a', 'Spoof', 'Basics', 'x');
    raise exception 'B wrote an article as A';
  exception when insufficient_privilege then null;
  end;
  -- B can have its own copy of the same starter article.
  insert into public.knowledge_articles (starter_slug, starter_version, title, category, tell_customer) values ('debtor-aging', 1, 'Debtor aging', 'Customers (AR)', 'x');
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.knowledge_articles where title in ('Debtor aging', 'My own note on petty cash'); if n <> 2 then raise exception 'B changed A articles'; end if;
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
