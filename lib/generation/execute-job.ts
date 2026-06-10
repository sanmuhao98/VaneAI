import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveProvider } from '@/lib/providers'
import { createSignedUrl, uploadGenerationImage } from '@/lib/storage/upload'
import { assemblePrompt } from './prompt'
import { ProviderError } from './errors'

export type ExecuteResult =
  | { status: 'succeeded'; assetCount: number }
  | { status: 'failed' }
  | { status: 'skipped'; reason: string }

// Owner can read job rows straight through PostgREST (RLS allows it), so raw
// error internals must never be persisted — generic copy only, raw goes to logs.
const SANITIZED_ERROR_MESSAGES = {
  provider_error: 'provider call failed',
  internal_error: 'internal error',
} as const

// Inngest worker body. Marks the job failed itself and RESOLVES — it must not throw
// on business failures, or Inngest would blind-retry paid provider calls (refund is W4).
// Cancel is best-effort and race-guarded: entry requires `pending`, the `running`
// transition is conditional, and every terminal write refuses to overwrite `canceled`.
export async function executeGenerationJob(jobId: string): Promise<ExecuteResult> {
  const admin = createAdminClient()

  try {
    const { data: job, error: jErr } = await admin
      .from('generation_jobs')
      .select('id, user_id, status, template_id, input, provider')
      .eq('id', jobId)
      .maybeSingle()
    if (jErr) throw jErr
    if (!job) throw new Error(`job not found: ${jobId}`)
    // Idempotency + cancel: only a pending job may start.
    if (job.status !== 'pending') return { status: 'skipped', reason: `status=${job.status}` }

    const { data: template, error: tErr } = await admin
      .from('templates')
      .select('base_prompt, negative_prompt, model_id')
      .eq('id', job.template_id)
      .single()
    if (tErr) throw tErr

    const { data: model, error: mErr } = await admin
      .from('models')
      .select('provider_model, config')
      .eq('id', template.model_id)
      .single()
    if (mErr) throw mErr
    const modelConfig = (model.config ?? {}) as { watermark?: boolean }

    const input = job.input as { keyword: string; width: number; height: number }
    // ADR-016: prompt is re-assembled here, never persisted on the job row.
    const prompt = assemblePrompt(template.base_prompt, input.keyword)

    // Resolve from job.provider — the provider recorded at creation. Re-resolving
    // from models + env could silently diverge (e.g. FAL key appearing mid-flight)
    // and corrupt the dev-call-limit accounting.
    const provider = resolveProvider(job.provider)

    const { data: started, error: runErr } = await admin
      .from('generation_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('status', 'pending')
      .select('id')
    if (runErr) throw runErr
    // Lost the race with cancel before starting — don't call the provider at all.
    if (!started?.length) return { status: 'skipped', reason: 'canceled before start' }

    const result = await provider.generate({
      prompt,
      negativePrompt: template.negative_prompt ?? undefined,
      model: model.provider_model,
      width: input.width,
      height: input.height,
      numImages: 1,
      watermark: modelConfig.watermark,
    })
    if (result.status !== 'succeeded' || result.images.length === 0) {
      throw new ProviderError('provider returned no images', result.raw)
    }

    const assets: { assetId: string; width: number; height: number }[] = []
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
      // Warm the storage path (signed URL itself is re-issued by every read API).
      await createSignedUrl(uploaded.bucket, uploaded.storagePath)
      assets.push({ assetId: asset.id as string, width: uploaded.width, height: uploaded.height })
    }

    const { data: finished, error: doneErr } = await admin
      .from('generation_jobs')
      .update({
        status: 'succeeded',
        output: { assets: assets.map((a) => ({ asset_id: a.assetId, width: a.width, height: a.height })) },
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('status', 'running') // a cancel landed during upload → leave `canceled` standing
      .select('id')
    if (doneErr) throw doneErr
    if (!finished?.length) {
      // Job was canceled mid-upload; asset rows stay orphaned until the W4 cleanup cron.
      return { status: 'skipped', reason: 'canceled mid-flight' }
    }

    // No signed URLs in the return value — it persists in Inngest run state.
    return { status: 'succeeded', assetCount: assets.length }
  } catch (err) {
    console.error('[executeGenerationJob] failed', { jobId, err })
    const code = err instanceof ProviderError ? ('provider_error' as const) : ('internal_error' as const)
    try {
      await admin
        .from('generation_jobs')
        .update({
          status: 'failed',
          error: { code, message: SANITIZED_ERROR_MESSAGES[code] },
          finished_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .in('status', ['pending', 'running']) // never flip `canceled` to `failed`
    } catch (updateErr) {
      console.error('[executeGenerationJob] failed to mark job failed', { jobId, updateErr })
    }
    return { status: 'failed' }
  }
}
