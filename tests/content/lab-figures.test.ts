import { describe, expect, it } from "vitest";
import {
  bucklingShape,
  renderBucklingCurveFigure,
  renderBucklingModeFigure,
} from "@/lib/content/buckling-figure";
import { renderDeflectionFigure } from "@/lib/content/deflection-figure";
import { findSvgProblem } from "@/lib/content/svg";
import type { BucklingSupport } from "@/lib/engineering/buckling";
import type { CurveCase } from "@/lib/engineering/deflection-curve";

const supports: BucklingSupport[] = [
  "fixed-free",
  "pinned-pinned",
  "fixed-pinned",
  "fixed-fixed",
];

describe("фигура с еластичната линия", () => {
  it("дървената греда 10×20, l = 4 m, q = 4 kN/m: надписано е f = 18,18 mm", () => {
    const svg = renderDeflectionFigure({
      title: "Проста греда",
      scheme: "simple-distributed",
      l: 4,
      load: 4,
      EI: 733.3333333,
    });
    expect(svg).toContain(">f = 18,18 mm<");
    expect(svg).toContain(">q = 4 kN/m<");
    expect(svg).toContain(">l = 4 m<");
    expect(svg).toContain('aria-label="Проста греда"');
    expect(findSvgProblem(svg)).toBeNull();
  });

  it("конзола IPE 200, l = 2 m, F = 10 kN: f = 6,54 mm в свободния край", () => {
    const svg = renderDeflectionFigure({
      title: "Конзола",
      scheme: "cantilever-force",
      l: 2,
      load: 10,
      EI: 4080.3,
    });
    expect(svg).toContain(">f = 6,54 mm<");
    expect(svg).toContain(">F = 10 kN<");
    // върхът на еластичната линия е в десния край: x = 430, 66 px под оста
    expect(svg).toMatch(/<circle cx="430" cy="184"/);
  });

  it("проста греда: линията започва и свършва на оста, върхът е в средата", () => {
    const svg = renderDeflectionFigure({
      title: "П",
      scheme: "simple-force-mid",
      l: 3,
      load: 6,
      EI: 300.37,
    });
    const points = /<polyline points="([^"]+)"/.exec(svg)![1]!.split(" ");
    expect(points[0]).toBe("50,118");
    expect(points.at(-1)).toBe("430,118");
    expect(points[30]).toBe("240,184");
    expect(svg).toMatch(/<circle cx="240" cy="184"/);
  });

  const schemes: CurveCase[] = [
    "cantilever-force",
    "cantilever-distributed",
    "simple-force-mid",
    "simple-distributed",
  ];
  it.each(schemes)("%s: безопасен SVG без NaN – и без товар", (scheme) => {
    for (const load of [0, 0.01, 10000]) {
      const svg = renderDeflectionFigure({
        title: 'опит <с> "кавички"',
        scheme,
        l: 0.1,
        load,
        EI: 0.0001,
      });
      expect(svg).not.toMatch(/NaN|Infinity/);
      expect(svg).toContain('aria-label="опит с кавички"');
      expect(findSvgProblem(svg)).toBeNull();
    }
    expect(
      renderDeflectionFigure({ title: "0", scheme, l: 2, load: 0, EI: 100 }),
    ).toContain(">f = 0 mm<");
  });
});

