import { cn } from "@/lib/utils"

/**
 * Page container — the only three content widths in the product.
 * - narrow: auth, single-purpose forms
 * - content: detail pages (job detail, prose)
 * - default: grids and galleries (templates, library)
 */
const SIZES = {
  narrow: "max-w-md",
  content: "max-w-3xl",
  default: "max-w-6xl",
} as const

function Container({
  size = "default",
  className,
  ...props
}: React.ComponentProps<"div"> & { size?: keyof typeof SIZES }) {
  return (
    <div
      data-slot="container"
      className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", SIZES[size], className)}
      {...props}
    />
  )
}

export { Container }
