import { Container } from '@/components/layout/container'

export type LegalSection = { heading: string; body: string[] }

/** 法务静态页版式：刊物正文——serif 标题 + mono 修订线 + 编号小节。 */
export function LegalArticle({
  title,
  updated,
  intro,
  sections,
}: {
  title: string
  updated: string
  intro: string
  sections: LegalSection[]
}) {
  return (
    <main className="pt-12 pb-8 sm:pt-16">
      <Container size="content">
        <header className="border-b-2 border-foreground pb-6">
          <h1 className="font-heading text-3xl font-black sm:text-4xl">{title}</h1>
          <p className="mt-3 font-mono text-xs tracking-wider text-muted-foreground uppercase">
            修订 {updated} · 内测版 Beta
          </p>
        </header>
        <p className="mt-8 leading-relaxed text-muted-foreground">{intro}</p>
        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <section key={s.heading}>
              <h2 className="flex items-baseline gap-3 font-heading text-xl font-bold">
                <span className="font-mono text-xs font-normal tracking-wider text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s.heading}
              </h2>
              <div className="mt-3 space-y-3 border-l border-border pl-[calc(1.5rem+0.75rem)] text-[15px] leading-relaxed text-muted-foreground sm:pl-[calc(1.75rem+0.75rem)]">
                {s.body.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Container>
    </main>
  )
}
