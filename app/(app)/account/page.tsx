import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { ReminderToggle } from "@/components/app/ReminderToggle";
import { SpecialtyPicker } from "@/components/app/SpecialtyPicker";
import { buttonClass } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listSpecialties } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Профил" };

export default async function AccountPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("user_settings")
    .select("reminders_enabled")
    .eq("user_id", user.id)
    .maybeSingle();
  return (
    <>
      <h1 className="sl-page-title">Профил</h1>
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
      <section
        aria-labelledby="reminders-title"
        className="sl-card flex flex-col gap-4"
      >
        <h2 id="reminders-title" className="text-xl font-extrabold">
          Напомняния по имейл
        </h2>
        <p className="text-muted-foreground">
          Пишем ти, когато имаш въпроси за повторение или недовършена глава, и в
          понеделник – с отчет за седмицата. Най-много едно писмо на три дни и
          никога между 21:00 и 08:00.
        </p>
        <ReminderToggle enabled={settings?.reminders_enabled ?? false} />
      </section>
      <section className="sl-card flex flex-col gap-4">
        <h2 className="text-xl font-extrabold">Смяна на паролата</h2>
        <ChangePasswordForm />
      </section>
      <section
        aria-labelledby="my-data-title"
        className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface p-6"
      >
        <h2 id="my-data-title" className="text-xl font-extrabold">
          Моите данни
        </h2>
        <p className="text-muted-foreground">
          Можеш да изтеглиш копие на данните в акаунта си: профил, настройки,
          достъп, напредък, активност, повторение, лични задания и обратната
          връзка, която си ни пратил. Файлът съдържа само твои данни.
        </p>
        {/* обикновен линк, не <Link>: адресът връща файл, а не страница */}
        <a
          href="/account/export"
          download
          className={buttonClass({ variant: "outline" })}
        >
          Изтегли моите данни (JSON)
        </a>
      </section>
    </>
  );
}
