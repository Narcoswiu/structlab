import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpFromLine } from "lucide-react";
import { dismissIntro } from "@/app/(app)/actions";
import { NoAccess } from "@/components/app/NoAccess";
import { ReactionsLab } from "@/components/labs/ReactionsLab";
import { PageIntro } from "@/components/PageIntro";
import { hasActiveAccess } from "@/lib/access";
import { LabTracker } from "@/components/tracking/LabTracker";
import { requireUser } from "@/lib/auth";
import { getTrackingAcceptedAt } from "@/lib/tracking";
import { getDismissedIntros } from "@/lib/user-settings";

export const metadata: Metadata = { title: "Опорни реакции" };

export default async function ReactionsLabPage() {
  const user = await requireUser();
  const [allowed, dismissed] = await Promise.all([
    hasActiveAccess(user),
    getDismissedIntros(),
  ]);

  const trackingAccepted = Boolean(await getTrackingAcceptedAt(user.id));

  return (
    <>
      <PageIntro
        id="reactions-lab"
        title="Опорни реакции"
        icon={<ArrowUpFromLine aria-hidden="true" className="size-6" />}
        dismissed={dismissed.has("reactions-lab")}
        onDismiss={dismissIntro}
      >
        Избираш опорите на една греда и добавяш до пет товара. Веднага виждаш
        гредата като свободно тяло, трите опорни реакции и проверката, че
        гредата е в равновесие.
      </PageIntro>
      <div className="flex flex-col gap-2">
        <Link
          href="/labs"
          className="inline-flex min-h-11 items-center self-start text-[15px] font-bold text-link hover:text-link-hover"
        >
          ← Лаборатории
        </Link>
        <h1 className="sl-page-title">Опорни реакции</h1>
        <p className="max-w-[640px] text-muted-foreground">
          Приети посоки: A_h надясно, A_v и B_v нагоре, моментът обратно на
          часовниковата стрелка е плюс. Реакция с минус действа обратно на
          приетата посока.
        </p>
      </div>
      {allowed ? (
        <>
          {trackingAccepted ? <LabTracker lab="reactions" /> : null}
          <ReactionsLab />
        </>
      ) : (
        <NoAccess />
      )}
    </>
  );
}
