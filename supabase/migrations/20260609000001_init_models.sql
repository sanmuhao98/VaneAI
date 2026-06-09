-- Migration: 0002 — init models (config table)
-- Source of truth: docs/04-data-model.md §models

create type public.generation_type as enum ('text_to_image', 'image_to_video', 'text_to_video');

create table if not exists public.models (
  id              text primary key,
  display_name    text not null,
  type            public.generation_type not null,
  provider        text not null,
  provider_model  text not null,
  credits_cost    int  not null,
  is_active       bool not null default true,
  config          jsonb not null default '{}',
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.models enable row level security;

-- All logged-in users can read active models; writes are service_role only.
drop policy if exists "models_select_active" on public.models;
create policy "models_select_active"
on public.models for select
to authenticated
using (is_active = true);
