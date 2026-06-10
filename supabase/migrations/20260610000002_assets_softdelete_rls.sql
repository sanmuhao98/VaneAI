-- Migration: 0007 — assets visibility follows job soft-delete
-- generation_jobs SELECT already filters deleted_at; assets lagged behind (design
-- review 2026-06-10 leftover). Align so soft-deleting a job hides its assets too.

drop policy if exists "assets_select_own" on public.assets;
create policy "assets_select_own"
on public.assets for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.generation_jobs j
    where j.id = job_id and j.deleted_at is null
  )
);
