'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Images } from 'lucide-react'

import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/templates', label: '模板库', icon: LayoutGrid },
  { href: '/library', label: '我的作品', icon: Images },
] as const

export function AppNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="主导航" className="flex h-full items-stretch gap-1 sm:gap-2">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex shrink-0 items-center gap-1.5 px-2 text-sm font-medium whitespace-nowrap transition-colors outline-none sm:px-3',
              'focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              // active indicator: foreground underline — brand is reserved for generation
              active &&
                'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-foreground sm:after:inset-x-3',
            )}
          >
            <Icon className="hidden size-4 sm:block" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
