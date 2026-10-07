import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginLinkForm } from "@/components/auth/LoginLinkForm";

export const metadata: Metadata = { title: "Забравена парола" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Линк по имейл"
      subtitle="Въведи имейла на акаунта си. Ще ти изпратим линк, който важи 1 час."
    >
      <LoginLinkForm />
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center self-center text-sm font-bold text-link hover:text-link-hover"
      >
        ← Към входа
      </Link>
    </AuthCard>
  );
}
