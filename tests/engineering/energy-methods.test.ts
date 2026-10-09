import { describe, expect, it } from "vitest";
import type { Beam } from "@/lib/engineering/beam";
import {
  elasticCurve,
  flexuralRigidity,
  rectangleInertia,
  standardDeflection,
} from "@/lib/engineering/deflection";
import {
  axialStrainEnergy,
  bendingStrainEnergy,
  castiglianoDisplacement,
  clapeyronEnergy,
  diagramShape,
  externalWork,
  kNcmToJoule,
  kNmToJoule,
  linearOrdinate,
  maxwellMohrAxial,
  maxwellMohrBending,
  mohrIntegral,
  torsionStrainEnergy,
  trapezoidProduct,
  twoBarForces,
  vereshchagin,
  type DiagramShape,
} from "@/lib/engineering/energy-methods";
import { polarMoment } from "@/lib/engineering/torsion";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над проверката.
// Числата са тези, които се четат в Глава 14 „Енергийни методи. Интеграли на Максвел–Мор“.

/** Дървената греда 10 × 20 cm от Глава 7: E·I = 1100·6666,67/10⁴ = 733,33 kN·m². */
const EI_TIMBER = flexuralRigidity(1100, rectangleInertia(10, 20));
/** Стоманената конзола 4 × 10 cm: E·I = 21000·333,33/10⁴ = 700 kN·m². */
const EI_STEEL = flexuralRigidity(21000, rectangleInertia(4, 10));

/**
 * Независима проверка: ∫ f dx по правилото на средната точка (не по Симпсън,
 * с който работи библиотеката).
 */
function midpoint(
  f: (x: number) => number,
  a: number,
  b: number,
  n = 200000,
): number {
  const h = (b - a) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += f(a + (i + 0.5) * h);
  return sum * h;
}

describe("помощни величини", () => {
  it("коравините: 733,33 kN·m² (дърво 10 × 20) и 700 kN·m² (стомана 4 × 10)", () => {
    // I = 10·20³/12 = 6666,67; 1100·6666,67 = 7 333 333 kN·cm² = 733,33 kN·m²
    expect(EI_TIMBER.toFixed(2)).toBe("733.33");
    // I = 4·10³/12 = 333,33; 21000·333,33 = 7 000 000 kN·cm² = 700 kN·m²
    expect(rectangleInertia(4, 10).toFixed(2)).toBe("333.33");
    expect(EI_STEEL).toBeCloseTo(700, 9);
  });

  it("1 kN·m = 1000 J; 1 kN·cm = 10 J", () => {
    expect(kNmToJoule(0.02)).toBeCloseTo(20, 12);
    expect(kNcmToJoule(2.1)).toBeCloseTo(21, 12);
  });
});

describe("работа и теорема на Клапейрон", () => {
  it("„Леко“, въпрос 1: сила 8 kN, преместване 5 mm → 0,02 kN·m = 20 J", () => {
    // A_e = 8·0,005/2 = 0,02 kN·m
    expect(externalWork(8, 0.005)).toBeCloseTo(0.02, 12);
    expect(kNmToJoule(externalWork(8, 0.005))).toBeCloseTo(20, 9);
  });

  it("U = ½·ΣF·δ за няколко сили", () => {
    // ½·(10·0,02 + 4·0,05) = ½·0,4 = 0,2
    expect(clapeyronEnergy([10, 4], [0.02, 0.05])).toBeCloseTo(0.2, 12);
    expect(() => clapeyronEnergy([1, 2], [1])).toThrow();
    expect(() => clapeyronEnergy([], [])).toThrow();
  });
});

