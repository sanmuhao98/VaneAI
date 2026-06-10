'use client'

import { useRef, useState } from 'react'
import { withDownloadParam } from '@/lib/storage/download-url'

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

      const deadline = Date.now() + POLL_TIMEOUT_MS
      while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS)
        if (canceledRef.current) return
        const pollRes = await fetch(`/api/v1/generations/${jobId}`)
        const poll = (await pollRes.json()) as Envelope<DetailData>
        if (!pollRes.ok || !poll.data) throw new Error(poll.error?.message ?? '查询任务失败，请重试')
        const { job, assets: doneAssets } = poll.data
        if (job.status === 'succeeded') {
          setAssets(doneAssets)
          shownAt.current = Date.now()
          return
        }
        if (job.status === 'failed') throw new Error(job.error?.message ?? '生成失败，请重试')
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
    // 60s retry instrumentation — success metric per docs/00-vision. W5 wires real analytics.
    if (shownAt.current) {
      const elapsed = Date.now() - shownAt.current
      console.info('[metric] replicate_again', { withinWindow: elapsed <= 60_000, elapsedMs: elapsed })
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
        <img src={assets[0].signedUrl} alt="复刻结果" className="w-full rounded-xl border border-neutral-200" />
        <div className="flex gap-3">
          <a
            href={withDownloadParam(assets[0].signedUrl)}
            download
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            下载图片
          </a>
          <button
            type="button"
            onClick={replicateAgain}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
          >
            再次复刻
          </button>
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
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
      />
      <p className="text-xs text-neutral-400">{keyword.length}/60</p>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={phase === 'working'}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {phase === 'working' ? '生成中…' : '一键复刻'}
        </button>
        {phase === 'working' ? (
          <button
            type="button"
            onClick={cancelGeneration}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
          >
            取消
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </form>
  )
}
