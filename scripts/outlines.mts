// Събира плановете на дисциплините (content/outlines/*.yml) в един файл,
// който сайтът чете: lib/outlines.generated.json.
//
//   pnpm outlines:build     проверява и записва файла
//   pnpm outlines:verify    само проверява
//
// Планът е списък с бъдещи глави – показва се на страницата на дисциплината,
// докато за нея още няма уроци.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export type Outline = {
  title: string;
  slug: string;
  summary: string;
  why: string;
  related: string[];
  /** true = главите следват официална програма или анотация на университета */
  official: boolean;
  sourceUrl: string | null;
  chapters: { title: string; summary: string }[];
};

const ROOT = path.resolve(import.meta.dirname, "..");
const DIR = path.join(ROOT, "content", "outlines");
const OUT = path.join(ROOT, "lib", "outlines.generated.json");

/** Дисциплини, за които нарочно няма план. */
export const WITHOUT_OUTLINE = new Set([
  "Чужд език",
  "Философия",
  "Избираема дисциплина",
  "Дипломна работа",
  // има готови глави – планът не се показва
  "Съпротивление на материалите",
]);

const text = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim() !== "" && value.length <= max
    ? value.trim()
    : null;

export function catalogDisciplines(): Set<string> {
  const catalog = parseYaml(
    readFileSync(path.join(ROOT, "content", "catalog.yml"), "utf8"),
  ) as {
    universities: { specialties: { plan: Record<string, string[]> }[] }[];
  };
  return new Set(
    catalog.universities.flatMap((university) =>
      university.specialties.flatMap((specialty) =>
        Object.values(specialty.plan).flat(),
      ),
    ),
  );
}

export function loadOutlines(): { outlines: Outline[]; problems: string[] } {
  const problems: string[] = [];
  const outlines: Outline[] = [];
  const disciplines = catalogDisciplines();
  const slugs = new Set<string>();
  const titles = new Set<string>();

  for (const file of readdirSync(DIR).sort()) {
    if (!file.endsWith(".yml")) continue;
    let raw: Record<string, unknown>;
    try {
      raw = parseYaml(readFileSync(path.join(DIR, file), "utf8")) as Record<
        string,
        unknown
      >;
    } catch {
      problems.push(`${file}: невалиден YAML.`);
      continue;
    }
    const title = text(raw.title, 120);
    const slug = text(raw.slug, 80);
    const summary = text(raw.summary, 260);
    const why = text(raw.why, 260);
    if (!title || !slug || !summary || !why) {
      problems.push(`${file}: липсва title, slug, summary или why.`);
      continue;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) problems.push(`${file}: невалиден slug.`);
    if (`${slug}.yml` !== file)
      problems.push(`${file}: slug не съвпада с името на файла.`);
    if (slugs.has(slug)) problems.push(`${file}: повторен slug.`);
    if (titles.has(title)) problems.push(`${file}: повторено заглавие.`);
    if (!disciplines.has(title)) {
      problems.push(`${file}: „${title}“ не е дисциплина от каталога.`);
    }
    slugs.add(slug);
    titles.add(title);

    const chapters = (Array.isArray(raw.chapters) ? raw.chapters : []).flatMap(
      (item) => {
        const chapter = item as Record<string, unknown>;
        const chapterTitle = text(chapter?.title, 110);
        const chapterSummary = text(chapter?.summary, 240);
        return chapterTitle && chapterSummary
          ? [{ title: chapterTitle, summary: chapterSummary }]
          : [];
      },
    );
    if (chapters.length < 5 || chapters.length > 14) {
      problems.push(
        `${file}: главите трябва да са между 5 и 14 (има ${chapters.length}).`,
      );
    }

    const source = (raw.source ?? {}) as Record<string, unknown>;
    const url = text(source.url, 300);
    const validUrl =
      url &&
      /^https:\/\/(old\.uacg\.bg|uacg\.bg|web\.archive\.org|vsu\.bg)\//.test(
        url,
      )
        ? url
        : null;
    if (url && !validUrl)
      problems.push(`${file}: източникът не е официален адрес: ${url}`);
    outlines.push({
      title,
      slug,
      summary,
      why,
      related: (Array.isArray(raw.related) ? raw.related : []).filter(
        (item): item is string =>
          typeof item === "string" && disciplines.has(item),
      ),
      // „официален“ само когато има и статус, и адрес, който може да се отвори
      official: source.status === "official" && validUrl !== null,
      sourceUrl: validUrl,
      chapters,
    });
  }

  return { outlines, problems };
}

// Изпълнява се само когато файлът е пуснат директно.
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const { outlines, problems } = loadOutlines();
  const disciplines = catalogDisciplines();
  const covered = new Set(outlines.map((outline) => outline.title));
  const missing = [...disciplines].filter(
    (name) => !covered.has(name) && !WITHOUT_OUTLINE.has(name),
  );
  console.log(
    `${outlines.length} плана; официални: ${outlines.filter((o) => o.official).length}; ` +
      `дисциплини без план: ${missing.length}`,
  );
  for (const name of missing) console.log(`   няма план: ${name}`);
  for (const problem of problems) console.log(`   ГРЕШКА: ${problem}`);
  if (problems.length > 0) process.exit(1);
  if (process.argv[2] === "build") {
    writeFileSync(OUT, JSON.stringify(outlines, null, 2) + "\n");
    console.log(`Записано: ${path.relative(ROOT, OUT)}`);
  }
}
