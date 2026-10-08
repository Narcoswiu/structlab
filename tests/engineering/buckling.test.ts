import { describe, expect, it } from "vitest";
import {
  allowableBucklingForce,
  circleArea,
  circleDiameterForInertia,
  circleInertia,
  criticalStress,
  effectiveLength,
  effectiveLengthFactor,
  eulerCriticalForce,
  governingSlenderness,
  isEulerValid,
  limitSlenderness,
  radiusOfGyration,
  requiredInertiaForBuckling,
  slenderness,
  type BucklingSupport,
} from "@/lib/engineering/buckling";
import { sectionProperties } from "@/lib/engineering/section";

// Всички очаквани стойности са сметнати на ръка и са записани в коментара над теста.
// π² = 9,8696; за стомана π²·E = 9,8696·21000 = 207 261,7 kN/cm².

const E_STEEL = 21000; // kN/cm² (БДС EN 1993-1-1, т. 3.2.6)
const E_TIMBER = 1100; // kN/cm² – зададен в условието на задачите

describe("коефициент на дължината и свободна дължина", () => {
  it("четирите класически случая: 1; 2; 0,7; 0,5", () => {
    expect(effectiveLengthFactor("pinned-pinned")).toBe(1);
    expect(effectiveLengthFactor("fixed-free")).toBe(2);
    expect(effectiveLengthFactor("fixed-pinned")).toBe(0.7);
    expect(effectiveLengthFactor("fixed-fixed")).toBe(0.5);
  });

  it("μ·l за прът 150 cm: 300; 150; 105; 75 cm", () => {
    expect(effectiveLength(150, 2)).toBeCloseTo(300, 12);
    expect(effectiveLength(150)).toBeCloseTo(150, 12);
    expect(effectiveLength(150, 0.7)).toBeCloseTo(105, 12);
    expect(effectiveLength(150, 0.5)).toBeCloseTo(75, 12);
  });

  it("F_cr спрямо основния случай: 1/4; 1; 1/0,49 = 2,04; 4", () => {
    const base = eulerCriticalForce(E_STEEL, 100, 300);
    const ratio = (support: BucklingSupport) =>
      eulerCriticalForce(E_STEEL, 100, 300, effectiveLengthFactor(support)) /
      base;
    expect(ratio("pinned-pinned")).toBeCloseTo(1, 12);
    expect(ratio("fixed-free")).toBeCloseTo(0.25, 12);
    expect(ratio("fixed-pinned")).toBeCloseTo(2.0408, 4);
    expect(ratio("fixed-fixed")).toBeCloseTo(4, 12);
  });

  it("точната стойност за запъване–шарнир е μ = π/4,4934 = 0,699 (корен на tg x = x)", () => {
    // tg(k·l) = k·l → k·l = 4,4934; μ = π/(k·l) = 3,1416/4,4934 = 0,6992
    const kl = 4.493409457909064;
    expect(Math.tan(kl)).toBeCloseTo(kl, 9);
    expect(Math.PI / kl).toBeCloseTo(0.6992, 4);
    expect(effectiveLengthFactor("fixed-pinned")).toBeCloseTo(Math.PI / kl, 2);
  });
});

