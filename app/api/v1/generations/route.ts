import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiFail, apiOk } from '@/lib/api/response'
import { requireUser } from '@/lib/api/auth'
import { generationCreated, inngest } from '@/inngest/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { createGenerationJob } from '@/lib/generation/create-job'
import { DevCallLimitError, TemplateNotFoundError } from '@/lib/generation/errors'

// Only the subject keyword is accepted — NO prompt field exists in the schema (ADR-016).
const bodySchema = z.object({
  templateId: z.string().uuid(),
  keyword: z.string().trim().min(1, '请输入主体关键词').max(60, '关键词不能超过 60 字'),
})

// Async pipeline (ADR-002/005): write the pending job + emit the event, return
// immediately. The Inngest worker calls the provider; the client polls the job.
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
    await createAdminClient()
      .from('generation_jobs')
      .update({
        status: 'failed',
        error: { code: 'internal_error', message: 'event dispatch failed' },
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId)
    return apiFail('internal_error', '创建任务失败，请重试', 500, { jobId })
  }

  return apiOk({ job: { id: jobId, status: 'pending' } }, 202)
}
