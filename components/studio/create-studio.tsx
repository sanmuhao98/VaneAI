'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Dices, Download, RotateCcw, Settings2, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { withDownloadParam } from '@/lib/storage/download-url'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/* ── 数据形状 ─────────────────────────────────────────── */

export type ModelOption = {
  id: string
  display_name: string
  provider_model: string
  credits_cost: number
}

type Envelope<T> = { data: T | null; error: { code: string; message: string } | null }
type CreateData = { job: { id: string; status: string } }
type ResultAsset = { signedUrl: string; width: number | null; height: number | null }
type DetailData = {
  job: { id: string; status: string; error: { code: string; message: string } | null }
  assets: ResultAsset[]
}

type ParamsSnapshot = {
  modelId: string
  prompt: string
  negativePrompt?: string
  seed?: number
  width: number
  height: number
}

type SessionJob = {
  id: string
  localNo: number
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'stale'
  submittedAt: number
  finishedAt?: number
  params: ParamsSnapshot
  assets?: ResultAsset[]
  errorMessage?: string
}

const RATIOS = [
  { key: '1:1', width: 2048, height: 2048 },
  { key: '3:4', width: 1728, height: 2304 },
  { key: '4:3', width: 2304, height: 1728 },
  { key: '9:16', width: 1600, height: 2848 },
  { key: '16:9', width: 2848, height: 1600 },
] as const

const POLL_INTERVAL_MS = 1_500
const POLL_GIVEUP_MS = 5 * 60_000 // 之后标记"仍在后台运行"，停止轮询

const ACTIVE = new Set(['pending', 'running'])

/* ── 小部件 ───────────────────────────────────────────── */

function ChipButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('h-10 gap-1.5 font-mono text-xs md:h-8', className)}
      {...props}
    />
  )
}

function StatusTag({ status }: { status: SessionJob['status'] }) {
  if (status === 'pending' || status === 'running')
    return (
      <span className="flex items-center gap-1.5 font-mono text-xs text-brand">
        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-brand" />
        {status === 'pending' ? '排队中' : '生成中'}
      </span>
    )
  if (status === 'succeeded') return <span className="font-mono text-xs text-foreground">✓ 已完成</span>
  if (status === 'failed') return <span className="font-mono text-xs text-destructive">✕ 失败</span>
  if (status === 'stale') return <span className="font-mono text-xs text-muted-foreground">仍在后台运行</span>
  return <span className="font-mono text-xs text-muted-foreground">已取消</span>
}

