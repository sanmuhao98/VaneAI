-- Migration: 0001 — init profiles
-- Source of truth: docs/04-data-model.md §profiles
-- Mirrors ADR-008 (RLS as default access control).

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  avatar_url      text,
  credits_balance int  not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-create a profile (with 100-credit signup bonus) for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, credits_balance)
  values (new.id, 100);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep updated_at fresh on every UPDATE.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

-- RLS — owner reads own row; owner updates own row but not credits_balance.
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles
for select
using (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

-- Lock credits_balance from client-side mutation. Only service_role bypasses RLS,
-- so any UPDATE arriving via anon/authenticated cannot change credits_balance.
create or replace function public.profiles_block_credits_update()
returns trigger
language plpgsql
as $$
begin
  if (current_setting('request.jwt.claim.role', true) is distinct from 'service_role')
     and new.credits_balance is distinct from old.credits_balance then
    raise exception 'credits_balance is read-only via API; route through credit_ledger';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_credits_update on public.profiles;
create trigger profiles_block_credits_update
before update on public.profiles
for each row execute function public.profiles_block_credits_update();