describe("потенциална енергия на деформацията", () => {
  it("„Леко“, въпрос 2: прът l = 200 cm, A = 4 cm², N = 42 kN → 2,1 kN·cm = 21 J", () => {
    // 42² = 1764; 1764·200 = 352 800; 2·21000·4 = 168 000; 352 800/168 000 = 2,1
    const U = axialStrainEnergy(42, 200, 21000, 4);
    expect(U).toBeCloseTo(2.1, 12);
    expect(kNcmToJoule(U)).toBeCloseTo(21, 9);
    // Клапейрон: Δl = 42·200/(21000·4) = 0,1 cm; ½·42·0,1 = 2,1
    const dl = (42 * 200) / (21000 * 4);
    expect(dl).toBeCloseTo(0.1, 12);
    expect(externalWork(42, dl)).toBeCloseTo(U, 12);
    // Кастилияно: ∂U/∂N = N·l/(E·A) = Δl
    expect(
      castiglianoDisplacement((N) => axialStrainEnergy(N, 200, 21000, 4), 42),
    ).toBeCloseTo(dl, 9);
  });

  it("двойна сила – четворна енергия (за енергията няма суперпозиция)", () => {
    const U1 = axialStrainEnergy(42, 200, 21000, 4);
    expect(axialStrainEnergy(84, 200, 21000, 4)).toBeCloseTo(4 * U1, 12);
    // енергията не зависи от знака на силата
    expect(axialStrainEnergy(-42, 200, 21000, 4)).toBeCloseTo(U1, 12);
  });

  it("„Подробно“, въпрос 3: вал d = 6 cm, l = 150 cm, T = 300 kN·cm → 6,55 kN·cm; φ = 0,04366 rad", () => {
    // I_p = π·6⁴/32 = 127,23 cm⁴
    const Ip = polarMoment(6);
    expect(Ip.toFixed(2)).toBe("127.23");
    // U = 300²·150/(2·8100·127,23) = 13 500 000/2 061 126 = 6,55 kN·cm
    const U = torsionStrainEnergy(300, 150, 8100, Ip);
    expect(U.toFixed(2)).toBe("6.55");
    expect(kNcmToJoule(U).toFixed(1)).toBe("65.5");
    // Кастилияно: φ = ∂U/∂T = T·l/(G·I_p) = 45 000/1 030 563 = 0,04366 rad
    const phi = castiglianoDisplacement(
      (T) => torsionStrainEnergy(T, 150, 8100, Ip),
      300,
    );
    expect(phi).toBeCloseTo((300 * 150) / (8100 * Ip), 9);
    expect(phi.toFixed(5)).toBe("0.04366");
    // Клапейрон: ½·300·0,04366 = 6,55
    expect(externalWork(300, phi)).toBeCloseTo(U, 9);
    expect((150 * 0.04366).toFixed(2)).toBe("6.55");
  });

  it("енергия при огъване = F²·l³/(6·E·I) за конзола със сила в края", () => {
    // M(x) = −F·x, x от свободния край; ∫F²x²dx = F²·l³/3
    const U = bendingStrainEnergy((x) => -6 * x, 0, 1.5, EI_STEEL);
    expect(U).toBeCloseTo((36 * 1.5 ** 3) / (6 * 700), 12);
  });
});

describe("площи и центрове на тежестта на типовите диаграми", () => {
  // ординатата като функция на разстоянието s от края с най-голямата ордината
  const shapes: [DiagramShape, (s: number, l: number, h: number) => number][] =
    [
      ["rectangle", (_s, _l, h) => h],
      ["triangle", (s, l, h) => h * (1 - s / l)],
      ["parabola-vertex-at-zero", (s, l, h) => h * (1 - s / l) ** 2],
      ["parabola-vertex-at-peak", (s, l, h) => h * (1 - (s / l) ** 2)],
    ];

  it.each(shapes)(
    "%s: площта и центърът съвпадат с пряко интегриране",
    (shape, y) => {
      const l = 3;
      const h = 7;
      const { area, centroid } = diagramShape(shape, l, h);
      const areaNumeric = midpoint((s) => y(s, l, h), 0, l);
      const momentNumeric = midpoint((s) => s * y(s, l, h), 0, l);
      expect(area).toBeCloseTo(areaNumeric, 6);
      expect(centroid).toBeCloseTo(momentNumeric / areaNumeric, 6);
    },
  );

  it("стойностите от таблицата при l = 2, h = 6", () => {
    expect(diagramShape("rectangle", 2, 6)).toEqual({ area: 12, centroid: 1 });
    // триъгълник: 2·6/2 = 6; l/3 = 0,667
    expect(diagramShape("triangle", 2, 6).area).toBeCloseTo(6, 12);
    expect(diagramShape("triangle", 2, 6).centroid).toBeCloseTo(2 / 3, 12);
    // парабола с връх в нулевия край: 2·6/3 = 4; l/4 = 0,5
    expect(diagramShape("parabola-vertex-at-zero", 2, 6).area).toBeCloseTo(
      4,
      12,
    );
    expect(diagramShape("parabola-vertex-at-zero", 2, 6).centroid).toBeCloseTo(
      0.5,
      12,
    );
    // парабола с връх при най-голямата ордината: 2·2·6/3 = 8; 3·2/8 = 0,75
    expect(diagramShape("parabola-vertex-at-peak", 2, 6).area).toBeCloseTo(
      8,
      12,
    );
    expect(diagramShape("parabola-vertex-at-peak", 2, 6).centroid).toBeCloseTo(
      0.75,
      12,
    );
  });

  it("отрицателната ордината дава отрицателна площ", () => {
    expect(diagramShape("triangle", 2, -6).area).toBeCloseTo(-6, 12);
  });
});

