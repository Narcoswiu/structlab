import "server-only";
import { CHAPTER_SECTIONS } from "@/lib/content/sections";
import { toChapterProgress } from "@/lib/progress";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DAY_MS = 24 * 60 * 60 * 1000;
const sofiaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia" });

/** Дата по българско време като „2026-10-10“ – както я смята базата. */
export function dayKey(date: Date): string {
  return sofiaDay.format(date);
}

export type UserActivity = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "student";
  specialty: string;
  status: "active" | "expired" | "revoked" | "none";
  lastActivityAt: string | null;
  seconds: number;
  chaptersOpened: number;
  /** среден дял видени секции в отворените глави, 0–100 */
  percent: number;
};

export type ActivityOverview = {
  metrics: {
    activeUsers7d: number;
    seconds7d: number;
    chaptersOpened: number;
    averagePercent: number;
  };
  /** последните 14 дни, от най-стария към днес */
  days: { day: string; seconds: number; users: number }[];
  users: UserActivity[];
  /** за всяка глава: колко потребители са видели всяка от седемте секции */
  reach: {
    chapterId: string;
    title: string;
    number: number;
    opened: number;
    sections: { id: string; title: string; users: number }[];
  }[];
};

/**
 * Обобщение на активността за админ таблото. Вика се само след requireAdmin():
 * данните идват през клиента на администратора (RLS му позволява всичко),
 * а имейлите – от auth.users със secret key.
 */
