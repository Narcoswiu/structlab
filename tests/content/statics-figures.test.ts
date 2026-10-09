import { describe, expect, it } from "vitest";
import { renderReactionsFigure } from "@/lib/content/reactions-figure";
import { findSvgProblem } from "@/lib/content/svg";
import { renderTrussFigure } from "@/lib/content/truss-figure";
import {
  reactionsPresets,
  solveReactions,
  type ReactionsInput,
} from "@/lib/labs/reactions";
import {
  defaultTrussInput,
  solveTrussLab,
  trussKinds,
  trussPresets,
  type TrussInput,
} from "@/lib/labs/truss";

// Числата във фигурите идват от същите решения, които се проверяват в
// tests/labs/reactions.test.ts и tests/labs/truss.test.ts.

function reactionsSvg(input: ReactionsInput, title = "Греда") {
  const solution = solveReactions(input);
  if (!solution.ok) throw new Error(solution.problem);
  return renderReactionsFigure({ title, ...input, reactions: solution });
}

function trussSvg(input: TrussInput, title = "Ферма") {
  const solution = solveTrussLab(input);
  if (!solution.ok) throw new Error(solution.problem);
  return renderTrussFigure({
    title,
    joints: solution.truss.joints,
    members: solution.truss.members.map((member, index) => ({
      ...member,
      force: solution.rows[index]!.force,
    })),
    supports: solution.truss.supports,
    loads: solution.truss.loads,
    reactions: solution.reactions,
  });
}

/** Всички координати по x във фигурата са в рамките на чертежа. */
function expectInside(svg: string, width: number) {
  for (const match of svg.matchAll(/\s(?:cx|x|x1|x2)="(-?[\d.]+)"/g)) {
    const x = Number(match[1]);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(width);
  }
}

const reactionsPreset = (label: string) =>
  reactionsPresets.find((item) => item.label === label)!.input;
const trussPreset = (label: string) =>
  trussPresets.find((item) => item.label === label)!.input;

describe("греда като свободно тяло", () => {
  it("гредата с конзолен край: товарите и големините на реакциите са надписани", () => {
    const svg = reactionsSvg(reactionsPreset("Греда 8 m с конзолен край"));
    expect(svg).toContain(">q = 6 kN/m<");
    expect(svg).toContain(">M = 12 kN·m<");
    expect(svg).toContain(">F = 20 kN; 60°<");
    expect(svg).toContain("</tspan> = 8,23 kN<");
    expect(svg).toContain("</tspan> = 10 kN<");
    expect(svg).toContain("</tspan> = 33,09 kN<");
    expect(svg).toContain(">l = 8 m<");
    expect(svg).toContain(">реакциите са начертани в действителните си посоки<");
    expect(svg).toContain('aria-label="Греда"');
    expect(findSvgProblem(svg)).toBeNull();
  });

  it("реакция надолу: стрелката сочи надолу, числото е големината без минус", () => {
    // опори при 0 и 4 m, сила 10 kN при 6 m → A_v = −5 kN, B_v = 15 kN
    const svg = reactionsSvg({
      scheme: "pin-roller",
      l: 6,
      xA: 0,
      xB: 4,
      loads: [{ kind: "vertical", F: 10, x: 6 }],
    });
    expect(svg).toContain("</tspan> = 5 kN<");
    expect(svg).not.toContain("−5");
    // A е при x = 60: върхът на стрелката е долу (y = 244), а не при опората
    expect(svg).toContain('<polygon points="60,244 ');
    // B е при x = 60 + 280·4/6 = 246,7: върхът е горе, при опората (y = 202)
    expect(svg).toContain('<polygon points="246.7,202 ');
  });

  it("A_h наляво и надясно: върхът на стрелката се обръща", () => {
    const right = reactionsSvg(reactionsPreset("Греда 8 m с конзолен край"));
    const left = reactionsSvg(reactionsPreset("Сила 30 kN под 45°"));
    // стрелката е между x = 4 и x = 42, вляво от опората A (x = 60)
    expect(right).toContain('<polygon points="42,175 ');
    expect(left).toContain('<polygon points="4,175 ');
    expect(left).toContain("</tspan> = 21,21 kN<");
  });

  it("конзолата: запъване, A_v, M_A и свободният край K", () => {
    const svg = reactionsSvg(reactionsPreset("Конзола: q и сила"));
    expect(svg).toContain("</tspan> = 23 kN<");
    expect(svg).toContain("</tspan> = 46,5 kN·m<");
    // няма хоризонтален товар: A_h = 0 е написано, но стрелка няма
    expect(svg).toContain("</tspan> = 0<");
    expect(svg).toContain(">K<");
    expect(svg).not.toContain(">B<");
  });

  it("нулевите реакции нямат стрелки", () => {
    const svg = reactionsSvg({
      scheme: "pin-roller",
      l: 4,
      xA: 0,
      xB: 4,
      loads: [],
    });
    expect(svg.match(/<polygon/g)).toHaveLength(2); // само двете опори
    expect(svg.match(/<\/tspan> = 0</g)).toHaveLength(3);
  });

  it("всеки пример и крайни случаи: безопасен SVG, без NaN, всичко е в чертежа", () => {
    const extra: ReactionsInput[] = [
      {
        scheme: "pin-roller",
        l: 100,
        xA: 99.9,
        xB: 100,
        loads: [
          { kind: "inclined", F: 10000, angle: 0, direction: "up-left", x: 0 },
          { kind: "inclined", F: 0.01, angle: 90, direction: "up-right", x: 100 },
          { kind: "couple", M: -10000, x: 100 },
          { kind: "triangular", q: 10000, zeroAt: 100, peakAt: 0 },
          { kind: "uniform", q: 0, from: 0, to: 0.01 },
        ],
      },
      {
        scheme: "fixed",
        l: 0.5,
        xA: 0,
        xB: 0.5,
        loads: [
          { kind: "vertical", F: 3, x: 0 },
          { kind: "vertical", F: 3, x: 0 },
          { kind: "vertical", F: 3, x: 0 },
          { kind: "couple", M: 5, x: 0 },
          { kind: "inclined", F: 3, angle: 10, direction: "down-left", x: 0 },
        ],
      },
    ];
    for (const input of [
      ...reactionsPresets.map((item) => item.input),
      ...extra,
    ]) {
      const svg = reactionsSvg(input, 'опит <с> "кавички"');
      expect(svg).not.toMatch(/NaN|Infinity/);
      expect(svg).toContain('aria-label="опит с кавички"');
      expect(findSvgProblem(svg)).toBeNull();
      expectInside(svg, 400);
    }
  });

  it("надписите на товари в една точка не се застъпват", () => {
    const svg = reactionsSvg({
      scheme: "pin-roller",
      l: 6,
      xA: 0,
      xB: 6,
      loads: [
        { kind: "vertical", F: 10, x: 3 },
        { kind: "vertical", F: 20, x: 3 },
        { kind: "couple", M: 5, x: 3 },
      ],
    });
    const ys = [...svg.matchAll(/y="([\d.]+)"[^>]*>(?:F|M) = /g)].map((match) =>
      Number(match[1]),
    );
    expect(ys).toHaveLength(3);
    expect(new Set(ys).size).toBe(3);
  });
});

