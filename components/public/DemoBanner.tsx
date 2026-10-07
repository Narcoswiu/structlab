import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

/** Стои най-горе на всяка демо страница. */
export function DemoBanner() {
  return (
    <aside
      aria-label="Демо"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-intro-line bg-surface-hi px-5 py-4"
    >
      <p className="min-w-0 flex-[1_1_280px] leading-[1.5]">
        <strong>Това е демо.</strong>{" "}
        <span className="text-muted-foreground">
          Пълният учебник е достъпен с покана.
        </span>
      </p>
      <Link href="/request-invite" className={buttonClass({ variant: "warm" })}>
        Поискай покана
      </Link>
    </aside>
  );
}
