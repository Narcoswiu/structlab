"use client";

import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BookOpenText, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import {
  AI_MODES,
  ASSISTANT_TEXT,
  HISTORY_ITEM_MAX,
  HISTORY_MAX_ITEMS,
  QUESTION_MAX,
  type AiModeId,
  type AssistantJson,
  type AssistantMode,
  type ChapterRef,
  type ChatMessage,
  type LessonExcerpt,
  type RelatedChapter,
} from "@/lib/ai/modes";
import { cn } from "@/lib/utils";

// Markdown и KaTeX са тежки – зареждат се чак при първия отговор.
const AssistantMarkdown = dynamic(() => import("./AssistantMarkdown"), {
  ssr: false,
  loading: () => <p className="text-sm text-dim">Зареждане…</p>,
});

type AssistantButtonProps = {
  /** „lessons“ – търси само в уроците; „ai“ – отговаря AI услуга */
  mode: AssistantMode;
  /** главите, които потребителят може да чете */
  chapters: ChapterRef[];
  /** само в режим „ai“: оставащи въпроси за днес и името на услугата */
  remaining?: number;
  providerName?: string;
};

type Entry =
  | { id: number; kind: "question"; text: string }
  | { id: number; kind: "answer"; text: string; streaming: boolean }
  | {
      id: number;
      kind: "lessons";
      excerpts: LessonExcerpt[];
      related: RelatedChapter[];
      noAccess: boolean;
    }
  | { id: number; kind: "error"; text: string };

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;
type NewEntry = WithoutId<Entry>;

const EXAMPLES = [
  "Какво е съпротивителен момент?",
  "Какво е метод на сечението?",
  "Защо армировката на балкона е горе?",
  "Какво гласи теоремата на Щайнер?",
];

const GENERIC_ERROR = "Нещо се обърка. Опитай пак след малко.";
const linkClass =
  "inline-flex min-h-11 items-center font-bold text-link hover:text-link-hover";

/** Главата и режимът от адреса: /learn/<модул>/<глава>?mode=… */
function useCurrentChapter(chapters: ChapterRef[]) {
  const pathname = usePathname();
  const requested = useSearchParams().get("mode");
  const match = /^\/learn\/([a-z0-9-]+)\/([a-z0-9-]+)$/.exec(pathname);
  const chapter = match
    ? chapters.find(
        (item) => item.module === match[1] && item.slug === match[2],
      )
    : undefined;
  if (!chapter) return null;
  const readerMode =
    requested === "easy" || requested === "detailed" ? requested : undefined;
  return { chapter, readerMode };
}

/**
 * Плаващият бутон на помощника – на всяка вътрешна страница. Разговорът живее
 * само в паметта на страницата и изчезва при презареждане.
 */
