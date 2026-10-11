import { describe, expect, it } from "vitest";
import {
  EXCERPT_BUDGET,
  buildSynonymIndex,
  cleanChunkText,
  currentChapterChunks,
  highlightTerms,
  makeExcerpt,
  rankChunks,
  relatedChapters,
  selectWithinBudget,
  splitBlocks,
  splitChapter,
  stem,
  suggestQuestions,
  tokenize,
  type Chunk,
} from "@/lib/ai/retrieval";
import { FIXTURE_GLOSSARY, FIXTURE_SOURCES } from "./fixtures";

const synonyms = buildSynonymIndex(FIXTURE_GLOSSARY);
const chunks = FIXTURE_SOURCES.flatMap(splitChapter);
const ask = (question: string, options = {}) =>
  rankChunks(question, chunks, { synonyms, ...options });
const where = (chunk: Chunk | undefined) =>
  chunk
    ? `${chunk.chapterSlug}/${chunk.mode}/${chunk.sectionId}/${chunk.subsectionTitle ?? "-"}`
    : "нищо";

describe("рязане на главата на парчета", () => {
  const easy = splitChapter(FIXTURE_SOURCES[0]!);

  it("всяка секция и подсекция е отделно парче със заглавията си", () => {
    expect(
      easy.map((c) => `${c.sectionTitle} / ${c.subsectionTitle ?? "-"}`),
    ).toEqual([
      "Загадка / -",
      "Виж / -",
      "Разбери / Какво са разрезните усилия",
      "Разбери / Метод на сечението",
      "Разбери / Знаци",
      "Решен пример / -",
      "В реалния живот / -",
      "Провери се / -",
      "Запомни / -",
    ]);
  });

  it("парчето носи главата, режима и постоянния id на секцията", () => {
    expect(easy[3]).toMatchObject({
      moduleSlug: "sm",
      chapterSlug: "razrezni-usiliya",
      chapterNumber: 1,
      chapterTitle: "Разрезни усилия в греди",
      mode: "easy",
      sectionId: "razberi",
    });
    expect(easy[3]!.text).toContain("се нарича **метод на сечението**");
    expect(easy[3]!.text).not.toContain("###");
  });

  it("„## “ в блок с код не започва нова секция; непозната секция няма id", () => {
    const parts = splitChapter({
      ...FIXTURE_SOURCES[0]!,
      body: "Увод.\n\n## Моя секция\n\n```\n## не е заглавие\n```\n\nТекст.",
    });
    expect(parts.map((c) => [c.sectionTitle, c.sectionId])).toEqual([
      ["Въведение", null],
      ["Моя секция", null],
    ]);
    expect(parts[1]!.text).toContain("## не е заглавие");
  });
});

describe("основи на думите", () => {
  it("различните форми на една дума съвпадат", () => {
    for (const forms of [
      ["напрежение", "напрежения", "напреженията", "напрежението"],
      ["греда", "греди", "гредата", "гредите"],
      ["момент", "моментът", "момента", "моменти", "моментите"],
      ["ос", "оси", "оста", "осите"],
      ["знак", "знакът", "знаци", "знаците"],
      ["сечение", "сечението", "сечения"],
    ]) {
      expect(new Set(forms.map(stem)).size, forms.join("/")).toBe(1);
    }
  });

  it("служебните думи, числата и препинателните знаци отпадат", () => {
    expect(tokenize("Какво е това, и защо на 30 kN?!")).toEqual([]);
    expect(tokenize("„Гредата“ – (сила).")).toEqual(["гред", "сил"]);
  });
});

