import Link from 'next/link'

export default function MarketingHome() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
        VaneAI · 一键复刻爆款
      </h1>
      <p className="max-w-md text-balance text-muted-foreground">
        从模板出发，少改 prompt，先要结果。
      </p>
      <Link
        href="/auth/login"
        className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        登录开始
      </Link>
    </main>
  )
}
