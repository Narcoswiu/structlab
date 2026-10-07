import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

export const metadata: Metadata = { title: "Нова парола" };

// Тук води линкът „Нова парола“ от имейла (вече си влязъл чрез него).
export default function NewPasswordPage() {
  return (
    <>
      <h1 className="font-display text-[clamp(24px,5vw,36px)] leading-[1.15] font-bold">
        Избери нова парола
      </h1>
      <section className="rounded-2xl border border-line bg-surface p-6">
        <ChangePasswordForm />
      </section>
    </>
  );
}
