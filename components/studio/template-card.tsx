import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { templateImageUrl } from '@/lib/templates/image-url'

export type TemplateCardData = {
  id: string
  slug: string
  title: string
  themeLabel: string
  imagePath: string
  width: number
  height: number
}

/**
 * 画廊模板卡（设计系统 v3 §5）：
 * 默认只有图 + 编号；信息层悬停/聚焦浮现；触屏（pointer-coarse）常显。
 * 「聚光灯」调光：默认 brightness .92 压一档统一暗厅光线（也缓和白底图），
 * hover 提到 1.05 形成被灯打亮的聚焦感。
 */
export function TemplateCard({ t, index }: { t: TemplateCardData; index: number }) {
  const no = `NO.${String(index + 1).padStart(3, '0')}`

  return (
    <Link
      href={`/templates/${t.slug}`}
      className="group relative block overflow-hidden rounded-sm bg-card outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={templateImageUrl(t.imagePath)}
        alt=""
        loading="lazy"
        style={{ aspectRatio: `${t.width} / ${t.height}` }}
        className="w-full object-cover object-[50%_25%] brightness-[.92] transition duration-300 ease-out group-hover:scale-[1.02] group-hover:brightness-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      {/* 内描边：把白底图收进暗厅，不让它变成灯箱 */}
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-sm ring-1 ring-white/10 ring-inset" />

      <span
        aria-hidden
        className="absolute top-2 left-2 rounded-[2px] bg-[#141110]/65 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-white/75 transition-colors duration-200 group-hover:text-white"
      >
        {no}
      </span>

      {/* 信息纱：hover / focus 浮现；触屏常显（不依赖悬停） */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-[#141110]/90 via-[#141110]/55 to-transparent px-3 pt-10 pb-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 pointer-coarse:opacity-100">
        <p className="truncate font-heading text-base font-bold text-white">{t.title}</p>
        <p className="flex items-center justify-between font-mono text-[11px] text-white/65">
          <span className="truncate">{t.themeLabel}</span>
          <span className="flex shrink-0 items-center gap-1">
            复刻
            <ArrowRight aria-hidden className="size-3" />
          </span>
        </p>
      </div>
    </Link>
  )
}
