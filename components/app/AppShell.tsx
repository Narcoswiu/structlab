import { FeedbackButton } from "@/components/app/FeedbackButton";
import { Container } from "@/components/layout/Container";
import { TrackingNotice } from "@/components/tracking/TrackingNotice";
import { getTrackingAcceptedAt } from "@/lib/tracking";
import type { CurrentUser } from "@/lib/auth";
import { AppHeader } from "./AppHeader";

/** Обща рамка на вътрешните екрани: навигация, съдържание, обратна връзка. */
export async function AppShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const accepted = await getTrackingAcceptedAt(user.id);

  return (
    <Container className="flex flex-1 flex-col">
      <AppHeader user={user} />
      <main className="flex flex-1 flex-col gap-8 pt-6 pb-28">
        {accepted ? null : <TrackingNotice />}
        {children}
      </main>
      <FeedbackButton />
    </Container>
  );
}