describe("въпроси на студенти → правилното място в учебника", () => {
  const cases: [string, string][] = [
    [
      "Какво е съпротивителен момент?",
      "spetsialno-ogavane/easy/razberi/Най-голямото напрежение",
    ],
    ["Какво е W?", "spetsialno-ogavane/easy/razberi/Най-голямото напрежение"],
    [
      "какво е секционен модул",
      "spetsialno-ogavane/easy/razberi/Най-голямото напрежение",
    ],
    [
      "Как се намира тежището на сечение?",
      "inertsionni-momenti/easy/razberi/Център на тежестта",
    ],
    [
      "Какво гласи теоремата на Щайнер?",
      "inertsionni-momenti/easy/razberi/Теорема на Щайнер",
    ],
    [
      "Какво е метод на сечението?",
      "razrezni-usiliya/easy/razberi/Метод на сечението",
    ],
    ["Защо армировката на балкона е горе?", "razrezni-usiliya/easy/zhivot/-"],
    [
      "какъв е знакът на огъващия момент",
      "razrezni-usiliya/easy/razberi/Знаци",
    ],
    [
      "Покажи ми пример с проста греда и сила 30 kN",
      "razrezni-usiliya/easy/primer/-",
    ],
    [
      "обясни формулата на Навие",
      "spetsialno-ogavane/easy/razberi/Формулата на Навие",
    ],
    [
      "как се смята инерционен момент на правоъгълник",
      "inertsionni-momenti/easy/razberi/Инерционен момент",
    ],
    ["какво е конзола", "razrezni-usiliya/easy/zhivot/-"],
    ["Какво са главни оси?", "inertsionni-momenti/detailed/razberi/Главни оси"],
    [
      "връзката между Q и M",
      "razrezni-usiliya/easy/razberi/Какво са разрезните усилия",
    ],
  ];
  it.each(cases)("%s", (question, expected) => {
    expect(where(ask(question)[0])).toBe(expected);
  });

  it("наклонените форми намират същото като основната", () => {
    const top = (question: string) => where(ask(question)[0]);
    expect(top("съпротивителния момент")).toBe(top("съпротивителен момент"));
    expect(top("съпротивителните моменти")).toBe(top("съпротивителен момент"));
    expect(top("теорема щайнер")).toBe(top("теоремата на Щайнер"));
  });

  it("въпрос извън учебника не връща нищо", () => {
    expect(ask("Какво е изкълчване?")).toEqual([]);
    expect(ask("Колко е часът в Токио?")).toEqual([]);
    expect(ask("Каква е формулата на Ойлер за провисването?")).toEqual([]);
    expect(ask("?!")).toEqual([]);
  });

  it("излишна дума във въпроса не пречи", () => {
    expect(where(ask("ей какво беше съпротивителен момент бе")[0])).toContain(
      "spetsialno-ogavane",
    );
  });

  it("въпросите от „Провери се“ не се предлагат като отговор", () => {
    for (const question of [
      "Къде напрежението при огъване е нула?",
      "Кога една ос е главна?",
    ]) {
      expect(ask(question).map((c) => c.sectionId)).not.toContain("proveri");
    }
  });
});

describe("предпочитания", () => {
  it("главата, която се чете, излиза първа при равни други условия", () => {
    const base = chunks.find(
      (c) => c.subsectionTitle === "Метод на сечението",
    )!;
    const twin: Chunk = { ...base, chapterSlug: "druga", chapterNumber: 9 };
    const ranked = (current: string) =>
      rankChunks("метод на сечението", [base, twin, ...chunks.slice(8)], {
        synonyms,
        current: { module: "sm", chapter: current },
      });
    expect(ranked("druga")[0]!.chapterSlug).toBe("druga");
    expect(ranked("razrezni-usiliya")[0]!.chapterSlug).toBe("razrezni-usiliya");
  });

  it("въпрос с числа или „пример“ предпочита „Решен пример“, а „какво е“ – „Разбери“", () => {
    expect(ask("пример със съпротивителен момент")[0]!.sectionId).toBe(
      "primer",
    );
    expect(ask("какво е съпротивителен момент")[0]!.sectionId).toBe("razberi");
  });

  it("от една глава остава само единият режим – този на потребителя", () => {
    for (const preferredMode of ["easy", "detailed"] as const) {
      const ranked = ask("съпротивителен момент", { preferredMode });
      const fromBending = ranked.filter(
        (c) => c.chapterSlug === "spetsialno-ogavane",
      );
      expect(fromBending.length).toBeGreaterThan(0);
      expect(new Set(fromBending.map((c) => c.mode))).toEqual(
        new Set([preferredMode]),
      );
    }
  });

  it("ако темата я има само в другия режим, показва се той", () => {
    const ranked = ask("главни оси", { preferredMode: "easy" });
    expect(ranked[0]).toMatchObject({
      mode: "detailed",
      subsectionTitle: "Главни оси",
    });
  });

  it("предишните въпроси помагат на кратък следващ въпрос", () => {
    expect(ask("а защо?")).toEqual([]);
    const ranked = ask("а защо?", {
      history: ["Какво е съпротивителен момент?"],
    });
    expect(ranked[0]!.chapterSlug).toBe("spetsialno-ogavane");
  });
});

