import Link from 'next/link'
import { listUsers } from '@/lib/admin/queries'
import { GrantCreditsForm } from './_components/GrantCreditsForm'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(Number.parseInt(pageParam ?? '1', 10) || 1, 1)
  const { users, hasMore } = await listUsers({ page })

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight">用户</h1>
      <p className="mt-1 text-sm text-neutral-500">手动加分走 ledger（reason: admin_grant），有流水可查。</p>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="py-2 pr-3">邮箱</th>
            <th className="py-2 pr-3">用户 ID</th>
            <th className="py-2 pr-3">积分余额</th>
            <th className="py-2 pr-3">注册时间</th>
            <th className="py-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-neutral-100">
              <td className="py-2 pr-3">{u.email ?? '—'}</td>
              <td className="py-2 pr-3 font-mono text-xs text-neutral-500">{u.id.slice(0, 8)}…</td>
              <td className="py-2 pr-3 font-semibold">{u.creditsBalance}</td>
              <td className="py-2 pr-3 text-xs text-neutral-500">
                {new Date(u.createdAt).toLocaleString('zh-CN', { hour12: false })}
              </td>
              <td className="py-2">
                <GrantCreditsForm userId={u.id} />
              </td>
            </tr>
          ))}
          {users.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-6 text-center text-neutral-400">
                没有用户。
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="mt-6 flex gap-3">
        {page > 1 ? (
          <Link
            href={`/admin/users?page=${page - 1}`}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
          >
            上一页
          </Link>
        ) : null}
        {hasMore ? (
          <Link
            href={`/admin/users?page=${page + 1}`}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
          >
            下一页
          </Link>
        ) : null}
      </div>
    </main>
  )
}
