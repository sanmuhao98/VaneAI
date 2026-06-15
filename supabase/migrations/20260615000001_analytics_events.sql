-- Migration: 0012 — analytics_events（产品埋点事件汇）
-- Source: 07-roadmap W5「关键指标埋点」+ 01-mvp-scope 验收 #10
-- 决策：埋点落 Supabase 事件表（ADR-009「用 Postgres」一脉），admin 直读，
-- 不向 authenticated 暴露——写/读均 service_role only（无 RLS policy）。

create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  event       text not null,                       -- 'signup' / 'generation_created' / 'generation_succeeded' / 'generation_failed' / 'generation_canceled' / 'job_deleted' / 'replicate_again'
  user_id     uuid references auth.users(id) on delete set null,
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- 时间序（最近事件）与按事件名聚合（漏斗/计数）两类查询。
create index if not exists idx_events_created on public.analytics_events (created_at desc);
create index if not exists idx_events_event_created on public.analytics_events (event, created_at desc);

alter table public.analytics_events enable row level security;
-- 无 policy → 仅 service_role（admin client）可读写。产品埋点是 admin-only，
-- 永不下发 authenticated 客户端（与 credit_ledger 写侧同纪律）。

-- 注册埋点：在 handle_new_user 内一并写入——覆盖 Magic Link 与 Google OAuth 两条注册路径
-- （都经 auth.users insert 触发），比在回调里埋更可靠。security definer 已具备写权限。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, credits_balance)
  values (new.id, 100);
  insert into public.analytics_events (event, user_id, props)
  values (
    'signup',
    new.id,
    jsonb_build_object('provider', coalesce(new.raw_app_meta_data->>'provider', 'email'))
  );
  return new;
end;
$$;
