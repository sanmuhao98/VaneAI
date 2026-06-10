import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiFail, apiOk } from '@/lib/api/response'
import { getAdminUser } from '@/lib/api/admin'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  amount: z.number().int().min(1).max(10_000),
})

// Manual credit grant (docs/05 admin). Flows through the ledger like every
// balance change — reason 'admin_grant', trigger syncs profiles.credits_balance.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await getAdminUser()
  if (!adminUser) return apiFail('forbidden', '无权限', 403)
  const { id: targetUserId } = await params

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return apiFail('validation_error', '请求格式错误', 400)
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return apiFail('validation_error', '加分数量需为 1–10000 的整数', 400)

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id').eq('id', targetUserId).maybeSingle()
  if (!profile) return apiFail('not_found', '用户不存在', 404)

  const { error } = await admin.from('credit_ledger').insert({
    user_id: targetUserId,
    delta: parsed.data.amount,
    reason: 'admin_grant',
  })
  if (error) {
    console.error('[admin:grant-credits] failed', { targetUserId, by: adminUser.email, error })
    return apiFail('internal_error', '加分失败，请重试', 500)
  }
  console.info('[admin:grant-credits]', { targetUserId, amount: parsed.data.amount, by: adminUser.email })

  const { data: after } = await admin.from('profiles').select('credits_balance').eq('id', targetUserId).single()
  return apiOk({ userId: targetUserId, balance: after?.credits_balance ?? null })
}