describe("правило на Верешчагин срещу пряко интегриране", () => {
  it("триъгълник × триъгълник (върховете в един и същ край): l·h·m/3", () => {
    const l = 2;
    const tri = diagramShape("triangle", l, 6);
    // ординатата на другия триъгълник (2 при s = 0) под центъра: 2·(1 − 1/3) = 1,333
    const eta = linearOrdinate(2, 0, l, tri.centroid);
    expect(eta).toBeCloseTo(4 / 3, 12);
    const direct = midpoint((s) => 6 * (1 - s / l) * 2 * (1 - s / l), 0, l);
    expect(vereshchagin(tri.area, eta)).toBeCloseTo(direct, 6);
    expect(vereshchagin(tri.area, eta)).toBeCloseTo(8, 12);
    expect(trapezoidProduct(l, 6, 0, 2, 0)).toBeCloseTo(8, 12);
  });

  it("триъгълник × триъгълник (върховете в срещуположни краища): l·h·m/6", () => {
    const l = 3;
    const tri = diagramShape("triangle", l, 5);
    const eta = linearOrdinate(0, 4, l, tri.centroid); // 4·(1/3) = 1,333
    const direct = midpoint((s) => 5 * (1 - s / l) * ((4 * s) / l), 0, l);
    expect(vereshchagin(tri.area, eta)).toBeCloseTo(direct, 6);
    expect(vereshchagin(tri.area, eta)).toBeCloseTo((3 * 5 * 4) / 6, 12);
  });

  it("парабола (връх в нулевия край) × триъгълник: конзола с равномерен товар", () => {
    const l = 1.5;
    const par = diagramShape("parabola-vertex-at-zero", l, 9);
    const eta = linearOrdinate(1.5, 0, l, par.centroid);
    const direct = midpoint((s) => 9 * (1 - s / l) ** 2 * (l - s), 0, l);
    expect(vereshchagin(par.area, eta)).toBeCloseTo(direct, 6);
  });

  it("парабола (връх при най-голямата ордината) × триъгълник: половин проста греда", () => {
    const l = 2;
    const par = diagramShape("parabola-vertex-at-peak", l, 8);
    // M̄ е 1 при s = 0 (средата на гредата) и 0 при опората
    const eta = linearOrdinate(1, 0, l, par.centroid);
    const direct = midpoint((s) => 8 * (1 - (s / l) ** 2) * (1 - s / l), 0, l);
    expect(vereshchagin(par.area, eta)).toBeCloseTo(direct, 6);
  });

  it("трапец × триъгълник: правоъгълник + триъгълник = обща формула = интеграл", () => {
    // M: 12 → 6 на дължина 1; M̄: 1 → 0
    const rect = diagramShape("rectangle", 1, 6);
    const tri = diagramShape("triangle", 1, 6);
    const sum =
      vereshchagin(rect.area, linearOrdinate(1, 0, 1, rect.centroid)) +
      vereshchagin(tri.area, linearOrdinate(1, 0, 1, tri.centroid));
    const direct = midpoint((x) => (12 - 6 * x) * (1 - x), 0, 1);
    expect(sum).toBeCloseTo(5, 12);
    expect(trapezoidProduct(1, 12, 6, 1, 0)).toBeCloseTo(5, 12);
    expect(direct).toBeCloseTo(5, 6);
  });

  it("трапец × трапец: l/6·(2ac + 2bd + ad + bc)", () => {
    // 40 → 30 и 1 → 1,5 на дължина 1: (80 + 90 + 60 + 30)/6 = 43,333
    const direct = midpoint((x) => (40 - 10 * x) * (1 + 0.5 * x), 0, 1);
    expect(trapezoidProduct(1, 40, 30, 1, 1.5)).toBeCloseTo(260 / 6, 12);
    expect(direct).toBeCloseTo(260 / 6, 6);
  });

  it("числовият интеграл на Максвел–Мор съвпада с независимото интегриране", () => {
    const M = (x: number) => 8 * x - 2 * x * x;
    const Mbar = (x: number) => x / 2;
    expect(mohrIntegral(M, Mbar, 0, 2)).toBeCloseTo(
      midpoint((x) => M(x) * Mbar(x), 0, 2),
      6,
    );
  });
});

