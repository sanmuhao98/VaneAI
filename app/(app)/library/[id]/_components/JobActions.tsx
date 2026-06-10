'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { canCancel, canRetry, type JobStatus } from '@/lib/generation/status'

type Envelope<T> = { data: T | null; error: { code: string; message: string } | null }

export function JobActions({ jobId, status }: { jobId: string; status: JobStatus }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function call<T>(path: string, method: string): Promise<T | null> {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(path, { method })
      const body = (await res.json()) as Envelope<T>
      if (!res.ok || !body.data) throw new Error(body.error?.message ?? '操作失败，请重试')
      return body.data
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function onCancel() {
    const data = await call(`/api/v1/generations/${jobId}/cancel`, 'POST')
    if (data) router.refresh()
  }

  async function onRetry() {
    const data = await call<{ newJobId: string }>(`/api/v1/generations/${jobId}/retry`, 'POST')
    if (data) router.push(`/library/${data.newJobId}`)
  }

  async function onDelete() {
    if (!window.confirm('删除后作品将从作品库消失（7 天后清理文件），确定删除？')) return
    const data = await call(`/api/v1/generations/${jobId}`, 'DELETE')
    if (data) router.push('/library')
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        {canCancel(status) ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
          >
            取消任务
          </button>
        ) : null}
        {canRetry(status) ? (
          <button
            type="button"
            disabled={busy}
            onClick={onRetry}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            重试
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          删除
        </button>
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  )
}
