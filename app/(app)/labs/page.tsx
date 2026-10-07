import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/app/NoAccess";
import { TiltCard } from "@/components/three-d/TiltCard";
import { Badge } from "@/components/ui/badge";
import { hasActiveAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Лаборатории" };

const labs = [
  {
    href: "/labs/beam",
    title: "Греди",
    text: "Проста греда, конзола и греда с конзола. Реакции, диаграми Q и M и решение стъпка по стъпка.",
    available: true,
  },
  {
    href: null,
    title: "Сечения",
    text: "Сечение от правоъгълници: център на тежестта, инерционни моменти, главни оси и таблица на Щайнер.",
    available: false,
  },
] as const;

export default async function LabsPage() {
  const user = await requireUser();
  const allowed = await hasActiveAccess(user);

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(24px,5vw,36px)] leading-[1.15] font-bold">
          Лаборатории
        </h1>
        <p className="max-w-[640px] text-muted-foreground">
          Тук променяш числата и веднага виждаш резултата. Използвай ги, за да
          провериш собствено решение или да видиш как се променя диаграмата.
        </p>
      </div>
      {allowed ? (
        <div className="flex flex-wrap gap-4">
          {labs.map((lab) => (
            <TiltCard
              key={lab.title}
              className="max-w-[520px] flex-[1_1_300px] gap-3 p-6"
            >
              <Badge variant={lab.available ? "success" : "soon"}>
                {lab.available ? "НАЛИЧНА" : "СКОРО"}
              </Badge>
              <h2 className="text-xl font-extrabold">{lab.title}</h2>
              <p className="leading-[1.6] text-muted-foreground">{lab.text}</p>
              {lab.href ? (
                <Link
                  href={lab.href}
                  className="mt-auto inline-flex min-h-11 items-center self-start font-extrabold text-link hover:text-link-hover"
                >
                  Отвори лабораторията →
                </Link>
              ) : null}
            </TiltCard>
          ))}
        </div>
      ) : (
        <NoAccess />
      )}
    </>
  );
}
