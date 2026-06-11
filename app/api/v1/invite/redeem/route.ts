import { z } from 'zod'

import { apiFail, apiOk } from '@/lib/api/response'
import { getAuthUser } from '@/lib/api/auth'
import { redeemInviteCode } from '@/lib/invites/redeem'
import { InviteExhaustedError, InviteExpiredError, InviteInvalidError } from '@/lib/invites/errors'

const bodySchema = z.object({
  code: z.string().trim().min(1, '请输入邀请码').max(64, '邀请码格式不正确'),
})

// ADR-019 激活门兑换：认证用户 + 原子 RPC；幂等（已激活直接成功）。
export async function POST(request: Request) {
  const user = await getAuthUser()
  if (!user) return apiFail('unauthorized', '请先登录', 401)

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
    await redeemInviteCode({ userId: user.id, code: parsed.data.code })
  } catch (err) {
    if (err instanceof InviteInvalidError) return apiFail('invite_invalid', '邀请码无效，请核对后重试', 400)
    if (err instanceof InviteExpiredError) return apiFail('invite_expired', '邀请码已过期', 400)
    if (err instanceof InviteExhaustedError) return apiFail('invite_exhausted', '该邀请码的名额已用完', 400)
    console.error('[invite/redeem] failed', err)
    return apiFail('internal_error', '兑换失败，请重试', 500)
  }

  return apiOk({ activated: true })
}
