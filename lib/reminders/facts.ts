import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContinueEmailProps,
  ReviewDueEmailProps,
  WeeklyEmailProps,
} from "@/emails/ReminderEmails";
import { CHAPTER_SECTIONS } from "@/lib/content/sections";
import { TASK_LIST } from "@/lib/personal-tasks";
import { daysBetween, questionsLabel } from "@/lib/review-format";
import { absoluteUrl } from "@/lib/site-url";
import type { Database } from "@/lib/supabase/database.types";
import type { ReminderFacts } from "./decide";
import {
  DAY_MS,
  WEEKDAY_LABELS,
  addDays,
  firstName,
  isPlainTeaser,
  previousWeek,
  sofiaLocalToDate,
  sofiaMoment,
  streakDays,
  weekStart,
} from "./helpers";

/**
 * Събира от базата всичко, по което се решава кой какво напомняне получава,
 * и данните за самите писма. Чете със secret key (заобикаля RLS) – вика се
 * само от нощната задача и от пробата в админ панела след requireAdmin().
 *
 * Имейл адресите идват от auth.users и остават само в паметта: не се записват
 * в лог и не се връщат към браузъра немаскирани.
 */

type Db = SupabaseClient<Database>;
type Common = "firstName" | "unsubscribeUrl" | "settingsUrl";

export type ReminderCandidate = {
  userId: string;
  email: string;
  fullName: string;
  firstName: string;
  unsubscribeToken: string;
  facts: ReminderFacts;
  review: Omit<ReviewDueEmailProps, Common>;
  /** недовършената глава; null, ако няма */
  resume: Omit<ContinueEmailProps, Common> | null;
  weekly: Omit<WeeklyEmailProps, Common>;
};

/** PostgREST връща най-много 1000 реда на заявка (supabase/config.toml). */
const PAGE_SIZE = 1000;
/** толкова дни назад се чете активността по дни (серия, седмица, последно влизане) */
const ACTIVITY_WINDOW_DAYS = 70;
const REMINDER_KINDS = ["review_due", "continue", "weekly", "new_chapter"];

const SECTION_TITLES = new Map<string, string>(
  CHAPTER_SECTIONS.map((section) => [section.id, section.title]),
);
const SECTIONS_TOTAL = CHAPTER_SECTIONS.length;

/**
 * Чете всички редове на страници. При грешка ХВЪРЛЯ: с непълни данни (напр.
 * без лога на писмата) правилата биха пратили писмо, което не трябва.
 */
