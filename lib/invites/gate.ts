/**
 * 邀请激活门判定（ADR-019）：门开启（INVITE_GATE='1'）且用户未激活且非
 * admin 时拦截。纯函数——(app)/layout 与测试共用。
 */
export function inviteGateBlocks(
  gateEnv: string | undefined,
  inviteActivatedAt: string | null,
  isAdmin: boolean,
): boolean {
  return gateEnv === '1' && inviteActivatedAt === null && !isAdmin
}
