import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { dismissIntro } from "@/app/(app)/actions";
import { NoAccess } from "@/components/app/NoAccess";
import { PageIntro } from "@/components/PageIntro";
import { FacultyNumberForm } from "@/components/tasks/FacultyNumberForm";
import { Badge } from "@/components/ui/badge";
import { hasActiveAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { TASK_LIST, buildTask } from "@/lib/personal-tasks";
import { getTaskStates, getVariant } from "@/lib/tasks";
import { getDismissedIntros } from "@/lib/user-settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Лични задания" };

export default async function TasksPage() {
  const user = await requireUser();
  const [allowed, variant, states, dismissed] = await Promise.all([
    hasActiveAccess(user),
    getVariant(user.id),
    getTaskStates(user.id),
    getDismissedIntros(),
  ]);
  const solved = TASK_LIST.filter(
    (task) => states.get(task.slug)?.solvedAt,
  ).length;

  return (
    <>
      <PageIntro
        id="tasks"
        title="Лични задания – твоят вариант"
        icon={<ClipboardList aria-hidden="true" className="size-6" />}
        dismissed={dismissed.has("tasks")}
        onDismiss={dismissIntro}
      >
        Задачите са еднакви за всички, но числата са различни – смятат се от
        факултетния ти номер. Решаваш на хартия, въвеждаш резултатите и виждаш
        кои са верни.
      </PageIntro>

      <div className="flex flex-col gap-2">
        <h1 className="sl-page-title">
          Лични задания
        </h1>
        {allowed && variant ? (
          <p className="text-muted-foreground">
            Вариант{" "}
            <strong className="font-mono text-foreground">
              {variant.a}-{variant.b}-{variant.c}
            </strong>{" "}
            · решени {solved} от {TASK_LIST.length}
          </p>
        ) : null}
        {allowed && variant ? (
          <span
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={TASK_LIST.length}
            aria-valuenow={solved}
            aria-label={`Решени задания: ${solved} от ${TASK_LIST.length}`}
            className="sl-meter mt-1 max-w-56"
          >
            <span style={{ width: `${(solved / TASK_LIST.length) * 100}%` }} />
          </span>
        ) : null}
      </div>

      {!allowed ? (
        <NoAccess />
      ) : !variant ? (
        <section
          aria-label="Въведи факултетен номер"
          className="sl-card flex flex-col gap-4 border-intro-line bg-surface-hi"
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-extrabold">
              Започни с факултетния си номер
            </h2>
            <p className="max-w-[640px] text-muted-foreground">
              От последните три цифри се получава твоят вариант. Така числата в
              задачите ти са различни от тези на колегите ти.
            </p>
          </div>
          <FacultyNumberForm submitLabel="Покажи заданията" />
        </section>
      ) : (
        <>
          <ol aria-label="Задания" className="flex flex-col gap-3">
            {TASK_LIST.map((item, index) => {
              const task = buildTask(item.slug, variant)!;
              const state = states.get(item.slug);
              const correct = task.questions.filter(
                (question) => state?.results[question.id],
              ).length;
              return (
                <li key={item.slug}>
                  <Link
                    href={`/tasks/${item.slug}`}
                    className="sl-card sl-card-link grid min-h-11 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2.5 no-underline sm:flex"
                  >
                    {/* на телефон етикетът е под заглавието, за да не го притиска */}
                    <span
                      className={cn(
                        "inline-flex size-10 flex-none items-center justify-center rounded-full font-mono text-sm",
                        state?.solvedAt
                          ? "bg-success-bg text-success-fg"
                          : "bg-surface-2 text-muted-foreground",
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-lg leading-snug font-extrabold text-foreground">
                        {item.title}
                      </span>
                      <span className="text-sm text-dim">
                        По Глава {task.chapter.number}
                        {state
                          ? ` · ${correct} от ${task.questions.length} верни · ${state.attempts} ${state.attempts === 1 ? "проверка" : "проверки"}`
                          : ""}
                      </span>
                    </span>
                    <span className="col-start-2 flex items-center gap-3">
                      {state?.solvedAt ? (
                        <Badge variant="success">РЕШЕНО</Badge>
                      ) : state ? (
                        <Badge variant="tag">ЗАПОЧНАТО</Badge>
                      ) : (
                        <Badge variant="soon">НОВО</Badge>
                      )}
                      <ChevronRight
                        aria-hidden="true"
                        className="hidden size-5 text-dim sm:block"
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>

          <details className="sl-card py-3 sm:py-3">
            <summary className="flex min-h-11 cursor-pointer items-center font-bold text-link">
              Сбъркал си номера? Смени го
            </summary>
            <div className="mt-2 mb-2 flex flex-col gap-3">
              <p className="max-w-[640px] text-sm text-warn-fg">
                Ако новият номер дава друг вариант, числата във всички задания
                се сменят и досегашните ти отговори се изтриват.
              </p>
              <FacultyNumberForm submitLabel="Смени номера" />
            </div>
          </details>
        </>
      )}
    </>
  );
}
