"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BookOpenText,
  Library,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
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
  type AssistantSuggestions,
  type ChapterRef,
  type ChatMessage,
} from "@/lib/ai/modes";
import { cn } from "@/lib/utils";
import {
  AssistantMessage,
  LoadingLines,
  QuestionChip,
  type Entry,
} from "./AssistantResults";

type AssistantButtonProps = {
  /** „lessons“ – търси само в уроците; „ai“ – отговаря AI услуга */
  mode: AssistantMode;
  /** главите, които потребителят може да чете */
  chapters: ChapterRef[];
  /** само в режим „ai“: оставащи въпроси за днес и името на услугата */
  remaining?: number;
  providerName?: string;
};

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;
type NewEntry = WithoutId<Entry>;

const GENERIC_ERROR = "Нещо се обърка. Опитай пак след малко.";
const PHONE = "(max-width: 639px)";

/** На телефон панелът заема целия екран и държи фокуса в себе си. */
function useIsPhone() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(PHONE);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

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
  const isPhone = useIsPhone();
  const fieldId = useId();
  const titleId = useId();
  const aboutId = useId();

  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [question, setQuestion] = useState("");
  const [aiMode, setAiMode] = useState<AiModeId>("explain");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  // примерните въпроси за празния панел – за главата, на която сме
  const [examples, setExamples] = useState<{
    key: string;
    items: string[];
  } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const request = useRef<AbortController | null>(null);

  const limitReached = isAi && remaining !== undefined && remaining <= 0;

  // При отваряне фокусът влиза в полето; Esc затваря и го връща на бутона.
  // На телефон панелът е на цял екран, затова Tab обикаля само в него.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      const dialog = dialogRef.current;
      if (event.key !== "Tab" || !dialog) return;
      if (!window.matchMedia(PHONE).matches) return;
      const items = [
        ...dialog.querySelectorAll<HTMLElement>(
          "a[href], button:not(:disabled), textarea:not(:disabled), summary, [tabindex='0']",
        ),
      ].filter((item) => item.getClientRects().length > 0);
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !dialog.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Примерните въпроси идват от главите, които потребителят може да чете.
  // Зареждат се при първото отваряне и пак, ако се смени главата.
  const hasChapters = chapters.length > 0;
  const examplesKey = current
    ? `${current.chapter.module}/${current.chapter.slug}`
    : "all";
  const examplesReady = examples?.key === examplesKey;
  const contextModule = current?.chapter.module;
  const contextChapter = current?.chapter.slug;
  const contextMode = current?.readerMode;
  useEffect(() => {
    if (!open || isAi || !hasChapters || examplesReady) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (contextModule && contextChapter) {
      params.set("module", contextModule);
      params.set("chapter", contextChapter);
      if (contextMode) params.set("mode", contextMode);
    }
    const query = params.size > 0 ? `?${params}` : "";
    fetch(`/api/assistant${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return [];
        const body = (await response.json()) as AssistantSuggestions;
        return Array.isArray(body.suggestions) ? body.suggestions : [];
      })
      .catch(() => [] as string[])
      .then((items) => {
        // без примери панелът пак работи – показва само поканата да питаш
        if (!controller.signal.aborted)
          setExamples({ key: examplesKey, items });
      });
    return () => controller.abort();
  }, [
    open,
    isAi,
    hasChapters,
    examplesReady,
    examplesKey,
    contextModule,
    contextChapter,
    contextMode,
  ]);

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
          add({
            kind: "error",
            text: body?.error ?? GENERIC_ERROR,
            retry: value,
          });
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
        add({ kind: "error", text: GENERIC_ERROR, retry: value });
    } finally {
      setBusy(false);
      request.current = null;
    }
  }

  const Icon = isAi ? Sparkles : BookOpenText;
  const waiting = busy && entries.at(-1)?.kind === "question";

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 flex flex-col items-start gap-3",
        // отвореният панел стои над „Обратна връзка“
        open ? "z-50" : "z-40",
      )}
    >
      {open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal={isPhone || undefined}
          aria-labelledby={titleId}
          aria-describedby={aboutId}
          className="assistant-panel fixed inset-0 flex flex-col overflow-hidden bg-surface pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] sm:static sm:h-[660px] sm:max-h-[calc(100dvh-6.5rem)] sm:w-[440px] sm:rounded-2xl sm:border sm:border-line-strong sm:p-0 sm:shadow-[0_24px_48px_-20px_rgba(0,0,0,0.7)]"
        >
          <header className="flex flex-col gap-3 border-b border-line px-4 pt-3 pb-3.5 sm:px-5 sm:pt-4">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="sl-chip-icon">
                <Icon className="size-5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
                <h2
                  id={titleId}
                  className="font-display text-base leading-tight font-bold"
                >
                  {title}
                </h2>
                <p
                  id={aboutId}
                  className="text-sm leading-normal text-muted-foreground"
                >
                  {isAi ? ASSISTANT_TEXT.aboutAi : ASSISTANT_TEXT.about}{" "}
                  {ASSISTANT_TEXT.aboutNot}
                </p>
              </div>
              <Button
                variant="ghost"
                aria-label="Затвори"
                className="-mt-1 -mr-2 min-w-11 px-2.5"
                onClick={close}
              >
                <X aria-hidden="true" className="size-5" />
              </Button>
            </div>
            <p className="flex items-start gap-2 text-[13px] leading-snug text-dim">
              <Library aria-hidden="true" className="mt-px size-4 flex-none" />
              <span>
                {current
                  ? `Питаш по: Глава ${current.chapter.number} „${current.chapter.title}“`
                  : "Питаш по целия учебник"}
                {isAi && remaining !== undefined
                  ? remaining === 1
                    ? " · Остава ти 1 въпрос за днес"
                    : ` · Остават ти ${remaining} въпроса за днес`
                  : ""}
              </span>
            </p>
          </header>

          <div
            ref={logRef}
            role="log"
            aria-label="Въпроси и отговори"
            tabIndex={0}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto overscroll-contain bg-background px-4 py-4 -outline-offset-2 sm:px-5"
          >
            {entries.length === 0 ? (
              <div className="flex flex-col gap-3">
                {!hasChapters && !isAi ? (
                  <p className="rounded-xl border border-line bg-surface px-4 py-3 leading-normal">
                    {ASSISTANT_TEXT.noAccess}
                  </p>
                ) : (
                  <p className="leading-normal text-muted-foreground">
                    {isAi
                      ? "Напиши въпроса си долу."
                      : "Напиши въпроса си долу или започни с някой от тези:"}
                  </p>
                )}
                {isAi || !hasChapters ? null : examplesReady ? (
                  <ul
                    aria-label="Примерни въпроси"
                    className="flex flex-wrap gap-2"
                  >
                    {examples.items.map((example) => (
                      <li key={example}>
                        <QuestionChip disabled={busy} onAsk={ask}>
                          {example}
                        </QuestionChip>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div aria-hidden="true" className="flex flex-wrap gap-2">
                    {["w-52", "w-64", "w-44"].map((width) => (
                      <span
                        key={width}
                        className={cn(
                          "h-11 max-w-full rounded-full bg-surface motion-safe:animate-pulse",
                          width,
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            {entries.map((entry) => (
              <AssistantMessage
                key={entry.id}
                entry={entry}
                busy={busy}
                onAsk={ask}
                onNavigate={() => setOpen(false)}
              />
            ))}
            {waiting ? (
              <div className="rounded-2xl border border-line bg-surface p-4">
                <LoadingLines
                  label={isAi ? "Асистентът пише…" : "Търся в уроците…"}
                />
              </div>
            ) : null}
          </div>

          <form
            className="flex flex-col gap-2 border-t border-line px-4 pt-3 pb-3 sm:px-5 sm:pb-4"
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
                placeholder={
                  isAi ? undefined : "Например: Какво е огъващ момент?"
                }
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  if (event.nativeEvent.isComposing) return;
                  event.preventDefault();
                  void ask(question);
                }}
                className={`${inputClass} min-w-0 resize-none py-2.5 leading-snug`}
              />
              <Button
                type="submit"
                disabled={busy || limitReached}
                className="px-3.5"
              >
                <span>Изпрати</span>
                <SendHorizontal aria-hidden="true" className="size-[18px]" />
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
