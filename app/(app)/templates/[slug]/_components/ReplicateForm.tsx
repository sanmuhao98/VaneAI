'use client'

import { useRef, useState } from 'react'

type ResultAsset = { signedUrl: string; width: number; height: number }

export function ReplicateForm({
  templateId,
  placeholder,
}: {
  templateId: string
  placeholder?: string | null
}) {
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assets, setAssets] = useState<ResultAsset[] | null>(null)
  const shownAt = useRef<number | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/generations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ templateId, keyword: keyword.trim() }),
      })
      const data = (await res.json()) as { assets?: ResultAsset[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? '生成失败，请重试')
      setAssets(data.assets ?? [])
      shownAt.current = Date.now()
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试')
    } finally {
      setLoading(false)
    }
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
            href={assets[0].signedUrl}
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
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? '生成中…' : '一键复刻'}
      </button>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </form>
  )
}
