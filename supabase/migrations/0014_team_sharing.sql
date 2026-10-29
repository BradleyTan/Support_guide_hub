-- Team sharing: the single-user app becomes one team workspace.
-- team_members says who is in (owner / member) and whether they are approved. Only approved people see or do anything.
-- Shared tables (guides, knowledge, analyses, SOPs, templates and their child rows, activity logs) are read, added to and
-- edited by every approved member; hard deletes, the bin (deleted_at) and the trust marks (verified / reviewed /
-- steps_verified) belong to the owner. Accountant chats stay private to each person. Removing someone never deletes data.

-- ---------------------------------------------------------------------------
-- Team members
-- ---------------------------------------------------------------------------

create table public.team_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null default '' check (length(display_name) <= 80),
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'removed')),
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
comment on table public.team_members is 'Who may use the Support Desk. Only status = approved sees or changes any data.';
comment on column public.team_members.is_test is 'The e2e test account: may call e2e_cleanup() to remove its own [e2e] rows.';

-- Exactly one owner.
create unique index team_members_one_owner_idx on public.team_members (role) where role = 'owner';
create index team_members_status_idx on public.team_members (status, created_at);

-- Approved member (any role). Used by every policy, so it reads team_members past its own RLS.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members t
    where t.user_id = (select auth.uid()) and t.status = 'approved');
$$;

-- The approved owner.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members t
    where t.user_id = (select auth.uid()) and t.status = 'approved' and t.role = 'owner');
$$;

-- The owner's name for the Waiting page (pending people may call it; it reveals nothing else).
create or replace function public.owner_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(t.display_name), ''), t.email, 'the owner')
  from public.team_members t
  where t.role = 'owner';
$$;

revoke execute on function public.is_member(), public.is_owner(), public.owner_name() from public, anon;
grant execute on function public.is_member(), public.is_owner(), public.owner_name() to authenticated;

alter table public.team_members enable row level security;
create policy "self or owner can read" on public.team_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_owner()));
-- The owner decides on everyone except themselves; nobody can become owner through the API.
create policy "owner can update members" on public.team_members for update to authenticated
  using ((select public.is_owner()) and role <> 'owner')
  with check ((select public.is_owner()) and role = 'member');
-- No insert or delete policies: rows come from the sign-up trigger and the seed below.

revoke all on public.team_members from anon, authenticated;
grant select on public.team_members to authenticated;
grant update (status) on public.team_members to authenticated;

-- The owner row can't be demoted, rejected or removed (not even with SQL); nobody is promoted to owner.
-- decided_at follows every status change.
create or replace function public.guard_team_members()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'owner' and (new.role <> 'owner' or new.status <> 'approved') then
    raise exception 'The owner can''t be removed, rejected or demoted' using errcode = 'insufficient_privilege';
  end if;
  if new.role = 'owner' and old.role <> 'owner' then
    raise exception 'Nobody can be made owner' using errcode = 'insufficient_privilege';
  end if;
  if new.status is distinct from old.status then
    new.decided_at := now();
  end if;
  return new;
end;
$$;

create trigger team_members_guard before update on public.team_members
  for each row execute function public.guard_team_members();

-- Seed: the existing login is the owner; the e2e test account is an approved test member.
insert into public.team_members (user_id, email, role, status, is_test, decided_at)
select u.id, u.email, 'owner', 'approved', false, now() from auth.users u where u.id = '0e19c3dd-c912-4d00-b702-48b8b2e01869'
on conflict (user_id) do nothing;
insert into public.team_members (user_id, email, role, status, is_test, decided_at)
select u.id, u.email, 'member', 'approved', true, now() from auth.users u where u.id = 'b1e2ff14-a47f-486b-a43a-26635994a67e'
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Sign-up: a confirmed account becomes a pending member (unconfirmed sign-ups wait for their email link).
-- ---------------------------------------------------------------------------

create or replace function public.handle_confirmed_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.team_members (user_id, email, display_name)
  values (new.id, new.email, left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80))
  on conflict (user_id) do nothing;
  return null;
end;
$$;
revoke execute on function public.handle_confirmed_user() from public, anon, authenticated;

create trigger on_auth_user_created_confirmed after insert on auth.users
  for each row when (new.email_confirmed_at is not null)
  execute function public.handle_confirmed_user();
create trigger on_auth_user_email_confirmed after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_confirmed_user();

