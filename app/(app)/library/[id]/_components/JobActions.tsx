'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { canCancel, canRetry, type JobStatus } from '@/lib/generation/status'
import { Button } from '@/components/ui/button'

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
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            取消任务
          </Button>
        ) : null}
        {canRetry(status) ? (
          <Button type="button" variant="brand" disabled={busy} onClick={onRetry}>
            重试
          </Button>
        ) : null}
        <Button type="button" variant="destructive" disabled={busy} onClick={onDelete}>
          删除
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
