import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const allowed = serverEnv.ADMIN_EMAILS
    ? serverEnv.ADMIN_EMAILS.split(',').map((e) => e.trim()).filter(Boolean)
    : []

  if (!user.email || !allowed.includes(user.email)) {
    redirect('/dashboard')
  }

  return <div className="min-h-svh bg-background">{children}</div>
}
