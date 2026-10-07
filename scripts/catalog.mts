// Качва каталога на специалностите (content/catalog.yml) в базата.
//
//   pnpm catalog:verify        само проверка
//   pnpm catalog:push:local    в локалната база
//   pnpm catalog:push          в истинската база (чете .env.local)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parse as parseYaml } from "yaml";

type Catalog = {
  modules: { slug: string; title: string; description: string; sort: number }[];
  links: Record<string, string>;
  universities: {
    slug: string;
    short_name: string;
    name: string;
    specialties: {
      slug: string;
      short_name: string;
      name: string;
      degree: string;
      years: number;
      note: string;
      plan: Record<string, string[]>;
    }[];
  }[];
};

const slugPattern = /^[a-z0-9-]+$/;

export function loadCatalog(): { catalog: Catalog; problems: string[] } {
  const file = path.resolve(
    import.meta.dirname,
    "..",
    "content",
    "catalog.yml",
  );
  const catalog = parseYaml(readFileSync(file, "utf8")) as Catalog;
  const problems: string[] = [];
  const moduleSlugs = new Set(catalog.modules.map((m) => m.slug));

  for (const m of catalog.modules) {
    if (!slugPattern.test(m.slug) || !m.title)
      problems.push(`Невалиден модул: ${m.slug}`);
  }
  for (const [title, slug] of Object.entries(catalog.links)) {
    if (!moduleSlugs.has(slug))
      problems.push(`Връзка „${title}“ сочи към липсващ модул ${slug}`);
  }
  for (const university of catalog.universities) {
    if (!slugPattern.test(university.slug))
      problems.push(`Невалиден университет: ${university.slug}`);
    for (const specialty of university.specialties) {
      const where = `${university.short_name} / ${specialty.short_name}`;
      if (!slugPattern.test(specialty.slug))
        problems.push(`${where}: невалидно име`);
      if (!(specialty.years >= 1 && specialty.years <= 8))
        problems.push(`${where}: невалиден брой години`);
      for (const [key, titles] of Object.entries(specialty.plan)) {
        const match = /^([1-8])([ws])$/.exec(key);
        if (!match || Number(match[1]) > specialty.years) {
          problems.push(`${where}: невалиден семестър „${key}“`);
        }
        if (!Array.isArray(titles) || titles.length === 0) {
          problems.push(`${where}: празен семестър „${key}“`);
        } else if (new Set(titles).size !== titles.length) {
          problems.push(`${where}: повторена дисциплина в „${key}“`);
        }
      }
    }
  }
  return { catalog, problems };
}

async function push(catalog: Catalog, url: string, secretKey: string) {
  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const fail = (what: string, message?: string) => {
    throw new Error(`${what}: ${message ?? "неизвестна грешка"}`);
  };

  const modules = await supabase
    .from("modules")
    .upsert(
      catalog.modules.map((m) => ({
        slug: m.slug,
        title: m.title,
        description: m.description,
        sort_order: m.sort,
      })),
      { onConflict: "slug" },
    )
    .select("id, slug");
  if (modules.error) fail("Модули", modules.error.message);
  const moduleId = new Map(modules.data!.map((m) => [m.slug, m.id]));

  let count = 0;
  for (const [uIndex, university] of catalog.universities.entries()) {
    const u = await supabase
      .from("universities")
      .upsert(
        {
          slug: university.slug,
          short_name: university.short_name,
          name: university.name,
          sort_order: uIndex,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (u.error) fail("Университет", u.error.message);

    for (const [sIndex, specialty] of university.specialties.entries()) {
      const s = await supabase
        .from("specialties")
        .upsert(
          {
            university_id: u.data!.id,
            slug: specialty.slug,
            short_name: specialty.short_name,
            name: specialty.name,
            degree: specialty.degree,
            years: specialty.years,
            note: specialty.note,
            sort_order: sIndex,
          },
          { onConflict: "university_id,slug" },
        )
        .select("id")
        .single();
      if (s.error) fail("Специалност", s.error.message);

      // планът се подменя изцяло; изборът на потребителите (specialty_id) остава
      const removed = await supabase
        .from("curriculum_items")
        .delete()
        .eq("specialty_id", s.data!.id);
      if (removed.error) fail("Изчистване на план", removed.error.message);

      const rows = Object.entries(specialty.plan).flatMap(([key, titles]) =>
        titles.map((title, index) => ({
          specialty_id: s.data!.id,
          year: Number(key[0]),
          term: key[1] === "w" ? ("winter" as const) : ("summer" as const),
          title,
          module_id: moduleId.get(catalog.links[title] ?? "") ?? null,
          sort_order: index,
        })),
      );
      const inserted = await supabase.from("curriculum_items").insert(rows);
      if (inserted.error) fail("Учебен план", inserted.error.message);
      count += rows.length;
      console.log(
        `   ${university.short_name} / ${specialty.short_name}: ${rows.length} дисциплини`,
      );
    }
  }
  console.log(`Общо ${count} дисциплини.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const [command, flag] = process.argv.slice(2);
  const { catalog, problems } = loadCatalog();
  const specialties = catalog.universities.flatMap((u) => u.specialties);
  console.log(
    `${catalog.universities.length} университета, ${specialties.length} специалности, ${catalog.modules.length} модула, ${problems.length} грешки`,
  );
  for (const problem of problems) console.log(`   ГРЕШКА: ${problem}`);
  if (problems.length > 0) process.exit(1);

  if (command === "push") {
    let target: { url: string; secretKey: string };
    if (flag === "--local") {
      const raw = execFileSync(
        "pnpm",
        ["exec", "supabase", "status", "-o", "json"],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        },
      );
      const status = JSON.parse(raw.slice(raw.indexOf("{"))) as {
        API_URL: string;
        SECRET_KEY: string;
      };
      if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL))
        throw new Error("Очаквах локална база.");
      target = { url: status.API_URL, secretKey: status.SECRET_KEY };
    } else {
      target = {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        secretKey: process.env.SUPABASE_SECRET_KEY ?? "",
      };
    }
    if (!target.url || !target.secretKey) {
      console.error("Липсват ключовете на Supabase (.env.local).");
      process.exit(1);
    }
    console.log(`Качване в ${new URL(target.url).host} …`);
    await push(catalog, target.url, target.secretKey);
    console.log("Готово.");
  }
}
