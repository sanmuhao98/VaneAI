-- Migration: 0008 — credit_ledger + daily_quota + balance sync
-- Source of truth: docs/04-data-model.md §credit_ledger, §daily_quota
-- profiles.credits_balance becomes a CACHE of the ledger: every balance change
-- goes through a ledger row; an AFTER INSERT trigger keeps the cache in sync.

create table if not exists public.credit_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  delta       int  not null,
  reason      text not null,                       -- 'generation_charge' / 'refund' / 'signup_bonus' / 'admin_grant'
  ref_job_id  uuid references public.generation_jobs(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_ledger_user_created on public.credit_ledger (user_id, created_at desc);

-- Refund idempotency backstop: at most ONE refund row per job, enforced by the DB
-- itself — Inngest retries and double-sends cannot double-refund.
create unique index if not exists uq_ledger_refund_once
  on public.credit_ledger (ref_job_id) where reason = 'refund';

alter table public.credit_ledger enable row level security;

drop policy if exists "ledger_select_own" on public.credit_ledger;
create policy "ledger_select_own"
on public.credit_ledger for select
to authenticated
using (user_id = auth.uid());
-- Writes: no policy → service_role only.

create table if not exists public.daily_quota (
  user_id  uuid not null references auth.users(id) on delete cascade,
  day      date not null,
  count    int  not null default 0,
  primary key (user_id, day)
);

alter table public.daily_quota enable row level security;

drop policy if exists "quota_select_own" on public.daily_quota;
create policy "quota_select_own"
on public.daily_quota for select
to authenticated
using (user_id = auth.uid());
-- Writes: no policy → service_role only.

-- Keep profiles.credits_balance in sync with the ledger. SECURITY DEFINER so the
-- profiles UPDATE succeeds regardless of the caller's RLS context; the
-- profiles_block_credits_update guard allows it (no JWT claims in trigger
-- context → trusted direct-connection path, or service_role via PostgREST).
create or replace function public.credit_ledger_sync_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set credits_balance = credits_balance + new.delta
   where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists credit_ledger_sync_balance on public.credit_ledger;
create trigger credit_ledger_sync_balance
after insert on public.credit_ledger
for each row execute function public.credit_ledger_sync_balance();

-- Signup bonus now flows through the ledger (single source of truth for balance).
-- Existing local/staging users keep their direct-set balance; no backfill needed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, credits_balance)
  values (new.id, 0);
  insert into public.credit_ledger (user_id, delta, reason)
  values (new.id, 100, 'signup_bonus');
  return new;
end;
$$;
