import type { Metadata } from "next";
import Link from "next/link";
import { MoveVertical } from "lucide-react";
import { dismissIntro } from "@/app/(app)/actions";
import { NoAccess } from "@/components/app/NoAccess";
import { BucklingLab } from "@/components/labs/BucklingLab";
import { PageIntro } from "@/components/PageIntro";
import { hasActiveAccess } from "@/lib/access";
import { LabTracker } from "@/components/tracking/LabTracker";
import { requireUser } from "@/lib/auth";
import { getTrackingAcceptedAt } from "@/lib/tracking";
import { getDismissedIntros } from "@/lib/user-settings";

export const metadata: Metadata = { title: "Изкълчване на прът" };

export default async function BucklingLabPage() {
  const user = await requireUser();
  const [allowed, dismissed] = await Promise.all([
    hasActiveAccess(user),
    getDismissedIntros(),
  ]);

  const trackingAccepted = Boolean(await getTrackingAcceptedAt(user.id));

  return (
    <>
      <PageIntro
        id="buckling-lab"
        title="Изкълчване на прът"
        icon={<MoveVertical aria-hidden="true" className="size-6" />}
        dismissed={dismissed.has("buckling-lab")}
        onDismiss={dismissIntro}
      >
        Избираш подпиране, дължина и сечение на натиснат прът. Веднага виждаш
        гъвкавостта, критичната сила по Ойлер и дали формулата изобщо важи за
        този прът.
      </PageIntro>
      <div className="flex flex-col gap-2">
        <Link
          href="/labs"
          className="inline-flex min-h-11 items-center self-start text-[15px] font-bold text-link hover:text-link-hover"
        >
          ← Лаборатории
        </Link>
        <h1 className="sl-page-title">Изкълчване на прът</h1>
        <p className="max-w-[640px] text-muted-foreground">
          Формулата на Ойлер важи само за достатъчно стройни пръти: когато
          гъвкавостта λ е поне граничната λ_гр.
        </p>
      </div>
      {allowed ? (
        <>
          {trackingAccepted ? <LabTracker lab="buckling" /> : null}
          <BucklingLab />
        </>
      ) : (
        <NoAccess />
      )}
    </>
  );
}
