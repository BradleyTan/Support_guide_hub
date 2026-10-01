-- Phase 5: a private activity log (guide opens, searches) for the Insights page.
-- Rows belong to one user (RLS). Both logs keep 90 days; a nightly job deletes older rows.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.guide_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  guide_id uuid not null references public.guides (id) on delete cascade,
  kind text not null default 'opened' check (kind in ('opened')),
  created_at timestamptz not null default now()
);
comment on table public.guide_events is 'When the user opened a guide. Kept 90 days.';
create index guide_events_user_time_idx on public.guide_events (user_id, created_at desc);
create index guide_events_guide_idx on public.guide_events (guide_id);

-- Same text, ignoring case and extra spaces, counts as the same search.
create or replace function public.normalize_query(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(p), '\s+', ' ', 'g'));
$$;

create table public.search_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  query text not null check (char_length(query) between 2 and 200),
  normalized text not null generated always as (public.normalize_query(query)) stored,
  guide_hits integer not null check (guide_hits >= 0),
  created_at timestamptz not null default now()
);
comment on table public.search_log is 'Searches and how many of the user''s guides matched. Kept 90 days.';
create index search_log_user_time_idx on public.search_log (user_id, created_at desc);
create index search_log_user_query_idx on public.search_log (user_id, normalized, created_at desc);

alter table public.guide_events enable row level security;
alter table public.search_log enable row level security;
create policy "owner can read" on public.guide_events for select to authenticated using (user_id = (select auth.uid()));
create policy "owner can delete" on public.guide_events for delete to authenticated using (user_id = (select auth.uid()));
create policy "owner can insert" on public.guide_events for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.guides g where g.id = guide_id and g.user_id = (select auth.uid())));
create policy "owner can read" on public.search_log for select to authenticated using (user_id = (select auth.uid()));
create policy "owner can delete" on public.search_log for delete to authenticated using (user_id = (select auth.uid()));
create policy "owner can insert" on public.search_log for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Opening a guide: bump the all-time counter and log the open.
-- ---------------------------------------------------------------------------

create or replace function public.increment_guide_uses(p_guide_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.guides set uses = uses + 1 where id = p_guide_id and deleted_at is null;
  insert into public.guide_events (guide_id)
  select id from public.guides where id = p_guide_id and deleted_at is null;
$$;

-- "Last updated" should mean the guide's content changed. Opening a guide (uses) and the
-- background search-vector fill (embedding, fts) used to bump it too.
drop trigger guides_updated_at on public.guides;
create trigger guides_updated_at before update on public.guides
  for each row
  when ((to_jsonb(old) - '{uses,embedding,fts,updated_at}'::text[]) is distinct from (to_jsonb(new) - '{uses,embedding,fts,updated_at}'::text[]))
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Searches: one row per search, but repeats of the same search within 30 minutes
-- (e.g. changing filters, reloading) count once.
-- ---------------------------------------------------------------------------

create or replace function public.log_search(p_query text, p_guide_hits int)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.search_log (query, guide_hits)
  select left(btrim(p_query), 200), greatest(p_guide_hits, 0)
  where char_length(btrim(p_query)) >= 2
    and not exists (
      select 1 from public.search_log s
      where s.user_id = (select auth.uid())
        and s.normalized = public.normalize_query(left(btrim(p_query), 200))
        and s.created_at > now() - interval '30 minutes');
$$;

-- ---------------------------------------------------------------------------
-- Insights (all security invoker: each user only ever sees their own rows)
-- ---------------------------------------------------------------------------

-- Searches made at least p_min_times in the last p_days whose most recent run matched none of your guides.
create or replace function public.search_gaps(p_days int default 90, p_min_times int default 2, p_limit int default 20)
returns table (query text, times int, last_searched timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select (array_agg(s.query order by s.created_at desc))[1], count(*)::int, max(s.created_at)
  from public.search_log s
  where s.created_at > now() - make_interval(days => p_days)
  group by s.normalized
  having count(*) >= p_min_times and (array_agg(s.guide_hits order by s.created_at desc))[1] = 0
  order by count(*) desc, max(s.created_at) desc
  limit p_limit;
$$;

-- Most-opened guides in the last p_days (deleted guides left out).
create or replace function public.top_guides(p_days int default 90, p_limit int default 10)
returns table (guide_id uuid, opens int, last_opened timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.guide_id, count(*)::int, max(e.created_at)
  from public.guide_events e
  join public.guides g on g.id = e.guide_id and g.deleted_at is null
  where e.created_at > now() - make_interval(days => p_days)
  group by e.guide_id
  order by count(*) desc, max(e.created_at) desc
  limit p_limit;
$$;

-- Weekly totals for the last p_weeks weeks (Monday-start weeks, Malaysia time), oldest first.
create or replace function public.weekly_activity(p_weeks int default 12)
returns table (week_start date, opens int, searches int, unmatched int, added int, edited int)
language sql
stable
security invoker
set search_path = ''
as $$
  with weeks as (
    select w, w + interval '1 week' as w_end
    from generate_series(
      (date_trunc('week', now() at time zone 'Asia/Kuala_Lumpur') - make_interval(weeks => greatest(p_weeks, 1) - 1)) at time zone 'Asia/Kuala_Lumpur',
      date_trunc('week', now() at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur',
      interval '1 week') as w
  )
  select
    (w at time zone 'Asia/Kuala_Lumpur')::date,
    (select count(*) from public.guide_events e where e.created_at >= w and e.created_at < w_end)::int,
    (select count(*) from public.search_log s where s.created_at >= w and s.created_at < w_end)::int,
    (select count(*) from public.search_log s where s.created_at >= w and s.created_at < w_end and s.guide_hits = 0)::int,
    (select count(*) from public.guides g where g.deleted_at is null and g.created_at >= w and g.created_at < w_end)::int,
    (select count(*) from public.guide_revisions r where r.created_at >= w and r.created_at < w_end)::int
  from weeks
  order by w;
$$;

revoke execute on function public.log_search(text, int), public.search_gaps(int, int, int),
  public.top_guides(int, int), public.weekly_activity(int) from public, anon;
grant execute on function public.log_search(text, int), public.search_gaps(int, int, int),
  public.top_guides(int, int), public.weekly_activity(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Keep 90 days: nightly clean-up at 03:30 Malaysia time (19:30 UTC).
-- ---------------------------------------------------------------------------

select cron.schedule(
  'activity-log-cleanup',
  '30 19 * * *',
  $cron$
    delete from public.guide_events where created_at < now() - interval '90 days';
    delete from public.search_log where created_at < now() - interval '90 days';
  $cron$
);
