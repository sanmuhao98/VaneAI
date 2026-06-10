import 'server-only'
import { serverEnv } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveProvider } from '@/lib/providers'
import { devCallLimitExceeded } from './dev-limit'
import {
  DevCallLimitError,
  InsufficientCreditsError,
  QuotaExceededError,
  TemplateNotFoundError,
} from './errors'

// Creates a pending job ATOMICALLY via the create_generation_job Postgres RPC:
// quota check + balance debit + ledger row + job insert are one transaction with
// FOR UPDATE locks (docs/04 — PostgREST has no multi-statement transactions).
// The provider is NOT called here — the Inngest worker picks the job up.
export async function createGenerationJob(input: {
  userId: string
  templateId: string
  keyword: string
}): Promise<{ jobId: string }> {
  const admin = createAdminClient()

  // Pre-read template→model only to resolve the provider that will actually run
  // (recorded on the job row; mock fallback must not be billed as 'fal').
  const { data: template, error: tErr } = await admin
    .from('templates')
    .select('id, model_id, is_active')
    .eq('id', input.templateId)
    .maybeSingle()
  if (tErr) throw tErr
  if (!template || !template.is_active) throw new TemplateNotFoundError(input.templateId)

  const { data: model, error: mErr } = await admin
    .from('models')
    .select('provider')
    .eq('id', template.model_id)
    .single()
  if (mErr) throw mErr

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

  const { data: jobId, error: rpcErr } = await admin.rpc('create_generation_job', {
    p_user_id: input.userId,
    p_template_id: input.templateId,
    p_keyword: input.keyword,
    p_provider: provider.name,
  })
  if (rpcErr) {
    if (rpcErr.message.includes('quota_exceeded')) throw new QuotaExceededError()
    if (rpcErr.message.includes('insufficient_credits')) throw new InsufficientCreditsError()
    if (rpcErr.message.includes('template_not_found')) throw new TemplateNotFoundError(input.templateId)
    throw rpcErr
  }
  return { jobId: jobId as string }
}
