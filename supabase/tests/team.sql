-- Checks migration 0014: team membership, shared data rules, owner-only powers, private chats, sign-up and e2e clean-up.
-- Rolls back; returns 'team: all checks passed'.
-- People: O owner, M member, P pending, R removed, T test member, X throwaway member (deleted), S / U sign-ups.
-- The real owner row is set aside inside the transaction so O can be the one owner.
begin;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-o@test.invalid'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-m@test.invalid'),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-p@test.invalid'),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-r@test.invalid'),
  ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-t@test.invalid'),
  ('00000000-0000-4000-8000-0000000000e7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-x@test.invalid');
do $$
begin
  if exists (select 1 from public.team_members where user_id::text like '00000000-0000-4000-8000-0000000000e%') then
    raise exception 'unconfirmed sign-ups must not get a team row yet';
  end if;
end $$;
delete from public.team_members where role = 'owner';
insert into public.team_members (user_id, email, display_name, role, status, is_test) values
  ('00000000-0000-4000-8000-0000000000e1', 'team-o@test.invalid', 'Olivia Owner', 'owner', 'approved', false),
  ('00000000-0000-4000-8000-0000000000e2', 'team-m@test.invalid', 'Max Member', 'member', 'approved', false),
  ('00000000-0000-4000-8000-0000000000e3', 'team-p@test.invalid', 'Pat Pending', 'member', 'pending', false),
  ('00000000-0000-4000-8000-0000000000e4', 'team-r@test.invalid', 'Rae Removed', 'member', 'removed', false),
  ('00000000-0000-4000-8000-0000000000e5', 'team-t@test.invalid', 'Test Bot', 'member', 'approved', true),
  ('00000000-0000-4000-8000-0000000000e7', 'team-x@test.invalid', 'Xander Leaving', 'member', 'approved', false);
