// Проверява и качва главите на учебника в базата.
//
//   pnpm content:verify            само проверка, нищо не се записва
//   pnpm content:push:local        качва в ЛОКАЛНАТА база (за тестове)
//   pnpm content:push              качва в истинската база (чете .env.local)
//
// Главите са в content/<модул>/chapters/<NN-име>/ и не влизат в публичното репо.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parse as parseYaml } from "yaml";
import {
  renderBeamFigure,
  type BeamFigureOptions,
} from "../lib/content/beam-figure.ts";
import {
  renderBarFigure,
  renderRigidBeamFigure,
  type BarFigureSpec,
  type RigidBeamFigureSpec,
} from "../lib/content/axial-figure.ts";
import {
  renderBendingStressFigure,
  type BendingStressFigureSpec,
} from "../lib/content/bending-figure.ts";
import { extractQuizzes, findQuizProblems } from "../lib/content/quiz.ts";
import { renderSectionFigure } from "../lib/content/section-figure.ts";
import {
  renderShearStressFigure,
  type ShearStressFigureSpec,
} from "../lib/content/shear-figure.ts";
import { findSvgProblem } from "../lib/content/svg.ts";
import {
  verifyChapterBody,
  verifySameSections,
  type ContentProblem,
  type GlossaryEntry,
} from "../lib/content/verify.ts";
import type { Beam } from "../lib/engineering/beam.ts";
import type { Rect } from "../lib/engineering/section.ts";

type FigureSpec =
  | { title: string; beam: Beam; parts?: BeamFigureOptions["parts"] }
  | { title: string; section: Rect[]; principal?: boolean }
  | ({ kind: "bar" } & BarFigureSpec)
  | ({ kind: "rigid-beam" } & RigidBeamFigureSpec)
  | ({ kind: "bending-stress" } & BendingStressFigureSpec)
  | ({ kind: "shear-stress" } & ShearStressFigureSpec);

function renderFigure(spec: FigureSpec): string {
  if ("kind" in spec) {
    if (spec.kind === "bending-stress") return renderBendingStressFigure(spec);
    if (spec.kind === "shear-stress") return renderShearStressFigure(spec);
    return spec.kind === "bar"
      ? renderBarFigure(spec)
      : renderRigidBeamFigure(spec);
  }
  if ("beam" in spec) {
    return renderBeamFigure(spec.beam, {
      title: spec.title,
      parts: spec.parts,
    });
  }
  return renderSectionFigure(spec.section, {
    title: spec.title,
    principal: spec.principal,
  });
}
type Meta = {
  number: number;
  slug: string;
  title: string;
  summary: string;
  published: boolean;
  /** публична демо глава (вижда се без вход, само в „Леко“) */
  demo?: boolean;
  sources: { title: string; url?: string }[];
  figures?: Record<string, FigureSpec>;
};
export type LoadedChapter = {
  moduleSlug: string;
  dir: string;
  meta: Meta;
  easy: string;
  detailed: string;
  figures: Record<string, string>;
  problems: ContentProblem[];
};

const ROOT = path.resolve(import.meta.dirname, "..", "content");

