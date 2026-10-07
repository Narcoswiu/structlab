import { describe, expect, it } from "vitest";
import { figureNumber, renderBeamFigure } from "@/lib/content/beam-figure";
import { extractSectionTitles, sectionIdForTitle } from "@/lib/content/sections";
import { findSvgProblem, isSafeSvg } from "@/lib/content/svg";
import { verifyChapterBody, verifySameSections } from "@/lib/content/verify";
import type { Beam } from "@/lib/engineering/beam";

const SEVEN = [
  "Загадка",
  "Виж",
  "Разбери",
  "Решен пример",
  "В реалния живот",
  "Провери се",
  "Запомни",
];
const body = (extra = "") =>
  SEVEN.map((title) => `## ${title}\n\nТекст.\n`).join("\n") + extra;

describe("секции на глава", () => {
  it("всяка от седемте стъпки има постоянен id", () => {
    expect(SEVEN.map(sectionIdForTitle)).toEqual([
      "zagadka",
      "vizh",
      "razberi",
      "primer",
      "zhivot",
      "proveri",
      "zapomni",
    ]);
    expect(sectionIdForTitle("Нещо друго")).toBeUndefined();
  });

  it("намира само заглавията от второ ниво и пропуска тези в код", () => {
    const md = "# Глава\n## Загадка\n### Под\n```\n## не е секция\n```\n## Виж\n";
    expect(extractSectionTitles(md)).toEqual(["Загадка", "Виж"]);
  });
});

describe("проверка на съдържанието", () => {
  const glossary = [
    { preferred: "напрежение", avoid: ["стрес"] },
    { preferred: "коравина", avoid: ["твърдост"] },
  ];

  it("правилен текст няма забележки", () => {
    expect(verifyChapterBody(body(), glossary, [])).toEqual([]);
  });

  it("липсваща или разместена секция е грешка", () => {
    const missing = body().replace("## Провери се\n\nТекст.\n", "");
    expect(verifyChapterBody(missing, glossary, [])[0]?.level).toBe("error");
  });

  it("забранен синоним е грешка, но не и като част от друга дума", () => {
    const bad = verifyChapterBody(body("\nТова е стрес.\n"), glossary, []);
    expect(bad.some((p) => p.message.includes("стрес"))).toBe(true);
    const fine = verifyChapterBody(body("\nВ пастрес няма нищо.\n"), glossary, []);
    expect(fine).toEqual([]);
  });

  it("десетична точка е предупреждение – в текста и във формулите", () => {
    const inText = verifyChapterBody(body("\nДължина 5.4 m.\n"), glossary, []);
    expect(inText).toEqual([expect.objectContaining({ level: "warning" })]);
    const inMath = verifyChapterBody(body("\n$M = 43.2$\n"), glossary, []);
    expect(inMath).toEqual([expect.objectContaining({ level: "warning" })]);
    expect(verifyChapterBody(body("\n$M = 43{,}2$ и 5,4 m.\n"), glossary, [])).toEqual([]);
  });

  it("препратка към несъществуваща фигура е грешка", () => {
    const md = body("\n![Схема](figure:greda)\n");
    expect(verifyChapterBody(md, glossary, ["greda"])).toEqual([]);
    expect(verifyChapterBody(md, glossary, [])[0]?.message).toContain("greda");
  });

  it("„Леко“ и „Подробно“ трябва да имат еднакви секции", () => {
    expect(verifySameSections(body(), body())).toEqual([]);
    expect(verifySameSections(body(), "## Загадка\n")).toHaveLength(1);
  });
});

describe("безопасност на SVG фигурите", () => {
  const ok = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><line x1="0" y1="0" x2="5" y2="5" stroke="var(--fig-ink)"/></svg>';

  it("приема обикновена фигура", () => {
    expect(findSvgProblem(ok)).toBeNull();
  });

  it.each([
    ["скрипт", ok.replace("<line", "<script>alert(1)</script><line")],
    ["обработчик на събитие", ok.replace("<line", '<line onload="x()"')],
    ["външна връзка", ok.replace("<line", '<a href="https://x.test"><line')],
    ["foreignObject", ok.replace("<line", "<foreignObject></foreignObject><line")],
    ["външно изображение", ok.replace("<line", '<image href="x.png"/><line')],
    ["url() в стил", ok.replace('stroke="var(--fig-ink)"', 'style="fill:url(#x)"')],
    ["не е svg", "<div>текст</div>"],
    ["текст след края", ok + "<p>още</p>"],
  ])("отхвърля %s", (_name, svg) => {
    expect(isSafeSvg(svg)).toBe(false);
  });
});

describe("диаграми, начертани от изчисленията", () => {
  const beam: Beam = {
    length: 6,
    supports: { type: "simple", xA: 0, xB: 6 },
    loads: [{ type: "force", x: 2.4, value: 30 }],
  };
  const svg = renderBeamFigure(beam, { title: "Проста греда" });

  it("числата са с десетична запетая и без излишни нули", () => {
    expect(figureNumber(43.2)).toBe("43,2");
    expect(figureNumber(18)).toBe("18");
    expect(figureNumber(-12)).toBe("−12");
    expect(figureNumber(-0.0001)).toBe("0");
    expect(figureNumber(7.875)).toBe("7,88");
  });

  it("фигурата показва реакциите и екстремните стойности от решението", () => {
    expect(svg).toContain("A = 18 kN");
    expect(svg).toContain("B = 12 kN");
    expect(svg).toContain(">43,2<");
    expect(svg).toContain(">−12<");
    expect(svg).toContain("F = 30 kN");
  });

  it("минава собствената ни проверка за безопасност", () => {
    expect(findSvgProblem(svg)).toBeNull();
  });

  it("положителният момент е начертан под оста (опънати долни нишки)", () => {
    const only = renderBeamFigure(beam, { title: "M", parts: ["M"] });
    const axisY = Number(/<line x1="70" y1="([\d.]+)"/.exec(only)![1]);
    const peak = /<circle cx="[\d.]+" cy="([\d.]+)"/.exec(only)!;
    expect(Number(peak[1])).toBeGreaterThan(axisY);
  });

  it("при конзола показва реактивния момент", () => {
    const cantilever = renderBeamFigure(
      {
        length: 3,
        supports: { type: "cantilever", fixedAt: "left" },
        loads: [
          { type: "distributed", x1: 0, x2: 3, value: 8 },
          { type: "force", x: 3, value: 10 },
        ],
      },
      { title: "Конзола" },
    );
    expect(cantilever).toContain("A = 34 kN");
    expect(cantilever).toContain("</tspan> = −66 kN·m");
    expect(findSvgProblem(cantilever)).toBeNull();
  });
});
