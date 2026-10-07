import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Главата, отбелязана като публично демо – само в режим „Леко“.
 * Четем я със secret key, защото посетителят не е влязъл; затова заявката е
 * тясно ограничена до is_demo = true и до един режим.
 */
export const getDemoChapter = cache(async () => {
  const admin = createAdminClient();
  const { data: chapter } = await admin
    .from("chapters")
    .select("id, number, title, summary, modules!inner(title)")
    .eq("is_demo", true)
    .eq("is_published", true)
    .order("number")
    .limit(1)
    .maybeSingle();
  if (!chapter) return null;

  const [body, figures] = await Promise.all([
    admin
      .from("chapter_bodies")
      .select("body")
      .eq("chapter_id", chapter.id)
      .eq("mode", "easy")
      .maybeSingle(),
    admin
      .from("chapter_figures")
      .select("name, svg")
      .eq("chapter_id", chapter.id),
  ]);
  if (!body.data) return null;

  return {
    number: chapter.number,
    title: chapter.title,
    summary: chapter.summary,
    moduleTitle: chapter.modules.title,
    body: body.data.body,
    figures: Object.fromEntries(
      (figures.data ?? []).map((figure) => [figure.name, figure.svg]),
    ),
  };
});

/** Специалностите от каталога – за формата „Поискай покана“ (публична). */
export const listPublicSpecialties = cache(async () => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("specialties")
    .select(
      "short_name, name, degree, sort_order, universities!inner(short_name, name, sort_order)",
    );
  return (data ?? [])
    .sort(
      (a, b) =>
        a.universities.sort_order - b.universities.sort_order ||
        a.sort_order - b.sort_order,
    )
    .map((row) => ({
      university: row.universities.name,
      universityShort: row.universities.short_name,
      specialty: row.name,
      label: `${row.short_name} – ${row.name} (${row.degree})`,
    }));
});
