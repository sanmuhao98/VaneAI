import { cn } from "@/lib/utils"

/**
 * Standard page heading block: title + optional description + optional
 * trailing actions. Keeps every screen's H1 on the same scale.
 */
function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-3xl font-bold text-foreground">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export { PageHeader }
