'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * 内测激活门（ADR-019）：编辑式空状态（§8）——这一期凭码入场。
 * 兑换成功 router.refresh() 重渲 (app) layout 放行。
 */
export function InviteGate({ email }: { email: string }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function redeem(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/invite/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const json = (await res.json()) as { error: { message: string } | null }
      if (!res.ok || json.error) {
        setError(json.error?.message ?? '兑换失败，请重试')
        return
      }
      router.refresh()
    } catch {
      setError('网络异常，请重试')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        {/* 对位十字题花 */}
        <p aria-hidden className="font-mono text-sm text-muted-foreground select-none">
          ✛
        </p>
        <h1 className="mt-4 font-heading text-3xl font-black text-balance sm:text-4xl">本期凭码入场</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          VaneAI 正在小范围内测。你已用 <span className="font-mono text-foreground">{email}</span> 登录，
          输入邀请码即可入场；没有码可以找邀请你的朋友要一个。
        </p>

        <form onSubmit={redeem} className="mt-8">
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="VANE-XXXX"
              autoFocus
              required
              maxLength={64}
              aria-label="邀请码"
              aria-invalid={error ? true : undefined}
              className="h-11 flex-1 text-center font-mono text-sm tracking-[0.2em] uppercase"
            />
            <Button type="submit" disabled={pending || code.trim().length === 0} className="h-11 px-5">
              {pending ? '验证中…' : '入场'}
            </Button>
          </div>
          <p aria-live="polite" className="mt-3 min-h-5 text-sm text-destructive">
            {error}
          </p>
        </form>

        <p className="border-t border-border pt-4 font-mono text-xs text-muted-foreground">
          BETA · 名额有限 · 注册已送 100 积分，入场即可使用
        </p>
      </div>
    </main>
  )
}