function elapsedLabel(from: number, to?: number) {
  const s = Math.max(0, Math.floor(((to ?? Date.now()) - from) / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/* ── 工作台 ───────────────────────────────────────────── */

export function CreateStudio({ models, balance }: { models: ModelOption[]; balance: number }) {
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [seed, setSeed] = useState('')
  const [modelId, setModelId] = useState(models[0]?.id ?? '')
  const [ratioKey, setRatioKey] = useState<(typeof RATIOS)[number]['key']>('3:4')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<SessionJob[]>([])
  const nextNo = useRef(1)
  const [, forceTick] = useState(0)

  const model = models.find((m) => m.id === modelId)
  const ratio = RATIOS.find((r) => r.key === ratioKey)!
  const hasActive = jobs.some((j) => ACTIVE.has(j.status))

  // 已耗时秒针：仅在有进行中任务时跳动
  useEffect(() => {
    if (!hasActive) return
    const t = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [hasActive])

  // 轮询：单循环驱动全部进行中任务
  useEffect(() => {
    if (!hasActive) return
    let stopped = false
    const tick = async () => {
      const active = jobs.filter((j) => ACTIVE.has(j.status))
      let terminal = false
      await Promise.all(
        active.map(async (j) => {
          try {
            const res = await fetch(`/api/v1/generations/${j.id}`)
            const body = (await res.json()) as Envelope<DetailData>
            if (!res.ok || !body.data) return // 瞬时失败：下一轮再试
            const { job, assets } = body.data
            if (stopped) return
            if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'canceled') terminal = true
            setJobs((prev) =>
              prev.map((p) => {
                if (p.id !== j.id) return p
                if (job.status === 'succeeded')
                  return { ...p, status: 'succeeded', assets, finishedAt: Date.now() }
                if (job.status === 'failed')
                  return {
                    ...p,
                    status: 'failed',
                    errorMessage: job.error?.message ?? '生成失败，请重试',
                    finishedAt: Date.now(),
                  }
                if (job.status === 'canceled') return { ...p, status: 'canceled', finishedAt: Date.now() }
                if (job.status === 'running' && p.status === 'pending') return { ...p, status: 'running' }
                if (Date.now() - p.submittedAt > POLL_GIVEUP_MS) return { ...p, status: 'stale' }
                return p
              }),
            )
          } catch {
            // 网络瞬断：保持状态，下一轮重试
          }
        }),
      )
      // 任务落终态时刷新 RSC——顶栏积分/配额读数随退款/最终态同步。
      if (terminal && !stopped) router.refresh()
    }
    const t = setInterval(tick, POLL_INTERVAL_MS)
    return () => {
      stopped = true
      clearInterval(t)
    }
  }, [hasActive, jobs, router])

  const submit = useCallback(
    async (params: ParamsSnapshot) => {
      setSubmitting(true)
      setFormError(null)
      try {
        const res = await fetch('/api/v1/generations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'text_to_image', ...params }),
        })
        const body = (await res.json()) as Envelope<CreateData>
        if (!res.ok || !body.data) throw new Error(body.error?.message ?? '创建任务失败，请重试')
        // 编号在 updater 外自增——StrictMode 会双调 updater，放里面会跳号。
        const localNo = nextNo.current++
        const job: SessionJob = {
          id: body.data.job.id,
          localNo,
          status: 'pending',
          submittedAt: Date.now(),
          params,
        }
        setJobs((prev) => [job, ...prev])
        // 创建即扣费——立即刷新 RSC，顶栏余额/配额读数同步扣减。
        router.refresh()
      } catch (err) {
        setFormError(err instanceof Error ? err.message : '创建任务失败，请重试')
      } finally {
        setSubmitting(false)
      }
    },
    [router],
  )

  function onGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim() || !model) return
    const seedNum = seed.trim() === '' ? undefined : Number(seed)
    void submit({
      modelId: model.id,
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim() || undefined,
      seed: seedNum !== undefined && Number.isInteger(seedNum) && seedNum >= 0 ? seedNum : undefined,
      width: ratio.width,
      height: ratio.height,
    })
  }

  async function cancelJob(id: string) {
    setJobs((prev) => prev.map((j) => (j.id === id && ACTIVE.has(j.status) ? { ...j, status: 'canceled' } : j)))
    try {
      await fetch(`/api/v1/generations/${id}/cancel`, { method: 'POST' })
    } catch {
      // best-effort：轮询若发现仍在运行会纠正回来
    }
  }

  function refill(params: ParamsSnapshot) {
    setPrompt(params.prompt)
    setNegativePrompt(params.negativePrompt ?? '')
    setSeed(params.seed !== undefined ? String(params.seed) : '')
    setModelId(params.modelId)
    const r = RATIOS.find((x) => x.width === params.width && x.height === params.height)
    if (r) setRatioKey(r.key)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-20 sm:px-6 sm:pt-8">
      {/* 简易/专业 开关（专业模式预留） */}
      <div className="flex items-center justify-end">
        <span className="flex items-center font-mono text-[11px] text-muted-foreground">
          <span className="rounded-l-[3px] border border-border bg-secondary px-2 py-1 text-foreground">简易</span>
          <span
            className="cursor-not-allowed rounded-r-[3px] border border-l-0 border-border px-2 py-1 opacity-50"
            title="专业模式即将开放"
          >
            专业
          </span>
        </span>
      </div>

      {/* 模式两级切换：一级产出类型 / 二级输入方式 */}
      <nav aria-label="生成模式" className="mt-2 flex flex-col gap-1">
        <div className="flex items-center gap-5 text-sm">
          <span aria-current="true" className="border-b-2 border-foreground pb-1 font-medium">
            图片
          </span>
          <span className="cursor-not-allowed pb-1 text-muted-foreground opacity-50" title="即将开放">
            视频
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span aria-current="true" className="font-medium text-foreground">
            文字生成
          </span>
          <span className="cursor-not-allowed text-muted-foreground opacity-50" title="即将开放">
            图片生成
          </span>
          <span className="cursor-not-allowed text-muted-foreground opacity-50" title="即将开放">
            模板起步
          </span>
        </div>
      </nav>

      {/* 控制台卡 */}
      <form
        onSubmit={onGenerate}
        className="mt-4 flex flex-col rounded-lg border border-border bg-card"
      >
        <div className="relative">
          <label htmlFor="prompt" className="sr-only">
            画面描述
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, 500))}
            required
            rows={3}
            placeholder="描述你想要的画面，例如：一只穿宇航服的柴犬，站在月球上回望地球"
            className="min-h-24 w-full resize-y bg-transparent px-4 pt-4 pb-7 text-base outline-none placeholder:text-muted-foreground"
          />
          <span aria-hidden className="absolute right-3 bottom-2 font-mono text-[11px] text-muted-foreground tabular-nums">
            {prompt.length}/500
          </span>
        </div>

        {/* 基础参数行 */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <ChipButton aria-label="选择模型">
                  {model?.display_name ?? '选择模型'}
                  <ChevronDown aria-hidden />
                </ChipButton>
              }
            />
            <DropdownMenuContent align="start" className="min-w-64">
              <DropdownMenuGroup>
                {models.map((m) => (
                  <DropdownMenuItem key={m.id} onClick={() => setModelId(m.id)}>
                    <span className="flex flex-col gap-0.5">
                      <span className={cn('text-sm', m.id === modelId && 'font-semibold')}>{m.display_name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {m.credits_cost} CR · {m.provider_model}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <ChipButton aria-label="输出比例">
                  {ratioKey}
                  <ChevronDown aria-hidden />
                </ChipButton>
              }
            />
            <DropdownMenuContent align="start">
              <DropdownMenuGroup>
                {RATIOS.map((r) => (
                  <DropdownMenuItem key={r.key} onClick={() => setRatioKey(r.key)}>
                    <span className={cn('font-mono text-xs', r.key === ratioKey && 'font-bold text-foreground')}>
                      {r.key}
                      <span className="ml-2 text-muted-foreground">
                        {r.width}×{r.height}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <ChipButton disabled title="多图生成即将开放" aria-label="生成数量">
            ×1
          </ChipButton>

          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
            className="ml-auto flex h-10 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:h-8"
          >
            <Settings2 aria-hidden className="size-3.5" />
            高级参数
            <ChevronDown aria-hidden className={cn('size-3 transition-transform', advancedOpen && 'rotate-180')} />
          </button>
        </div>

        {/* 高级参数（渐进展开） */}
        {advancedOpen ? (
          <div className="flex flex-col gap-4 border-t border-border px-4 py-4 sm:grid sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="negative" className="text-xs text-muted-foreground">
                负面提示词
              </label>
              <input
                id="negative"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value.slice(0, 200))}
                placeholder="不想出现的元素，如：模糊、文字"
                className="h-10 rounded-md border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 md:h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="seed" className="text-xs text-muted-foreground">
                种子（留空为随机）
              </label>
              <div className="flex gap-2">
                <input
                  id="seed"
                  value={seed}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onChange={(e) => setSeed(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="—"
                  className="h-10 flex-1 rounded-md border border-input bg-transparent px-2.5 font-mono text-sm outline-none tabular-nums placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 md:h-9"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10 md:size-9"
                  aria-label="随机种子"
                  onClick={() => setSeed(String(Math.floor(Math.random() * 2147483647)))}
                >
                  <Dices aria-hidden />
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* 生成栏 */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="font-mono text-xs text-muted-foreground tabular-nums">
            预估 <span className="text-foreground">{model?.credits_cost ?? '—'} CR</span> · 余额 {balance}
          </p>
          <Button
            type="submit"
            variant="brand"
            disabled={submitting || !prompt.trim() || !model}
            className="h-11 px-6 md:h-10"
          >
            {submitting ? '提交中…' : '生成'}
          </Button>
        </div>
        {formError ? (
          <p role="alert" className="border-t border-destructive/30 px-4 py-2.5 text-sm text-destructive">
            {formError}
          </p>
        ) : null}
      </form>

      {/* 本次会话产出流 */}
      <section className="mt-10" aria-label="本次会话">
        <div className="flex items-baseline gap-3 border-b border-border pb-2">
          <h2 className="text-sm font-medium">本次会话</h2>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">{jobs.length} 个任务</span>
          <Link
            href="/library"
            className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            在作品库查看全部 →
          </Link>
        </div>

        {jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            {/* 品牌 V 标（透明底版，public/brand/logo-mark.png） */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.png" alt="" aria-hidden className="mb-1 w-16 select-none" />
            <p className="text-sm text-muted-foreground">描述画面，点「生成」开始第一张。</p>
            <Link
              href="/templates"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              或从一个爆款模板开始 →
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {jobs.map((j) => (
              <JobCard key={j.id} job={j} onCancel={cancelJob} onRefill={refill} onRetry={(p) => void submit(p)} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

/* ── 任务卡 ───────────────────────────────────────────── */

function JobCard({
  job,
  onCancel,
  onRefill,
  onRetry,
}: {
  job: SessionJob
  onCancel: (id: string) => void
  onRefill: (p: ParamsSnapshot) => void
  onRetry: (p: ParamsSnapshot) => void
}) {
  const no = `#${String(job.localNo).padStart(2, '0')}`
  const active = ACTIVE.has(job.status)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">{no}</span>
        <StatusTag status={job.status} />
        <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums">
          {elapsedLabel(job.submittedAt, active ? undefined : job.finishedAt)}
        </span>
      </div>

      {/* 版面按目标比例预留，杜绝跳动 */}
      <div
        style={{ aspectRatio: `${job.params.width} / ${job.params.height}` }}
        className={cn(
          'relative w-full overflow-hidden rounded-sm',
          job.status === 'failed' ? 'border border-destructive/40' : 'border border-border',
          !job.assets?.length && 'bg-secondary',
        )}
      >
        {job.assets?.length ? (
          <div className="group size-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={job.assets[0].signedUrl} alt={job.params.prompt.slice(0, 40)} className="size-full object-cover" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-[#141110]/85 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100">
              <span className="truncate font-mono text-[10px] text-white/75">
                {job.params.width}×{job.params.height}
              </span>
              <span className="pointer-events-auto flex gap-1">
                <a
                  href={withDownloadParam(job.assets[0].signedUrl)}
                  download
                  aria-label="下载图片"
                  className="flex size-8 items-center justify-center rounded-sm bg-[#141110]/70 text-white outline-none hover:bg-[#141110]/90 focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <Download aria-hidden className="size-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => onRefill(job.params)}
                  aria-label="再次创作（回填参数）"
                  className="flex size-8 items-center justify-center rounded-sm bg-[#141110]/70 text-white outline-none hover:bg-[#141110]/90 focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <RotateCcw aria-hidden className="size-3.5" />
                </button>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 px-3">
            {active ? (
              <>
                <div aria-hidden className="h-0.5 w-2/3 overflow-hidden rounded-full bg-border">
                  <div className="h-full w-2/5 rounded-full bg-brand [animation:var(--animate-sweep)] motion-reduce:animate-none motion-reduce:w-full" />
                </div>
                <button
                  type="button"
                  onClick={() => onCancel(job.id)}
                  className="flex h-9 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X aria-hidden className="size-3" /> 取消
                </button>
              </>
            ) : job.status === 'failed' ? (
              <>
                <p className="text-center text-xs text-destructive">{job.errorMessage}</p>
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => onRetry(job.params)}>
                  重试
                </Button>
              </>
            ) : job.status === 'stale' ? (
              <p className="text-center text-xs text-muted-foreground">
                任务仍在后台运行，稍后可在
                <Link href="/library" className="underline underline-offset-2">
                  作品库
                </Link>
                查看
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">已取消</p>
            )}
          </div>
        )}
      </div>

      <p className="truncate text-xs text-muted-foreground" title={job.params.prompt}>
        {job.params.prompt}
      </p>
    </div>
  )
}
