import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "katex/dist/katex.min.css";
import { DemoBanner } from "@/components/public/DemoBanner";
import { PublicPage } from "@/components/public/PublicPage";
import { ChapterBody } from "@/components/reader/ChapterBody";
import { getDemoChapter } from "@/lib/demo";

// Съдържанието идва от базата: страницата се обновява най-много на 5 минути.
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const chapter = await getDemoChapter();
  return {
    title: chapter ? `Демо: ${chapter.title}` : "Демо",
    description: chapter?.summary,
  };
}

// Публична глава в режим „Леко“: само четене, без настройки и без „Подробно“.
export default async function DemoChapterPage() {
  const chapter = await getDemoChapter();
  if (!chapter) notFound();

  return (
    <PublicPage>
      <DemoBanner />
      <div
        className="reader !mx-0 rounded-2xl !px-0"
        data-theme="dark"
        data-size="2"
      >
        <article className="reader-article !pt-0">
          <header className="reader-header">
            <Link href="/demo" className="reader-back">
              ← Демо
            </Link>
            <p className="reader-kicker">
              {chapter.moduleTitle} · Глава {chapter.number} · режим „Леко“
            </p>
            <h1>{chapter.title}</h1>
            {chapter.summary ? (
              <p className="reader-summary">{chapter.summary}</p>
            ) : null}
          </header>
          <div className="reader-prose">
            <ChapterBody markdown={chapter.body} figures={chapter.figures} />
          </div>
        </article>
      </div>
      <DemoBanner />
    </PublicPage>
  );
}
