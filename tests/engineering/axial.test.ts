import { describe, expect, it } from "vitest";
import {
  solveBar,
  solveFixedFixedBar,
  solveRigidBeamOnRods,
  type Segment,
} from "@/lib/engineering/axial";

// E на стоманата: 210 000 N/mm² = 21 000 kN/cm² (EN 1993-1-1, т. 3.2.6).
const E = 21_000;

describe("стъпаловиден прът, запънат в горния край", () => {
  // Участък 1: l = 100 cm, A = 4 cm². Участък 2: l = 80 cm, A = 2 cm².
  // F1 = 30 kN на границата, F2 = 20 kN на свободния край, и двете опъват.
  const segments: Segment[] = [
    { length: 100, area: 4, E },
    { length: 80, area: 2, E },
  ];
  const result = solveBar(segments, [30, 20]);

  it("N_2 = 20 kN; N_1 = 30 + 20 = 50 kN", () => {
    expect(result.N).toEqual([50, 20]);
  });

  it("σ_1 = 50/4 = 12,5 kN/cm² (125 MPa); σ_2 = 20/2 = 10 kN/cm² (100 MPa)", () => {
    expect(result.sigma[0]).toBeCloseTo(12.5, 10);
    expect(result.sigma[1]).toBeCloseTo(10, 10);
  });

  it("Δl_1 = 50·100/(21000·4) = 0,0595 cm; Δl_2 = 20·80/(21000·2) = 0,0381 cm", () => {
    expect(result.deltaL[0]).toBeCloseTo(5000 / 84000, 12);
    expect(result.deltaL[1]).toBeCloseTo(1600 / 42000, 12);
    expect((result.deltaL[0]! * 10).toFixed(3)).toBe("0.595");
    expect((result.deltaL[1]! * 10).toFixed(3)).toBe("0.381");
  });

  it("свободният край се премества с 0,976 mm", () => {
    expect((result.displacement[1]! * 10).toFixed(3)).toBe("0.976");
  });

  it("закон на Хук: σ = E·ε във всеки участък", () => {
    result.sigma.forEach((sigma, i) => {
      const epsilon = result.deltaL[i]! / segments[i]!.length;
      expect(sigma).toBeCloseTo(E * epsilon, 10);
    });
  });
});

describe("прът, запънат в двата края", () => {
  // a = 120 cm, b = 80 cm, еднаква площ 5 cm². F = 60 kN на границата,
  // насочена към втория край.
  const segments: Segment[] = [
    { length: 120, area: 5, E },
    { length: 80, area: 5, E },
  ];
  const result = solveFixedFixedBar(segments, [60, 0]);

  it("при еднаква коравина: N_1 = F·b/l = 60·80/200 = 24 (опън); N_2 = −F·a/l = −36 (натиск)", () => {
    expect(result.N[0]).toBeCloseTo(24, 10);
    expect(result.N[1]).toBeCloseTo(-36, 10);
  });

  it("равновесие: N_1 − N_2 = F", () => {
    expect(result.N[0]! - result.N[1]!).toBeCloseTo(60, 10);
  });

  it("съвместимост: общото удължение е нула", () => {
    expect(result.displacement[1]).toBeCloseTo(0, 12);
    expect(result.deltaL[0]).toBeCloseTo(-result.deltaL[1]!, 12);
  });

  it("напрежения: 4,8 и −7,2 kN/cm² (48 и −72 MPa)", () => {
    expect(result.sigma[0]).toBeCloseTo(4.8, 10);
    expect(result.sigma[1]).toBeCloseTo(-7.2, 10);
  });

  it("по-коравият участък поема повече: с двойна площ на втория участък", () => {
    const stiffer = solveFixedFixedBar(
      [
        { length: 100, area: 5, E },
        { length: 100, area: 10, E },
      ],
      [60, 0],
    );
    // N_1·100/5 + N_2·100/10 = 0 и N_1 − N_2 = 60 → N_1 = 20, N_2 = −40
    expect(stiffer.N[0]).toBeCloseTo(20, 10);
    expect(stiffer.N[1]).toBeCloseTo(-40, 10);
  });

  it("не приема външна сила в запънатия край", () => {
    expect(() => solveFixedFixedBar(segments, [60, 5])).toThrow();
  });
});

