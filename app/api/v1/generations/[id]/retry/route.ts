import { apiFail, apiOk } from '@/lib/api/response'
import { getAuthUser } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { generationCreated, inngest } from '@/inngest/client'
import { createGenerationJob } from '@/lib/generation/create-job'
import {
  DevCallLimitError,
  InsufficientCreditsError,
  QuotaExceededError,
  TemplateNotFoundError,
} from '@/lib/generation/errors'
import { canRetry, type JobStatus } from '@/lib/generation/status'

// Retry = a NEW job with the same template + keyword (docs/05). Original is untouched.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user) return apiFail('unauthorized', '请先登录', 401)
  const { id } = await params

  const supabase = await createClient()
  const { data: job } = await supabase
    .from('generation_jobs')
    .select('id, status, template_id, input')
    .eq('id', id)
    .maybeSingle()
  if (!job) return apiFail('not_found', '任务不存在', 404)
  if (!canRetry(job.status as JobStatus)) return apiFail('validation_error', '仅失败或已取消的任务可重试', 400)
  const keyword = (job.input as { keyword?: string }).keyword
  if (!job.template_id || !keyword) return apiFail('validation_error', '该任务缺少重试所需信息', 400)

  try {
    const { jobId: newJobId } = await createGenerationJob({
      userId: user.id,
      templateId: job.template_id,
      keyword,
    })
    await inngest.send(generationCreated.create({ jobId: newJobId }))
    return apiOk({ newJobId }, 202)
  } catch (err) {
    if (err instanceof TemplateNotFoundError) return apiFail('not_found', '模板不存在或已下架', 404)
    if (err instanceof QuotaExceededError) return apiFail('quota_exceeded', '今日免费次数已用完，明天再来吧', 429)
    if (err instanceof InsufficientCreditsError) return apiFail('insufficient_credits', '积分不足，无法生成', 402)
    if (err instanceof DevCallLimitError) return apiFail('quota_exceeded', '今日生成次数已达上限，请明天再试', 429)
    console.error('[generations:retry] failed', err)
    return apiFail('internal_error', '重试失败，请稍后再试', 500)
  }
}
