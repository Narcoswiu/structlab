import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { dismissIntro } from "@/app/(app)/actions";
import { NoAccess } from "@/components/app/NoAccess";
import { SpecialtyPicker } from "@/components/app/SpecialtyPicker";
import { StudyPlan } from "@/components/app/StudyPlan";
import { PageIntro } from "@/components/PageIntro";
import { TiltCard } from "@/components/three-d/TiltCard";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { getPlan, listSpecialties } from "@/lib/catalog";
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
      .select("id, slug, title, description, chapters(slug, number, title)")
      .order("sort_order")
      .order("number", { referencedTable: "chapters" }),
    supabase
      .from("enrollments")
      .select("expires_at, access_plans(name, is_lifetime)")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1),
    getDismissedIntros(),
  ]);
  const specialties = await listSpecialties();
  const specialty = specialties.find((item) => item.id === user.specialtyId);
  const plan = specialty ? await getPlan(specialty.id, specialty.years) : null;
  // в бързия списък са само модулите, които вече имат глави
  const modules = (modulesResult.data ?? []).filter(
    (item) => item.chapters.length > 0,
  );
  const hasAccess = (modulesResult.data ?? []).length > 0;
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
        Тук е учебният план на твоята специалност, курс по курс. Дисциплините
        със зелен етикет вече имат глави за четене; останалите се добавят
        постепенно.
      </PageIntro>

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(24px,5vw,36px)] leading-[1.15] font-bold">
          {firstName ? `Здравей, ${firstName}!` : "Здравей!"}
        </h1>
        {enrollment ? (
          <p className="text-muted-foreground">
            План „{enrollment.access_plans?.name}“ ·{" "}
            {enrollment.access_plans?.is_lifetime ? (
              <strong className="text-foreground">без срок</strong>
            ) : (
              <>
                активен до{" "}
                <strong className="text-foreground">
                  {formatDate(enrollment.expires_at)}
                </strong>{" "}
                (още {daysUntil(enrollment.expires_at)} дни)
              </>
            )}
          </p>
        ) : user.role === "admin" ? (
          <p className="text-muted-foreground">
            Влязъл си като администратор – виждаш всички модули.
          </p>
        ) : null}
      </div>

      {hasAccess ? (
        specialty && plan ? (
          <StudyPlan specialty={specialty} plan={plan} />
        ) : (
          <section
            aria-label="Избор на специалност"
            className="flex flex-col gap-4 rounded-2xl border border-intro-line bg-surface-hi p-5 sm:p-6"
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-extrabold">Коя специалност учиш?</h2>
              <p className="text-muted-foreground">
                Избери я и таблото ще се подреди по твоя учебен план – курс по
                курс, семестър по семестър.
              </p>
            </div>
            <SpecialtyPicker specialties={specialties} currentId={null} />
          </section>
        )
      ) : null}

      {!hasAccess ? (
        <NoAccess />
      ) : modules.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-extrabold">Готово за четене</h2>
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
                {item.chapters.length > 0 ? (
                  <ol className="mt-1 flex flex-col">
                    {item.chapters.map((chapter) => (
                      <li key={chapter.slug} className="border-t border-line">
                        <Link
                          href={`/learn/${item.slug}/${chapter.slug}`}
                          className="flex min-h-11 items-center gap-3 py-2 font-bold text-link hover:text-link-hover"
                        >
                          <span className="font-mono text-sm text-dim">
                            {String(chapter.number).padStart(2, "0")}
                          </span>
                          {chapter.title}
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-auto text-sm text-dim">
                    Първите глави се подготвят.
                  </p>
                )}
              </TiltCard>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
