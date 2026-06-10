import Link from 'next/link'
import { listAllJobs } from '@/lib/admin/queries'
import { JOB_STATUS_LABELS, type JobStatus } from '@/lib/generation/status'

const FILTERS = ['pending', 'running', 'succeeded', 'failed', 'canceled'] as const

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; status?: string }>
}) {
  const { cursor, status } = await searchParams
  const safeStatus = FILTERS.includes(status as (typeof FILTERS)[number]) ? status : undefined
  const { jobs, nextCursor } = await listAllJobs({ cursor, status: safeStatus })

  const qs = (next: { cursor?: string | null; status?: string }) => {
    const p = new URLSearchParams()
    const s = 'status' in next ? next.status : safeStatus
    if (s) p.set('status', s)
    if (next.cursor) p.set('cursor', next.cursor)
    const str = p.toString()
    return str ? `/admin/jobs?${str}` : '/admin/jobs'
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight">任务（全部用户）</h1>
      <p className="mt-1 text-sm text-neutral-500">
        失败任务行内只有脱敏错误码——原始报错在服务端日志按 jobId 检索。
      </p>

      <nav className="mt-4 flex gap-2">
        <Link
          href={qs({ status: undefined, cursor: null })}
          className={`rounded-full border px-3 py-1 text-xs ${!safeStatus ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300'}`}
        >
          全部
        </Link>
        {FILTERS.map((s) => (
          <Link
            key={s}
            href={qs({ status: s, cursor: null })}
            className={`rounded-full border px-3 py-1 text-xs ${safeStatus === s ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300'}`}
          >
            {JOB_STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="py-2 pr-3">jobId</th>
            <th className="py-2 pr-3">用户</th>
            <th className="py-2 pr-3">关键词</th>
            <th className="py-2 pr-3">状态</th>
            <th className="py-2 pr-3">错误码</th>
            <th className="py-2 pr-3">provider</th>
            <th className="py-2 pr-3">积分</th>
            <th className="py-2">创建时间</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-b border-neutral-100">
              <td className="py-2 pr-3 font-mono text-xs text-neutral-500">{j.id.slice(0, 8)}…</td>
              <td className="py-2 pr-3 font-mono text-xs text-neutral-500">{j.userId.slice(0, 8)}…</td>
              <td className="max-w-40 truncate py-2 pr-3">{j.keyword ?? '—'}</td>
              <td className="py-2 pr-3">
                {JOB_STATUS_LABELS[j.status as JobStatus] ?? j.status}
                {j.deletedAt ? <span className="ml-1 text-xs text-neutral-400">(已删)</span> : null}
              </td>
              <td className="py-2 pr-3 font-mono text-xs">{j.errorCode ?? '—'}</td>
              <td className="py-2 pr-3">{j.provider}</td>
              <td className="py-2 pr-3">{j.creditsCost}</td>
              <td className="py-2 text-xs text-neutral-500">
                {new Date(j.createdAt).toLocaleString('zh-CN', { hour12: false })}
              </td>
            </tr>
          ))}
          {jobs.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-6 text-center text-neutral-400">
                没有匹配的任务。
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {nextCursor ? (
        <div className="mt-6">
          <Link
            href={qs({ cursor: nextCursor })}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
          >
            加载更多
          </Link>
        </div>
      ) : null}
    </main>
  )
}
