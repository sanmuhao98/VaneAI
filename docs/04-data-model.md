# 04 · 数据模型

> 所有表都启用 RLS。所有时间字段统一 `timestamptz`。

## ER 概览

```
auth.users (Supabase 内置)
    │
    │ 1:1
    ▼
profiles ─────────┐
    │             │
    │ 1:N         │ 1:N
    ▼             ▼
generation_jobs   credit_ledger
    │
    │ 1:N
    ▼
assets

daily_quota   (独立计数表，按 user_id + day)
```

## 表定义

### `profiles`

扩展 `auth.users`，存业务字段。

```sql
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  avatar_url      text,
  credits_balance int  not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 用户注册时通过 trigger 自动建 profile
create function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, credits_balance)
  values (new.id, 100);  -- 注册赠送 100 积分
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

**RLS**：
- SELECT：`id = auth.uid()`
- UPDATE：`id = auth.uid()`，且 `credits_balance` 列前端不可改（用 trigger 锁定，仅 service_role 可写）

---

### `generation_jobs` ★ 核心表

```sql
create type generation_type as enum ('text_to_image', 'image_to_video', 'text_to_video');
create type job_status     as enum ('pending', 'running', 'succeeded', 'failed', 'canceled');

create table public.generation_jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  type             generation_type not null,
  status           job_status      not null default 'pending',

  template_id      uuid references public.templates(id),  -- 复刻所用模板（自由生成时为空）
  provider         text not null,                 -- 'fal' / 'replicate'
  provider_job_id  text,                          -- 第三方 job id
  model            text not null,                 -- 'flux-pro' 等

  input            jsonb not null,                -- 复刻输入：keyword + 尺寸；拼接后的 prompt 不落库（ADR-016：jobs 行 owner 可经 RLS 读回，避免泄露 base_prompt 结构），服务端用 base_prompt+keyword 临时重拼
  output           jsonb,                         -- { assets: [...] }
  error            jsonb,                         -- { code, message, raw }

  credits_cost     int not null default 0,
  deleted_at       timestamptz,                   -- 软删

  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index idx_jobs_user_created on public.generation_jobs (user_id, created_at desc) where deleted_at is null;
create index idx_jobs_status_created on public.generation_jobs (status, created_at) where status in ('pending', 'running');
create index idx_jobs_provider_job on public.generation_jobs (provider, provider_job_id) where provider_job_id is not null;
```

**为什么 `type` 从第一天就有 enum**：图生视频/文生视频未来加值即可，业务代码无需重构。

**`input` jsonb 示例（text_to_image）**：
```json
{
  "keyword": "女骑士",
  "width": 1024,
  "height": 1024
}
```

**`output` jsonb 示例**：
```json
{
  "assets": [
    { "asset_id": "uuid", "width": 1024, "height": 1024 }
  ],
  "rawResponse": { /* provider 原始响应，调试用 */ }
}
```

**RLS**：
- SELECT：`user_id = auth.uid() and deleted_at is null`
- INSERT：`user_id = auth.uid()`
- UPDATE：仅 service_role（worker 写状态）
- DELETE：禁止（用 UPDATE deleted_at 软删）

---

### `assets`

生成产物。与 storage 解耦，方便迁移。

```sql
create type asset_kind as enum ('image', 'video', 'thumbnail');

create table public.assets (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.generation_jobs(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  kind            asset_kind not null,
  storage_bucket  text not null,                  -- 'generations'
  storage_path    text not null,                  -- '{user_id}/{job_id}/{filename}'
  width           int,
  height          int,
  duration_ms     int,                            -- 视频用
  mime_type       text not null,
  size_bytes      bigint,
  created_at      timestamptz not null default now()
);

create index idx_assets_user_created on public.assets (user_id, created_at desc);
create index idx_assets_job on public.assets (job_id);
```

**RLS**：
- SELECT：`user_id = auth.uid()`
- 写入：仅 service_role

---

### `credit_ledger`

积分变动流水（审计 + 排查）。

```sql
create table public.credit_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  delta       int  not null,                       -- 负数=扣，正数=加
  reason      text not null,                       -- 'generation_charge' / 'refund' / 'signup_bonus' / 'admin_grant'
  ref_job_id  uuid references public.generation_jobs(id),
  created_at  timestamptz not null default now()
);

