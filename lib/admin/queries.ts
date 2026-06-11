import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// Admin-only cross-user queries. Callers MUST be guarded by getAdminUser() /
// the (admin) layout — these run on the service_role client with no RLS.

export type AdminJobRow = {
  id: string
  userId: string
  status: string
  keyword: string | null
  provider: string
  model: string
  creditsCost: number
  errorCode: string | null
  createdAt: string
  finishedAt: string | null
  deletedAt: string | null
}

export async function listAllJobs(opts: {
  cursor?: string
  status?: string
  limit?: number
}): Promise<{ jobs: AdminJobRow[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100)
  const admin = createAdminClient()
  let q = admin
    .from('generation_jobs')
    .select('id, user_id, status, input, provider, model, credits_cost, error, created_at, finished_at, deleted_at')
    .order('created_at', { ascending: false })
    .limit(limit + 1)
  if (opts.cursor && !Number.isNaN(Date.parse(opts.cursor))) q = q.lt('created_at', opts.cursor)
  if (opts.status) q = q.eq('status', opts.status)
  const { data: rows, error } = await q
  if (error) throw error

  const page = (rows ?? []).slice(0, limit)
  return {
    jobs: page.map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      status: r.status as string,
      keyword: ((r.input as { keyword?: string })?.keyword as string) ?? null,
      provider: r.provider as string,
      model: r.model as string,
      creditsCost: r.credits_cost as number,
      errorCode: ((r.error as { code?: string }) ?? {}).code ?? null,
      createdAt: r.created_at as string,
      finishedAt: r.finished_at as string | null,
      deletedAt: r.deleted_at as string | null,
    })),
    nextCursor: (rows ?? []).length > limit ? (page[page.length - 1].created_at as string) : null,
  }
}

export type AdminUserRow = {
  id: string
  email: string | null
  creditsBalance: number
  inviteCode: string | null
  createdAt: string
}

export async function listUsers(opts: { page?: number; perPage?: number } = {}): Promise<{
  users: AdminUserRow[]
  page: number
  hasMore: boolean
}> {
  const page = Math.max(opts.page ?? 1, 1)
  const perPage = Math.min(Math.max(opts.perPage ?? 50, 1), 100)
  const admin = createAdminClient()

  const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
  if (error) throw error
  const authUsers = data.users

  const ids = authUsers.map((u) => u.id)
  const balances = new Map<string, number>()
  const inviteCodes = new Map<string, string | null>()
  if (ids.length) {
    const { data: profiles, error: pErr } = await admin
      .from('profiles')
      .select('id, credits_balance, invite_code')
      .in('id', ids)
    if (pErr) throw pErr
    for (const p of profiles ?? []) {
      balances.set(p.id as string, p.credits_balance as number)
      inviteCodes.set(p.id as string, (p.invite_code as string | null) ?? null)
    }
  }

  return {
    users: authUsers.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      creditsBalance: balances.get(u.id) ?? 0,
      inviteCode: inviteCodes.get(u.id) ?? null,
      createdAt: u.created_at,
    })),
    page,
    hasMore: authUsers.length === perPage,
  }
}
