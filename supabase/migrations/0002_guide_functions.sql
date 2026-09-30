-- Phase 2 helpers. Both run as the calling user (security invoker), so Row Level Security still applies.

-- Likely duplicates for a draft guide: trigram similarity on the title plus full-text match on title/error text.
create or replace function public.similar_guides(p_title text, p_error text default '', p_limit int default 5)
returns table (id uuid, code text, title text, score real)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select
      coalesce(p_title, '') as title,
      websearch_to_tsquery('simple', coalesce(p_title, '') || ' ' || coalesce(p_error, '')) as ts
  )
  select g.id, g.code, g.title,
         (extensions.similarity(g.title, q.title) * 0.7
          + least(ts_rank(g.fts, q.ts), 1.0) * 0.3)::real as score
  from public.guides g, q
  where g.deleted_at is null
    and length(trim(q.title)) >= 4
    and (extensions.similarity(g.title, q.title) > 0.25 or g.fts @@ q.ts)
  order by score desc
  limit greatest(1, least(p_limit, 20));
$$;

-- Atomically bumps the "used" counter when a guide is opened or used in a reply.
create or replace function public.increment_guide_uses(p_guide_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.guides set uses = uses + 1 where id = p_guide_id and deleted_at is null;
$$;

revoke execute on function public.similar_guides(text, text, int) from public, anon;
revoke execute on function public.increment_guide_uses(uuid) from public, anon;
grant execute on function public.similar_guides(text, text, int) to authenticated;
grant execute on function public.increment_guide_uses(uuid) to authenticated;