describe("общи свойства на формулата на Ойлер", () => {
  it("двойна дължина → четири пъти по-малка критична сила", () => {
    const short = eulerCriticalForce(E_STEEL, 50, 200);
    const long = eulerCriticalForce(E_STEEL, 50, 400);
    expect(short / long).toBeCloseTo(4, 12);
  });

  it("F_cr е пропорционална на E и на I", () => {
    const base = eulerCriticalForce(1000, 10, 100);
    expect(eulerCriticalForce(2000, 10, 100)).toBeCloseTo(2 * base, 9);
    expect(eulerCriticalForce(1000, 30, 100)).toBeCloseTo(3 * base, 9);
  });

  it("σ_cr·A = F_cr за произволен прът", () => {
    const I = 123;
    const A = 17;
    const lambda = slenderness(260, 0.7, radiusOfGyration(I, A));
    expect(criticalStress(E_STEEL, lambda) * A).toBeCloseTo(
      eulerCriticalForce(E_STEEL, I, 260, 0.7),
      9,
    );
  });

  it("при λ = λ_гр критичното напрежение е точно σ_p", () => {
    const limit = limitSlenderness(E_STEEL, 20);
    expect(criticalStress(E_STEEL, limit)).toBeCloseTo(20, 9);
  });

  it("отказва невалидни данни", () => {
    expect(() => eulerCriticalForce(0, 10, 100)).toThrow();
    expect(() => eulerCriticalForce(E_STEEL, -1, 100)).toThrow();
    expect(() => eulerCriticalForce(E_STEEL, 10, 0)).toThrow();
    expect(() => eulerCriticalForce(E_STEEL, 10, 100, 0)).toThrow();
    expect(() => eulerCriticalForce(E_STEEL, 10, Number.NaN)).toThrow();
    expect(() => radiusOfGyration(10, 0)).toThrow();
    expect(() => slenderness(100, 1, 0)).toThrow();
    expect(() => criticalStress(E_STEEL, 0)).toThrow();
    expect(() => limitSlenderness(E_STEEL, 0)).toThrow();
    expect(() => isEulerValid(-5, 100)).toThrow();
    expect(() => allowableBucklingForce(100, 0.5)).toThrow();
    expect(() => allowableBucklingForce(0, 2)).toThrow();
    expect(() => requiredInertiaForBuckling(60, 0, E_STEEL, 200)).toThrow();
    expect(() => requiredInertiaForBuckling(-60, 3, E_STEEL, 200)).toThrow();
    expect(() => circleInertia(4, 4)).toThrow();
    expect(() => circleArea(0)).toThrow();
    expect(() => circleDiameterForInertia(0)).toThrow();
    expect(() =>
      effectiveLengthFactor("free-free" as BucklingSupport),
    ).toThrow();
  });
});

describe("„Леко“, пример 1: дървен стълб 10×10 cm, l = 4 m, шарнир–шарнир", () => {
  const props = sectionProperties([{ b: 10, h: 10, x: 0, y: 0 }]);

  it("I = 10·10³/12 = 833,33 cm⁴; A = 100 cm²", () => {
    expect(props.Ix).toBeCloseTo(833.333, 3);
    expect(props.Iy).toBeCloseTo(833.333, 3);
    expect(props.A).toBeCloseTo(100, 12);
  });

  it("F_cr = 9,8696·1100·833,33/400² = 9 047 137/160 000 = 56,5 kN", () => {
    expect(eulerCriticalForce(E_TIMBER, props.Ix, 400)).toBeCloseTo(56.54, 2);
  });

  it("смачкване при зададена якост 2,1 kN/cm²: 2,1·100 = 210 kN; 210/56,5 = 3,7", () => {
    const crush = 2.1 * props.A;
    expect(crush).toBeCloseTo(210, 12);
    expect(crush / eulerCriticalForce(E_TIMBER, props.Ix, 400)).toBeCloseTo(
      3.71,
      2,
    );
  });

  it("двойно по-дълъг (8 m): 56,54/4 = 14,1 kN", () => {
    expect(eulerCriticalForce(E_TIMBER, props.Ix, 800)).toBeCloseTo(14.14, 2);
  });

  it("проверка през гъвкавостта: i = 2,887 cm; λ = 400/2,887 = 138,6; σ_cr = 0,565 kN/cm²", () => {
    expect(props.ix).toBeCloseTo(2.887, 3);
    const lambda = slenderness(400, 1, props.ix);
    expect(lambda).toBeCloseTo(138.56, 2);
    const sigma = criticalStress(E_TIMBER, lambda);
    // 9,8696·1100/138,56² = 10 856,6/19 200 = 0,5654
    expect(sigma).toBeCloseTo(0.5654, 4);
    expect(sigma * props.A).toBeCloseTo(
      eulerCriticalForce(E_TIMBER, props.Ix, 400),
      9,
    );
  });
});

