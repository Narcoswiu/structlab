import { cn } from "@/lib/utils";

/**
 * Сиви блокове със същата подредба като истинската страница – показват се,
 * докато данните пристигнат, за да не „скача“ екранът при зареждане.
 */
export function PageSkeleton({
  cards = 3,
  wideFirst = true,
}: {
  cards?: number;
  /** първата карта е на цял ред, както основната карта на таблото */
  wideFirst?: boolean;
}) {
  return (
    <div
      role="status"
      aria-label="Зареждане…"
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col gap-3">
        <div className="sl-skeleton h-9 w-64 max-w-full" />
        <div className="sl-skeleton h-5 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: cards }, (_, index) => (
          <div
            key={index}
            className={cn(
              "sl-skeleton h-36 rounded-2xl",
              wideFirst && index === 0 && "md:col-span-2",
            )}
          />
        ))}
      </div>
    </div>
  );
}