export function AssistantButton({
  mode,
  chapters,
  remaining: initialRemaining,
  providerName,
}: AssistantButtonProps) {
  const isAi = mode === "ai";
  const title = isAi ? "Попитай асистента" : "Попитай учебника";
  const current = useCurrentChapter(chapters);
  const fieldId = useId();

  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [question, setQuestion] = useState("");
  const [aiMode, setAiMode] = useState<AiModeId>("explain");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const request = useRef<AbortController | null>(null);

  const limitReached = isAi && remaining !== undefined && remaining <= 0;

  // При отваряне фокусът влиза в полето; Esc затваря и го връща на бутона.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Новият въпрос застава най-горе, така че отговорът се чете от началото
  // му, а не от края.
  const entryCount = entries.length;
  useEffect(() => {
    const log = logRef.current;
    const last = [...(log?.querySelectorAll("[data-question]") ?? [])].at(-1);
    if (!log || !last) return;
    log.scrollTop +=
      last.getBoundingClientRect().top - log.getBoundingClientRect().top - 8;
  }, [entryCount]);

  useEffect(() => () => request.current?.abort(), []);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function add(entry: NewEntry) {
    const id = nextId.current++;
    setEntries((list) => [...list, { ...entry, id } as Entry]);
    return id;
  }

  async function ask(text: string) {
    const value = text.trim();
    if (!value || busy || limitReached) return;

    // предишните реплики – само в режим „ai“, и само текст
    const history: ChatMessage[] = isAi
      ? entries
          .flatMap((entry): ChatMessage[] =>
            entry.kind === "question"
              ? [{ role: "user", content: entry.text }]
              : entry.kind === "answer" && entry.text
                ? [{ role: "assistant", content: entry.text }]
                : [],
          )
          .slice(-HISTORY_MAX_ITEMS)
          .map((item) => ({
            ...item,
            content: item.content.slice(0, HISTORY_ITEM_MAX),
          }))
      : [];

    add({ kind: "question", text: value });
    setQuestion("");
    setBusy(true);
    const controller = new AbortController();
    request.current = controller;

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          question: value,
          ...(isAi ? { mode: aiMode, history } : {}),
          ...(current
            ? {
                context: {
                  module: current.chapter.module,
                  chapter: current.chapter.slug,
                  ...(current.readerMode ? { mode: current.readerMode } : {}),
                },
              }
            : {}),
        }),
      });

      const left = response.headers.get("X-Assistant-Remaining");
      if (left !== null) setRemaining(Number(left));

      const isJson = (response.headers.get("Content-Type") ?? "").includes(
        "application/json",
      );
      if (!response.ok) {
        const body = isJson
          ? ((await response.json()) as { error?: string })
          : null;
        if (response.status === 401) {
          add({ kind: "error", text: "Сесията ти е изтекла. Влез отново." });
        } else {
          add({ kind: "error", text: body?.error ?? GENERIC_ERROR });
        }
        return;
      }

      if (isJson) {
        const body = (await response.json()) as AssistantJson;
        if (body.kind === "lessons") add(body);
        else add({ kind: "answer", text: body.text, streaming: false });
        return;
      }

      // отговорът идва на части и се дописва, докато пристига
      const id = add({ kind: "answer", text: "", streaming: true });
      const update = (change: (text: string) => string, streaming: boolean) =>
        setEntries((list) =>
          list.map((entry) =>
            entry.id === id && entry.kind === "answer"
              ? { ...entry, text: change(entry.text), streaming }
              : entry,
          ),
        );
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      try {
        while (reader) {
          const { value: bytes, done } = await reader.read();
          if (done) break;
          const piece = decoder.decode(bytes, { stream: true });
          update((existing) => existing + piece, true);
        }
        update((existing) => existing, false);
      } catch {
        update(
          (existing) => `${existing}\n\n*(Отговорът прекъсна. Опитай пак.)*`,
          false,
        );
      }
    } catch {
      if (!controller.signal.aborted)
        add({ kind: "error", text: GENERIC_ERROR });
    } finally {
      setBusy(false);
      request.current = null;
    }
  }

  const Icon = isAi ? Sparkles : BookOpenText;

  return (
    <div className="fixed bottom-4 left-4 z-40 flex flex-col items-start gap-3">
      {open ? (
        <div
          role="dialog"
          aria-label={title}
          className="flex h-[640px] max-h-[calc(100dvh-6.5rem)] w-[min(440px,calc(100vw-2rem))] flex-col gap-3 rounded-2xl border border-line-strong bg-surface p-4 shadow-[0_24px_48px_-20px_rgba(0,0,0,0.7)] sm:p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="text-lg font-extrabold">{title}</h2>
              <p className="text-sm leading-normal text-dim">
                {current
                  ? `Питаш по: Глава ${current.chapter.number} „${current.chapter.title}“`
                  : "Питаш по целия учебник"}
                {isAi && remaining !== undefined
                  ? remaining === 1
                    ? " · Остава ти 1 въпрос за днес"
                    : ` · Остават ти ${remaining} въпроса за днес`
                  : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              aria-label="Затвори"
              className="min-w-11 px-2.5"
              onClick={close}
            >
              <X aria-hidden="true" className="size-5" />
            </Button>
          </div>

          <div
            ref={logRef}
            role="log"
            aria-label="Въпроси и отговори"
            tabIndex={0}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-xl border border-line bg-background p-3"
          >
            {entries.length === 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm leading-normal text-muted-foreground">
                  {isAi
                    ? "Отговарям само по учебника и посочвам главата и секцията."
                    : "Напиши въпрос и ще ти покажа къде в учебника пише за това. Например:"}
                </p>
                {isAi
                  ? null
                  : EXAMPLES.map((example) => (
                      <button
                        key={example}
                        type="button"
                        disabled={busy}
                        onClick={() => ask(example)}
                        className="min-h-11 cursor-pointer rounded-[10px] border border-line-strong bg-surface px-3.5 py-2 text-left text-[15px] font-semibold text-foreground hover:bg-surface-2"
                      >
                        {example}
                      </button>
                    ))}
              </div>
            ) : null}
            {entries.map((entry) => (
              <Message
                key={entry.id}
                entry={entry}
                onNavigate={() => setOpen(false)}
              />
            ))}
            {busy && entries.at(-1)?.kind === "question" ? (
              <p className="text-sm text-dim">
                {isAi ? "Асистентът пише…" : "Търся в учебника…"}
              </p>
            ) : null}
          </div>

          <form
            className="flex flex-col gap-2.5"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(question);
            }}
          >
            {isAi ? (
              <div
                role="group"
                aria-label="Как да отговоря"
                className="flex flex-wrap gap-2"
              >
                {AI_MODES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={aiMode === item.id}
                    onClick={() => setAiMode(item.id)}
                    className={cn(
                      "min-h-11 cursor-pointer rounded-full border px-3.5 text-sm font-bold",
                      aiMode === item.id
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-line-strong bg-surface text-foreground hover:bg-surface-2",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
            <label
              htmlFor={fieldId}
              className="text-sm font-bold text-muted-foreground"
            >
              {isAi ? "Твоят въпрос" : "Попитай за нещо от учебника"}
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id={fieldId}
                ref={inputRef}
                rows={2}
                required
                maxLength={QUESTION_MAX}
                value={question}
                disabled={limitReached}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  if (event.nativeEvent.isComposing) return;
                  event.preventDefault();
                  void ask(question);
                }}
                className={`${inputClass} resize-none py-2.5`}
              />
              <Button type="submit" disabled={busy || limitReached}>
                Изпрати
              </Button>
            </div>
            {limitReached ? (
              <p
                role="status"
                className="rounded-[10px] bg-warn-bg px-3.5 py-3 text-sm leading-normal text-warn-fg"
              >
                Стигна дневния лимит на въпросите към асистента. Утре пак ще
                можеш да питаш.
              </p>
            ) : null}
            <p className="text-[13px] leading-normal text-dim">
              {isAi
                ? `Въпросът ти се изпраща към ${providerName ?? "външна AI услуга"}. Не пиши лични данни. Въпросите не се записват.`
                : "Търси само в учебника. Въпросите не се записват."}
            </p>
          </form>
        </div>
      ) : null}
      <Button
        ref={buttonRef}
        variant="outline"
        aria-expanded={open}
        aria-label={title}
        className="min-w-11 px-3 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.7)] sm:px-[18px]"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon aria-hidden="true" className="size-[18px]" />
        <span className="hidden sm:inline">{title}</span>
      </Button>
    </div>
  );
}

