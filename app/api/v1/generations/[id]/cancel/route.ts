import { apiFail, apiOk } from '@/lib/api/response'
import { getAuthUser } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canCancel, type JobStatus } from '@/lib/generation/status'

// Best-effort cancel (docs/05): only pending/running. Credits are NOT auto-refunded.
// The worker checks for `canceled` before starting and before writing results.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user) return apiFail('unauthorized', '请先登录', 401)
  const { id } = await params

  // Ownership via user-client read (RLS).
  const supabase = await createClient()
  const { data: job } = await supabase.from('generation_jobs').select('id, status').eq('id', id).maybeSingle()
  if (!job) return apiFail('not_found', '任务不存在', 404)
  if (!canCancel(job.status as JobStatus)) return apiFail('validation_error', '该任务已结束，无法取消', 400)

  const { error } = await createAdminClient()
    .from('generation_jobs')
    .update({ status: 'canceled', finished_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['pending', 'running']) // guard against races with the worker
  if (error) {
    console.error('[generations:cancel] failed', error)
    return apiFail('internal_error', '取消失败，请重试', 500)
  }
  return apiOk({ id, status: 'canceled' })
}
