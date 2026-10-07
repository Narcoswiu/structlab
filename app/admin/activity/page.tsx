import type { Metadata } from "next";
import Link from "next/link";
import { Activity } from "lucide-react";
import { dismissIntro } from "@/app/(app)/actions";
import { PageIntro } from "@/components/PageIntro";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { getActivityOverview } from "@/lib/admin-activity";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format-date";
import { formatDuration } from "@/lib/progress";
import { getDismissedIntros } from "@/lib/user-settings";

export const metadata: Metadata = { title: "Активност" };

const statusLabel = {
  active: "АКТИВЕН",
  expired: "ИЗТЕКЪЛ",
  revoked: "СПРЯН",
  none: "БЕЗ ПЛАН",
} as const;

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <h2 className="text-xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

export default async function ActivityPage() {
  await requireAdmin();
  const [overview, dismissed] = await Promise.all([
    getActivityOverview(),
    getDismissedIntros(),
  ]);
  const peak = Math.max(...overview.days.map((day) => day.seconds), 1);
  const metrics = [
    { name: "Активни за 7 дни", value: String(overview.metrics.activeUsers7d) },
    {
      name: "Време за 7 дни",
      value: formatDuration(overview.metrics.seconds7d),
    },
    { name: "Отворени глави", value: String(overview.metrics.chaptersOpened) },
    { name: "Среден прогрес", value: `${overview.metrics.averagePercent} %` },
  ];

  return (
    <>
      <PageIntro
        id="admin-activity"
        title="Активност – кой учи и докъде стига"
        icon={<Activity aria-hidden="true" className="size-6" />}
        dismissed={dismissed.has("admin-activity")}
        onDismiss={dismissIntro}
      >
        Тук виждаш колко време учат потребителите, кога са били активни за
        последно и на коя секция спират да четат. Данните са само за хората,
        които са потвърдили известието за проследяване.
      </PageIntro>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center self-start text-[15px] font-bold text-link hover:text-link-hover"
          >
            ← Админ
          </Link>
          <h1 className="font-display text-[clamp(24px,5vw,36px)] leading-[1.15] font-bold">
            Активност
          </h1>
        </div>
        {/* prefetch={false}: връзката сваля файл, не страница */}
        <Link
          href="/admin/activity/export"
          prefetch={false}
          className={buttonClass({ variant: "outline" })}
        >
          Изтегли CSV
        </Link>
      </div>

      <dl className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {metrics.map((metric) => (
          <div
            key={metric.name}
            className="flex flex-col gap-1 rounded-2xl bg-surface-2 p-5"
          >
            <dt className="text-sm text-dim">{metric.name}</dt>
            <dd className="font-mono text-2xl">{metric.value}</dd>
          </div>
        ))}
      </dl>

      <Panel title="Време за учене по дни (последните 14 дни)">
        <ol className="flex h-44 items-end gap-1.5" aria-label="Графика по дни">
          {overview.days.map((day) => (
            <li
              key={day.day}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              title={`${formatDate(`${day.day}T12:00:00Z`)}: ${formatDuration(day.seconds)}, ${day.users} активни`}
            >
              <span className="sr-only">
                {formatDate(`${day.day}T12:00:00Z`)}:{" "}
                {formatDuration(day.seconds)}, {day.users} активни
              </span>
              <span
                aria-hidden="true"
                className="w-full rounded-t-md bg-primary"
                style={{
                  height: `${Math.max((day.seconds / peak) * 100, day.seconds > 0 ? 4 : 1)}%`,
                }}
              />
              <span
                aria-hidden="true"
                className="font-mono text-[11px] text-dim"
              >
                {day.day.slice(8)}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-dim">
          Височината е общото време за деня. Числото под стълба е датата.
        </p>
      </Panel>

      <Panel title={`Потребители (${overview.users.length})`}>
        <div
          tabIndex={0}
          role="region"
          aria-label="Таблица с потребители"
          className="overflow-x-auto"
        >
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr>
                {[
                  "Потребител",
                  "Статус",
                  "Последна активност",
                  "Време",
                  "Глави",
                  "Прогрес",
                  "",
                ].map((head, index) => (
                  <th
                    key={index}
                    scope="col"
                    className="border-b border-line px-3 py-2.5 text-left text-sm font-bold whitespace-nowrap text-dim"
                  >
                    {head || <span className="sr-only">Действия</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overview.users.map((user) => (
                <tr key={user.id}>
                  <td className="border-b border-line px-3 py-3">
                    <span className="block font-bold break-all">
                      {user.email || "—"}
                    </span>
                    <span className="block text-sm text-dim">
                      {user.fullName || "без име"}
                      {user.specialty ? ` · ${user.specialty}` : ""}
                      {user.role === "admin" ? " · admin" : ""}
                    </span>
                  </td>
                  <td className="border-b border-line px-3 py-3">
                    <Badge
                      variant={
                        user.status === "active"
                          ? "success"
                          : user.status === "none"
                            ? "tag"
                            : "soon"
                      }
                    >
                      {statusLabel[user.status]}
                    </Badge>
                  </td>
                  <td className="border-b border-line px-3 py-3 whitespace-nowrap">
                    {user.lastActivityAt
                      ? formatDate(user.lastActivityAt)
                      : "—"}
                  </td>
                  <td className="border-b border-line px-3 py-3 font-mono whitespace-nowrap">
                    {user.seconds > 0 ? formatDuration(user.seconds) : "—"}
                  </td>
                  <td className="border-b border-line px-3 py-3 font-mono">
                    {user.chaptersOpened}
                  </td>
                  <td className="border-b border-line px-3 py-3 font-mono whitespace-nowrap">
                    {user.chaptersOpened > 0 ? `${user.percent} %` : "—"}
                  </td>
                  <td className="border-b border-line px-3 py-3">
                    <Link
                      href={`/admin/activity/${user.id}`}
                      aria-label={`Времева линия на ${user.email || user.fullName}`}
                      className="inline-flex min-h-11 items-center font-bold whitespace-nowrap text-link hover:text-link-hover"
                    >
                      Детайли →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Докъде стигат в четенето">
        {overview.reach.length > 0 ? (
          <div className="flex flex-col gap-6">
            {overview.reach.map((chapter) => (
              <div key={chapter.chapterId} className="flex flex-col gap-2.5">
                <h3 className="font-bold">
                  {chapter.number}. {chapter.title}{" "}
                  <span className="font-normal text-dim">
                    · отворили: {chapter.opened}
                  </span>
                </h3>
                <ol className="flex flex-col gap-1.5">
                  {chapter.sections.map((section) => (
                    <li
                      key={section.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="w-36 flex-none text-muted-foreground">
                        {section.title}
                      </span>
                      <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span
                          className="block h-full rounded-full bg-success"
                          style={{
                            width: `${(section.users / chapter.opened) * 100}%`,
                          }}
                        />
                      </span>
                      <span className="w-12 flex-none text-right font-mono text-dim">
                        {section.users}/{chapter.opened}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">Още няма данни за четене.</p>
        )}
      </Panel>
    </>
  );
}
