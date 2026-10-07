import type { Metadata } from "next";
import { LayoutGrid } from "lucide-react";
import { dismissIntro } from "@/app/(app)/actions";
import { PageIntro } from "@/components/PageIntro";
import { TiltCard } from "@/components/three-d/TiltCard";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { daysUntil, formatDate } from "@/lib/format-date";
import { createClient } from "@/lib/supabase/server";
import { getDismissedIntros } from "@/lib/user-settings";

export const metadata: Metadata = { title: "Табло" };

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  // RLS връща само модулите с активен достъп и само собствените записвания.
  const [modulesResult, enrollmentsResult, dismissed] = await Promise.all([
    supabase
      .from("modules")
      .select("id, title, description")
      .order("sort_order"),
    supabase
      .from("enrollments")
      .select("expires_at, revoked_at, starts_at, access_plans(name)")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1),
    getDismissedIntros(),
  ]);
  const modules = modulesResult.data ?? [];
  const enrollment = enrollmentsResult.data?.[0];
  const firstName = user.fullName.split(" ")[0];

  return (
    <>
      <PageIntro
        id="dashboard"
        title="Табло – твоят начален екран"
        icon={<LayoutGrid aria-hidden="true" className="size-6" />}
        dismissed={dismissed.has("dashboard")}
        onDismiss={dismissIntro}
      >
        Оттук ще продължаваш откъдето си спрял и ще виждаш модулите, до които
        имаш достъп. Учебникът и лабораториите се добавят в следващите седмици.
      </PageIntro>

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(24px,5vw,36px)] leading-[1.15] font-bold">
          {firstName ? `Здравей, ${firstName}!` : "Здравей!"}
        </h1>
        {enrollment ? (
          <p className="text-muted-foreground">
            План „{enrollment.access_plans?.name}“ · активен до{" "}
            <strong className="text-foreground">
              {formatDate(enrollment.expires_at)}
            </strong>{" "}
            (още {daysUntil(enrollment.expires_at)} дни)
          </p>
        ) : user.role === "admin" ? (
          <p className="text-muted-foreground">
            Влязъл си като администратор – виждаш всички модули.
          </p>
        ) : null}
      </div>

      {modules.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-extrabold">Твоите модули</h2>
          <div className="flex flex-wrap gap-4">
            {modules.map((item) => (
              <TiltCard
                key={item.id}
                className="max-w-[560px] flex-[1_1_320px] gap-3 p-6"
              >
                <Badge variant="success">АКТИВЕН</Badge>
                <h3 className="text-xl font-extrabold">{item.title}</h3>
                <p className="leading-[1.6] text-muted-foreground">
                  {item.description}
                </p>
                <p className="mt-auto text-sm text-dim">
                  Първите глави се подготвят.
                </p>
              </TiltCard>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl bg-warn-bg p-6 text-warn-fg">
          <h2 className="text-lg font-extrabold">Нямаш активен достъп</h2>
          <p className="mt-1 leading-[1.6]">
            Срокът на плана ти е изтекъл или достъпът е спрян. Пиши ни през
            бутона „Обратна връзка“, ако смяташ, че е грешка.
          </p>
        </section>
      )}
    </>
  );
}
