import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listJobs } from '@/lib/generation/list-jobs'
import { JOB_STATUS_LABELS, type JobStatus } from '@/lib/generation/status'

const FILTERS = [
  { key: undefined, label: '全部' },
  { key: 'succeeded', label: '已完成' },
  { key: 'failed', label: '失败' },
] as const

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; status?: string }>
}) {
  const { cursor, status } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // (app) layout already redirects unauthenticated users.
  const { jobs, nextCursor } = await listJobs({ userId: user!.id, cursor, status })

  const qs = (next: { cursor?: string | null; status?: string }) => {
    const p = new URLSearchParams()
    const s = 'status' in next ? next.status : status
    if (s) p.set('status', s)
    if (next.cursor) p.set('cursor', next.cursor)
    const str = p.toString()
    return str ? `/library?${str}` : '/library'
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">我的作品</h1>
        <Link href="/templates" className="text-sm text-neutral-500 hover:text-neutral-900">
          去复刻 →
        </Link>
      </div>

      <nav className="mt-6 flex gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={qs({ status: f.key, cursor: null })}
            className={`rounded-full border px-4 py-1.5 text-sm ${status === f.key || (!status && !f.key) ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 hover:bg-neutral-100'}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3">
        {jobs.map((j) => (
          <Link
            key={j.id}
            href={`/library/${j.id}`}
            className="group overflow-hidden rounded-xl border border-neutral-200 transition hover:shadow-md"
          >
            {j.previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={j.previewUrl} alt={j.keyword ?? '生成结果'} className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-neutral-100 text-sm text-neutral-400">
                {JOB_STATUS_LABELS[j.status as JobStatus] ?? j.status}
              </div>
            )}
            <div className="p-3">
              <p className="truncate text-sm font-medium">{j.keyword ?? '—'}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {JOB_STATUS_LABELS[j.status as JobStatus] ?? j.status} ·{' '}
                {new Date(j.createdAt).toLocaleString('zh-CN', { hour12: false })}
              </p>
            </div>
          </Link>
        ))}
        {jobs.length === 0 ? (
          <p className="col-span-full text-neutral-400">
            还没有作品。<Link href="/templates" className="underline">去模板库复刻一张</Link>。
          </p>
        ) : null}
      </div>

      {nextCursor ? (
        <div className="mt-8">
          <Link
            href={qs({ cursor: nextCursor })}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
          >
            加载更多
          </Link>
        </div>
      ) : null}
    </main>
  )
}
