import { z } from "zod";
import { getAiConfig, type AiConfig } from "@/lib/ai/config";
import { getSynonyms } from "@/lib/ai/glossary";
import { loadReadableContent, loadSavedReaderMode } from "@/lib/ai/load";
import {
  AI_MODE_IDS,
  ASSISTANT_TEXT,
  HISTORY_ITEM_MAX,
  HISTORY_MAX_ITEMS,
  QUESTION_MAX,
  type AssistantJson,
} from "@/lib/ai/modes";
import { buildMessages, buildSystemPrompt } from "@/lib/ai/prompt";
import { ProviderError, openProviderStream } from "@/lib/ai/providers";
import {
  LESSON_EXCERPTS,
  currentChapterChunks,
  makeExcerpt,
  rankChunks,
  relatedChapters,
  selectWithinBudget,
  splitChapter,
  type ChapterInfo,
  type Chunk,
  type ContentMode,
  type SynonymIndex,
} from "@/lib/ai/retrieval";
import {
  allowAssistantRequest,
  beginAnswer,
  consumeAiRequest,
  endAnswer,
  getAiUsedToday,
} from "@/lib/ai/usage";
import { getCurrentUser } from "@/lib/auth";

// Отговорът на AI услугата идва на части; даваме му до минута.
export const maxDuration = 60;
const UPSTREAM_TIMEOUT_MS = 60_000;
/** Най-голямата заявка: въпрос + шест реплики + малко отгоре. */
const MAX_BODY_CHARS = 32_000;

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);

// Всичко извън тези полета се отхвърля.
const requestSchema = z.strictObject({
  question: z.string().trim().min(1).max(QUESTION_MAX),
  mode: z.enum(AI_MODE_IDS).default("explain"),
  context: z
    .strictObject({
      module: slug,
      chapter: slug,
      mode: z.enum(["easy", "detailed"]).optional(),
    })
    .optional(),
  history: z
    .array(
      z.strictObject({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(HISTORY_ITEM_MAX),
      }),
    )
    .max(HISTORY_MAX_ITEMS)
    .default([]),
});

type AssistantRequest = z.infer<typeof requestSchema>;

const TEXT = {
  invalid: "Невалидни данни.",
  tooLong: "Въпросът е твърде дълъг.",
  tooFast: "Твърде много въпроси за кратко време. Изчакай минута и опитай пак.",
  busy: "Изчакай предишният отговор да свърши и тогава питай пак.",
  limit: (limit: number) =>
    `Стигна дневния лимит от ${limit} въпроса към асистента. Утре пак ще можеш да питаш.`,
  overloaded: "AI услугата е претоварена, опитай след малко.",
  failed: "Асистентът не успя да отговори. Опитай пак след малко.",
  empty:
    "Асистентът не върна отговор. Опитай пак или задай въпроса с други думи.",
  interrupted: "\n\n*(Отговорът прекъсна. Опитай пак.)*",
};

const noStore = { "Cache-Control": "no-store" };

function json(body: AssistantJson | { error: string }, status = 200) {
  return Response.json(body, { status, headers: noStore });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_CHARS) {
    return json({ error: TEXT.tooLong }, 413);
  }
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_CHARS) return json({ error: TEXT.tooLong }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: TEXT.invalid }, 400);
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return json({ error: TEXT.invalid }, 400);
  const input = parsed.data;

  if (!(await allowAssistantRequest(user.id))) {
    return json({ error: TEXT.tooFast }, 429);
  }

  // Текстовете се четат от името на потребителя: RLS решава какво вижда.
  const [{ chapters, sources }, preferredMode] = await Promise.all([
    loadReadableContent(),
    input.context?.mode ?? loadSavedReaderMode(user.id),
  ]);
  const found = {
    chapters,
    chunks: sources.flatMap(splitChapter),
    preferredMode,
    synonyms: getSynonyms(),
    current: input.context
      ? { module: input.context.module, chapter: input.context.chapter }
      : undefined,
  };

  const config = getAiConfig();
  return config
    ? answerWithAi(user.id, input, found, config, request.signal)
    : answerFromLessons(input, found);
}

type Found = {
  chapters: ChapterInfo[];
  chunks: Chunk[];
  preferredMode: ContentMode;
  synonyms: SynonymIndex;
  current?: { module: string; chapter: string };
};

const chapterHref = (chapter: { moduleSlug: string; chapterSlug: string }) =>
  `/learn/${chapter.moduleSlug}/${chapter.chapterSlug}`;

