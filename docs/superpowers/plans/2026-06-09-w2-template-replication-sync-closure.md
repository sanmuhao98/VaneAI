# W2 同步模板复刻闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 登录用户从模板库选 1 个模板、输入主体关键词（≤60 字），服务端同步拼 prompt → 调 provider（本轮 mock）出图 → 存 Supabase Storage → 前端看到图并下载，全程不暴露 prompt。

**Architecture:** 方案 A —— 整条流水抽成 `lib/generation/run.ts` 服务函数，W2 由 `app/api/v1/generations/route.ts` 同步 `await` 调用；W3 异步化时改由 Inngest function 调用同一函数，业务不重写。所有特权写（读 base_prompt、写 job/assets、传 storage）走 admin（service_role）client（ADR-008）；`base_prompt`/`negative_prompt` 仅服务端可读，前端只读 `templates_public` 视图（ADR-016）。Provider 经 `resolveProvider` 路由：`fal` 且无 `FAL_API_KEY` 时回落 mock。

**Tech Stack:** Next.js 16 (App Router) · TypeScript strict · Supabase (Postgres + Storage, RLS) · zod v4 · vitest（本计划新引入）· Tailwind v4。

**对齐 spec:** `docs/superpowers/specs/2026-06-09-w2-template-replication-sync-closure-design.md`

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `vitest.config.ts` / `vitest.setup.ts` | 测试 runner 配置 + env 占位 |
| `package.json` / `.github/workflows/ci.yml` | 加 vitest 依赖 + `pnpm test` |
| `supabase/migrations/20260609000001_init_models.sql` | `models` 表 + RLS |
| `supabase/migrations/20260609000002_init_templates.sql` | `templates` 表 + `templates_public` 视图（ADR-016）|
| `supabase/migrations/20260609000003_init_jobs_assets.sql` | enum + `generation_jobs` + `assets` + 索引 + RLS |
| `supabase/migrations/20260609000004_init_storage.sql` | 建 `generations`/`templates` 桶 + storage.objects RLS |
| `supabase/config.toml` | 本地桶声明（`templates` 带 `objects_path` 种子图）|
| `supabase/storage/templates/*.svg` | 模板参考图/示范图占位（db reset 自动上传）|
| `supabase/seed.sql` | `models` + `templates` 种子行 |
| `lib/providers/types.ts` | Provider 接口 + 数据类型 |
| `lib/providers/mock.ts` | mock provider（生成 SVG 占位图，不渲染 prompt）|
| `lib/providers/fal.ts` | 真实 fal provider（本轮不活测）|
| `lib/providers/index.ts` | `resolveProvider` 路由 |
| `lib/providers/index.test.ts` / `mock.test.ts` | 单测 |
| `lib/generation/prompt.ts` / `prompt.test.ts` | `assemblePrompt` 纯函数 + 单测 |
| `lib/generation/errors.ts` | 分类错误 |
| `lib/generation/run.ts` | `runGeneration` 服务函数 |
| `lib/storage/upload.ts` | 上传 + 签名 URL |
| `app/api/v1/generations/route.ts` | 同步 API |
| `app/(app)/templates/page.tsx` | 模板列表 + 主题筛选 |
| `app/(app)/templates/[slug]/page.tsx` | 模板详情 |
| `app/(app)/templates/[slug]/_components/ReplicateForm.tsx` | 关键词输入 + 结果展示（client）|
| `app/(app)/dashboard/page.tsx` | 加入口链接到 `/templates` |
| `docs/CHANGELOG.md` / `docs/07-roadmap.md` | 文档同步 |

---

## Task 1: 引入 vitest 测试基建

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: 装 vitest（dev 依赖）**

Run:
```bash
pnpm add -D vitest@^3
```
Expected: `package.json` devDependencies 出现 `vitest`，lockfile 更新。

- [ ] **Step 2: 加 test 脚本到 package.json**

在 `package.json` `"scripts"` 中加一行（放在 `"typecheck"` 之后）：
```json
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
```

- [ ] **Step 3: 写 `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
})
```

- [ ] **Step 4: 写 `vitest.setup.ts`**

`lib/env.ts` 在模块加载时即解析 `serverEnv`，测试环境需提供占位，避免 import 抛错：
```ts
// Provide placeholder env so lib/env.ts passes Zod validation when imported under vitest.
process.env.NEXT_PUBLIC_SITE_URL ??= 'http://localhost:3000'
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'
```

- [ ] **Step 5: CI 加 test 步骤**

在 `.github/workflows/ci.yml` 的 `Typecheck`（即 `pnpm typecheck` 那步，名为 `Lint` 之后的最后一步）后追加：
```yaml
      - name: Test
        run: pnpm test
```
注意 CI 的 `env:` 块已提供 Supabase 占位变量，vitest 直接复用。

- [ ] **Step 6: 占位测试验证基建可跑**

临时创建 `vitest.smoke.test.ts`：
```ts
import { expect, test } from 'vitest'
test('vitest runs', () => { expect(1 + 1).toBe(2) })
```
Run: `pnpm test`
Expected: PASS（1 passed）。通过后删除该文件：`rm vitest.smoke.test.ts`

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts vitest.setup.ts .github/workflows/ci.yml
git commit -m "chore: 引入 vitest 测试基建 + CI test 步骤"
```

---

## Task 2: `models` 表 migration

**Files:**
- Create: `supabase/migrations/20260609000001_init_models.sql`

- [ ] **Step 1: 写 migration**

```sql
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
```

- [ ] **Step 2: 应用并验证**

Run: `supabase db reset`
Expected: 无报错；migration 0002 应用成功。
Run: `supabase db reset` 后 `psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -c "\d public.models"`（或在 Studio http://127.0.0.1:54323 确认表存在）
Expected: 表 `public.models` 含上述列。

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260609000001_init_models.sql
git commit -m "feat: models 配置表 migration + RLS"
```

