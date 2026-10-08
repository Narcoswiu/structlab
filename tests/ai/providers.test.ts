// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  MAX_OUTPUT_TOKENS,
  ProviderError,
  buildProviderRequest,
  createDeltaParser,
  openProviderStream,
  type ProviderConfig,
  type ProviderId,
} from "@/lib/ai/providers";

const anthropic: ProviderConfig = {
  provider: "anthropic",
  apiKey: "sk-ant-test",
  apiUrl: "https://api.anthropic.com/v1/messages",
  model: "claude-haiku-4-5-20251001",
};
const openai: ProviderConfig = {
  provider: "openai-compatible",
  apiKey: "gsk-test",
  apiUrl: "https://api.groq.com/openai/v1/chat/completions",
  model: "llama-3.3-70b-versatile",
};
const messages = [{ role: "user" as const, content: "Какво е Q?" }];

const ANTHROPIC_SSE = [
  'event: message_start\ndata: {"type":"message_start","message":{"id":"m1"}}\n\n',
  'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
  'event: ping\ndata: {"type":"ping"}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Напречната "}}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"скрито"}}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"сила е $Q$.\\n\\nИзточник: Глава 1"}}\n\n',
  'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
  'event: message_stop\ndata: {"type":"message_stop"}\n\n',
].join("");

const OPENAI_SSE = [
  'data: {"id":"c1","choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}\n\n',
  ": keep-alive\n\n",
  'data: {"id":"c1","choices":[{"index":0,"delta":{"content":"Напречната "}}]}\r\n\r\n',
  'data: {"id":"c1","choices":[{"index":0,"delta":{"content":"сила е $Q$.\\n\\nИзточник: Глава 1"}}]}\n\n',
  'data: {"id":"c1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
  'data: {"id":"c1","choices":[],"usage":{"total_tokens":12}}\n\n',
  "data: [DONE]\n\n",
].join("");

const EXPECTED = "Напречната сила е $Q$.\n\nИзточник: Глава 1";

const cases: [ProviderId, string][] = [
  ["anthropic", ANTHROPIC_SSE],
  ["openai-compatible", OPENAI_SSE],
];

function sseResponse(pieces: Uint8Array[], status = 200) {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const piece of pieces) controller.enqueue(piece);
        controller.close();
      },
    }),
    { status },
  );
}

async function collect(stream: AsyncGenerator<string, void, void>) {
  let text = "";
  for await (const piece of stream) text += piece;
  return text;
}

describe.each(cases)("четене на потока: %s", (provider, sse) => {
  it("връща само текста, в реда му", () => {
    const parser = createDeltaParser(provider);
    expect(parser.push(sse).join("")).toBe(EXPECTED);
    expect(parser.done).toBe(true);
    expect(parser.failed).toBe(false);
  });

  it("потокът може да бъде срязан на всяко място", () => {
    for (let cut = 1; cut < sse.length; cut++) {
      const parser = createDeltaParser(provider);
      const text = [
        ...parser.push(sse.slice(0, cut)),
        ...parser.push(sse.slice(cut)),
      ].join("");
      expect(text, `срез на ${cut}`).toBe(EXPECTED);
    }
  });

  it("и знак по знак дава същото", () => {
    const parser = createDeltaParser(provider);
    let text = "";
    for (const char of sse) text += parser.push(char).join("");
    expect(text).toBe(EXPECTED);
    expect(parser.done).toBe(true);
  });

  it("байт по байт през мрежата – кирилицата не се чупи", async () => {
    const bytes = new TextEncoder().encode(sse);
    const fetchImpl = vi.fn(async () =>
      sseResponse(Array.from(bytes, (byte) => new Uint8Array([byte]))),
    );
    const config = provider === "anthropic" ? anthropic : openai;
    const stream = await openProviderStream(config, "система", messages, {
      fetchImpl,
    });
    expect(await collect(stream)).toBe(EXPECTED);
  });

  it("повредените редове се прескачат, а след края нищо не се чете", () => {
    const parser = createDeltaParser(provider);
    expect(parser.push("data: {не е json\n\ndata: 42\n\n")).toEqual([]);
    expect(parser.push(sse).join("")).toBe(EXPECTED);
    expect(parser.push(sse)).toEqual([]);
  });
});

