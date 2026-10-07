import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { SpecialtyPicker } from "@/components/app/SpecialtyPicker";
import { requireUser } from "@/lib/auth";
import { listSpecialties } from "@/lib/catalog";

export const metadata: Metadata = { title: "Профил" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <h1 className="font-display text-[clamp(24px,5vw,36px)] leading-[1.15] font-bold">
        Профил
      </h1>
      <section className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-6">
        <span className="text-sm text-dim">Име</span>
        <span className="font-bold">{user.fullName || "—"}</span>
        <span className="mt-3 text-sm text-dim">Имейл</span>
        <span className="font-bold break-all">{user.email}</span>
      </section>
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-xl font-extrabold">Специалност</h2>
        <p className="text-muted-foreground">
          По нея се подрежда таблото ти. Можеш да я смениш по всяко време.
        </p>
        <SpecialtyPicker
          specialties={await listSpecialties()}
          currentId={user.specialtyId}
        />
      </section>
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-xl font-extrabold">Смяна на паролата</h2>
        <ChangePasswordForm />
      </section>
    </>
  );
}
