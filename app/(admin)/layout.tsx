import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { isAdminEmail } from '@/lib/api/admin-allowlist'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }
  if (!isAdminEmail(user.email, serverEnv.ADMIN_EMAILS)) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-svh bg-background">
      <nav className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3 text-sm">
          <span className="font-semibold">VaneAI Admin</span>
          <Link href="/admin/jobs" className="text-neutral-600 hover:text-neutral-900">
            任务
          </Link>
          <Link href="/admin/users" className="text-neutral-600 hover:text-neutral-900">
            用户
          </Link>
          <Link href="/dashboard" className="ml-auto text-neutral-400 hover:text-neutral-900">
            ← 返回应用
          </Link>
        </div>
      </nav>
      {children}
    </div>
  )
}
