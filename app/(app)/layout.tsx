import { AppShell } from "@/components/app/AppShell";
import { requireUser } from "@/lib/auth";

// (app) е защитената зона: всичко тук изисква вход.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
