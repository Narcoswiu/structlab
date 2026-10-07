import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export function DemoCta() {
  return (
    <section className="pt-16 pb-14 lg:pt-[104px] lg:pb-[88px]">
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-[20px] border border-line-strong bg-surface-2 p-6 sm:p-10">
        <div className="flex flex-col gap-2">
          <h2 className="text-[24px] font-extrabold sm:text-[30px]">
            Достъпът е с покана
          </h2>
          <p className="text-muted-foreground">
            Платформата е в бета версия. Остави имейла си и ще ти пишем, когато
            има място. Ако вече имаш покана, приеми я от линка в имейла.
          </p>
        </div>
        <Link
          href="/request-invite"
          className={buttonClass({
            variant: "warm",
            size: "lg",
            className: "px-7",
          })}
        >
          Поискай покана
        </Link>
      </div>
    </section>
  );
}
