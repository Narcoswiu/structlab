import { FeedbackButton } from "@/components/app/FeedbackButton";
import { Container } from "@/components/layout/Container";
import type { CurrentUser } from "@/lib/auth";
import { AppHeader } from "./AppHeader";

/** Обща рамка на вътрешните екрани: навигация, съдържание, обратна връзка. */
export function AppShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  return (
    <Container className="flex flex-1 flex-col">
      <AppHeader user={user} />
      <main className="flex flex-1 flex-col gap-8 pt-6 pb-28">{children}</main>
      <FeedbackButton />
    </Container>
  );
}
