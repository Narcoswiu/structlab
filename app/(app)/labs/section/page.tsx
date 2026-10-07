import type { Metadata } from "next";
import Link from "next/link";
import { Shapes } from "lucide-react";
import { dismissIntro } from "@/app/(app)/actions";
import { NoAccess } from "@/components/app/NoAccess";
import { SectionLab } from "@/components/labs/SectionLab";
import { PageIntro } from "@/components/PageIntro";
import { hasActiveAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { getDismissedIntros } from "@/lib/user-settings";

export const metadata: Metadata = { title: "Лаборатория за сечения" };

export default async function SectionLabPage() {
  const user = await requireUser();
  const [allowed, dismissed] = await Promise.all([
    hasActiveAccess(user),
    getDismissedIntros(),
  ]);

  return (
    <>
      <PageIntro
        id="section-lab"
        title="Лаборатория за сечения"
        icon={<Shapes aria-hidden="true" className="size-6" />}
        dismissed={dismissed.has("section-lab")}
        onDismiss={dismissIntro}
      >
        Сглобяваш сечение от правоъгълници. Веднага получаваш центъра на
        тежестта, инерционните моменти, главните оси и таблицата на Щайнер – за
        да свериш собствената си сметка ред по ред.
      </PageIntro>
      <div className="flex flex-col gap-2">
        <Link
          href="/labs"
          className="inline-flex min-h-11 items-center self-start text-[15px] font-bold text-link hover:text-link-hover"
        >
          ← Лаборатории
        </Link>
        <h1 className="font-display text-[clamp(24px,5vw,36px)] leading-[1.15] font-bold">
          Лаборатория за сечения
        </h1>
        <p className="max-w-[640px] text-muted-foreground">
          Всички характеристики са спрямо централните оси – хоризонталната x и
          вертикалната y през центъра на тежестта.
        </p>
      </div>
      {allowed ? <SectionLab /> : <NoAccess />}
    </>
  );
}