describe("„Леко“: решен пример", () => {
  it("конзола l = 2 m, F = 3 kN, E·I = 733,33 kN·m² → 1,09 cm", () => {
    // M в запъването: 3·2 = 6 kN·m; Ω = ½·2·6 = 6 kN·m²
    const tri = diagramShape("triangle", 2, 6);
    expect(tri.area).toBeCloseTo(6, 12);
    // M̄ в запъването: 1·2 = 2 m; под центъра (на l/3 от запъването): ⅔·2 = 1,333 m
    const eta = linearOrdinate(2, 0, 2, tri.centroid);
    expect(eta.toFixed(3)).toBe("1.333");
    // Ω·η = 6·1,333 = 8,00
    expect((6 * 1.333).toFixed(2)).toBe("8.00");
    // δ = 8/733,33 = 0,0109 m = 1,09 cm
    const delta = maxwellMohrBending(
      [{ area: tri.area, ordinate: eta }],
      EI_TIMBER,
    );
    expect(delta.toFixed(4)).toBe("0.0109");
    expect((delta * 100).toFixed(2)).toBe("1.09");
    expect(((8 / 733.33) * 100).toFixed(2)).toBe("1.09");
    // Глава 7: F·l³/(3·E·I)
    expect(delta).toBeCloseTo(
      standardDeflection("cantilever-force", 3, 2, EI_TIMBER).f,
      12,
    );
    // числено ∫M·M̄ dx / EI, x от свободния край: M = −3x, M̄ = −x
    expect(delta).toBeCloseTo(
      mohrIntegral(
        (x) => -3 * x,
        (x) => -x,
        0,
        2,
      ) / EI_TIMBER,
      12,
    );
    // складирана енергия: U = 3·0,01091/2 = 0,0164 kN·m ≈ 16 J
    expect(delta.toFixed(5)).toBe("0.01091");
    expect(((3 * 0.01091) / 2).toFixed(4)).toBe("0.0164");
    expect(kNmToJoule(externalWork(3, delta)).toFixed(0)).toBe("16");
  });

  it("проста греда l = 4 m, F = 9 kN в средата → 1,64 cm", () => {
    // M_max = 9·4/4 = 9 kN·m; M̄_max = 4/4 = 1 m
    const half = diagramShape("triangle", 2, 9);
    expect(half.area).toBeCloseTo(9, 12);
    // центърът е на l/3 от върха, т.е. на ⅔ от опората: η = ⅔·1 = 0,667 m
    const eta = linearOrdinate(1, 0, 2, half.centroid);
    expect(eta.toFixed(3)).toBe("0.667");
    // Ω·η = 9·0,667 = 6,00; двете половини: 12
    expect((9 * 0.667).toFixed(2)).toBe("6.00");
    const part = { area: half.area, ordinate: eta };
    const delta = maxwellMohrBending([part, part], EI_TIMBER);
    // 12/733,33 = 0,0164 m = 1,64 cm
    expect(delta.toFixed(4)).toBe("0.0164");
    expect(((12 / 733.33) * 100).toFixed(2)).toBe("1.64");
    // Глава 7: F·l³/(48·E·I)
    expect(delta).toBeCloseTo(
      standardDeflection("simple-force-mid", 9, 4, EI_TIMBER).f,
      12,
    );
    // числено: в лявата половина M = 4,5x, M̄ = x/2; дясната е огледална
    expect(delta).toBeCloseTo(
      (2 *
        mohrIntegral(
          (x) => 4.5 * x,
          (x) => x / 2,
          0,
          2,
        )) /
        EI_TIMBER,
      12,
    );
  });

  it("въпрос 4: конзола l = 3 m, F = 4 kN, E·I = 4000 kN·m² → 0,9 cm", () => {
    // M = 12; Ω = ½·3·12 = 18; η = ⅔·3 = 2; 36/4000 = 0,009 m
    const tri = diagramShape("triangle", 3, 12);
    const eta = linearOrdinate(3, 0, 3, tri.centroid);
    expect(tri.area).toBeCloseTo(18, 12);
    expect(eta).toBeCloseTo(2, 12);
    const delta = maxwellMohrBending([{ area: tri.area, ordinate: eta }], 4000);
    expect(delta).toBeCloseTo(0.009, 12);
    expect(delta).toBeCloseTo(
      standardDeflection("cantilever-force", 4, 3, 4000).f,
      12,
    );
  });
});