describe("„Леко“, пример 2: стълб 10×20 cm, l = 4 m – слабата ос", () => {
  // b = 10 cm по x, h = 20 cm по y
  const props = sectionProperties([{ b: 10, h: 20, x: 0, y: 0 }]);

  it("I_min = 20·10³/12 = 1666,67 cm⁴; I_max = 10·20³/12 = 6666,67 cm⁴", () => {
    expect(props.I2).toBeCloseTo(1666.667, 3);
    expect(props.I1).toBeCloseTo(6666.667, 3);
    expect(props.Iy).toBeCloseTo(props.I2, 9);
  });

  it("F_cr = 9,8696·1100·1666,67/400² = 113,1 kN – двойно на стълба 10×10", () => {
    const Fcr = eulerCriticalForce(E_TIMBER, props.I2, 400);
    expect(Fcr).toBeCloseTo(113.09, 2);
    expect(Fcr / eulerCriticalForce(E_TIMBER, 10000 / 12, 400)).toBeCloseTo(
      2,
      9,
    );
  });

  it("с I_max би излязло 4 пъти повече: 452,4 kN", () => {
    expect(eulerCriticalForce(E_TIMBER, props.I1, 400)).toBeCloseTo(452.36, 2);
  });

  it("i_min = √(1666,67/200) = 2,887 cm – същата гъвкавост 138,6", () => {
    expect(props.iy).toBeCloseTo(2.887, 3);
    expect(slenderness(400, 1, props.iy)).toBeCloseTo(138.56, 2);
  });
});

describe("кръг и тръба", () => {
  it("d = 4 cm: I = π·256/64 = 12,566 cm⁴; A = π·16/4 = 12,566 cm²; i = d/4 = 1 cm", () => {
    expect(circleInertia(4)).toBeCloseTo(12.566, 3);
    expect(circleArea(4)).toBeCloseTo(12.566, 3);
    expect(radiusOfGyration(circleInertia(4), circleArea(4))).toBeCloseTo(
      1,
      12,
    );
  });

  it("d = 6 cm: I = π·1296/64 = 63,62 cm⁴; A = 28,27 cm²", () => {
    expect(circleInertia(6)).toBeCloseTo(63.617, 3);
    expect(circleArea(6)).toBeCloseTo(28.274, 3);
  });

  it("тръба 10/8 cm: I = π·(10000 − 4096)/64 = π·5904/64 = 289,81 cm⁴; A = π·36/4 = 28,27 cm²", () => {
    expect(circleInertia(10, 8)).toBeCloseTo(289.81, 2);
    expect(circleArea(10, 8)).toBeCloseTo(28.274, 3);
    // i = √(D² + d²)/4 = √164/4 = 3,20 cm
    expect(
      radiusOfGyration(circleInertia(10, 8), circleArea(10, 8)),
    ).toBeCloseTo(Math.sqrt(164) / 4, 12);
  });

  it("обратно: диаметър за даден I", () => {
    expect(circleDiameterForInertia(circleInertia(7.3))).toBeCloseTo(7.3, 12);
  });
});

describe("„Подробно“, загадка и пример 1: стоманен прът d = 4 cm, l = 1,5 m, μ = 1", () => {
  const I = circleInertia(4);
  const A = circleArea(4);
  const i = radiusOfGyration(I, A);

  it("λ = 150/1,00 = 150", () => {
    expect(slenderness(150, 1, i)).toBeCloseTo(150, 9);
  });

  it("F_cr = 207 261,7·12,566/150² = 2 604 527/22 500 = 115,8 kN", () => {
    expect(eulerCriticalForce(E_STEEL, I, 150)).toBeCloseTo(115.76, 2);
  });

  it("σ_cr = 115,76/12,566 = 9,21 kN/cm² = 92,1 MPa = π²·21000/150²", () => {
    const Fcr = eulerCriticalForce(E_STEEL, I, 150);
    expect(Fcr / A).toBeCloseTo(9.212, 3);
    expect(criticalStress(E_STEEL, 150)).toBeCloseTo(Fcr / A, 9);
  });

  it("сила на провлачане при f_y = 23,5 kN/cm²: 12,566·23,5 = 295,3 kN", () => {
    expect(A * 23.5).toBeCloseTo(295.31, 2);
  });
});