---

## Task 3: `templates` 表 + `templates_public` 视图 migration（ADR-016）

**Files:**
- Create: `supabase/migrations/20260609000002_init_templates.sql`

- [ ] **Step 1: 写 migration**

> 关键：基表 RLS 不放行 authenticated（仅 service_role 可读写）；`templates_public` 视图为 **security definer（默认，不设 `security_invoker`）**，属主 postgres，授予 authenticated select，只暴露安全列。Supabase linter 会对 definer view 报 warning，这是 ADR-016 刻意为之。

```sql
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
```

- [ ] **Step 2: 应用并验证安全视图隔离**

Run: `supabase db reset`
Expected: 无报错。
验证视图不含 base_prompt（在 Studio SQL editor 或 psql 跑）：
```sql
select column_name from information_schema.columns where table_name = 'templates_public';
```
Expected: 列集为 id/slug/title/theme/reference_image_path/sample_output_paths/recommended_width/recommended_height/credits_cost/keyword_placeholder/sort_order —— **无 base_prompt / negative_prompt**。

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260609000002_init_templates.sql
git commit -m "feat: templates 表 + templates_public 安全视图 (ADR-016)"
```

---

## Task 4: `generation_jobs` + `assets` migration

**Files:**
- Create: `supabase/migrations/20260609000003_init_jobs_assets.sql`

- [ ] **Step 1: 写 migration**

```sql
-- Migration: 0004 — init generation_jobs + assets
-- Source of truth: docs/04-data-model.md §generation_jobs, §assets

create type public.job_status  as enum ('pending', 'running', 'succeeded', 'failed', 'canceled');
create type public.asset_kind  as enum ('image', 'video', 'thumbnail');

create table if not exists public.generation_jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  type             public.generation_type not null,
  status           public.job_status not null default 'pending',
  template_id      uuid references public.templates(id),
  provider         text not null,
  provider_job_id  text,
  model            text not null,
  input            jsonb not null,
  output           jsonb,
  error            jsonb,
  credits_cost     int not null default 0,
  deleted_at       timestamptz,
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_jobs_user_created
  on public.generation_jobs (user_id, created_at desc) where deleted_at is null;
create index if not exists idx_jobs_status_created
  on public.generation_jobs (status, created_at) where status in ('pending', 'running');
create index if not exists idx_jobs_provider_job
  on public.generation_jobs (provider, provider_job_id) where provider_job_id is not null;

alter table public.generation_jobs enable row level security;

drop policy if exists "jobs_select_own" on public.generation_jobs;
create policy "jobs_select_own"
on public.generation_jobs for select
to authenticated
using (user_id = auth.uid() and deleted_at is null);

drop policy if exists "jobs_insert_own" on public.generation_jobs;
create policy "jobs_insert_own"
on public.generation_jobs for insert
to authenticated
with check (user_id = auth.uid());
-- UPDATE/DELETE: no policy → only service_role (worker) writes status; soft-delete is a service_role UPDATE.