describe("бюджет от знаци", () => {
  it("по подразбиране е 12 000 знака и се спазва", () => {
    expect(EXCERPT_BUDGET).toBe(12_000);
    const all = chunks.map((chunk) => ({ ...chunk, score: 1 }));
    for (const budget of [300, 900, 2500]) {
      const picked = selectWithinBudget(all, { budget, maxChunks: 99 });
      expect(picked.length).toBeGreaterThan(0);
      const size = picked.reduce((sum, c) => sum + c.text.length, 0);
      expect(size).toBeLessThanOrEqual(budget);
    }
  });

  it("твърде дълго първо парче се скъсява, вместо да се изпусне", () => {
    const long = {
      ...chunks[0]!,
      text: Array(50).fill("Абзац с текст.").join("\n\n"),
      score: 5,
    };
    const picked = selectWithinBudget([long], { budget: 200 });
    expect(picked).toHaveLength(1);
    expect(picked[0]!.text.length).toBeLessThanOrEqual(200);
  });

  it("не връща повече парчета от позволеното", () => {
    const all = chunks.map((chunk) => ({ ...chunk, score: 1 }));
    expect(selectWithinBudget(all, { maxChunks: 3 })).toHaveLength(3);
  });

  it("парчетата от текущата глава са първи", () => {
    const ranked = ask("съпротивителен момент инерционен момент");
    const current = { module: "sm", chapter: "inertsionni-momenti" };
    const picked = selectWithinBudget(ranked, { current });
    const slugs = picked.map((c) => c.chapterSlug);
    expect(new Set(slugs).size).toBeGreaterThan(1);
    const firstOther = slugs.findIndex((s) => s !== current.chapter);
    expect(slugs.slice(firstOther)).not.toContain(current.chapter);
    expect(slugs[0]).toBe(current.chapter);
  });

  it("без съвпадение може да се вземе началото на текущата глава", () => {
    const start = currentChapterChunks(
      chunks,
      { module: "sm", chapter: "razrezni-usiliya" },
      "detailed",
    );
    expect(start[0]).toMatchObject({ mode: "detailed", sectionId: "zagadka" });
    expect(start.map((c) => c.sectionId)).not.toContain("proveri");
  });
});

describe("откъси за показване", () => {
  it("отговорите на въпросите се махат, въпросът остава", () => {
    const quiz = chunks.find(
      (c) => c.sectionId === "proveri" && c.chapterSlug === "razrezni-usiliya",
    )!;
    const cleaned = cleanChunkText(quiz.text);
    expect(cleaned).toContain("Какъв знак има напречната сила");
    expect(cleaned).not.toContain("answer");
    expect(cleaned).not.toContain("Положителен");
    expect(cleaned.match(/^:{3,}/gm)).toEqual(["::::", "::::"]);
  });

  it("фигурите се заменят с бележка", () => {
    const see = chunks.find((c) => c.sectionId === "vizh")!;
    const cleaned = cleanChunkText(see.text);
    expect(cleaned).not.toContain("figure:");
    expect(cleaned).toContain("(виж фигурата в главата)");
  });

  it("абзаците не режат формула, каре или код", () => {
    const blocks = splitBlocks(
      "Първи.\n\n$$\na = b\n\n+ c\n$$\n\n:::why\nЗащо.\n\nОще.\n:::\n\n```\nкод\n\nкод\n```\n\nПоследен.",
    );
    expect(blocks).toEqual([
      "Първи.",
      "$$\na = b\n\n+ c\n$$",
      ":::why\nЗащо.\n\nОще.\n:::",
      "```\nкод\n\nкод\n```",
      "Последен.",
    ]);
  });

  it("дългата секция се скъсява на границата на абзац и започва от определението", () => {
    const text = [
      "Увод без връзка с въпроса. ".repeat(6).trim(),
      "Числото $W$ се нарича **съпротивителен момент**.",
      "$$\nW_x = \\frac{I_x}{y_{max}}\n$$",
      ":::why\nКолкото е по-голям, толкова по-добре.\n:::",
      "Още един дълъг абзац. ".repeat(20).trim(),
    ].join("\n\n");
    const excerpt = makeExcerpt(
      text,
      "Какво е съпротивителен момент?",
      synonyms,
      200,
    );
    expect(excerpt.startsWith("Числото $W$ се нарича")).toBe(true);
    expect(excerpt).toContain("$$\nW_x = \\frac{I_x}{y_{max}}\n$$");
    expect(excerpt).toContain(
      ":::why\nКолкото е по-голям, толкова по-добре.\n:::",
    );
    expect(excerpt).not.toContain("Още един дълъг абзац");
    // нито една формула или каре не е останало отворено
    expect(excerpt.split("$$").length % 2).toBe(1);
  });

  it("списъкът върви с изречението, което го въвежда", () => {
    const base = chunks.find(
      (c) => c.subsectionTitle === "Какво са разрезните усилия",
    )!;
    const excerpt = makeExcerpt(
      base.text,
      "какво е напречна сила",
      synonyms,
      300,
    );
    expect(excerpt).toContain("В равнинна задача те са три:");
    expect(excerpt).toContain("**Напречна сила** $Q$");
  });

  it("кратка секция остава цяла", () => {
    const base = chunks.find((c) => c.subsectionTitle === "Теорема на Щайнер")!;
    expect(makeExcerpt(base.text, "теорема на Щайнер", synonyms)).toBe(
      base.text,
    );
  });
});

