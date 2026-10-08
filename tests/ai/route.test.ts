// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiConfig } from "@/lib/ai/config";
import type { AssistantJson } from "@/lib/ai/modes";
import { FIXTURE_GLOSSARY, FIXTURE_SOURCES } from "./fixtures";

// Маршрутът /api/assistant с подменени вход, база и AI услуга. Истинска
// заявка към външна услуга не тръгва – fetch е заместен.

const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  hasAccess: true,
  config: null as unknown,
  allowed: true,
  used: 0,
  consumed: 0,
  usageReads: 0,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => state.user,
}));
vi.mock("@/lib/ai/config", () => ({
  getAiConfig: () => state.config,
}));
vi.mock("@/lib/ai/glossary", async () => {
  const { buildSynonymIndex } = await import("@/lib/ai/retrieval");
  return { getSynonyms: () => buildSynonymIndex(FIXTURE_GLOSSARY) };
});
vi.mock("@/lib/ai/load", () => ({
  loadSavedReaderMode: async () => "easy",
  loadReadableContent: async () => {
    const sources = state.hasAccess ? FIXTURE_SOURCES : [];
    return {
      sources,
      chapters: sources.filter((source) => source.mode === "easy"),
    };
  },
}));
vi.mock("@/lib/ai/usage", async (original) => ({
  ...(await original<typeof import("@/lib/ai/usage")>()),
  allowAssistantRequest: async () => state.allowed,
  getAiUsedToday: async () => {
    state.usageReads += 1;
    return state.used;
  },
  consumeAiRequest: async (_user: string, limit: number) => {
    if (state.used >= limit) return { allowed: false, used: state.used };
    state.used += 1;
    state.consumed += 1;
    return { allowed: true, used: state.used };
  },
}));

const { POST } = await import("@/app/api/assistant/route");

const GROQ: AiConfig = {
  provider: "openai-compatible",
  apiKey: "gsk-secret-key",
  apiUrl: "https://ai.example/v1/chat/completions",
  model: "test-model",
  providerName: "Groq",
  dailyLimit: 3,
};
const ANTHROPIC: AiConfig = {
  provider: "anthropic",
  apiKey: "sk-ant-secret-key",
  apiUrl: "https://api.anthropic.com/v1/messages",
  model: "claude-haiku-4-5-20251001",
  providerName: "Anthropic",
  dailyLimit: 3,
};

