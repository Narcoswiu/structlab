import { describe, expect, it } from "vitest";
import {
  G_STEEL,
  circularArea,
  degPerMToRadPerCm,
  diameterForStiffness,
  diameterForStrength,
  equalStrengthTube,
  maxTorsionStress,
  polarModulus,
  polarMoment,
  radPerCmToDegPerM,
  radToDeg,
  solveFixedFixedShaft,
  solveShaft,
  torqueCapacity,
  torsionStress,
  twistAngle,
  twistRate,
} from "@/lib/engineering/torsion";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над проверката.
// Числата са тези, които се четат в Глава 8 „Усукване на кръгли пръти“.

/**
 * Независима проверка: I_p = ∫ρ² dA, сметнат числено по тънки пръстени
 * с площ 2π·ρ·Δρ (правило на средната точка), без формулата π·d⁴/32.
 */
function polarMomentNumeric(D: number, d = 0, rings = 20000): number {
  const inner = d / 2;
  const step = (D / 2 - inner) / rings;
  let sum = 0;
  for (let i = 0; i < rings; i++) {
    const rho = inner + (i + 0.5) * step;
    sum += rho * rho * 2 * Math.PI * rho * step;
  }
  return sum;
}

describe("геометрични характеристики на кръг и пръстен", () => {
  it("плътен кръг d = 6 cm: I_p = π·1296/32 = 127,23 cm⁴; W_p = π·216/16 = 42,41 cm³", () => {
    // 6⁴ = 1296; 1296/32 = 40,5; 40,5·π = 127,23
    expect(polarMoment(6).toFixed(2)).toBe("127.23");
    // 6³ = 216; 216/16 = 13,5; 13,5·π = 42,41
    expect(polarModulus(6).toFixed(2)).toBe("42.41");
    // A = π·36/4 = 9π = 28,27 cm²
    expect(circularArea(6).toFixed(2)).toBe("28.27");
  });

  it("тръба 10/8 cm: I_p = π·(10000 − 4096)/32 = 579,62 cm⁴; W_p = 579,62/5 = 115,92 cm³", () => {
    // 5904/32 = 184,5; 184,5·π = 579,62
    expect(polarMoment(10, 8).toFixed(2)).toBe("579.62");
    expect(polarModulus(10, 8).toFixed(2)).toBe("115.92");
    // A = π·(100 − 64)/4 = 9π = 28,27 cm² – същата като на кръга d = 6
    expect(circularArea(10, 8)).toBeCloseTo(circularArea(6), 12);
  });

  it("останалите сечения от главата", () => {
    // d = 8: 4096/32 = 128; 128π = 402,12;  512/16 = 32; 32π = 100,53
    expect(polarMoment(8).toFixed(2)).toBe("402.12");
    expect(polarModulus(8).toFixed(2)).toBe("100.53");
    // d = 5: 625/32 = 19,53125; ·π = 61,36;  125/16 = 7,8125; ·π = 24,54
    expect(polarMoment(5).toFixed(2)).toBe("61.36");
    expect(polarModulus(5).toFixed(2)).toBe("24.54");
    // d = 10: 10000/32 = 312,5; ·π = 981,75;  1000/16 = 62,5; ·π = 196,35
    expect(polarMoment(10).toFixed(2)).toBe("981.75");
    expect(polarModulus(10).toFixed(2)).toBe("196.35");
    expect(circularArea(10).toFixed(2)).toBe("78.54");
    // d = 4: 64/16 = 4; 4π = 12,57
    expect(polarModulus(4).toFixed(2)).toBe("12.57");
    // тръба 6/4: (1296 − 256)/32 = 32,5; ·π = 102,10;  102,10/3 = 34,03
    expect(polarMoment(6, 4).toFixed(2)).toBe("102.10");
    expect(polarModulus(6, 4).toFixed(2)).toBe("34.03");
  });

  it("независима проверка: числено ∫ρ² dA дава същия I_p", () => {
    expect(polarMomentNumeric(6)).toBeCloseTo(polarMoment(6), 4);
    expect(polarMomentNumeric(10, 8)).toBeCloseTo(polarMoment(10, 8), 4);
    expect(polarMomentNumeric(8)).toBeCloseTo(polarMoment(8), 4);
    expect(polarMomentNumeric(6, 4)).toBeCloseTo(polarMoment(6, 4), 4);
  });

  it("I_p = I_x + I_y: за кръг е два пъти π·d⁴/64 (Глава 2)", () => {
    expect(polarMoment(6)).toBeCloseTo(2 * ((Math.PI * 6 ** 4) / 64), 10);
  });

  it("W_p на пръстен НЕ е разлика от W_p на два кръга", () => {
    // грешното: π·(1000 − 512)/16 = 95,82 cm³; вярното е 115,92 cm³
    const wrong = polarModulus(10) - polarModulus(8);
    expect(wrong.toFixed(2)).toBe("95.82");
    expect(polarModulus(10, 8)).toBeGreaterThan(wrong + 20);
  });

  it("отказва невалидни сечения", () => {
    expect(() => polarMoment(0)).toThrow();
    expect(() => polarMoment(-6)).toThrow();
    expect(() => polarMoment(8, 8)).toThrow();
    expect(() => polarMoment(8, 10)).toThrow();
    expect(() => polarModulus(8, -1)).toThrow();
    expect(() => circularArea(Number.NaN)).toThrow();
  });
});

