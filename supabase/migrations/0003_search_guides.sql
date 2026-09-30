-- Hybrid guide search: full-text + typo-tolerant title/error match + meaning (gte-small vectors),
-- merged with Reciprocal Rank Fusion. Runs as the caller, so Row Level Security still applies.
create or replace function public.search_guides(
  p_query text,
  p_embedding extensions.vector(384) default null,
  p_product text default null,
  p_module text default null,
  p_version text default null,
  p_tag text default null,
  p_updated_after timestamptz default null,
  p_min_similarity real default 0.8,
  p_limit int default 20
)
returns table (id uuid, code text, score real, matched_by text[])
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as (
    select g.id, g.code, g.title, g.error_message, g.fts, g.embedding
    from public.guides g
    where g.deleted_at is null
      and (p_product is null or g.product = p_product)
      and (p_module is null or g.module ilike p_module)
      and (p_version is null or g.version ilike '%' || p_version || '%')
      and (p_tag is null or p_tag = any (g.tags))
      and (p_updated_after is null or g.updated_at >= p_updated_after)
  ),
  q as (
    select websearch_to_tsquery('english', coalesce(p_query, '')) as en,
           websearch_to_tsquery('simple', coalesce(p_query, '')) as si
  ),
  words as (
    select s.id, row_number() over (order by s.rank desc) as rk
    from (
      select f.id, ts_rank_cd(f.fts, q.en) + ts_rank_cd(f.fts, q.si) as rank
      from filtered f, q
      where f.fts @@ q.en or f.fts @@ q.si
      order by rank desc
      limit 50
    ) s
  ),
  fuzzy as (
    select s.id, row_number() over (order by s.sim desc) as rk
    from (
      select f.id, extensions.word_similarity(coalesce(p_query, ''), f.title || ' ' || coalesce(f.error_message, '')) as sim
      from filtered f
      where length(trim(coalesce(p_query, ''))) >= 3
    ) s
    where s.sim >= 0.35
    order by s.sim desc
    limit 50
  ),
  meaning as (
    select s.id, row_number() over (order by s.dist) as rk
    from (
      select f.id, f.embedding operator(extensions.<=>) p_embedding as dist
      from filtered f
      where p_embedding is not null and f.embedding is not null
    ) s
    where s.dist <= 1 - p_min_similarity
    order by s.dist
    limit 30
  ),
  fused as (
    select x.id, sum(1.0 / (60 + x.rk))::real as score, array_agg(x.src order by x.src) as matched_by
    from (
      select id, rk, 'words' as src from words
      union all select id, rk, 'fuzzy' from fuzzy
      union all select id, rk, 'meaning' from meaning
    ) x
    group by x.id
  )
  select f.id, g.code, f.score, f.matched_by
  from fused f
  join filtered g on g.id = f.id
  order by f.score desc
  limit greatest(1, least(p_limit, 50));
$$;

revoke execute on function public.search_guides(text, extensions.vector, text, text, text, text, timestamptz, real, int) from public, anon;
grant execute on function public.search_guides(text, extensions.vector, text, text, text, text, timestamptz, real, int) to authenticated;
