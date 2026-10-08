import { describe, expect, it } from "vitest";
import {
  circleModulus,
  extremeStresses,
  momentCapacity,
  navierStress,
  rectangleForModulus,
  rectangleModulus,
  requiredSectionModulus,
} from "@/lib/engineering/bending";
import { maxMoment, type Beam } from "@/lib/engineering/beam";
import { sectionProperties, type Rect } from "@/lib/engineering/section";

// Всички очаквани стойности са сметнати на ръка и са записани в коментара над теста.

describe("формула на Навие", () => {
  it("σ = M·y/I: M = 10 kN·m, I = 6666,67 cm⁴, y = 10 cm → 1,5 kN/cm²", () => {
    // 10 kN·m = 1000 kN·cm; 1000·10 / 6666,67 = 1,5
    expect(navierStress(10, 20000 / 3, 10)).toBeCloseTo(1.5, 12);
  });

  it("на неутралната ос напрежението е нула; над нея знакът се сменя", () => {
    expect(navierStress(10, 500, 0)).toBe(0);
    expect(navierStress(10, 500, -4)).toBeCloseTo(
      -navierStress(10, 500, 4),
      12,
    );
  });

  it("отказва неположителен инерционен момент", () => {
    expect(() => navierStress(10, 0, 1)).toThrow();
  });
});

describe("дървена греда 10×20 cm, проста греда 4 m с q = 4 kN/m (пример в „Леко“)", () => {
  const beam: Beam = {
    length: 4,
    supports: { type: "simple", xA: 0, xB: 4 },
    loads: [{ type: "distributed", x1: 0, x2: 4, value: 4 }],
  };
  const upright: Rect[] = [{ b: 10, h: 20, x: 0, y: 0 }];
  const flat: Rect[] = [{ b: 20, h: 10, x: 0, y: 0 }];

  it("M_max = q·l²/8 = 4·16/8 = 8 kN·m в средата", () => {
    const peak = maxMoment(beam);
    expect(peak.M).toBeCloseTo(8, 9);
    expect(peak.x).toBeCloseTo(2, 9);
  });

  it("изправена: W = 10·20²/6 = 666,67 cm³; σ = 800/666,67 = 1,2 kN/cm² = 12 MPa", () => {
    const props = sectionProperties(upright);
    expect(rectangleModulus(10, 20)).toBeCloseTo(666.6667, 3);
    expect(props.WxBottom).toBeCloseTo(rectangleModulus(10, 20), 9);
    const s = extremeStresses(8, props);
    expect(s.bottom).toBeCloseTo(1.2, 12);
    expect(s.top).toBeCloseTo(-1.2, 12);
    expect(s.maxTension).toBeCloseTo(1.2, 12);
    expect(s.maxCompression).toBeCloseTo(1.2, 12);
  });

  it("легнала: W = 20·10²/6 = 333,33 cm³; σ = 2,4 kN/cm² = 24 MPa – точно двойно", () => {
    const s = extremeStresses(8, sectionProperties(flat));
    expect(rectangleModulus(20, 10)).toBeCloseTo(333.3333, 3);
    expect(s.bottom).toBeCloseTo(2.4, 12);
  });
});

describe("сечение „Т“ 2×10 + 12×2 cm (контролният пример от Глава 2), M = 4 kN·m", () => {
  // стебло 2×10 долу, пояс 12×2 горе; y_c = 8,27 cm; I_x = 567,39 cm⁴
  const tee: Rect[] = [
    { b: 2, h: 10, x: 5, y: 0 },
    { b: 12, h: 2, x: 0, y: 10 },
  ];
  const props = sectionProperties(tee);
  const s = extremeStresses(4, props);

  it("крайните влакна са на 8,27 cm (долу) и 3,73 cm (горе) от неутралната ос", () => {
    expect(props.yBottom.toFixed(2)).toBe("8.27");
    expect(props.yTop.toFixed(2)).toBe("3.73");
    expect(props.Ix.toFixed(2)).toBe("567.39");
  });

  it("σ_долу = 400·8,27/567,39 = 5,83 kN/cm² (опън)", () => {
    expect(s.bottom.toFixed(2)).toBe("5.83");
  });

  it("σ_горе = −400·3,73/567,39 = −2,63 kN/cm² (натиск)", () => {
    expect(s.top.toFixed(2)).toBe("-2.63");
  });

  it("съпротивителните моменти са 68,59 cm³ (долу) и 152,23 cm³ (горе)", () => {
    expect(props.WxBottom.toFixed(2)).toBe("68.59");
    expect(props.WxTop.toFixed(2)).toBe("152.23");
  });

  it("при отрицателен момент опънът минава горе", () => {
    const reversed = extremeStresses(-4, props);
    expect(reversed.top).toBeCloseTo(-s.top, 12);
    expect(reversed.maxTension.toFixed(2)).toBe("2.63");
    expect(reversed.maxCompression.toFixed(2)).toBe("5.83");
  });
});

