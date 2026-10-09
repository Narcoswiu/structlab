import type { Metadata } from "next";
import Link from "next/link";
import { Spline } from "lucide-react";
import { dismissIntro } from "@/app/(app)/actions";
import { NoAccess } from "@/components/app/NoAccess";
import { DeflectionLab } from "@/components/labs/DeflectionLab";
import { PageIntro } from "@/components/PageIntro";
import { hasActiveAccess } from "@/lib/access";
import { LabTracker } from "@/components/tracking/LabTracker";
import { requireUser } from "@/lib/auth";
import { getTrackingAcceptedAt } from "@/lib/tracking";
import { getDismissedIntros } from "@/lib/user-settings";

export const metadata: Metadata = { title: "Провисване на греда" };

export default async function DeflectionLabPage() {
  const user = await requireUser();
  const [allowed, dismissed] = await Promise.all([
    hasActiveAccess(user),
    getDismissedIntros(),
  ]);

  const trackingAccepted = Boolean(await getTrackingAcceptedAt(user.id));

  return (
    <>
      <PageIntro
        id="deflection-lab"
        title="Провисване на греда"
        icon={<Spline aria-hidden="true" className="size-6" />}
        dismissed={dismissed.has("deflection-lab")}
        onDismiss={dismissIntro}
      >
        Избираш схема, дължина, товар и сечение. Веднага виждаш еластичната
        линия, най-голямото провисване и ъгъла на завъртане. Сравняваш с
        допустимото провисване, което е зададено в твоята задача.
      </PageIntro>
      <div className="flex flex-col gap-2">
        <Link
          href="/labs"
          className="inline-flex min-h-11 items-center self-start text-[15px] font-bold text-link hover:text-link-hover"
        >
          ← Лаборатории
        </Link>
        <h1 className="sl-page-title">Провисване на греда</h1>
        <p className="max-w-[640px] text-muted-foreground">
          Четирите типови случая при постоянна коравина E·I. Провисването е
          положително надолу.
        </p>
      </div>
      {allowed ? (
        <>
          {trackingAccepted ? <LabTracker lab="deflection" /> : null}
          <DeflectionLab />
        </>
      ) : (
        <NoAccess />
      )}
    </>
  );
}
