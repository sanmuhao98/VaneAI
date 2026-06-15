import { type NextRequest } from 'next/server'
import { apiFail, apiOk } from '@/lib/api/response'
import { getAuthUser } from '@/lib/api/auth'
import { track } from '@/lib/analytics/track'
import { isClientAnalyticsEvent } from '@/lib/analytics/events'

// 客户端埋点 beacon。只接受白名单内的客户端事件（如 replicate_again）——
// 服务端权威事件（signup / generation_*）由各 server 路径直接记录，不收客户端上报。
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return apiFail('unauthorized', '请先登录', 401)

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return apiFail('validation_error', '请求格式错误', 400)
  }
  const event = (json as { event?: unknown })?.event
  if (!isClientAnalyticsEvent(event)) return apiFail('validation_error', '未知事件', 400)

  const rawProps = (json as { props?: unknown })?.props
  const props = rawProps && typeof rawProps === 'object' ? (rawProps as Record<string, unknown>) : {}
  await track(event, { userId: user.id, props })
  return apiOk({ ok: true })
}