describe("свързани глави, когато няма откъс", () => {
  const chapters = FIXTURE_SOURCES.filter((source) => source.mode === "easy");

  it("по заглавие и резюме, най-близката първа", () => {
    expect(
      relatedChapters("огъване на мост", chapters, synonyms).map(
        (c) => c.number,
      ),
    ).toEqual([4, 1]);
    expect(
      relatedChapters("инерционни моменти", chapters, synonyms)[0]!.number,
    ).toBe(2);
  });

  it("нищо общо – празен списък", () => {
    expect(relatedChapters("времето в Токио", chapters, synonyms)).toEqual([]);
  });
});

describe("случайна обща дума не е отговор", () => {
  it("една всекидневна дума или поздрав не връща нищо", () => {
    for (const question of [
      "пример",
      "стъпка",
      "Здравей!",
      "благодаря",
      "Благодаря ти много",
      "ок",
    ]) {
      expect(ask(question), question).toEqual([]);
    }
  });

  it("една обикновена дума от текста не стига, когато останалото го няма", () => {
    // „балкон“ и „линийка“ ги има в главите, но не са понятия
    expect(ask("Колко струва един балкон?")).toEqual([]);
    expect(ask("Къде се продава линийка?")).toEqual([]);
    expect(ask("Кой спечели футболното първенство?")).toEqual([]);
  });

  it("име, което учебникът не познава, обезсилва и намерен термин", () => {
    expect(ask("Какъв е инерционният момент на Токио?")).toEqual([]);
    expect(
      where(ask("Какъв е инерционният момент на правоъгълник?")[0]),
    ).toContain("inertsionni-momenti");
  });

  it("непозната дума с малка буква (правописна грешка) не пречи на термина", () => {
    expect(where(ask("какво е съпротивителен момент накратичко")[0])).toContain(
      "spetsialno-ogavane",
    );
  });

  it("въпрос от една дума намира подсекцията, в чието заглавие е", () => {
    expect(where(ask("Щайнер")[0])).toBe(
      "inertsionni-momenti/easy/razberi/Теорема на Щайнер",
    );
    expect(where(ask("навие")[0])).toBe(
      "spetsialno-ogavane/easy/razberi/Формулата на Навие",
    );
  });

  it("всички думи на въпроса заедно стигат и без термин", () => {
    expect(where(ask("Защо армировката на балкона е горе?")[0])).toBe(
      "razrezni-usiliya/easy/zhivot/-",
    );
  });
});