describe("„Подробно“, пример 1: енергия, Клапейрон и Кастилияно", () => {
  const F = 6;
  const l = 1.5;
  const energy = (force: number) =>
    bendingStrainEnergy((x) => -force * x, 0, l, EI_STEEL);

  it("U = F²·l³/(6·E·I) = 121,5/4200 = 0,02893 kN·m = 28,9 J", () => {
    // 36·3,375 = 121,5; 6·700 = 4200
    expect((36 * 3.375).toFixed(1)).toBe("121.5");
    expect(energy(F).toFixed(5)).toBe("0.02893");
    expect(kNmToJoule(energy(F)).toFixed(1)).toBe("28.9");
  });

  it("Клапейрон: δ = 2U/F = 0,009643 m", () => {
    expect(((2 * energy(F)) / F).toFixed(6)).toBe("0.009643");
    expect(((2 * 0.02893) / 6).toFixed(6)).toBe("0.009643");
  });

  it("Кастилияно (числена производна): δ = F·l³/(3·E·I) = 20,25/2100 = 0,96 cm", () => {
    const delta = castiglianoDisplacement(energy, F);
    expect(delta).toBeCloseTo(20.25 / 2100, 9);
    expect(delta.toFixed(6)).toBe("0.009643");
    expect((delta * 100).toFixed(2)).toBe("0.96");
    // Глава 7 и Клапейрон: U = F·δ/2
    const standard = standardDeflection("cantilever-force", F, l, EI_STEEL).f;
    expect(delta).toBeCloseTo(standard, 9);
    expect(externalWork(F, standard)).toBeCloseTo(energy(F), 12);
  });

  it("Верешчагин за същата конзола: Ω = F·l²/2, η = 2l/3", () => {
    const tri = diagramShape("triangle", l, F * l);
    expect(tri.area).toBeCloseTo((F * l * l) / 2, 12);
    const eta = linearOrdinate(l, 0, l, tri.centroid);
    expect(eta).toBeCloseTo((2 * l) / 3, 12);
    expect(
      maxwellMohrBending([{ area: tri.area, ordinate: eta }], EI_STEEL),
    ).toBeCloseTo(20.25 / 2100, 12);
  });

  it("най-голямото напрежение е в еластичната област: 900/66,67 = 13,5 kN/cm²", () => {
    expect(((F * l * 100) / ((4 * 10 ** 2) / 6)).toFixed(1)).toBe("13.5");
  });
});

describe("„Подробно“, пример 2: конзола с равномерен товар", () => {
  const q = 8;
  const l = 1.5;

  it("провисване в края: 4,5·1,125/700 = 0,72 cm = q·l⁴/(8·E·I)", () => {
    // h = 8·1,5²/2 = 9 kN·m; Ω = 1,5·9/3 = 4,5 kN·m²
    const par = diagramShape("parabola-vertex-at-zero", l, (q * l * l) / 2);
    expect(par.area).toBeCloseTo(4.5, 12);
    // центърът е на l/4 от запъването: η = ¾·1,5 = 1,125 m
    const eta = linearOrdinate(l, 0, l, par.centroid);
    expect(eta).toBeCloseTo(1.125, 12);
    // 4,5·1,125 = 5,0625; 5,0625/700 = 0,007232 m
    const delta = maxwellMohrBending(
      [{ area: par.area, ordinate: eta }],
      EI_STEEL,
    );
    expect(delta.toFixed(6)).toBe("0.007232");
    expect((delta * 100).toFixed(2)).toBe("0.72");
    const standard = standardDeflection(
      "cantilever-distributed",
      q,
      l,
      EI_STEEL,
    );
    expect(delta).toBeCloseTo(standard.f, 12);
    // пряко интегриране, x от свободния край: M = −q·x²/2, M̄ = −x
    expect(delta).toBeCloseTo(
      mohrIntegral(
        (x) => (-q * x * x) / 2,
        (x) => -x,
        0,
        l,
      ) / EI_STEEL,
      12,
    );
  });

  it("ъгъл в края: единичен момент, 4,5·1/700 = 0,00643 rad = q·l³/(6·E·I)", () => {
    const par = diagramShape("parabola-vertex-at-zero", l, (q * l * l) / 2);
    const phi = maxwellMohrBending([{ area: par.area, ordinate: 1 }], EI_STEEL);
    expect(phi.toFixed(5)).toBe("0.00643");
    expect(phi).toBeCloseTo(
      standardDeflection("cantilever-distributed", q, l, EI_STEEL).phi,
      12,
    );
  });
});

