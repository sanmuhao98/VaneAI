import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { toJobView, type JobViewRow } from './job-view'

export type ListedJob = ReturnType<typeof toJobView> & { previewUrl: string | null }

const VALID_STATUSES = new Set(['pending', 'running', 'succeeded', 'failed', 'canceled'])

// Shared by the /library RSC page and GET /api/v1/generations. Cursor = created_at
// ISO of the last row (keyset pagination on idx_jobs_user_created, no OFFSET).
//
// ⚠️ Reads here use the ADMIN client (signed URLs need it anyway), so RLS does NOT
// apply — every filter RLS would enforce (user_id, deleted_at) must be replicated
// by hand below. Any new filter/join added to this query must keep that in mind.
export async function listJobs(opts: {
  userId: string
  cursor?: string
  limit?: number
  status?: string
}): Promise<{ jobs: ListedJob[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50)
  // Drop malformed params instead of letting Postgres cast errors 500 the caller
  // (the RSC page passes raw searchParams; the API route also zod-validates).
  const status = opts.status && VALID_STATUSES.has(opts.status) ? opts.status : undefined
  const cursor = opts.cursor && !Number.isNaN(Date.parse(opts.cursor)) ? opts.cursor : undefined
  const admin = createAdminClient()

  let q = admin
    .from('generation_jobs')
    .select('id, status, type, template_id, input, error, created_at, finished_at')
    .eq('user_id', opts.userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit + 1)
  if (cursor) q = q.lt('created_at', cursor)
  if (status) q = q.eq('status', status)
  const { data: rows, error } = await q
  if (error) throw error

  const page = (rows ?? []).slice(0, limit)
  const nextCursor = (rows ?? []).length > limit ? (page[page.length - 1].created_at as string) : null

  // First asset per succeeded job, signed in one batch.
  const succeededIds = page.filter((r) => r.status === 'succeeded').map((r) => r.id as string)
  const previews = new Map<string, string>()
  if (succeededIds.length) {
    const { data: assets } = await admin
      .from('assets')
      .select('job_id, storage_bucket, storage_path, created_at')
      .in('job_id', succeededIds)
      .order('created_at')
    const first = new Map<string, { bucket: string; path: string }>()
    for (const a of assets ?? []) {
      if (!first.has(a.job_id as string)) {
        first.set(a.job_id as string, { bucket: a.storage_bucket as string, path: a.storage_path as string })
      }
    }
    const entries = [...first.entries()]
    if (entries.length) {
      // Single-bucket batch signing: today every generated asset lives in
      // `generations`. If a second bucket ever appears, group entries by bucket.
      const { data: signed } = await admin.storage
        .from(entries[0][1].bucket)
        .createSignedUrls(
          entries.map(([, v]) => v.path),
          3600,
        )
      entries.forEach(([jobId], i) => {
        const url = signed?.[i]?.signedUrl
        if (url) previews.set(jobId, url)
      })
    }
  }

  return {
    jobs: page.map((r) => ({ ...toJobView(r as JobViewRow), previewUrl: previews.get(r.id as string) ?? null })),
    nextCursor,
  }
}