create index idx_ledger_user_created on public.credit_ledger (user_id, created_at desc);
```

**约束**：`profiles.credits_balance` 是 ledger 的缓存。任何变动必走 ledger（trigger 同步更新 balance）。

**RLS**：
- SELECT：`user_id = auth.uid()`
- 写入：仅 service_role

---

### `daily_quota`

每用户每天免费次数计数。

```sql
create table public.daily_quota (
  user_id  uuid not null references auth.users(id) on delete cascade,
  day      date not null,
  count    int  not null default 0,
  primary key (user_id, day)
);
```

**RLS**：
- SELECT：`user_id = auth.uid()`
- 写入：仅 service_role

---

### `models`（配置表）

支持的模型清单，从 seed.sql 初始化，admin 可改。

```sql
create table public.models (
  id              text primary key,                -- 'fal-flux-pro'
  display_name    text not null,
  type            generation_type not null,
  provider        text not null,
  provider_model  text not null,                   -- fal.ai 上的 endpoint id
  credits_cost    int  not null,
  is_active       bool not null default true,
  config          jsonb not null default '{}',     -- 默认参数、最大尺寸等
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now()
);
```

**RLS**：
- SELECT：所有登录用户（`is_active = true`）
- 写入：仅 service_role

---

### `templates` ★ 复刻核心配置表（ADR-016）

编辑精选的爆款模板。`base_prompt` 等内部字段**仅服务端可读**，前端只读 `templates_public` 视图。

```sql
create table public.templates (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text unique not null,
  title                text not null,
  theme                text not null,             -- 'game_character' | 'blind_box'（起步双主题）
  reference_image_path text not null,             -- 'templates' bucket 内参考图 path
  sample_output_paths  text[] not null default '{}',  -- 示范产出 path 列表
  base_prompt          text not null,             -- ⚠️ 用户永不可见；可含 {subject} 占位
  negative_prompt      text,                      -- ⚠️ 用户永不可见
  model_id             text not null references public.models(id),
  recommended_width    int  not null default 1024,
  recommended_height   int  not null default 1024,
  credits_cost         int  not null default 1,
  keyword_placeholder  text,                      -- 主体关键词输入框占位/建议
  is_active            bool not null default true,
  sort_order           int  not null default 0,
  created_at           timestamptz not null default now()
);

create index idx_templates_active_sort on public.templates (theme, sort_order) where is_active;

-- 前端只读视图：安全列子集，绝不含 base_prompt / negative_prompt / model 内部参数
create view public.templates_public as
select id, slug, title, theme, reference_image_path, sample_output_paths,
       recommended_width, recommended_height, credits_cost, keyword_placeholder, sort_order
from public.templates
where is_active;
```

**RLS / 权限**：
- `templates` 基表：select / insert / update **仅 service_role**（admin 后台 + 服务端拼 prompt 走 admin client）。
- `templates_public` 视图：security definer（默认），`grant select to authenticated`；只暴露安全列。
- **拼 prompt**：服务端读基表 `base_prompt`，内插用户 `keyword`（有 `{subject}` 占位则替换，否则 `base_prompt + ", " + keyword`），结果写入 `generation_jobs.input`，不单独回前端。详见 [ADR-016](./09-decisions.md)。

---

## 关键业务流约束

### 创建任务（事务）

```
BEGIN;
  -- 1. 校验 daily_quota
  SELECT count FROM daily_quota WHERE user_id=$u AND day=current_date FOR UPDATE;
  IF count >= 10 → 拒绝;

  -- 2. 校验 credits_balance
  SELECT credits_balance FROM profiles WHERE id=$u FOR UPDATE;
  IF balance < cost → 拒绝;

  -- 3. 写 ledger（delta = -cost）
  INSERT INTO credit_ledger (user_id, delta, reason) VALUES ($u, -cost, 'generation_charge');
  -- trigger 自动更新 profiles.credits_balance

  -- 4. 计数 +1
  INSERT INTO daily_quota VALUES ($u, current_date, 1)
  ON CONFLICT (user_id, day) DO UPDATE SET count = daily_quota.count + 1;

  -- 5. 写 job (pending)
  INSERT INTO generation_jobs ... RETURNING id;
COMMIT;

-- 事务提交后发 Inngest event
```

### 任务失败回补

worker 标 `failed` 时触发 Inngest function `refund-on-failure`：
```
INSERT INTO credit_ledger (user_id, delta, reason, ref_job_id)
VALUES ($u, +cost, 'refund', $job_id);
```

### 软删清理

每天 cron Inngest function：
```
SELECT id, storage_path FROM assets
WHERE job_id IN (
  SELECT id FROM generation_jobs WHERE deleted_at < now() - interval '7 days'
);
-- 批量从 storage 删除
-- 然后 DELETE assets, DELETE generation_jobs (硬删)
```

## 索引策略

只建当前确定需要的：

| 索引 | 用途 |
|------|------|
| `idx_jobs_user_created` | 作品库列表（最高频） |
| `idx_jobs_status_created` | worker 找 pending/running 任务（监控用） |
| `idx_jobs_provider_job` | webhook 回查 |
| `idx_assets_user_created` | 资产列表 |
| `idx_assets_job` | 任务详情拉资产 |
| `idx_ledger_user_created` | 积分流水查询 |

## 未来扩展位（V2 视频）

- `generation_jobs.input` 加 `sourceImageUrl`、`durationSeconds`
- `assets.duration_ms` 已预留
- 新建 `models` 行 type=`image_to_video`
- 不需要新建表
