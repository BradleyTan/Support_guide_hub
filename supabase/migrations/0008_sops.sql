-- Phase 6: saved SOPs (standard operating procedures) built from a guide.
-- Private to each user (RLS); soft delete like guides.

create sequence public.sop_code_seq start 1;

create table public.sops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code text not null unique default ('SOP-' || nextval('public.sop_code_seq')),
  -- The guide it was built from; kept as a plain SOP if that guide is deleted for good.
  guide_id uuid references public.guides (id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 300),
  version text not null default '' check (length(version) <= 100),
  purpose text not null default '' check (length(purpose) <= 2000),
  scope text not null default '' check (length(scope) <= 2000),
  -- [{ "text": "...", "attachmentId": "<guide_attachments.id>" | null }], validated by the app (1–50 steps).
  steps jsonb not null default '[]' check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 50),
  checks text[] not null default '{}' check (cardinality(checks) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
comment on table public.sops is 'Step-by-step procedures for clients, built from a guide and exported as PDF.';

create trigger sops_updated_at before update on public.sops
  for each row execute function public.set_updated_at();
create index sops_user_idx on public.sops (user_id, updated_at desc) where deleted_at is null;
create index sops_guide_idx on public.sops (guide_id);

alter table public.sops enable row level security;
create policy "owner can read" on public.sops for select to authenticated using (user_id = (select auth.uid()));
create policy "owner can delete" on public.sops for delete to authenticated using (user_id = (select auth.uid()));
-- The linked guide, if any, must be yours too.
create policy "owner can insert" on public.sops for insert to authenticated
  with check (user_id = (select auth.uid())
    and (guide_id is null or exists (select 1 from public.guides g where g.id = guide_id and g.user_id = (select auth.uid()))));
create policy "owner can update" on public.sops for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and (guide_id is null or exists (select 1 from public.guides g where g.id = guide_id and g.user_id = (select auth.uid()))));

grant usage on sequence public.sop_code_seq to authenticated;
