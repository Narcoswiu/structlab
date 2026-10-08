import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "katex/dist/katex.min.css";
import { ChapterBody } from "@/components/reader/ChapterBody";
import { ChapterSources } from "@/components/reader/ChapterSources";
import { PrintActions } from "@/components/reader/PrintActions";
import { requireUser } from "@/lib/auth";
import { buildWatermarkText } from "@/lib/print-watermark";
import {
  loadChapter,
  parseSources,
  pickReaderMode,
} from "@/lib/reader-chapter";
import { createClient } from "@/lib/supabase/server";
import { getTrackingAcceptedAt } from "@/lib/tracking";

// Платено съдържание с личен воден знак: страницата се строи наново за всяка
// заявка и не се пази в общ кеш.
export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/learn/[module]/[chapter]/print">,
): Promise<Metadata> {
  const { module: moduleSlug, chapter: chapterSlug } = await props.params;
  await requireUser();
  const chapter = await loadChapter(moduleSlug, chapterSlug);
  return {
    title: chapter
      ? `${chapter.number}. ${chapter.title} – за печат`
      : "Глава – за печат",
    robots: { index: false, follow: false },
  };
}

/** Глава във вид за печат: светла тема, отворени отговори и личен воден знак. */
export default async function ChapterPrintPage(
  props: PageProps<"/learn/[module]/[chapter]/print">,
) {
  const { module: moduleSlug, chapter: chapterSlug } = await props.params;
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const chapter = await loadChapter(moduleSlug, chapterSlug);
  if (!chapter) notFound();

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("user_settings")
    .select("reader_mode")
    .eq("user_id", user.id)
    .maybeSingle();
  const mode = pickReaderMode(searchParams.mode, settings?.reader_mode);

  const [bodyResult, figuresResult] = await Promise.all([
    supabase
      .from("chapter_bodies")
      .select("body")
      .eq("chapter_id", chapter.id)
      .eq("mode", mode)
      .maybeSingle(),
    supabase
      .from("chapter_figures")
      .select("name, svg")
      .eq("chapter_id", chapter.id),
  ]);
  if (!bodyResult.data) notFound();

  const figures = Object.fromEntries(
    (figuresResult.data ?? []).map((figure) => [figure.name, figure.svg]),
  );
  const trackingAccepted = Boolean(await getTrackingAcceptedAt(user.id));
  const watermark = buildWatermarkText(user.email);

  return (
    <div className="reader print-doc" data-theme="light" data-size="2">
      <PrintActions
        backHref={`/learn/${moduleSlug}/${chapterSlug}?mode=${mode}`}
        track={
          trackingAccepted
            ? { module: moduleSlug, chapter: chapterSlug }
            : undefined
        }
      />
      {/* Повтарят се на всеки отпечатан лист; на екрана не се виждат. */}
      <div
        aria-hidden="true"
        className="print-watermark print-watermark-diagonal"
      >
        {watermark}
      </div>
      <div
        aria-hidden="true"
        className="print-watermark print-watermark-footer"
      >
        {watermark}
      </div>
      <article className="reader-article">
        <header className="reader-header">
          <p className="print-note">{watermark}</p>
          <p className="reader-kicker">
            {chapter.modules.title} · Глава {chapter.number} ·{" "}
            {mode === "detailed" ? "Подробно" : "Леко"}
          </p>
          <h1>{chapter.title}</h1>
          {chapter.summary ? (
            <p className="reader-summary">{chapter.summary}</p>
          ) : null}
        </header>
        <div className="reader-prose">
          <ChapterBody
            markdown={bodyResult.data.body}
            figures={figures}
            expandAnswers
          />
          <ChapterSources sources={parseSources(chapter.sources)} />
        </div>
      </article>
    </div>
  );
}
