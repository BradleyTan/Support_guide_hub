-- Team sharing follow-ups (after 0014 / 0015).
-- 1. A member's content edit to a knowledge article clears "Reviewed" (the chatbot trusts reviewed text), not only the
--    Desktop / Cloud steps check.
-- 2. Members no longer update attachment rows (the app never does; they add and the owner deletes).
-- 3. An accountant message can only be updated inside a chat of your own.
-- 4. Indexes on updated_by (foreign key to auth.users, cleared when an account is deleted).

-- ---------------------------------------------------------------------------
-- Knowledge: only the owner marks an article reviewed or its menu steps checked.
-- A member changing any content means the article needs reviewing again; changing the Desktop or Cloud steps also
-- means the steps need checking again. A member's new article starts unmarked.
-- ---------------------------------------------------------------------------
create or replace function public.guard_article_trust()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Trust marks, bookkeeping and search vectors; every other column is the article's content.
  not_content constant text[] :=
    '{id,user_id,starter_slug,starter_version,edited,reviewed,steps_verified,fts,created_at,updated_at,updated_by,deleted_at}';
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
  if (to_jsonb(old) - not_content) is distinct from (to_jsonb(new) - not_content) then
    new.reviewed := false;
  end if;
  if new.desktop_steps is distinct from old.desktop_steps or new.cloud_steps is distinct from old.cloud_steps then
    new.steps_verified := false;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_article_trust() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Attachments: members add, the owner deletes; nobody edits a row through the API.
-- ---------------------------------------------------------------------------
drop policy "member can update" on public.guide_attachments;

-- ---------------------------------------------------------------------------
-- Accountant messages: an update must stay inside one of your own chats.
-- ---------------------------------------------------------------------------
drop policy "member can update own" on public.accountant_messages;
create policy "member can update own" on public.accountant_messages for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member())
    and exists (select 1 from public.accountant_chats c where c.id = chat_id and c.user_id = (select auth.uid())))
  with check (user_id = (select auth.uid()) and (select public.is_member())
    and exists (select 1 from public.accountant_chats c where c.id = chat_id and c.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- updated_by indexes (the account-deletion "set null" and editor look-ups use them).
-- ---------------------------------------------------------------------------
create index if not exists guides_updated_by_idx on public.guides (updated_by);
create index if not exists knowledge_articles_updated_by_idx on public.knowledge_articles (updated_by);
create index if not exists sops_updated_by_idx on public.sops (updated_by);
create index if not exists templates_updated_by_idx on public.templates (updated_by);
