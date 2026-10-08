import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { TaskCheckState } from "@/app/(app)/tasks/actions";
import { NoAccess } from "@/components/app/NoAccess";
import { TaskAnswerForm } from "@/components/tasks/TaskAnswerForm";
import { TaskFigure } from "@/components/tasks/TaskFigure";
import { hasActiveAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { formatDecimal } from "@/lib/number-input";
import { TASK_LIST, buildTask } from "@/lib/personal-tasks";
import { getTaskStates, getVariant } from "@/lib/tasks";

const MODULE = "saprotivlenie-na-materialite";

/** 210000 → „210 000“; останалото – с десетична запетая. */
function formatGiven(value: number, decimals: number): string {
  return formatNumber(value, decimals).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export async function generateMetadata(
  props: PageProps<"/tasks/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const item = TASK_LIST.find((task) => task.slug === slug);
  return { title: item ? item.title : "Лично задание" };
}

export default async function TaskPage(props: PageProps<"/tasks/[slug]">) {
  const { slug } = await props.params;
  const user = await requireUser();
  if (!TASK_LIST.some((task) => task.slug === slug)) notFound();
  if (!(await hasActiveAccess(user))) {
    return (
      <>
        <h1 className="font-display text-[clamp(22px,4.5vw,32px)] leading-[1.15] font-bold">
          Лично задание
        </h1>
        <NoAccess />
      </>
    );
  }
  const variant = await getVariant(user.id);
  // без вариант няма числа – първо се въвежда факултетният номер
  if (!variant) redirect("/tasks");
  const task = buildTask(slug, variant);
  if (!task) notFound();

  const state = (await getTaskStates(user.id)).get(task.slug);
  const initial: TaskCheckState = {
    checked: false,
    values: Object.fromEntries(
      Object.entries(state?.answers ?? {}).map(([id, value]) => [
        id,
        formatDecimal(value),
      ]),
    ),
    fieldErrors: {},
    results: state?.results ?? {},
    solved: Boolean(state?.solvedAt),
  };
  const index = TASK_LIST.findIndex((item) => item.slug === slug);
  const next = TASK_LIST[index + 1];

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link
          href="/tasks"
          className="inline-flex min-h-11 items-center self-start text-[15px] font-bold text-link hover:text-link-hover"
        >
          ← Лични задания
        </Link>
        <p className="font-mono text-sm text-dim">
          Задание {index + 1} · вариант {variant.a}-{variant.b}-{variant.c}
        </p>
        <h1 className="font-display text-[clamp(22px,4.5vw,32px)] leading-[1.15] font-bold">
          {task.title}
        </h1>
      </div>

      <section
        aria-label="Условие"
        className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6"
      >
        <div className="flex max-w-[68ch] flex-col gap-3 leading-[1.65]">
          {task.statement.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <dl
          aria-label="Дадено"
          className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap"
        >
          {task.given.map((item) => (
            <div
              key={item.symbol}
              className="flex min-w-0 flex-col gap-1 rounded-xl bg-surface-2 p-3 sm:flex-[0_1_150px]"
            >
              <dt className="text-xs font-bold text-dim">{item.symbol}</dt>
              <dd className="font-mono text-lg">
                {formatGiven(item.value, item.decimals ?? 0)} {item.unit}
              </dd>
            </div>
          ))}
        </dl>
        <TaskFigure task={task} />
        <p className="text-sm text-dim">
          Теорията е в{" "}
          <Link
            href={`/learn/${MODULE}/${task.chapter.slug}`}
            className="font-bold text-link hover:text-link-hover"
          >
            Глава {task.chapter.number}
          </Link>
          . Реши задачата на хартия и въведи резултатите долу.
        </p>
      </section>

      <section
        aria-label="Отговори"
        className="flex flex-col gap-4 rounded-2xl border border-line-strong bg-surface p-5 sm:p-6"
      >
        <h2 className="text-xl font-extrabold">Твоите отговори</h2>
        <TaskAnswerForm
          task={task.slug}
          initial={initial}
          fields={task.questions.map((question) => ({
            id: question.id,
            label: question.label,
            symbol: question.symbol,
            unit: question.unit,
            hint: question.hint,
          }))}
        />
      </section>

      {next ? (
        <Link
          href={`/tasks/${next.slug}`}
          className="inline-flex min-h-11 items-center self-start font-extrabold text-link hover:text-link-hover"
        >
          Следващо задание: {next.title} →
        </Link>
      ) : null}
    </>
  );
}