create table if not exists public.assets (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.generation_jobs(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  kind            public.asset_kind not null,
  storage_bucket  text not null,
  storage_path    text not null,
  width           int,
  height          int,
  duration_ms     int,
  mime_type       text not null,
  size_bytes      bigint,
  created_at      timestamptz not null default now()
);

create index if not exists idx_assets_user_created on public.assets (user_id, created_at desc);
create index if not exists idx_assets_job on public.assets (job_id);

alter table public.assets enable row level security;

drop policy if exists "assets_select_own" on public.assets;
create policy "assets_select_own"
on public.assets for select
to authenticated
using (user_id = auth.uid());
-- Writes: no policy → service_role only.
```

- [ ] **Step 2: 应用并验证**

Run: `supabase db reset`
Expected: 无报错；4 个 migration 全部应用。在 Studio 确认 `generation_jobs`、`assets` 表与索引存在。

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260609000003_init_jobs_assets.sql
git commit -m "feat: generation_jobs + assets 表 + 索引 + RLS"
```

---

## Task 5: Storage 桶 migration + 本地 config + 种子图

**Files:**
- Create: `supabase/migrations/20260609000004_init_storage.sql`
- Modify: `supabase/config.toml`
- Create: `supabase/storage/templates/game-hero.svg`
- Create: `supabase/storage/templates/blind-box.svg`

- [ ] **Step 1: 写 storage migration（prod 可复现建桶 + RLS）**

```sql
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
```

- [ ] **Step 2: 本地 config.toml 声明桶（含 templates 种子图路径）**

在 `supabase/config.toml` 的 `[storage]` 块下、被注释的 `# [storage.buckets.images]` 示例**附近**追加：
```toml
[storage.buckets.generations]
public = false
file_size_limit = "50MiB"
allowed_mime_types = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]

[storage.buckets.templates]
public = true
file_size_limit = "10MiB"
allowed_mime_types = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
objects_path = "./storage/templates"
```

- [ ] **Step 3: 建两张占位 SVG 种子图**

`supabase/storage/templates/game-hero.svg`：
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#6d5dfc"/>
  <text x="512" y="512" font-family="sans-serif" font-size="48" fill="#fff" text-anchor="middle">game hero</text>
</svg>
```

`supabase/storage/templates/blind-box.svg`：
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#fc6d8d"/>
  <text x="512" y="512" font-family="sans-serif" font-size="48" fill="#fff" text-anchor="middle">blind box</text>
</svg>
```

- [ ] **Step 4: 应用并验证桶 + 种子图上传**

Run: `supabase db reset`
Expected: 无报错。打开 Studio Storage（http://127.0.0.1:54323）→ `templates` 桶含 `game-hero.svg`、`blind-box.svg`；`generations` 桶存在且为 private。
浏览器访问 `http://127.0.0.1:54321/storage/v1/object/public/templates/game-hero.svg`
Expected: 显示紫色占位图。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260609000004_init_storage.sql supabase/config.toml supabase/storage/templates/
git commit -m "feat: storage 桶 (generations 私有/templates 公开) + 种子图"
```

---

## Task 6: seed 数据（models + templates）

**Files:**
- Modify: `supabase/seed.sql`

- [ ] **Step 1: 写 seed**

替换 `supabase/seed.sql` 全文：
```sql
-- Seed data — local + staging only. Production seeds are forbidden (docs/03-environments.md).

-- Models
insert into public.models (id, display_name, type, provider, provider_model, credits_cost, config, sort_order)
values
  ('fal-flux-schnell', 'FLUX schnell', 'text_to_image', 'fal', 'fal-ai/flux/schnell', 1,
   '{"default_width":1024,"default_height":1024}', 0)
on conflict (id) do nothing;

-- Templates (base_prompt 含 {subject} 占位；用户永不可见)
insert into public.templates
  (slug, title, theme, reference_image_path, sample_output_paths, base_prompt, negative_prompt,
   model_id, recommended_width, recommended_height, credits_cost, keyword_placeholder, sort_order)
values
  ('game-hero', '游戏角色概念图', 'game_character', 'game-hero.svg', array['game-hero.svg'],
   'concept art of {subject}, heroic fantasy game character, dramatic rim lighting, highly detailed, artstation trending',
   'blurry, low quality, watermark, text',
   'fal-flux-schnell', 1024, 1024, 1, '例如：手持长剑的女骑士', 0),
  ('blind-box', '盲盒手办风', 'blind_box', 'blind-box.svg', array['blind-box.svg'],
   'cute chibi blind box figure of {subject}, soft pastel colors, studio product photo, 3d render, clean background',
   'blurry, low quality, watermark, text',
   'fal-flux-schnell', 1024, 1024, 1, '例如：戴帽子的柴犬', 1)
on conflict (slug) do nothing;
```

- [ ] **Step 2: 应用并验证**

Run: `supabase db reset`
Expected: 无报错。在 Studio SQL editor 跑 `select slug, theme, model_id from public.templates;`
Expected: 2 行（game-hero / blind-box）。

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat: seed flux-schnell 模型 + 双主题模板"
```

---

## Task 7: Provider 类型 + mock（TDD）

**Files:**
- Create: `lib/providers/types.ts`
- Create: `lib/providers/mock.ts`
- Create: `lib/providers/mock.test.ts`

- [ ] **Step 1: 写 Provider 类型**

`lib/providers/types.ts`：
```ts
export type GenerationType = 'text_to_image' | 'image_to_video' | 'text_to_video'

export type GenerationParams = {
  prompt: string
  negativePrompt?: string
  model: string // provider_model id, e.g. 'fal-ai/flux/schnell'
  width?: number
  height?: number
  seed?: number
  numImages?: number
  // video future: durationSeconds, fps, sourceImageUrl
}

export type ProviderImage = {
  url?: string
  bytes?: Uint8Array
  contentType: string
  width: number
  height: number
}

export type ProviderResult = {
  status: 'succeeded' | 'failed'
  images: ProviderImage[]
  raw?: unknown
}

export interface GenerationProvider {
  readonly name: string
  readonly supportedTypes: GenerationType[]
  // MVP (ADR-005): provider call is synchronous inside the worker; frontend polls the JOB.
  generate(params: GenerationParams): Promise<ProviderResult>
}
```

- [ ] **Step 2: 写 mock 的失败测试**

`lib/providers/mock.test.ts`：
```ts
import { describe, expect, test } from 'vitest'
import { mockProvider } from './mock'

describe('mockProvider', () => {
  test('returns one svg image with requested dimensions', async () => {
    const res = await mockProvider.generate({ prompt: 'secret base prompt', model: 'm', width: 512, height: 768 })
    expect(res.status).toBe('succeeded')
    expect(res.images).toHaveLength(1)
    expect(res.images[0].contentType).toBe('image/svg+xml')
    expect(res.images[0].width).toBe(512)
    expect(res.images[0].height).toBe(768)
    expect(res.images[0].bytes).toBeInstanceOf(Uint8Array)
  })

  test('output svg never embeds the prompt text (ADR-016)', async () => {
    const res = await mockProvider.generate({ prompt: 'TOP_SECRET_PROMPT', model: 'm' })
    const svg = new TextDecoder().decode(res.images[0].bytes!)
    expect(svg).not.toContain('TOP_SECRET_PROMPT')
  })
})
```

- [ ] **Step 3: 运行验证失败**

Run: `pnpm test lib/providers/mock.test.ts`
Expected: FAIL（`Cannot find module './mock'`）。

- [ ] **Step 4: 实现 mock**

`lib/providers/mock.ts`：
```ts
import type { GenerationParams, GenerationProvider, ProviderResult } from './types'

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Colored gradient placeholder. Seeded by prompt hash for variety, but the prompt
// text is NEVER written into the output (ADR-016).
function placeholderSvg(width: number, height: number, seed: number): string {
  const hue = seed % 360
  const hue2 = (hue + 40) % 360
  const r = Math.min(width, height) / 4
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${hue} 70% 60%)"/><stop offset="100%" stop-color="hsl(${hue2} 70% 45%)"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/><circle cx="${width / 2}" cy="${height / 2}" r="${r}" fill="white" fill-opacity="0.25"/></svg>`
}