export function loadChapters(): LoadedChapter[] {
  const glossary = parseYaml(
    readFileSync(path.join(ROOT, "glossary.yml"), "utf8"),
  ) as GlossaryEntry[];
  const chapters: LoadedChapter[] = [];

  for (const moduleSlug of readdirSync(ROOT)) {
    const chaptersDir = path.join(ROOT, moduleSlug, "chapters");
    if (!existsSync(chaptersDir)) continue;
    for (const name of readdirSync(chaptersDir).sort()) {
      const dir = path.join(chaptersDir, name);
      if (!existsSync(path.join(dir, "meta.json"))) continue;
      const meta = JSON.parse(
        readFileSync(path.join(dir, "meta.json"), "utf8"),
      ) as Meta;
      const easy = readFileSync(path.join(dir, "easy.md"), "utf8");
      const detailed = readFileSync(path.join(dir, "detailed.md"), "utf8");
      const problems: ContentProblem[] = [];

      // фигури: начертани от изчисленията + ръчно нарисувани SVG файлове
      const figures: Record<string, string> = {};
      for (const [figureName, spec] of Object.entries(meta.figures ?? {})) {
        figures[figureName] = renderFigure(spec);
      }
      const figuresDir = path.join(dir, "figures");
      if (existsSync(figuresDir)) {
        for (const file of readdirSync(figuresDir)) {
          if (file.endsWith(".svg")) {
            figures[file.slice(0, -4)] = readFileSync(
              path.join(figuresDir, file),
              "utf8",
            ).trim();
          }
        }
      }
      for (const [figureName, svg] of Object.entries(figures)) {
        const problem = findSvgProblem(svg);
        if (problem) {
          problems.push({
            level: "error",
            message: `Фигура „${figureName}“: ${problem}.`,
          });
        }
      }

      const names = Object.keys(figures);
      for (const [label, text] of [
        ["Леко", easy],
        ["Подробно", detailed],
      ] as const) {
        for (const problem of verifyChapterBody(text, glossary, names)) {
          problems.push({
            ...problem,
            message: `[${label}] ${problem.message}`,
          });
        }
        for (const message of findQuizProblems(text)) {
          problems.push({ level: "error", message: `[${label}] ${message}` });
        }
      }
      problems.push(...verifySameSections(easy, detailed));
      if (
        !/^[a-z0-9-]+$/.test(meta.slug) ||
        !(meta.number > 0) ||
        !meta.title
      ) {
        problems.push({
          level: "error",
          message: "Невалидни данни в meta.json.",
        });
      }

      chapters.push({
        moduleSlug,
        dir,
        meta,
        easy,
        detailed,
        figures,
        problems,
      });
    }
  }
  return chapters;
}

function report(chapters: LoadedChapter[]): boolean {
  let ok = true;
  for (const chapter of chapters) {
    const errors = chapter.problems.filter((p) => p.level === "error");
    const warnings = chapter.problems.filter((p) => p.level === "warning");
    const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
    console.log(
      `${chapter.moduleSlug} / ${chapter.meta.number}. ${chapter.meta.title} – ` +
        `Леко ${words(chapter.easy)} думи, Подробно ${words(chapter.detailed)} думи, ` +
        `${Object.keys(chapter.figures).length} фигури, ${errors.length} грешки, ${warnings.length} предупреждения`,
    );
    for (const problem of chapter.problems) {
      console.log(
        `   ${problem.level === "error" ? "ГРЕШКА" : "внимание"}: ${problem.message}`,
      );
    }
    if (errors.length > 0) ok = false;
  }
  if (chapters.length === 0) console.log("Няма намерени глави.");
  return ok;
}