describe("„Подробно“, пример 2: същият прът при четирите подпирания, σ_p = 200 MPa", () => {
  const I = circleInertia(4);
  const A = circleArea(4);
  const i = radiusOfGyration(I, A);
  // λ_гр = π·√(21000/20) = 3,1416·32,404 = 101,8
  const limit = limitSlenderness(E_STEEL, 20);

  it("λ_гр = 101,8", () => {
    expect(limit).toBeCloseTo(101.8, 1);
  });

  // [подпиране, λ, F_cr kN, σ_cr kN/cm², важи ли]
  // F_cr = 115,757/μ²: /4 = 28,94; /1 = 115,76; /0,49 = 236,24; /0,25 = 463,03
  // σ_cr = 207 261,7/λ²: /90000 = 2,303; /22500 = 9,212; /11025 = 18,799; /5625 = 36,847
  const rows: [BucklingSupport, number, number, number, boolean][] = [
    ["fixed-free", 300, 28.94, 2.303, true],
    ["pinned-pinned", 150, 115.76, 9.212, true],
    ["fixed-pinned", 105, 236.24, 18.799, true],
    ["fixed-fixed", 75, 463.03, 36.847, false],
  ];

  it.each(rows)(
    "%s: λ = %d, F_cr = %d kN, σ_cr = %d kN/cm²",
    (support, lambdaExpected, FcrExpected, sigmaExpected, valid) => {
      const mu = effectiveLengthFactor(support);
      const lambda = slenderness(150, mu, i);
      expect(lambda).toBeCloseTo(lambdaExpected, 9);
      const Fcr = eulerCriticalForce(E_STEEL, I, 150, mu);
      expect(Fcr).toBeCloseTo(FcrExpected, 2);
      const sigma = criticalStress(E_STEEL, lambda);
      expect(sigma).toBeCloseTo(sigmaExpected, 3);
      expect(sigma * A).toBeCloseTo(Fcr, 9);
      expect(isEulerValid(lambda, limit)).toBe(valid);
      // същото условие, изразено чрез напрежението: σ_cr ≤ σ_p
      expect(sigma <= 20).toBe(valid);
    },
  );

  it("при две запъвания формалният резултат надхвърля силата на провлачане 295,3 kN", () => {
    expect(eulerCriticalForce(E_STEEL, I, 150, 0.5)).toBeGreaterThan(A * 23.5);
  });
});

describe("„Подробно“, пример 3: оразмеряване – F = 60 kN, n = 3, l = 2 m, μ = 1", () => {
  it("нужна критична сила 3·60 = 180 kN; I ≥ 180·200²/207 261,7 = 34,74 cm⁴", () => {
    expect(requiredInertiaForBuckling(60, 3, E_STEEL, 200)).toBeCloseTo(
      34.74,
      2,
    );
  });

  it("d ≥ ⁴√(64·34,74/π) = ⁴√707,7 = 5,16 cm", () => {
    const I = requiredInertiaForBuckling(60, 3, E_STEEL, 200);
    expect(circleDiameterForInertia(I)).toBeCloseTo(5.158, 3);
  });

  it("с точно нужния I критичната сила е 180 kN, а допустимата – 60 kN", () => {
    const I = requiredInertiaForBuckling(60, 3, E_STEEL, 200);
    const Fcr = eulerCriticalForce(E_STEEL, I, 200);
    expect(Fcr).toBeCloseTo(180, 9);
    expect(allowableBucklingForce(Fcr, 3)).toBeCloseTo(60, 9);
  });

  it("приет d = 5,2 cm: i = 1,30 cm; λ = 200/1,30 = 153,8 > 101,8", () => {
    const i = radiusOfGyration(circleInertia(5.2), circleArea(5.2));
    expect(i).toBeCloseTo(1.3, 12);
    const lambda = slenderness(200, 1, i);
    expect(lambda).toBeCloseTo(153.85, 2);
    expect(isEulerValid(lambda, limitSlenderness(E_STEEL, 20))).toBe(true);
  });

  it("I = π·5,2⁴/64 = 35,89 cm⁴; F_cr = 207 261,7·35,89/40 000 = 186,0 kN; F_доп = 62,0 kN ≥ 60", () => {
    expect(circleInertia(5.2)).toBeCloseTo(35.89, 2);
    const Fcr = eulerCriticalForce(E_STEEL, circleInertia(5.2), 200);
    expect(Fcr).toBeCloseTo(185.97, 2);
    const allowed = allowableBucklingForce(Fcr, 3);
    expect(allowed).toBeCloseTo(61.99, 2);
    expect(allowed).toBeGreaterThanOrEqual(60);
  });

  it("напрежение при работния товар: A = 21,237 cm²; 60/21,237 = 2,83 kN/cm² = 28,3 MPa", () => {
    expect(circleArea(5.2)).toBeCloseTo(21.24, 2);
    expect(60 / circleArea(5.2)).toBeCloseTo(2.825, 3);
  });
});

