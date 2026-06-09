-- Migration: 0004 — init generation_jobs + assets
-- Source of truth: docs/04-data-model.md §generation_jobs, §assets

create type public.job_status  as enum ('pending', 'running', 'succeeded', 'failed', 'canceled');
create type public.asset_kind  as enum ('image', 'video', 'thumbnail');

create table if not exists public.generation_jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  type             public.generation_type not null,
  status           public.job_status not null default 'pending',
  template_id      uuid references public.templates(id),
  provider         text not null,
  provider_job_id  text,
  model            text not null,
  input            jsonb not null,
  output           jsonb,
  error            jsonb,
  credits_cost     int not null default 0,
  deleted_at       timestamptz,
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_jobs_user_created
  on public.generation_jobs (user_id, created_at desc) where deleted_at is null;
create index if not exists idx_jobs_status_created
  on public.generation_jobs (status, created_at) where status in ('pending', 'running');
create index if not exists idx_jobs_provider_job
  on public.generation_jobs (provider, provider_job_id) where provider_job_id is not null;

alter table public.generation_jobs enable row level security;

drop policy if exists "jobs_select_own" on public.generation_jobs;
create policy "jobs_select_own"
on public.generation_jobs for select
to authenticated
using (user_id = auth.uid() and deleted_at is null);

drop policy if exists "jobs_insert_own" on public.generation_jobs;
create policy "jobs_insert_own"
on public.generation_jobs for insert
to authenticated
with check (user_id = auth.uid());
-- UPDATE/DELETE: no policy → only service_role (worker) writes status; soft-delete is a service_role UPDATE.

create table if not exists public.assets (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.generation_jobs(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  kind            public.asset_kind not null,
  storage_bucket  text not null,
  storage_path    text not null,
  width           int,
  height          int,
  duration_ms     int,
  mime_type       text not null,
  size_bytes      bigint,
  created_at      timestamptz not null default now()
);

create index if not exists idx_assets_user_created on public.assets (user_id, created_at desc);
create index if not exists idx_assets_job on public.assets (job_id);

alter table public.assets enable row level security;

drop policy if exists "assets_select_own" on public.assets;
create policy "assets_select_own"
on public.assets for select
to authenticated
using (user_id = auth.uid());
-- Writes: no policy → service_role only.
