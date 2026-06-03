import { MagicLinkForm } from './_components/MagicLinkForm'
import { signInWithGoogle } from '@/app/auth/actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-8 px-6 py-24">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">登录 VaneAI</h1>
        <p className="text-sm text-muted-foreground">使用邮箱 Magic Link 或 Google 账号登录。</p>
      </header>

      {params.error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {decodeURIComponent(params.error)}
        </p>
      ) : null}

      <MagicLinkForm />

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        或
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="w-full rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          使用 Google 登录
        </button>
      </form>
    </main>
  )
}
