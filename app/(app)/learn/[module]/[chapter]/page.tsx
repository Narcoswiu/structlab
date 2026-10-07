import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "katex/dist/katex.min.css";
import { ChapterBody } from "@/components/reader/ChapterBody";
import {
  ReaderShell,
  type ReaderMode,
  type ReaderTheme,
} from "@/components/reader/ReaderShell";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const slugPattern = /^[a-z0-9-]{1,80}$/;

type Source = { title: string; url?: string };

function parseSources(value: unknown): Source[] {
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
async function loadChapter(moduleSlug: string, chapterSlug: string) {
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

  const requested = searchParams.mode;
  const mode: ReaderMode =
    requested === "easy" || requested === "detailed"
      ? requested
      : settings?.reader_mode === "detailed"
        ? "detailed"
        : "easy";

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
  const sources = parseSources(chapter.sources);
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
      <ChapterBody markdown={bodyResult.data.body} figures={figures} />
      {sources.length > 0 ? (
        <section className="reader-sources" aria-label="Източници">
          <h2>Източници</h2>
          <ul>
            {sources.map((source) => (
              <li key={source.title}>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.title}
                  </a>
                ) : (
                  source.title
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </ReaderShell>
  );
}
