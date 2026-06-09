import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveProvider } from '@/lib/providers'
import { createSignedUrl, uploadGenerationImage } from '@/lib/storage/upload'
import { assemblePrompt } from './prompt'
import { ProviderError, TemplateNotFoundError } from './errors'

export type RunGenerationInput = { userId: string; templateId: string; keyword: string }
export type RunGenerationResult = {
  jobId: string
  status: 'succeeded'
  assets: { signedUrl: string; width: number; height: number }[]
}

// Full sync replication pipeline (Approach A). W3 will call this from an Inngest function instead.
export async function runGeneration(input: RunGenerationInput): Promise<RunGenerationResult> {
  const admin = createAdminClient()

  // 1. Read template base row (service_role only — holds base_prompt). ADR-016.
  const { data: template, error: tErr } = await admin
    .from('templates')
    .select(
      'id, base_prompt, negative_prompt, model_id, recommended_width, recommended_height, credits_cost, is_active',
    )
    .eq('id', input.templateId)
    .maybeSingle()
  if (tErr) throw tErr
  if (!template || !template.is_active) throw new TemplateNotFoundError(input.templateId)

  const { data: model, error: mErr } = await admin
    .from('models')
    .select('id, provider, provider_model, type')
    .eq('id', template.model_id)
    .single()
  if (mErr) throw mErr

  const prompt = assemblePrompt(template.base_prompt, input.keyword)

  // 2. Insert job (pending). input.prompt is stored but NEVER returned to the client.
  const { data: job, error: jErr } = await admin
    .from('generation_jobs')
    .insert({
      user_id: input.userId,
      type: model.type,
      status: 'pending',
      template_id: template.id,
      provider: model.provider,
      model: model.id,
      input: {
        keyword: input.keyword,
        prompt,
        width: template.recommended_width,
        height: template.recommended_height,
      },
      credits_cost: template.credits_cost,
    })
    .select('id')
    .single()
  if (jErr) throw jErr
  const jobId = job.id as string

  try {
    // 3. mark running
    const { error: runErr } = await admin
      .from('generation_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId)
    if (runErr) throw runErr

    // 4. provider
    const provider = resolveProvider(model.provider)
    const result = await provider.generate({
      prompt,
      negativePrompt: template.negative_prompt ?? undefined,
      model: model.provider_model,
      width: template.recommended_width,
      height: template.recommended_height,
      numImages: 1,
    })
    if (result.status !== 'succeeded' || result.images.length === 0) {
      throw new ProviderError('provider returned no images', result.raw)
    }

    // 5. upload + assets
    const assets: { signedUrl: string; width: number; height: number; assetId: string }[] = []
    for (const img of result.images) {
      const uploaded = await uploadGenerationImage({ userId: input.userId, jobId, image: img })
      const { data: asset, error: aErr } = await admin
        .from('assets')
        .insert({
          job_id: jobId,
          user_id: input.userId,
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

    // 6. succeeded
    const { error: doneErr } = await admin
      .from('generation_jobs')
      .update({
        status: 'succeeded',
        output: { assets: assets.map((a) => ({ asset_id: a.assetId, width: a.width, height: a.height })) },
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId)
    if (doneErr) throw doneErr

    return {
      jobId,
      status: 'succeeded',
      assets: assets.map((a) => ({ signedUrl: a.signedUrl, width: a.width, height: a.height })),
    }
  } catch (err) {
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
      console.error('[runGeneration] failed to mark job failed', { jobId, updateErr })
    }
    throw err
  }
}
