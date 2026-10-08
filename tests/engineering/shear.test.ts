import { describe, expect, it } from "vitest";
import { sectionProperties, type Rect } from "@/lib/engineering/section";
import {
  maxShearStress,
  rectangleMaxShear,
  shearShare,
  shearStressAt,
  shearStressProfile,
  staticMomentAbove,
  widthAt,
} from "@/lib/engineering/shear";

// Всички очаквани стойности са сметнати на ръка и са записани над теста.

describe("правоъгълник 10×20 cm, Q = 8 kN", () => {
  const rect: Rect[] = [{ b: 10, h: 20, x: 0, y: 0 }];

  it("τ_max = 1,5·Q/A = 1,5·8/200 = 0,06 kN/cm² на неутралната ос", () => {
    const peak = maxShearStress(rect, 8);
    expect(peak.tau).toBeCloseTo(0.06, 12);
    expect(peak.y).toBeCloseTo(10, 12);
    expect(rectangleMaxShear(8, 10, 20)).toBeCloseTo(0.06, 12);
  });

  it("по Журавски: S = 10·10·5 = 500 cm³; I = 6666,67 cm⁴; τ = 8·500/(6666,67·10)", () => {
    expect(staticMomentAbove(rect, 10)).toBeCloseTo(500, 9);
    expect((8 * 500) / (((10 * 20 ** 3) / 12) * 10)).toBeCloseTo(0.06, 12);
  });

  it("парабола: на четвърт височина τ = 0,75·τ_max; на ръбовете е нула", () => {
    expect(shearStressAt(rect, 8, 15)).toBeCloseTo(0.045, 12);
    expect(shearStressAt(rect, 8, 5)).toBeCloseTo(0.045, 12);
    expect(shearStressAt(rect, 8, 20)).toBe(0);
    expect(shearStressAt(rect, 8, 0, "below")).toBe(0);
  });

  it("сборът на напреженията по сечението връща напречната сила", () => {
    expect(shearShare(rect, 0, 20)).toBeCloseTo(1, 5);
  });

  it("знакът на Q не влияе на големината", () => {
    expect(shearStressAt(rect, -8, 10)).toBeCloseTo(0.06, 12);
  });
});

describe("сечение „Т“ 2×10 + 12×2 cm, Q = 10 kN", () => {
  // y_c = 8,27 cm от долния ръб; I_x = 567,39 cm⁴ (Глава 2)
  const tee: Rect[] = [
    { b: 2, h: 10, x: 5, y: 0 },
    { b: 12, h: 2, x: 0, y: 10 },
  ];
  const yc = sectionProperties(tee).yc;

  it("на неутралната ос: S = 2·8,27²/2 = 68,44 cm³; τ = 10·68,44/(567,39·2) = 0,603 kN/cm²", () => {
    expect(Math.abs(staticMomentAbove(tee, yc)).toFixed(2)).toBe("68.44");
    const peak = maxShearStress(tee, 10);
    expect(peak.y).toBeCloseTo(yc, 9);
    expect(peak.tau.toFixed(3)).toBe("0.603");
  });

  it("частта над и частта под едно ниво имат равни по големина статични моменти", () => {
    const below = 2 * yc * (yc / 2); // стеблото под неутралната ос
    expect(staticMomentAbove(tee, yc)).toBeCloseTo(below, 9);
  });

  it("на границата пояс–стебло: S = 24·(11 − 8,27) = 65,45 cm³; скок от 0,577 на 0,096 kN/cm²", () => {
    expect(staticMomentAbove(tee, 10).toFixed(2)).toBe("65.45");
    expect(widthAt(tee, 10, "below")).toBe(2);
    expect(widthAt(tee, 10, "above")).toBe(12);
    expect(shearStressAt(tee, 10, 10, "below").toFixed(3)).toBe("0.577");
    expect(shearStressAt(tee, 10, 10, "above").toFixed(3)).toBe("0.096");
    // отношението е равно на отношението на ширините: 12/2 = 6
    expect(
      shearStressAt(tee, 10, 10, "below") / shearStressAt(tee, 10, 10, "above"),
    ).toBeCloseTo(6, 9);
  });

  it("стеблото поема 87 % от напречната сила", () => {
    expect((shearShare(tee, 0, 10) * 100).toFixed(0)).toBe("87");
    expect(shearShare(tee, 0, 12)).toBeCloseTo(1, 4);
  });

  it("диаграмата е от две части със скок между тях", () => {
    const parts = shearStressProfile(tee, 10, 10);
    expect(parts).toHaveLength(2);
    expect(parts[0]![0]!.tau).toBeCloseTo(0, 9);
    expect(parts[0]!.at(-1)!.tau.toFixed(3)).toBe("0.577");
    expect(parts[1]![0]!.tau.toFixed(3)).toBe("0.096");
    expect(parts[1]!.at(-1)!.tau).toBe(0);
  });
});