describe("коя глава излиза първа", () => {
  const twin = (moduleSlug: string, chapterSlug: string, title: string) =>
    splitChapter({
      moduleSlug,
      chapterSlug,
      number: 1,
      title,
      summary: "",
      mode: "easy",
      body: "## Разбери\n\n### Триене\n\n**Триенето** пречи на плъзгането на тялото.",
    });
  // в учебник от две парчета всяка дума е „навсякъде“ – трябват и други
  const filler = ["Първо", "Второ", "Трето", "Четвърто"].flatMap((name, i) =>
    splitChapter({
      moduleSlug: "z",
      chapterSlug: `filler-${i}`,
      number: 9,
      title: name,
      summary: "",
      mode: "easy",
      body: `## Разбери\n\n### ${name}\n\nТекст за нещо съвсем различно номер ${i}.`,
    }),
  );

  it("глава, чието заглавие е за същото, е пред глава, която го споменава", () => {
    const both = [
      ...twin("a", "obshti", "Общи понятия"),
      ...twin("a", "triene", "Триене при плъзгане"),
      ...filler,
    ];
    expect(rankChunks("триене", both)[0]!.chapterSlug).toBe("triene");
  });

  it("на страница на глава другите глави от същия модул са пред чуждите", () => {
    const both = [
      ...twin("a", "edno", "Първа"),
      ...twin("b", "dve", "Втора"),
      ...twin("b", "tri", "Трета"),
      ...filler,
      ...filler.map((chunk) => ({ ...chunk, chapterSlug: "oshte" })),
    ];
    const ranked = rankChunks("триене", both, {
      current: { module: "b", chapter: "tri" },
    });
    expect(ranked.map((chunk) => chunk.chapterSlug)).toEqual([
      "tri",
      "dve",
      "edno",
    ]);
  });

  it("подсекция със заглавие точно по въпроса е пред по-дълго заглавие", () => {
    const parts = splitChapter({
      moduleSlug: "a",
      chapterSlug: "sili",
      number: 1,
      title: "Сили",
      summary: "",
      mode: "easy",
      body: [
        "## Разбери",
        "### Главен вектор на инерционните сили",
        "**Главният вектор** на инерционните сили е сборът им. Главният вектор се смята така.",
        "### Главен вектор",
        "**Главният вектор** е сборът на силите.",
      ].join("\n\n"),
    });
    expect(
      rankChunks("Какво е главен вектор?", [...parts, ...filler])[0]!
        .subsectionTitle,
    ).toBe("Главен вектор");
  });
});

describe("думи за оцветяване в откъса", () => {
  const excerpt =
    "Числото $W_x = I_x / y_{max}$ се нарича **съпротивителен момент**. Колкото по-голям е съпротивителният момент, толкова по-малко е напрежението. Моментът $M$ е даден.";

  it("връща изразите така, както са написани, най-дългите първи", () => {
    expect(
      highlightTerms(excerpt, "Какво е съпротивителен момент?", synonyms),
    ).toEqual(["съпротивителният момент", "съпротивителен момент"]);
  });

  it("синоним от речника оцветява термина в текста", () => {
    expect(
      highlightTerms(
        "Оста минава през **центъра на тежестта** на сечението.",
        "къде е тежището",
        synonyms,
      ),
    ).toEqual(["центъра на тежестта"]);
  });

  it("формулите и служебните думи не се пипат; без въпрос – нищо", () => {
    expect(highlightTerms("Силата $момент$ и `момент`.", "момент")).toEqual([]);
    expect(highlightTerms(excerpt, "какво е това?", synonyms)).toEqual([]);
    for (const term of highlightTerms(excerpt, "W x напрежението", synonyms)) {
      expect(term).not.toMatch(/[$_\\*]/);
    }
  });
});

describe("предложени въпроси", () => {
  const all = suggestQuestions(chunks, { limit: 20 }).map((s) => s.question);

  it("правят се от подсекциите, чието заглавие е въведен термин", () => {
    const fromBeams = suggestQuestions(chunks, {
      current: { module: "sm", chapter: "razrezni-usiliya" },
      limit: 2,
    });
    expect(fromBeams.map((s) => s.question).sort()).toEqual([
      "Какво означава „метод на сечението“?",
      "Какво са разрезните усилия?",
    ]);
    expect(all).toContain("Какво означава „теорема на Щайнер“?");
    // „Знаци“ и „Най-голямото напрежение“ не въвеждат термин със същото име
    expect(all.join(" ")).not.toMatch(/знаци|най-голямото/i);
  });

  it("първи са от главата, която се чете, после по един от другите", () => {
    const picked = suggestQuestions(chunks, {
      current: { module: "sm", chapter: "inertsionni-momenti" },
      limit: 4,
    });
    expect(picked.map((s) => s.chapterSlug)).toEqual([
      "inertsionni-momenti",
      "inertsionni-momenti",
      "razrezni-usiliya",
      "spetsialno-ogavane",
    ]);
    expect(new Set(picked.map((s) => s.question)).size).toBe(4);
  });

  it("всеки предложен въпрос има отговор в главата си", () => {
    expect(all.length).toBeGreaterThanOrEqual(5);
    for (const item of suggestQuestions(chunks, { limit: 20 })) {
      expect(ask(item.question)[0]?.chapterSlug, item.question).toBe(
        item.chapterSlug,
      );
    }
    for (let seed = 0; seed < 5; seed++) {
      for (const item of suggestQuestions(chunks, { limit: 3, seed })) {
        expect(ask(item.question).length, item.question).toBeGreaterThan(0);
      }
    }
  });

  it("без глави няма какво да се предложи", () => {
    expect(suggestQuestions([])).toEqual([]);
  });
});
