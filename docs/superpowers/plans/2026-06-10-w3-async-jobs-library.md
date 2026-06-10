# W3 异步化 + 任务轮询 + 作品库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 去掉同步调用——POST 只写 job + 发 Inngest event 立即返回，前端轮询任务详情；用户拥有作品库（列表 / 详情 / 软删 / 取消 / 重试）。

**Architecture:** `runGeneration` 按方案 A 拆成 `createGenerationJob`（API 调，含 dev 限额）与 `executeGenerationJob`（Inngest worker 调，从 base_prompt + keyword 重拼 prompt，ADR-016）。worker 失败时在 job 行标 failed 并**正常返回**（不抛给 Inngest 重试——积分回补是 W4 的事，盲目重试只烧钱）；取消语义为"尽力"：worker 在调 provider 前与写结果前两次检查 `canceled`。前端按 ADR-005 轮询 `GET /generations/:id`（1.5s 间隔，最长 60s）。读路径全走用户 client（RLS 兜所有权与软删过滤），签名 URL 用 admin client 签发。

**Tech Stack:** Next.js 16 App Router · Inngest（新引入，dev 模式免 key）· Supabase（RLS）· zod v4 · vitest。

**对齐文档:** docs/07-roadmap W3 · docs/05-api-design（端点形态）· ADR-002/005/016。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `inngest/client.ts` | Inngest client + 事件类型 |
| `inngest/functions/text-to-image.ts` | worker：executeGenerationJob 的 Inngest 包装 |
| `app/api/inngest/route.ts` | Inngest serve handler |
| `lib/generation/status.ts`(+test) | `canCancel` / `canRetry` / `isTerminal` 纯函数 |
| `lib/generation/job-view.ts`(+test) | job 行 → 客户端安全视图（字段白名单，ADR-016 纵深防御） |
| `lib/generation/create-job.ts` | 校验模板/模型 + dev 限额 + 写 pending job |
| `lib/generation/execute-job.ts` | worker 主体：重拼 prompt → provider → storage → assets → 终态 |
| `lib/generation/list-jobs.ts` | 列表查询 + 首图签名 URL（RSC 页与 API 共用） |
| `lib/generation/run.ts` | **删除**（被 create/execute 取代） |
| `lib/api/auth.ts` | `requireUser` helper（多 route 共用） |
| `app/api/v1/generations/route.ts` | POST 异步化 + GET 列表 |
| `app/api/v1/generations/[id]/route.ts` | GET 详情（轮询目标）+ DELETE 软删 |
| `app/api/v1/generations/[id]/cancel/route.ts` | POST 取消 |
| `app/api/v1/generations/[id]/retry/route.ts` | POST 重试（新 job） |
| `app/(app)/templates/[slug]/_components/ReplicateForm.tsx` | 轮询 + 生成中取消 |
| `app/(app)/library/page.tsx` | 作品库列表（游标分页，RSC） |
| `app/(app)/library/[id]/page.tsx` | 作品详情（RSC） |
| `app/(app)/library/[id]/_components/JobActions.tsx` | 删除/取消/重试按钮（client） |
| `app/(app)/dashboard/page.tsx` | 加作品库入口 |
| `supabase/migrations/20260610000002_assets_softdelete_rls.sql` | assets SELECT 过滤软删 job（review 遗留项） |
| `docs/CHANGELOG.md` `07` `05` `06` | 文档同步 |

---

## Task 1: 引入 Inngest（client + serve route）

**Files:** Modify `package.json`；Create `inngest/client.ts`、`app/api/inngest/route.ts`

- [ ] **Step 1:** `pnpm add inngest` → package.json dependencies 出现 `inngest`
- [ ] **Step 2:** 写 `inngest/client.ts`：

```ts
import { EventSchemas, Inngest } from 'inngest'

type Events = {
  'generation/created': { data: { jobId: string } }
}

// Dev 模式（NODE_ENV !== 'production'）下 SDK 自动连本地 inngest dev server，无需 key。
export const inngest = new Inngest({
  id: 'vaneai',
  schemas: new EventSchemas().fromRecord<Events>(),
})
```