describe("пример Л1 / П1: плътен стоманен прът d = 6 cm, T = 2 kN·m, l = 1,5 m", () => {
  const Ip = polarMoment(6);
  const Wp = polarModulus(6);

  it("τ_max = 200/42,41 = 4,716 kN/cm² = 47,2 MPa", () => {
    // T = 2 kN·m = 200 kN·cm
    const tau = maxTorsionStress(2, Wp);
    expect(tau.toFixed(3)).toBe("4.716");
    expect((tau * 10).toFixed(1)).toBe("47.2");
    // същото по τ = T·ρ/I_p с ρ = 3 cm
    expect(torsionStress(2, Ip, 3)).toBeCloseTo(tau, 12);
  });

  it("на половината радиус (ρ = 1,5 cm): 200·1,5/127,23 = 2,358 kN/cm² = 23,6 MPa; в оста – нула", () => {
    expect(torsionStress(2, Ip, 1.5).toFixed(3)).toBe("2.358");
    expect((torsionStress(2, Ip, 1.5) * 10).toFixed(1)).toBe("23.6");
    expect(torsionStress(2, Ip, 1.5)).toBeCloseTo(
      maxTorsionStress(2, Wp) / 2,
      12,
    );
    expect(torsionStress(2, Ip, 0)).toBe(0);
  });

  it("φ = 200·150/(8100·127,23) = 30 000/1 030 600 = 0,02911 rad = 1,67°", () => {
    // G·I_p = 8100·127,23 = 1 030 600 kN·cm²
    expect((G_STEEL * Ip).toFixed(0)).toBe("1030599");
    const phi = twistAngle(2, 150, G_STEEL, Ip);
    expect(phi.toFixed(5)).toBe("0.02911");
    // 0,02911·180/π = 1,668°
    expect(radToDeg(phi).toFixed(2)).toBe("1.67");
  });

  it("θ = 0,02911/150 = 1,941·10⁻⁴ rad/cm = 1,11 °/m", () => {
    const theta = twistRate(2, G_STEEL, Ip);
    expect((theta * 1e4).toFixed(3)).toBe("1.941");
    // 1,941·10⁻⁴ · 180/π · 100 = 1,112 °/m
    expect(radPerCmToDegPerM(theta).toFixed(2)).toBe("1.11");
  });

  it("моментът от напреженията е точно T: ∫τ·ρ dA = T (числено)", () => {
    // статичната страна на извода, проверена без формулата за I_p
    const rings = 20000;
    const step = 3 / rings;
    let sum = 0;
    for (let i = 0; i < rings; i++) {
      const rho = (i + 0.5) * step;
      sum += torsionStress(2, Ip, rho) * rho * 2 * Math.PI * rho * step;
    }
    expect(sum).toBeCloseTo(200, 4); // kN·cm
  });
});

