// Sentry 服务端 init（Node runtime）。ADR-013：仅错误监控，不上性能/OTel。
// dsn 为空时 SDK 自动 no-op——本地无 DSN 不报错、不上报。
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0, // 不采性能追踪（ADR-013 不上 OTel）
  environment: process.env.NODE_ENV,
  debug: process.env.SENTRY_DEBUG === '1', // 仅排障：SENTRY_DEBUG=1 时打印上报日志
})
