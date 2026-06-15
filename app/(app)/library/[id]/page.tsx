import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withDownloadParam } from '@/lib/storage/download-url'
import { toJobView, type JobViewRow } from '@/lib/generation/job-view'
import { JOB_STATUS_LABELS, type JobStatus } from '@/lib/generation/status'
import { Button } from '@/components/ui/button'
import { JobActions } from './_components/JobActions'

// 状态色：失败用警示色，进行中走品牌红线，终态/取消归静默。
function statusTone(status: string) {
  if (status === 'failed') return 'text-destructive'
  if (status === 'pending' || status === 'running') return 'text-brand'
  return 'text-muted-foreground'
}

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

  const statusLabel = JOB_STATUS_LABELS[job.status as JobStatus] ?? job.status

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <Link
        href="/library"
        className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        ← 返回作品库
      </Link>

      <div className="mt-6 flex flex-col gap-6">
        {assets[0] ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={assets[0].signedUrl}
            alt={job.keyword ?? '生成结果'}
            className="w-full rounded-[2px] ring-1 ring-foreground/10 ring-inset"
          />
        ) : (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-[2px] bg-secondary ring-1 ring-foreground/10 ring-inset">
            <span className={`font-mono text-sm ${statusTone(job.status)}`}>{statusLabel}</span>
            {job.error ? <span className="text-xs text-muted-foreground">{job.error.message}</span> : null}
          </div>
        )}

        <dl className="grid grid-cols-[5rem_1fr] gap-y-3 border-y border-border py-4 text-sm">
          <dt className="font-mono text-xs text-muted-foreground">关键词</dt>
          <dd className="font-medium">{job.keyword ?? '自由创作'}</dd>
          <dt className="font-mono text-xs text-muted-foreground">模板</dt>
          <dd>
            {template ? (
              <Link href={`/templates/${template.slug}`} className="underline underline-offset-4 hover:text-brand">
                {template.title}
              </Link>
            ) : (
              '—'
            )}
          </dd>
          <dt className="font-mono text-xs text-muted-foreground">状态</dt>
          <dd className={statusTone(job.status)}>{statusLabel}</dd>
          <dt className="font-mono text-xs text-muted-foreground">创建时间</dt>
          <dd className="font-mono text-xs tabular-nums">
            {new Date(job.createdAt).toLocaleString('zh-CN', { hour12: false })}
          </dd>
        </dl>

        <div className="flex flex-wrap items-center gap-3">
          {assets[0] ? (
            <Button nativeButton={false} render={<a href={withDownloadParam(assets[0].signedUrl)} download />}>
              下载图片
            </Button>
          ) : null}
          {template && job.keyword ? (
            <Button
              variant="brand"
              nativeButton={false}
              render={<Link href={`/templates/${template.slug}?keyword=${encodeURIComponent(job.keyword)}`} />}
            >
              再次复刻
            </Button>
          ) : null}
        </div>

        <JobActions jobId={job.id} status={job.status as JobStatus} />
      </div>
    </main>
  )
}
