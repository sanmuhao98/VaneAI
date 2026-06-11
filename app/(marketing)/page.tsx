import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { createAdminClient } from '@/lib/supabase/admin'
import { templateImageUrl } from '@/lib/templates/image-url'
import { Container } from '@/components/layout/container'

export const metadata: Metadata = {
  title: '爆款风格，一键复刻',
  description: '选模板、填关键词，60 秒拿到爆款同款 AI 图。游戏角色与盲盒手办双主题，注册即送 100 积分。',
}

// 落地页是静态版面：用 admin client 读安全视图（templates_public 不含
// base_prompt，ADR-016 不受影响），按小时再生，不读 cookie。
export const revalidate = 3600

type Tpl = {
  slug: string
  title: string
  theme: string
  reference_image_path: string
  recommended_width: number
  recommended_height: number
}

const THEME_LABEL: Record<string, string> = {
  game_character: '游戏角色',
  blind_box: '盲盒手办',
}

export default async function MarketingHome() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('templates_public')
    .select('slug, title, theme, reference_image_path, recommended_width, recommended_height')
    .order('sort_order')
    .limit(7)
  const templates = (data ?? []) as Tpl[]
  const [lead, ...gallery] = templates

  return (
    <main>
      {/* ── 报头 ───────────────────────────────────── */}
      <Container className="pt-12 text-center sm:pt-16">
        <h1 className="font-heading text-6xl font-black tracking-tight sm:text-7xl">VaneAI</h1>
        {/* 报头线：全站允许的朱红装饰位（§1 ③） */}
        <div aria-hidden className="mx-auto mt-5 max-w-xl">
          <div className="border-t-2 border-brand" />
          <div className="mt-0.5 border-t border-brand/40" />
        </div>
        <p className="mt-3 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
          模板复刻 · 游戏角色 × 盲盒手办 · 出图 ≤ 60s
        </p>
      </Container>

      {/* ── 头版 ───────────────────────────────────── */}
      <Container className="mt-12 sm:mt-16">
        <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="animate-rise lg:col-span-7">
            <h2 className="font-heading text-[clamp(2.5rem,6vw,4rem)] leading-[1.1] font-black text-balance">
              爆款风格，
              <br />
              一键复刻。
            </h2>
            <p className="mt-6 max-w-[36ch] text-lg leading-relaxed text-muted-foreground first-letter:float-left first-letter:mr-2 first-letter:font-heading first-letter:text-5xl first-letter:font-black first-letter:leading-[0.9] first-letter:text-foreground">
              看中的风格不必从零调试。每套模板都是一份调好的配方——你只填一个主体关键词，剩下交给管线：排队、生成、入库，全程可见。
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/create"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-6 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                开始创作
                <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link
                href="/templates"
                className="inline-flex h-11 items-center rounded-lg border border-foreground px-6 text-sm font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                先逛模板库
              </Link>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-border pt-6">
              {[
                ['32', '套在线模板'],
                ['1 积分', '一张图'],
                ['100', '注册即送积分'],
              ].map(([num, label]) => (
                <div key={label}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="font-mono text-2xl font-medium tabular-nums">{num}</dd>
                  <dd className="mt-1 text-xs text-muted-foreground">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {lead ? (
            <figure className="animate-rise [animation-delay:120ms] lg:col-span-5">
              <div className="relative overflow-hidden rounded-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={templateImageUrl(lead.reference_image_path)}
                  alt={`模板示例：${lead.title}`}
                  style={{ aspectRatio: `${lead.recommended_width} / ${lead.recommended_height}` }}
                  className="w-full object-cover"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-sm ring-1 ring-foreground/10 ring-inset"
                />
              </div>
              <figcaption className="mt-2 flex items-baseline justify-between border-b border-border pb-2 font-mono text-xs text-muted-foreground">
                <span className="uppercase">头版图 · NO.001</span>
                <span>
                  {lead.title} · {THEME_LABEL[lead.theme] ?? lead.theme}
                </span>
              </figcaption>
            </figure>
          ) : null}
        </div>
      </Container>

      {/* ── 本期看点 ───────────────────────────────── */}
      <Container className="mt-20 sm:mt-28">
        <SectionRule zh="本期看点" en="In this issue" />
        <div className="grid gap-10 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
          {[
            {
              no: '01',
              title: '模板即配方',
              body: '提示词配方由编辑预置、服务端保管，永不外泄。你唯一要填的，是想画什么主体。',
            },
            {
              no: '02',
              title: '异步出图管线',
              body: '提交即排队，状态全程可见；生成失败自动回补积分，不为失败买单。',
            },
            {
              no: '03',
              title: '透明计价',
              body: '1 积分一张图，注册即送 100，每日 10 次免费额度——先用起来，再谈别的。',
            },
          ].map((f, i) => (
            <article
              key={f.no}
              className="animate-rise sm:px-8 sm:first:pl-0 sm:last:pr-0"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <p className="font-mono text-xs tracking-wider text-muted-foreground">{f.no}</p>
              <h3 className="mt-3 font-heading text-xl font-bold">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </Container>

      {/* ── 作品选登 ───────────────────────────────── */}
      {gallery.length > 0 ? (
        <Container className="mt-20 sm:mt-28">
          <SectionRule zh="作品选登" en="From the gallery" />
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {gallery.map((t, i) => (
              <li key={t.slug} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
                <Link
                  href={`/templates/${t.slug}`}
                  className="group block outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="relative overflow-hidden rounded-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={templateImageUrl(t.reference_image_path)}
                      alt={`模板：${t.title}`}
                      loading="lazy"
                      style={{ aspectRatio: `${t.recommended_width} / ${t.recommended_height}` }}
                      className="w-full object-cover object-[50%_25%] transition duration-300 ease-out group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-sm ring-1 ring-foreground/10 ring-inset"
                    />
                  </div>
                  <p className="mt-1.5 truncate font-mono text-xs text-muted-foreground">
                    NO.{String(i + 2).padStart(3, '0')} · {t.title}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm">
            <Link href="/templates" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
              翻到模板库，共 32 套
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </p>
        </Container>
      ) : null}

      {/* ── 收版 CTA ───────────────────────────────── */}
      <Container size="content" className="mt-24 text-center sm:mt-32">
        <p className="font-heading text-3xl font-black text-balance sm:text-4xl">这一期，登上你自己的头版。</p>
        <div className="mt-8">
          <Link
            href="/create"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-8 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            开始创作
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </Container>
    </main>
  )
}

/** 版块题花：粗墨线 + 中英双语栏目名（§6 刊物版块目录的营销页变体） */
function SectionRule({ zh, en }: { zh: string; en: string }) {
  return (
    <div className="mb-8 border-t-2 border-foreground pt-3">
      <p className="flex items-baseline gap-3">
        <span className="font-heading text-base font-bold">{zh}</span>
        <span className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">{en}</span>
      </p>
    </div>
  )
}