export const mockProvider: GenerationProvider = {
  name: 'mock',
  supportedTypes: ['text_to_image'],
  async generate(params: GenerationParams): Promise<ProviderResult> {
    const width = params.width ?? 1024
    const height = params.height ?? 1024
    const seed = params.seed ?? hashString(params.prompt)
    const svg = placeholderSvg(width, height, seed)
    return {
      status: 'succeeded',
      images: [{ bytes: new TextEncoder().encode(svg), contentType: 'image/svg+xml', width, height }],
      raw: { provider: 'mock' },
    }
  },
}
```

- [ ] **Step 5: 运行验证通过**

Run: `pnpm test lib/providers/mock.test.ts`
Expected: PASS（2 passed）。

- [ ] **Step 6: Commit**

```bash
git add lib/providers/types.ts lib/providers/mock.ts lib/providers/mock.test.ts
git commit -m "feat: provider 类型 + mock provider (TDD)"
```

---

## Task 8: fal provider + resolveProvider 路由（TDD）

**Files:**
- Create: `lib/providers/fal.ts`
- Create: `lib/providers/index.ts`
- Create: `lib/providers/index.test.ts`

- [ ] **Step 1: 实现 fal provider（本轮不活测）**

`lib/providers/fal.ts`：
```ts
import { serverEnv } from '@/lib/env'
import type { GenerationParams, GenerationProvider, ProviderResult } from './types'

// fal.ai synchronous endpoint. flux-schnell P50 < 5s fits the sync MVP path.
// Not exercised in W2 (mock fallback); becomes live once FAL_API_KEY is set.
export const falProvider: GenerationProvider = {
  name: 'fal',
  supportedTypes: ['text_to_image'],
  async generate(params: GenerationParams): Promise<ProviderResult> {
    const key = serverEnv.FAL_API_KEY
    if (!key) throw new Error('FAL_API_KEY is not set')

    const res = await fetch(`https://fal.run/${params.model}`, {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        image_size: { width: params.width ?? 1024, height: params.height ?? 1024 },
        num_images: params.numImages ?? 1,
        ...(params.seed !== undefined ? { seed: params.seed } : {}),
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      return { status: 'failed', images: [], raw: { status: res.status, body: text } }
    }
    const data = (await res.json()) as {
      images?: { url: string; width?: number; height?: number; content_type?: string }[]
    }
    const images = (data.images ?? []).map((img) => ({
      url: img.url,
      contentType: img.content_type ?? 'image/jpeg',
      width: img.width ?? params.width ?? 1024,
      height: img.height ?? params.height ?? 1024,
    }))
    return { status: images.length > 0 ? 'succeeded' : 'failed', images, raw: data }
  },
}
```

- [ ] **Step 2: 写 resolveProvider 失败测试**

`lib/providers/index.test.ts`：
```ts
import { describe, expect, test } from 'vitest'
import { resolveProvider } from './index'

describe('resolveProvider', () => {
  test('fal + key → fal provider', () => {
    expect(resolveProvider('fal', 'some-key').name).toBe('fal')
  })
  test('fal + no key → mock fallback', () => {
    expect(resolveProvider('fal', undefined).name).toBe('mock')
  })
  test('mock → mock', () => {
    expect(resolveProvider('mock').name).toBe('mock')
  })
  test('unknown → throws', () => {
    expect(() => resolveProvider('nope')).toThrow(/unknown provider/)
  })
})
```

- [ ] **Step 3: 运行验证失败**

Run: `pnpm test lib/providers/index.test.ts`
Expected: FAIL（`Cannot find module './index'`）。

- [ ] **Step 4: 实现 resolveProvider**

> 注意：不要在本文件 import `'server-only'` —— `serverEnv` 的 Proxy 守卫已防客户端误用，且 `server-only` 会让 vitest import 抛错。`falApiKey` 默认取 `serverEnv.FAL_API_KEY`，但允许显式传入以便单测。

`lib/providers/index.ts`：
```ts
import { serverEnv } from '@/lib/env'
import { falProvider } from './fal'
import { mockProvider } from './mock'
import type { GenerationProvider } from './types'

export function resolveProvider(
  providerName: string,
  falApiKey: string | undefined = serverEnv.FAL_API_KEY,
): GenerationProvider {
  switch (providerName) {
    case 'fal':
      if (falApiKey) return falProvider
      console.warn('[providers] FAL_API_KEY not set — falling back to mock provider')
      return mockProvider
    case 'mock':
      return mockProvider
    default:
      throw new Error(`unknown provider: ${providerName}`)
  }
}
```

- [ ] **Step 5: 运行验证通过**

Run: `pnpm test lib/providers/index.test.ts`
Expected: PASS（4 passed）。

- [ ] **Step 6: Commit**

```bash
git add lib/providers/fal.ts lib/providers/index.ts lib/providers/index.test.ts
git commit -m "feat: fal provider + resolveProvider 路由 (TDD)"
```

---

## Task 9: `assemblePrompt` 纯函数（TDD）

**Files:**
- Create: `lib/generation/prompt.ts`
- Create: `lib/generation/prompt.test.ts`

- [ ] **Step 1: 写失败测试**

`lib/generation/prompt.test.ts`：
```ts
import { describe, expect, test } from 'vitest'
import { assemblePrompt } from './prompt'

describe('assemblePrompt', () => {
  test('replaces {subject} placeholder', () => {
    expect(assemblePrompt('concept art of {subject}, detailed', '女骑士'))
      .toBe('concept art of 女骑士, detailed')
  })
  test('replaces every {subject} occurrence', () => {
    expect(assemblePrompt('{subject} as a {subject} hero', 'cat'))
      .toBe('cat as a cat hero')
  })
  test('appends keyword when no placeholder', () => {
    expect(assemblePrompt('cyberpunk poster', '柴犬'))
      .toBe('cyberpunk poster, 柴犬')
  })
})
```

- [ ] **Step 2: 运行验证失败**

Run: `pnpm test lib/generation/prompt.test.ts`
Expected: FAIL（`Cannot find module './prompt'`）。

- [ ] **Step 3: 实现**

`lib/generation/prompt.ts`：
```ts
// Assembles the final prompt from a template's (server-only) base_prompt and the user's keyword.
// {subject} placeholder → replaced; otherwise keyword is appended. Never returned to the client.
export function assemblePrompt(basePrompt: string, keyword: string): string {
  if (basePrompt.includes('{subject}')) {
    return basePrompt.replaceAll('{subject}', keyword)
  }
  return `${basePrompt}, ${keyword}`
}
```

- [ ] **Step 4: 运行验证通过**

Run: `pnpm test lib/generation/prompt.test.ts`
Expected: PASS（3 passed）。

- [ ] **Step 5: Commit**

```bash
git add lib/generation/prompt.ts lib/generation/prompt.test.ts
git commit -m "feat: assemblePrompt 纯函数 (TDD)"
```

---

## Task 10: 分类错误 + storage 上传层

**Files:**
- Create: `lib/generation/errors.ts`
- Create: `lib/storage/upload.ts`

- [ ] **Step 1: 写错误类型**

`lib/generation/errors.ts`：
```ts
export class TemplateNotFoundError extends Error {
  constructor(templateId: string) {
    super(`template not found or inactive: ${templateId}`)
    this.name = 'TemplateNotFoundError'
  }
}

export class ProviderError extends Error {
  raw?: unknown
  constructor(message: string, raw?: unknown) {
    super(message)
    this.name = 'ProviderError'
    this.raw = raw
  }
}
```

- [ ] **Step 2: 写 storage 上传层**

`lib/storage/upload.ts`：
```ts
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ProviderImage } from '@/lib/providers/types'