/** Без AI услуга: най-подходящите откъси от уроците, с връзка към секцията. */
function answerFromLessons(input: AssistantRequest, found: Found) {
  if (found.chunks.length === 0) {
    return json({ kind: "lessons", excerpts: [], related: [], noAccess: true });
  }
  const ranked = rankChunks(input.question, found.chunks, found);
  const excerpts = ranked.slice(0, LESSON_EXCERPTS).map((chunk) => ({
    chapterNumber: chunk.chapterNumber,
    chapterTitle: chunk.chapterTitle,
    sectionTitle: chunk.sectionTitle,
    subsectionTitle: chunk.subsectionTitle,
    markdown: makeExcerpt(chunk.text, input.question, found.synonyms),
    href: `${chapterHref(chunk)}?mode=${chunk.mode}${chunk.sectionId ? `#${chunk.sectionId}` : ""}`,
  }));
  const related =
    excerpts.length > 0
      ? []
      : relatedChapters(input.question, found.chapters, found.synonyms).map(
          (chapter) => ({
            number: chapter.number,
            title: chapter.title,
            href: chapterHref(chapter),
          }),
        );
  return json({ kind: "lessons", excerpts, related, noAccess: false });
}

/** С AI услуга: откъсите отиват при модела, а отговорът се връща на части. */
async function answerWithAi(
  userId: string,
  input: AssistantRequest,
  found: Found,
  config: AiConfig,
  requestSignal: AbortSignal,
) {
  // Без достъп до учебника няма откъси – и модел не се вика.
  if (found.chunks.length === 0) {
    return json({ kind: "message", text: ASSISTANT_TEXT.noAccess });
  }
  const ranked = rankChunks(input.question, found.chunks, {
    ...found,
    history: input.history
      .filter((item) => item.role === "user")
      .map((item) => item.content),
  });
  let excerpts = selectWithinBudget(ranked, found);
  if (excerpts.length === 0 && found.current) {
    // „обясни това по-просто“: въпросът е за главата, която се чете
    excerpts = selectWithinBudget(
      currentChapterChunks(found.chunks, found.current, found.preferredMode),
      found,
    );
  }
  if (excerpts.length === 0) {
    return json({ kind: "message", text: ASSISTANT_TEXT.notFound });
  }

  if (!beginAnswer(userId)) return json({ error: TEXT.busy }, 429);
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), UPSTREAM_TIMEOUT_MS);
  const onClientGone = () => abort.abort();
  requestSignal.addEventListener("abort", onClientGone);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    clearTimeout(timeout);
    requestSignal.removeEventListener("abort", onClientGone);
    endAnswer(userId);
  };

  try {
    if ((await getAiUsedToday(userId)) >= config.dailyLimit) {
      release();
      return json({ error: TEXT.limit(config.dailyLimit) }, 429);
    }

    const deltas = await openProviderStream(
      config,
      buildSystemPrompt(input.mode, excerpts, found.chapters),
      buildMessages(input.history, input.question),
      { signal: abort.signal },
    );

    // Услугата прие заявката – чак сега въпросът се брои.
    const usage = await consumeAiRequest(userId, config.dailyLimit);
    if (!usage?.allowed) {
      abort.abort();
      await deltas.return();
      release();
      return usage
        ? json({ error: TEXT.limit(config.dailyLimit) }, 429)
        : json({ error: TEXT.failed }, 500);
    }

    const encoder = new TextEncoder();
    let hasText = false;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const next = await deltas.next();
          if (!next.done) {
            if (next.value.trim()) hasText = true;
            controller.enqueue(encoder.encode(next.value));
            return;
          }
          // модел, който не върне нищо, не оставя потребителя без отговор
          if (!hasText) controller.enqueue(encoder.encode(TEXT.empty));
        } catch {
          controller.enqueue(
            encoder.encode(hasText ? TEXT.interrupted : TEXT.failed),
          );
        }
        controller.close();
        release();
      },
      async cancel() {
        abort.abort();
        await deltas.return().catch(() => {});
        release();
      },
    });
    return new Response(stream, {
      headers: {
        ...noStore,
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-Assistant-Remaining": String(
          Math.max(0, config.dailyLimit - usage.used),
        ),
      },
    });
  } catch (error) {
    release();
    // в лога влиза само видът на грешката – никога въпросът или ключът
    const kind = error instanceof ProviderError ? error.kind : "failed";
    const status = error instanceof ProviderError ? error.status : undefined;
    console.error("assistant: AI услугата отказа заявката", kind, status ?? "");
    return kind === "overloaded"
      ? json({ error: TEXT.overloaded }, 503)
      : json({ error: TEXT.failed }, 502);
  }
}
