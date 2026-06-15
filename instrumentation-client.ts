// Sentry 浏览器端 init（Next 16：instrumentation-client.ts 取代旧 sentry.client.config.ts）。
// 用 NEXT_PUBLIC_SENTRY_DSN（前端可见，DSN 本就半公开）；为空则 no-op。
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  environment: process.env.NODE_ENV,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