-- ---------------------------------------------------------------------------
-- Shared work outlives its author: user_id becomes nullable and is cleared when an account is deleted.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'guides', 'guide_attachments', 'guide_revisions', 'pins', 'knowledge_articles', 'analyses', 'analysis_messages',
    'sops', 'templates', 'guide_events', 'search_log']
  loop
    execute format('alter table public.%I alter column user_id drop not null', t);
    execute format('alter table public.%I drop constraint %I', t, t || '_user_id_fkey');
    execute format('alter table public.%I add constraint %I foreign key (user_id) references auth.users (id) on delete set null', t, t || '_user_id_fkey');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who changed what: updated_by on guides, articles, SOPs and templates (existing rows: their author).
-- ---------------------------------------------------------------------------

alter table public.guides add column updated_by uuid default auth.uid() references auth.users (id) on delete set null;
alter table public.knowledge_articles add column updated_by uuid default auth.uid() references auth.users (id) on delete set null;
alter table public.sops add column updated_by uuid default auth.uid() references auth.users (id) on delete set null;
alter table public.templates add column updated_by uuid default auth.uid() references auth.users (id) on delete set null;

-- The backfill is not an edit, so "Last updated" stays as it was.
alter table public.guides disable trigger guides_updated_at;
alter table public.knowledge_articles disable trigger knowledge_articles_updated_at;
alter table public.sops disable trigger sops_updated_at;
alter table public.templates disable trigger templates_updated_at;
update public.guides set updated_by = user_id;
update public.knowledge_articles set updated_by = user_id;
update public.sops set updated_by = user_id;
update public.templates set updated_by = user_id;
alter table public.guides enable trigger guides_updated_at;
alter table public.knowledge_articles enable trigger knowledge_articles_updated_at;
alter table public.sops enable trigger sops_updated_at;
alter table public.templates enable trigger templates_updated_at;

