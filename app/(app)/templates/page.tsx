import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { clientEnv } from '@/lib/env'

const THEMES = [
  { key: 'game_character', label: '游戏角色概念' },
  { key: 'blind_box', label: '盲盒手办风' },
] as const

function templateImageUrl(path: string) {
  return `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/templates/${path}`
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>
}) {
  const { theme } = await searchParams
  const supabase = await createClient()
  let query = supabase
    .from('templates_public')
    .select('id, slug, title, theme, reference_image_path, sort_order')
    .order('sort_order')
  if (theme) query = query.eq('theme', theme)
  const { data: templates } = await query

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">爆款模板库</h1>
      <p className="mt-2 text-neutral-500">选一个模板，输入你的主体关键词，一键复刻同款风格。</p>

      <nav className="mt-6 flex gap-2">
        <Link
          href="/templates"
          className={`rounded-full border px-4 py-1.5 text-sm ${!theme ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 hover:bg-neutral-100'}`}
        >
          全部
        </Link>
        {THEMES.map((t) => (
          <Link
            key={t.key}
            href={`/templates?theme=${t.key}`}
            className={`rounded-full border px-4 py-1.5 text-sm ${theme === t.key ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 hover:bg-neutral-100'}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3">
        {(templates ?? []).map((t) => (
          <Link
            key={t.id}
            href={`/templates/${t.slug}`}
            className="group overflow-hidden rounded-xl border border-neutral-200 transition hover:shadow-md"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={templateImageUrl(t.reference_image_path)}
              alt={t.title}
              className="aspect-square w-full object-cover"
            />
            <div className="p-3">
              <p className="text-sm font-medium">{t.title}</p>
              <span className="mt-1 inline-block rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                {THEMES.find((x) => x.key === t.theme)?.label ?? t.theme}
              </span>
            </div>
          </Link>
        ))}
        {(templates ?? []).length === 0 ? (
          <p className="col-span-full text-neutral-400">暂无模板。</p>
        ) : null}
      </div>
    </main>
  )
}
