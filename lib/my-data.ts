import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

/**
 * „Изтегли моите данни“: всичко, което платформата пази за един потребител,
 * събрано в един обект за JSON файл.
 *
 * Чете се с клиента на самия потребител, така че RLS е първата защита. Тя обаче
 * пуска администратор да вижда редовете на всички, затова всяка заявка е
 * ограничена изрично до този потребител, а `shapeMyData` още веднъж изхвърля
 * чужди редове.
 */
type Db = SupabaseClient<Database>;
type Enums = Database["public"]["Enums"];

/** Най-много толкова от последните събития влизат във файла. */
export const EVENTS_LIMIT = 5000;
/** PostgREST връща най-много 1000 реда на заявка (supabase/config.toml). */
const PAGE_SIZE = 1000;

export type MyDataUser = {
  id: string;
  email: string;
  fullName: string;
  role: Enums["user_role"];
};

type ChapterRef = { title: string } | null;

export type MyDataRows = {
  profile: {
    id: string;
    full_name: string;
    role: Enums["user_role"];
    created_at: string;
    specialties: { name: string } | null;
  } | null;
  settings: {
    user_id: string;
    theme: string;
    font_size: number;
    reader_mode: string;
    intro_dismissed: Json;
    reminders_enabled: boolean;
    marketing_consent: boolean;
    terms_accepted_at: string | null;
    tracking_notice_accepted_at: string | null;
    updated_at: string;
  } | null;
  enrollments: {
    user_id: string;
    source: Enums["enrollment_source"];
    starts_at: string;
    expires_at: string;
    revoked_at: string | null;
    created_at: string;
    access_plans: { name: string } | null;
  }[];
  progress: {
    user_id: string;
    sections_seen: string[];
    last_section: string | null;
    last_mode: Enums["content_mode"] | null;
    seconds: number;
    first_opened_at: string;
    last_activity_at: string;
    chapters: ChapterRef;
  }[];
  dailyActivity: {
    user_id: string;
    day: string;
    seconds: number;
    events: number;
  }[];
  events: {
    user_id: string;
    type: Enums["event_type"];
    created_at: string;
    section: string | null;
    mode: Enums["content_mode"] | null;
    lab: string | null;
    chapters: ChapterRef;
  }[];
  /** колко събития има общо в базата (може да са повече от включените) */
  eventsTotal: number;
  quizReviews: {
    user_id: string;
    box: number;
    attempts: number;
    correct: number;
    last_knew: boolean;
    due_on: string | null;
    first_answered_at: string;
    last_answered_at: string;
    quiz_questions: { question: string } | null;
  }[];
  taskVariant: {
    user_id: string;
    a: number;
    b: number;
    c: number;
    created_at: string;
  } | null;
  personalTasks: {
    user_id: string;
    template: string;
    answers: Json;
    results: Json;
    attempts: number;
    first_checked_at: string;
    last_checked_at: string;
    solved_at: string | null;
  }[];
  feedback: {
    user_id: string;
    message: string;
    page: string;
    created_at: string;
  }[];
};

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

function readError(what: string): Error {
  return new Error(`Данните не можаха да се прочетат (${what}).`);
}

/** Чете на страници, докато редовете свършат или се стигне ограничението. */
async function readAll<T>(
  what: string,
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  limit = Number.POSITIVE_INFINITY,
): Promise<T[]> {
  const rows: T[] = [];
  while (rows.length < limit) {
    const size = Math.min(PAGE_SIZE, limit - rows.length);
    const { data, error } = await page(rows.length, rows.length + size - 1);
    if (error || !data) throw readError(what);
    rows.push(...data);
    if (data.length < size) break;
  }
  return rows;
}