describe("пример Л2: същата площ като тръба 10/8 cm, T = 2 kN·m", () => {
  const Ip = polarMoment(10, 8);
  const Wp = polarModulus(10, 8);

  it("τ_max = 200/115,92 = 1,725 kN/cm² = 17,3 MPa", () => {
    expect(maxTorsionStress(2, Wp).toFixed(3)).toBe("1.725");
    expect((maxTorsionStress(2, Wp) * 10).toFixed(1)).toBe("17.3");
  });

  it("на вътрешния контур (ρ = 4 cm): 200·4/579,62 = 1,380 kN/cm² = 13,8 MPa – 80 % от τ_max", () => {
    const inner = torsionStress(2, Ip, 4);
    expect(inner.toFixed(3)).toBe("1.380");
    expect(inner / maxTorsionStress(2, Wp)).toBeCloseTo(0.8, 12);
  });

  it("φ = 200·150/(8100·579,62) = 0,00639 rad = 0,37°", () => {
    const phi = twistAngle(2, 150, G_STEEL, Ip);
    expect(phi.toFixed(5)).toBe("0.00639");
    expect(radToDeg(phi).toFixed(2)).toBe("0.37");
  });

  it("при равна площ тръбата е 2,73 пъти по-яка и 4,56 пъти по-корава", () => {
    // точно: W_p: 5904/(10·216) = 2,7333;  I_p: 5904/1296 = 4,5556
    expect(Wp / polarModulus(6)).toBeCloseTo(5904 / 2160, 12);
    expect(Ip / polarMoment(6)).toBeCloseTo(5904 / 1296, 12);
    expect((Wp / polarModulus(6)).toFixed(2)).toBe("2.73");
    expect((Ip / polarMoment(6)).toFixed(2)).toBe("4.56");
    // напрежението пада в същото отношение: 47,2/17,3
    expect(
      maxTorsionStress(2, polarModulus(6)) / maxTorsionStress(2, Wp),
    ).toBeCloseTo(5904 / 2160, 12);
  });
});

describe("пример П2: стъпаловиден прът, запънат в A, с моменти 2,5 и 1,5 kN·m", () => {
  // AB: l = 80 cm, d = 8 cm; BC: l = 60 cm, d = 5 cm
  const result = solveShaft(
    [
      { length: 80, D: 8, G: G_STEEL },
      { length: 60, D: 5, G: G_STEEL },
    ],
    [2.5, 1.5],
  );

  it("диаграма на T: 1,5 + 2,5 = 4,0 kN·m в AB и 1,5 kN·m в BC", () => {
    expect(result.T).toEqual([4, 1.5]);
  });

  it("τ: 400/100,53 = 3,979 kN/cm² (39,8 MPa) и 150/24,54 = 6,112 kN/cm² (61,1 MPa)", () => {
    expect(result.tau[0]!.toFixed(3)).toBe("3.979");
    expect(result.tau[1]!.toFixed(3)).toBe("6.112");
    expect((result.tau[0]! * 10).toFixed(1)).toBe("39.8");
    expect((result.tau[1]! * 10).toFixed(1)).toBe("61.1");
  });

  it("φ_AB = 400·80/(8100·402,12) = 0,009824 rad; φ_BC = 150·60/(8100·61,36) = 0,018108 rad", () => {
    // 32 000/3 257 200 = 0,009824;  9000/497 010 = 0,018108
    expect(result.twist[0]!.toFixed(6)).toBe("0.009824");
    expect(result.twist[1]!.toFixed(6)).toBe("0.018108");
  });

  it("φ_B = 0,56°; φ_C = 0,009824 + 0,018108 = 0,027933 rad = 1,60°", () => {
    expect(result.rotation[0]).toBeCloseTo(result.twist[0]!, 15);
    expect(result.rotation[1]!.toFixed(6)).toBe("0.027933");
    expect(radToDeg(result.rotation[0]!).toFixed(2)).toBe("0.56");
    expect(radToDeg(result.rotation[1]!).toFixed(2)).toBe("1.60");
  });

  it("отказва невалидни данни", () => {
    expect(() => solveShaft([], [])).toThrow();
    expect(() => solveShaft([{ length: 80, D: 8, G: 8100 }], [1, 2])).toThrow();
    expect(() => solveShaft([{ length: 0, D: 8, G: 8100 }], [1])).toThrow();
    expect(() => solveShaft([{ length: 80, D: 8, G: 0 }], [1])).toThrow();
    expect(() =>
      solveShaft([{ length: 80, D: 8, d: 9, G: 8100 }], [1]),
    ).toThrow();
  });
});

