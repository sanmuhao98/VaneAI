import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withDownloadParam } from '@/lib/storage/download-url'
import { toJobView, type JobViewRow } from '@/lib/generation/job-view'
import { JOB_STATUS_LABELS, type JobStatus } from '@/lib/generation/status'
import { JobActions } from './_components/JobActions'

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // User client: RLS enforces ownership and hides soft-deleted rows.
  const { data: row } = await supabase
    .from('generation_jobs')
    .select('id, status, type, template_id, input, error, created_at, finished_at')
    .eq('id', id)
    .maybeSingle()
  if (!row) notFound()
  const job = toJobView(row as JobViewRow)

  let template: { slug: string; title: string } | null = null
  if (job.templateId) {
    const { data: t } = await supabase
      .from('templates_public')
      .select('slug, title')
      .eq('id', job.templateId)
      .maybeSingle()
    template = t ?? null
  }

  let assets: { id: string; signedUrl: string }[] = []
  if (job.status === 'succeeded') {
    const { data: rows } = await supabase
      .from('assets')
      .select('id, storage_bucket, storage_path')
      .eq('job_id', id)
      .order('created_at')
    if (rows?.length) {
      const admin = createAdminClient()
      const { data: signed } = await admin.storage
        .from(rows[0].storage_bucket)
        .createSignedUrls(
          rows.map((r) => r.storage_path),
          3600,
        )
      assets = rows.flatMap((r, i) => {
        const url = signed?.[i]?.signedUrl
        return url ? [{ id: r.id as string, signedUrl: url }] : []
      })
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/library" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← 返回作品库
      </Link>

      <div className="mt-6 flex flex-col gap-6">
        {assets[0] ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={assets[0].signedUrl}
            alt={job.keyword ?? '生成结果'}
            className="w-full rounded-xl border border-neutral-200"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
            {JOB_STATUS_LABELS[job.status as JobStatus] ?? job.status}
            {job.error ? ` · ${job.error.message}` : ''}
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-neutral-500">关键词</dt>
          <dd className="font-medium">{job.keyword ?? '—'}</dd>
          <dt className="text-neutral-500">模板</dt>
          <dd>
            {template ? (
              <Link href={`/templates/${template.slug}`} className="underline">
                {template.title}
              </Link>
            ) : (
              '—'
            )}
          </dd>
          <dt className="text-neutral-500">状态</dt>
          <dd>{JOB_STATUS_LABELS[job.status as JobStatus] ?? job.status}</dd>
          <dt className="text-neutral-500">创建时间</dt>
          <dd>{new Date(job.createdAt).toLocaleString('zh-CN', { hour12: false })}</dd>
        </dl>

        <div className="flex flex-wrap items-center gap-3">
          {assets[0] ? (
            <a
              href={withDownloadParam(assets[0].signedUrl)}
              download
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              下载图片
            </a>
          ) : null}
          {template && job.keyword ? (
            <Link
              href={`/templates/${template.slug}?keyword=${encodeURIComponent(job.keyword)}`}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
            >
              再次复刻
            </Link>
          ) : null}
        </div>

        <JobActions jobId={job.id} status={job.status as JobStatus} />
      </div>
    </main>
  )
}