- [ ] **Step 3:** 写 `app/api/inngest/route.ts`：

```ts
import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { textToImage } from '@/inngest/functions/text-to-image'

export const { GET, POST, PUT } = serve({ client: inngest, functions: [textToImage] })
```

（此时 `text-to-image` 未创建，typecheck 失败属预期，Task 4 补齐后再验证。）

- [ ] **Step 4:** Commit（与 Task 4 一起提交，见 Task 4 Step 6）

## Task 2: 任务状态纯函数（TDD）

**Files:** Create `lib/generation/status.ts` + `lib/generation/status.test.ts`

- [ ] **Step 1:** 写失败测试 `status.test.ts`：

```ts
import { describe, expect, test } from 'vitest'
import { canCancel, canRetry, isTerminal } from './status'

describe('job status rules', () => {
  test('canCancel only for pending/running', () => {
    expect(canCancel('pending')).toBe(true)
    expect(canCancel('running')).toBe(true)
    expect(canCancel('succeeded')).toBe(false)
    expect(canCancel('failed')).toBe(false)
    expect(canCancel('canceled')).toBe(false)
  })
  test('canRetry only for failed/canceled', () => {
    expect(canRetry('failed')).toBe(true)
    expect(canRetry('canceled')).toBe(true)
    expect(canRetry('pending')).toBe(false)
    expect(canRetry('succeeded')).toBe(false)
  })
  test('isTerminal for succeeded/failed/canceled', () => {
    expect(isTerminal('succeeded')).toBe(true)
    expect(isTerminal('failed')).toBe(true)
    expect(isTerminal('canceled')).toBe(true)
    expect(isTerminal('running')).toBe(false)
  })
})
```

- [ ] **Step 2:** `pnpm vitest run lib/generation/status.test.ts` → FAIL（模块不存在）
- [ ] **Step 3:** 实现 `status.ts`：

```ts
export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled'

export function isTerminal(s: JobStatus): boolean {
  return s === 'succeeded' || s === 'failed' || s === 'canceled'
}
export function canCancel(s: JobStatus): boolean {
  return s === 'pending' || s === 'running'
}
export function canRetry(s: JobStatus): boolean {
  return s === 'failed' || s === 'canceled'
}
```

- [ ] **Step 4:** 重跑 → PASS
- [ ] **Step 5:** `git commit -m "feat: 任务状态规则纯函数 (TDD)"`

## Task 3: job 安全视图纯函数（TDD）

**Files:** Create `lib/generation/job-view.ts` + `job-view.test.ts`

- [ ] **Step 1:** 写失败测试：错误信息只回 code + 通用文案（raw 可能含内部细节）；input 白名单只留 keyword/width/height（ADR-016 纵深防御）：

```ts
import { describe, expect, test } from 'vitest'
import { toJobView } from './job-view'

const row = {
  id: 'j1', status: 'failed', type: 'text_to_image', template_id: 't1',
  input: { keyword: '柴犬', width: 1024, height: 1024, somethingInternal: 'x' },
  error: { code: 'provider_error', message: 'fal raw stack...' },
  created_at: '2026-06-10T00:00:00Z', finished_at: '2026-06-10T00:00:09Z',
}

describe('toJobView', () => {
  test('whitelists input fields and hides internal error message', () => {
    const v = toJobView(row)
    expect(v).toEqual({
      id: 'j1', status: 'failed', type: 'text_to_image', templateId: 't1',
      keyword: '柴犬', width: 1024, height: 1024,
      error: { code: 'provider_error', message: '生成失败，请重试' },
      createdAt: '2026-06-10T00:00:00Z', finishedAt: '2026-06-10T00:00:09Z',
    })
  })
  test('error null when absent', () => {
    expect(toJobView({ ...row, status: 'succeeded', error: null }).error).toBeNull()
  })
})
```

- [ ] **Step 2:** 跑 → FAIL；**Step 3:** 实现：

