import "server-only";
import { createClient } from "@/lib/supabase/server";

const slugPattern = /^[a-z0-9-]{1,80}$/;

export type ChapterSource = { title: string; url?: string };

export function parseSources(value: unknown): ChapterSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { title, url } = item as { title?: unknown; url?: unknown };
    if (typeof title !== "string") return [];
    return [
      {
        title,
        url:
          typeof url === "string" && /^https:\/\//.test(url) ? url : undefined,
      },
    ];
  });
}

/** Главата по адрес. RLS връща ред само ако потребителят има достъп. */
export async function loadChapter(moduleSlug: string, chapterSlug: string) {
  if (!slugPattern.test(moduleSlug) || !slugPattern.test(chapterSlug))
    return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("chapters")
    .select("id, number, title, summary, sources, modules!inner(slug, title)")
    .eq("slug", chapterSlug)
    .eq("modules.slug", moduleSlug)
    .maybeSingle();
  return data;
}

/** Режимът от адреса (?mode=…), иначе запомненият от потребителя, иначе „Леко“. */
export function pickReaderMode(
  requested: unknown,
  saved: string | null | undefined,
): "easy" | "detailed" {
  if (requested === "easy" || requested === "detailed") return requested;
  return saved === "detailed" ? "detailed" : "easy";
}