describe("„Подробно“, пример 4: плътен прът d = 6 cm срещу тръба 10/8 cm, l = 4 m", () => {
  const limit = limitSlenderness(E_STEEL, 20);
  const solid = { I: circleInertia(6), A: circleArea(6) };
  const tube = { I: circleInertia(10, 8), A: circleArea(10, 8) };

  it("площите са равни: 28,27 cm²", () => {
    expect(tube.A).toBeCloseTo(solid.A, 9);
  });

  it("плътен: i = 1,5 cm; λ = 266,7; F_cr = 207 261,7·63,62/160 000 = 82,4 kN; σ_cr = 29,1 MPa", () => {
    const i = radiusOfGyration(solid.I, solid.A);
    expect(i).toBeCloseTo(1.5, 12);
    const lambda = slenderness(400, 1, i);
    expect(lambda).toBeCloseTo(266.67, 2);
    const Fcr = eulerCriticalForce(E_STEEL, solid.I, 400);
    expect(Fcr).toBeCloseTo(82.41, 2);
    expect(criticalStress(E_STEEL, lambda)).toBeCloseTo(2.915, 3);
    expect(criticalStress(E_STEEL, lambda) * solid.A).toBeCloseTo(Fcr, 9);
    expect(isEulerValid(lambda, limit)).toBe(true);
  });

  it("тръба: i = 3,202 cm; λ = 124,9; F_cr = 207 261,7·289,81/160 000 = 375,4 kN; σ_cr = 132,8 MPa", () => {
    const i = radiusOfGyration(tube.I, tube.A);
    expect(i).toBeCloseTo(3.202, 3);
    const lambda = slenderness(400, 1, i);
    expect(lambda).toBeCloseTo(124.94, 2);
    const Fcr = eulerCriticalForce(E_STEEL, tube.I, 400);
    expect(Fcr).toBeCloseTo(375.42, 2);
    expect(criticalStress(E_STEEL, lambda)).toBeCloseTo(13.278, 3);
    expect(criticalStress(E_STEEL, lambda) * tube.A).toBeCloseTo(Fcr, 9);
    expect(isEulerValid(lambda, limit)).toBe(true);
  });

  it("отношение 375,4/82,4 = 4,56 = 5904/1296", () => {
    const ratio =
      eulerCriticalForce(E_STEEL, tube.I, 400) /
      eulerCriticalForce(E_STEEL, solid.I, 400);
    expect(ratio).toBeCloseTo(4.556, 3);
    expect(ratio).toBeCloseTo(5904 / 1296, 9);
  });

  it("„В реалния живот“: опора в средата на плътния прът – λ = 133,3; F_cr = 4·82,41 = 329,6 kN", () => {
    const i = radiusOfGyration(solid.I, solid.A);
    const lambda = slenderness(200, 1, i);
    expect(lambda).toBeCloseTo(133.33, 2);
    expect(isEulerValid(lambda, limit)).toBe(true);
    expect(eulerCriticalForce(E_STEEL, solid.I, 200)).toBeCloseTo(329.64, 2);
  });

  it("„В реалния живот“: същата опора при тръбата – λ = 62,5 < 101,8, Ойлер вече не важи", () => {
    const i = radiusOfGyration(tube.I, tube.A);
    const lambda = slenderness(200, 1, i);
    expect(lambda).toBeCloseTo(62.47, 2);
    expect(isEulerValid(lambda, limit)).toBe(false);
  });
});

