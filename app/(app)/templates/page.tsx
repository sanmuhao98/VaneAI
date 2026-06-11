import Link from 'next/link'
import { ArrowRight, Search } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { templateImageUrl } from '@/lib/templates/image-url'
import { cn } from '@/lib/utils'
import { Container } from '@/components/layout/container'
import { SortSelect } from '@/components/studio/sort-select'
import { Button } from '@/components/ui/button'

const THEMES = [
  { key: 'game_character', label: '游戏角色概念' },
  { key: 'blind_box', label: '盲盒手办风' },
] as const

const themeLabel = (key: string) => THEMES.find((x) => x.key === key)?.label ?? key

type Tpl = {
  id: string
  slug: string
  title: string
  theme: string
  reference_image_path: string
  sort_order: number
  recommended_width: number
  recommended_height: number
  credits_cost: number
}

function FilterTab({
  href,
  active,
  label,
  count,
}: {
  href: string
  active: boolean
  label: string
  count: number
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-11 shrink-0 items-center gap-1.5 border-b-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-foreground font-medium text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
      <span className="font-mono text-xs tabular-nums opacity-60">{count}</span>
    </Link>
  )
}

/** 简讯卡：图 + 单行图注（无容器盒），行间靠发丝线分隔 */
function BriefCard({ t, no }: { t: Tpl; no: number }) {
  return (
    <Link
      href={`/templates/${t.slug}`}
      className="group flex flex-col gap-2.5 border-b border-border pt-5 pb-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="relative block overflow-hidden rounded-[2px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={templateImageUrl(t.reference_image_path)}
          alt=""
          loading="lazy"
          className="aspect-[4/5] w-full object-cover object-[50%_25%] transition duration-300 ease-out group-hover:scale-[1.02] group-hover:brightness-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[2px] ring-1 ring-foreground/10 ring-inset" />
      </span>
      <span className="flex items-baseline gap-2">
        <span aria-hidden className="font-mono text-[10px] text-muted-foreground tabular-nums">
          {String(no).padStart(2, '0')}
        </span>
        <span className="truncate text-sm font-medium underline-offset-4 group-hover:underline">
          {t.title}
        </span>
        <span className="ml-auto flex shrink-0 items-center text-xs font-semibold text-brand">
          用
          <span
            aria-hidden
            className="w-0 overflow-hidden transition-[width] duration-200 group-hover:w-3.5 group-focus-visible:w-3.5 motion-reduce:transition-none"
          >
            &nbsp;→
          </span>
        </span>
      </span>
    </Link>
  )
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; q?: string; sort?: string }>
}) {
  const { theme, q, sort } = await searchParams
  const supabase = await createClient()
  const { data: templates } = await supabase
    .from('templates_public')
    .select(
      'id, slug, title, theme, reference_image_path, sort_order, recommended_width, recommended_height, credits_cost',
    )
    .order('sort_order')

  const all = (templates ?? []) as Tpl[]
  const countOf = (key?: string) => (key ? all.filter((t) => t.theme === key).length : all.length)

  let items = theme ? all.filter((t) => t.theme === theme) : all
  const query = q?.trim()
  if (query) items = items.filter((t) => t.title.includes(query))
  if (sort === 'title') items = [...items].sort((a, b) => a.title.localeCompare(b.title, 'zh'))

  const [lead, second, third, ...briefs] = items
  const showFrontPage = !query && sort !== 'title' // 检索/重排时直接出简讯网格

  const gridItems = showFrontPage ? briefs : items
  const gridOffset = showFrontPage ? 3 : 0

  return (
    <main className="pt-6 pb-16 sm:pt-8 sm:pb-24">
      <Container>
        {/* 检索行：筛选版块 + 搜索 + 排序，一条发丝线贯穿 */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-border">
          <nav aria-label="主题筛选" className="flex gap-6 overflow-x-auto">
            <FilterTab href="/templates" active={!theme} label="全部" count={countOf()} />
            {THEMES.map((t) => (
              <FilterTab
                key={t.key}
                href={`/templates?theme=${t.key}`}
                active={theme === t.key}
                label={t.label}
                count={countOf(t.key)}
              />
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <form action="/templates" className="flex items-center gap-1.5">
              {theme ? <input type="hidden" name="theme" value={theme} /> : null}
              {sort ? <input type="hidden" name="sort" value={sort} /> : null}
              <Search aria-hidden className="size-3.5 text-muted-foreground" />
              <input
                type="search"
                name="q"
                defaultValue={query ?? ''}
                placeholder="搜索模板"
                aria-label="搜索模板"
                className="h-11 w-28 border-b-2 border-transparent bg-transparent text-sm transition-[width,border-color] outline-none placeholder:text-muted-foreground focus-visible:w-40 focus-visible:border-foreground sm:w-36 sm:focus-visible:w-48"
              />
            </form>
            {/* 检索/排序分隔：竖向发丝线 */}
            <span aria-hidden className="h-5 w-px bg-border" />
            <SortSelect value={sort === 'title' ? 'title' : 'default'} />
          </div>
        </div>

        {showFrontPage && lead ? (
          <>
            {/* ── 头条区：1 头条 + 2 次头条 + 头条文字块 ── */}
            <section className="mt-8 grid gap-6 md:grid-cols-2 md:gap-8">
              <Link
                href={`/templates/${lead.slug}`}
                className="group relative block overflow-hidden rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={templateImageUrl(lead.reference_image_path)}
                  alt=""
                  className="aspect-[4/5] w-full object-cover object-[50%_25%] transition duration-300 ease-out group-hover:scale-[1.01] group-hover:brightness-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100 md:aspect-[3/4]"
                />
                <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[2px] ring-1 ring-foreground/10 ring-inset" />
                <span
                  aria-hidden
                  className="absolute top-3 right-3 -rotate-6 border-2 border-brand bg-background/85 px-1.5 py-0.5 font-heading text-sm font-black text-brand"
                >
                  爆
                </span>
                <span className="sr-only">头条模板：{lead.title}</span>
              </Link>

              <div className="flex flex-col gap-6">
                {second || third ? (
                  <div className="grid grid-cols-2 gap-6">
                    {[second, third].filter(Boolean).map((t, i) => (
                      <Link
                        key={t!.id}
                        href={`/templates/${t!.slug}`}
                        className="group flex flex-col gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="relative block overflow-hidden rounded-[2px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={templateImageUrl(t!.reference_image_path)}
                            alt=""
                            className="aspect-square w-full object-cover object-[50%_25%] transition duration-300 ease-out group-hover:brightness-[1.04]"
                          />
                          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[2px] ring-1 ring-foreground/10 ring-inset" />
                        </span>
                        <span className="flex items-baseline gap-2">
                          <span aria-hidden className="font-mono text-[10px] text-muted-foreground tabular-nums">
                            {String(i + 2).padStart(2, '0')}
                          </span>
                          <span className="truncate font-heading text-sm font-bold underline-offset-4 group-hover:underline">
                            {t!.title}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-1 flex-col justify-end gap-3 border-t border-border pt-5">
                  <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                    本期头条 <span aria-hidden>✣</span> {themeLabel(lead.theme)}
                  </p>
                  <h1 className="font-heading text-3xl font-black text-balance sm:text-4xl">
                    <Link
                      href={`/templates/${lead.slug}`}
                      className="outline-none focus-visible:ring-2 focus-visible:ring-ring hover:underline underline-offset-8 decoration-2"
                    >
                      {lead.title}
                    </Link>
                  </h1>
                  <p className="font-mono text-xs text-muted-foreground tabular-nums">
                    {lead.recommended_width}×{lead.recommended_height} · {lead.credits_cost}{' '}
                    积分/次 · 换上你的主体即可复刻
                  </p>
                  <Button
                    variant="brand"
                    nativeButton={false}
                    className="mt-1 h-11 w-fit px-6 md:h-10"
                    render={<Link href={`/templates/${lead.slug}`} />}
                  >
                    用这个模板
                    <ArrowRight data-icon="inline-end" aria-hidden />
                  </Button>
                </div>
              </div>
            </section>

            {/* 栏目题花 */}
            <div className="mt-12 flex items-center gap-4">
              <span aria-hidden className="h-px flex-1 bg-border" />
              <h2 className="font-heading text-base font-bold">全部模板</h2>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {briefs.length + 3}
              </span>
              <span aria-hidden className="h-px flex-1 bg-border" />
            </div>
          </>
        ) : null}

        {gridItems.length > 0 ? (
          <div
            className={cn(
              'grid grid-cols-2 gap-x-4 border-t-0 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4',
              !showFrontPage && 'mt-2',
            )}
          >
            {gridItems.map((t, i) => (
              <BriefCard key={t.id} t={t} no={i + 1 + gridOffset} />
            ))}
          </div>
        ) : (
          <section className="mt-14 flex flex-col items-center gap-4 border border-dashed border-border px-6 py-20 text-center">
            <p aria-hidden className="font-mono text-xs tracking-widest text-muted-foreground">
              — ✣ —
            </p>
            <h2 className="font-heading text-2xl font-bold text-balance">
              {query ? `没有找到「${query}」` : '这一版还没有模板'}
            </h2>
            <p className="text-sm text-muted-foreground">换个关键词或主题，再翻一版。</p>
            <Button
              variant="outline"
              nativeButton={false}
              className="mt-2 h-10"
              render={<Link href="/templates" />}
            >
              回到本期全部
            </Button>
          </section>
        )}
      </Container>
    </main>
  )
}
