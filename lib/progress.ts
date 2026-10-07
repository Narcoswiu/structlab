import "server-only";
import { CHAPTER_SECTIONS } from "@/lib/content/sections";
import { createClient } from "@/lib/supabase/server";

const TOTAL_SECTIONS = CHAPTER_SECTIONS.length;
const sectionTitle = new Map<string, string>(
  CHAPTER_SECTIONS.map((section) => [section.id, section.title]),
);

export type ChapterProgress = {
  /** брой видени секции от седемте */
  seen: number;
  total: number;
  percent: number;
};

export function toChapterProgress(sectionsSeen: string[]): ChapterProgress {
  const seen = sectionsSeen.filter((id) => sectionTitle.has(id)).length;
  return {
    seen,
    total: TOTAL_SECTIONS,
    percent: Math.round((seen / TOTAL_SECTIONS) * 100),
  };
}

/** 95 → „1 мин“, 3700 → „1 ч 1 мин“. */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "под 1 мин";
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
}

export type MyProgress = {
  /** прогрес по id на глава */
  byChapter: Map<string, ChapterProgress>;
  /** последната четена глава – за „Продължи откъдето спря“ */
  resume: {
    href: string;
    chapterTitle: string;
    moduleTitle: string;
    sectionTitle: string | null;
    progress: ChapterProgress;
  } | null;
};

/** Прогресът на влезлия потребител (RLS връща само неговите редове). */
export async function getMyProgress(userId: string): Promise<MyProgress> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("progress")
    .select(
      "chapter_id, sections_seen, last_section, last_mode, last_activity_at, chapters!inner(slug, title, modules!inner(slug, title))",
    )
    .eq("user_id", userId)
    .order("last_activity_at", { ascending: false });

  const rows = data ?? [];
  const byChapter = new Map(
    rows.map((row) => [row.chapter_id, toChapterProgress(row.sections_seen)]),
  );
  const last = rows[0];
  if (!last) return { byChapter, resume: null };

  const mode = last.last_mode === "detailed" ? "detailed" : "easy";
  const hash =
    last.last_section && sectionTitle.has(last.last_section)
      ? `#${last.last_section}`
      : "";
  return {
    byChapter,
    resume: {
      href: `/learn/${last.chapters.modules.slug}/${last.chapters.slug}?mode=${mode}${hash}`,
      chapterTitle: last.chapters.title,
      moduleTitle: last.chapters.modules.title,
      sectionTitle: last.last_section
        ? (sectionTitle.get(last.last_section) ?? null)
        : null,
      progress: toChapterProgress(last.sections_seen),
    },
  };
}