```ts
export type JobViewRow = {
  id: string; status: string; type: string; template_id: string | null
  input: { keyword?: string; width?: number; height?: number } & Record<string, unknown>
  error: { code?: string } | null
  created_at: string; finished_at: string | null
}

// Client-safe projection. Input is whitelisted and error.message is replaced with
// generic copy — provider raw messages may leak internals (ADR-016 defence in depth).
export function toJobView(row: JobViewRow) {
  return {
    id: row.id,
    status: row.status,
    type: row.type,
    templateId: row.template_id,
    keyword: row.input.keyword ?? null,
    width: row.input.width ?? null,
    height: row.input.height ?? null,
    error: row.error ? { code: row.error.code ?? 'internal_error', message: '生成失败，请重试' } : null,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  }
}
```

- [ ] **Step 4:** 跑 → PASS；**Step 5:** `git commit -m "feat: job 客户端安全视图 (TDD)"`

## Task 4: run.ts 拆分 + Inngest function + POST 异步化

**Files:** Create `lib/generation/create-job.ts`、`lib/generation/execute-job.ts`、`inngest/functions/text-to-image.ts`；Delete `lib/generation/run.ts`；Modify `app/api/v1/generations/route.ts`

- [ ] **Step 1:** `create-job.ts`（搬运现 run.ts 的模板/模型校验、dev 限额、job insert；不再调 provider）：

```ts
import 'server-only'
import { serverEnv } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveProvider } from '@/lib/providers'
import { devCallLimitExceeded } from './dev-limit'
import { DevCallLimitError, TemplateNotFoundError } from './errors'

export async function createGenerationJob(input: {
  userId: string; templateId: string; keyword: string
}): Promise<{ jobId: string }> {
  const admin = createAdminClient()
  const { data: template, error: tErr } = await admin
    .from('templates')
    .select('id, model_id, recommended_width, recommended_height, credits_cost, is_active')
    .eq('id', input.templateId)
    .maybeSingle()
  if (tErr) throw tErr
  if (!template || !template.is_active) throw new TemplateNotFoundError(input.templateId)

  const { data: model, error: mErr } = await admin
    .from('models').select('id, provider, type').eq('id', template.model_id).single()
  if (mErr) throw mErr

  const provider = resolveProvider(model.provider)
  if (provider.name !== 'mock' && serverEnv.DAILY_DEV_CALL_LIMIT !== undefined) {
    const startOfDayUtc = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`
    const { count, error: cntErr } = await admin
      .from('generation_jobs')
      .select('id', { count: 'exact', head: true })
      .neq('provider', 'mock')
      .gte('created_at', startOfDayUtc)
    if (cntErr) throw cntErr
    if (devCallLimitExceeded(count ?? 0, serverEnv.DAILY_DEV_CALL_LIMIT)) {
      throw new DevCallLimitError(serverEnv.DAILY_DEV_CALL_LIMIT)
    }
  }

  const { data: job, error: jErr } = await admin
    .from('generation_jobs')
    .insert({
      user_id: input.userId,
      type: model.type,
      status: 'pending',
      template_id: template.id,
      provider: provider.name,
      model: model.id,
      input: { keyword: input.keyword, width: template.recommended_width, height: template.recommended_height },
      credits_cost: template.credits_cost,
    })
    .select('id')
    .single()
  if (jErr) throw jErr
  return { jobId: job.id as string }
}
```

- [ ] **Step 2:** `execute-job.ts`（worker 主体；两处取消检查；失败标 failed 后**返回**而非抛出）：

```ts
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveProvider } from '@/lib/providers'
import { createSignedUrl, uploadGenerationImage } from '@/lib/storage/upload'
import { assemblePrompt } from './prompt'
import { ProviderError } from './errors'

export type ExecuteResult =
  | { status: 'succeeded'; assets: { signedUrl: string; width: number; height: number }[] }
  | { status: 'failed' }
  | { status: 'skipped'; reason: string }

