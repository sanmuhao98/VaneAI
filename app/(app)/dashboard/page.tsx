import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/actions'

export default async function Dashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">已登录</h1>
      <p className="text-muted-foreground">
        欢迎，<span className="font-medium text-foreground">{user?.email}</span>
      </p>
      <Link
        href="/templates"
        className="self-start rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        进入模板库
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="self-start rounded-full border border-border px-5 py-2 text-sm font-medium hover:bg-muted"
        >
          登出
        </button>
      </form>
    </main>
  )
}