/** Суровите редове на потребителя от всички таблици, които сам може да чете. */
export async function fetchMyDataRows(
  supabase: Db,
  user: MyDataUser,
): Promise<MyDataRows> {
  const [
    profile,
    settings,
    enrollments,
    progress,
    dailyActivity,
    events,
    eventsTotal,
    quizReviews,
    taskVariant,
    personalTasks,
    feedback,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, created_at, specialties(name)")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_settings")
      .select(
        "user_id, theme, font_size, reader_mode, intro_dismissed, reminders_enabled, marketing_consent, terms_accepted_at, tracking_notice_accepted_at, updated_at",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    readAll("достъп", (from, to) =>
      supabase
        .from("enrollments")
        .select(
          "user_id, source, starts_at, expires_at, revoked_at, created_at, access_plans(name)",
        )
        .eq("user_id", user.id)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    readAll("напредък", (from, to) =>
      supabase
        .from("progress")
        .select(
          "user_id, sections_seen, last_section, last_mode, seconds, first_opened_at, last_activity_at, chapters(title)",
        )
        .eq("user_id", user.id)
        .order("first_opened_at")
        .order("chapter_id")
        .range(from, to),
    ),
    readAll("активност по дни", (from, to) =>
      supabase
        .from("daily_activity")
        .select("user_id, day, seconds, events")
        .eq("user_id", user.id)
        .order("day")
        .range(from, to),
    ),
    readAll(
      "събития",
      (from, to) =>
        supabase
          .from("events")
          .select(
            "user_id, type, created_at, section, mode, lab, chapters(title)",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      EVENTS_LIMIT,
    ),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    readAll("повторение", (from, to) =>
      supabase
        .from("quiz_reviews")
        .select(
          "user_id, box, attempts, correct, last_knew, due_on, first_answered_at, last_answered_at, quiz_questions(question)",
        )
        .eq("user_id", user.id)
        .order("first_answered_at")
        .order("question_id")
        .range(from, to),
    ),
    supabase
      .from("task_variants")
      .select("user_id, a, b, c, created_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    readAll("лични задания", (from, to) =>
      supabase
        .from("personal_tasks")
        .select(
          "user_id, template, answers, results, attempts, first_checked_at, last_checked_at, solved_at",
        )
        .eq("user_id", user.id)
        .order("template")
        .range(from, to),
    ),
    readAll("обратна връзка", (from, to) =>
      supabase
        .from("feedback")
        .select("user_id, message, page, created_at")
        .eq("user_id", user.id)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
  ]);

  if (profile.error) throw readError("профил");
  if (settings.error) throw readError("настройки");
  if (taskVariant.error) throw readError("вариант за задания");
  if (eventsTotal.error) throw readError("брой събития");

  return {
    profile: profile.data,
    settings: settings.data,
    enrollments,
    progress,
    dailyActivity,
    events,
    eventsTotal: eventsTotal.count ?? events.length,
    quizReviews,
    taskVariant: taskVariant.data,
    personalTasks,
    feedback,
  };
}

const NOT_AVAILABLE = "(вече не е достъпно)";

/**
 * Подрежда редовете в обекта, който се записва във файла. Чиста функция:
 * не чете нищо отвън и изхвърля всеки ред, който не е на този потребител.
 */
export function shapeMyData(rows: MyDataRows, user: MyDataUser, now: Date) {
  const mine = <T extends { user_id: string }>(list: T[]): T[] =>
    list.filter((row) => row.user_id === user.id);

  const profile = rows.profile?.id === user.id ? rows.profile : null;
  const settings = rows.settings?.user_id === user.id ? rows.settings : null;
  const variant =
    rows.taskVariant?.user_id === user.id ? rows.taskVariant : null;
  const events = mine(rows.events).slice(0, EVENTS_LIMIT);
  const eventsTotal = Math.max(rows.eventsTotal, events.length);

  return {
    обяснение:
      "Копие на данните, които StructLab пази за твоя акаунт. Файлът съдържа само твои данни. Всички часове са по UTC (ISO 8601), а времето за учене е в секунди.",
    изготвено_на: now.toISOString(),
    какво_липсва:
      "Паролата не е тук: пази се само като необратим хеш и никой не може да я прочете. Заявка за покана и съобщения от „Контакт“ не са вързани към акаунта и не са във файла – ако искаш копие и от тях, пиши ни. Техническите записи на хостинга също не са тук.",
    профил: {
      имейл: user.email,
      име: profile?.full_name ?? user.fullName,
      роля: profile?.role ?? user.role,
      специалност: profile?.specialties?.name ?? null,
      регистриран_на: profile?.created_at ?? null,
    },
    настройки: settings && {
      тема: settings.theme,
      размер_на_шрифта: settings.font_size,
      режим_на_четене: settings.reader_mode,
      скрити_обяснителни_карета: settings.intro_dismissed,
      напомняния: settings.reminders_enabled,
      съгласие_за_новини: settings.marketing_consent,
      приети_условия_на: settings.terms_accepted_at,
      прието_известие_за_проследяване_на: settings.tracking_notice_accepted_at,
      последна_промяна: settings.updated_at,
    },
    достъп: mine(rows.enrollments).map((row) => ({
      план: row.access_plans?.name ?? NOT_AVAILABLE,
      източник: row.source,
      начало: row.starts_at,
      край: row.expires_at,
      отнет_на: row.revoked_at,
      записан_на: row.created_at,
    })),
    напредък: mine(rows.progress).map((row) => ({
      глава: row.chapters?.title ?? NOT_AVAILABLE,
      видени_секции: row.sections_seen,
      последна_секция: row.last_section,
      последен_режим: row.last_mode,
      секунди: row.seconds,
      първо_отваряне: row.first_opened_at,
      последна_активност: row.last_activity_at,
    })),
    активност_по_дни: mine(rows.dailyActivity).map((row) => ({
      ден: row.day,
      секунди: row.seconds,
      събития: row.events,
    })),
    събития: {
      общо: eventsTotal,
      включени: events.length,
      бележка:
        eventsTotal > events.length
          ? `Включени са само последните ${EVENTS_LIMIT} събития от общо ${eventsTotal}. Ако искаш всички, пиши ни.`
          : `Включени са всички събития (файлът побира най-много последните ${EVENTS_LIMIT}). Събития, по-стари от 12 месеца, се изтриват автоматично.`,
      списък: events.map((row) => ({
        вид: row.type,
        кога: row.created_at,
        глава: row.chapters?.title ?? null,
        секция: row.section,
        режим: row.mode,
        лаборатория: row.lab,
      })),
    },
    повторение: mine(rows.quizReviews).map((row) => ({
      въпрос: row.quiz_questions?.question ?? NOT_AVAILABLE,
      кутия: row.box,
      опити: row.attempts,
      верни: row.correct,
      последно_знаех: row.last_knew,
      следващо_повторение: row.due_on,
      първи_отговор: row.first_answered_at,
      последен_отговор: row.last_answered_at,
    })),
    вариант_за_задания: variant && {
      a: variant.a,
      b: variant.b,
      c: variant.c,
      създаден_на: variant.created_at,
    },
    лични_задания: mine(rows.personalTasks).map((row) => ({
      задание: row.template,
      отговори: row.answers,
      резултати: row.results,
      опити: row.attempts,
      първа_проверка: row.first_checked_at,
      последна_проверка: row.last_checked_at,
      решено_на: row.solved_at,
    })),
    обратна_връзка: mine(rows.feedback).map((row) => ({
      съобщение: row.message,
      страница: row.page,
      изпратено_на: row.created_at,
    })),
  };
}

export type MyData = ReturnType<typeof shapeMyData>;

/** Всичко за файла: чете редовете на потребителя и ги подрежда. */
export async function getMyData(
  supabase: Db,
  user: MyDataUser,
  now: Date = new Date(),
): Promise<MyData> {
  return shapeMyData(await fetchMyDataRows(supabase, user), user, now);
}

/** structlab-moite-danni-2026-10-09.json */
export function myDataFileName(now: Date): string {
  return `structlab-moite-danni-${now.toISOString().slice(0, 10)}.json`;
}