-- The editor is always the signed-in caller, never a value they send: a new row records its creator, and an update
-- records the caller when the content changes or when they try to set updated_by themselves. Use counters and
-- search vectors alone (opening a guide, the background embedding fill) keep the previous editor.
create or replace function public.set_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  skip constant text[] := '{uses,embedding,fts,updated_at,updated_by}';
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  -- tg_argv[0] = 'always': the trigger fired because the statement names updated_by itself.
  if tg_op = 'INSERT' or tg_argv[0] = 'always'
     or (to_jsonb(old) - skip) is distinct from (to_jsonb(new) - skip) then
    new.updated_by := (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger guides_set_updated_by before insert or update on public.guides
  for each row execute function public.set_updated_by();
create trigger knowledge_articles_set_updated_by before insert or update on public.knowledge_articles
  for each row execute function public.set_updated_by();
create trigger sops_set_updated_by before insert or update on public.sops
  for each row execute function public.set_updated_by();
create trigger templates_set_updated_by before insert or update on public.templates
  for each row execute function public.set_updated_by();
-- Any update that names updated_by (even with its current value) records the caller instead.
create trigger guides_stamp_updated_by before update of updated_by on public.guides
  for each row execute function public.set_updated_by('always');
create trigger knowledge_articles_stamp_updated_by before update of updated_by on public.knowledge_articles
  for each row execute function public.set_updated_by('always');
create trigger sops_stamp_updated_by before update of updated_by on public.sops
  for each row execute function public.set_updated_by('always');
create trigger templates_stamp_updated_by before update of updated_by on public.templates
  for each row execute function public.set_updated_by('always');

-- ---------------------------------------------------------------------------
-- Owner-only columns. RLS can't see which column changed, so triggers enforce these.
-- Calls without a signed-in user (service role, database jobs, the auth server clearing user_id) are trusted:
-- anon has no row access at all, so only privileged roles reach these rows without auth.uid().
-- ---------------------------------------------------------------------------

-- Nobody reassigns a row's author or rewrites when it was created; only the owner moves rows into or out of the bin.
create or replace function public.guard_owner_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  -- (An account deletion clearing user_id arrives through the foreign key's own trigger, one level deeper.)
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id
     and not (new.user_id is null and pg_trigger_depth() > 1) then
    raise exception 'The author of a row can''t be changed' using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'UPDATE' and new.created_at is distinct from old.created_at then
    raise exception 'When a row was created can''t be changed' using errcode = 'insufficient_privilege';
  end if;
  if (select public.is_owner()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if (to_jsonb(new) -> 'deleted_at') <> 'null'::jsonb then
      raise exception 'Only the owner can put rows in the bin' using errcode = 'insufficient_privilege';
    end if;
  elsif (to_jsonb(new) -> 'deleted_at') is distinct from (to_jsonb(old) -> 'deleted_at') then
    raise exception 'Only the owner can delete or restore' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger guides_guard_owner_columns before insert or update on public.guides
  for each row execute function public.guard_owner_columns();
create trigger knowledge_articles_guard_owner_columns before insert or update on public.knowledge_articles
  for each row execute function public.guard_owner_columns();
create trigger analyses_guard_owner_columns before insert or update on public.analyses
  for each row execute function public.guard_owner_columns();
create trigger sops_guard_owner_columns before insert or update on public.sops
  for each row execute function public.guard_owner_columns();
create trigger templates_guard_owner_columns before insert or update on public.templates
  for each row execute function public.guard_owner_columns();
-- guide_attachments has no bin, but members may update it, so its author and created_at are protected the same way.
create trigger guide_attachments_guard_owner_columns before update on public.guide_attachments
  for each row execute function public.guard_owner_columns();

-- Guides: only the owner marks a guide verified. A member's content edit means the fix needs checking again.
-- (A member may clear the mark; they can never set it. A member's new guide always starts unverified.)
create or replace function public.guard_guide_trust()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  not_content constant text[] := '{id,user_id,code,verified,uses,embedding,fts,created_at,updated_at,updated_by,deleted_at}';
begin
  if (select auth.uid()) is null or (select public.is_owner()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.verified := false;
    return new;
  end if;
  if new.verified and not old.verified then
    raise exception 'Only the owner can verify a guide' using errcode = 'insufficient_privilege';
  end if;
  if (to_jsonb(old) - not_content) is distinct from (to_jsonb(new) - not_content) then
    new.verified := false;
  end if;
  return new;
end;
$$;

create trigger guides_guard_trust before insert or update on public.guides
  for each row execute function public.guard_guide_trust();

-- Knowledge: only the owner marks an article reviewed or its menu steps checked.
-- A member changing the Desktop or Cloud steps means they need checking again; a member's new article starts unmarked.
create or replace function public.guard_article_trust()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select public.is_owner()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.reviewed := false;
    new.steps_verified := false;
    return new;
  end if;
  if (new.reviewed and not old.reviewed) or (new.steps_verified and not old.steps_verified) then
    raise exception 'Only the owner can mark an article reviewed or its steps checked' using errcode = 'insufficient_privilege';
  end if;
  if new.desktop_steps is distinct from old.desktop_steps or new.cloud_steps is distinct from old.cloud_steps then
    new.steps_verified := false;
  end if;
  return new;
end;
$$;

create trigger knowledge_articles_guard_trust before insert or update on public.knowledge_articles
  for each row execute function public.guard_article_trust();

-- ---------------------------------------------------------------------------
-- Row Level Security: replace every per-user policy.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'guides', 'guide_attachments', 'guide_revisions', 'pins', 'knowledge_articles', 'analyses', 'analysis_messages',
    'sops', 'templates', 'guide_events', 'search_log', 'accountant_chats', 'accountant_messages',
    'official_pages', 'web_cache', 'user_settings']
  loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;

  -- Shared tables: every approved member reads and adds (as themselves); only the owner hard-deletes.
  foreach t in array array[
    'guides', 'guide_attachments', 'guide_revisions', 'pins', 'knowledge_articles', 'analyses', 'analysis_messages',
    'sops', 'templates', 'guide_events', 'search_log', 'web_cache']
  loop
    execute format('create policy "member can read" on public.%I for select to authenticated using ((select public.is_member()))', t);
    execute format('create policy "member can insert" on public.%I for insert to authenticated with check ((select public.is_member()) and user_id = (select auth.uid()))', t);
    execute format('create policy "owner can delete" on public.%I for delete to authenticated using ((select public.is_owner()))', t);
  end loop;

  -- Editable shared tables (the logs, revisions, pins and analysis messages were never editable and stay that way).
  foreach t in array array['guides', 'guide_attachments', 'knowledge_articles', 'analyses', 'sops', 'templates', 'web_cache']
  loop
    execute format('create policy "member can update" on public.%I for update to authenticated using ((select public.is_member())) with check ((select public.is_member()))', t);
  end loop;

  -- Private chats: your own rows, and only while you are an approved member.
  foreach t in array array['accountant_chats', 'accountant_messages']
  loop
    execute format('create policy "member can read own" on public.%I for select to authenticated using (user_id = (select auth.uid()) and (select public.is_member()))', t);
    execute format('create policy "member can update own" on public.%I for update to authenticated using (user_id = (select auth.uid()) and (select public.is_member())) with check (user_id = (select auth.uid()) and (select public.is_member()))', t);
    execute format('create policy "member can delete own" on public.%I for delete to authenticated using (user_id = (select auth.uid()) and (select public.is_member()))', t);
  end loop;
end;
$$;

create policy "member can insert own" on public.accountant_chats for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_member()));
-- Messages only go into a chat of your own.
create policy "member can insert own" on public.accountant_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_member())
    and exists (select 1 from public.accountant_chats c where c.id = chat_id and c.user_id = (select auth.uid())));

