import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiFail, apiOk } from '@/lib/api/response'
import { getAuthUser } from '@/lib/api/auth'
import { generationCreated, inngest } from '@/inngest/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { createGenerationJob } from '@/lib/generation/create-job'
import { listJobs } from '@/lib/generation/list-jobs'
import { DevCallLimitError, TemplateNotFoundError } from '@/lib/generation/errors'

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

// Only the subject keyword is accepted — NO prompt field exists in the schema (ADR-016).
const bodySchema = z.object({
  templateId: z.string().uuid(),
  keyword: z.string().trim().min(1, '请输入主体关键词').max(60, '关键词不能超过 60 字'),
})

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
    } catch (updateErr) {
      console.error('[generations] failed to mark stranded job failed', { jobId, updateErr })
    }
    return apiFail('internal_error', '创建任务失败，请重试', 500, { jobId })
  }

  return apiOk({ job: { id: jobId, status: 'pending' } }, 202)
}
