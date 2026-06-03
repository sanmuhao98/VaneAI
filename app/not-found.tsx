import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">404</p>
      <h1 className="text-balance text-3xl font-semibold tracking-tight">页面不存在</h1>
      <p className="text-balance text-sm text-muted-foreground">
        你访问的链接已失效或被移除。
      </p>
      <Link
        href="/"
        className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        回到首页
      </Link>
    </main>
  )
}