// Worker body. Marks the job failed itself and returns — it must NOT throw on
// business failures, or Inngest would blind-retry paid provider calls (refund is W4).
export async function executeGenerationJob(jobId: string): Promise<ExecuteResult> {
  const admin = createAdminClient()
  const { data: job, error: jErr } = await admin
    .from('generation_jobs')
    .select('id, user_id, status, template_id, input')
    .eq('id', jobId)
    .maybeSingle()
  if (jErr) throw jErr
  if (!job) throw new Error(`job not found: ${jobId}`)
  // Idempotency + best-effort cancel: only a pending job may start.
  if (job.status !== 'pending') return { status: 'skipped', reason: `status=${job.status}` }

  try {
    const { data: template, error: tErr } = await admin
      .from('templates')
      .select('base_prompt, negative_prompt, model_id')
      .eq('id', job.template_id)
      .single()
    if (tErr) throw tErr
    const { data: model, error: mErr } = await admin
      .from('models').select('provider, provider_model').eq('id', template.model_id).single()
    if (mErr) throw mErr

    const input = job.input as { keyword: string; width: number; height: number }
    // ADR-016: prompt is re-assembled here, never persisted on the job row.
    const prompt = assemblePrompt(template.base_prompt, input.keyword)

    const { error: runErr } = await admin
      .from('generation_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('status', 'pending') // lost race with cancel → no-op
    if (runErr) throw runErr

    const provider = resolveProvider(model.provider)
    const result = await provider.generate({
      prompt,
      negativePrompt: template.negative_prompt ?? undefined,
      model: model.provider_model,
      width: input.width,
      height: input.height,
      numImages: 1,
    })
    if (result.status !== 'succeeded' || result.images.length === 0) {
      throw new ProviderError('provider returned no images', result.raw)
    }

    // Second cancel check: user may have canceled while the provider ran.
    const { data: fresh } = await admin.from('generation_jobs').select('status').eq('id', jobId).single()
    if (fresh?.status === 'canceled') return { status: 'skipped', reason: 'canceled mid-flight' }

    const assets: { signedUrl: string; width: number; height: number; assetId: string }[] = []
    for (const [i, img] of result.images.entries()) {
      const uploaded = await uploadGenerationImage({ userId: job.user_id, jobId, index: i, image: img })
      const { data: asset, error: aErr } = await admin
        .from('assets')
        .insert({
          job_id: jobId,
          user_id: job.user_id,
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

    const { error: doneErr } = await admin
      .from('generation_jobs')
      .update({
        status: 'succeeded',
        output: { assets: assets.map((a) => ({ asset_id: a.assetId, width: a.width, height: a.height })) },
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId)
    if (doneErr) throw doneErr

    return { status: 'succeeded', assets: assets.map(({ signedUrl, width, height }) => ({ signedUrl, width, height })) }
  } catch (err) {
    console.error('[executeGenerationJob] failed', { jobId, err })
    try {
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
    } catch (updateErr) {
      console.error('[executeGenerationJob] failed to mark job failed', { jobId, updateErr })
    }
    return { status: 'failed' }
  }
}
```

- [ ] **Step 3:** `inngest/functions/text-to-image.ts`：

```ts
import { inngest } from '@/inngest/client'
import { executeGenerationJob } from '@/lib/generation/execute-job'

export const textToImage = inngest.createFunction(
  { id: 'text-to-image', retries: 0, concurrency: { limit: 5 } },
  { event: 'generation/created' },
  async ({ event, step }) => {
    return step.run('execute', () => executeGenerationJob(event.data.jobId))
  },
)
```

- [ ] **Step 4:** 改 `app/api/v1/generations/route.ts` 的 POST（删 `maxDuration`；只建 job + 发 event；send 失败则标 job failed）：

```ts
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiFail, apiOk } from '@/lib/api/response'
import { requireUser } from '@/lib/api/auth'
import { inngest } from '@/inngest/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { createGenerationJob } from '@/lib/generation/create-job'
import { DevCallLimitError, TemplateNotFoundError } from '@/lib/generation/errors'

const bodySchema = z.object({
  templateId: z.string().uuid(),
  keyword: z.string().trim().min(1, '请输入主体关键词').max(60, '关键词不能超过 60 字'),
})

export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (!user) return apiFail('unauthorized', '请先登录', 401)

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return apiFail('validation_error', '请求格式错误', 400)
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return apiFail('validation_error', parsed.error.issues[0]?.message ?? '参数无效', 400)

  let jobId: string
  try {
    ;({ jobId } = await createGenerationJob({ userId: user.id, ...parsed.data }))
  } catch (err) {
    if (err instanceof TemplateNotFoundError) return apiFail('not_found', '模板不存在或已下架', 404)
    if (err instanceof DevCallLimitError) return apiFail('quota_exceeded', '今日生成次数已达上限，请明天再试', 429)
    console.error('[generations] createGenerationJob failed', err)
    return apiFail('internal_error', '创建任务失败，请重试', 500)
  }

  try {
    await inngest.send({ name: 'generation/created', data: { jobId } })
  } catch (err) {
    console.error('[generations] inngest.send failed', { jobId, err })
    await createAdminClient()
      .from('generation_jobs')
      .update({ status: 'failed', error: { code: 'internal_error', message: 'event dispatch failed' }, finished_at: new Date().toISOString() })
      .eq('id', jobId)
    return apiFail('internal_error', '创建任务失败，请重试', 500, { jobId })
  }

  return apiOk({ job: { id: jobId, status: 'pending' } }, 202)
}
```

- [ ] **Step 5:** `rm lib/generation/run.ts`；`GenerationFailedError` 从 `errors.ts` 删除（无引用后）；`pnpm typecheck && pnpm test` → PASS
- [ ] **Step 6:** `git add -A && git commit -m "feat: Inngest 异步化——create/execute 拆分 + worker + POST 只建 job 发 event (ADR-002/005)"`

## Task 5: requireUser helper + GET 详情（轮询目标）

**Files:** Create `lib/api/auth.ts`、`app/api/v1/generations/[id]/route.ts`

- [ ] **Step 1:** `lib/api/auth.ts`：

```ts
import { createClient } from '@/lib/supabase/server'

export async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
```

- [ ] **Step 2:** `app/api/v1/generations/[id]/route.ts` 的 GET（用户 client 读 job/assets——RLS 兜所有权 + 软删；admin 批量签 URL）：

```ts
import { apiFail, apiOk } from '@/lib/api/response'
import { requireUser } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toJobView, type JobViewRow } from '@/lib/generation/job-view'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return apiFail('unauthorized', '请先登录', 401)
  const { id } = await params

  const supabase = await createClient()
  const { data: job, error } = await supabase
    .from('generation_jobs')
    .select('id, status, type, template_id, input, error, created_at, finished_at')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('[generations:id] query failed', error)
    return apiFail('internal_error', '查询失败，请重试', 500)
  }
  if (!job) return apiFail('not_found', '任务不存在', 404)

  let assets: { id: string; signedUrl: string; width: number | null; height: number | null }[] = []
  if (job.status === 'succeeded') {
    const { data: rows } = await supabase
      .from('assets')
      .select('id, storage_bucket, storage_path, width, height')
      .eq('job_id', id)
      .order('created_at')
    if (rows?.length) {
      const admin = createAdminClient()
      const { data: signed, error: sErr } = await admin.storage
        .from(rows[0].storage_bucket)
        .createSignedUrls(rows.map((r) => r.storage_path), 3600)
      if (sErr) throw sErr
      assets = rows.map((r, i) => ({ id: r.id, signedUrl: signed[i].signedUrl, width: r.width, height: r.height }))
    }
  }
  return apiOk({ job: toJobView(job as JobViewRow), assets })
}
```

- [ ] **Step 3:** `pnpm typecheck` → PASS；**Step 4:** `git commit -m "feat: GET /generations/:id 详情（轮询目标）+ requireUser helper"`

## Task 6: ReplicateForm 轮询 + 生成中取消

**Files:** Modify `ReplicateForm.tsx`；Create `app/api/v1/generations/[id]/cancel/route.ts`

- [ ] **Step 1:** cancel route（user client 校验所有权与状态，admin 写 canceled）：

```ts
import { apiFail, apiOk } from '@/lib/api/response'
import { requireUser } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canCancel, type JobStatus } from '@/lib/generation/status'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return apiFail('unauthorized', '请先登录', 401)
  const { id } = await params

  const supabase = await createClient()
  const { data: job } = await supabase.from('generation_jobs').select('id, status').eq('id', id).maybeSingle()
  if (!job) return apiFail('not_found', '任务不存在', 404)
  if (!canCancel(job.status as JobStatus)) return apiFail('validation_error', '该任务已结束，无法取消', 400)

  const { error } = await createAdminClient()
    .from('generation_jobs')
    .update({ status: 'canceled', finished_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['pending', 'running'])
  if (error) {
    console.error('[cancel] failed', error)
    return apiFail('internal_error', '取消失败，请重试', 500)
  }
  return apiOk({ id, status: 'canceled' })
}
```

- [ ] **Step 2:** ReplicateForm 改轮询（POST 拿 jobId → 1.5s 轮询详情，60s 上限；succeeded 展示 / failed、canceled 报错 / 超时提示去作品库；生成中显示取消按钮）。完整代码见仓库实现（要点：`pollJob` 循环 + `cancelRef` 中断 + 复用现有结果/埋点 UI）。
- [ ] **Step 3:** `pnpm typecheck && pnpm lint` → PASS；**Step 4:** `git commit -m "feat: 复刻表单轮询 + 取消 (ADR-005)"`

## Task 7: 异步闭环 e2e 冒烟

- [ ] **Step 1:** 三进程起：`supabase start`（已起）、`npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`、`pnpm dev`
- [ ] **Step 2:** 浏览器登录 → 模板 → 关键词 → 复刻：观察「生成中」→ 数秒后出图；DB 断言 job `pending→succeeded`、provider=mock、asset path `image-0.svg`
- [ ] **Step 3:** 无 commit（验证任务）

## Task 8: 列表查询共用层 + GET 列表 + /library 页

**Files:** Create `lib/generation/list-jobs.ts`、`app/(app)/library/page.tsx`；Modify `app/api/v1/generations/route.ts`（加 GET）、`app/(app)/dashboard/page.tsx`

- [ ] **Step 1:** `list-jobs.ts`（游标 = created_at ISO；首图批量签名 URL）：

```ts
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { toJobView, type JobViewRow } from './job-view'

