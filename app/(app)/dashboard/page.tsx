import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  LayoutGrid,
  Repeat,
} from "lucide-react";
import { dismissIntro } from "@/app/(app)/actions";
import { ActionCard } from "@/components/app/ActionCard";
import { NoAccess } from "@/components/app/NoAccess";
import { ProgressBar } from "@/components/app/ProgressBar";
import { SpecialtyPicker } from "@/components/app/SpecialtyPicker";
import { StudyPlan } from "@/components/app/StudyPlan";
import { PageIntro } from "@/components/PageIntro";
import { TiltCard } from "@/components/three-d/TiltCard";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getPlan, listSpecialties } from "@/lib/catalog";
import { getMyProgress } from "@/lib/progress";
import { getReviewSummary } from "@/lib/review";
import { getTasksSummary } from "@/lib/tasks";
import { describeDue, questionsLabel, sofiaToday } from "@/lib/review-format";
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
      .select("id, slug, title, description, chapters(id, slug, number, title)")
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
  const myProgress = await getMyProgress(user.id);
  const review = await getReviewSummary(user.id);
  const tasks = await getTasksSummary(user.id);
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
  const resume = hasAccess ? myProgress.resume : null;
  const showReview = review.learning + review.mastered > 0;

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
        <h1 className="sl-page-title">
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
        <div className="grid gap-4 md:grid-cols-2">
          {resume ? (
            <ActionCard
              label="Продължи откъдето спря"
              tone="blue"
              icon={<BookOpen className="size-5" />}
              primary
              className="md:col-span-2"
              title={resume.chapterTitle}
              description={
                <>
                  {resume.moduleTitle}
                  {resume.sectionTitle
                    ? ` · стигна до „${resume.sectionTitle}“`
                    : ""}
                </>
              }
              action={
                <Link
                  href={resume.href}
                  className={buttonClass({ size: "lg" })}
                >
                  Продължи
                  <ArrowRight aria-hidden="true" className="size-5" />
                </Link>
              }
            >
              <ProgressBar progress={resume.progress} wide />
            </ActionCard>
          ) : null}

          {showReview ? (
            <ActionCard
              label="Днес за повторение"
              tone="success"
              icon={<Repeat className="size-5" />}
              primary={!resume && review.due > 0}
              title={
                review.due > 0
                  ? questionsLabel(review.due)
                  : "Няма въпроси за днес"
              }
              description={
                review.due > 0
                  ? "Няколко минути сега пестят часове преди изпита."
                  : review.nextDueOn
                    ? `Следващото повторение е ${describeDue(review.nextDueOn, sofiaToday())}.`
                    : "Всички отговорени въпроси са научени."
              }
              action={
                review.due > 0 ? (
                  <Link
                    href="/review"
                    className={buttonClass({
                      variant: resume ? "outline" : "default",
                    })}
                  >
                    Започни
                  </Link>
                ) : null
              }
            />
          ) : null}

          <ActionCard
            label="Лични задания"
            tone="warm"
            icon={<ClipboardList className="size-5" />}
            wide={!showReview}
            className={showReview ? undefined : "md:col-span-2"}
            title={
              tasks.started > 0
                ? `Решени ${tasks.solved} от ${tasks.total}`
                : `${tasks.total} задачи с твоите числа`
            }
            description={
              tasks.started > 0
                ? tasks.solved === tasks.total
                  ? "Всички задания са решени."
                  : "Продължи оттам, докъдето си стигнал."
                : "Числата се смятат от факултетния ти номер, а отговорите се проверяват веднага."
            }
            action={
              <Link
                href="/tasks"
                className={buttonClass({ variant: "outline" })}
              >
                {tasks.started > 0 ? "Към заданията" : "Започни"}
              </Link>
            }
          >
            {tasks.started > 0 ? (
              <span
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={tasks.total}
                aria-valuenow={tasks.solved}
                aria-label={`Решени задания: ${tasks.solved} от ${tasks.total}`}
                className="sl-meter mt-1 max-w-56"
              >
                <span
                  style={{ width: `${(tasks.solved / tasks.total) * 100}%` }}
                />
              </span>
            ) : null}
          </ActionCard>
        </div>
      ) : null}

      {hasAccess ? (
        specialty && plan ? (
          <StudyPlan specialty={specialty} plan={plan} />
        ) : (
          <section
            aria-label="Избор на специалност"
            className="sl-card flex flex-col gap-4 border-intro-line bg-surface-hi"
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
                          <span className="min-w-0 flex-1">
                            {chapter.title}
                          </span>
                          {myProgress.byChapter.has(chapter.id) ? (
                            <ProgressBar
                              progress={myProgress.byChapter.get(chapter.id)!}
                            />
                          ) : null}
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