describe("„Подробно“, пример 3: проста греда с равномерен товар", () => {
  it("2·10,667·0,625/733,33 = 1,82 cm = 5·q·l⁴/(384·E·I)", () => {
    // h = 4·4²/8 = 8 kN·m; половина: Ω = ⅔·2·8 = 10,667 kN·m²
    const par = diagramShape("parabola-vertex-at-peak", 2, 8);
    expect(par.area.toFixed(3)).toBe("10.667");
    // центърът е на ⅜·2 = 0,75 m от средата, т.е. на 1,25 m от опората
    expect(par.centroid).toBeCloseTo(0.75, 12);
    // M̄: 1 m в средата, 0 в опората → η = 1,25/2 = 0,625 m
    const eta = linearOrdinate(1, 0, 2, par.centroid);
    expect(eta).toBeCloseTo(0.625, 12);
    // 2·10,667·0,625 = 13,33; 13,33/733,33 = 0,0182 m
    expect((2 * 10.667 * 0.625).toFixed(2)).toBe("13.33");
    expect((13.33 / 733.33).toFixed(4)).toBe("0.0182");
    const part = { area: par.area, ordinate: eta };
    const delta = maxwellMohrBending([part, part], EI_TIMBER);
    expect((delta * 100).toFixed(2)).toBe("1.82");
    // Глава 7: 5·q·l⁴/(384·E·I) = 5120/281 600
    expect(delta).toBeCloseTo(
      standardDeflection("simple-distributed", 4, 4, EI_TIMBER).f,
      12,
    );
    // числено: M = 8x − 2x², M̄ = x/2 в лявата половина; дясната е огледална
    expect(delta).toBeCloseTo(
      (2 *
        mohrIntegral(
          (x) => 8 * x - 2 * x * x,
          (x) => x / 2,
          0,
          2,
        )) /
        EI_TIMBER,
      12,
    );
  });
});

