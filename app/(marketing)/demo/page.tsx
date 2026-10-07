import type { Metadata } from "next";
import Link from "next/link";
import { DemoBanner } from "@/components/public/DemoBanner";
import { PublicHeading, PublicPage } from "@/components/public/PublicPage";
import { TiltCard } from "@/components/three-d/TiltCard";
import { getDemoChapter } from "@/lib/demo";

// Съдържанието идва от базата: страницата се обновява най-много на 5 минути.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Демо",
  description:
    "Пробвай StructLab без регистрация: една глава от учебника и лабораторията за греди.",
};

export default async function DemoPage() {
  const chapter = await getDemoChapter();

  return (
    <PublicPage>
      <DemoBanner />
      <PublicHeading title="Пробвай без регистрация">
        Две неща от платформата са отворени за всеки: една глава от учебника и
        лабораторията за греди.
      </PublicHeading>
      <div className="flex flex-wrap gap-4">
        {chapter ? (
          <TiltCard className="max-w-[520px] flex-[1_1_300px] gap-3 p-6">
            <span className="font-mono text-sm text-primary">
              {chapter.moduleTitle} · Глава {chapter.number}
            </span>
            <h2 className="text-xl font-extrabold">{chapter.title}</h2>
            <p className="leading-[1.6] text-muted-foreground">
              {chapter.summary}
            </p>
            <Link
              href="/demo/uchebnik"
              className="mt-auto inline-flex min-h-11 items-center self-start font-extrabold text-link hover:text-link-hover"
            >
              Прочети главата →
            </Link>
          </TiltCard>
        ) : null}
        <TiltCard className="max-w-[520px] flex-[1_1_300px] gap-3 p-6">
          <span className="font-mono text-sm text-warm">Лаборатория</span>
          <h2 className="text-xl font-extrabold">Греди</h2>
          <p className="leading-[1.6] text-muted-foreground">
            Сменяш товарите и веднага виждаш реакциите и диаграмите Q и M, с
            решение стъпка по стъпка.
          </p>
          <Link
            href="/demo/laboratoriya"
            className="mt-auto inline-flex min-h-11 items-center self-start font-extrabold text-link hover:text-link-hover"
          >
            Отвори лабораторията →
          </Link>
        </TiltCard>
      </div>
    </PublicPage>
  );
}
