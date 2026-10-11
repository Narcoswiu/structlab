"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  RotateCcw,
  SearchX,
  TriangleAlert,
} from "lucide-react";
import {
  ASSISTANT_TEXT,
  type LessonExcerpt,
  type RelatedChapter,
} from "@/lib/ai/modes";
import { cn } from "@/lib/utils";

// Markdown и KaTeX са тежки – зареждат се чак при първия отговор.
const AssistantMarkdown = dynamic(() => import("./AssistantMarkdown"), {
  ssr: false,
  loading: () => <LoadingLines />,
});

export type Entry =
  | { id: number; kind: "question"; text: string }
  | { id: number; kind: "answer"; text: string; streaming: boolean }
  | {
      id: number;
      kind: "lessons";
      excerpts: LessonExcerpt[];
      related: RelatedChapter[];
      more?: RelatedChapter[];
      suggestions?: string[];
      noAccess: boolean;
    }
  | { id: number; kind: "error"; text: string; retry?: string };

const linkClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-md font-bold text-link hover:text-link-hover";

/** Въпрос, който се задава с едно натискане. */
export function QuestionChip({
  children,
  disabled,
  onAsk,
}: {
  children: string;
  disabled?: boolean;
  onAsk: (question: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onAsk(children)}
      className="min-h-11 cursor-pointer rounded-full border border-line-strong bg-surface px-4 py-2 text-left text-[15px] leading-snug font-semibold text-foreground transition-colors hover:border-primary hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Сиви редове на мястото на текст, който още се зарежда. */
export function LoadingLines({ label }: { label?: string }) {
  return (
    <div role={label ? "status" : undefined} className="flex flex-col gap-2.5">
      {label ? <p className="text-sm text-dim">{label}</p> : null}
      <div aria-hidden="true" className="flex flex-col gap-2">
        {["w-11/12", "w-full", "w-8/12"].map((width) => (
          <span
            key={width}
            className={cn(
              "h-3 rounded-full bg-surface-2 motion-safe:animate-pulse",
              width,
            )}
          />
        ))}
      </div>
    </div>
  );
}

const sectionOf = (excerpt: LessonExcerpt) =>
  excerpt.subsectionTitle
    ? `${excerpt.sectionTitle} · ${excerpt.subsectionTitle}`
    : excerpt.sectionTitle;

function OpenLink({
  excerpt,
  onNavigate,
}: {
  excerpt: LessonExcerpt;
  onNavigate: () => void;
}) {
  return (
    <Link href={excerpt.href} className={linkClass} onClick={onNavigate}>
      Отвори в Глава {excerpt.chapterNumber} →
    </Link>
  );
}

function ChapterLinks({
  title,
  chapters,
  onNavigate,
}: {
  title: string;
  chapters: RelatedChapter[];
  onNavigate: () => void;
}) {
  if (chapters.length === 0) return null;
  return (
    <nav aria-label={title} className="flex flex-col">
      <p className="sl-kicker text-dim">{title}</p>
      <ul className="flex flex-col">
        {chapters.map((chapter) => (
          <li key={chapter.href}>
            <Link
              href={chapter.href}
              className={cn(linkClass, "py-1.5 leading-snug")}
              onClick={onNavigate}
            >
              <ArrowRight aria-hidden="true" className="size-4 flex-none" />
              <span>
                Глава {chapter.number} „{chapter.title}“
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Една реплика от разговора: въпрос, откъси, съобщение или грешка. */
export function AssistantMessage({
  entry,
  busy,
  onAsk,
  onNavigate,
}: {
  entry: Entry;
  busy: boolean;
  onAsk: (question: string) => void;
  onNavigate: () => void;
}) {
  if (entry.kind === "question") {
    return (
      <p
        data-question
        className="max-w-[88%] self-end rounded-[16px_16px_4px_16px] bg-chat-user px-4 py-2.5 leading-normal break-words whitespace-pre-wrap"
      >
        {entry.text}
      </p>
    );
  }
  if (entry.kind === "error") {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl bg-warn-bg px-3.5 py-3 text-warn-fg"
      >
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 flex-none" />
        <div className="flex min-w-0 flex-col items-start">
          <p className="text-sm leading-normal">{entry.text}</p>
          {entry.retry ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAsk(entry.retry!)}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md text-sm font-bold underline underline-offset-4 disabled:opacity-50"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Опитай пак
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  if (entry.kind === "answer") {
    return (
      <div
        aria-busy={entry.streaming}
        className="rounded-[16px_16px_16px_4px] bg-surface-2 px-4 py-3 text-chat-text"
      >
        {entry.text ? <AssistantMarkdown>{entry.text}</AssistantMarkdown> : "…"}
      </div>
    );
  }

  if (entry.noAccess) {
    return (
      <p className="rounded-xl border border-line bg-surface px-4 py-3 leading-normal">
        {ASSISTANT_TEXT.noAccess}
      </p>
    );
  }

  const [best, ...others] = entry.excerpts;
  if (!best) {
    const suggestions = entry.suggestions ?? [];
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="sl-chip-icon" data-tone="warm">
            <SearchX className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="leading-snug font-extrabold">
              {ASSISTANT_TEXT.notFoundTitle}
            </p>
            <p className="text-sm leading-normal text-muted-foreground">
              {suggestions.length > 0
                ? ASSISTANT_TEXT.notFoundHint
                : ASSISTANT_TEXT.notFoundPlain}
            </p>
          </div>
        </div>
        {suggestions.length > 0 ? (
          <ul aria-label="Предложени въпроси" className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <QuestionChip disabled={busy} onAsk={onAsk}>
                  {suggestion}
                </QuestionChip>
              </li>
            ))}
          </ul>
        ) : null}
        <ChapterLinks
          title="Може би търсиш"
          chapters={entry.related}
          onNavigate={onNavigate}
        />
        <Link href="/dashboard" className={linkClass} onClick={onNavigate}>
          Списък с главите →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-normal font-semibold text-muted-foreground">
        {ASSISTANT_TEXT.found}
      </p>
      <article className="overflow-hidden rounded-2xl border border-line-strong bg-surface">
        <header className="flex flex-col gap-1 border-b border-line bg-surface-hi px-4 py-3">
          <span className="sl-kicker text-link">Най-близкият откъс</span>
          <h3 className="text-[15px] leading-snug font-extrabold">
            Глава {best.chapterNumber} „{best.chapterTitle}“
          </h3>
          <p className="text-[13px] leading-snug text-dim">{sectionOf(best)}</p>
        </header>
        <div className="assistant-excerpt px-4 py-3.5 text-chat-text">
          <AssistantMarkdown highlights={best.highlights}>
            {best.markdown}
          </AssistantMarkdown>
        </div>
        <footer className="border-t border-line px-4 py-1">
          <OpenLink excerpt={best} onNavigate={onNavigate} />
        </footer>
      </article>

      {others.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="sl-kicker text-dim">Още откъси</p>
          {others.map((excerpt, index) => (
            <article
              key={`${excerpt.href}-${index}`}
              className="overflow-hidden rounded-xl border border-line bg-surface"
            >
              <details className="assistant-more">
                <summary className="flex min-h-11 cursor-pointer items-center gap-2.5 px-3.5 py-2.5 hover:bg-surface-2">
                  <ChevronRight
                    aria-hidden="true"
                    className="assistant-more-chevron size-4 flex-none text-dim"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <h3 className="text-sm leading-snug font-bold">
                      Глава {excerpt.chapterNumber} „{excerpt.chapterTitle}“
                    </h3>
                    <span className="text-[13px] leading-snug text-dim">
                      {sectionOf(excerpt)}
                    </span>
                  </span>
                </summary>
                <div className="assistant-excerpt border-t border-line px-3.5 pt-3 pb-1 text-chat-text">
                  <AssistantMarkdown highlights={excerpt.highlights}>
                    {excerpt.markdown}
                  </AssistantMarkdown>
                  <OpenLink excerpt={excerpt} onNavigate={onNavigate} />
                </div>
              </details>
            </article>
          ))}
        </div>
      ) : null}

      <ChapterLinks
        title="Виж още"
        chapters={entry.more ?? []}
        onNavigate={onNavigate}
      />
    </div>
  );
}