describe("корава греда на шарнир, окачена на два пръта", () => {
  // Прътите са на 1 m и 2 m от шарнира, еднакви: l = 150 cm, A = 3 cm².
  // Сила F = 50 kN на 3 m от шарнира.
  const rod = { length: 150, area: 3, E };
  const result = solveRigidBeamOnRods(
    [
      { ...rod, arm: 100 },
      { ...rod, arm: 200 },
    ],
    { F: 50, arm: 300 },
  );

  it("съвместимост: Δl_2 = 2·Δl_1, следователно N_2 = 2·N_1", () => {
    expect(result.deltaL[1]! / result.deltaL[0]!).toBeCloseTo(2, 10);
    expect(result.N[1]! / result.N[0]!).toBeCloseTo(2, 10);
  });

  it("равновесие: N_1·1 + N_2·2 = 50·3 → N_1 = 30 kN, N_2 = 60 kN", () => {
    expect(result.N[0]).toBeCloseTo(30, 10);
    expect(result.N[1]).toBeCloseTo(60, 10);
    expect(result.N[0]! * 100 + result.N[1]! * 200).toBeCloseTo(50 * 300, 8);
  });

  it("напрежения: 10 и 20 kN/cm² (100 и 200 MPa)", () => {
    expect(result.sigma[0]).toBeCloseTo(10, 10);
    expect(result.sigma[1]).toBeCloseTo(20, 10);
  });

  it("удължения: 0,714 и 1,429 mm", () => {
    expect((result.deltaL[0]! * 10).toFixed(3)).toBe("0.714");
    expect((result.deltaL[1]! * 10).toFixed(3)).toBe("1.429");
  });
});

describe("останалите числа от Глава 3", () => {
  it("пример 2: сечението със силата се премества с 0,274 mm", () => {
    const result = solveFixedFixedBar(
      [
        { length: 120, area: 5, E },
        { length: 80, area: 5, E },
      ],
      [60, 0],
    );
    expect((result.deltaL[0]! * 10).toFixed(3)).toBe("0.274");
    expect((36 * 80) / (E * 5)).toBeCloseTo(result.deltaL[0]!, 12);
  });

  it("пример 3: реакцията в шарнира е −40 kN (надолу)", () => {
    const result = solveRigidBeamOnRods(
      [
        { length: 150, area: 3, E, arm: 100 },
        { length: 150, area: 3, E, arm: 200 },
      ],
      { F: 50, arm: 300 },
    );
    expect(50 - result.N[0]! - result.N[1]!).toBeCloseTo(-40, 9);
  });

  it("пример 4: възпрепятствано загряване с 30° дава −75,6 MPa", () => {
    const sigma = -210_000 * 12e-6 * 30;
    expect(sigma).toBeCloseTo(-75.6, 9);
    expect(Math.abs(sigma) / 235).toBeCloseTo(0.32, 2);
  });

  it("мост 100 m, 50°: промяна на дължината 60 mm", () => {
    expect(12e-6 * 50 * 100_000).toBeCloseTo(60, 9);
  });

  it("въпрос 2: сила 90 kN на една трета → 60 и 30 kN", () => {
    const result = solveFixedFixedBar(
      [
        { length: 100, area: 5, E },
        { length: 200, area: 5, E },
      ],
      [90, 0],
    );
    expect(result.N[0]).toBeCloseTo(60, 9);
    expect(result.N[1]).toBeCloseTo(-30, 9);
  });

  it("въпрос 5: 84 kN върху 6 cm² и 3 m → 140 MPa и 2 mm", () => {
    const result = solveBar([{ length: 300, area: 6, E }], [84]);
    expect(result.sigma[0]! * 10).toBeCloseTo(140, 9);
    expect(result.deltaL[0]! * 10).toBeCloseTo(2, 9);
  });

  it("числата от „Леко“: 60 kN/5 cm² = 120 MPa; ε = 1/2000 → 105 MPa; A = 200/16 = 12,5 cm²", () => {
    expect((60 / 5) * 10).toBe(120);
    expect(210_000 * (1 / 2000)).toBeCloseTo(105, 9);
    expect(200 / 16).toBe(12.5);
    expect(210_000 * 0.001).toBeCloseTo(210, 9);
  });
});
