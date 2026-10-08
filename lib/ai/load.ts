import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ChapterRef } from "./modes";
import type { ChapterInfo, ChapterSource, ContentMode } from "./retrieval";

/**
 * Главите и текстовете им, които влезлият потребител може да чете. Заявката
 * е от негово име: RLS връща само главите с активен достъп, така че човек
 * без достъп получава празен списък.
 */
export async function loadReadableContent(): Promise<{
  chapters: ChapterInfo[];
  sources: ChapterSource[];
}> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chapters")
    .select(
      "slug, number, title, summary, modules!inner(slug), chapter_bodies(mode, body)",
    )
    .order("number");
  const chapters: ChapterInfo[] = [];
  const sources: ChapterSource[] = [];
  for (const row of data ?? []) {
    const info = {
      moduleSlug: row.modules.slug,
      chapterSlug: row.slug,
      number: row.number,
      title: row.title,
      summary: row.summary,
    };
    if (row.chapter_bodies.length === 0) continue;
    chapters.push(info);
    for (const body of row.chapter_bodies) {
      sources.push({ ...info, mode: body.mode, body: body.body });
    }
  }
  return { chapters, sources };
}

/** Списъкът с глави за панела („Питаш по: Глава …“) – без текстовете. */
export async function loadChapterRefs(): Promise<ChapterRef[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chapters")
    .select("slug, number, title, modules!inner(slug)")
    .order("number");
  return (data ?? []).map((row) => ({
    module: row.modules.slug,
    slug: row.slug,
    number: row.number,
    title: row.title,
  }));
}

/** Режимът на четене, запазен в настройките на потребителя. */
export async function loadSavedReaderMode(
  userId: string,
): Promise<ContentMode> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("reader_mode")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.reader_mode === "detailed" ? "detailed" : "easy";
}
