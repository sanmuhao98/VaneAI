-- Migration: 0003 — init templates + public safe view
-- Source of truth: docs/04-data-model.md §templates, docs/09-decisions.md ADR-016

create table if not exists public.templates (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text unique not null,
  title                text not null,
  theme                text not null,
  reference_image_path text not null,
  sample_output_paths  text[] not null default '{}',
  base_prompt          text not null,             -- 用户永不可见
  negative_prompt      text,                      -- 用户永不可见
  model_id             text not null references public.models(id),
  recommended_width    int  not null default 1024,
  recommended_height   int  not null default 1024,
  credits_cost         int  not null default 1,
  keyword_placeholder  text,
  is_active            bool not null default true,
  sort_order           int  not null default 0,
  created_at           timestamptz not null default now()
);

create index if not exists idx_templates_active_sort
  on public.templates (theme, sort_order) where is_active;

-- Base table: RLS on, NO policy for authenticated → only service_role (bypasses RLS) can read/write.
alter table public.templates enable row level security;

-- Frontend-readable safe view: excludes base_prompt / negative_prompt / model internals.
-- Security definer (default) so authenticated users read it despite base-table RLS denying them.
create or replace view public.templates_public as
select id, slug, title, theme, reference_image_path, sample_output_paths,
       recommended_width, recommended_height, credits_cost, keyword_placeholder, sort_order
from public.templates
where is_active;

grant select on public.templates_public to authenticated;
