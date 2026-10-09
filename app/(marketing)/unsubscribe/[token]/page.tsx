import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { buttonClass } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/form";
import { stopReminders } from "./actions";

export const metadata: Metadata = {
  title: "Спиране на напомнянията",
  robots: { index: false, follow: false },
  // Кодът е в адреса – не го пращаме като „referrer“ към други сайтове.
  referrer: "no-referrer",
};

// Страницата НЕ чете базата и изглежда еднакво за всеки код – съществуващ или
// не. Само отварянето ѝ (GET) не спира нищо: скенерите на пощите отварят
// линковете в писмата предварително. Спира едва бутонът (POST).
export default async function UnsubscribePage(
  props: PageProps<"/unsubscribe/[token]">,
) {
  const { token } = await props.params;
  const { done } = await props.searchParams;

  if (done === "1") {
    return (
      <AuthCard
        title="Спиране на напомнянията"
        subtitle="Готово. Ако линкът е от наше писмо, напомнянията по имейл за този акаунт са спрени."
      >
        <p className="leading-[1.6] text-muted-foreground">
          Писмата за вход, покана и нова парола продължават да пристигат – без
          тях акаунтът не може да работи. Можеш да включиш напомнянията отново
          по всяко време от „Профил“.
        </p>
        <Link href="/login" className={buttonClass({ size: "block" })}>
          Към входа
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Спиране на напомнянията"
      subtitle="Натисни бутона и StructLab спира да ти праща напомняния по имейл – за повторение, за недовършена глава и седмичния отчет."
    >
      <form action={stopReminders} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <SubmitButton size="block">Спри напомнянията</SubmitButton>
      </form>
      <p className="text-sm leading-[1.6] text-dim">
        Писмата за вход, покана и нова парола не са напомняния и продължават да
        пристигат. Можеш да включиш напомнянията отново от „Профил“.
      </p>
    </AuthCard>
  );
}
