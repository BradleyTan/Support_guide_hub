-- search_gaps: "most recent search" breaks ties on time by entry order (id).
create or replace function public.search_gaps(p_days int default 90, p_min_times int default 2, p_limit int default 20)
returns table (query text, times int, last_searched timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select (array_agg(s.query order by s.created_at desc, s.id desc))[1], count(*)::int, max(s.created_at)
  from public.search_log s
  where s.created_at > now() - make_interval(days => p_days)
  group by s.normalized
  having count(*) >= p_min_times and (array_agg(s.guide_hits order by s.created_at desc, s.id desc))[1] = 0
  order by count(*) desc, max(s.created_at) desc
  limit p_limit;
$$;