const encoder = new TextEncoder();
const openAiSse = (...parts: string[]) =>
  [
    ...parts.map(
      (content) =>
        `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
    ),
    "data: [DONE]\n\n",
  ].join("");
const anthropicSse = (...parts: string[]) =>
  [
    ...parts.map(
      (text) =>
        `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text } })}\n\n`,
    ),
    'event: message_stop\ndata: {"type":"message_stop"}\n\n',
  ].join("");

const fetchMock = vi.fn<typeof fetch>();
const upstream = (body: string, status = 200) =>
  fetchMock.mockImplementation(
    async () => new Response(encoder.encode(body), { status }),
  );

function ask(body: unknown) {
  return POST(
    new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

type Sent = {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};
function sent(call = 0): Sent {
  const [url, init] = fetchMock.mock.calls[call]!;
  return {
    url: String(url),
    headers: init!.headers as Record<string, string>,
    body: JSON.parse(String(init!.body)),
  };
}

beforeEach(() => {
  Object.assign(state, {
    user: { id: `user-${Math.random()}` },
    hasAccess: true,
    config: null,
    allowed: true,
    used: 0,
    consumed: 0,
    usageReads: 0,
  });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("проверки преди всичко друго", () => {
  it("без вход – 401", async () => {
    state.user = null;
    const response = await ask({ question: "Какво е Q?" });
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("");
  });

  it("невалидни данни – 400", async () => {
    for (const body of [
      "не е json",
      {},
      { question: "" },
      { question: "   " },
      { question: "а".repeat(1501) },
      { question: "ок", mode: "hack" },
      { question: "ок", extra: 1 },
      { question: "ок", context: { module: "../x", chapter: "a" } },
      { question: "ок", context: { module: "a", chapter: "b", extra: 1 } },
      { question: "ок", history: [{ role: "system", content: "x" }] },
      {
        question: "ок",
        history: [{ role: "user", content: "а".repeat(2001) }],
      },
      {
        question: "ок",
        history: Array(7).fill({ role: "user", content: "x" }),
      },
    ]) {
      const response = await ask(body);
      expect(response.status, JSON.stringify(body).slice(0, 60)).toBe(400);
      expect(await response.json()).toEqual({ error: "Невалидни данни." });
    }
  });

  it("твърде голяма заявка – 413", async () => {
    const response = await ask({ question: "ок", junk: "x".repeat(40_000) });
    expect(response.status).toBe(413);
  });

  it("повече от позволените заявки в минута – 429", async () => {
    state.allowed = false;
    const response = await ask({ question: "Какво е Q?" });
    expect(response.status).toBe(429);
    expect((await response.json()).error).toContain("Твърде много въпроси");
  });
});

describe("само уроците (без ключ за AI услуга)", () => {
  it("връща до три откъса с глава, секция и връзка към мястото", async () => {
    const response = await ask({ question: "Какво е съпротивителен момент?" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as AssistantJson;
    if (body.kind !== "lessons") throw new Error("очаквах откъси");
    expect(body.noAccess).toBe(false);
    expect(body.related).toEqual([]);
    expect(body.excerpts.length).toBeGreaterThan(0);
    expect(body.excerpts.length).toBeLessThanOrEqual(3);
    expect(body.excerpts[0]).toMatchObject({
      chapterNumber: 4,
      chapterTitle: "Специално огъване: нормални напрежения",
      sectionTitle: "Разбери",
      subsectionTitle: "Най-голямото напрежение",
      href: "/learn/sm/spetsialno-ogavane?mode=easy#razberi",
    });
    expect(body.excerpts[0]!.markdown).toContain("**съпротивителен момент**");
  });

  it("не вика AI услуга и не пипа дневния брояч", async () => {
    await ask({ question: "Какво е съпротивителен момент?" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.usageReads).toBe(0);
    expect(state.consumed).toBe(0);
  });

  it("режимът на четене идва от страницата, на която е потребителят", async () => {
    const response = await ask({
      question: "съпротивителен момент",
      context: {
        module: "sm",
        chapter: "spetsialno-ogavane",
        mode: "detailed",
      },
    });
    const body = (await response.json()) as AssistantJson;
    if (body.kind !== "lessons") throw new Error("очаквах откъси");
    expect(body.excerpts[0]!.href).toBe(
      "/learn/sm/spetsialno-ogavane?mode=detailed#razberi",
    );
  });

  it("отговорите от „Провери се“ и фигурите не излизат в откъсите", async () => {
    for (const question of [
      "Къде напрежението при огъване е нула?",
      "диаграмите",
    ]) {
      const body = (await (await ask({ question })).json()) as AssistantJson;
      if (body.kind !== "lessons") throw new Error("очаквах откъси");
      const text = JSON.stringify(body);
      expect(text).not.toContain(":::answer");
      expect(text).not.toContain("figure:");
    }
  });

  it("нищо по въпроса – празен списък и най-близките глави", async () => {
    const response = await ask({ question: "Какво е изкълчване при огъване?" });
    expect(await response.json()).toEqual({
      kind: "lessons",
      excerpts: [],
      noAccess: false,
      related: [
        {
          number: 4,
          title: "Специално огъване: нормални напрежения",
          href: "/learn/sm/spetsialno-ogavane",
        },
        {
          number: 1,
          title: "Разрезни усилия в греди",
          href: "/learn/sm/razrezni-usiliya",
        },
      ],
    });
  });

  it("потребител без достъп не получава никакво съдържание", async () => {
    state.hasAccess = false;
    const response = await ask({ question: "Какво е съпротивителен момент?" });
    expect(await response.json()).toEqual({
      kind: "lessons",
      excerpts: [],
      related: [],
      noAccess: true,
    });
  });
});

describe("с AI услуга", () => {
  beforeEach(() => {
    state.config = GROQ;
  });

  it("openai-compatible: праща правилата и откъсите, връща само текста", async () => {
    upstream(openAiSse("Това е ", "отговорът.\n\nИзточник: Глава 4"));
    const response = await ask({
      question: "Какво е съпротивителен момент?",
      mode: "socratic",
      history: [
        { role: "user", content: "Здравей" },
        { role: "assistant", content: "Здравей!" },
      ],
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-assistant-remaining")).toBe("2");
    expect(await response.text()).toBe(
      "Това е отговорът.\n\nИзточник: Глава 4",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = sent();
    expect(request.url).toBe(GROQ.apiUrl);
    expect(request.headers.authorization).toBe("Bearer gsk-secret-key");
    expect(request.body).toMatchObject({
      model: "test-model",
      stream: true,
      max_tokens: 900,
    });
    const messages = request.body.messages as {
      role: string;
      content: string;
    }[];
    expect(messages.map((m) => m.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(messages[3]!.content).toBe("Какво е съпротивителен момент?");
    const system = messages[0]!.content;
    expect(system).toContain("САМО по откъсите");
    expect(system).toContain("ЕДИН насочващ въпрос");
    expect(system).toContain('<excerpt chapter="4"');
    expect(system).toContain("се нарича **съпротивителен момент**");
    expect(system).not.toContain(":::answer");
    expect(state.consumed).toBe(1);
  });

  it("anthropic: x-api-key и system като отделно поле", async () => {
    state.config = ANTHROPIC;
    upstream(anthropicSse("Отговор ", "от модела."));
    const response = await ask({ question: "Какво е метод на сечението?" });
    expect(await response.text()).toBe("Отговор от модела.");
    const request = sent();
    expect(request.url).toBe(ANTHROPIC.apiUrl);
    expect(request.headers["x-api-key"]).toBe("sk-ant-secret-key");
    expect(request.headers["anthropic-version"]).toBe("2023-06-01");
    expect(request.body.system).toContain("метод на сечението");
    expect(request.body.messages).toEqual([
      { role: "user", content: "Какво е метод на сечението?" },
    ]);
  });

  it("откъсите се побират в бюджета от 12 000 знака", async () => {
    upstream(openAiSse("ок"));
    await (
      await ask({ question: "момент сила греда сечение напрежение" })
    ).text();
    const system = (sent().body.messages as { content: string }[])[0]!.content;
    const excerpts = system.slice(
      system.indexOf("<excerpts>"),
      system.indexOf("</excerpts>"),
    );
    expect(excerpts.length).toBeGreaterThan(500);
    expect(excerpts.length).toBeLessThan(12_000 + 8 * 200);
  });

  it("главата, която се чете, е първа в откъсите", async () => {
    upstream(openAiSse("ок"));
    await (
      await ask({
        question: "инерционен момент и съпротивителен момент",
        context: { module: "sm", chapter: "inertsionni-momenti" },
      })
    ).text();
    const system = (sent().body.messages as { content: string }[])[0]!.content;
    expect(system.match(/<excerpt chapter="(\d+)"/)![1]).toBe("2");
  });

  it("потребител без достъп: вежлив отказ, без модел и без брояч", async () => {
    state.hasAccess = false;
    const response = await ask({ question: "Какво е съпротивителен момент?" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      kind: "message",
      text: "В момента нямаш достъп до учебника, затова няма в какво да търся.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.consumed).toBe(0);
  });

  it("въпрос извън учебника: без модел и без брояч", async () => {
    const response = await ask({ question: "Колко е часът в Токио?" });
    expect(((await response.json()) as { text: string }).text).toContain(
      "Не намерих това в учебника",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.consumed).toBe(0);
  });

  it("„обясни това“ на страница на глава праща началото на главата", async () => {
    upstream(openAiSse("ок"));
    await (
      await ask({
        question: "Не разбирам?",
        context: { module: "sm", chapter: "razrezni-usiliya" },
      })
    ).text();
    const system = (sent().body.messages as { content: string }[])[0]!.content;
    expect(system).toContain('<excerpt chapter="1"');
    expect(system).toContain("Сложи линийка между две книги");
  });

  it("стигнат дневен лимит – 429, услугата не се вика", async () => {
    state.used = 3;
    const response = await ask({ question: "Какво е съпротивителен момент?" });
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe(
      "Стигна дневния лимит от 3 въпроса към асистента. Утре пак ще можеш да питаш.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("лимитът се изчерпва точно след третия въпрос", async () => {
    upstream(openAiSse("ок"));
    const left: (string | null)[] = [];
    for (let i = 0; i < 3; i++) {
      const response = await ask({
        question: "Какво е съпротивителен момент?",
      });
      left.push(response.headers.get("x-assistant-remaining"));
      await response.text();
    }
    expect(left).toEqual(["2", "1", "0"]);
    expect(
      (await ask({ question: "Какво е съпротивителен момент?" })).status,
    ).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([429, 503, 529])(
    "услугата връща %i: „претоварена“, а въпросът не се брои",
    async (status) => {
      upstream(
        '{"error":{"message":"Rate limit for key gsk-secret-key"}}',
        status,
      );
      const response = await ask({
        question: "Какво е съпротивителен момент?",
      });
      expect(response.status).toBe(503);
      const text = await response.text();
      expect(JSON.parse(text)).toEqual({
        error: "AI услугата е претоварена, опитай след малко.",
      });
      expect(text).not.toMatch(/gsk-secret-key|Rate limit/);
      expect(state.consumed).toBe(0);
      expect(state.used).toBe(0);
    },
  );

  it("друга грешка от услугата: общо съобщение, без подробности и без брояч", async () => {
    upstream('{"error":{"message":"Invalid API key gsk-secret-key"}}', 401);
    const response = await ask({ question: "Какво е съпротивителен момент?" });
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(JSON.parse(text).error).toContain("не успя да отговори");
    expect(text).not.toMatch(/gsk-secret-key|Invalid/);
    expect(state.consumed).toBe(0);
    // и в лога няма ключ, въпрос или отговор на услугата
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toMatch(/gsk-secret-key|Invalid|съпротивителен/);
  });

  it("мрежова грешка: общо съобщение и без брояч", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const response = await ask({ question: "Какво е съпротивителен момент?" });
    expect(response.status).toBe(502);
    expect(state.consumed).toBe(0);
  });

  it("празен отговор от модела става подкана да опиташ пак", async () => {
    for (const body of [openAiSse(), openAiSse("", "  \n")]) {
      upstream(body);
      const response = await ask({
        question: "Какво е съпротивителен момент?",
      });
      expect(await response.text()).toContain(
        "Асистентът не върна отговор. Опитай пак",
      );
    }
  });

  it("прекъснат отговор завършва с бележка", async () => {
    upstream(
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Начало" } }] })}\n\ndata: {"error":{"message":"таен текст"}}\n\n`,
    );
    const text = await (
      await ask({ question: "Какво е съпротивителен момент?" })
    ).text();
    expect(text).toBe("Начало\n\n*(Отговорът прекъсна. Опитай пак.)*");
  });

  it("един въпрос наведнъж: вторият се отказва, докато първият тече", async () => {
    let finish!: () => void;
    fetchMock.mockImplementation(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoder.encode(openAiSse("Първи")));
              finish = () => controller.close();
            },
          }),
        ),
    );
    const first = await ask({ question: "Какво е съпротивителен момент?" });
    expect(first.status).toBe(200);

    const second = await ask({ question: "Какво е метод на сечението?" });
    expect(second.status).toBe(429);
    expect((await second.json()).error).toContain("Изчакай предишният отговор");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.consumed).toBe(1);

    finish();
    expect(await first.text()).toBe("Първи");
    upstream(openAiSse("Трети"));
    const third = await ask({ question: "Какво е метод на сечението?" });
    expect(await third.text()).toBe("Трети");
  });

  it("след отказ от услугата следващият въпрос не е блокиран", async () => {
    upstream("{}", 429);
    expect(
      (await ask({ question: "Какво е съпротивителен момент?" })).status,
    ).toBe(503);
    upstream(openAiSse("ок"));
    const response = await ask({ question: "Какво е съпротивителен момент?" });
    expect(await response.text()).toBe("ок");
  });
});
