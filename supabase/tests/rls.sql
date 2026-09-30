-- Row Level Security test: user B must never see or change user A's data.
-- Runs inside a transaction and rolls back, so it leaves nothing behind.
-- Any failed check raises an exception; success returns 'RLS: all checks passed'.
begin;

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.invalid'),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@test.invalid');

set local role authenticated;

-- As user A: create a guide, a revision, an analysis and a file.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.guides (title, product, error_message) values ('A private guide', 'AutoCount Accounting', 'secret error');
select set_config('test.a_guide', (select id::text from public.guides limit 1), true);
insert into public.guide_revisions (guide_id, summary) values (current_setting('test.a_guide')::uuid, 'created');
insert into public.analyses (title, scenario, result, confidence, model) values ('A analysis', 'x', '{}', 'High', 'test');
select set_config('test.a_analysis', (select id::text from public.analyses limit 1), true);
insert into storage.objects (bucket_id, name) values ('attachments', '00000000-0000-4000-8000-00000000000a/shot.png');

do $$
declare n int;
begin
  select count(*) into n from public.guides;
  if n <> 1 then raise exception 'A cannot see own guide (count %)', n; end if;
end $$;

-- As user B: nothing of A's is visible or changeable.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from public.guides;               if n <> 0 then raise exception 'B can read A guides'; end if;
  select count(*) into n from public.guide_revisions;      if n <> 0 then raise exception 'B can read A revisions'; end if;
  select count(*) into n from public.analyses;             if n <> 0 then raise exception 'B can read A analyses'; end if;
  select count(*) into n from storage.objects where bucket_id = 'attachments';
                                                           if n <> 0 then raise exception 'B can list A files'; end if;

  update public.guides set title = 'hacked';               get diagnostics n = row_count; if n <> 0 then raise exception 'B can update A guides'; end if;
  delete from public.guides;                               get diagnostics n = row_count; if n <> 0 then raise exception 'B can delete A guides'; end if;
  delete from public.analyses;                             get diagnostics n = row_count; if n <> 0 then raise exception 'B can delete A analyses'; end if;

  begin
    insert into public.guides (user_id, title, product) values ('00000000-0000-4000-8000-00000000000a', 'spoof', 'AutoCount POS');
    raise exception 'B can insert a guide as A';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.guide_revisions (guide_id, summary) values (current_setting('test.a_guide')::uuid, 'spoof');
    raise exception 'B can attach a revision to A guide';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.analysis_messages (analysis_id, role, text) values (current_setting('test.a_analysis')::uuid, 'user', 'spoof');
    raise exception 'B can post into A analysis';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects (bucket_id, name) values ('attachments', '00000000-0000-4000-8000-00000000000a/evil.png');
    raise exception 'B can upload into A folder';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Not signed in: nothing visible.
reset role;
set local role anon;
do $$
declare n int;
begin
  select count(*) into n from public.guides; if n <> 0 then raise exception 'anonymous visitor can read guides'; end if;
end $$;

-- A's data is untouched after B's attempts.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
declare t text;
begin
  select title into t from public.guides;
  if t <> 'A private guide' then raise exception 'A guide was changed: %', t; end if;
end $$;

select 'RLS: all checks passed' as result;
rollback;