describe("пример П3: оразмеряване при T = 6 kN·m, τ_доп = 8 kN/cm², θ_доп = 0,5 °/m", () => {
  it("по якост: d ≥ ∛(16·600/(π·8)) = ∛381,97 = 7,26 cm", () => {
    expect(((16 * 600) / (Math.PI * 8)).toFixed(2)).toBe("381.97");
    const d = diameterForStrength(6, 8);
    expect(d.toFixed(2)).toBe("7.26");
    // обратно заместване: при този диаметър τ_max е точно допустимото
    expect(maxTorsionStress(6, polarModulus(d))).toBeCloseTo(8, 10);
  });

  it("θ_доп = 0,5·π/180/100 = 8,727·10⁻⁵ rad/cm; 1 °/m = 1,7453·10⁻⁴ rad/cm", () => {
    expect((degPerMToRadPerCm(0.5) * 1e5).toFixed(3)).toBe("8.727");
    expect((degPerMToRadPerCm(1) * 1e4).toFixed(4)).toBe("1.7453");
    expect(radPerCmToDegPerM(degPerMToRadPerCm(0.5))).toBeCloseTo(0.5, 12);
  });

  it("по коравина: d ≥ ⁴√(32·600/(π·8100·8,727·10⁻⁵)) = ⁴√8646 = 9,64 cm – меродавно", () => {
    const radicand = (32 * 600) / (Math.PI * 8100 * degPerMToRadPerCm(0.5));
    expect(radicand.toFixed(0)).toBe("8646");
    const d = diameterForStiffness(6, G_STEEL, 0.5);
    expect(d.toFixed(2)).toBe("9.64");
    expect(d).toBeGreaterThan(diameterForStrength(6, 8));
    // обратно заместване: при този диаметър θ е точно 0,5 °/m
    expect(
      radPerCmToDegPerM(twistRate(6, G_STEEL, polarMoment(d))),
    ).toBeCloseTo(0.5, 10);
  });

  it("приет d = 10 cm: τ_max = 600/196,35 = 3,056 kN/cm² = 30,6 MPa; θ = 0,432 °/m", () => {
    const tau = maxTorsionStress(6, polarModulus(10));
    expect(tau.toFixed(3)).toBe("3.056");
    expect((tau * 10).toFixed(1)).toBe("30.6");
    // θ = 600/(8100·981,75) = 600/7 952 156 = 7,545·10⁻⁵ rad/cm
    const theta = twistRate(6, G_STEEL, polarMoment(10));
    expect((theta * 1e5).toFixed(3)).toBe("7.545");
    expect(radPerCmToDegPerM(theta).toFixed(3)).toBe("0.432");
  });

  it("отказва неположителни допустими стойности", () => {
    expect(() => diameterForStrength(6, 0)).toThrow();
    expect(() => diameterForStiffness(6, 8100, 0)).toThrow();
    expect(() => diameterForStiffness(6, 0, 0.5)).toThrow();
  });
});

