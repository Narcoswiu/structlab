import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "katex/dist/katex.min.css";
import { ChapterBody } from "@/components/reader/ChapterBody";
import { ChapterSources } from "@/components/reader/ChapterSources";
import {
  ReaderShell,
  type ReaderMode,
  type ReaderTheme,
} from "@/components/reader/ReaderShell";
import { ReadingTracker } from "@/components/tracking/ReadingTracker";
import { requireUser } from "@/lib/auth";
import { extractQuizzes } from "@/lib/content/quiz";
import {
  loadChapter,
  parseSources,
  pickReaderMode,
} from "@/lib/reader-chapter";
import { getChapterQuizState } from "@/lib/review";
import { getTrackingAcceptedAt } from "@/lib/tracking";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(
  props: PageProps<"/learn/[module]/[chapter]">,
): Promise<Metadata> {
  const { module: moduleSlug, chapter: chapterSlug } = await props.params;
  await requireUser();
  const chapter = await loadChapter(moduleSlug, chapterSlug);
  return { title: chapter ? `${chapter.number}. ${chapter.title}` : "Глава" };
}

export default async function ChapterPage(
  props: PageProps<"/learn/[module]/[chapter]">,
) {
  const { module: moduleSlug, chapter: chapterSlug } = await props.params;
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const chapter = await loadChapter(moduleSlug, chapterSlug);
  if (!chapter) notFound();

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("user_settings")
    .select("theme, font_size, reader_mode")
    .eq("user_id", user.id)
    .maybeSingle();

  const mode: ReaderMode = pickReaderMode(
    searchParams.mode,
    settings?.reader_mode,
  );

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
  // въпросите от базата, подредени както са в текста (по отпечатъка им)
  const quizState = await getChapterQuizState(user.id, chapter.id, mode);
  const quizzes = extractQuizzes(bodyResult.data.body).map((item) => {
    const state = quizState.get(item.key);
    return state
      ? { questionId: state.id, box: state.box, dueOn: state.dueOn }
      : undefined;
  });
  const sources = parseSources(chapter.sources);
  const trackingAccepted = Boolean(await getTrackingAcceptedAt(user.id));
  const theme: ReaderTheme =
    settings?.theme === "light" || settings?.theme === "sepia"
      ? settings.theme
      : "dark";

  return (
    <ReaderShell
      basePath={`/learn/${moduleSlug}/${chapterSlug}`}
      mode={mode}
      initialTheme={theme}
      initialFontSize={settings?.font_size ?? 2}
      track={
        trackingAccepted
          ? { module: moduleSlug, chapter: chapterSlug }
          : undefined
      }
      header={
        <header className="reader-header">
          <Link href="/dashboard" className="reader-back">
            ← {chapter.modules.title}
          </Link>
          <p className="reader-kicker">Глава {chapter.number}</p>
          <h1>{chapter.title}</h1>
          {chapter.summary ? (
            <p className="reader-summary">{chapter.summary}</p>
          ) : null}
        </header>
      }
    >
      {trackingAccepted ? (
        <ReadingTracker module={moduleSlug} chapter={chapterSlug} mode={mode} />
      ) : null}
      <ChapterBody
        markdown={bodyResult.data.body}
        figures={figures}
        quizzes={quizzes}
      />
      <ChapterSources sources={sources} />
    </ReaderShell>
  );
}