const GENERATIONS_BUCKET = 'generations'

function extFromMime(mime: string): string {
  if (mime.includes('svg')) return 'svg'
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  return 'jpg'
}

export type UploadedImage = {
  bucket: string
  storagePath: string
  sizeBytes: number
  mimeType: string
  width: number
  height: number
}

export async function uploadGenerationImage(args: {
  userId: string
  jobId: string
  image: ProviderImage
}): Promise<UploadedImage> {
  const { userId, jobId, image } = args
  let bytes: Uint8Array
  if (image.bytes) {
    bytes = image.bytes
  } else if (image.url) {
    const res = await fetch(image.url)
    if (!res.ok) throw new Error(`image download failed: ${res.status}`)
    bytes = new Uint8Array(await res.arrayBuffer())
  } else {
    throw new Error('image has neither bytes nor url')
  }

  const ext = extFromMime(image.contentType)
  const storagePath = `${userId}/${jobId}/image.${ext}`
  const admin = createAdminClient()
  const { error } = await admin.storage
    .from(GENERATIONS_BUCKET)
    .upload(storagePath, new Blob([bytes], { type: image.contentType }), {
      contentType: image.contentType,
      upsert: true,
    })
  if (error) throw error

  return {
    bucket: GENERATIONS_BUCKET,
    storagePath,
    sizeBytes: bytes.byteLength,
    mimeType: image.contentType,
    width: image.width,
    height: image.height,
  }
}

export async function createSignedUrl(bucket: string, path: string, ttlSeconds = 3600): Promise<string> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, ttlSeconds)
  if (error) throw error
  return data.signedUrl
}
```

- [ ] **Step 3: typecheck**

Run: `pnpm typecheck`
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add lib/generation/errors.ts lib/storage/upload.ts
git commit -m "feat: 分类错误 + storage 上传/签名 URL 层"
```

---

## Task 11: `runGeneration` 服务函数

**Files:**
- Create: `lib/generation/run.ts`

- [ ] **Step 1: 实现服务函数**