describe("форми на изкълчване", () => {
  it.each(supports)("%s: формата е между 0 и 1 и достига 1", (support) => {
    let peak = 0;
    for (let k = 0; k <= 400; k++) {
      const w = bucklingShape(support, k / 400);
      expect(w).toBeGreaterThanOrEqual(-1e-9);
      expect(w).toBeLessThanOrEqual(1 + 1e-9);
      peak = Math.max(peak, w);
    }
    expect(peak).toBeCloseTo(1, 3);
  });

  it("граничните условия на всеки случай", () => {
    // долният край не се измества никъде
    for (const support of supports) {
      expect(bucklingShape(support, 0)).toBeCloseTo(0, 9);
    }
    // свободният край се измества най-много; останалите горни краища стоят
    expect(bucklingShape("fixed-free", 1)).toBeCloseTo(1, 9);
    expect(bucklingShape("pinned-pinned", 1)).toBeCloseTo(0, 9);
    expect(bucklingShape("fixed-pinned", 1)).toBeCloseTo(0, 9);
    expect(bucklingShape("fixed-fixed", 1)).toBeCloseTo(0, 9);
    // запъване: допирателната е вертикална (нулев наклон)
    const slope = (support: BucklingSupport, xi: number) =>
      (bucklingShape(support, xi + 1e-6) - bucklingShape(support, xi - 1e-6)) /
      2e-6;
    expect(slope("fixed-free", 1e-6)).toBeCloseTo(0, 4);
    expect(slope("fixed-pinned", 1e-6)).toBeCloseTo(0, 4);
    expect(slope("fixed-fixed", 1e-6)).toBeCloseTo(0, 4);
    expect(slope("fixed-fixed", 1 - 1e-6)).toBeCloseTo(0, 4);
    // шарнир: наклонът не е нула
    expect(Math.abs(slope("pinned-pinned", 1e-6))).toBeGreaterThan(1);
  });

  it("шарнир–шарнир: връх в средата; запъване–шарнир: връх на 0,6 от запъването", () => {
    expect(bucklingShape("pinned-pinned", 0.5)).toBeCloseTo(1, 9);
    expect(bucklingShape("fixed-fixed", 0.5)).toBeCloseTo(1, 9);
    // k·s = arccos(sin k / k) = 1,790 → s = 0,398 от шарнира → ξ = 0,602
    expect(bucklingShape("fixed-pinned", 0.602)).toBeCloseTo(1, 4);
  });

  it.each(supports)("%s: схемата е безопасен SVG с надпис", (support) => {
    const svg = renderBucklingModeFigure(support, "Схема на пръта");
    expect(svg).toContain('aria-label="Схема на пръта"');
    expect(svg).toContain("<polyline");
    expect(svg).not.toMatch(/NaN|Infinity/);
    expect(findSvgProblem(svg)).toBeNull();
  });
});

describe("крива σ_cr(λ)", () => {
  it("прът с λ = 150: кръг и надпис σ_cr = 92,1 MPa; λ_гр = 101,8", () => {
    const svg = renderBucklingCurveFigure({
      title: "Крива",
      E: 21000,
      sigmaP: 200,
      lambda: 150,
    });
    expect(svg).toContain(">λ_гр = 101,8<");
    expect(svg).toContain(">σ_p = 200 MPa<");
    expect(svg).toContain(">прътът: λ = 150; σ_cr = 92,1 MPa<");
    expect(svg.match(/<circle/g)).toHaveLength(1);
    expect(findSvgProblem(svg)).toBeNull();
  });

  it("прът с λ = 75: кръстче и „Ойлер не важи“, без стойност на σ_cr", () => {
    const svg = renderBucklingCurveFigure({
      title: "Крива",
      E: 21000,
      sigmaP: 200,
      lambda: 75,
    });
    expect(svg).toContain(">прътът: λ = 75 – Ойлер не важи<");
    expect(svg).not.toContain("σ_cr = ");
    expect(svg).not.toContain("<circle");
  });

  it("крайни стойности: без NaN и без точки извън чертежа", () => {
    for (const spec of [
      { E: 1, sigmaP: 2000, lambda: 0.02 },
      { E: 100000, sigmaP: 1, lambda: 400000 },
      { E: 21000, sigmaP: 200, lambda: 101.80 },
    ]) {
      const svg = renderBucklingCurveFigure({ title: "К", ...spec });
      expect(svg).not.toMatch(/NaN|Infinity/);
      expect(findSvgProblem(svg)).toBeNull();
      for (const match of svg.matchAll(/(?:cx|x1|x2)="(-?[\d.]+)"/g)) {
        const x = Number(match[1]);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(480);
      }
    }
  });
});
