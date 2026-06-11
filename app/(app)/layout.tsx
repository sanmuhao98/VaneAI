import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { isAdminEmail } from '@/lib/api/admin-allowlist'
import { inviteGateBlocks } from '@/lib/invites/gate'
import { DAILY_FREE_LIMIT } from '@/lib/generation/quota'
import { AppNav } from '@/components/layout/app-nav'
import { UserMenu } from '@/components/layout/user-menu'
import { InviteGate } from '@/components/invites/invite-gate'
import { Button } from '@/components/ui/button'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const [{ data: profile }, { data: quota }] = await Promise.all([
    supabase.from('profiles').select('credits_balance, invite_activated_at').eq('id', user.id).maybeSingle(),
    supabase
      .from('daily_quota')
      .select('count')
      .eq('user_id', user.id)
      .eq('day', new Date().toISOString().slice(0, 10))
      .maybeSingle(),
  ])

  const credits = profile?.credits_balance ?? 0
  const used = quota?.count ?? 0
  const isAdmin = isAdminEmail(user.email, serverEnv.ADMIN_EMAILS)
  // 内测激活门（ADR-019）：门在 layout，整个 (app) 区一致受控；admin 旁路。
  const gated = inviteGateBlocks(serverEnv.INVITE_GATE, profile?.invite_activated_at ?? null, isAdmin)

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        {/* 朱红报头双线：VaneAI 的刊物身份 */}
        <div aria-hidden>
          <div className="h-[3px] w-full bg-brand" />
          <div className="mt-[2px] h-px w-full bg-brand" />
        </div>
        <div className="mx-auto flex h-14 w-full max-w-6xl items-stretch gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
          {/* 刊头即标志：衬线词标，不用图形 logo */}
          <Link
            href="/templates"
            className="flex shrink-0 items-center outline-none focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-title.png" alt="VaneAI" className="h-7 w-auto select-none" />
          </Link>

          <AppNav />

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
            <span
              className="hidden items-center gap-1.5 font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums sm:flex"
              title={`积分余额 ${credits} · 今日免费额度已用 ${used}/${DAILY_FREE_LIMIT}`}
            >
              <span className="text-foreground">CR {credits}</span>
              <span aria-hidden>·</span>
              <span>
                今日 {used}/{DAILY_FREE_LIMIT}
              </span>
              <span className="sr-only">
                积分余额 {credits}，今日免费额度已用 {used}/{DAILY_FREE_LIMIT}
              </span>
            </span>

            {/* 全站唯一常驻品牌色元素：生成主入口 */}
            <Button
              variant="brand"
              nativeButton={false}
              className="h-10 px-3 sm:px-4 md:h-9"
              render={<Link href="/create" />}
            >
              <span className="hidden sm:inline">开始创作</span>
              <span className="sm:hidden">创作</span>
            </Button>

            <UserMenu email={user.email ?? ''} isAdmin={isAdmin} />
          </div>
        </div>
      </header>

      {/* Pages render their own <main>; this is just the flex slot. */}
      <div className="flex flex-1 flex-col">{gated ? <InviteGate email={user.email ?? ''} /> : children}</div>
    </div>
  )
}