-- Official help-centre index: approved members only (writes stay with the service role).
create policy "member can read" on public.official_pages for select to authenticated using ((select public.is_member()));

-- Settings: one team row, the owner's. Members read it; only the owner writes it.
create policy "member can read" on public.user_settings for select to authenticated using ((select public.is_member()));
create policy "owner can insert" on public.user_settings for insert to authenticated
  with check ((select public.is_owner()) and user_id = (select auth.uid()));
create policy "owner can update" on public.user_settings for update to authenticated
  using ((select public.is_owner()) and user_id = (select auth.uid()))
  with check ((select public.is_owner()) and user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage (attachments bucket): members read every file and upload into their own folder; only the owner deletes.
-- Existing paths (<user_id>/<guide_id>/...) stay as they are.
-- ---------------------------------------------------------------------------

drop policy "owner can read own files" on storage.objects;
drop policy "owner can upload own files" on storage.objects;
drop policy "owner can update own files" on storage.objects;
drop policy "owner can delete own files" on storage.objects;

create policy "members can read attachments" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (select public.is_member()));
create policy "members can upload attachments" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (select public.is_member()) and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owner can delete attachments" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (select public.is_owner()));

-- ---------------------------------------------------------------------------
-- Team-wide helpers for the app and Edge Functions (members only).
-- ---------------------------------------------------------------------------

-- The chat model and web-search switch, from the owner's settings row (no row: the app's defaults apply).
create or replace function public.team_settings()
returns table (chat_model text, chat_web_search boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_member() then
    raise exception 'not_approved' using errcode = 'insufficient_privilege';
  end if;
  return query
    select s.chat_model, s.chat_web_search
    from public.user_settings s
    join public.team_members t on t.user_id = s.user_id and t.role = 'owner';
end;
$$;

-- Chat answers given today (since midnight Malaysia time) by the whole team, for the shared daily limit.
create or replace function public.team_answers_today()
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_member() then
    raise exception 'not_approved' using errcode = 'insufficient_privilege';
  end if;
  return (
    select count(*)::int
    from public.accountant_messages m
    where m.role = 'assistant'
      and m.created_at >= (date_trunc('day', now() at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur'));
end;
$$;

-- e2e clean-up: removes for good the test accounts' "[e2e]" rows (and their child rows, by cascade) and the
-- test accounts' search log. Only a test account may call it; nobody else's rows are touched.
create or replace function public.e2e_cleanup()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  total int := 0;
  n int;
  testers uuid[];
begin
  if not exists (
    select 1 from public.team_members t
    where t.user_id = (select auth.uid()) and t.is_test and t.status = 'approved') then
    raise exception 'e2e_cleanup is for the test account only' using errcode = 'insufficient_privilege';
  end if;
  select array_agg(t.user_id) into testers from public.team_members t where t.is_test;

  delete from public.guides where left(title, 5) = '[e2e]' and user_id = any (testers);
  get diagnostics n = row_count; total := total + n;
  delete from public.knowledge_articles where left(title, 5) = '[e2e]' and user_id = any (testers);
  get diagnostics n = row_count; total := total + n;
  delete from public.analyses where left(title, 5) = '[e2e]' and user_id = any (testers);
  get diagnostics n = row_count; total := total + n;
  delete from public.sops where left(title, 5) = '[e2e]' and user_id = any (testers);
  get diagnostics n = row_count; total := total + n;
  delete from public.templates where left(title, 5) = '[e2e]' and user_id = any (testers);
  get diagnostics n = row_count; total := total + n;
  delete from public.search_log where user_id = any (testers);
  get diagnostics n = row_count; total := total + n;
  return total;
end;
$$;

revoke execute on function public.team_settings(), public.team_answers_today(), public.e2e_cleanup() from public, anon;
grant execute on function public.team_settings(), public.team_answers_today(), public.e2e_cleanup() to authenticated;
revoke execute on function public.guard_team_members(), public.set_updated_by(), public.guard_owner_columns(),
  public.guard_guide_trust(), public.guard_article_trust() from public, anon, authenticated;
