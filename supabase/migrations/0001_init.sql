-- AutoCount Support Desk: initial schema.
-- Every row belongs to one user; Row Level Security limits each user to their own rows.
-- Deletes are soft (deleted_at) so guides can be restored from the bin for 30 days.

create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create sequence public.guide_code_seq start 1001;
create sequence public.analysis_code_seq start 201;

-- ---------------------------------------------------------------------------
-- Guides
-- ---------------------------------------------------------------------------

create table public.guides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code text not null unique default ('G-' || nextval('public.guide_code_seq')),
  title text not null check (length(trim(title)) between 1 and 300),
  product text not null check (product in ('AutoCount Accounting', 'AutoCount Payroll', 'AutoCount POS', 'AutoCount Account Book')),
  version text not null default '',
  module text not null default '',
  category text check (category in (
    'Installation & Database', 'Bank & Cash', 'Tax (SST / e-Invoice)', 'Payroll Statutory', 'Stock & Costing',
    'Sync & Integration', 'Printing & Reports', 'Year-end & Periods', 'Multi-currency')),
  symptom text not null default '',
  error_message text,
  cause text,
  steps text[] not null default '{}',
  prevention text,
  tags text[] not null default '{}',
  verified boolean not null default false,
  uses integer not null default 0 check (uses >= 0),
  -- 384 dimensions = Supabase built-in gte-small embeddings (filled in Phase 3).
  embedding extensions.vector(384),
  fts tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.guides is 'Reusable AutoCount troubleshooting / how-to guidelines.';
comment on column public.guides.verified is 'True once the user has confirmed the fix works.';

-- Full-text vector: title and error text weigh most, then symptom/cause/tags.
create or replace function public.guides_set_fts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.fts :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.error_message, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.symptom, '') || ' ' || coalesce(new.cause, '')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(new.tags, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.module, '') || ' ' || array_to_string(new.steps, ' ')), 'C');
  return new;
end;
$$;

create trigger guides_fts before insert or update on public.guides
  for each row execute function public.guides_set_fts();
create trigger guides_updated_at before update on public.guides
  for each row execute function public.set_updated_at();

create index guides_user_idx on public.guides (user_id) where deleted_at is null;
create index guides_fts_idx on public.guides using gin (fts);
create index guides_title_trgm_idx on public.guides using gin (title extensions.gin_trgm_ops);
create index guides_embedding_idx on public.guides using hnsw (embedding extensions.vector_cosine_ops);

create table public.guide_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  guide_id uuid not null references public.guides (id) on delete cascade,
  storage_path text not null,
  name text not null,
  kind text not null check (kind in ('image', 'pdf', 'sql')),
  size_bytes integer not null check (size_bytes >= 0),
  created_at timestamptz not null default now()
);
create index guide_attachments_guide_idx on public.guide_attachments (guide_id);
create index guide_attachments_user_idx on public.guide_attachments (user_id);

create table public.guide_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  guide_id uuid not null references public.guides (id) on delete cascade,
  summary text not null,
  snapshot jsonb,
  created_at timestamptz not null default now()
);
create index guide_revisions_guide_idx on public.guide_revisions (guide_id, created_at desc);
create index guide_revisions_user_idx on public.guide_revisions (user_id);

-- Official pages pinned to a guide from Search.
create table public.pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  guide_id uuid not null references public.guides (id) on delete cascade,
  title text not null,
  url text not null check (url ~* '^https://'),
  site text not null,
  created_at timestamptz not null default now(),
  unique (guide_id, url)
);
create index pins_user_idx on public.pins (user_id);

-- ---------------------------------------------------------------------------
-- Accounting analyst
-- ---------------------------------------------------------------------------

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code text not null unique default ('AN-' || nextval('public.analysis_code_seq')),
  title text not null,
  scenario text not null,
  result jsonb not null, -- the 7-section structured answer, validated by the app
  confidence text not null check (confidence in ('High', 'Medium', 'Low')),
  model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create trigger analyses_updated_at before update on public.analyses
  for each row execute function public.set_updated_at();