describe("грешка по средата на отговора", () => {
  it("anthropic: събитие error", async () => {
    const parser = createDeltaParser("anthropic");
    const out = parser.push(
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Начало"}}\n\nevent: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"таен текст"}}\n\n',
    );
    expect(out).toEqual(["Начало"]);
    expect(parser.failed).toBe(true);
  });

  it("openai-compatible: обект error", () => {
    const parser = createDeltaParser("openai-compatible");
    parser.push('data: {"error":{"message":"rate limit","code":429}}\n\n');
    expect(parser.failed).toBe(true);
  });

  it("потокът хвърля ProviderError, след като е върнал полученото", async () => {
    const body = new TextEncoder().encode(
      'data: {"choices":[{"delta":{"content":"Начало"}}]}\n\ndata: {"error":{"message":"таен текст"}}\n\n',
    );
    const stream = await openProviderStream(openai, "с", messages, {
      fetchImpl: async () => sseResponse([body]),
    });
    const got: string[] = [];
    const error = await (async () => {
      try {
        for await (const piece of stream) got.push(piece);
      } catch (caught) {
        return caught;
      }
    })();
    expect(got).toEqual(["Начало"]);
    expect(error).toBeInstanceOf(ProviderError);
    expect(String((error as Error).message)).not.toContain("таен");
  });
});

describe("заявката към услугата", () => {
  it("anthropic: x-api-key, версия и system като отделно поле", () => {
    const request = buildProviderRequest(anthropic, "ПРАВИЛА", messages);
    expect(request.url).toBe("https://api.anthropic.com/v1/messages");
    expect(request.headers).toEqual({
      "content-type": "application/json",
      "x-api-key": "sk-ant-test",
      "anthropic-version": "2023-06-01",
    });
    expect(JSON.parse(request.body)).toEqual({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 900,
      stream: true,
      system: "ПРАВИЛА",
      messages,
    });
  });

  it("openai-compatible: Bearer и системно съобщение първо", () => {
    const request = buildProviderRequest(openai, "ПРАВИЛА", messages);
    expect(request.headers).toEqual({
      "content-type": "application/json",
      authorization: "Bearer gsk-test",
    });
    expect(JSON.parse(request.body)).toEqual({
      model: "llama-3.3-70b-versatile",
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: true,
      messages: [{ role: "system", content: "ПРАВИЛА" }, ...messages],
    });
  });

  it("праща се с POST към зададения адрес", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse([new TextEncoder().encode(OPENAI_SSE)]),
    );
    const signal = new AbortController().signal;
    await openProviderStream(openai, "с", messages, { fetchImpl, signal });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(openai.apiUrl);
    expect(init.method).toBe("POST");
    expect(init.signal).toBe(signal);
  });
});

describe("услугата отказва заявката", () => {
  const refuse = (status: number, config = openai) =>
    openProviderStream(config, "с", messages, {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ error: { message: "ключ gsk-test е невалиден" } }),
          { status },
        ),
    }).catch((error: unknown) => error);

  it.each([429, 503, 529])("%i → „претоварена“", async (status) => {
    for (const config of [openai, anthropic]) {
      const error = await refuse(status, config);
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toMatchObject({ kind: "overloaded", status });
    }
  });

  it.each([400, 401, 404, 500])("%i → обща грешка", async (status) => {
    const error = await refuse(status);
    expect(error).toMatchObject({ kind: "failed", status });
  });

  it("грешката не носи отговора на услугата, нито ключа", async () => {
    const error = (await refuse(401)) as ProviderError;
    expect(JSON.stringify(error) + error.message + error.stack).not.toMatch(
      /gsk-test|невалиден/,
    );
  });

  it("мрежова грешка или прекъсване също е ProviderError", async () => {
    const error = await openProviderStream(openai, "с", messages, {
      fetchImpl: async () => {
        throw new TypeError("fetch failed: gsk-test");
      },
    }).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ kind: "failed" });
    expect((error as Error).message).not.toContain("gsk-test");
  });
});