describe("„Подробно“, пример 4: възел на двупрътова система", () => {
  // C(4; 0), A(0; 0), B(0; −3), в метри. Прът 1 = AC, прът 2 = BC.
  const toA = { x: -4, y: 0 };
  const toB = { x: -4, y: -3 };
  const E = 21000;
  const bar = (N: number, Nbar: number, l: number, A: number) => ({
    N,
    Nbar,
    l,
    E,
    A,
  });

  it("товарно състояние: N₁ = +80 kN, N₂ = −100 kN", () => {
    // ΣV: −⅗·N₂ − 60 = 0 → N₂ = −100; ΣH: −N₁ − ⅘·N₂ = 0 → N₁ = 80
    const { N1, N2 } = twoBarForces(toA, toB, { x: 0, y: -60 });
    expect(N1).toBeCloseTo(80, 9);
    expect(N2).toBeCloseTo(-100, 9);
    // напрежения: 80/5 = 16 kN/cm²; −100/20 = −5 kN/cm²
    expect(N1 / 5).toBeCloseTo(16, 9);
    expect(N2 / 20).toBeCloseTo(-5, 9);
  });

  it("единични състояния: надолу N̄ = 4/3 и −5/3; надясно N̄ = 1 и 0", () => {
    const down = twoBarForces(toA, toB, { x: 0, y: -1 });
    expect(down.N1).toBeCloseTo(4 / 3, 12);
    expect(down.N2).toBeCloseTo(-5 / 3, 12);
    const right = twoBarForces(toA, toB, { x: 1, y: 0 });
    expect(right.N1).toBeCloseTo(1, 12);
    expect(right.N2).toBeCloseTo(0, 12);
  });

  it("вертикално преместване: 0,40635 + 0,19841 = 0,60476 cm", () => {
    // 80·(4/3)·400/(21000·5) = 42 666,7/105 000 = 0,40635
    const first = maxwellMohrAxial([bar(80, 4 / 3, 400, 5)]);
    // (−100)·(−5/3)·500/(21000·20) = 83 333,3/420 000 = 0,19841
    const second = maxwellMohrAxial([bar(-100, -5 / 3, 500, 20)]);
    expect(first.toFixed(5)).toBe("0.40635");
    expect(second.toFixed(5)).toBe("0.19841");
    const deltaV = maxwellMohrAxial([
      bar(80, 4 / 3, 400, 5),
      bar(-100, -5 / 3, 500, 20),
    ]);
    expect(deltaV.toFixed(5)).toBe("0.60476");
    expect(deltaV.toFixed(2)).toBe("0.60");
    expect((0.40635 + 0.19841).toFixed(5)).toBe("0.60476");
  });

  it("хоризонтално преместване: 80·1·400/105 000 = 0,305 cm = Δl₁", () => {
    const deltaH = maxwellMohrAxial([
      bar(80, 1, 400, 5),
      bar(-100, 0, 500, 20),
    ]);
    expect(deltaH.toFixed(3)).toBe("0.305");
    expect(deltaH).toBeCloseTo((80 * 400) / (E * 5), 12);
  });

  it("Клапейрон: U = 12,19 + 5,95 = 18,14 kN·cm = F·δ_v/2", () => {
    // 80²·400/(2·105 000) = 12,19; 100²·500/(2·420 000) = 5,95
    const U1 = axialStrainEnergy(80, 400, E, 5);
    const U2 = axialStrainEnergy(-100, 500, E, 20);
    expect(U1.toFixed(2)).toBe("12.19");
    expect(U2.toFixed(2)).toBe("5.95");
    expect((U1 + U2).toFixed(2)).toBe("18.14");
    expect((12.19 + 5.95).toFixed(2)).toBe("18.14");
    // ½·60·0,6048 = 18,14
    expect((30 * 0.6048).toFixed(2)).toBe("18.14");
    const deltaV = maxwellMohrAxial([
      bar(80, 4 / 3, 400, 5),
      bar(-100, -5 / 3, 500, 20),
    ]);
    expect(externalWork(60, deltaV)).toBeCloseTo(U1 + U2, 12);
  });

  it("Кастилияно: числена производна на U(F) дава същото δ_v", () => {
    const energy = (F: number) => {
      const { N1, N2 } = twoBarForces(toA, toB, { x: 0, y: -F });
      return (
        axialStrainEnergy(N1, 400, E, 5) + axialStrainEnergy(N2, 500, E, 20)
      );
    };
    expect(castiglianoDisplacement(energy, 60).toFixed(5)).toBe("0.60476");
  });

  it("геометрия на удълженията: u = Δl₁, 0,8·u + 0,6·v = Δl₂ → v = −0,60476 cm", () => {
    const dl1 = (80 * 400) / (E * 5); // 0,30476
    const dl2 = (-100 * 500) / (E * 20); // −0,11905
    expect(dl1.toFixed(5)).toBe("0.30476");
    expect(dl2.toFixed(5)).toBe("-0.11905");
    const u = dl1;
    const v = (dl2 - 0.8 * u) / 0.6;
    expect(v.toFixed(5)).toBe("-0.60476"); // оста y е нагоре → възелът слиза
  });
});