create index analyses_user_idx on public.analyses (user_id, created_at desc) where deleted_at is null;

create table public.analysis_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  text text not null,
  image_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index analysis_messages_analysis_idx on public.analysis_messages (analysis_id, created_at);
create index analysis_messages_user_idx on public.analysis_messages (user_id);

-- ---------------------------------------------------------------------------
-- Library
-- ---------------------------------------------------------------------------

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('Reply', 'SQL', 'Checklist')),
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  uses integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create trigger templates_updated_at before update on public.templates
  for each row execute function public.set_updated_at();
create index templates_user_idx on public.templates (user_id) where deleted_at is null;

create table public.release_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product text not null check (product in ('AutoCount Accounting', 'AutoCount Payroll', 'AutoCount POS', 'AutoCount Account Book')),
  version text not null,
  type text not null check (type in ('Known issue', 'Fix', 'Note')),
  title text not null,
  detail text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create trigger release_notes_updated_at before update on public.release_notes
  for each row execute function public.set_updated_at();
create index release_notes_user_idx on public.release_notes (user_id) where deleted_at is null;

create table public.release_note_guides (
  release_note_id uuid not null references public.release_notes (id) on delete cascade,
  guide_id uuid not null references public.guides (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (release_note_id, guide_id)
);
create index release_note_guides_guide_idx on public.release_note_guides (guide_id);
create index release_note_guides_user_idx on public.release_note_guides (user_id);

-- Cached official-source search results (7 days, enforced by the app).
create table public.web_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  query_hash text not null,
  query text not null,
  results jsonb not null,
  fetched_at timestamptz not null default now(),
  unique (user_id, query_hash)
);

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  analyst_model text not null default 'claude-opus-5-5',
  default_model text not null default 'claude-sonnet-5',
  mask_sensitive boolean not null default true,
  official_sites text[] not null default array[
    'autocountsoft.com', 'wiki.autocountsoft.com',
    'help.accounting.autocountcloud.com', 'help.hrms.autocountcloud.com'],
  searxng_url text,
  updated_at timestamptz not null default now()
);
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: owner-only access on every table
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'guides', 'guide_attachments', 'guide_revisions', 'pins', 'analyses', 'analysis_messages',
    'templates', 'release_notes', 'release_note_guides', 'web_cache', 'user_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner can read" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "owner can delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;

  -- Top-level tables: insert/update only your own rows.
  foreach t in array array['guides', 'analyses', 'templates', 'release_notes', 'web_cache', 'user_settings']
  loop
    execute format('create policy "owner can insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "owner can update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- Child tables: the parent row must also be yours.
create policy "owner can insert" on public.guide_attachments for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.guides g where g.id = guide_id and g.user_id = (select auth.uid())));
create policy "owner can update" on public.guide_attachments for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.guides g where g.id = guide_id and g.user_id = (select auth.uid())));

create policy "owner can insert" on public.guide_revisions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.guides g where g.id = guide_id and g.user_id = (select auth.uid())));

create policy "owner can insert" on public.pins for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.guides g where g.id = guide_id and g.user_id = (select auth.uid())));

create policy "owner can insert" on public.analysis_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.analyses a where a.id = analysis_id and a.user_id = (select auth.uid())));

create policy "owner can insert" on public.release_note_guides for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.release_notes r where r.id = release_note_id and r.user_id = (select auth.uid()))
    and exists (select 1 from public.guides g where g.id = guide_id and g.user_id = (select auth.uid())));

-- Sequences are used by column defaults when authenticated users insert.
grant usage on sequence public.guide_code_seq, public.analysis_code_seq to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, files stored under <user_id>/...
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 10485760,
        array['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'application/sql'])
on conflict (id) do nothing;

create policy "owner can read own files" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owner can upload own files" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owner can update own files" on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owner can delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
