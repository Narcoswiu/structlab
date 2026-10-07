import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Размерите следват прототипа: всичко, което се натиска, е поне 44 px високо.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2.5 border whitespace-nowrap no-underline transition-colors outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary font-extrabold text-primary-foreground hover:bg-link",
        warm: "border-transparent bg-warm font-extrabold text-primary-foreground hover:bg-warn-fg",
        outline:
          "border-line-strong bg-surface font-bold text-foreground hover:bg-surface-2",
        ghost: "border-transparent font-bold text-foreground hover:bg-surface-2",
      },
      size: {
        default: "min-h-11 rounded-[10px] px-[18px] text-[15px]",
        lg: "min-h-[54px] rounded-xl px-[26px] text-[17px]",
        block: "min-h-[50px] w-full rounded-xl px-5 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

/** Същият вид като <Button>, но за <Link> – връща готов низ с класове. */
function buttonClass(options?: Parameters<typeof buttonVariants>[0]) {
  return cn(buttonVariants(options))
}

export { Button, buttonClass, buttonVariants }
