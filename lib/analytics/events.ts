// 产品埋点事件名（与 migration 0012 注释一致）。
// 服务端权威事件 + 一个客户端事件（replicate_again，经 /api/v1/events beacon）。
export const ANALYTICS_EVENTS = [
  'signup',
  'generation_created',
  'generation_succeeded',
  'generation_failed',
  'generation_canceled',
  'job_deleted',
  'replicate_again',
] as const

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number]

// 客户端 beacon 允许上报的事件子集——服务端事件不接受来自客户端的伪造上报。
export const CLIENT_ANALYTICS_EVENTS = ['replicate_again'] as const
export type ClientAnalyticsEvent = (typeof CLIENT_ANALYTICS_EVENTS)[number]

export function isAnalyticsEvent(x: unknown): x is AnalyticsEvent {
  return typeof x === 'string' && (ANALYTICS_EVENTS as readonly string[]).includes(x)
}

export function isClientAnalyticsEvent(x: unknown): x is ClientAnalyticsEvent {
  return typeof x === 'string' && (CLIENT_ANALYTICS_EVENTS as readonly string[]).includes(x)
}
