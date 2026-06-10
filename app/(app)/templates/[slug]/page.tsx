import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { templateImageUrl } from '@/lib/templates/image-url'
import { ReplicateForm } from './_components/ReplicateForm'

export default async function TemplateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ keyword?: string }>
}) {
  const { slug } = await params
  const { keyword } = await searchParams
  const supabase = await createClient()
  const { data: t } = await supabase
    .from('templates_public')
    .select(
      'id, slug, title, theme, reference_image_path, sample_output_paths, recommended_width, recommended_height, keyword_placeholder',
    )
    .eq('slug', slug)
    .maybeSingle()
  if (!t) notFound()

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link href="/templates" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← 换个模板
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={templateImageUrl(t.reference_image_path)}
            alt={t.title}
            className="w-full rounded-xl border border-neutral-200 object-cover"
          />
          {t.sample_output_paths?.length ? (
            <div className="mt-3 flex gap-2">
              {t.sample_output_paths.map((p: string) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={p}
                  src={templateImageUrl(p)}
                  alt="示范产出"
                  className="h-20 w-20 rounded-lg border border-neutral-200 object-cover"
                />
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            推荐尺寸 {t.recommended_width}×{t.recommended_height}
          </p>
          <div className="mt-6">
            <ReplicateForm
              templateId={t.id}
              placeholder={t.keyword_placeholder}
              initialKeyword={typeof keyword === 'string' ? keyword : undefined}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
