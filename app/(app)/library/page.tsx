import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listJobs, type ListedJob } from '@/lib/generation/list-jobs'
import { JOB_STATUS_LABELS, type JobStatus } from '@/lib/generation/status'
import { cn } from '@/lib/utils'
import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'

const FILTERS = [
  { key: undefined, label: '全部' },
  { key: 'succeeded', label: '已完成' },
  { key: 'failed', label: '失败' },
] as const

// 状态色：失败用警示色，进行中走品牌红线，终态/取消归静默。
function statusTone(status: string) {
  if (status === 'failed') return 'text-destructive'
  if (status === 'pending' || status === 'running') return 'text-brand'
  return 'text-muted-foreground'
}

function FilterTab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-11 shrink-0 items-center border-b-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-foreground font-medium text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </Link>
  )
}

/** 作品简讯卡：图 + 编号 + 标题 + 状态/时间行，行间靠发丝线分隔（镜像模板库 BriefCard）。 */
function WorkCard({ j, no }: { j: ListedJob; no: number }) {
  const label = JOB_STATUS_LABELS[j.status as JobStatus] ?? j.status
  const title = j.keyword ?? '自由创作'
  return (
    <Link
      href={`/library/${j.id}`}
      className="group flex flex-col gap-2.5 border-b border-border pt-5 pb-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="relative block overflow-hidden rounded-[2px] bg-secondary">
        {j.previewUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={j.previewUrl}
            alt=""
            loading="lazy"
            className="aspect-[4/5] w-full object-cover object-[50%_25%] transition duration-300 ease-out group-hover:scale-[1.02] group-hover:brightness-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <span className="flex aspect-[4/5] w-full items-center justify-center">
            <span className={cn('font-mono text-xs', statusTone(j.status))}>{label}</span>
          </span>
        )}
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[2px] ring-1 ring-foreground/10 ring-inset" />
      </span>
      <span className="flex items-baseline gap-2">
        <span aria-hidden className="font-mono text-[10px] text-muted-foreground tabular-nums">
          {String(no).padStart(2, '0')}
        </span>
        <span className="truncate text-sm font-medium underline-offset-4 group-hover:underline">{title}</span>
      </span>
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground tabular-nums">
        <span className={statusTone(j.status)}>{label}</span>
        <span aria-hidden>·</span>
        {new Date(j.createdAt).toLocaleString('zh-CN', { hour12: false })}
      </span>
    </Link>
  )
}

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
    <main className="pt-6 pb-16 sm:pt-8 sm:pb-24">
      <Container>
        {/* 刊头行：衬线标题 + 去复刻入口 */}
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-heading text-2xl font-black sm:text-3xl">我的作品</h1>
          <Link
            href="/templates"
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand underline-offset-4 hover:underline"
          >
            去复刻 <span aria-hidden>→</span>
          </Link>
        </div>

        {/* 状态筛选：下划线页签，一条发丝线贯穿 */}
        <nav aria-label="状态筛选" className="mt-4 flex gap-6 border-b border-border">
          {FILTERS.map((f) => (
            <FilterTab
              key={f.label}
              href={qs({ status: f.key, cursor: null })}
              active={status === f.key || (!status && !f.key)}
              label={f.label}
            />
          ))}
        </nav>

        {jobs.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
            {jobs.map((j, i) => (
              <WorkCard key={j.id} j={j} no={i + 1} />
            ))}
          </div>
        ) : (
          <section className="mt-14 flex flex-col items-center gap-4 border border-dashed border-border px-6 py-20 text-center">
            <p aria-hidden className="font-mono text-xs tracking-widest text-muted-foreground">
              — ✣ —
            </p>
            <h2 className="font-heading text-2xl font-bold text-balance">
              {status ? '这个筛选下还没有作品' : '还没有作品'}
            </h2>
            <p className="text-sm text-muted-foreground">选一个爆款模板，换上你的主体，一键复刻。</p>
            <Button variant="brand" nativeButton={false} className="mt-2 h-10" render={<Link href="/templates" />}>
              去模板库复刻一张
            </Button>
          </section>
        )}

        {nextCursor ? (
          <div className="mt-8 flex justify-center">
            <Button variant="outline" nativeButton={false} className="h-10" render={<Link href={qs({ cursor: nextCursor })} />}>
              加载更多
            </Button>
          </div>
        ) : null}
      </Container>
    </main>
  )
}