`lib/generation/run.ts`：
```ts
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveProvider } from '@/lib/providers'
import { createSignedUrl, uploadGenerationImage } from '@/lib/storage/upload'
import { assemblePrompt } from './prompt'
import { ProviderError, TemplateNotFoundError } from './errors'

export type RunGenerationInput = { userId: string; templateId: string; keyword: string }
export type RunGenerationResult = {
  jobId: string
  status: 'succeeded'
  assets: { signedUrl: string; width: number; height: number }[]
}

// Full sync replication pipeline (Approach A). W3 will call this from an Inngest function instead.
export async function runGeneration(input: RunGenerationInput): Promise<RunGenerationResult> {
  const admin = createAdminClient()

  // 1. Read template base row (service_role only — holds base_prompt). ADR-016.
  const { data: template, error: tErr } = await admin
    .from('templates')
    .select(
      'id, base_prompt, negative_prompt, model_id, recommended_width, recommended_height, credits_cost, is_active',
    )
    .eq('id', input.templateId)
    .maybeSingle()
  if (tErr) throw tErr
  if (!template || !template.is_active) throw new TemplateNotFoundError(input.templateId)

  const { data: model, error: mErr } = await admin
    .from('models')
    .select('id, provider, provider_model, type')
    .eq('id', template.model_id)
    .single()
  if (mErr) throw mErr

  const prompt = assemblePrompt(template.base_prompt, input.keyword)

  // 2. Insert job (pending). input.prompt is stored but NEVER returned to the client.
  const { data: job, error: jErr } = await admin
    .from('generation_jobs')
    .insert({
      user_id: input.userId,
      type: model.type,
      status: 'pending',
      template_id: template.id,
      provider: model.provider,
      model: model.id,
      input: {
        keyword: input.keyword,
        prompt,
        width: template.recommended_width,
        height: template.recommended_height,
      },
      credits_cost: template.credits_cost,
    })
    .select('id')
    .single()
  if (jErr) throw jErr
  const jobId = job.id as string

  try {
    // 3. mark running
    await admin
      .from('generation_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId)

    // 4. provider
    const provider = resolveProvider(model.provider)
    const result = await provider.generate({
      prompt,
      negativePrompt: template.negative_prompt ?? undefined,
      model: model.provider_model,
      width: template.recommended_width,
      height: template.recommended_height,
      numImages: 1,
    })
    if (result.status !== 'succeeded' || result.images.length === 0) {
      throw new ProviderError('provider returned no images', result.raw)
    }

    // 5. upload + assets
    const assets: { signedUrl: string; width: number; height: number; assetId: string }[] = []
    for (const img of result.images) {
      const uploaded = await uploadGenerationImage({ userId: input.userId, jobId, image: img })
      const { data: asset, error: aErr } = await admin
        .from('assets')
        .insert({
          job_id: jobId,
          user_id: input.userId,
          kind: 'image',
          storage_bucket: uploaded.bucket,
          storage_path: uploaded.storagePath,
          width: uploaded.width,
          height: uploaded.height,
          mime_type: uploaded.mimeType,
          size_bytes: uploaded.sizeBytes,
        })
        .select('id')
        .single()
      if (aErr) throw aErr
      const signedUrl = await createSignedUrl(uploaded.bucket, uploaded.storagePath)
      assets.push({ assetId: asset.id as string, signedUrl, width: uploaded.width, height: uploaded.height })
    }

    // 6. succeeded
    await admin
      .from('generation_jobs')
      .update({
        status: 'succeeded',
        output: { assets: assets.map((a) => ({ asset_id: a.assetId, width: a.width, height: a.height })) },
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    return {
      jobId,
      status: 'succeeded',
      assets: assets.map((a) => ({ signedUrl: a.signedUrl, width: a.width, height: a.height })),
    }
  } catch (err) {
    await admin
      .from('generation_jobs')
      .update({
        status: 'failed',
        error: {
          code: err instanceof ProviderError ? 'provider_error' : 'internal_error',
          message: err instanceof Error ? err.message : String(err),
        },
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId)
    throw err
  }
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add lib/generation/run.ts
git commit -m "feat: runGeneration 同步复刻服务函数 (方案 A)"
```

---

## Task 12: 同步 API route

**Files:**
- Create: `app/api/v1/generations/route.ts`

- [ ] **Step 1: 实现 route**

`app/api/v1/generations/route.ts`：
```ts
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { runGeneration } from '@/lib/generation/run'
import { TemplateNotFoundError } from '@/lib/generation/errors'

// Only the subject keyword is accepted — NO prompt field exists in the schema (ADR-016).
const bodySchema = z.object({
  templateId: z.string().uuid(),
  keyword: z.string().trim().min(1, '请输入主体关键词').max(60, '关键词不能超过 60 字'),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '参数无效' }, { status: 400 })
  }

  try {
    const result = await runGeneration({
      userId: user.id,
      templateId: parsed.data.templateId,
      keyword: parsed.data.keyword,
    })
    return NextResponse.json({ jobId: result.jobId, assets: result.assets })
  } catch (err) {
    if (err instanceof TemplateNotFoundError) {
      return NextResponse.json({ error: '模板不存在或已下架' }, { status: 404 })
    }
    console.error('[generations] runGeneration failed', err)
    return NextResponse.json({ error: '生成失败，请重试' }, { status: 500 })
  }
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add app/api/v1/generations/route.ts
git commit -m "feat: POST /api/v1/generations 同步复刻 API"
```

---

## Task 13: 模板列表页

**Files:**
- Create: `app/(app)/templates/page.tsx`

- [ ] **Step 1: 实现列表页**

