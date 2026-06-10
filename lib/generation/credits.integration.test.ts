// Credits/quota integration tests against the REAL local Supabase stack.
// Run: RUN_DB_TESTS=1 pnpm vitest run lib/generation/credits.integration.test.ts
import { describe, beforeAll, afterAll, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const RUN = process.env.RUN_DB_TESTS === '1'

if (RUN) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const i = line.indexOf('=')
    if (i > 0) process.env[line.slice(0, i)] = line.slice(i + 1)
  }
}

describe.skipIf(!RUN)('credits + quota (integration · local supabase)', () => {
  let admin: SupabaseClient
  let createGenerationJob: typeof import('./create-job').createGenerationJob
  let refundFailedJob: typeof import('./refund').refundFailedJob
  let errors: typeof import('./errors')
  let userId: string
  let templateId: string

  async function balance() {
    const { data } = await admin.from('profiles').select('credits_balance').eq('id', userId).single()
    return data!.credits_balance as number
  }

  beforeAll(async () => {
    ;({ createGenerationJob } = await import('./create-job'))
    ;({ refundFailedJob } = await import('./refund'))
    errors = await import('./errors')
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: u, error } = await admin.auth.admin.createUser({
      email: `credits-test-${Math.random().toString(36).slice(2)}@example.com`,
      email_confirm: true,
    })
    if (error) throw error
    userId = u.user.id
    const { data: t } = await admin.from('templates').select('id').eq('slug', 'blind-box').single()
    templateId = t!.id
  })

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId)
  })

  test('creating a job debits balance, writes ledger charge, bumps quota', async () => {
    expect(await balance()).toBe(100) // signup bonus via ledger
    const { jobId } = await createGenerationJob({ userId, templateId, keyword: '扣费测试' })
    expect(await balance()).toBe(99)

    const { data: charge } = await admin
      .from('credit_ledger')
      .select('delta, reason')
      .eq('ref_job_id', jobId)
      .single()
    expect(charge).toEqual({ delta: -1, reason: 'generation_charge' })

    const { data: quota } = await admin.from('daily_quota').select('count').eq('user_id', userId).single()
    expect(quota!.count).toBe(1)
  })

  test('insufficient balance → InsufficientCreditsError, nothing written', async () => {
    const current = await balance()
    // Drain via ledger (the only legitimate write path).
    await admin.from('credit_ledger').insert({ user_id: userId, delta: -current, reason: 'admin_grant' })
    expect(await balance()).toBe(0)

    await expect(createGenerationJob({ userId, templateId, keyword: '没钱了' })).rejects.toBeInstanceOf(
      errors.InsufficientCreditsError,
    )
    expect(await balance()).toBe(0)

    // restore for the next tests
    await admin.from('credit_ledger').insert({ user_id: userId, delta: 50, reason: 'admin_grant' })
  })

  test('daily quota exhausted → QuotaExceededError', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await admin.from('daily_quota').update({ count: 10 }).eq('user_id', userId).eq('day', today)

    await expect(createGenerationJob({ userId, templateId, keyword: '超配额' })).rejects.toBeInstanceOf(
      errors.QuotaExceededError,
    )

    await admin.from('daily_quota').update({ count: 1 }).eq('user_id', userId).eq('day', today)
  })

  test('refund on failed job is applied exactly once (idempotent)', async () => {
    const { jobId } = await createGenerationJob({ userId, templateId, keyword: '回补测试' })
    const afterCharge = await balance()
    await admin
      .from('generation_jobs')
      .update({ status: 'failed', error: { code: 'provider_error', message: 'x' } })
      .eq('id', jobId)

    const first = await refundFailedJob(jobId)
    expect(first.refunded).toBe(true)
    expect(await balance()).toBe(afterCharge + 1)

    const second = await refundFailedJob(jobId)
    expect(second.refunded).toBe(false) // already refunded — unique index backstop
    expect(await balance()).toBe(afterCharge + 1)
  })
})
