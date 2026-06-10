import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiFail, apiOk } from '@/lib/api/response'
import { runGeneration } from '@/lib/generation/run'
import { DevCallLimitError, GenerationFailedError, ProviderError, TemplateNotFoundError } from '@/lib/generation/errors'

// Sync pipeline (W2, ADR-005 interim): the provider call happens inside this
// handler, so give it the full minute until W3 moves it into Inngest.
export const maxDuration = 60

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
    return apiFail('unauthorized', '请先登录', 401)
  }

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

  try {
    const result = await runGeneration({
      userId: user.id,
      templateId: parsed.data.templateId,
      keyword: parsed.data.keyword,
    })
    return apiOk({ jobId: result.jobId, assets: result.assets })
  } catch (err) {
    if (err instanceof TemplateNotFoundError) {
      return apiFail('not_found', '模板不存在或已下架', 404)
    }
    if (err instanceof DevCallLimitError) {
      return apiFail('quota_exceeded', '今日生成次数已达上限，请明天再试', 429)
    }
    console.error('[generations] runGeneration failed', err)
    if (err instanceof GenerationFailedError) {
      const isProvider = err.cause instanceof ProviderError
      return apiFail(
        isProvider ? 'provider_error' : 'internal_error',
        '生成失败，请重试',
        isProvider ? 502 : 500,
        { jobId: err.jobId },
      )
    }
    return apiFail('internal_error', '生成失败，请重试', 500)
  }
}
