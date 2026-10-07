import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return <AppShell user={user}>{children}</AppShell>;
}
