-- Row Level Security test (team sharing, migration 0014): A is the owner, B an approved member, C still pending.
-- B shares A's work but can't delete it or act as A; C and signed-out visitors see and change nothing.
-- Runs inside a transaction and rolls back, so it leaves nothing behind (the real owner row is set aside meanwhile).
-- Any failed check raises an exception; success returns 'RLS: all checks passed'.
begin;

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.invalid'),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@test.invalid'),
  ('00000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-c@test.invalid');
delete from public.team_members where role = 'owner';
insert into public.team_members (user_id, email, role, status) values
  ('00000000-0000-4000-8000-00000000000a', 'rls-a@test.invalid', 'owner', 'approved'),
  ('00000000-0000-4000-8000-00000000000b', 'rls-b@test.invalid', 'member', 'approved'),
  ('00000000-0000-4000-8000-00000000000c', 'rls-c@test.invalid', 'member', 'pending');

set local role authenticated;

-- As user A: create a guide, a revision, an analysis and a file.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.guides (id, title, product, error_message) values ('00000000-0000-4000-8000-0000000000a1', 'A team guide', 'AutoCount Accounting', 'secret error');
select set_config('test.a_guide', '00000000-0000-4000-8000-0000000000a1', true);
insert into public.guide_revisions (guide_id, summary) values (current_setting('test.a_guide')::uuid, 'created');
insert into public.analyses (id, title, scenario, result, confidence, model) values ('00000000-0000-4000-8000-0000000000c1', 'A analysis', 'x', '{}', 'High', 'test');
select set_config('test.a_analysis', '00000000-0000-4000-8000-0000000000c1', true);
insert into storage.objects (bucket_id, name) values ('attachments', '00000000-0000-4000-8000-00000000000a/shot.png');

do $$
declare n int;
begin
  select count(*) into n from public.guides where id = current_setting('test.a_guide')::uuid;
  if n <> 1 then raise exception 'A cannot see own guide (count %)', n; end if;
end $$;

-- As member B: A's work is shared, but B can't delete it, write as A, or upload into A's folder.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from public.guides where id = current_setting('test.a_guide')::uuid;          if n <> 1 then raise exception 'B cannot read A guide'; end if;
  select count(*) into n from public.guide_revisions where guide_id = current_setting('test.a_guide')::uuid; if n <> 1 then raise exception 'B cannot read A revisions'; end if;
  select count(*) into n from public.analyses where id = current_setting('test.a_analysis')::uuid;     if n <> 1 then raise exception 'B cannot read A analyses'; end if;
  select count(*) into n from storage.objects where bucket_id = 'attachments' and name = '00000000-0000-4000-8000-00000000000a/shot.png';
                                                                                                      if n <> 1 then raise exception 'B cannot see A files'; end if;

  update public.guides set title = 'Edited by B' where id = current_setting('test.a_guide')::uuid;
  get diagnostics n = row_count; if n <> 1 then raise exception 'B cannot edit A guide'; end if;
  delete from public.guides where id = current_setting('test.a_guide')::uuid;
  get diagnostics n = row_count; if n <> 0 then raise exception 'B can delete A guides'; end if;
  delete from public.analyses where id = current_setting('test.a_analysis')::uuid;
  get diagnostics n = row_count; if n <> 0 then raise exception 'B can delete A analyses'; end if;

  insert into public.guide_revisions (guide_id, summary) values (current_setting('test.a_guide')::uuid, 'Edited by B');
  insert into public.analysis_messages (analysis_id, role, text) values (current_setting('test.a_analysis')::uuid, 'user', 'follow-up from B');

  begin
    insert into public.guides (user_id, title, product) values ('00000000-0000-4000-8000-00000000000a', 'spoof', 'AutoCount POS');
    raise exception 'B can insert a guide as A';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects (bucket_id, name) values ('attachments', '00000000-0000-4000-8000-00000000000a/evil.png');
    raise exception 'B can upload into A folder';
  exception when insufficient_privilege then null;
  end;
end $$;

-- As pending C: nothing of the team's is visible or changeable.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from public.guides;               if n <> 0 then raise exception 'C can read guides'; end if;
  select count(*) into n from public.guide_revisions;      if n <> 0 then raise exception 'C can read revisions'; end if;
  select count(*) into n from public.analyses;             if n <> 0 then raise exception 'C can read analyses'; end if;
  select count(*) into n from storage.objects where bucket_id = 'attachments';
                                                           if n <> 0 then raise exception 'C can list files'; end if;

  update public.guides set title = 'hacked';               get diagnostics n = row_count; if n <> 0 then raise exception 'C can update guides'; end if;
  delete from public.guides;                               get diagnostics n = row_count; if n <> 0 then raise exception 'C can delete guides'; end if;

  begin
    insert into public.guides (title, product) values ('C guide', 'AutoCount POS');
    raise exception 'C can insert a guide';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.guide_revisions (guide_id, summary) values (current_setting('test.a_guide')::uuid, 'spoof');
    raise exception 'C can attach a revision to A guide';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.analysis_messages (analysis_id, role, text) values (current_setting('test.a_analysis')::uuid, 'user', 'spoof');
    raise exception 'C can post into A analysis';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects (bucket_id, name) values ('attachments', '00000000-0000-4000-8000-00000000000c/evil.png');
    raise exception 'C can upload a file';
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

-- A sees B's edit and B's additions; C's attempts changed nothing.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
declare t text; n int;
begin
  select title into t from public.guides where id = current_setting('test.a_guide')::uuid;
  if t <> 'Edited by B' then raise exception 'A guide should show B''s edit, got %', t; end if;
  select count(*) into n from public.guide_revisions where guide_id = current_setting('test.a_guide')::uuid; if n <> 2 then raise exception 'expected 2 revisions, got %', n; end if;
  select count(*) into n from public.analysis_messages where analysis_id = current_setting('test.a_analysis')::uuid; if n <> 1 then raise exception 'expected B''s message, got %', n; end if;
end $$;

select 'RLS: all checks passed' as result;
rollback;
