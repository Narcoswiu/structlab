import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { SpecialtyPicker } from "@/components/app/SpecialtyPicker";
import { requireUser } from "@/lib/auth";
import { listSpecialties } from "@/lib/catalog";

export const metadata: Metadata = { title: "Профил" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <h1 className="sl-page-title">
        Профил
      </h1>
      <section className="sl-card flex flex-wrap items-center gap-x-10 gap-y-4">
        <span
          aria-hidden="true"
          className="inline-flex size-12 flex-none items-center justify-center rounded-full bg-intro-icon text-link"
        >
          <UserRound className="size-6" />
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-sm text-dim">Име</span>
          <span className="font-bold">{user.fullName || "—"}</span>
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-sm text-dim">Имейл</span>
          <span className="font-bold break-all">{user.email}</span>
        </span>
      </section>
      <section className="sl-card flex flex-col gap-4">
        <h2 className="text-xl font-extrabold">Специалност</h2>
        <p className="text-muted-foreground">
          По нея се подрежда таблото ти. Можеш да я смениш по всяко време.
        </p>
        <SpecialtyPicker
          specialties={await listSpecialties()}
          currentId={user.specialtyId}
        />
      </section>
      <section className="sl-card flex flex-col gap-4">
        <h2 className="text-xl font-extrabold">Смяна на паролата</h2>
        <ChangePasswordForm />
      </section>
    </>
  );
}