describe("оразмеряване", () => {
  it("W ≥ M/σ: M = 40 kN·m, σ_доп = 16 kN/cm² → 250 cm³", () => {
    // 4000 kN·cm / 16 = 250
    expect(requiredSectionModulus(40, 16)).toBeCloseTo(250, 12);
    expect(requiredSectionModulus(-40, 16)).toBeCloseTo(250, 12);
  });

  it("IPE 220 (W = 252 cm³) стига, IPE 200 (W = 194 cm³) не стига", () => {
    const need = requiredSectionModulus(40, 16);
    expect(252).toBeGreaterThanOrEqual(need);
    expect(194).toBeLessThan(need);
    // действително напрежение в IPE 220: 4000/252 = 15,87 kN/cm²
    expect((4000 / 252).toFixed(2)).toBe("15.87");
  });

  it("допустим момент: W = 252 cm³, σ_доп = 16 kN/cm² → 40,32 kN·m", () => {
    expect(momentCapacity(252, 16)).toBeCloseTo(40.32, 12);
  });

  it("дървена греда: M = 12 kN·m, σ_доп = 1 kN/cm², h = 2b → b = 12,16 cm, h = 24,33 cm", () => {
    // W = 1200 cm³; h = ∛(6·2·1200) = ∛14400 = 24,33; b = 12,16
    const W = requiredSectionModulus(12, 1);
    expect(W).toBeCloseTo(1200, 12);
    const size = rectangleForModulus(W, 2);
    expect(size.h.toFixed(2)).toBe("24.33");
    expect(size.b.toFixed(2)).toBe("12.16");
    expect(rectangleModulus(size.b, size.h)).toBeCloseTo(1200, 9);
  });

  it("закръглено нагоре на 13×26 cm: W = 1464,67 cm³, σ = 0,82 kN/cm²", () => {
    expect(rectangleModulus(13, 26).toFixed(2)).toBe("1464.67");
    expect((1200 / rectangleModulus(13, 26)).toFixed(2)).toBe("0.82");
  });

  it("проста греда 5 m с q = 12,8 kN/m: M_max = 12,8·25/8 = 40 kN·m", () => {
    const peak = maxMoment({
      length: 5,
      supports: { type: "simple", xA: 0, xB: 5 },
      loads: [{ type: "distributed", x1: 0, x2: 5, value: 12.8 }],
    });
    expect(peak.M).toBeCloseTo(40, 9);
  });

  it("отказва неположителни входни данни", () => {
    expect(() => requiredSectionModulus(10, 0)).toThrow();
    expect(() => rectangleForModulus(0, 2)).toThrow();
    expect(() => rectangleForModulus(100, 0)).toThrow();
  });
});

describe("защо двойно Т", () => {
  // IPE 200 по сортамента: A = 28,5 cm², W = 194 cm³.
  it("плътен квадрат със същата площ 28,5 cm² има W = 25,36 cm³ – 7,7 пъти по-малко", () => {
    const a = Math.sqrt(28.5); // 5,34 cm
    expect(a.toFixed(2)).toBe("5.34");
    const W = rectangleModulus(a, a);
    expect(W.toFixed(2)).toBe("25.36");
    expect((194 / W).toFixed(1)).toBe("7.7");
  });

  it("кръг с диаметър 10 cm: W = π·1000/32 = 98,17 cm³", () => {
    expect(circleModulus(10).toFixed(2)).toBe("98.17");
  });

  it("W/A: кръг d/8, правоъгълник h/6, IPE 200 – 0,34·h", () => {
    expect(circleModulus(10) / ((Math.PI * 100) / 4)).toBeCloseTo(10 / 8, 12);
    expect(rectangleModulus(10, 20) / 200).toBeCloseTo(20 / 6, 12);
    expect((194 / 28.5 / 20).toFixed(2)).toBe("0.34");
  });
});

describe("въпроси от „Провери се“", () => {
  it("правоъгълник 6×12 cm, M = 3 kN·m: W = 144 cm³, σ = 2,08 kN/cm²", () => {
    expect(rectangleModulus(6, 12)).toBe(144);
    expect((300 / 144).toFixed(2)).toBe("2.08");
  });

  it("кръг d = 10 cm, M = 9 kN·m: σ = 900/98,17 = 9,17 kN/cm²", () => {
    expect((900 / circleModulus(10)).toFixed(2)).toBe("9.17");
  });

  it("правоъгълник 10×20, влакно на 5 cm под оста при M = 8 kN·m: 0,6 kN/cm²", () => {
    expect(navierStress(8, (10 * 20 ** 3) / 12, 5)).toBeCloseTo(0.6, 12);
  });

  it("отношението на напреженията в „Т“ е 8,27/3,73 = 2,22", () => {
    const props = sectionProperties([
      { b: 2, h: 10, x: 5, y: 0 },
      { b: 12, h: 2, x: 0, y: 10 },
    ]);
    expect((props.yBottom / props.yTop).toFixed(2)).toBe("2.22");
  });
});
