'use client'

import Link from 'next/link'
import { CircleUserRound, LogOut, ShieldCheck } from 'lucide-react'

import { signOut } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function UserMenu({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-lg" aria-label="账户菜单" className="size-11 md:size-9">
            <CircleUserRound />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="max-w-56 truncate font-mono text-xs font-normal text-muted-foreground">
            {email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {isAdmin ? (
            <DropdownMenuItem render={<Link href="/admin/jobs" />}>
              <ShieldCheck data-icon="inline-start" />
              Admin 后台
            </DropdownMenuItem>
          ) : null}
          <form action={signOut} className="contents">
            <DropdownMenuItem nativeButton render={<button type="submit" className="w-full" />}>
              <LogOut data-icon="inline-start" />
              登出
            </DropdownMenuItem>
          </form>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
