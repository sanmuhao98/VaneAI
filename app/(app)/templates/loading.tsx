import { Container } from '@/components/layout/container'
import { Skeleton } from '@/components/ui/skeleton'

export default function TemplatesLoading() {
  return (
    <main className="pt-6 pb-16 sm:pt-8 sm:pb-24">
      <Container>
        <div className="flex items-center gap-6 border-b border-border pb-3">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="ml-auto h-5 w-36" />
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2 md:gap-8">
          <Skeleton className="aspect-[4/5] w-full rounded-[2px] md:aspect-[3/4]" />
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-6">
              <Skeleton className="aspect-square w-full rounded-[2px]" />
              <Skeleton className="aspect-square w-full rounded-[2px]" />
            </div>
            <div className="flex flex-1 flex-col justify-end gap-3 border-t border-border pt-5">
              <Skeleton className="h-3.5 w-44" />
              <Skeleton className="h-9 w-64 max-w-full" />
              <Skeleton className="h-3.5 w-56" />
              <Skeleton className="mt-1 h-10 w-36" />
            </div>
          </div>
        </div>
        <div className="mt-12 flex items-center gap-4">
          <Skeleton className="h-px flex-1" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-px flex-1" />
        </div>
        <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2.5 border-b border-border pt-5 pb-5">
              <Skeleton className="aspect-[4/5] w-full rounded-[2px]" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </Container>
    </main>
  )
}
