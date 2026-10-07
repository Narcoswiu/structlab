import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-[5px] text-xs leading-none font-extrabold whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        success: "bg-success-bg text-success-fg",
        soon: "bg-soon-bg text-soon-fg",
        easy: "bg-easy-bg px-3 py-1.5 text-[13px] text-easy-fg",
        detailed: "bg-detailed-bg px-3 py-1.5 text-[13px] text-detailed-fg",
        tag: "rounded-lg bg-surface-2 text-[13px] font-normal text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
