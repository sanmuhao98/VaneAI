-- Migration: 0011 — 内测邀请激活门（ADR-019）
-- 注册不拦；进入 (app) 前必须经 redeem_invite_code 兑换一次。
-- 门本身由应用层 INVITE_GATE 环境变量控制，本迁移只提供数据与原子兑换。

create table public.invite_codes (
  code       text primary key,
  max_uses   int  not null default 1 check (max_uses > 0),
  used_count int  not null default 0,
  is_active  boolean not null default true,
  note       text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS on + 零策略：仅 service_role 可达（码值不暴露给任何客户端角色）。
alter table public.invite_codes enable row level security;

alter table public.profiles
  add column invite_code text references public.invite_codes(code),
  add column invite_activated_at timestamptz;

-- 原子兑换：与 create_generation_job (0009) / create_t2i (0010) 同一套
-- security definer + FOR UPDATE 纪律。幂等：已激活用户直接返回，不重复计数。
create or replace function public.redeem_invite_code(
  p_user_id uuid,
  p_code    text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code      text := upper(trim(p_code));
  v_invite    record;
  v_activated timestamptz;
begin
  select invite_activated_at into v_activated
    from profiles where id = p_user_id
   for update;
  if not found then
    raise exception 'profile_not_found';
  end if;
  if v_activated is not null then
    return; -- 幂等：重复兑换不计数、不报错
  end if;

  select * into v_invite
    from invite_codes
   where code = v_code
   for update;
  if not found or not v_invite.is_active then
    raise exception 'invite_invalid';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'invite_expired';
  end if;
  if v_invite.used_count >= v_invite.max_uses then
    raise exception 'invite_exhausted';
  end if;

  update invite_codes set used_count = used_count + 1 where code = v_code;
  update profiles
     set invite_code = v_code, invite_activated_at = now()
   where id = p_user_id;
end;
$$;

-- service_role only — API 层认证用户后传 p_user_id（同生成 RPC 模式）。
revoke execute on function public.redeem_invite_code(uuid, text) from public;
revoke execute on function public.redeem_invite_code(uuid, text) from anon;
revoke execute on function public.redeem_invite_code(uuid, text) from authenticated;