select set_config('storage.allow_delete_query', 'true', true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- The owner creates one of everything.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
insert into public.guides (id, title, product, steps) values ('00000000-0000-4000-8000-0000000000a1', 'Team guide zqxj', 'AutoCount Accounting', '{"Open A/R"}');
insert into public.guide_revisions (guide_id, summary) values ('00000000-0000-4000-8000-0000000000a1', 'created');
insert into public.guide_attachments (guide_id, storage_path, name, kind, size_bytes) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000e1/a1/shot.png', 'shot.png', 'image', 10);
insert into public.pins (guide_id, title, url, site) values ('00000000-0000-4000-8000-0000000000a1', 'Help', 'https://wiki.autocountsoft.com/x', 'wiki');
insert into public.knowledge_articles (id, title, category, tell_customer, desktop_steps) values
  ('00000000-0000-4000-8000-0000000000b1', 'Team article zqxj', 'Basics', 'Plain words.', 'File > Open');
insert into public.analyses (id, title, scenario, result, confidence, model) values ('00000000-0000-4000-8000-0000000000c1', 'Team analysis', 'x', '{}', 'High', 'test');
insert into public.analysis_messages (analysis_id, role, text) values ('00000000-0000-4000-8000-0000000000c1', 'user', 'hi');
insert into public.sops (id, title) values ('00000000-0000-4000-8000-0000000000d1', 'Team SOP');
insert into public.templates (id, kind, title, body) values ('00000000-0000-4000-8000-0000000000f1', 'Reply', 'Team template', 'Hello');
insert into public.web_cache (query_hash, query, results) values ('h-team', 'q', '[]');
insert into public.user_settings (chat_model, chat_web_search) values ('team/model-zqxj', true);
insert into public.accountant_chats (id, title) values ('00000000-0000-4000-8000-0000000000c7', 'Owner chat');
insert into public.accountant_messages (chat_id, role, content) values ('00000000-0000-4000-8000-0000000000c7', 'assistant', 'answer');
insert into storage.objects (bucket_id, name) values ('attachments', '00000000-0000-4000-8000-0000000000e1/a1/shot.png');
select public.increment_guide_uses('00000000-0000-4000-8000-0000000000a1');
select public.log_search('team search zqxj', 0);

-- ---------------------------------------------------------------------------
-- outsiders see and change nothing (pending P and removed R)
-- ---------------------------------------------------------------------------
select set_config('test.outsiders', '00000000-0000-4000-8000-0000000000e3,00000000-0000-4000-8000-0000000000e4', true);
do $$
declare
  who text; t text; n int;
begin
  foreach who in array string_to_array(current_setting('test.outsiders'), ',')
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
    foreach t in array array[
      'guides', 'guide_attachments', 'guide_revisions', 'pins', 'knowledge_articles', 'analyses', 'analysis_messages',
      'sops', 'templates', 'guide_events', 'search_log', 'accountant_chats', 'accountant_messages',
      'official_pages', 'web_cache', 'user_settings']
    loop
      execute format('select count(*) from public.%I', t) into n;
      if n <> 0 then raise exception 'outsider % sees % rows of %', who, n, t; end if;
    end loop;
    select count(*) into n from storage.objects where bucket_id = 'attachments'; if n <> 0 then raise exception 'outsider sees files'; end if;
    select count(*) into n from public.search_guides('Team guide zqxj'); if n <> 0 then raise exception 'outsider finds guides'; end if;
    select count(*) into n from public.search_knowledge('Team article zqxj'); if n <> 0 then raise exception 'outsider finds articles'; end if;
    select count(*) into n from public.search_official_pages('invoice'); if n <> 0 then raise exception 'outsider searches official pages'; end if;
    select count(*) into n from public.team_members; if n <> 1 then raise exception 'outsider should see only their own team row, got %', n; end if;
    if public.is_member() or public.is_owner() then raise exception 'outsider counts as a member'; end if;
    if public.owner_name() <> 'Olivia Owner' then raise exception 'owner_name for the Waiting page: %', public.owner_name(); end if;

    update public.guides set title = 'hacked'; get diagnostics n = row_count; if n <> 0 then raise exception 'outsider updated guides'; end if;
    update public.accountant_chats set title = 'hacked'; get diagnostics n = row_count; if n <> 0 then raise exception 'outsider updated chats'; end if;
    update public.team_members set status = 'approved'; get diagnostics n = row_count; if n <> 0 then raise exception 'outsider approved themselves'; end if;
    delete from public.guides; get diagnostics n = row_count; if n <> 0 then raise exception 'outsider deleted guides'; end if;
    begin insert into public.guides (title, product) values ('spoof', 'AutoCount POS'); raise exception 'outsider inserted a guide';
    exception when insufficient_privilege then null; end;
    begin insert into public.knowledge_articles (title, category, tell_customer) values ('spoof', 'Basics', 'x'); raise exception 'outsider inserted an article';
    exception when insufficient_privilege then null; end;
    begin insert into public.accountant_chats (title) values ('spoof'); raise exception 'outsider started a chat';
    exception when insufficient_privilege then null; end;
    begin perform public.log_search('outsider search', 0); raise exception 'outsider logged a search';
    exception when insufficient_privilege then null; end;
    begin insert into storage.objects (bucket_id, name) values ('attachments', who || '/x/evil.png'); raise exception 'outsider uploaded a file';
    exception when insufficient_privilege then null; end;
    begin perform public.team_settings(); raise exception 'outsider read team settings';
    exception when insufficient_privilege then null; end;
    begin perform public.team_answers_today(); raise exception 'outsider read the answer count';
    exception when insufficient_privilege then null; end;
    begin perform public.e2e_cleanup(); raise exception 'outsider ran e2e clean-up';
    exception when insufficient_privilege then null; end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- members share
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
do $$
declare n int; t text; editor uuid;
begin
  if not public.is_member() or public.is_owner() then raise exception 'M should be a member, not owner'; end if;
  foreach t in array array[
    'guides', 'guide_attachments', 'guide_revisions', 'pins', 'knowledge_articles', 'analyses', 'analysis_messages',
    'sops', 'templates', 'guide_events', 'search_log', 'web_cache', 'user_settings']
  loop
    execute format('select count(*) from public.%I where user_id = %L', t, '00000000-0000-4000-8000-0000000000e1') into n;
    if n < 1 then raise exception 'member cannot see the owner''s %', t; end if;
  end loop;
  select count(*) into n from storage.objects where name = '00000000-0000-4000-8000-0000000000e1/a1/shot.png'; if n <> 1 then raise exception 'member cannot see the owner''s file'; end if;
  select count(*) into n from public.search_guides('Team guide zqxj'); if n < 1 then raise exception 'member search misses the owner''s guide'; end if;
  select count(*) into n from public.search_knowledge('Team article zqxj'); if n < 1 then raise exception 'member search misses the owner''s article'; end if;
  select count(*) into n from public.top_guides(90, 1000) where guide_id = '00000000-0000-4000-8000-0000000000a1'; if n <> 1 then raise exception 'top_guides is not team-wide'; end if;
  select count(*) into n from public.search_gaps(90, 1, 1000) where query = 'team search zqxj'; if n <> 1 then raise exception 'search_gaps is not team-wide'; end if;
  select chat_model into t from public.team_settings(); if t <> 'team/model-zqxj' then raise exception 'team_settings should give the owner''s row, got %', t; end if;
  if public.team_answers_today() < 1 then raise exception 'team_answers_today missed the owner''s answer'; end if;

  update public.guides set symptom = 'Edited by the member' where id = '00000000-0000-4000-8000-0000000000a1';
  get diagnostics n = row_count; if n <> 1 then raise exception 'member cannot edit the owner''s guide'; end if;
  select updated_by into editor from public.guides where id = '00000000-0000-4000-8000-0000000000a1';
  if editor is distinct from '00000000-0000-4000-8000-0000000000e2' then raise exception 'updated_by should be the member, got %', editor; end if;
  update public.templates set body = 'Hi' where id = '00000000-0000-4000-8000-0000000000f1'; get diagnostics n = row_count; if n <> 1 then raise exception 'member cannot edit a template'; end if;
  update public.sops set purpose = 'p' where id = '00000000-0000-4000-8000-0000000000d1'; get diagnostics n = row_count; if n <> 1 then raise exception 'member cannot edit an SOP'; end if;

  insert into public.guides (id, title, product, verified) values ('00000000-0000-4000-8000-0000000000a2', 'Member guide zqxj', 'AutoCount Payroll', true);
  insert into public.guide_revisions (guide_id, summary) values ('00000000-0000-4000-8000-0000000000a1', 'Edited by the member');
  insert into public.pins (guide_id, title, url, site) values ('00000000-0000-4000-8000-0000000000a1', 'More help', 'https://wiki.autocountsoft.com/y', 'wiki');
  insert into public.analysis_messages (analysis_id, role, text) values ('00000000-0000-4000-8000-0000000000c1', 'user', 'member follow-up');
  insert into storage.objects (bucket_id, name) values ('attachments', '00000000-0000-4000-8000-0000000000e2/a2/mine.png');
  perform public.increment_guide_uses('00000000-0000-4000-8000-0000000000a1');
  select count(*) into n from public.guides where id = '00000000-0000-4000-8000-0000000000a2' and not verified;
  if n <> 1 then raise exception 'a member''s new guide must start unverified'; end if;

  begin insert into public.guides (user_id, title, product) values ('00000000-0000-4000-8000-0000000000e1', 'spoof', 'AutoCount POS'); raise exception 'member inserted a guide as the owner';
  exception when insufficient_privilege then null; end;
  begin update public.guides set user_id = '00000000-0000-4000-8000-0000000000e2' where id = '00000000-0000-4000-8000-0000000000a1'; raise exception 'member took over the owner''s guide';
  exception when insufficient_privilege then null; end;
  begin insert into storage.objects (bucket_id, name) values ('attachments', '00000000-0000-4000-8000-0000000000e1/a1/evil.png'); raise exception 'member uploaded into the owner''s folder';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.guides where id = '00000000-0000-4000-8000-0000000000a2' and user_id = '00000000-0000-4000-8000-0000000000e2';
  if n <> 1 then raise exception 'owner cannot see the member''s guide'; end if;
  select count(*) into n from public.guides where id = '00000000-0000-4000-8000-0000000000a1' and symptom = 'Edited by the member' and uses = 2;
  if n <> 1 then raise exception 'owner does not see the member''s edit and open'; end if;
  select count(*) into n from storage.objects where name = '00000000-0000-4000-8000-0000000000e2/a2/mine.png'; if n <> 1 then raise exception 'owner cannot see the member''s file'; end if;
  select count(*) into n from public.team_members; if n < 6 then raise exception 'owner should see every team row, got %', n; end if;
end $$;

-- ---------------------------------------------------------------------------
-- member cannot use owner powers
-- ---------------------------------------------------------------------------
-- The owner bins the SOP so "restore" can be tried.
update public.sops set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000d1';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
do $$
declare n int;
begin
  begin update public.guides set verified = true where id = '00000000-0000-4000-8000-0000000000a1'; raise exception 'member verified a guide';
  exception when insufficient_privilege then null; end;
  begin update public.guides set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000a1'; raise exception 'member binned a guide';
  exception when insufficient_privilege then null; end;
  begin update public.knowledge_articles set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000b1'; raise exception 'member binned an article';
  exception when insufficient_privilege then null; end;
  begin update public.analyses set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000c1'; raise exception 'member binned an analysis';
  exception when insufficient_privilege then null; end;
  begin update public.templates set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000f1'; raise exception 'member binned a template';
  exception when insufficient_privilege then null; end;
  begin update public.sops set deleted_at = null where id = '00000000-0000-4000-8000-0000000000d1'; raise exception 'member restored an SOP';
  exception when insufficient_privilege then null; end;
  begin insert into public.templates (kind, title, body, deleted_at) values ('Reply', 'Pre-binned', 'x', now()); raise exception 'member inserted a binned row';
  exception when insufficient_privilege then null; end;
  begin update public.knowledge_articles set reviewed = true where id = '00000000-0000-4000-8000-0000000000b1'; raise exception 'member marked an article reviewed';
  exception when insufficient_privilege then null; end;
  begin update public.knowledge_articles set steps_verified = true where id = '00000000-0000-4000-8000-0000000000b1'; raise exception 'member marked steps checked';
  exception when insufficient_privilege then null; end;

  delete from public.guides where id in ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2');
  get diagnostics n = row_count; if n <> 0 then raise exception 'member hard-deleted guides'; end if;
  delete from public.knowledge_articles; get diagnostics n = row_count; if n <> 0 then raise exception 'member hard-deleted articles'; end if;
  delete from public.guide_attachments; get diagnostics n = row_count; if n <> 0 then raise exception 'member deleted attachments'; end if;
  delete from public.search_log; get diagnostics n = row_count; if n <> 0 then raise exception 'member deleted the search log'; end if;
  delete from storage.objects where bucket_id = 'attachments'; get diagnostics n = row_count; if n <> 0 then raise exception 'member deleted files'; end if;

  update public.user_settings set chat_web_search = false; get diagnostics n = row_count; if n <> 0 then raise exception 'member changed team settings'; end if;
  begin insert into public.user_settings (chat_model) values ('member/model'); raise exception 'member created settings';
  exception when insufficient_privilege then null; end;
  update public.team_members set status = 'approved' where user_id = '00000000-0000-4000-8000-0000000000e3';
  get diagnostics n = row_count; if n <> 0 then raise exception 'member approved someone'; end if;
  update public.team_members set status = 'removed' where user_id = '00000000-0000-4000-8000-0000000000e1';
  get diagnostics n = row_count; if n <> 0 then raise exception 'member removed the owner'; end if;
  begin update public.team_members set role = 'owner' where user_id = '00000000-0000-4000-8000-0000000000e2'; raise exception 'member changed a role';
  exception when insufficient_privilege then null; end;
  begin insert into public.team_members (user_id, role, status) values ('00000000-0000-4000-8000-0000000000e3', 'member', 'approved'); raise exception 'member inserted a team row';
  exception when insufficient_privilege then null; end;
end $$;

-- ---------------------------------------------------------------------------
-- member edit un-verifies
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
update public.guides set verified = true where id = '00000000-0000-4000-8000-0000000000a1';
update public.knowledge_articles set reviewed = true, steps_verified = true where id = '00000000-0000-4000-8000-0000000000b1';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
do $$
declare v boolean; r boolean;
begin
  perform public.increment_guide_uses('00000000-0000-4000-8000-0000000000a1');
  update public.guides set embedding = array_fill(0.05::real, array[384])::extensions.vector where id = '00000000-0000-4000-8000-0000000000a1';
  select verified into v from public.guides where id = '00000000-0000-4000-8000-0000000000a1';
  if not v then raise exception 'opening or embedding a guide un-verified it'; end if;
  update public.guides set steps = '{"Open A/R","Click Save"}' where id = '00000000-0000-4000-8000-0000000000a1';
  select verified into v from public.guides where id = '00000000-0000-4000-8000-0000000000a1';
  if v then raise exception 'member changed the steps but the guide is still verified'; end if;

  update public.knowledge_articles set title = 'Team article zqxj renamed' where id = '00000000-0000-4000-8000-0000000000b1';
  select steps_verified into v from public.knowledge_articles where id = '00000000-0000-4000-8000-0000000000b1';
  if not v then raise exception 'a title edit cleared steps_verified'; end if;
  update public.knowledge_articles set desktop_steps = 'File > Open > Company' where id = '00000000-0000-4000-8000-0000000000b1';
  select steps_verified, reviewed into v, r from public.knowledge_articles where id = '00000000-0000-4000-8000-0000000000b1';
  if v then raise exception 'member changed the Desktop steps but they are still checked'; end if;
  if not r then raise exception 'a steps edit should leave reviewed alone'; end if;
  -- Clearing a mark (as the app does with steps_verified: false) is allowed.
  update public.knowledge_articles set steps_verified = false, cloud_steps = 'Menu > X' where id = '00000000-0000-4000-8000-0000000000b1';
end $$;

-- The owner's own edits keep their marks.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
update public.guides set verified = true where id = '00000000-0000-4000-8000-0000000000a1';
update public.guides set steps = '{"Owner step"}' where id = '00000000-0000-4000-8000-0000000000a1';
do $$ begin
  if not (select verified from public.guides where id = '00000000-0000-4000-8000-0000000000a1') then raise exception 'owner edit un-verified the guide'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- chats stay private
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
insert into public.accountant_chats (id, title) values ('00000000-0000-4000-8000-0000000000c8', 'Member chat');
insert into public.accountant_messages (chat_id, role, content) values ('00000000-0000-4000-8000-0000000000c8', 'user', 'question');
do $$
declare n int;
begin
  select count(*) into n from public.accountant_chats where id = '00000000-0000-4000-8000-0000000000c7'; if n <> 0 then raise exception 'member sees the owner''s chat'; end if;
  select count(*) into n from public.accountant_messages where chat_id = '00000000-0000-4000-8000-0000000000c7'; if n <> 0 then raise exception 'member sees the owner''s messages'; end if;
  select count(*) into n from public.search_accountant_chats('Owner chat') where id = '00000000-0000-4000-8000-0000000000c7'; if n <> 0 then raise exception 'member finds the owner''s chat'; end if;
  update public.accountant_chats set title = 'hacked' where id = '00000000-0000-4000-8000-0000000000c7'; get diagnostics n = row_count; if n <> 0 then raise exception 'member renamed the owner''s chat'; end if;
  begin insert into public.accountant_messages (chat_id, role, content) values ('00000000-0000-4000-8000-0000000000c7', 'user', 'intrude'); raise exception 'member wrote into the owner''s chat';
  exception when insufficient_privilege then null; end;
  update public.accountant_chats set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000c8'; get diagnostics n = row_count; if n <> 1 then raise exception 'member cannot bin own chat'; end if;
  update public.accountant_chats set deleted_at = null where id = '00000000-0000-4000-8000-0000000000c8'; get diagnostics n = row_count; if n <> 1 then raise exception 'member cannot restore own chat'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.accountant_chats where id = '00000000-0000-4000-8000-0000000000c8'; if n <> 0 then raise exception 'owner sees the member''s chat'; end if;
  select count(*) into n from public.accountant_messages where chat_id = '00000000-0000-4000-8000-0000000000c8'; if n <> 0 then raise exception 'owner sees the member''s messages'; end if;
  update public.accountant_chats set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000c7'; get diagnostics n = row_count; if n <> 1 then raise exception 'owner cannot bin own chat'; end if;
  update public.accountant_chats set deleted_at = null where id = '00000000-0000-4000-8000-0000000000c7'; get diagnostics n = row_count; if n <> 1 then raise exception 'owner cannot restore own chat'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- owner powers work
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  update public.user_settings set chat_web_search = false where user_id = '00000000-0000-4000-8000-0000000000e1'; get diagnostics n = row_count; if n <> 1 then raise exception 'owner cannot change settings'; end if;
  update public.templates set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000f1'; get diagnostics n = row_count; if n <> 1 then raise exception 'owner cannot bin'; end if;
  update public.templates set deleted_at = null where id = '00000000-0000-4000-8000-0000000000f1'; get diagnostics n = row_count; if n <> 1 then raise exception 'owner cannot restore'; end if;
  delete from public.pins where url = 'https://wiki.autocountsoft.com/y'; get diagnostics n = row_count; if n <> 1 then raise exception 'owner cannot delete a pin'; end if;
  delete from storage.objects where name = '00000000-0000-4000-8000-0000000000e2/a2/mine.png'; get diagnostics n = row_count; if n <> 1 then raise exception 'owner cannot delete a file'; end if;
  update public.team_members set status = 'approved' where user_id = '00000000-0000-4000-8000-0000000000e3'; get diagnostics n = row_count; if n <> 1 then raise exception 'owner cannot approve'; end if;
  if (select decided_at from public.team_members where user_id = '00000000-0000-4000-8000-0000000000e3') is null then raise exception 'decided_at not set'; end if;
  update public.team_members set status = 'pending' where user_id = '00000000-0000-4000-8000-0000000000e3';
end $$;

-- ---------------------------------------------------------------------------
-- owner cannot be removed
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  update public.team_members set status = 'removed' where user_id = '00000000-0000-4000-8000-0000000000e1';
  get diagnostics n = row_count; if n <> 0 then raise exception 'owner removed themselves through the API'; end if;
  begin update public.team_members set role = 'member' where user_id = '00000000-0000-4000-8000-0000000000e1'; raise exception 'owner demoted through the API';
  exception when insufficient_privilege then null; end;
  begin update public.team_members set role = 'owner' where user_id = '00000000-0000-4000-8000-0000000000e2'; raise exception 'owner promoted a second owner';
  exception when insufficient_privilege then null; end;
  begin delete from public.team_members where user_id = '00000000-0000-4000-8000-0000000000e2'; raise exception 'owner deleted a team row';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$
begin
  begin update public.team_members set status = 'removed' where user_id = '00000000-0000-4000-8000-0000000000e1'; raise exception 'owner removed with SQL';
  exception when insufficient_privilege then null; end;
  begin update public.team_members set status = 'rejected' where user_id = '00000000-0000-4000-8000-0000000000e1'; raise exception 'owner rejected with SQL';
  exception when insufficient_privilege then null; end;
  begin update public.team_members set role = 'member' where user_id = '00000000-0000-4000-8000-0000000000e1'; raise exception 'owner demoted with SQL';
  exception when insufficient_privilege then null; end;
  begin update public.team_members set role = 'owner' where user_id = '00000000-0000-4000-8000-0000000000e2'; raise exception 'second owner made with SQL';
  exception when insufficient_privilege then null; end;
end $$;

-- ---------------------------------------------------------------------------
-- removal keeps shared work
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e7","role":"authenticated"}', true);
insert into public.guides (id, title, product) values ('00000000-0000-4000-8000-0000000000a7', 'Leaver guide zqxj', 'AutoCount POS');
insert into public.knowledge_articles (id, title, category, tell_customer) values ('00000000-0000-4000-8000-0000000000b7', 'Leaver article', 'Basics', 'x');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
update public.team_members set status = 'removed' where user_id = '00000000-0000-4000-8000-0000000000e2';
do $$
declare n int;
begin
  select count(*) into n from public.guides where id = '00000000-0000-4000-8000-0000000000a2' and user_id = '00000000-0000-4000-8000-0000000000e2';
  if n <> 1 then raise exception 'removing the member lost their guide'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.guides; if n <> 0 then raise exception 'a removed member still sees guides'; end if;
end $$;
-- Deleting an account (as the auth server would, with no signed-in user) keeps its work, unattributed.
reset role;
select set_config('request.jwt.claims', '', true);
delete from auth.users where id = '00000000-0000-4000-8000-0000000000e7';
do $$
declare n int;
begin
  select count(*) into n from public.guides where id = '00000000-0000-4000-8000-0000000000a7' and user_id is null and updated_by is null;
  if n <> 1 then raise exception 'deleting an account lost or kept the author of its guide'; end if;
  select count(*) into n from public.knowledge_articles where id = '00000000-0000-4000-8000-0000000000b7' and user_id is null;
  if n <> 1 then raise exception 'deleting an account lost its article'; end if;
  select count(*) into n from public.team_members where user_id = '00000000-0000-4000-8000-0000000000e7';
  if n <> 0 then raise exception 'deleted account kept its team row'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- signup creates pending
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000e6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-s@test.invalid', now(), '{"display_name":"  Sam Signup  "}');
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000e8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-u@test.invalid', '{"display_name":"Una Later"}');
do $$
declare n int;
begin
  select count(*) into n from public.team_members
  where user_id = '00000000-0000-4000-8000-0000000000e6' and status = 'pending' and role = 'member' and not is_test
    and display_name = 'Sam Signup' and email = 'team-s@test.invalid';
  if n <> 1 then raise exception 'a confirmed sign-up did not create a pending row'; end if;
  select count(*) into n from public.team_members where user_id = '00000000-0000-4000-8000-0000000000e8';
  if n <> 0 then raise exception 'an unconfirmed sign-up created a row'; end if;
  update auth.users set email_confirmed_at = now() where id = '00000000-0000-4000-8000-0000000000e8';
  select count(*) into n from public.team_members where user_id = '00000000-0000-4000-8000-0000000000e8' and status = 'pending' and display_name = 'Una Later';
  if n <> 1 then raise exception 'confirming the email did not create a pending row'; end if;
  -- A later change never resets a decision.
  update public.team_members set status = 'rejected' where user_id = '00000000-0000-4000-8000-0000000000e8';
  update auth.users set email_confirmed_at = null where id = '00000000-0000-4000-8000-0000000000e8';
  update auth.users set email_confirmed_at = now() where id = '00000000-0000-4000-8000-0000000000e8';
  if (select status from public.team_members where user_id = '00000000-0000-4000-8000-0000000000e8') <> 'rejected' then raise exception 're-confirming reset the decision'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- e2e cleanup is test-only
-- ---------------------------------------------------------------------------
update public.team_members set status = 'approved' where user_id = '00000000-0000-4000-8000-0000000000e2';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
insert into public.guides (id, title, product) values ('00000000-0000-4000-8000-0000000000a8', '[e2e] member guide', 'AutoCount POS');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e5","role":"authenticated"}', true);
insert into public.guides (id, title, product) values ('00000000-0000-4000-8000-0000000000a9', '[e2e] test guide', 'AutoCount POS');
insert into public.templates (id, kind, title, body) values ('00000000-0000-4000-8000-0000000000f9', 'Reply', '[e2e] test template', 'x');
insert into public.templates (id, kind, title, body) values ('00000000-0000-4000-8000-0000000000fa', 'Reply', 'Test account real template', 'x');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
do $$
begin
  begin perform public.e2e_cleanup(); raise exception 'a normal member ran e2e clean-up';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
do $$
begin
  begin perform public.e2e_cleanup(); raise exception 'the owner ran e2e clean-up';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e5","role":"authenticated"}', true);
do $$
declare n int;
begin
  n := public.e2e_cleanup();
  if n < 2 then raise exception 'e2e clean-up removed % rows, expected at least 2', n; end if;
  select count(*) into n from public.guides where id = '00000000-0000-4000-8000-0000000000a9'; if n <> 0 then raise exception 'test guide left behind'; end if;
  select count(*) into n from public.templates where id = '00000000-0000-4000-8000-0000000000f9'; if n <> 0 then raise exception 'test template left behind'; end if;
  select count(*) into n from public.guides where id = '00000000-0000-4000-8000-0000000000a8'; if n <> 1 then raise exception 'clean-up removed a real member''s [e2e] guide'; end if;
  select count(*) into n from public.templates where id = '00000000-0000-4000-8000-0000000000fa'; if n <> 1 then raise exception 'clean-up removed a non-[e2e] row'; end if;
  select count(*) into n from public.guides where id = '00000000-0000-4000-8000-0000000000a1'; if n <> 1 then raise exception 'clean-up removed the owner''s guide'; end if;
end $$;

-- Signed-out visitors can't call any of the team functions.
reset role;
set local role anon;
do $$ begin perform public.is_member(); raise exception 'anon can call is_member'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.owner_name(); raise exception 'anon can call owner_name'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.team_settings(); raise exception 'anon can call team_settings'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.e2e_cleanup(); raise exception 'anon can call e2e_cleanup'; exception when insufficient_privilege then null; end $$;
do $$ declare n int; begin
  select count(*) into n from public.team_members; raise exception 'anon can read team_members (% rows)', n;
exception when insufficient_privilege then null;
end $$;
reset role;
select 'team: all checks passed' as result;
rollback;
