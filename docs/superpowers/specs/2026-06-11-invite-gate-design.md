# 内测邀请激活门 · 设计（2026-06-11）

> 决策已与产品确认：激活门（非注册门）/ 多次使用码 / 暂不做 admin 管理 UI。
> 对应 roadmap W5「邀请码或邀请链接（控制内测人数）」；ADR-019。

## 目标与边界

- **目标**：控制内测可用人数——注册不拦（Magic Link 与 Google OAuth 都照常），但进入 `(app)` 功能区前必须成功兑换一次邀请码。
- **下线方式**：环境变量 `INVITE_GATE` 控制；W6 公开 beta 置 `0`（或删除）即整门拆除，零迁移。
- **不做**：admin 邀请码管理 UI（SQL 插码）；邀请链接自动兑换；邀请人归因统计。

## 数据模型（migration 0011）

```sql
create table public.invite_codes (
  code       text primary key,                -- 统一存大写
  max_uses   int  not null default 1 check (max_uses > 0),
  used_count int  not null default 0,
  is_active  boolean not null default true,   -- 手动停用开关
  note       text,                            -- 运营备注（发给谁）
  expires_at timestamptz,                     -- null = 不过期
  created_at timestamptz not null default now()
);
-- RLS 开启且零策略：仅 service_role 可达（同 ADR-016 的服务端隔离思路）

alter table public.profiles
  add column invite_code text references public.invite_codes(code),
  add column invite_activated_at timestamptz;  -- null = 未过门
```

## 兑换 RPC：`redeem_invite_code(p_user_id, p_code)`

与 0009/0010 同一套原子化纪律（security definer + `FOR UPDATE`）：

1. 用户已激活 → 直接返回（幂等，不重复计数）。
2. `upper(trim(p_code))` 查码并 `FOR UPDATE`（串行化并发兑换）。
3. 不存在或 `is_active=false` → `invite_invalid`；过期 → `invite_expired`；`used_count >= max_uses` → `invite_exhausted`。
4. `used_count+1`，回填 `profiles.invite_code / invite_activated_at`。

执行权 service_role only——API 层认证后传 `p_user_id`（与生成 RPC 同模式）。

## 服务层与 API

- `lib/invites/errors.ts`：`InviteInvalidError / InviteExpiredError / InviteExhaustedError`。
- `lib/invites/redeem.ts`：admin client 调 RPC，错误串映射为上述异常。
- `lib/invites/gate.ts`：`inviteGateBlocks(gateEnv, activatedAt, isAdmin)` 纯函数（TDD）——门开启 && 未激活 && 非 admin。
- `POST /api/v1/invite/redeem`：body `{ code }`（trim 后 1–64 字）；映射 400 `invite_invalid` / `invite_expired` / `invite_exhausted`，成功 `{ ok: true }`。

## 门控 UI（`(app)/layout.tsx`）

- profile 查询加 `invite_activated_at`；`inviteGateBlocks(...)` 为真时**children 替换为兑码屏**（顶栏保留，路由切换也始终被门挡住）。
- admin 邮箱旁路（`isAdminEmail`）——运营自己不需要码。
- 兑码屏走设计系统 §8 编辑式空状态：serif 标语「本期凭码入场」+ 说明 + mono 单行输入 + 墨色主按钮（朱红仅留给生成动作）；错误贴字段下方 `aria-live="polite"`；成功后 `router.refresh()` 放行。

## 环境与种子

- `lib/env.ts`：`INVITE_GATE: z.enum(['0','1']).optional().default('0')`；`.env.example` 与 docs/03 同步。
- 本地 seed：`VANE-DEV`（max_uses 999）方便开发自测；生产码 SQL 手插（ADR-019 附操作示例）。

## 测试

- 单元：`inviteGateBlocks` 真值表。
- 集成（local supabase，沿用既有 RUN_DB_TESTS 模式）：兑换成功回填 profile 并 +1；重复兑换幂等不重复计数；超限 / 过期 / 无效码各自报错且不写入；并发安全由 `FOR UPDATE` 保证（不单测）。
- e2e 走查：开 `INVITE_GATE=1`，Mailpit 登录后访问 `/templates` 见兑码屏，兑 `VANE-DEV` 放行，截图。

## admin 顺带

`/admin/users` 列表加「激活」列（`invite_activated_at` 有值 ✓ / 码）。