describe("пример П4: тръба с d/D = 0,8 и същия W_p като плътен прът d = 10 cm", () => {
  const tube = equalStrengthTube(10, 0.8);

  it("D = 10/∛(1 − 0,8⁴) = 10/∛0,5904 = 10/0,8389 = 11,92 cm; d = 0,8·D = 9,54 cm", () => {
    expect(1 - 0.8 ** 4).toBeCloseTo(0.5904, 12);
    expect(Math.cbrt(0.5904).toFixed(4)).toBe("0.8389");
    expect(tube.D.toFixed(2)).toBe("11.92");
    expect(tube.d.toFixed(2)).toBe("9.54");
    expect(polarModulus(tube.D, tube.d)).toBeCloseTo(polarModulus(10), 9);
  });

  it("площ 40,18 cm² срещу 78,54 cm²: тръбата е с 48,8 % по-лека", () => {
    const area = circularArea(tube.D, tube.d);
    expect(area.toFixed(2)).toBe("40.18");
    // 1 − 40,18/78,54 = 0,4885
    expect(((1 - area / circularArea(10)) * 100).toFixed(1)).toBe("48.8");
  });

  it("I_p = W_p·D/2 = 196,35·5,960 = 1170,3 cm⁴ – с 19 % повече от 981,75 cm⁴", () => {
    const Ip = polarMoment(tube.D, tube.d);
    expect(Ip.toFixed(1)).toBe("1170.3");
    expect((Ip / polarMoment(10)).toFixed(2)).toBe("1.19");
  });

  it("отказва невалидно отношение d/D", () => {
    expect(() => equalStrengthTube(10, 1)).toThrow();
    expect(() => equalStrengthTube(10, -0.1)).toThrow();
    expect(() => equalStrengthTube(0, 0.8)).toThrow();
  });
});

describe("пример П5: прът d = 8 cm, запънат в двата края, T = 8 kN·m на 0,5 m от A", () => {
  // l = 2 m: a = 50 cm, b = 150 cm
  const result = solveFixedFixedShaft(
    [
      { length: 50, D: 8, G: G_STEEL },
      { length: 150, D: 8, G: G_STEEL },
    ],
    [8, 0],
  );

  it("T_A = T·b/l = 8·1,5/2 = 6 kN·m; T_B = T·a/l = 8·0,5/2 = 2 kN·m", () => {
    expect(result.reactionStart).toBeCloseTo(6, 12);
    expect(Math.abs(result.reactionEnd)).toBeCloseTo(2, 12);
    // двата участъка се усукват в противоположни посоки
    expect(result.T[0]).toBeCloseTo(6, 12);
    expect(result.T[1]).toBeCloseTo(-2, 12);
    // равновесие: T_A + T_B = 8
    expect(result.T[0]! - result.T[1]!).toBeCloseTo(8, 12);
  });

  it("τ: 600/100,53 = 5,968 kN/cm² (59,7 MPa) и 200/100,53 = 1,989 kN/cm² (19,9 MPa)", () => {
    expect(result.tau[0]!.toFixed(3)).toBe("5.968");
    expect(result.tau[1]!.toFixed(3)).toBe("1.989");
    expect((result.tau[0]! * 10).toFixed(1)).toBe("59.7");
    expect((result.tau[1]! * 10).toFixed(1)).toBe("19.9");
  });

  it("завъртане на натовареното сечение: 600·50/(8100·402,12) = 0,009210 rad = 0,53°", () => {
    expect(result.rotation[0]!.toFixed(6)).toBe("0.009210");
    expect(radToDeg(result.rotation[0]!).toFixed(2)).toBe("0.53");
    // от другата страна: 200·150/(8100·402,12) – същото число
    expect(twistAngle(2, 150, G_STEEL, polarMoment(8))).toBeCloseTo(
      result.rotation[0]!,
      12,
    );
  });

  it("съвместимост: вторият край не се завърта", () => {
    expect(result.rotation[1]).toBeCloseTo(0, 12);
  });

  it("момент на една трета от дължината: T_A = 2T/3, T_B = T/3 (въпрос 5)", () => {
    const third = solveFixedFixedShaft(
      [
        { length: 100, D: 8, G: G_STEEL },
        { length: 200, D: 8, G: G_STEEL },
      ],
      [9, 0],
    );
    expect(third.T[0]).toBeCloseTo(6, 12);
    expect(third.T[1]).toBeCloseTo(-3, 12);
  });

  it("в запънатия край не се задава момент", () => {
    expect(() =>
      solveFixedFixedShaft([{ length: 50, D: 8, G: G_STEEL }], [1]),
    ).toThrow();
  });
});

