'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Envelope<T> = { data: T | null; error: { code: string; message: string } | null }

export function GrantCreditsForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!Number.isInteger(n) || n < 1) {
      setError('需为正整数')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}/grant-credits`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: n }),
      })
      const body = (await res.json()) as Envelope<{ balance: number }>
      if (!res.ok || !body.data) throw new Error(body.error?.message ?? '加分失败')
      setAmount('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '加分失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        max={10000}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="积分"
        className="w-20 rounded border border-neutral-300 px-2 py-1 text-xs"
      />
      <button
        type="submit"
        disabled={busy || !amount}
        className="rounded bg-neutral-900 px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-40"
      >
        加分
      </button>
      {error ? <span className="text-xs text-red-500">{error}</span> : null}
    </form>
  )
}