describe("сечение „I“: пояси 10×1,2 cm, стебло 0,8×17,6 cm, Q = 60 kN", () => {
  const section: Rect[] = [
    { b: 10, h: 1.2, x: 0, y: 0 },
    { b: 0.8, h: 17.6, x: 4.6, y: 1.2 },
    { b: 10, h: 1.2, x: 0, y: 18.8 },
  ];

  it("I_x = 2·(10·1,2³/12 + 12·9,4²) + 0,8·17,6³/12 = 2486,97 cm⁴; A = 38,08 cm²", () => {
    const props = sectionProperties(section);
    expect(props.Ix.toFixed(2)).toBe("2486.97");
    expect(props.A).toBeCloseTo(38.08, 9);
  });

  it("S на неутралната ос = 12·9,4 + 0,8·8,8·4,4 = 143,78 cm³; τ_max = 4,34 kN/cm²", () => {
    expect(Math.abs(staticMomentAbove(section, 10)).toFixed(2)).toBe("143.78");
    expect(maxShearStress(section, 60).tau.toFixed(2)).toBe("4.34");
  });

  it("в стеблото до пояса: 60·112,8/(2486,97·0,8) = 3,40 kN/cm²; в пояса – 0,27 kN/cm²", () => {
    expect(shearStressAt(section, 60, 18.8, "below").toFixed(2)).toBe("3.40");
    expect(shearStressAt(section, 60, 18.8, "above").toFixed(2)).toBe("0.27");
  });

  it("стеблото поема 94 % от напречната сила; Q/A_стебло = 4,26 kN/cm² е близо до τ_max", () => {
    expect((shearShare(section, 1.2, 18.8) * 100).toFixed(0)).toBe("94");
    expect((60 / (0.8 * 17.6)).toFixed(2)).toBe("4.26");
  });
});

describe("други проверки", () => {
  it("две залепени дъски 10×10 cm, Q = 6 kN: в лепилото τ = 1,5·6/200 = 0,045 kN/cm²", () => {
    const glued: Rect[] = [
      { b: 10, h: 10, x: 0, y: 0 },
      { b: 10, h: 10, x: 0, y: 10 },
    ];
    expect(shearStressAt(glued, 6, 10)).toBeCloseTo(0.045, 12);
  });

  it("въпрос от „Провери се“: правоъгълник 6×12 cm, Q = 12 kN → 0,25 kN/cm²", () => {
    expect(rectangleMaxShear(12, 6, 12)).toBeCloseTo(0.25, 12);
  });

  it("сравнение σ/τ за греда 10×20, l = 4 m, q = 4 kN/m: 1,2 / 0,06 = 20 = l/h", () => {
    expect(1.2 / rectangleMaxShear(8, 10, 20)).toBeCloseTo(20, 9);
  });

  it("сечение с отвор се отказва", () => {
    expect(() =>
      shearStressAt([{ b: 4, h: 4, x: 0, y: 0, hole: true }], 1, 2),
    ).toThrow();
  });
});
