import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { GridFloor } from "@/components/three-d/GridFloor";
import { buttonClass } from "@/components/ui/button";
import { BeamPreview } from "./BeamPreview";

export function Hero() {
  return (
    <div className="relative overflow-hidden border-b border-line-soft">
      <GridFloor />
      <Container className="relative">
        <SiteHeader />
        <section className="flex flex-wrap items-center gap-10 pt-12 pb-16 lg:gap-14 lg:pt-[88px] lg:pb-[104px]">
          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-7">
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-line-strong bg-surface-2 px-3.5 py-2 text-sm font-semibold text-muted-foreground">
              <span className="size-2 flex-none rounded-full bg-success" />
              За студенти по строителство и архитектура
            </span>
            <h1 className="font-display text-[clamp(26px,7.4vw,46px)] leading-[1.08] font-bold tracking-[-0.5px] lg:text-[clamp(38px,3.6vw,46px)]">
              Инженерството, обяснено ясно.
            </h1>
            <p className="max-w-[520px] text-[17px] leading-[1.65] text-muted-foreground sm:text-[19px]">
              Учебници в два режима, интерактивни лаборатории и AI асистент,
              който води към решението, вместо да го дава наготово.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/demo" className={buttonClass({ size: "lg" })}>
                Отвори лабораторията
                <ArrowRight className="size-[18px]" strokeWidth={2.5} />
              </Link>
              <Link
                href="/welcome"
                className={buttonClass({ variant: "outline", size: "lg" })}
              >
                Как работи сайтът
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-7 gap-y-2.5 text-sm font-semibold text-dim">
              <span>Леко ⇄ Подробно</span>
              <span>Лични задания</span>
              <span>Проследяване на напредъка</span>
            </div>
          </div>
          <BeamPreview />
        </section>
      </Container>
    </div>
  );
}