describe("различно подпиране в двете главни равнини", () => {
  it("шина 3×6 cm, l = 2 m: шарнирна в двете равнини → меродавна е слабата ос (λ = 230,9)", () => {
    // i_слаба = 3/√12 = 0,866 cm; i_силна = 6/√12 = 1,732 cm
    const result = governingSlenderness(
      200,
      { mu: 1, i: 6 / Math.sqrt(12) },
      { mu: 1, i: 3 / Math.sqrt(12) },
    );
    expect(result.axis).toBe("y");
    expect(result.lambda).toBeCloseTo(230.94, 2);
    expect(result.lambdaX).toBeCloseTo(115.47, 2);
  });

  it("слабата ос запъната в двата края (μ = 0,5), силната – конзола (μ = 2): меродавна става силната ос", () => {
    // λ_x = 2·200/1,732 = 230,9; λ_y = 0,5·200/0,866 = 115,5
    const result = governingSlenderness(
      200,
      { mu: 2, i: 6 / Math.sqrt(12) },
      { mu: 0.5, i: 3 / Math.sqrt(12) },
    );
    expect(result.axis).toBe("x");
    expect(result.lambda).toBeCloseTo(230.94, 2);
    expect(result.lambdaY).toBeCloseTo(115.47, 2);
  });
});

describe("въпроси от „Провери се“", () => {
  it("„Леко“ 2: стоманен прът d = 2 cm, l = 1 m: I = π·16/64 = 0,785 cm⁴; F_cr = 207 261,7·0,785/100² = 16,3 kN", () => {
    expect(circleInertia(2)).toBeCloseTo(0.7854, 4);
    expect(eulerCriticalForce(E_STEEL, circleInertia(2), 100)).toBeCloseTo(
      16.28,
      2,
    );
    // λ = 100/0,5 = 200
    expect(
      slenderness(100, 1, radiusOfGyration(circleInertia(2), circleArea(2))),
    ).toBeCloseTo(200, 9);
  });

  it("„Подробно“ 1: дървен стълб 12×12 cm, 2,5 m, конзола: I = 1728 cm⁴; F_cr = 9,8696·1100·1728/500² = 75,0 kN; λ = 500/3,464 = 144,3", () => {
    const props = sectionProperties([{ b: 12, h: 12, x: 0, y: 0 }]);
    expect(props.Ix).toBeCloseTo(1728, 9);
    const mu = effectiveLengthFactor("fixed-free");
    expect(eulerCriticalForce(E_TIMBER, props.Ix, 250, mu)).toBeCloseTo(
      75.04,
      2,
    );
    expect(props.ix).toBeCloseTo(3.464, 3);
    expect(slenderness(250, mu, props.ix)).toBeCloseTo(144.34, 2);
  });

  it("„Подробно“ 2: шина 3×6 cm, l = 2 m, μ = 0,7: I_min = 6·27/12 = 13,5 cm⁴; i = 0,866 cm; λ = 140/0,866 = 161,7; F_cr = 207 261,7·13,5/140² = 142,8 kN", () => {
    const props = sectionProperties([{ b: 6, h: 3, x: 0, y: 0 }]);
    expect(props.I2).toBeCloseTo(13.5, 9);
    expect(props.A).toBeCloseTo(18, 12);
    const i = radiusOfGyration(props.I2, props.A);
    expect(i).toBeCloseTo(0.866, 3);
    const lambda = slenderness(200, 0.7, i);
    expect(lambda).toBeCloseTo(161.66, 2);
    expect(isEulerValid(lambda, limitSlenderness(E_STEEL, 20))).toBe(true);
    const Fcr = eulerCriticalForce(E_STEEL, props.I2, 200, 0.7);
    expect(Fcr).toBeCloseTo(142.76, 2);
    expect(criticalStress(E_STEEL, lambda) * props.A).toBeCloseTo(Fcr, 9);
  });

  it("„Подробно“ 3: прът d = 4 cm (i = 1 cm), λ_гр = 101,8 → l ≥ 101,8 cm ≈ 1,02 m", () => {
    const limit = limitSlenderness(E_STEEL, 20);
    const minLength = limit * 1;
    expect(minLength).toBeCloseTo(101.8, 1);
    expect(isEulerValid(slenderness(102, 1, 1), limit)).toBe(true);
    expect(isEulerValid(slenderness(101, 1, 1), limit)).toBe(false);
  });

  it("„Подробно“ 5: опора в средата → свободна дължина l/2 → F_cr расте 4 пъти", () => {
    const whole = eulerCriticalForce(E_STEEL, 80, 500);
    const braced = eulerCriticalForce(E_STEEL, 80, 250);
    expect(braced / whole).toBeCloseTo(4, 12);
  });
});
