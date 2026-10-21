-- Knowledge hub: private, editable articles that explain accounting ideas in plain words.
-- Starter articles are copied in from the app's code only when the user ticks them (starter_slug/starter_version
-- record where a copy came from; edited stops newer starter text from being offered). Soft delete like guides.

create table public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  starter_slug text check (starter_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  starter_version int check (starter_version >= 1),
  edited boolean not null default false,
  title text not null check (length(trim(title)) between 1 and 200),
  category text not null check (category in ('Basics', 'Customers (AR)', 'Suppliers (AP)', 'Bank & cash', 'Stock', 'Reports', 'Tax', 'Period-end')),
  tell_customer text not null check (length(trim(tell_customer)) between 1 and 1000),
  what_it_is text not null default '' check (length(what_it_is) <= 4000),
  example text not null default '' check (length(example) <= 4000),
  desktop_steps text check (length(desktop_steps) <= 2000),
  cloud_steps text check (length(cloud_steps) <= 2000),
  steps_verified boolean not null default false,
  mistakes text[] not null default '{}' check (cardinality(mistakes) <= 20),
  related text[] not null default '{}' check (cardinality(related) <= 10),
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) <= 10),
  reviewed boolean not null default false,
  fts tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
comment on table public.knowledge_articles is 'Knowledge hub: plain-English accounting articles, private to each user.';

-- One copy per starter article per user, including copies in the bin.
create unique index knowledge_articles_starter_idx on public.knowledge_articles (user_id, starter_slug) where starter_slug is not null;
create index knowledge_articles_user_idx on public.knowledge_articles (user_id, category, title) where deleted_at is null;
create index knowledge_articles_fts_idx on public.knowledge_articles using gin (fts);
create index knowledge_articles_title_trgm_idx on public.knowledge_articles using gin (title extensions.gin_trgm_ops);

create or replace function public.knowledge_articles_set_fts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.fts :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.tell_customer, '') || ' ' || coalesce(new.what_it_is, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.example, '') || ' ' || array_to_string(new.mistakes, ' ')), 'C');
  return new;
end;
$$;

create trigger knowledge_articles_fts before insert or update on public.knowledge_articles
  for each row execute function public.knowledge_articles_set_fts();
create trigger knowledge_articles_updated_at before update on public.knowledge_articles
  for each row
  when ((to_jsonb(old) - '{fts,updated_at}'::text[]) is distinct from (to_jsonb(new) - '{fts,updated_at}'::text[]))
  execute function public.set_updated_at();

alter table public.knowledge_articles enable row level security;
create policy "owner can read" on public.knowledge_articles for select to authenticated using (user_id = (select auth.uid()));
create policy "owner can insert" on public.knowledge_articles for insert to authenticated with check (user_id = (select auth.uid()));
create policy "owner can update" on public.knowledge_articles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owner can delete" on public.knowledge_articles for delete to authenticated using (user_id = (select auth.uid()));

-- Article search: same words (full text) + similar spelling (title trigram), merged by Reciprocal Rank Fusion.
-- Runs as the caller, so Row Level Security applies.
create or replace function public.search_knowledge(p_query text, p_limit int default 10)
returns table (id uuid, score real, matched_by text[])
language sql
stable
security invoker
set search_path = ''
as $$
  with live as (
    select a.id, a.title, a.fts from public.knowledge_articles a where a.deleted_at is null
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
  ),
  fused as (
    select x.id, sum(1.0 / (60 + x.rk))::real as score, array_agg(x.src order by x.src) as matched_by
    from (
      select id, rk, 'words' as src from words
      union all select id, rk, 'fuzzy' from fuzzy
    ) x
    group by x.id
  )
  select f.id, f.score, f.matched_by
  from fused f
  order by f.score desc
  limit greatest(1, least(p_limit, 50));
$$;

revoke execute on function public.search_knowledge(text, int) from public, anon;
grant execute on function public.search_knowledge(text, int) to authenticated;
