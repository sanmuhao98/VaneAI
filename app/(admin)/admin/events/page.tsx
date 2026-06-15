import { eventCounts, listRecentEvents } from '@/lib/admin/queries'

const EVENT_LABELS: Record<string, string> = {
  signup: '注册',
  generation_created: '发起生成',
  generation_succeeded: '生成成功',
  generation_failed: '生成失败',
  generation_canceled: '取消',
  job_deleted: '删除',
  replicate_again: '再次复刻(60s)',
}

const labelOf = (event: string) => EVENT_LABELS[event] ?? event

export default async function AdminEventsPage() {
  const [counts, events] = await Promise.all([eventCounts(), listRecentEvents(100)])

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight">埋点</h1>
      <p className="mt-1 text-sm text-neutral-500">
        关键指标事件总览 + 最近 100 条。「首次/N 次生成」按用户对 发起生成 计数即得。
      </p>

      {/* 累计计数总览 */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {counts.map((c) => (
          <div key={c.event} className="rounded-lg border border-neutral-200 px-3 py-2.5">
            <p className="text-xs text-neutral-500">{labelOf(c.event)}</p>
            <p className="mt-0.5 font-mono text-lg tabular-nums">{c.count}</p>
          </div>
        ))}
      </div>

      {/* 最近事件流 */}
      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="py-2 pr-3">事件</th>
            <th className="py-2 pr-3">用户</th>
            <th className="py-2 pr-3">属性</th>
            <th className="py-2">时间</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b border-neutral-100 align-top">
              <td className="py-2 pr-3 whitespace-nowrap">{labelOf(e.event)}</td>
              <td className="py-2 pr-3 font-mono text-xs text-neutral-500">{e.userId ? `${e.userId.slice(0, 8)}…` : '—'}</td>
              <td className="max-w-md py-2 pr-3 font-mono text-xs break-all text-neutral-600">
                {Object.keys(e.props).length ? JSON.stringify(e.props) : '—'}
              </td>
              <td className="py-2 text-xs whitespace-nowrap text-neutral-500">
                {new Date(e.createdAt).toLocaleString('zh-CN', { hour12: false })}
              </td>
            </tr>
          ))}
          {events.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-6 text-center text-neutral-400">
                还没有事件。
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </main>
  )
}
