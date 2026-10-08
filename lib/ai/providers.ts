import type { ChatMessage } from "./modes";

/**
 * Връзката с AI услугата. Два вида услуги, едно и също поведение: праща се
 * системно съобщение и разговорът, връщат се парчетата текст едно по едно.
 *
 *  - „anthropic“          – Messages API;
 *  - „openai-compatible“  – Chat Completions (Groq, Gemini, Ollama и др.).
 */

export type ProviderId = "anthropic" | "openai-compatible";

export type ProviderConfig = {
  provider: ProviderId;
  apiKey: string;
  apiUrl: string;
  model: string;
};

export const MAX_OUTPUT_TOKENS = 900;

export type ProviderErrorKind = "overloaded" | "failed";

/** Услугата отказа заявката. Съобщението никога не носи отговора ѝ. */
export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    readonly status?: number,
  ) {
    super(`AI provider ${kind}`);
    this.name = "ProviderError";
  }
}

export function buildProviderRequest(
  config: ProviderConfig,
  system: string,
  messages: ChatMessage[],
): { url: string; headers: Record<string, string>; body: string } {
  if (config.provider === "anthropic") {
    return {
      url: config.apiUrl,
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        stream: true,
        system,
        messages,
      }),
    };
  }
  return {
    url: config.apiUrl,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: true,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  };
}

export type DeltaParser = {
  /** Подава следващото парче от потока; връща готовите парчета текст. */
  push(text: string): string[];
  /** услугата е казала, че отговорът е свършил */
  readonly done: boolean;
  /** услугата е съобщила грешка по средата на отговора */
  readonly failed: boolean;
};

type Json = Record<string, unknown>;
const asObject = (value: unknown): Json | null =>
  value && typeof value === "object" ? (value as Json) : null;

function anthropicDelta(event: Json): string | "done" | "error" | null {
  if (event.type === "error") return "error";
  if (event.type === "message_stop") return "done";
  if (event.type !== "content_block_delta") return null;
  const delta = asObject(event.delta);
  return delta?.type === "text_delta" && typeof delta.text === "string"
    ? delta.text
    : null;
}

function openAiDelta(event: Json): string | "done" | "error" | null {
  if (event.error) return "error";
  const choice = Array.isArray(event.choices)
    ? asObject(event.choices[0])
    : null;
  const content = asObject(choice?.delta)?.content;
  return typeof content === "string" ? content : null;
}

/**
 * Чете SSE поток („data: {...}“ на всеки ред). Мрежата реже потока където
 * си иска – и по средата на ред – затова недовършеният ред се пази до
 * следващото парче.
 */
export function createDeltaParser(provider: ProviderId): DeltaParser {
  let buffer = "";
  let done = false;
  let failed = false;
  const read = provider === "anthropic" ? anthropicDelta : openAiDelta;

  return {
    push(text) {
      const out: string[] = [];
      buffer += text;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        if (done || failed) break;
        const line = raw.trimEnd();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          done = true;
          break;
        }
        let event: Json | null = null;
        try {
          event = asObject(JSON.parse(data));
        } catch {
          continue;
        }
        if (!event) continue;
        const result = read(event);
        if (result === "done") done = true;
        else if (result === "error") failed = true;
        else if (result) out.push(result);
      }
      return out;
    },
    get done() {
      return done;
    },
    get failed() {
      return failed;
    },
  };
}

/**
 * Отваря потока към услугата. Хвърля ProviderError, ако тя не приеме
 * заявката: „overloaded“ при 429/503/529 (често при безплатните планове),
 * „failed“ за всичко друго. Връща парчетата текст.
 */
export async function openProviderStream(
  config: ProviderConfig,
  system: string,
  messages: ChatMessage[],
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<AsyncGenerator<string, void, void>> {
  const request = buildProviderRequest(config, system, messages);
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(request.url, {
      method: "POST",
      headers: request.headers,
      body: request.body,
      signal: options.signal,
      cache: "no-store",
    });
  } catch {
    throw new ProviderError("failed");
  }
  if (!response.ok || !response.body) {
    // тялото на грешката не се чете и не се препраща – може да съдържа
    // подробности за акаунта
    await response.body?.cancel().catch(() => {});
    const overloaded = [429, 503, 529].includes(response.status);
    throw new ProviderError(
      overloaded ? "overloaded" : "failed",
      response.status,
    );
  }
  return readDeltas(response.body, config.provider);
}

async function* readDeltas(
  body: ReadableStream<Uint8Array>,
  provider: ProviderId,
): AsyncGenerator<string, void, void> {
  const parser = createDeltaParser(provider);
  const decoder = new TextDecoder();
  const reader = body.getReader();
  try {
    while (!parser.done) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const text of parser.push(decoder.decode(value, { stream: true }))) {
        yield text;
      }
      if (parser.failed) throw new ProviderError("failed");
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}