describe("чертеж на ферма", () => {
  it("изпитната ферма: всеки прът носи усилието си, нулевите са с 0", () => {
    const svg = trussSvg(trussPreset("Изпитна ферма: 40, 20 и 12 kN"));
    for (const value of ["39", "18", "−24", "−45", "−30", "−20", "−5", "30"]) {
      expect(svg).toContain(`>${value}<`);
    }
    expect(svg.match(/>0</g)).toHaveLength(2); // CF и EH
    for (const letter of "ACDEBFGH") expect(svg).toContain(`>${letter}<`);
    expect(svg).toContain(">40 kN<");
    expect(svg).toContain(">20 kN<");
    expect(svg).toContain(">12 kN<");
    expect(svg).toContain("</tspan> = 36 kN<");
    expect(svg).toContain("</tspan> = 24 kN<");
    expect(svg).toContain("</tspan> = 12 kN<");
    expect(findSvgProblem(svg)).toBeNull();
  });

  it("опън и натиск се различават по вида на линията, не само по цвят", () => {
    const svg = trussSvg(trussPreset("Изпитна ферма: 40, 20 и 12 kN"));
    // 5 опънати пръта – плътни; 6 натиснати – пунктир; 2 нулеви – ситен пунктир.
    // Всеки прът е от две части (линията е прекъсната около надписа).
    const lines = svg.match(/<line [^>]*stroke-linecap="butt"\/>/g) ?? [];
    const dashed = lines.filter((line) => line.includes('stroke-dasharray="7 4"'));
    const dotted = lines.filter((line) => line.includes('stroke-dasharray="2 4"'));
    const solid = lines.filter((line) => !line.includes("stroke-dasharray"));
    expect(solid).toHaveLength(10);
    expect(dashed).toHaveLength(12);
    expect(dotted).toHaveLength(4);
    expect(svg).toContain(">плътна линия – опън (+); пунктир – натиск (−)<");
    expect(svg).toContain(">0 – нулев прът; усилията са в kN<");
    expect(svg).toContain(">стрелките са в действителните посоки<");
  });

  it("фермата-мост: товарите висят под долните възли, реакциите са по 30 kN", () => {
    const svg = trussSvg(trussPreset("Ферма-мост: 3 × 20 kN"));
    expect(svg.match(/>20 kN</g)).toHaveLength(3);
    expect(svg.match(/<\/tspan> = 30 kN</g)).toHaveLength(2);
    expect(svg).toContain(">−37,5<");
    expect(svg).toContain(">22,5<");
    expect(svg).toContain(">12,5<");
    // няма хоризонтален товар: A_h = 0
    expect(svg).toContain("</tspan> = 0<");
  });

  it("покривната и триъгълната ферма", () => {
    const roof = trussSvg(trussPreset("Покривна ферма 8 × 3 m"));
    for (const value of ["−35", "−25", "−45", "28", "36", "−10", "−20", "18"]) {
      expect(roof).toContain(`>${value}<`);
    }
    const triangle = trussSvg(trussPreset("Триъгълна ферма 4 × 1,5 m"));
    expect(triangle.match(/>−10</g)).toHaveLength(2);
    expect(triangle).toContain(">8<");
  });

  it("всяка геометрия при крайни размери: безопасен SVG, без NaN, всичко е в чертежа", () => {
    for (const kind of trussKinds) {
      for (const [span, height, horizontal] of [
        [1, 50, -10000],
        [100, 0.1, 10000],
        [12, 4, 0],
      ] as const) {
        const svg = trussSvg(
          { ...defaultTrussInput(kind.id), span, height, horizontal },
          'опит <с> "кавички"',
        );
        expect(svg).not.toMatch(/NaN|Infinity/);
        expect(svg).toContain('aria-label="опит с кавички"');
        expect(findSvgProblem(svg)).toBeNull();
        expectInside(svg, 380);
      }
    }
  });
});
