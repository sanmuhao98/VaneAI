import Link from 'next/link'

import { Container } from '@/components/layout/container'

/**
 * 营销壳层（设计系统 v3「头条日报」）：日期线顶栏 + 版面化页脚。
 * 光面暖纸；顶栏不放「开始创作」——营销页的生成入口集中在头版 CTA。
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-border">
        <Container className="flex h-10 items-center justify-between font-mono text-xs tracking-wider text-muted-foreground uppercase">
          <Link href="/" className="hover:text-foreground">
            VaneAI · 创刊号 Beta
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/templates" className="hidden hover:text-foreground sm:block">
              模板库
            </Link>
            <Link href="/auth/login" className="text-foreground underline-offset-4 hover:underline">
              登录
            </Link>
          </nav>
        </Container>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="mt-24">
        <Container>
          {/* 报尾双线：粗 + 细 */}
          <div className="border-t-2 border-foreground pt-px">
            <div className="border-t border-border" />
          </div>
          <div className="grid gap-10 py-12 sm:grid-cols-3">
            <div>
              <p className="font-heading text-2xl font-black">VaneAI</p>
              <p className="mt-2 max-w-[26ch] text-sm text-muted-foreground">
                选模板、填关键词，让爆款风格为你所用。
              </p>
            </div>
            <nav aria-label="产品" className="text-sm">
              <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">版面</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link href="/templates" className="underline-offset-4 hover:underline">
                    模板库
                  </Link>
                </li>
                <li>
                  <Link href="/create" className="underline-offset-4 hover:underline">
                    创作工作台
                  </Link>
                </li>
                <li>
                  <Link href="/library" className="underline-offset-4 hover:underline">
                    我的作品
                  </Link>
                </li>
              </ul>
            </nav>
            <nav aria-label="条款" className="text-sm">
              <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">刊例</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link href="/terms" className="underline-offset-4 hover:underline">
                    服务条款
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="underline-offset-4 hover:underline">
                    隐私政策
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
          <p className="border-t border-border py-6 font-mono text-xs text-muted-foreground">
            © 2026 VaneAI · 内测版 · 图像由 AI 生成并带有标识，请遵守适用法规
          </p>
        </Container>
      </footer>
    </div>
  )
}
