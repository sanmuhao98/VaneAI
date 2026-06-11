// Integration tests against the REAL local Supabase stack (DB + storage + RLS).
// Gated: run with `RUN_DB_TESTS=1 pnpm vitest run lib/generation/execute-job.integration.test.ts`
// (requires `supabase start`). Skipped in CI where only placeholder env exists.
import { describe, beforeAll, afterAll, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const RUN = process.env.RUN_DB_TESTS === '1'

if (RUN) {
  // Override vitest.setup placeholders with the real local keys BEFORE importing
  // modules under test (lib/env parses process.env at import time).
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const i = line.indexOf('=')
    if (i > 0) process.env[line.slice(0, i)] = line.slice(i + 1)
  }
  // Hermetic: tests must never hit real providers (real cost + >5s latency).
  // Strip provider keys so resolveProvider falls back to mock regardless of
  // what .env.local holds (delete, not '': empty string fails lib/env zod).
  delete process.env.ARK_API_KEY
  delete process.env.FAL_API_KEY
}

describe.skipIf(!RUN)('executeGenerationJob (integration · local supabase)', () => {
  let admin: SupabaseClient
  let executeGenerationJob: typeof import('./execute-job').executeGenerationJob
  let createGenerationJob: typeof import('./create-job').createGenerationJob
  let userId: string
  let templateId: string

  beforeAll(async () => {
    ;({ executeGenerationJob } = await import('./execute-job'))
    ;({ createGenerationJob } = await import('./create-job'))
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: u, error: uErr } = await admin.auth.admin.createUser({
      email: `exec-test-${Math.random().toString(36).slice(2)}@example.com`,
      email_confirm: true,
    })
    if (uErr) throw uErr
    userId = u.user.id
    const { data: t } = await admin.from('templates').select('id').eq('slug', 'blind-box').single()
    templateId = t!.id
  })

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId)
  })

  test('pending job → succeeded with one asset row', async () => {
    const { jobId } = await createGenerationJob({ userId, templateId, keyword: '集成测试柴犬' })
    const res = await executeGenerationJob(jobId)
    expect(res.status).toBe('succeeded')

    const { data: job } = await admin.from('generation_jobs').select('status, output').eq('id', jobId).single()
    expect(job!.status).toBe('succeeded')
    const { count } = await admin.from('assets').select('id', { count: 'exact', head: true }).eq('job_id', jobId)
    expect(count).toBe(1)
  })

  test('t2i job (no template) → succeeded via input.prompt path (ADR-018)', async () => {
    const { createTextToImageJob } = await import('./create-job')
    const { jobId } = await createTextToImageJob({
      userId,
      modelId: 'doubao-seedream-5-lite',
      prompt: '集成测试：黄昏屋顶上的橘猫',
      negativePrompt: 'lowres',
      seed: 42,
      width: 2048,
      height: 2048,
    })
    const res = await executeGenerationJob(jobId)
    expect(res.status).toBe('succeeded')

    const { data: job } = await admin
      .from('generation_jobs')
      .select('status, template_id, input')
      .eq('id', jobId)
      .single()
    expect(job!.status).toBe('succeeded')
    expect(job!.template_id).toBeNull()
    // The user-authored prompt IS persisted (user content — unlike template recipes).
    expect((job!.input as { prompt: string }).prompt).toContain('橘猫')
    const { count } = await admin.from('assets').select('id', { count: 'exact', head: true }).eq('job_id', jobId)
    expect(count).toBe(1)
  })

  test('non-pending job is skipped and status untouched (cancel entry guard)', async () => {
    const { jobId } = await createGenerationJob({ userId, templateId, keyword: '取消守卫' })
    await admin.from('generation_jobs').update({ status: 'canceled' }).eq('id', jobId)

    const res = await executeGenerationJob(jobId)
    expect(res.status).toBe('skipped')
    const { data: job } = await admin.from('generation_jobs').select('status').eq('id', jobId).single()
    expect(job!.status).toBe('canceled')
  })

  test('broken provider → failed, with SANITIZED error persisted (owner-readable row)', async () => {
    // Insert directly: job.provider records an unknown provider. The worker must
    // resolve from job.provider (not re-resolve from env) and fail this job.
    const { data: job, error } = await admin
      .from('generation_jobs')
      .insert({
        user_id: userId,
        type: 'text_to_image',
        status: 'pending',
        template_id: templateId,
        provider: 'nope',
        model: 'fal-flux-schnell',
        input: { keyword: '坏供应商', width: 1024, height: 1024 },
        credits_cost: 1,
      })
      .select('id')
      .single()
    if (error) throw error

    const res = await executeGenerationJob(job!.id)
    expect(res.status).toBe('failed')

    const { data: row } = await admin.from('generation_jobs').select('status, error').eq('id', job!.id).single()
    expect(row!.status).toBe('failed')
    const err = row!.error as { code: string; message: string }
    expect(err.code).toBe('internal_error')
    // Raw internals (e.g. "unknown provider: nope") must NOT be persisted —
    // the owner can read this row straight through PostgREST (RLS allows it).
    expect(err.message).not.toContain('nope')
    expect(err.message).not.toContain('unknown provider')
  })
})
