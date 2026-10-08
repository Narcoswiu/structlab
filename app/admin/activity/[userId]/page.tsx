import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getUserTimeline } from "@/lib/admin-activity";
import { requireAdmin } from "@/lib/auth";
import { sofiaToday } from "@/lib/review-format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Времева линия" };

const timeFormat = new Intl.DateTimeFormat("bg-BG", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Sofia",
});

export default async function UserTimelinePage(
  props: PageProps<"/admin/activity/[userId]">,
) {
  await requireAdmin();
  const { userId } = await props.params;
  if (!z.uuid().safeParse(userId).success) notFound();
  const { user, entries } = await getUserTimeline(userId);
  if (!user) notFound();

  // повторението на въпросите (RLS: admin вижда редовете на всички)
  const supabase = await createClient();
  const { data: reviews } = await supabase
    .from("quiz_reviews")
    .select("due_on, attempts, correct")
    .eq("user_id", userId);
  const { data: taskRows } = await supabase
    .from("personal_tasks")
    .select("solved_at, attempts")
    .eq("user_id", userId);
  const tasks = {
    started: (taskRows ?? []).length,
    solved: (taskRows ?? []).filter((row) => row.solved_at).length,
    attempts: (taskRows ?? []).reduce((sum, row) => sum + row.attempts, 0),
  };
  const today = sofiaToday();
  const quiz = (reviews ?? []).reduce(
    (sum, row) => ({
      questions: sum.questions + 1,
      mastered: sum.mastered + (row.due_on === null ? 1 : 0),
      due: sum.due + (row.due_on !== null && row.due_on <= today ? 1 : 0),
      attempts: sum.attempts + row.attempts,
      correct: sum.correct + row.correct,
    }),
    { questions: 0, mastered: 0, due: 0, attempts: 0, correct: 0 },
  );

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/activity"
          className="inline-flex min-h-11 items-center self-start text-[15px] font-bold text-link hover:text-link-hover"
        >
          ← Активност
        </Link>
        <h1 className="font-display text-[clamp(22px,4.5vw,32px)] leading-[1.15] font-bold break-all">
          {user.email || "Потребител"}
        </h1>
        <p className="text-muted-foreground">
          {user.fullName || "без име"} · последните {entries.length} събития
          (без 15-секундните отчети за четене)
        </p>
      </div>
      {quiz.questions > 0 ? (
        <dl
          aria-label="Въпроси за повторение"
          className="flex flex-wrap gap-x-10 gap-y-3 rounded-2xl border border-line bg-surface p-5 text-sm text-dim sm:p-6"
        >
          {(
            [
              ["Отговорени въпроси", quiz.questions],
              ["Научени", quiz.mastered],
              ["Чакат повторение днес", quiz.due],
              [
                "Знаел е отговора",
                `${Math.round((quiz.correct / quiz.attempts) * 100)} %`,
              ],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className="font-mono text-xl text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {tasks.started > 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted-foreground sm:p-6">
          Лични задания: започнати {tasks.started}, решени {tasks.solved}, общо
          проверки {tasks.attempts}.
        </p>
      ) : null}
      {entries.length > 0 ? (
        <ol
          aria-label="Времева линия"
          className="flex flex-col rounded-2xl border border-line bg-surface p-5 sm:p-6"
        >
          {entries.map((entry, index) => (
            <li
              key={index}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-line py-3 first:border-0 first:pt-0"
            >
              <time
                dateTime={entry.at}
                className="w-40 flex-none font-mono text-sm text-dim"
              >
                {timeFormat.format(new Date(entry.at))}
              </time>
              <span className="font-bold">{entry.label}</span>
              {entry.detail ? (
                <span className="text-muted-foreground">{entry.detail}</span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-6 text-muted-foreground">
          Няма записани събития. Потребителят може още да не е потвърдил
          известието за проследяване.
        </p>
      )}
    </>
  );
}
