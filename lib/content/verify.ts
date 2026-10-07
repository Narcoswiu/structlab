import { CHAPTER_SECTIONS, extractSectionTitles } from "./sections.ts";

export type GlossaryEntry = { preferred: string; avoid?: string[] };

export type ContentProblem = { level: "error" | "warning"; message: string };

/** Текстът без формули, код и адреси – там правилата за езика не важат. */
function proseOnly(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$[^$\n]*\$/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/https?:\/\/\S+/g, " ");
}

/**
 * Проверки по CONTENT_GUIDE.md за един текст („Леко“ или „Подробно“):
 *  1. седемте секции са налице и в правилния ред → грешка;
 *  2. забранени синоними от речника → грешка;
 *  3. дробни числа с точка вместо запетая → предупреждение;
 *  4. фигура, която не съществува → грешка.
 */
export function verifyChapterBody(
  markdown: string,
  glossary: GlossaryEntry[],
  figureNames: string[],
): ContentProblem[] {
  const problems: ContentProblem[] = [];

  const titles = extractSectionTitles(markdown);
  const expected = CHAPTER_SECTIONS.map((section) => section.title);
  if (titles.join(" | ") !== expected.join(" | ")) {
    problems.push({
      level: "error",
      message: `Секциите трябва да са точно: ${expected.join(", ")}. Намерени: ${titles.join(", ") || "няма"}.`,
    });
  }

  const prose = proseOnly(markdown).toLowerCase();
  for (const entry of glossary) {
    for (const word of entry.avoid ?? []) {
      // цяла дума: преди и след нея няма буква
      const pattern = new RegExp(
        `(^|[^\\p{L}])${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "u",
      );
      if (pattern.test(prose)) {
        problems.push({
          level: "error",
          message: `Забранен термин „${word}“ – използвай „${entry.preferred}“.`,
        });
      }
    }
  }

  const dotted = proseOnly(markdown).match(/\d+\.\d+/g);
  if (dotted) {
    problems.push({
      level: "warning",
      message: `Дробни числа с точка вместо запетая: ${[...new Set(dotted)].slice(0, 5).join(", ")}.`,
    });
  }
  const mathDotted = markdown.match(/\$[^$]*\d\.\d[^$]*\$/g);
  if (mathDotted) {
    problems.push({
      level: "warning",
      message: `Във формула има точка вместо запетая (пиши 5{,}4): ${mathDotted[0]!.slice(0, 60)}`,
    });
  }

  const known = new Set(figureNames);
  for (const match of markdown.matchAll(/\]\(figure:([^)\s]+)\)/g)) {
    if (!known.has(match[1]!)) {
      problems.push({ level: "error", message: `Липсва фигура „${match[1]}“.` });
    }
  }

  return problems;
}

/** „Леко“ и „Подробно“ трябва да имат едни и същи секции (за превключвателя). */
export function verifySameSections(easy: string, detailed: string): ContentProblem[] {
  const a = extractSectionTitles(easy).join(" | ");
  const b = extractSectionTitles(detailed).join(" | ");
  return a === b
    ? []
    : [{ level: "error", message: "„Леко“ и „Подробно“ имат различни секции." }];
}
