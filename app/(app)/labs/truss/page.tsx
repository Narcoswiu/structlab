import type { Metadata } from "next";
import Link from "next/link";
import { Triangle } from "lucide-react";
import { dismissIntro } from "@/app/(app)/actions";
import { NoAccess } from "@/components/app/NoAccess";
import { TrussLab } from "@/components/labs/TrussLab";
import { PageIntro } from "@/components/PageIntro";
import { hasActiveAccess } from "@/lib/access";
import { LabTracker } from "@/components/tracking/LabTracker";
import { requireUser } from "@/lib/auth";
import { getTrackingAcceptedAt } from "@/lib/tracking";
import { getDismissedIntros } from "@/lib/user-settings";

export const metadata: Metadata = { title: "Ферма" };

export default async function TrussLabPage() {
  const user = await requireUser();
  const [allowed, dismissed] = await Promise.all([
    hasActiveAccess(user),
    getDismissedIntros(),
  ]);

  const trackingAccepted = Boolean(await getTrackingAcceptedAt(user.id));

  return (
    <>
      <PageIntro
        id="truss-lab"
        title="Ферма"
        icon={<Triangle aria-hidden="true" className="size-6" />}
        dismissed={dismissed.has("truss-lab")}
        onDismiss={dismissIntro}
      >
        Избираш една от три готови ферми, отвора, височината и товарите във
        възлите. Веднага виждаш опорните реакции и усилието във всеки прът –
        опън или натиск.
      </PageIntro>
      <div className="flex flex-col gap-2">
        <Link
          href="/labs"
          className="inline-flex min-h-11 items-center self-start text-[15px] font-bold text-link hover:text-link-hover"
        >
          ← Лаборатории
        </Link>
        <h1 className="sl-page-title">Ферма</h1>
        <p className="max-w-[640px] text-muted-foreground">
          Усилие с плюс е опън, с минус е натиск. На чертежа опънатите пръти са
          с плътна линия, а натиснатите – с пунктир.
        </p>
      </div>
      {allowed ? (
        <>
          {trackingAccepted ? <LabTracker lab="truss" /> : null}
          <TrussLab />
        </>
      ) : (
        <NoAccess />
      )}
    </>
  );
}
