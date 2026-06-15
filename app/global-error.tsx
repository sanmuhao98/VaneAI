'use client'

// 顶层渲染错误兜底——上报 Sentry 后给用户一个最简可读页面。
// global-error 必须自带 <html>/<body>（它替换根 layout）。
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="zh-CN">
      <body
        style={{
          display: 'flex',
          minHeight: '100svh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <p style={{ fontSize: 14, color: '#555' }}>出错了，请刷新重试。</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ borderRadius: 6, border: '1px solid #ccc', padding: '6px 16px', fontSize: 14, cursor: 'pointer' }}
        >
          刷新
        </button>
      </body>
    </html>
  )
}
