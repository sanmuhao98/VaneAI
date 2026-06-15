// Sentry edge runtime init（middleware / edge route）。配置同 server。
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0,
  environment: process.env.NODE_ENV,
  debug: process.env.SENTRY_DEBUG === '1',
})
