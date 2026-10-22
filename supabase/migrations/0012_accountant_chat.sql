-- Accountant chat: saved chats with the Groq-based accountant, plus a Desktop / Cloud / Both platform on guides
-- (so a guide's menu path is only trusted for the right AutoCount). Soft delete like guides.

-- ---------------------------------------------------------------------------
-- Guides: which AutoCount the guide is for. Existing guides get a best guess the user corrects over time.
alter table public.guides add column platform text not null default 'desktop' check (platform in ('desktop', 'cloud', 'both'));
comment on column public.guides.platform is 'AutoCount Desktop, Cloud or both; decides which menu paths the guide can confirm.';

-- The guess is not a content edit, so "Last updated" stays as it was.
alter table public.guides disable trigger guides_updated_at;
update public.guides
set platform = 'cloud'
where concat_ws(' ', title, symptom, cause, prevention, array_to_string(steps, ' '), array_to_string(tags, ' ')) ~* '(cloud|autocountcloud\.com)';
alter table public.guides enable trigger guides_updated_at;

-- ---------------------------------------------------------------------------
create table public.accountant_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  -- Placeholder → real value (e.g. "[COMPANY 1]" → the customer's name), so follow-ups reuse the same placeholders.
  mask_map jsonb not null default '{}' check (jsonb_typeof(mask_map) = 'object'),
  fts tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
comment on table public.accountant_chats is 'Accountant chat conversations, private to each user.';

create table public.accountant_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.accountant_chats (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '' check (length(content) <= 8000),
  -- Assistant turns: the checked answer (unmasked), without source text.
  answer jsonb check (answer is null or jsonb_typeof(answer) = 'object'),
  -- The "I've checked the entry and steps" tick that unlocks Copy for the customer.
  checked boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.accountant_messages is 'Turns of an accountant chat.';

create index accountant_chats_user_idx on public.accountant_chats (user_id, updated_at desc) where deleted_at is null;
create index accountant_chats_fts_idx on public.accountant_chats using gin (fts);
create index accountant_chats_title_trgm_idx on public.accountant_chats using gin (title extensions.gin_trgm_ops);
create index accountant_messages_chat_idx on public.accountant_messages (chat_id, created_at);
create index accountant_messages_user_idx on public.accountant_messages (user_id, created_at);

-- The chat's search vector covers its title and every message, so it is rebuilt whenever either changes.
create or replace function public.accountant_chat_fts(p_chat_id uuid, p_title text)
returns tsvector
language sql
stable
set search_path = ''
as $$
  select setweight(to_tsvector('english', coalesce(p_title, '')), 'A') ||
         setweight(to_tsvector('english', coalesce(string_agg(m.content || ' ' || coalesce(m.answer ->> 'customerReply', '') || ' ' || coalesce(m.answer -> 'answer' ->> 'summary', ''), ' '), '')), 'B')
  from public.accountant_messages m
  where m.chat_id = p_chat_id;
$$;

create or replace function public.accountant_chats_set_fts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.fts := public.accountant_chat_fts(new.id, new.title);
  return new;
end;
$$;

create trigger accountant_chats_fts before insert or update of title on public.accountant_chats
  for each row execute function public.accountant_chats_set_fts();
create trigger accountant_chats_updated_at before update on public.accountant_chats
  for each row
  when ((to_jsonb(old) - '{fts,updated_at}'::text[]) is distinct from (to_jsonb(new) - '{fts,updated_at}'::text[]))
  execute function public.set_updated_at();

-- A new or changed message refreshes its chat's search vector and moves the chat to the top of the list.
create or replace function public.accountant_messages_touch_chat()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.accountant_chats c
  set fts = public.accountant_chat_fts(c.id, c.title),
      updated_at = case when tg_op = 'INSERT' then now() else c.updated_at end
  where c.id = new.chat_id;
  return null;
end;
$$;

create trigger accountant_messages_touch_chat after insert or update of content, answer on public.accountant_messages
  for each row execute function public.accountant_messages_touch_chat();

alter table public.accountant_chats enable row level security;
create policy "owner can read" on public.accountant_chats for select to authenticated using (user_id = (select auth.uid()));
create policy "owner can insert" on public.accountant_chats for insert to authenticated with check (user_id = (select auth.uid()));
create policy "owner can update" on public.accountant_chats for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owner can delete" on public.accountant_chats for delete to authenticated using (user_id = (select auth.uid()));

-- Messages: own rows only, and only inside a chat the same user owns.
alter table public.accountant_messages enable row level security;
create policy "owner can read" on public.accountant_messages for select to authenticated using (user_id = (select auth.uid()));
create policy "owner can insert" on public.accountant_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.accountant_chats c where c.id = chat_id and c.user_id = (select auth.uid())));
create policy "owner can update" on public.accountant_messages for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.accountant_chats c where c.id = chat_id and c.user_id = (select auth.uid())));
create policy "owner can delete" on public.accountant_messages for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Settings for the chat: which Groq model, and whether the (optional) web search step may run.
alter table public.user_settings add column chat_model text not null default 'openai/gpt-oss-120b' check (chat_model ~ '^[\w./-]{1,100}$');
alter table public.user_settings add column chat_web_search boolean not null default false;

-- ---------------------------------------------------------------------------
-- Chat search: same words (full text) + similar spelling (title trigram), merged by Reciprocal Rank Fusion.
-- Runs as the caller, so Row Level Security applies.
create or replace function public.search_accountant_chats(p_query text, p_limit int default 10)
returns table (id uuid, score real)
language sql
stable
security invoker
set search_path = ''
as $$
  with live as (
    select c.id, c.title, c.fts from public.accountant_chats c where c.deleted_at is null
  ),
  q as (
    select websearch_to_tsquery('english', coalesce(p_query, '')) as en,
           websearch_to_tsquery('simple', coalesce(p_query, '')) as si
  ),
  words as (
    select s.id, row_number() over (order by s.rank desc) as rk
    from (
      select l.id, ts_rank_cd(l.fts, q.en) + ts_rank_cd(l.fts, q.si) as rank
      from live l, q
      where l.fts @@ q.en or l.fts @@ q.si
      order by rank desc
      limit 50
    ) s
  ),
  fuzzy as (
    select s.id, row_number() over (order by s.sim desc) as rk
    from (
      select l.id, extensions.word_similarity(coalesce(p_query, ''), l.title) as sim
      from live l
      where length(trim(coalesce(p_query, ''))) >= 3
    ) s
    where s.sim >= 0.35
    order by s.sim desc
    limit 50
  )
  select x.id, sum(1.0 / (60 + x.rk))::real as score
  from (select id, rk from words union all select id, rk from fuzzy) x
  group by x.id
  order by score desc
  limit greatest(1, least(p_limit, 50));
$$;

revoke execute on function public.search_accountant_chats(text, int) from public, anon;
grant execute on function public.search_accountant_chats(text, int) to authenticated;
revoke execute on function public.accountant_chat_fts(uuid, text) from public, anon;
