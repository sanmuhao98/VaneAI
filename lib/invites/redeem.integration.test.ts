// Invite redemption integration tests against the REAL local Supabase stack.
// Run: RUN_DB_TESTS=1 pnpm vitest run lib/invites/redeem.integration.test.ts
import { describe, beforeAll, afterAll, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const RUN = process.env.RUN_DB_TESTS === '1'

if (RUN) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const i = line.indexOf('=')
    if (i > 0) process.env[line.slice(0, i)] = line.slice(i + 1)
  }
  // Hermetic（与 lib/generation 集成测试同纪律）：不触真实 provider。
  delete process.env.ARK_API_KEY
  delete process.env.FAL_API_KEY
}

describe.skipIf(!RUN)('redeem_invite_code (integration · local supabase)', () => {
  let admin: SupabaseClient
  let redeemInviteCode: typeof import('./redeem').redeemInviteCode
  let errors: typeof import('./errors')
  let userId: string

  async function profileInvite() {
    const { data } = await admin
      .from('profiles')
      .select('invite_code, invite_activated_at')
      .eq('id', userId)
      .single()
    return data as { invite_code: string | null; invite_activated_at: string | null }
  }

  async function usedCount(code: string) {
    const { data } = await admin.from('invite_codes').select('used_count').eq('code', code).single()
    return data!.used_count as number
  }

  beforeAll(async () => {
    ;({ redeemInviteCode } = await import('./redeem'))
    errors = await import('./errors')
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: u, error } = await admin.auth.admin.createUser({
      email: `invite-test-${Math.random().toString(36).slice(2)}@example.com`,
      email_confirm: true,
    })
    if (error) throw error
    userId = u.user.id

    // PostgREST 批量插入按字段并集补 null（不会落到列默认值）——每行写全。
    const { error: insErr } = await admin.from('invite_codes').insert([
      { code: 'TEST-OK', max_uses: 2, used_count: 0, is_active: true, note: 'integration' },
      { code: 'TEST-FULL', max_uses: 1, used_count: 1, is_active: true, note: 'integration' },
      {
        code: 'TEST-EXPIRED',
        max_uses: 9,
        used_count: 0,
        is_active: true,
        expires_at: '2020-01-01T00:00:00Z',
        note: 'integration',
      },
      { code: 'TEST-OFF', max_uses: 9, used_count: 0, is_active: false, note: 'integration' },
    ])
    if (insErr) throw insErr
  })

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId)
    await admin.from('invite_codes').delete().eq('note', 'integration')
  })

  test('exhausted code → InviteExhaustedError, profile untouched', async () => {
    await expect(redeemInviteCode({ userId, code: 'TEST-FULL' })).rejects.toBeInstanceOf(
      errors.InviteExhaustedError,
    )
    expect((await profileInvite()).invite_activated_at).toBeNull()
  })

  test('expired code → InviteExpiredError', async () => {
    await expect(redeemInviteCode({ userId, code: 'TEST-EXPIRED' })).rejects.toBeInstanceOf(
      errors.InviteExpiredError,
    )
  })

  test('unknown or deactivated code → InviteInvalidError', async () => {
    await expect(redeemInviteCode({ userId, code: 'NO-SUCH' })).rejects.toBeInstanceOf(errors.InviteInvalidError)
    await expect(redeemInviteCode({ userId, code: 'TEST-OFF' })).rejects.toBeInstanceOf(errors.InviteInvalidError)
  })

  test('valid redeem stamps profile and increments used_count (case/space-insensitive)', async () => {
    await redeemInviteCode({ userId, code: '  test-ok ' })
    const p = await profileInvite()
    expect(p.invite_code).toBe('TEST-OK')
    expect(p.invite_activated_at).not.toBeNull()
    expect(await usedCount('TEST-OK')).toBe(1)
  })

  test('second redeem is idempotent — no double count, no error', async () => {
    await redeemInviteCode({ userId, code: 'TEST-OK' })
    expect(await usedCount('TEST-OK')).toBe(1)
  })
})