describe("числата от „Провери се“", () => {
  it("Леко 2: d = 4 cm, T = 0,5 kN·m → 50/12,57 = 3,98 kN/cm² = 39,8 MPa", () => {
    const tau = maxTorsionStress(0.5, polarModulus(4));
    expect(tau.toFixed(2)).toBe("3.98");
    expect((tau * 10).toFixed(1)).toBe("39.8");
  });

  it("Леко 3: двоен диаметър → τ_max пада 8 пъти, ъгълът – 16 пъти", () => {
    expect(polarModulus(12) / polarModulus(6)).toBeCloseTo(8, 12);
    expect(polarMoment(12) / polarMoment(6)).toBeCloseTo(16, 12);
  });

  it("Подробно 1: d = 5 cm, l = 2 m, T = 1,2 kN·m → 120·200/(8100·61,36) = 0,04829 rad = 2,77°", () => {
    const phi = twistAngle(1.2, 200, G_STEEL, polarMoment(5));
    expect(phi.toFixed(5)).toBe("0.04829");
    expect(radToDeg(phi).toFixed(2)).toBe("2.77");
  });

  it("Подробно 2: тръба 6/4 cm, τ_доп = 6 kN/cm² → T = 34,03·6 = 204,2 kN·cm = 2,04 kN·m", () => {
    const capacity = torqueCapacity(polarModulus(6, 4), 6);
    expect((capacity * 100).toFixed(1)).toBe("204.2");
    expect(capacity.toFixed(2)).toBe("2.04");
    expect(() => torqueCapacity(0, 6)).toThrow();
  });

  it("Подробно 4: T = 3 kN·m, τ_доп = 6 kN/cm² → d ≥ ∛(16·300/(π·6)) = ∛254,65 = 6,34 cm", () => {
    expect(((16 * 300) / (Math.PI * 6)).toFixed(2)).toBe("254.65");
    expect(diameterForStrength(3, 6).toFixed(2)).toBe("6.34");
  });
});

describe("модул на срязване и защитни проверки", () => {
  it("G = E/(2·(1 + ν)) = 21000/2,6 = 8077 kN/cm² ≈ 8100 kN/cm² (EN 1993-1-1)", () => {
    expect((21000 / (2 * (1 + 0.3))).toFixed(0)).toBe("8077");
    expect(G_STEEL).toBe(8100);
    expect(Math.abs(G_STEEL - 21000 / 2.6) / G_STEEL).toBeLessThan(0.005);
  });

  it("отказва неположителни I_p, W_p, G и дължина", () => {
    expect(() => torsionStress(2, 0, 1)).toThrow();
    expect(() => torsionStress(2, 100, -1)).toThrow();
    expect(() => maxTorsionStress(2, 0)).toThrow();
    expect(() => twistRate(2, 0, 100)).toThrow();
    expect(() => twistRate(2, 8100, 0)).toThrow();
    expect(() => twistAngle(2, 0, 8100, 100)).toThrow();
  });

  it("знакът на T се запазва в τ(ρ) и φ, а τ_max е по абсолютна стойност", () => {
    expect(torsionStress(-2, 127.23, 3)).toBeCloseTo(
      -torsionStress(2, 127.23, 3),
      12,
    );
    expect(twistAngle(-2, 150, 8100, 127.23)).toBeLessThan(0);
    expect(maxTorsionStress(-2, 42.41)).toBeCloseTo(
      maxTorsionStress(2, 42.41),
      12,
    );
  });
});
