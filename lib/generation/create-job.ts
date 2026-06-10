import 'server-only'
import { serverEnv } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveProvider } from '@/lib/providers'
import { devCallLimitExceeded } from './dev-limit'
import { DevCallLimitError, TemplateNotFoundError } from './errors'

// Validates template/model, enforces the dev call guard, and inserts a pending job.
// The provider is NOT called here — the Inngest worker picks the job up (ADR-002/005).
export async function createGenerationJob(input: {
  userId: string
  templateId: string
  keyword: string
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
    .from('models')
    .select('id, provider, type')
    .eq('id', template.model_id)
    .single()
  if (mErr) throw mErr

  // Resolve up-front so the job row records the provider that will actually run.
  const provider = resolveProvider(model.provider)

  // Dev guardrail (docs/03): cap real provider calls per UTC day. Mock calls are free.
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
      // ADR-016: the assembled prompt is never persisted — the worker re-assembles
      // it from base_prompt + keyword (jobs are owner-readable via RLS).
      input: { keyword: input.keyword, width: template.recommended_width, height: template.recommended_height },
      credits_cost: template.credits_cost,
    })
    .select('id')
    .single()
  if (jErr) throw jErr
  return { jobId: job.id as string }
}
