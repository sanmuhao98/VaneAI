import { apiFail, apiOk } from '@/lib/api/response'
import { getAuthUser } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { DAILY_FREE_LIMIT } from '@/lib/generation/quota'

// docs/05 §GET /api/v1/me — profile + balance + today's quota usage.
// All reads via the user client: RLS scopes profiles/daily_quota to the owner.
export async function GET() {
  const user = await getAuthUser()
  if (!user) return apiFail('unauthorized', '请先登录', 401)

  const supabase = await createClient()
  const [{ data: profile }, { data: quota }] = await Promise.all([
    supabase.from('profiles').select('display_name, avatar_url, credits_balance').eq('id', user.id).maybeSingle(),
    supabase
      .from('daily_quota')
      .select('count')
      .eq('user_id', user.id)
      .eq('day', new Date().toISOString().slice(0, 10))
      .maybeSingle(),
  ])

  return apiOk({
    user: {
      id: user.id,
      email: user.email,
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    },
    credits: {
      balance: profile?.credits_balance ?? 0,
      todayUsed: quota?.count ?? 0,
      todayLimit: DAILY_FREE_LIMIT,
    },
  })
}
