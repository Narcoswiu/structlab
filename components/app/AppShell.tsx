import { Suspense } from "react";
import { AssistantButton } from "@/components/app/AssistantButton";
import { FeedbackButton } from "@/components/app/FeedbackButton";
import { Container } from "@/components/layout/Container";
import { TrackingNotice } from "@/components/tracking/TrackingNotice";
import { getAiConfig } from "@/lib/ai/config";
import { loadChapterRefs } from "@/lib/ai/load";
import { getAiUsedToday } from "@/lib/ai/usage";
import { getTrackingAcceptedAt } from "@/lib/tracking";
import type { CurrentUser } from "@/lib/auth";
import { AppHeader } from "./AppHeader";

/**
 * Обща рамка на вътрешните екрани: навигация, съдържание, помощник по
 * учебника и обратна връзка.
 */
export async function AppShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  // Без ключ за AI услуга помощникът търси само в уроците. Броячът на AI
  // въпросите се чете единствено когато услугата е включена.
  const ai = getAiConfig();
  const [accepted, chapters, used] = await Promise.all([
    getTrackingAcceptedAt(user.id),
    loadChapterRefs(),
    ai ? getAiUsedToday(user.id) : 0,
  ]);

  return (
    <Container className="flex flex-1 flex-col">
      <AppHeader user={user} />
      <main className="flex flex-1 flex-col gap-8 pt-6 pb-28">
        {accepted ? null : <TrackingNotice />}
        {children}
      </main>
      {/* чете адреса (?mode=), затова е в Suspense */}
      <Suspense fallback={null}>
        <AssistantButton
          mode={ai ? "ai" : "lessons"}
          chapters={chapters}
          remaining={ai ? Math.max(0, ai.dailyLimit - used) : undefined}
          providerName={ai?.providerName}
        />
      </Suspense>
      <FeedbackButton />
    </Container>
  );
}
