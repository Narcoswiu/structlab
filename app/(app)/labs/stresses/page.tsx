import type { Metadata } from "next";
import Link from "next/link";
import { Layers } from "lucide-react";
import { dismissIntro } from "@/app/(app)/actions";
import { NoAccess } from "@/components/app/NoAccess";
import { StressLab } from "@/components/labs/StressLab";
import { PageIntro } from "@/components/PageIntro";
import { hasActiveAccess } from "@/lib/access";
import { LabTracker } from "@/components/tracking/LabTracker";
import { requireUser } from "@/lib/auth";
import { getTrackingAcceptedAt } from "@/lib/tracking";
import { getDismissedIntros } from "@/lib/user-settings";

export const metadata: Metadata = { title: "Напрежения в сечение" };

export default async function StressLabPage() {
  const user = await requireUser();
  const [allowed, dismissed] = await Promise.all([
    hasActiveAccess(user),
    getDismissedIntros(),
  ]);

  const trackingAccepted = Boolean(await getTrackingAcceptedAt(user.id));

  return (
    <>
      <PageIntro
        id="stresses-lab"
        title="Напрежения в сечение"
        icon={<Layers aria-hidden="true" className="size-6" />}
        dismissed={dismissed.has("stresses-lab")}
        onDismiss={dismissIntro}
      >
        Избираш сечение, огъващ момент M и напречна сила Q. Веднага виждаш
        диаграмите на нормалните и на тангенциалните напрежения и най-големите
        им стойности. С „Покажи как се смята“ излизат формулите с твоите числа.
      </PageIntro>
      <div className="flex flex-col gap-2">
        <Link
          href="/labs"
          className="inline-flex min-h-11 items-center self-start text-[15px] font-bold text-link hover:text-link-hover"
        >
          ← Лаборатории
        </Link>
        <h1 className="sl-page-title">Напрежения в сечение</h1>
        <p className="max-w-[640px] text-muted-foreground">
          Нормалните напрежения σ са по формулата на Навие, тангенциалните τ –
          по формулата на Журавски. Положителен момент опъва долните влакна.
        </p>
      </div>
      {allowed ? (
        <>
          {trackingAccepted ? <LabTracker lab="stresses" /> : null}
          <StressLab />
        </>
      ) : (
        <NoAccess />
      )}
    </>
  );
}