`app/(app)/templates/page.tsx`：
```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { clientEnv } from '@/lib/env'

const THEMES = [
  { key: 'game_character', label: '游戏角色概念' },
  { key: 'blind_box', label: '盲盒手办风' },
] as const

function templateImageUrl(path: string) {
  return `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/templates/${path}`
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>
}) {
  const { theme } = await searchParams
  const supabase = await createClient()
  let query = supabase
    .from('templates_public')
    .select('id, slug, title, theme, reference_image_path, sort_order')
    .order('sort_order')
  if (theme) query = query.eq('theme', theme)
  const { data: templates } = await query

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">爆款模板库</h1>
      <p className="mt-2 text-neutral-500">选一个模板，输入你的主体关键词，一键复刻同款风格。</p>

      <nav className="mt-6 flex gap-2">
        <Link
          href="/templates"
          className={`rounded-full border px-4 py-1.5 text-sm ${!theme ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 hover:bg-neutral-100'}`}
        >
          全部
        </Link>
        {THEMES.map((t) => (
          <Link
            key={t.key}
            href={`/templates?theme=${t.key}`}
            className={`rounded-full border px-4 py-1.5 text-sm ${theme === t.key ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 hover:bg-neutral-100'}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3">
        {(templates ?? []).map((t) => (
          <Link
            key={t.id}
            href={`/templates/${t.slug}`}
            className="group overflow-hidden rounded-xl border border-neutral-200 transition hover:shadow-md"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={templateImageUrl(t.reference_image_path)}
              alt={t.title}
              className="aspect-square w-full object-cover"
            />
            <div className="p-3">
              <p className="text-sm font-medium">{t.title}</p>
              <span className="mt-1 inline-block rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                {THEMES.find((x) => x.key === t.theme)?.label ?? t.theme}
              </span>
            </div>
          </Link>
        ))}
        {(templates ?? []).length === 0 ? (
          <p className="col-span-full text-neutral-400">暂无模板。</p>
        ) : null}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/templates/page.tsx"
git commit -m "feat: 模板列表页 + 主题筛选"
```

---

## Task 14: 模板详情页 + 一键复刻表单

**Files:**
- Create: `app/(app)/templates/[slug]/page.tsx`
- Create: `app/(app)/templates/[slug]/_components/ReplicateForm.tsx`

- [ ] **Step 1: 实现详情页**

`app/(app)/templates/[slug]/page.tsx`：
```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { clientEnv } from '@/lib/env'
import { ReplicateForm } from './_components/ReplicateForm'

function templateImageUrl(path: string) {
  return `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/templates/${path}`
}

export default async function TemplateDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: t } = await supabase
    .from('templates_public')
    .select(
      'id, slug, title, theme, reference_image_path, sample_output_paths, recommended_width, recommended_height, keyword_placeholder',
    )
    .eq('slug', slug)
    .maybeSingle()
  if (!t) notFound()

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link href="/templates" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← 换个模板
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={templateImageUrl(t.reference_image_path)}
            alt={t.title}
            className="w-full rounded-xl border border-neutral-200 object-cover"
          />
          {t.sample_output_paths?.length ? (
            <div className="mt-3 flex gap-2">
              {t.sample_output_paths.map((p: string) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={p}
                  src={templateImageUrl(p)}
                  alt="示范产出"
                  className="h-20 w-20 rounded-lg border border-neutral-200 object-cover"
                />
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            推荐尺寸 {t.recommended_width}×{t.recommended_height}
          </p>
          <div className="mt-6">
            <ReplicateForm templateId={t.id} placeholder={t.keyword_placeholder} />
          </div>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: 实现复刻表单（client）**

`app/(app)/templates/[slug]/_components/ReplicateForm.tsx`：
```tsx
'use client'

import { useRef, useState } from 'react'

type ResultAsset = { signedUrl: string; width: number; height: number }

export function ReplicateForm({
  templateId,
  placeholder,
}: {
  templateId: string
  placeholder?: string | null
}) {
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assets, setAssets] = useState<ResultAsset[] | null>(null)
  const shownAt = useRef<number | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/generations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ templateId, keyword: keyword.trim() }),
      })
      const data = (await res.json()) as { assets?: ResultAsset[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? '生成失败，请重试')
      setAssets(data.assets ?? [])
      shownAt.current = Date.now()
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  function replicateAgain() {
    // 60s retry instrumentation — success metric per docs/00-vision. W5 wires real analytics.
    if (shownAt.current) {
      const elapsed = Date.now() - shownAt.current
      console.info('[metric] replicate_again', { withinWindow: elapsed <= 60_000, elapsedMs: elapsed })
    }
    setAssets(null)
    setKeyword('')
    setError(null)
    shownAt.current = null
  }

  if (assets && assets.length > 0) {
    return (
      <div className="flex flex-col gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assets[0].signedUrl} alt="复刻结果" className="w-full rounded-xl border border-neutral-200" />
        <div className="flex gap-3">
          <a
            href={assets[0].signedUrl}
            download
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            下载图片
          </a>
          <button
            type="button"
            onClick={replicateAgain}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
          >
            再次复刻
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label htmlFor="keyword" className="text-sm font-medium">
        主体关键词
      </label>
      <input
        id="keyword"
        name="keyword"
        type="text"
        required
        maxLength={60}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder={placeholder ?? '输入你想复刻的主体，例如：一只柴犬'}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
      />
      <p className="text-xs text-neutral-400">{keyword.length}/60</p>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? '生成中…' : '一键复刻'}
      </button>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </form>
  )
}
```

- [ ] **Step 3: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/templates/[slug]"
git commit -m "feat: 模板详情页 + 一键复刻表单 (仅关键词输入)"
```

---

## Task 15: dashboard 加入口

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: 加链接**

在 `app/(app)/dashboard/page.tsx` 的 `<form action={signOut}>` **之前**插入（并在文件顶部加 `import Link from 'next/link'`）：
```tsx
      <Link
        href="/templates"
        className="self-start rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        进入模板库
      </Link>
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/dashboard/page.tsx"
git commit -m "feat: dashboard 加模板库入口"
```

---

## Task 16: 端到端手测 + 安全验收（ADR-016）

**Files:** 无（验证任务）

- [ ] **Step 1: 启动本地环境**

Run:
```bash
supabase start
supabase db reset
pnpm dev
```
Expected: Supabase + Next dev server 起来；`.env.local` 已含 Supabase 密钥（FAL_API_KEY 留空 → mock 生效）。

- [ ] **Step 2: 登录并走完闭环**

操作：浏览器开 http://localhost:3000 → `/auth/login` → Magic Link 登录（邮件在 http://localhost:54324）→ `/dashboard` → 「进入模板库」→ 选 `game-hero` → 输入「女骑士」→ 「一键复刻」。
Expected: 数秒内出现彩色占位图（mock 输出）；可点「下载图片」。

- [ ] **Step 3: 验证持久化与数据库状态**

在 Studio SQL editor：
```sql
select status, provider, model, template_id, output is not null as has_output from public.generation_jobs order by created_at desc limit 1;
select kind, storage_bucket, storage_path from public.assets order by created_at desc limit 1;
```
Expected: job `status=succeeded`、`provider=fal`、`has_output=true`；asset 一行，`storage_bucket=generations`，path 形如 `{user_id}/{job_id}/image.svg`。Studio Storage `generations` 桶含该文件。

- [ ] **Step 4: 安全验收 — 前端搜不到 base_prompt**

在浏览器对模板详情页与生成结果页：
- 打开 DevTools → Network，检查 `templates_public` 请求响应与 `POST /api/v1/generations` 响应体。
Expected: **均不含 `base_prompt`、`negative_prompt`，也不含拼接后的完整 prompt**（响应只有 signedUrl + 尺寸 / 安全列）。
- 在页面 DevTools Console 跑 `document.documentElement.outerHTML.includes('concept art of')`
Expected: `false`（base_prompt 文本不在 DOM）。

- [ ] **Step 5: 验证全套自动化检查**

Run: `pnpm test && pnpm lint && pnpm typecheck`
Expected: 全 PASS。

- [ ] **Step 6: 记录验收（无 commit）**

将 Step 2–4 的结果（截图或文字）记入 PR 描述。

---

## Task 17: 文档同步

**Files:**
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/07-roadmap.md`

- [ ] **Step 1: CHANGELOG 加一条**

在 `docs/CHANGELOG.md` 顶部（最新条目之上）插入：
```markdown
## 2026-06-09 · W2 落地 · 同步模板复刻闭环

**产出**：
- ✅ 模板库（列表 + 主题筛选 + 详情）+ 一键复刻（仅关键词输入，≤60，不暴露 prompt）
- ✅ `models` / `templates`(+`templates_public` 视图) / `generation_jobs` / `assets` migration + RLS
- ✅ Provider 抽象 + mock provider；`resolveProvider` 在无 `FAL_API_KEY` 时回落 mock，填 key 即切真 fal
- ✅ `lib/generation/run.ts` 同步流水（方案 A，W3 复用）+ `POST /api/v1/generations`
- ✅ 引入 vitest + CI test 步骤

**关键决策**：
- **storage 桶**：新增公开 `templates` 桶（编辑参考图/示范图）+ 私有 `generations` 桶（用户生成图 + 1h 签名 URL）。化解 `02-architecture`（generations+public-assets）与 `04-data-model`（templates 桶）的不一致，**以 04 为准**。
- **W2 用 mock provider 起步**：无真实 FAL_API_KEY，先验证整条闭环（UI→API→拼prompt→存储→写job/assets→签名URL→展示）；真实 fal 活测待填 key。
- **方案 A·服务层抽离**：流水抽成 `runGeneration`，W3 异步化只移调用点。

**未变**：技术栈、里程碑节奏、ADR-016 base_prompt 隔离纪律。
```

- [ ] **Step 2: roadmap 勾选 W2**

在 `docs/07-roadmap.md` W2 章节，将已完成项的 `- [ ]` 改为 `- [x]`（providers / models / templates+视图 / jobs+assets / 列表+详情 / 一键复刻 UI / 同步 API / storage 上传 / 结果展示）。保留未做项（异步、积分、作品库列表、admin、30–50 模板铺设）为 `- [ ]`。

- [ ] **Step 3: Commit**

```bash
git add docs/CHANGELOG.md docs/07-roadmap.md
git commit -m "docs: W2 落地记录 + roadmap 勾选"
```

---

## Self-Review 备注（已核对）

- **Spec 覆盖**：①数据层=Task 2–6；②Provider=Task 7–8；③服务层=Task 9/11；④storage=Task 10；⑤API=Task 12；⑥UI=Task 13–15；⑦安全+测试=Task 7/9/16；⑧文档=Task 17；测试基建前置=Task 1。无遗漏。
- **类型一致**：`ProviderImage`/`ProviderResult`/`GenerationProvider` 跨 Task 7/8/10/11 一致；`uploadGenerationImage`→`UploadedImage`→`assets` 插入字段一致；`resolveProvider(name, falApiKey?)` 签名在 Task 8 定义、Task 11 单参调用一致。
- **无占位符**：每个代码步骤含完整代码与确切命令/预期。
- **已知取舍**：Provider 接口用单一 `generate()`（同步），偏离 spec/02-architecture 的 `submit`+`poll` 草图，但贴合 ADR-005「worker 内同步调 provider、前端轮询 job」的实际模型；W3 如需 webhook 再扩 `submit`/`poll`。`runGeneration` 的自动化集成测试因依赖本地 Supabase 未纳入 vitest，改由 Task 16 手测 + DB 断言覆盖。
