import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiFail, apiOk } from '@/lib/api/response'
import { getAuthUser } from '@/lib/api/auth'
import { generationCreated, inngest } from '@/inngest/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { createGenerationJob, createTextToImageJob } from '@/lib/generation/create-job'
import { refundFailedJob } from '@/lib/generation/refund'
import { track } from '@/lib/analytics/track'
import { listJobs } from '@/lib/generation/list-jobs'
import { mapSeedreamSize } from '@/lib/providers/seedream-size'
import {
  DevCallLimitError,
  InsufficientCreditsError,
  ModelNotFoundError,
  QuotaExceededError,
  TemplateNotFoundError,
} from '@/lib/generation/errors'

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(['pending', 'running', 'succeeded', 'failed', 'canceled']).optional(),
})

// Personal job list — cursor pagination (docs/05).
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return apiFail('unauthorized', '请先登录', 401)

  const url = new URL(request.url)
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return apiFail('validation_error', '查询参数无效', 400)

  try {
    const { jobs, nextCursor } = await listJobs({ userId: user.id, ...parsed.data })
    return apiOk({ jobs, nextCursor })
  } catch (err) {
    console.error('[generations] listJobs failed', err)
    return apiFail('internal_error', '查询失败，请重试', 500)
  }
}

// 模板复刻：only the subject keyword is accepted — NO prompt field (ADR-016).
const replicateSchema = z.object({
  templateId: z.string().uuid(),
  keyword: z.string().trim().min(1, '请输入主体关键词').max(60, '关键词不能超过 60 字'),
})

// 文生图（创作工作台）：user-authored prompt; size must be an official 2K preset.
const t2iSchema = z.object({
  type: z.literal('text_to_image'),
  modelId: z.string().min(1),
  prompt: z.string().trim().min(1, '请描述你想要的画面').max(500, '描述不能超过 500 字'),
  negativePrompt: z.string().trim().max(200, '负面提示词不能超过 200 字').optional(),
  seed: z.number().int().min(0).max(2147483647).optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})

const bodySchema = z.union([replicateSchema, t2iSchema])

// Async pipeline (ADR-002/005): write the pending job + emit the event, return
// immediately. The Inngest worker calls the provider; the client polls the job.
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return apiFail('unauthorized', '请先登录', 401)

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return apiFail('validation_error', '请求格式错误', 400)
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return apiFail('validation_error', parsed.error.issues[0]?.message ?? '参数无效', 400)
  }

  const kind = 'templateId' in parsed.data ? 'template' : 'text_to_image'
  const createdProps: Record<string, unknown> =
    'templateId' in parsed.data ? { kind, templateId: parsed.data.templateId } : { kind, modelId: parsed.data.modelId }

  let jobId: string
  try {
    if ('templateId' in parsed.data) {
      ;({ jobId } = await createGenerationJob({ userId: user.id, ...parsed.data }))
    } else {
      const { modelId, prompt, negativePrompt, seed, width, height } = parsed.data
      // Round-trip through the official preset table — reject hand-rolled dimensions.
      const mapped = mapSeedreamSize(width, height)
      if (mapped.width !== width || mapped.height !== height) {
        return apiFail('validation_error', '不支持的输出尺寸', 400)
      }
      ;({ jobId } = await createTextToImageJob({ userId: user.id, modelId, prompt, negativePrompt, seed, width, height }))
    }
  } catch (err) {
    if (err instanceof TemplateNotFoundError) return apiFail('not_found', '模板不存在或已下架', 404)
    if (err instanceof ModelNotFoundError) return apiFail('not_found', '模型不存在或不可用', 404)
    if (err instanceof QuotaExceededError) return apiFail('quota_exceeded', '今日免费次数已用完，明天再来吧', 429)
    if (err instanceof InsufficientCreditsError) return apiFail('insufficient_credits', '积分不足，无法生成', 402)
    if (err instanceof DevCallLimitError) return apiFail('quota_exceeded', '今日生成次数已达上限，请明天再试', 429)
    console.error('[generations] createGenerationJob failed', err)
    return apiFail('internal_error', '创建任务失败，请重试', 500)
  }

  try {
    await inngest.send(generationCreated.create({ jobId }))
  } catch (err) {
    // Without the event the job would be stranded in pending — mark it failed.
    console.error('[generations] inngest.send failed', { jobId, err })
    try {
      await createAdminClient()
        .from('generation_jobs')
        .update({
          status: 'failed',
          error: { code: 'internal_error', message: 'event dispatch failed' },
          finished_at: new Date().toISOString(),
        })
        .eq('id', jobId)
      // Refund directly: the normal refund path is the generation/failed Inngest
      // event, but we are here precisely because Inngest is unreachable — and the
      // job is now `failed`, so sweep-stale won't touch it either. refundFailedJob
      // is idempotent (uq_ledger_refund_once), so a later retry can't double-refund.
      await refundFailedJob(jobId)
    } catch (updateErr) {
      console.error('[generations] failed to mark/refund stranded job', { jobId, updateErr })
    }
    await track('generation_failed', { userId: user.id, props: { ...createdProps, reason: 'dispatch_failed' } })
    return apiFail('internal_error', '创建任务失败，请重试', 500, { jobId })
  }

  await track('generation_created', { userId: user.id, props: createdProps })

  return apiOk({ job: { id: jobId, status: 'pending' } }, 202)
}
