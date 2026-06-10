import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { signOut } from '@/app/auth/actions'
import { isAdminEmail } from '@/lib/api/admin-allowlist'
import { DAILY_FREE_LIMIT } from '@/lib/generation/quota'

export default async function Dashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: profile }, { data: quota }] = await Promise.all([
    supabase.from('profiles').select('credits_balance').eq('id', user!.id).maybeSingle(),
    supabase
      .from('daily_quota')
      .select('count')
      .eq('user_id', user!.id)
      .eq('day', new Date().toISOString().slice(0, 10))
      .maybeSingle(),
  ])

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">已登录</h1>
      <p className="text-muted-foreground">
        欢迎，<span className="font-medium text-foreground">{user?.email}</span>
      </p>
      <p className="text-sm text-neutral-600">
        积分余额 <span className="font-semibold text-neutral-900">{profile?.credits_balance ?? 0}</span>
        <span className="mx-2 text-neutral-300">·</span>
        今日已用 {quota?.count ?? 0}/{DAILY_FREE_LIMIT}
      </p>
      <div className="flex gap-3">
        <Link
          href="/templates"
          className="self-start rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          进入模板库
        </Link>
        <Link
          href="/library"
          className="self-start rounded-full border border-border px-5 py-2 text-sm font-medium hover:bg-muted"
        >
          我的作品
        </Link>
        {isAdminEmail(user?.email, serverEnv.ADMIN_EMAILS) ? (
          <Link
            href="/admin/jobs"
            className="self-start rounded-full border border-dashed border-neutral-400 px-5 py-2 text-sm font-medium text-neutral-600 hover:bg-muted"
          >
            Admin
          </Link>
        ) : null}
      </div>
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
