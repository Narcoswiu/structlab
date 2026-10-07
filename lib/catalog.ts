import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SpecialtyOption = {
  id: string;
  shortName: string;
  name: string;
  degree: string;
  years: number;
  note: string;
  university: { shortName: string; name: string };
};

export type PlanItem = {
  title: string;
  /** модулът със съдържание, ако дисциплината има такъв */
  module: { slug: string; chapterCount: number } | null;
};

export type PlanYear = {
  year: number;
  winter: PlanItem[];
  summer: PlanItem[];
};

/** Всички специалности, подредени по университет – за избор от потребителя. */
export const listSpecialties = cache(async (): Promise<SpecialtyOption[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("specialties")
    .select(
      "id, short_name, name, degree, years, note, sort_order, universities!inner(short_name, name, sort_order)",
    );
  return (data ?? [])
    .sort(
      (a, b) =>
        a.universities.sort_order - b.universities.sort_order ||
        a.sort_order - b.sort_order,
    )
    .map((row) => ({
      id: row.id,
      shortName: row.short_name,
      name: row.name,
      degree: row.degree,
      years: row.years,
      note: row.note,
      university: {
        shortName: row.universities.short_name,
        name: row.universities.name,
      },
    }));
});

/** Учебният план на една специалност, по курсове и семестри. */
export async function getPlan(
  specialtyId: string,
  years: number,
): Promise<PlanYear[]> {
  const supabase = await createClient();
  const [items, modules] = await Promise.all([
    supabase
      .from("curriculum_items")
      .select("year, term, title, module_id, sort_order")
      .eq("specialty_id", specialtyId)
      .order("sort_order"),
    supabase.rpc("module_titles"),
  ]);
  const moduleById = new Map(
    (modules.data ?? []).map((m) => [
      m.id,
      { slug: m.slug, chapterCount: Number(m.chapter_count) },
    ]),
  );

  const plan: PlanYear[] = Array.from({ length: years }, (_, index) => ({
    year: index + 1,
    winter: [],
    summer: [],
  }));
  for (const item of items.data ?? []) {
    const target = plan[item.year - 1];
    if (!target) continue;
    target[item.term].push({
      title: item.title,
      module: item.module_id ? (moduleById.get(item.module_id) ?? null) : null,
    });
  }
  return plan;
}
