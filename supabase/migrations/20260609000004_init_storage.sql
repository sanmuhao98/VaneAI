-- Migration: 0005 — storage buckets + object RLS
-- Source of truth: docs/02-architecture.md §存储, docs/04-data-model.md, ADR-010
-- Resolves 02 vs 04 bucket inconsistency: use private `generations` + public `templates`.

insert into storage.buckets (id, name, public)
values ('generations', 'generations', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('templates', 'templates', true)
on conflict (id) do nothing;

-- templates bucket: public read (editor-curated reference/sample images).
drop policy if exists "templates_public_read" on storage.objects;
create policy "templates_public_read"
on storage.objects for select
to public
using (bucket_id = 'templates');

-- generations bucket: no authenticated read policy → private.
-- Reads happen via service_role-issued signed URLs; writes are service_role only.
-- (No policy needed; RLS default-denies anon/authenticated.)
