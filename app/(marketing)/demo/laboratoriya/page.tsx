import type { Metadata } from "next";
import Link from "next/link";
import { BeamLab } from "@/components/labs/BeamLab";
import { DemoBanner } from "@/components/public/DemoBanner";
import { PublicHeading, PublicPage } from "@/components/public/PublicPage";

export const metadata: Metadata = {
  title: "Демо: лаборатория за греди",
  description:
    "Интерактивна лаборатория за греди: реакции, диаграми Q и M и решение стъпка по стъпка.",
};

export default function DemoLabPage() {
  return (
    <PublicPage>
      <DemoBanner />
      <div className="flex flex-col gap-2">
        <Link
          href="/demo"
          className="inline-flex min-h-11 items-center self-start text-[15px] font-bold text-link hover:text-link-hover"
        >
          ← Демо
        </Link>
        <PublicHeading title="Лаборатория за греди">
          Знаци: сила и разпределен товар са положителни надолу, момент – по
          часовниковата стрелка. Диаграмата M е от страната на опънатите нишки.
        </PublicHeading>
      </div>
      <BeamLab />
    </PublicPage>
  );
}