function Message({
  entry,
  onNavigate,
}: {
  entry: Entry;
  onNavigate: () => void;
}) {
  if (entry.kind === "question") {
    return (
      <p
        data-question
        className="max-w-[88%] self-end rounded-[14px_14px_4px_14px] bg-chat-user px-3.5 py-2.5 leading-normal break-words whitespace-pre-wrap"
      >
        {entry.text}
      </p>
    );
  }
  if (entry.kind === "error") {
    return (
      <p
        role="alert"
        className="rounded-[10px] bg-warn-bg px-3.5 py-3 text-sm leading-normal text-warn-fg"
      >
        {entry.text}
      </p>
    );
  }
  if (entry.kind === "answer") {
    return (
      <div
        aria-busy={entry.streaming}
        className="rounded-[14px_14px_14px_4px] bg-surface-2 px-3.5 py-3 text-chat-text"
      >
        {entry.text ? <AssistantMarkdown>{entry.text}</AssistantMarkdown> : "…"}
      </div>
    );
  }

  if (entry.noAccess) {
    return <p className="leading-normal">{ASSISTANT_TEXT.noAccess}</p>;
  }
  if (entry.excerpts.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <p className="leading-normal">{ASSISTANT_TEXT.notFound}</p>
        {entry.related.length > 0 ? (
          <ul className="flex flex-col">
            {entry.related.map((chapter) => (
              <li key={chapter.href}>
                <Link
                  href={chapter.href}
                  className={linkClass}
                  onClick={onNavigate}
                >
                  Глава {chapter.number} „{chapter.title}“ →
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <Link href="/dashboard" className={linkClass} onClick={onNavigate}>
          Списък с главите →
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="leading-normal font-semibold">{ASSISTANT_TEXT.found}</p>
      {entry.excerpts.map((excerpt, index) => (
        <article
          key={`${excerpt.href}-${index}`}
          className="flex flex-col gap-1.5 rounded-[14px] bg-surface-2 px-3.5 pt-3 pb-1 text-chat-text"
        >
          <h3 className="text-[13px] leading-snug font-bold tracking-wide text-dim">
            Глава {excerpt.chapterNumber} „{excerpt.chapterTitle}“ ·{" "}
            {excerpt.sectionTitle}
            {excerpt.subsectionTitle ? ` · ${excerpt.subsectionTitle}` : ""}
          </h3>
          <AssistantMarkdown>{excerpt.markdown}</AssistantMarkdown>
          <Link href={excerpt.href} className={linkClass} onClick={onNavigate}>
            Отвори в Глава {excerpt.chapterNumber} →
          </Link>
        </article>
      ))}
    </div>
  );
}
