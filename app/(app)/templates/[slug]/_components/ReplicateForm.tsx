'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { withDownloadParam } from '@/lib/storage/download-url'
import { Button } from '@/components/ui/button'

type ResultAsset = { signedUrl: string; width: number | null; height: number | null }

type Envelope<T> = { data: T | null; error: { code: string; message: string } | null }
type CreateData = { job: { id: string; status: string } }
type DetailData = {
  job: { id: string; status: string; error: { code: string; message: string } | null }
  assets: ResultAsset[]
}

const POLL_INTERVAL_MS = 1_500
const POLL_TIMEOUT_MS = 60_000 // ADR-005

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function ReplicateForm({
  templateId,
  placeholder,
  initialKeyword,
}: {
  templateId: string
  placeholder?: string | null
  initialKeyword?: string
}) {
  const router = useRouter()
  const [keyword, setKeyword] = useState(initialKeyword ?? '')
  const [phase, setPhase] = useState<'idle' | 'working'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [assets, setAssets] = useState<ResultAsset[] | null>(null)
  const jobIdRef = useRef<string | null>(null)
  const canceledRef = useRef(false)
  const shownAt = useRef<number | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPhase('working')
    setError(null)
    canceledRef.current = false
    try {
      const res = await fetch('/api/v1/generations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ templateId, keyword: keyword.trim() }),
      })
      const body = (await res.json()) as Envelope<CreateData>
      if (!res.ok || !body.data) throw new Error(body.error?.message ?? '创建任务失败，请重试')
      const jobId = body.data.job.id
      jobIdRef.current = jobId
      // 创建即扣费——刷新 RSC，顶栏余额/配额读数立即同步。
      router.refresh()

      const deadline = Date.now() + POLL_TIMEOUT_MS
      let consecutiveFailures = 0
      while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS)
        if (canceledRef.current) return
        // Tolerate transient poll failures — one network blip out of ~40 polls
        // must not report a generation as failed while the job succeeds server-side.
        let poll: Envelope<DetailData>
        try {
          const pollRes = await fetch(`/api/v1/generations/${jobId}`)
          poll = (await pollRes.json()) as Envelope<DetailData>
          if (!pollRes.ok || !poll.data) throw new Error(poll.error?.message ?? '查询任务失败，请重试')
          consecutiveFailures = 0
        } catch (pollErr) {
          consecutiveFailures += 1
          if (consecutiveFailures >= 3) throw pollErr
          continue
        }
        const { job, assets: doneAssets } = poll.data
        if (job.status === 'succeeded') {
          setAssets(doneAssets)
          shownAt.current = Date.now()
          return
        }
        if (job.status === 'failed') {
          // 失败可能触发积分回补——刷新读数。
          router.refresh()
          throw new Error(job.error?.message ?? '生成失败，请重试')
        }
        if (job.status === 'canceled') throw new Error('任务已取消')
      }
      throw new Error('生成超时——任务仍在后台运行，稍后可在作品库查看结果')
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试')
    } finally {
      setPhase('idle')
      jobIdRef.current = null
    }
  }

  async function cancelGeneration() {
    const jobId = jobIdRef.current
    if (!jobId) return
    canceledRef.current = true
    try {
      await fetch(`/api/v1/generations/${jobId}/cancel`, { method: 'POST' })
    } catch {
      // best-effort; polling already stopped via canceledRef
    }
    setPhase('idle')
    setError('任务已取消')
  }

  function replicateAgain() {
    // 60s 内重试 = docs/00-vision「成功复刻」成功度量。上报到埋点 beacon（fire-and-forget）。
    if (shownAt.current) {
      const elapsedMs = Date.now() - shownAt.current
      void fetch('/api/v1/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event: 'replicate_again',
          props: { templateId, withinWindow: elapsedMs <= 60_000, elapsedMs },
        }),
        keepalive: true,
      }).catch(() => {})
    }
    setAssets(null)
    setKeyword('')
    setError(null)
    shownAt.current = null
  }

  if (assets && assets.length > 0) {
    return (
      <div className="flex flex-col gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assets[0].signedUrl} alt="复刻结果" className="w-full rounded-xl border border-border" />
        <div className="flex gap-3">
          <Button nativeButton={false} render={<a href={withDownloadParam(assets[0].signedUrl)} download />}>
            下载图片
          </Button>
          <Button type="button" variant="outline" onClick={replicateAgain}>
            再次复刻
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label htmlFor="keyword" className="text-sm font-medium">
        主体关键词
      </label>
      <input
        id="keyword"
        name="keyword"
        type="text"
        required
        maxLength={60}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder={placeholder ?? '输入你想复刻的主体，例如：一只柴犬'}
        className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      <p className="font-mono text-xs text-muted-foreground tabular-nums">{keyword.length}/60</p>
      <div className="flex gap-3">
        <Button type="submit" variant="brand" disabled={phase === 'working'}>
          {phase === 'working' ? '生成中…' : '一键复刻'}
        </Button>
        {phase === 'working' ? (
          <Button type="button" variant="outline" onClick={cancelGeneration}>
            取消
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  )
}