export async function listJobs(opts: { userId: string; cursor?: string; limit?: number; status?: string }) {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50)
  const admin = createAdminClient()
  let q = admin
    .from('generation_jobs')
    .select('id, status, type, template_id, input, error, created_at, finished_at')
    .eq('user_id', opts.userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit + 1)
  if (opts.cursor) q = q.lt('created_at', opts.cursor)
  if (opts.status) q = q.eq('status', opts.status)
  const { data: rows, error } = await q
  if (error) throw error

  const page = (rows ?? []).slice(0, limit)
  const nextCursor = (rows ?? []).length > limit ? page[page.length - 1].created_at : null

  // First asset per succeeded job, signed in one batch.
  const succeededIds = page.filter((r) => r.status === 'succeeded').map((r) => r.id)
  const previews = new Map<string, string>()
  if (succeededIds.length) {
    const { data: assets } = await admin
      .from('assets')
      .select('job_id, storage_bucket, storage_path, created_at')
      .in('job_id', succeededIds)
      .order('created_at')
    const first = new Map<string, { bucket: string; path: string }>()
    for (const a of assets ?? []) {
      if (!first.has(a.job_id)) first.set(a.job_id, { bucket: a.storage_bucket, path: a.storage_path })
    }
    const entries = [...first.entries()]
    if (entries.length) {
      const { data: signed } = await admin.storage
        .from(entries[0][1].bucket)
        .createSignedUrls(entries.map(([, v]) => v.path), 3600)
      entries.forEach(([jobId], i) => {
        const url = signed?.[i]?.signedUrl
        if (url) previews.set(jobId, url)
      })
    }
  }

  return {
    jobs: page.map((r) => ({ ...toJobView(r as JobViewRow), previewUrl: previews.get(r.id) ?? null })),
    nextCursor,
  }
}
```

- [ ] **Step 2:** `generations/route.ts` 加 GET（query 校验 + listJobs）；**Step 3:** `/library` RSC 页：状态筛选 chips + 卡片网格（previewUrl 或状态占位）+ 「加载更多」链接（`?cursor=`）；dashboard 加「我的作品」入口
- [ ] **Step 4:** `pnpm typecheck && pnpm lint` → PASS；**Step 5:** `git commit -m "feat: 作品库列表（游标分页）+ GET /generations 列表 API"`

## Task 9: 详情页 + 软删（API + RLS 对齐）

**Files:** Create `app/(app)/library/[id]/page.tsx`、`_components/JobActions.tsx`、`supabase/migrations/20260610000002_assets_softdelete_rls.sql`；Modify `app/api/v1/generations/[id]/route.ts`（加 DELETE）

- [ ] **Step 1:** migration（assets SELECT 过滤软删 job——review 遗留项）：

```sql
-- Migration: 0007 — assets visibility follows job soft-delete
drop policy if exists "assets_select_own" on public.assets;
create policy "assets_select_own"
on public.assets for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.generation_jobs j
    where j.id = job_id and j.deleted_at is null
  )
);
```

`supabase migration up` 应用。
- [ ] **Step 2:** DELETE handler（user client 验所有权，admin 置 deleted_at）→ `apiOk({ id })`
- [ ] **Step 3:** 详情页 RSC：大图 + keyword + 模板名（templates_public 查 title）+ 时间 + 状态；`JobActions`（client）：删除（确认后 DELETE → 回 /library）、取消（pending/running）、再次复刻（链接 `/templates/[slug]?keyword=`，ReplicateForm 读 searchParam 预填）
- [ ] **Step 4:** `pnpm typecheck && pnpm lint && pnpm test` → PASS；**Step 5:** `git commit -m "feat: 作品详情页 + 软删 + assets RLS 软删对齐"`

## Task 10: 重试端点 + 详情页接线

**Files:** Create `app/api/v1/generations/[id]/retry/route.ts`；Modify `JobActions.tsx`

- [ ] **Step 1:** retry route：user client 读原 job（含 input/template_id）→ `canRetry` 校验 → `createGenerationJob`（同模板同 keyword）→ `inngest.send` → `apiOk({ newJobId })`；失败分支同 POST /generations
- [ ] **Step 2:** JobActions 加「重试」（failed/canceled 时显示）→ 成功后跳 `/library/[newJobId]`
- [ ] **Step 3:** 验证 + `git commit -m "feat: 失败任务重试"`

## Task 11: e2e 全量验收 + 文档同步

- [ ] **Step 1:** e2e：复刻 → 作品库看到 → 详情 → 删除消失（DB deleted_at 置位、assets 查不到）→ 失败重试路径（mock 暂无失败注入，可跳过或手动改 DB 状态验证 UI）
- [ ] **Step 2:** `pnpm lint && pnpm typecheck && pnpm test` 全绿
- [ ] **Step 3:** 文档：07-roadmap W3 勾选；05 端点状态 🔜→✅；06 目录去 🔜 标注；CHANGELOG 加 W3 条目；`.env.example` 注明本地需 `npx inngest-cli dev`
- [ ] **Step 4:** `git commit -m "docs: W3 落地记录 + roadmap 勾选"`

---

## Self-Review 备注

- **Spec 覆盖**：roadmap W3 九项 ↔ Inngest=T1/T4、异步 POST=T4、轮询=T5/T6、取消=T6、列表=T8、详情页=T9、软删=T9、重试=T10、再次生成入口=T9。
- **类型一致**：`toJobView`/`JobViewRow` 在 T3 定义、T5/T8 复用；`canCancel`/`canRetry` T2 定义、T6/T10 复用；`createGenerationJob` T4 定义、T10 复用。
- **已知取舍**：worker 失败不抛 → Inngest 无重试（刻意，W4 回补前不盲烧）；游标用 created_at（同毫秒并发碰撞概率在 MVP 体量可忽略，V2 换复合游标）；Task 6 表单代码因篇幅以要点描述（实现时完整写出并过 lint）。
