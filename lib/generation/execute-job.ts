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

// Inngest worker body. Marks the job failed itself and RESOLVES — it must not throw
// on business failures, or Inngest would blind-retry paid provider calls (refund is W4).
// Cancel is best-effort: checked before starting and again after the provider returns.
export async function executeGenerationJob(jobId: string): Promise<ExecuteResult> {
  const admin = createAdminClient()

  const { data: job, error: jErr } = await admin
    .from('generation_jobs')
    .select('id, user_id, status, template_id, input')
    .eq('id', jobId)
    .maybeSingle()
  if (jErr) throw jErr
  if (!job) throw new Error(`job not found: ${jobId}`)
  // Idempotency + cancel: only a pending job may start.
  if (job.status !== 'pending') return { status: 'skipped', reason: `status=${job.status}` }

  try {
    const { data: template, error: tErr } = await admin
      .from('templates')
      .select('base_prompt, negative_prompt, model_id')
      .eq('id', job.template_id)
      .single()
    if (tErr) throw tErr

    const { data: model, error: mErr } = await admin
      .from('models')
      .select('provider, provider_model')
      .eq('id', template.model_id)
      .single()
    if (mErr) throw mErr

    const input = job.input as { keyword: string; width: number; height: number }
    // ADR-016: prompt is re-assembled here, never persisted on the job row.
    const prompt = assemblePrompt(template.base_prompt, input.keyword)

    const { error: runErr } = await admin
      .from('generation_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('status', 'pending') // lost race with cancel → no-op update
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

    // Second cancel check: the user may have canceled while the provider ran.
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