async function readAll<T>(
  what: string,
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await page(
      rows.length,
      rows.length + PAGE_SIZE - 1,
    );
    if (error || !data) throw new Error(`reminders: read failed (${what})`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function readAuthUsers(admin: Db) {
  const users: { id: string; email: string; confirmed: boolean }[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (error) throw new Error("reminders: read failed (auth users)");
    for (const user of data.users) {
      users.push({
        id: user.id,
        email: user.email ?? "",
        confirmed: Boolean(user.email_confirmed_at),
      });
    }
    if (data.users.length < PAGE_SIZE) return users;
  }
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const group = groups.get(id);
    if (group) group.push(row);
    else groups.set(id, [row]);
  }
  return groups;
}

const latest = (values: (string | null | undefined)[]): string | null => {
  let best: string | null = null;
  for (const value of values) {
    if (value && (!best || Date.parse(value) > Date.parse(best))) best = value;
  }
  return best;
};

export async function gatherReminderCandidates(
  admin: Db,
  now: Date,
): Promise<ReminderCandidate[]> {
  const nowMs = now.getTime();
  const today = sofiaMoment(now).day;
  const thisWeekStart = weekStart(now);
  const lastWeek = previousWeek(now);
  // границите на предишната седмица като моменти (за суровите събития)
  const lastWeekFrom = sofiaLocalToDate(`${lastWeek.days[0]}T00:00`);
  const lastWeekTo = sofiaLocalToDate(`${thisWeekStart}T00:00`);
  if (!lastWeekFrom || !lastWeekTo) throw new Error("reminders: week range");
  const inLastWeek = (moment: string | null) => {
    if (!moment) return false;
    const ms = Date.parse(moment);
    return ms >= lastWeekFrom.getTime() && ms < lastWeekTo.getTime();
  };

  const [
    profiles,
    settings,
    authUsers,
    enrollments,
    modules,
    chapters,
    progress,
    daily,
    reviews,
    questions,
    tasks,
    sectionViews,
    emailLog,
  ] = await Promise.all([
    readAll("profiles", (from, to) =>
      admin
        .from("profiles")
        .select("id, full_name, role, created_at")
        .order("id")
        .range(from, to),
    ),
    readAll("user_settings", (from, to) =>
      admin
        .from("user_settings")
        .select("user_id, reminders_enabled, unsubscribe_token")
        .order("user_id")
        .range(from, to),
    ),
    readAuthUsers(admin),
    readAll("enrollments", (from, to) =>
      admin
        .from("enrollments")
        .select(
          "user_id, starts_at, expires_at, revoked_at, access_plans(all_courses, plan_courses(module_id))",
        )
        .order("id")
        .range(from, to),
    ),
    readAll("modules", (from, to) =>
      admin
        .from("modules")
        .select("id, slug, title, sort_order, is_published")
        .order("id")
        .range(from, to),
    ),
    readAll("chapters", (from, to) =>
      admin
        .from("chapters")
        .select("id, module_id, slug, number, title, is_published")
        .order("id")
        .range(from, to),
    ),
    readAll("progress", (from, to) =>
      admin
        .from("progress")
        .select(
          "user_id, chapter_id, sections_seen, last_section, last_mode, last_activity_at",
        )
        .order("user_id")
        .order("chapter_id")
        .range(from, to),
    ),
    readAll("daily_activity", (from, to) =>
      admin
        .from("daily_activity")
        .select("user_id, day, seconds")
        .gte("day", addDays(today, -ACTIVITY_WINDOW_DAYS))
        .order("user_id")
        .order("day")
        .range(from, to),
    ),
    readAll("quiz_reviews", (from, to) =>
      admin
        .from("quiz_reviews")
        .select("user_id, question_id, due_on, last_answered_at")
        .order("user_id")
        .order("question_id")
        .range(from, to),
    ),
    readAll("quiz_questions", (from, to) =>
      admin
        .from("quiz_questions")
        .select("id, chapter_id, mode, position, question")
        .order("id")
        .range(from, to),
    ),
    readAll("personal_tasks", (from, to) =>
      admin
        .from("personal_tasks")
        .select("user_id, template, solved_at, last_checked_at")
        .order("user_id")
        .order("template")
        .range(from, to),
    ),
    readAll("events", (from, to) =>
      admin
        .from("events")
        .select("user_id, chapter_id, section")
        .eq("type", "section_view")
        .gte("created_at", lastWeekFrom.toISOString())
        .lt("created_at", lastWeekTo.toISOString())
        .order("id")
        .range(from, to),
    ),
    readAll("email_log", (from, to) =>
      admin
        .from("email_log")
        .select("user_id, kind, sent_at")
        .eq("status", "sent")
        .in("kind", REMINDER_KINDS)
        .order("id")
        .range(from, to),
    ),
  ]);

  const settingsByUser = new Map(settings.map((row) => [row.user_id, row]));
  const authById = new Map(authUsers.map((user) => [user.id, user]));
  const moduleById = new Map(modules.map((row) => [row.id, row]));
  const chapterById = new Map(chapters.map((row) => [row.id, row]));
  const questionById = new Map(questions.map((row) => [row.id, row]));
  const questionsByChapter = groupBy(questions, (row) => row.chapter_id);
  const enrollmentsByUser = groupBy(enrollments, (row) => row.user_id);
  const progressByUser = groupBy(progress, (row) => row.user_id);
  const dailyByUser = groupBy(daily, (row) => row.user_id);
  const reviewsByUser = groupBy(reviews, (row) => row.user_id);
  const tasksByUser = groupBy(tasks, (row) => row.user_id);
  const viewsByUser = groupBy(sectionViews, (row) => row.user_id);
  const logByUser = groupBy(emailLog, (row) => row.user_id);
  const taskSlugs = new Set(TASK_LIST.map((task) => task.slug));
  const orderedChapters = [...chapters].sort((a, b) => {
    const moduleA = moduleById.get(a.module_id)?.sort_order ?? 0;
    const moduleB = moduleById.get(b.module_id)?.sort_order ?? 0;
    return moduleA - moduleB || a.number - b.number;
  });

  const candidates: ReminderCandidate[] = [];
  for (const profile of profiles) {
    const auth = authById.get(profile.id);
    const mySettings = settingsByUser.get(profile.id);
    if (!auth?.email || !mySettings) continue;

    // --- достъп: кои модули може да чете точно сега ---
    const isAdmin = profile.role === "admin";
    let allModules = isAdmin;
    let hasActiveAccess = isAdmin;
    const myModules = new Set<string>();
    for (const enrollment of enrollmentsByUser.get(profile.id) ?? []) {
      const active =
        !enrollment.revoked_at &&
        Date.parse(enrollment.starts_at) <= nowMs &&
        nowMs < Date.parse(enrollment.expires_at);
      if (!active || !enrollment.access_plans) continue;
      hasActiveAccess = true;
      if (enrollment.access_plans.all_courses) allModules = true;
      for (const course of enrollment.access_plans.plan_courses) {
        myModules.add(course.module_id);
      }
    }
    const canRead = (chapterId: string) => {
      const chapter = chapterById.get(chapterId);
      const chapterModule = chapter && moduleById.get(chapter.module_id);
      if (!chapter || !chapterModule) return false;
      if (isAdmin) return true;
      return (
        chapter.is_published &&
        chapterModule.is_published &&
        (allModules || myModules.has(chapterModule.id))
      );
    };
    const chapterUrl = (chapterId: string, suffix = "") => {
      const chapter = chapterById.get(chapterId)!;
      const chapterModule = moduleById.get(chapter.module_id)!;
      return absoluteUrl(
        `/learn/${chapterModule.slug}/${chapter.slug}${suffix}`,
      );
    };

    // --- повторение ---
    const myReviews = (reviewsByUser.get(profile.id) ?? []).filter((row) => {
      const question = questionById.get(row.question_id);
      return question ? canRead(question.chapter_id) : false;
    });
    const due = myReviews.filter(
      (row) => row.due_on !== null && row.due_on <= today,
    );
    const oldestDue = due.map((row) => row.due_on!).sort()[0];
    const dueByChapter = groupBy(
      due,
      (row) => questionById.get(row.question_id)!.chapter_id,
    );

    // --- активност ---
    const myDaily = dailyByUser.get(profile.id) ?? [];
    const activeDays = myDaily.map((row) => row.day);
    const myProgress = [...(progressByUser.get(profile.id) ?? [])].sort(
      (a, b) => Date.parse(b.last_activity_at) - Date.parse(a.last_activity_at),
    );
    const myTasks = tasksByUser.get(profile.id) ?? [];
    const lastActiveDay = [...activeDays].sort().at(-1);
    const lastActivityAt = latest([
      myProgress[0]?.last_activity_at,
      ...(reviewsByUser.get(profile.id) ?? []).map(
        (row) => row.last_answered_at,
      ),
      ...myTasks.map((row) => row.last_checked_at),
      // от активността по дни знаем само деня: броим го до края му (така
      // „няма го от 5 дни“ никога не тръгва по-рано, отколкото трябва)
      lastActiveDay
        ? new Date(
            Math.min(nowMs, Date.parse(`${lastActiveDay}T21:00:00Z`)),
          ).toISOString()
        : null,
    ]);
    const activeToday =
      activeDays.includes(today) ||
      (lastActivityAt !== null &&
        sofiaMoment(new Date(lastActivityAt)).day === today);

    // --- недовършена глава ---
    const seenCount = (sections: string[]) =>
      sections.filter((id) => SECTION_TITLES.has(id)).length;
    const unfinished = myProgress.find(
      (row) =>
        canRead(row.chapter_id) &&
        seenCount(row.sections_seen) < SECTIONS_TOTAL,
    );
    let resume: ReminderCandidate["resume"] = null;
    if (unfinished) {
      const chapter = chapterById.get(unfinished.chapter_id)!;
      const mode = unfinished.last_mode === "detailed" ? "detailed" : "easy";
      const answered = new Set(myReviews.map((row) => row.question_id));
      const teasers = (questionsByChapter.get(chapter.id) ?? [])
        .filter((row) => row.mode === mode && isPlainTeaser(row.question))
        .sort((a, b) => a.position - b.position);
      const teaser =
        teasers.find((row) => !answered.has(row.id)) ?? teasers[0] ?? null;
      const section = unfinished.last_section;
      const hash = section && SECTION_TITLES.has(section) ? `#${section}` : "";
      resume = {
        daysAway: lastActivityAt
          ? Math.max(
              0,
              Math.floor((nowMs - Date.parse(lastActivityAt)) / DAY_MS),
            )
          : 0,
        chapterNumber: chapter.number,
        chapterTitle: chapter.title,
        sectionTitle: section ? (SECTION_TITLES.get(section) ?? null) : null,
        sectionsSeen: seenCount(unfinished.sections_seen),
        sectionsTotal: SECTIONS_TOTAL,
        teaser: teaser ? teaser.question.trim() : null,
        continueUrl: chapterUrl(chapter.id, `?mode=${mode}${hash}`),
      };
    }

    // --- изпратени писма ---
    const myLog = logByUser.get(profile.id) ?? [];
    const lastEmailAt = latest(myLog.map((row) => row.sent_at));
    const continueEmailsSinceLastActivity = myLog.filter(
      (row) =>
        row.kind === "continue" &&
        (!lastActivityAt ||
          Date.parse(row.sent_at) > Date.parse(lastActivityAt)),
    ).length;
    const weeklyAlreadySentThisWeek = myLog.some(
      (row) =>
        row.kind === "weekly" &&
        sofiaMoment(new Date(row.sent_at)).day >= thisWeekStart,
    );

    // --- предишната седмица ---
    const secondsByDay = new Map(myDaily.map((row) => [row.day, row.seconds]));
    const days = lastWeek.days.map((day, index) => ({
      label: WEEKDAY_LABELS[index]!,
      minutes: Math.round((secondsByDay.get(day) ?? 0) / 60),
    }));
    // различни секции, отворени през седмицата (от суровите събития)
    const sectionsRead = new Set(
      (viewsByUser.get(profile.id) ?? []).map(
        (row) => `${row.chapter_id}/${row.section}`,
      ),
    ).size;
    // За всеки въпрос базата пази само последния отговор, затова броим
    // въпросите, чийто последен отговор е в тази седмица – никога повече от
    // истинския брой.
    const questionsAnswered = (reviewsByUser.get(profile.id) ?? []).filter(
      (row) => inLastWeek(row.last_answered_at),
    ).length;
    const tasksSolved = myTasks.filter(
      (row) => taskSlugs.has(row.template) && inLastWeek(row.solved_at),
    ).length;

    let next: WeeklyEmailProps["next"];
    const opened = new Set(myProgress.map((row) => row.chapter_id));
    const unread = orderedChapters.find(
      (chapter) =>
        chapter.is_published && canRead(chapter.id) && !opened.has(chapter.id),
    );
    if (due.length > 0) {
      next = {
        label: `Повторение: ${questionsLabel(due.length)}`,
        url: absoluteUrl("/review"),
        note: "Отнема няколко минути и пази наученото.",
      };
    } else if (resume) {
      next = {
        label: `Глава ${resume.chapterNumber}: ${resume.chapterTitle}`,
        url: resume.continueUrl,
        note: `Стигна до ${resume.sectionsSeen} от ${resume.sectionsTotal} секции – довърши я.`,
      };
    } else if (unread) {
      next = {
        label: `Глава ${unread.number}: ${unread.title}`,
        url: chapterUrl(unread.id),
        note: `Следващата глава от „${moduleById.get(unread.module_id)!.title}“.`,
      };
    } else {
      next = {
        label: "Таблото ти",
        url: absoluteUrl("/dashboard"),
        note: "Виж докъде си стигнал и избери какво да преговориш.",
      };
    }

    candidates.push({
      userId: profile.id,
      email: auth.email,
      fullName: profile.full_name,
      firstName: firstName(profile.full_name),
      unsubscribeToken: mySettings.unsubscribe_token,
      facts: {
        remindersEnabled: mySettings.reminders_enabled,
        hasActiveAccess,
        emailConfirmed: auth.confirmed,
        lastEmailAt,
        lastActivityAt,
        createdAt: profile.created_at,
        dueCount: due.length,
        oldestDueDays: oldestDue ? daysBetween(oldestDue, today) : 0,
        activeToday,
        resume: resume
          ? {
              sectionsSeen: resume.sectionsSeen,
              sectionsTotal: resume.sectionsTotal,
            }
          : null,
        continueEmailsSinceLastActivity,
        weeklyAlreadySentThisWeek,
      },
      review: {
        dueCount: due.length,
        masteredCount: myReviews.filter((row) => row.due_on === null).length,
        streakDays: streakDays(activeDays, today),
        chapters: [...dueByChapter.entries()]
          .map(([chapterId, rows]) => {
            const chapter = chapterById.get(chapterId)!;
            return {
              number: chapter.number,
              title: chapter.title,
              count: rows.length,
            };
          })
          .sort((a, b) => a.number - b.number),
        reviewUrl: absoluteUrl("/review"),
      },
      resume,
      weekly: {
        weekLabel: lastWeek.label,
        days,
        minutesTotal: days.reduce((sum, day) => sum + day.minutes, 0),
        sectionsRead,
        questionsAnswered,
        tasksSolved,
        tasksTotal: TASK_LIST.length,
        next,
      },
    });
  }
  return candidates;
}