export async function getActivityOverview(
  now: Date = new Date(),
): Promise<ActivityOverview> {
  const supabase = await createClient();
  const since = dayKey(new Date(now.getTime() - 13 * DAY_MS));

  const [daily, progress, profiles, enrollments, chapters, authUsers] =
    await Promise.all([
      supabase
        .from("daily_activity")
        .select("user_id, day, seconds")
        .gte("day", since),
      supabase
        .from("progress")
        .select(
          "user_id, chapter_id, sections_seen, seconds, last_activity_at",
        ),
      supabase
        .from("profiles")
        .select(
          "id, full_name, role, created_at, specialties(short_name, universities(short_name))",
        )
        .order("created_at"),
      supabase
        .from("enrollments")
        .select("user_id, expires_at, revoked_at")
        .order("expires_at", { ascending: false }),
      supabase.from("chapters").select("id, title, number").order("number"),
      createAdminClient().auth.admin.listUsers({ perPage: 1000 }),
    ]);

  const days = Array.from({ length: 14 }, (_, index) => {
    const day = dayKey(new Date(now.getTime() - (13 - index) * DAY_MS));
    const rows = (daily.data ?? []).filter((row) => row.day === day);
    return {
      day,
      seconds: rows.reduce((sum, row) => sum + row.seconds, 0),
      users: new Set(rows.map((row) => row.user_id)).size,
    };
  });
  const weekStart = dayKey(new Date(now.getTime() - 6 * DAY_MS));
  const week = (daily.data ?? []).filter((row) => row.day >= weekStart);

  const progressRows = progress.data ?? [];
  const percents = progressRows.map(
    (row) => toChapterProgress(row.sections_seen).percent,
  );
  const emailById = new Map(
    (authUsers.data?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );
  const enrollmentByUser = new Map<
    string,
    { expires_at: string; revoked_at: string | null }
  >();
  for (const enrollment of enrollments.data ?? []) {
    if (!enrollmentByUser.has(enrollment.user_id)) {
      enrollmentByUser.set(enrollment.user_id, enrollment);
    }
  }

  const users: UserActivity[] = (profiles.data ?? []).map((profile) => {
    const mine = progressRows.filter((row) => row.user_id === profile.id);
    const enrollment = enrollmentByUser.get(profile.id);
    const last =
      mine
        .map((row) => row.last_activity_at)
        .sort()
        .at(-1) ?? null;
    const minePercents = mine.map(
      (row) => toChapterProgress(row.sections_seen).percent,
    );
    return {
      id: profile.id,
      email: emailById.get(profile.id) ?? "",
      fullName: profile.full_name,
      role: profile.role,
      specialty: profile.specialties
        ? `${profile.specialties.universities?.short_name ?? ""} ${profile.specialties.short_name}`.trim()
        : "",
      status: !enrollment
        ? "none"
        : enrollment.revoked_at
          ? "revoked"
          : new Date(enrollment.expires_at) > now
            ? "active"
            : "expired",
      lastActivityAt: last,
      seconds: mine.reduce((sum, row) => sum + row.seconds, 0),
      chaptersOpened: mine.length,
      percent: minePercents.length
        ? Math.round(
            minePercents.reduce((a, b) => a + b, 0) / minePercents.length,
          )
        : 0,
    };
  });

  const reach = (chapters.data ?? [])
    .map((chapter) => {
      const rows = progressRows.filter((row) => row.chapter_id === chapter.id);
      return {
        chapterId: chapter.id,
        title: chapter.title,
        number: chapter.number,
        opened: rows.length,
        sections: CHAPTER_SECTIONS.map((section) => ({
          id: section.id,
          title: section.title,
          users: rows.filter((row) => row.sections_seen.includes(section.id))
            .length,
        })),
      };
    })
    .filter((chapter) => chapter.opened > 0);

  return {
    metrics: {
      activeUsers7d: new Set(week.map((row) => row.user_id)).size,
      seconds7d: week.reduce((sum, row) => sum + row.seconds, 0),
      chaptersOpened: progressRows.length,
      averagePercent: percents.length
        ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
        : 0,
    },
    days,
    users,
    reach,
  };
}

const eventLabels = {
  login: "Вход",
  chapter_open: "Отвори глава",
  section_view: "Видя секция",
  heartbeat: "Чете",
  mode_toggle: "Смени режима",
  pdf_download: "Изтегли PDF",
  lab_open: "Отвори лаборатория",
} as const;

const sectionTitles = new Map<string, string>(
  CHAPTER_SECTIONS.map((s) => [s.id, s.title]),
);
const labTitles: Record<string, string> = { beam: "Греди", section: "Сечения" };

export type TimelineEntry = { at: string; label: string; detail: string };

/** Времевата линия на един потребител: последните събития, без „пулсовете“. */
export async function getUserTimeline(userId: string): Promise<{
  user: { email: string; fullName: string } | null;
  entries: TimelineEntry[];
}> {
  const supabase = await createClient();
  const [profile, events, auth] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("events")
      .select("type, section, mode, lab, created_at, chapters(title)")
      .eq("user_id", userId)
      .neq("type", "heartbeat")
      .order("created_at", { ascending: false })
      .limit(150),
    createAdminClient().auth.admin.getUserById(userId),
  ]);
  if (!profile.data) return { user: null, entries: [] };

  return {
    user: {
      email: auth.data.user?.email ?? "",
      fullName: profile.data.full_name,
    },
    entries: (events.data ?? []).map((event) => {
      const parts = [
        event.chapters?.title,
        event.section
          ? `„${sectionTitles.get(event.section) ?? event.section}“`
          : null,
        event.mode ? (event.mode === "easy" ? "Леко" : "Подробно") : null,
        event.lab ? (labTitles[event.lab] ?? event.lab) : null,
      ].filter(Boolean);
      return {
        at: event.created_at,
        label: eventLabels[event.type],
        detail: parts.join(" · "),
      };
    }),
  };
}

/** Една клетка от CSV: в кавички, с удвоени кавички вътре. */
export function csvCell(value: string | number): string {
  const text = String(value);
  // стойност, започваща с =, +, - или @, би се изпълнила като формула в Excel
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function usersToCsv(users: UserActivity[]): string {
  const statusNames = {
    active: "активен",
    expired: "изтекъл",
    revoked: "спрян",
    none: "без план",
  };
  const head = [
    "Имейл",
    "Име",
    "Специалност",
    "Роля",
    "Статус",
    "Последна активност",
    "Минути",
    "Отворени глави",
    "Среден прогрес %",
  ];
  const rows = users.map((user) => [
    user.email,
    user.fullName,
    user.specialty,
    user.role,
    statusNames[user.status],
    user.lastActivityAt ?? "",
    Math.round(user.seconds / 60),
    user.chaptersOpened,
    user.percent,
  ]);
  // BOM в началото, за да отвори Excel кирилицата правилно
  return (
    "﻿" +
    [head, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
