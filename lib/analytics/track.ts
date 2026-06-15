import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AnalyticsEvent } from './events'

// 记一条产品埋点事件。**永不抛错、永不阻断主流程**——埋点失败只落服务端日志。
// analytics_events 是 admin-only 表（service_role），客户端无读写权限。
export async function track(
  event: AnalyticsEvent,
  opts?: { userId?: string | null; props?: Record<string, unknown> },
): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from('analytics_events')
      .insert({ event, user_id: opts?.userId ?? null, props: opts?.props ?? {} })
    if (error) console.error('[analytics] insert failed', { event, error })
  } catch (err) {
    console.error('[analytics] track threw', { event, err })
  }
}