export async function pushChapters(
  chapters: LoadedChapter[],
  url: string,
  secretKey: string,
): Promise<void> {
  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  for (const chapter of chapters) {
    const { data: module, error: moduleError } = await supabase
      .from("modules")
      .select("id")
      .eq("slug", chapter.moduleSlug)
      .single();
    if (moduleError || !module) {
      throw new Error(`Няма модул „${chapter.moduleSlug}“ в базата.`);
    }
    const { data: row, error } = await supabase
      .from("chapters")
      .upsert(
        {
          module_id: module.id,
          slug: chapter.meta.slug,
          number: chapter.meta.number,
          title: chapter.meta.title,
          summary: chapter.meta.summary,
          sources: chapter.meta.sources,
          is_published: chapter.meta.published,
          is_demo: chapter.meta.demo === true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "module_id,slug" },
      )
      .select("id")
      .single();
    if (error || !row)
      throw new Error(`Главата не се записа: ${error?.message}`);

    const bodies = await supabase.from("chapter_bodies").upsert([
      {
        chapter_id: row.id,
        mode: "easy",
        body: chapter.easy,
        updated_at: new Date().toISOString(),
      },
      {
        chapter_id: row.id,
        mode: "detailed",
        body: chapter.detailed,
        updated_at: new Date().toISOString(),
      },
    ]);
    if (bodies.error)
      throw new Error(`Текстът не се записа: ${bodies.error.message}`);

    // фигурите се подменят изцяло, за да не остават стари
    const removed = await supabase
      .from("chapter_figures")
      .delete()
      .eq("chapter_id", row.id);
    if (removed.error) throw new Error(removed.error.message);
    const figureRows = Object.entries(chapter.figures).map(([name, svg]) => ({
      chapter_id: row.id,
      name,
      svg,
    }));
    if (figureRows.length > 0) {
      const inserted = await supabase
        .from("chapter_figures")
        .insert(figureRows);
      if (inserted.error)
        throw new Error(`Фигурите не се записаха: ${inserted.error.message}`);
    }
    const quizCount = await pushQuizzes(supabase, row.id, chapter);
    console.log(
      `   качена: ${chapter.meta.number}. ${chapter.meta.title}` +
        (quizCount === null
          ? " (въпросите са пропуснати – таблицата липсва в тази база)"
          : `, ${quizCount} въпроса`),
    );
  }
}

/**
 * Качва въпросите „Провери се“ на една глава. Въпрос със същия текст запазва
 * своя id (и графика за повторение на потребителите); махнатите се изтриват.
 * Връща null, ако базата още няма таблицата (миграцията не е приложена).
 */
async function pushQuizzes(
  supabase: SupabaseClient,
  chapterId: string,
  chapter: LoadedChapter,
): Promise<number | null> {
  let count = 0;
  for (const mode of ["easy", "detailed"] as const) {
    const items = extractQuizzes(chapter[mode]);
    const upserted = await supabase.from("quiz_questions").upsert(
      items.map((item) => ({
        chapter_id: chapterId,
        mode,
        key: item.key,
        position: item.position,
        question: item.question,
        answer: item.answer,
      })),
      { onConflict: "chapter_id,mode,key" },
    );
    if (upserted.error) {
      // PGRST205 / 42P01: таблицата не съществува
      if (["PGRST205", "42P01"].includes(upserted.error.code)) return null;
      throw new Error(`Въпросите не се записаха: ${upserted.error.message}`);
    }
    const existing = await supabase
      .from("quiz_questions")
      .select("id, key")
      .eq("chapter_id", chapterId)
      .eq("mode", mode);
    if (existing.error) throw new Error(existing.error.message);
    const keep = new Set(items.map((item) => item.key));
    const stale = (existing.data as { id: string; key: string }[])
      .filter((row) => !keep.has(row.key))
      .map((row) => row.id);
    if (stale.length > 0) {
      const removed = await supabase
        .from("quiz_questions")
        .delete()
        .in("id", stale);
      if (removed.error) throw new Error(removed.error.message);
    }
    count += items.length;
  }
  return count;
}

export function localSupabase(): { url: string; secretKey: string } {
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
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL)) {
    throw new Error("Очаквах локална база.");
  }
  return { url: status.API_URL, secretKey: status.SECRET_KEY };
}

// Изпълнява се само когато файлът е пуснат директно, не когато е внесен от тест.
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const [command, flag] = process.argv.slice(2);
  const chapters = loadChapters();
  const ok = report(chapters);
  if (!ok) {
    console.error("\nИма грешки – нищо не е качено.");
    process.exit(1);
  }
  if (command === "push") {
    const target =
      flag === "--local"
        ? localSupabase()
        : {
            url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
            secretKey: process.env.SUPABASE_SECRET_KEY ?? "",
          };
    if (!target.url || !target.secretKey) {
      console.error("Липсват ключовете на Supabase (.env.local).");
      process.exit(1);
    }
    console.log(`\nКачване в ${new URL(target.url).host} …`);
    await pushChapters(chapters, target.url, target.secretKey);
    console.log("Готово.");
  }
}
