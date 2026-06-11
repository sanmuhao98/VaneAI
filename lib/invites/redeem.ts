import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { InviteExhaustedError, InviteExpiredError, InviteInvalidError } from './errors'

// 原子兑换（ADR-019）：redeem_invite_code RPC 内完成查码 FOR UPDATE、
// 计数与 profiles 回填；已激活用户幂等返回。错误串 → 领域异常。
export async function redeemInviteCode(input: { userId: string; code: string }): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.rpc('redeem_invite_code', {
    p_user_id: input.userId,
    p_code: input.code,
  })
  if (error) {
    if (error.message.includes('invite_invalid')) throw new InviteInvalidError()
    if (error.message.includes('invite_expired')) throw new InviteExpiredError()
    if (error.message.includes('invite_exhausted')) throw new InviteExhaustedError()
    throw error
  }
}
