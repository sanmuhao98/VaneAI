'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const OPTIONS = [
  { value: 'default', label: '本期编排' },
  { value: 'title', label: '按标题' },
] as const

export function SortSelect({ value }: { value: string }) {
  const router = useRouter()
  const params = useSearchParams()

  function onChange(next: string | null) {
    const p = new URLSearchParams(params)
    if (!next || next === 'default') p.delete('sort')
    else p.set('sort', next)
    const qs = p.toString()
    router.push(qs ? `/templates?${qs}` : '/templates')
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label="排序方式"
        className="w-fit gap-1.5 rounded-none border-0 bg-transparent font-mono text-xs shadow-none data-[size=default]:h-11"
      >
        排序:
        <SelectValue>{OPTIONS.find((o) => o.value === value)?.label ?? '本期编排'}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
