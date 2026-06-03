'use client'

import { useActionState } from 'react'
import { signInWithMagicLink } from '@/app/auth/actions'

type State = { error?: string; sent?: boolean } | null

export function MagicLinkForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(signInWithMagicLink, null)

  if (state?.sent) {
    return (
      <p className="rounded-md border border-border bg-muted px-4 py-3 text-sm">
        登录链接已发送，请查收邮箱（本地开发：
        <a className="underline" href="http://localhost:54324" target="_blank" rel="noreferrer">
          Inbucket
        </a>
        ）。
      </p>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="text-sm font-medium" htmlFor="email">
        邮箱
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? '发送中…' : '发送 Magic Link'}
      </button>
      {state?.error ? <p className="text-sm text-red-500">{state.error}</p> : null}
    </form>
  )
}
