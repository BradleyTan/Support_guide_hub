-- Official help-centre index: public AutoCount help articles, listed from each help centre's published sitemap
-- (robots.txt allows the sitemap and article pages; /support/search is disallowed and never used).
-- Shared by all users (public information). Signed-in users can read; only the refresh job (service role) writes.

create table public.official_pages (
  url text primary key check (url ~ '^https://'),
  site text not null,
  title text not null,
  snippet text not null default '',
  lastmod timestamptz,
  fts tsvector generated always as (
    setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', snippet), 'B')
  ) stored,
  embedding extensions.vector(384),
  details_fetched_at timestamptz,   -- when the article page was read for its title/summary
  seen_at timestamptz not null default now(),  -- last time it appeared in the sitemap
  created_at timestamptz not null default now()
);

create index official_pages_fts_idx on public.official_pages using gin (fts);
create index official_pages_title_trgm_idx on public.official_pages using gin (title extensions.gin_trgm_ops);
create index official_pages_embedding_idx on public.official_pages using hnsw (embedding extensions.vector_cosine_ops);
create index official_pages_pending_idx on public.official_pages (lastmod desc) where details_fetched_at is null or embedding is null;

alter table public.official_pages enable row level security;
create policy "signed-in users can read" on public.official_pages for select to authenticated using (true);
-- No insert/update/delete policies: only the service role (refresh-official Edge Function) writes.

-- Hybrid search over official articles, same approach as search_guides.
create or replace function public.search_official_pages(
  p_query text,
  p_embedding extensions.vector(384) default null,
  p_min_similarity real default 0.8,
  p_limit int default 10
)
returns table (url text, site text, title text, snippet text, lastmod timestamptz, score real, matched_by text[])
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select websearch_to_tsquery('english', coalesce(p_query, '')) as ts),
  words as (
    select s.url, row_number() over (order by s.rank desc) as rk
    from (select p.url, ts_rank_cd(p.fts, q.ts) as rank from public.official_pages p, q where p.fts @@ q.ts order by rank desc limit 30) s
  ),
  fuzzy as (
    select s.url, row_number() over (order by s.sim desc) as rk
    from (
      select p.url, extensions.word_similarity(coalesce(p_query, ''), p.title) as sim
      from public.official_pages p
      where length(trim(coalesce(p_query, ''))) >= 3
    ) s
    where s.sim >= 0.4
    order by s.sim desc
    limit 30
  ),
  meaning as (
    select s.url, row_number() over (order by s.dist) as rk
    from (
      select p.url, p.embedding operator(extensions.<=>) p_embedding as dist
      from public.official_pages p
      where p_embedding is not null and p.embedding is not null
    ) s
    where s.dist <= 1 - p_min_similarity
    order by s.dist
    limit 20
  ),
  fused as (
    select x.url, sum(1.0 / (60 + x.rk))::real as score, array_agg(x.src order by x.src) as matched_by
    from (
      select url, rk, 'words' as src from words
      union all select url, rk, 'fuzzy' from fuzzy
      union all select url, rk, 'meaning' from meaning
    ) x
    group by x.url
  )
  select p.url, p.site, p.title, p.snippet, p.lastmod, f.score, f.matched_by
  from fused f join public.official_pages p on p.url = f.url
  order by f.score desc
  limit greatest(1, least(p_limit, 30));
$$;

revoke execute on function public.search_official_pages(text, extensions.vector, real, int) from public, anon;
grant execute on function public.search_official_pages(text, extensions.vector, real, int) to authenticated;

-- Schedule: read the sitemaps daily (03:00 Malaysia time = 19:00 UTC), and every 10 minutes
-- read a small batch of new/changed article pages for titles, summaries and search vectors.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'official-pages-sync',
  '0 19 * * *',
  $cron$
    select net.http_post(
      url := 'https://wslezaavnujedvydjkae.supabase.co/functions/v1/refresh-official',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_DiGuxH2XdthSEQrIMyadVw_Uxo8Sidp'),
      body := jsonb_build_object('mode', 'sync'),
      timeout_milliseconds := 60000
    );
  $cron$
);

select cron.schedule(
  'official-pages-details',
  '*/10 * * * *',
  $cron$
    select net.http_post(
      url := 'https://wslezaavnujedvydjkae.supabase.co/functions/v1/refresh-official',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_DiGuxH2XdthSEQrIMyadVw_Uxo8Sidp'),
      body := jsonb_build_object('mode', 'details'),
      timeout_milliseconds := 60000
    );
  $cron$
);
