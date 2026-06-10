import { apiFail, apiOk } from '@/lib/api/response'
import { requireUser } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toJobView, type JobViewRow } from '@/lib/generation/job-view'

// Poll target (ADR-005). Reads go through the USER client so RLS enforces
// ownership and the soft-delete filter; signed URLs are issued via admin.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return apiFail('unauthorized', '请先登录', 401)
  const { id } = await params

  const supabase = await createClient()
  const { data: job, error } = await supabase
    .from('generation_jobs')
    .select('id, status, type, template_id, input, error, created_at, finished_at')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('[generations:id] query failed', error)
    return apiFail('internal_error', '查询失败，请重试', 500)
  }
  if (!job) return apiFail('not_found', '任务不存在', 404)

  let assets: { id: string; signedUrl: string; width: number | null; height: number | null }[] = []
  if (job.status === 'succeeded') {
    const { data: rows } = await supabase
      .from('assets')
      .select('id, storage_bucket, storage_path, width, height')
      .eq('job_id', id)
      .order('created_at')
    if (rows?.length) {
      const admin = createAdminClient()
      const { data: signed, error: sErr } = await admin.storage
        .from(rows[0].storage_bucket)
        .createSignedUrls(
          rows.map((r) => r.storage_path),
          3600,
        )
      if (sErr) {
        console.error('[generations:id] sign failed', sErr)
        return apiFail('internal_error', '查询失败，请重试', 500)
      }
      assets = rows.flatMap((r, i) => {
        const url = signed[i]?.signedUrl
        return url ? [{ id: r.id as string, signedUrl: url, width: r.width, height: r.height }] : []
      })
    }
  }

  return apiOk({ job: toJobView(job as JobViewRow), assets })
}
