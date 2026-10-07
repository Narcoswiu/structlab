import { cn } from "@/lib/utils";

/** Карта, която се накланя в 3D при hover (клас .t3d в globals.css). */
export function TiltCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "t3d flex min-w-0 flex-col rounded-2xl border border-line bg-surface",
        className,
      )}
      {...props}
    />
  );
}
