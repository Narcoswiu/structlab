import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { dismissIntro } from "@/app/(app)/actions";
import { NoAccess } from "@/components/app/NoAccess";
import { BeamLab } from "@/components/labs/BeamLab";
import { PageIntro } from "@/components/PageIntro";
import { hasActiveAccess } from "@/lib/access";
import { LabTracker } from "@/components/tracking/LabTracker";
import { requireUser } from "@/lib/auth";
import { getTrackingAcceptedAt } from "@/lib/tracking";
import { getDismissedIntros } from "@/lib/user-settings";

export const metadata: Metadata = { title: "Лаборатория за греди" };

export default async function BeamLabPage() {
  const user = await requireUser();
  const [allowed, dismissed] = await Promise.all([
    hasActiveAccess(user),
    getDismissedIntros(),
  ]);

  const trackingAccepted = Boolean(await getTrackingAcceptedAt(user.id));

  return (
    <>
      <PageIntro
        id="beam-lab"
        title="Лаборатория за греди"
        icon={<FlaskConical aria-hidden="true" className="size-6" />}
        dismissed={dismissed.has("beam-lab")}
        onDismiss={dismissIntro}
      >
        Избираш вид на гредата, дължина и товари. Реакциите и диаграмите Q и M
        се преизчисляват веднага. С „Покажи решението“ виждаш същите сметки,
        които би написал на лист – добър начин да провериш своята задача.
      </PageIntro>
      <div className="flex flex-col gap-2">
        <Link
          href="/labs"
          className="inline-flex min-h-11 items-center self-start text-[15px] font-bold text-link hover:text-link-hover"
        >
          ← Лаборатории
        </Link>
        <h1 className="sl-page-title">Лаборатория за греди</h1>
        <p className="max-w-[640px] text-muted-foreground">
          Знаци: сила и разпределен товар са положителни надолу, момент – по
          часовниковата стрелка. Диаграмата M е от страната на опънатите нишки.
        </p>
      </div>
      {allowed ? (
        <>
          {trackingAccepted ? <LabTracker lab="beam" /> : null}
          <BeamLab />
        </>
      ) : (
        <NoAccess />
      )}
    </>
  );
}