describe("„Подробно“: въпроси", () => {
  it("въпрос 2: проста греда l = 6 m, F = 20 kN, E·I = 8000 kN·m² → 1,13 cm", () => {
    // M_max = 20·6/4 = 30; половина: Ω = ½·3·30 = 45; η = ⅔·1,5 = 1
    const half = diagramShape("triangle", 3, 30);
    const eta = linearOrdinate(1.5, 0, 3, half.centroid);
    expect(half.area).toBeCloseTo(45, 12);
    expect(eta).toBeCloseTo(1, 12);
    const part = { area: half.area, ordinate: eta };
    const delta = maxwellMohrBending([part, part], 8000);
    // 90/8000 = 0,01125 m
    expect(delta).toBeCloseTo(0.01125, 12);
    expect(delta).toBeCloseTo(
      standardDeflection("simple-force-mid", 20, 6, 8000).f,
      12,
    );
  });

  it("въпрос 4: конзола l = 2 m, F = 6 kN, провисване в средата → 5/700 = 0,71 cm", () => {
    // в участъка от запъването до средата: M 12 → 6 (трапец), M̄ 1 → 0
    // правоъгълник: Ω = 6·1 = 6, η = 0,5 → 3; триъгълник: Ω = ½·1·6 = 3, η = ⅔ → 2
    const rect = diagramShape("rectangle", 1, 6);
    const tri = diagramShape("triangle", 1, 6);
    const parts = [
      { area: rect.area, ordinate: linearOrdinate(1, 0, 1, rect.centroid) },
      { area: tri.area, ordinate: linearOrdinate(1, 0, 1, tri.centroid) },
    ];
    expect(vereshchagin(parts[0]!.area, parts[0]!.ordinate)).toBeCloseTo(3, 12);
    expect(vereshchagin(parts[1]!.area, parts[1]!.ordinate)).toBeCloseTo(2, 12);
    const delta = maxwellMohrBending(parts, EI_STEEL);
    expect(delta).toBeCloseTo(5 / 700, 12);
    expect(delta.toFixed(5)).toBe("0.00714");
    expect((delta * 100).toFixed(2)).toBe("0.71");
    // затворена формула: F·x²·(3l − x)/(6·E·I) = 6·1·5/4200
    expect(delta).toBeCloseTo((6 * 1 * 5) / (6 * 700), 12);
    // независимо: еластичната линия от Глава 7 в x = 1 m
    const beam: Beam = {
      length: 2,
      supports: { type: "cantilever", fixedAt: "left" },
      loads: [{ type: "force", x: 2, value: 6 }],
    };
    const mid = elasticCurve(beam, EI_STEEL).find(
      (p) => Math.abs(p.x - 1) < 1e-9,
    );
    expect(mid?.w).toBeCloseTo(delta, 9);
  });

  it("сила извън средата (Глава 7, пример 3): Σ по три участъка = 115 kN·m³", () => {
    // l = 6, F = 30 на 2 m от A: M = 40 под силата, 30 в средата; M̄ = 1 и 1,5
    const sum =
      trapezoidProduct(2, 0, 40, 0, 1) +
      trapezoidProduct(1, 40, 30, 1, 1.5) +
      trapezoidProduct(3, 30, 0, 1.5, 0);
    expect(sum).toBeCloseTo(115, 9);
    const beam: Beam = {
      length: 6,
      supports: { type: "simple", xA: 0, xB: 6 },
      loads: [{ type: "force", x: 2, value: 30 }],
    };
    const mid = elasticCurve(beam, 1000).find((p) => Math.abs(p.x - 3) < 1e-9);
    expect(mid?.w).toBeCloseTo(sum / 1000, 9);
  });
});

describe("невалидни входни данни", () => {
  it("отказва неположителни дължини, коравини и площи", () => {
    expect(() => axialStrainEnergy(10, 0, 21000, 4)).toThrow();
    expect(() => axialStrainEnergy(10, 100, 21000, -1)).toThrow();
    expect(() => torsionStrainEnergy(10, 100, 0, 5)).toThrow();
    expect(() => bendingStrainEnergy((x) => x, 0, 1, 0)).toThrow();
    expect(() => maxwellMohrBending([], 700)).toThrow();
    expect(() => maxwellMohrBending([{ area: 1, ordinate: 1 }], 0)).toThrow();
    expect(() => maxwellMohrAxial([])).toThrow();
    expect(() =>
      maxwellMohrAxial([{ N: 1, Nbar: 1, l: 100, E: 21000, A: 0 }]),
    ).toThrow();
    expect(() => diagramShape("triangle", 0, 5)).toThrow();
    expect(() => trapezoidProduct(-1, 1, 1, 1, 1)).toThrow();
  });

  it("отказва сечение извън участъка, обърнат участък и нечислови стойности", () => {
    expect(() => linearOrdinate(1, 0, 2, 3)).toThrow();
    expect(() =>
      mohrIntegral(
        (x) => x,
        (x) => x,
        2,
        1,
      ),
    ).toThrow();
    expect(() =>
      mohrIntegral(
        (x) => x,
        (x) => x,
        0,
        1,
        0,
      ),
    ).toThrow();
    expect(() => externalWork(Number.NaN, 1)).toThrow();
    expect(() => vereshchagin(1, Number.POSITIVE_INFINITY)).toThrow();
    expect(() => castiglianoDisplacement((F) => F * F, 1, 0)).toThrow();
  });

  it("отказва два пръта на една права", () => {
    expect(() =>
      twoBarForces({ x: 1, y: 0 }, { x: -2, y: 0 }, { x: 0, y: -1 }),
    ).toThrow();
  });
});
