// Next.js 原生 instrumentation 钩子——按运行时装载对应 Sentry init。
// onRequestError 捕获 RSC / Route Handler 抛出的服务端错误（Next 16 原生 hook，
// 不依赖 Sentry 的打包插件，故无需 withSentryConfig）。
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
