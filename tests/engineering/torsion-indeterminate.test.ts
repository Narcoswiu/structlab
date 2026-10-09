import { describe, expect, it } from "vitest";
import {
  G_STEEL,
  polarModulus,
  polarMoment,
  radToDeg,
  solveFixedFixedShaft,
} from "@/lib/engineering/torsion";
import {
  RECT_TABLE,
  THIN_STRIP_COEFFICIENT,
  compositeShaftSplit,
  fixedFixedSplit,
  fixedFixedUniform,
  rectAlpha,
  rectBeta,
  rectMaxStress,
  rectTorsionInertia,
  rectTorsionModulus,
  rectTwistAngle,
  segmentStiffness,
  solveFixedFixedRound,
  thinOpenInertia,
} from "@/lib/engineering/torsion-indeterminate";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над проверката.
// Числата са тези, които се четат в Глава 17 „Усукване: правоъгълно сечение и
// статически неопределими валове“. G = 8100 kN/cm²; 1 kN·m = 100 kN·cm.

const G = G_STEEL;

/** Стойността от таблицата в главата (три значещи цифри). */
function table(ratio: number): { alpha: number; beta: number } {
  const row = RECT_TABLE.find((r) => r.ratio === ratio);
  if (!row) throw new Error(`Няма ред за h/b = ${ratio}.`);
  return row;
}

/**
 * Независима проверка № 1 за β: двоен ред на Навие (решение със синуси по
 * двете посоки), без хиперболични функции:
 * β = (256/π⁶)·r²·ΣΣ 1 / (m²·n²·(m² + n²·r²)),  m, n нечетни, r = h/b.
 */
function betaDoubleSeries(ratio: number, limit = 400): number {
  let sum = 0;
  for (let m = 1; m < limit; m += 2) {
    for (let n = 1; n < limit; n += 2) {
      sum += 1 / (m * m * n * n * (m * m + n * n * ratio * ratio));
    }
  }
  return (256 / Math.PI ** 6) * ratio * ratio * sum;
}

/**
 * Независима проверка № 2: функцията на напреженията Φ от ∇²Φ = −2 (G·θ = 1),
 * Φ = 0 по контура, решена с крайни разлики върху правоъгълник b = 1, h = r.
 * I_t = 2·∫Φ dA;  τ = |∂Φ/∂n| по контура.
 * Връща β, α и напреженията в средите на дългата и на късата страна.
 */
function finiteDifference(
  ratio: number,
  nx: number,
): { beta: number; alpha: number; tauLong: number; tauShort: number } {
  const ny = Math.round(nx * ratio);
  const step = 1 / nx;
  const phi: number[][] = Array.from({ length: nx + 1 }, () =>
    new Array<number>(ny + 1).fill(0),
  );
  const omega = 1.9;
  for (let iteration = 0; iteration < 4000; iteration++) {
    let change = 0;
    for (let i = 1; i < nx; i++) {
      for (let j = 1; j < ny; j++) {
        const target =
          (phi[i - 1]![j]! +
            phi[i + 1]![j]! +
            phi[i]![j - 1]! +
            phi[i]![j + 1]! +
            2 * step * step) /
          4;
        const delta = omega * (target - phi[i]![j]!);
        phi[i]![j]! += delta;
        change = Math.max(change, Math.abs(delta));
      }
    }
    if (change < 1e-13) break;
  }
  let integral = 0;
  for (let i = 1; i < nx; i++) {
    for (let j = 1; j < ny; j++) integral += phi[i]![j]!;
  }
  const beta = (2 * integral * step * step) / ratio;
  // едностранна производна от втори ред в средата на страната (Φ = 0 на контура)
  const midY = ny / 2;
  const midX = nx / 2;
  const tauLong = (4 * phi[1]![midY]! - phi[2]![midY]!) / (2 * step);
  const tauShort = (4 * phi[midX]![1]! - phi[midX]![2]!) / (2 * step);
  return { beta, alpha: beta / tauLong, tauLong, tauShort };
}

describe("вал с постоянно сечение между две запъвания", () => {
  it("Л1: d = 5 cm, l = 1,2 m, T = 3 kN·m на 0,4 m от A → T_A = 2, T_B = 1 kN·m", () => {
    // T_A = 3·0,8/1,2 = 2;  T_B = 3·0,4/1,2 = 1
    const split = fixedFixedUniform(3, 40, 80);
    expect(split.TA).toBeCloseTo(2, 12);
    expect(split.TB).toBeCloseTo(1, 12);
    expect(split.TA + split.TB).toBeCloseTo(3, 12);
  });

  it("Л1: W_p = 24,54 cm³; τ = 200/24,54 = 8,15 и 100/24,54 = 4,07 kN/cm²", () => {
    // 5³ = 125; 125/16 = 7,8125; ·π = 24,54
    expect(polarModulus(5).toFixed(2)).toBe("24.54");
    const shaft = solveFixedFixedRound(
      [
        { length: 40, D: 5, G },
        { length: 80, D: 5, G },
      ],
      [3],
    );
    expect(shaft.tau[0]!.toFixed(2)).toBe("8.15");
    expect(shaft.tau[1]!.toFixed(2)).toBe("4.07");
    // със закръгления W_p, както го смята читателят
    expect((200 / 24.54).toFixed(2)).toBe("8.15");
  });

  it("Л1: φ_C = 200·40/(8100·61,36) = 0,0161 rad = 0,92°; от B – същото", () => {
    // 5⁴ = 625; 625/32 = 19,53; ·π = 61,36
    expect(polarMoment(5).toFixed(2)).toBe("61.36");
    const shaft = solveFixedFixedRound(
      [
        { length: 40, D: 5, G },
        { length: 80, D: 5, G },
      ],
      [3],
    );
    expect(shaft.rotation[0]!.toFixed(4)).toBe("0.0161");
    expect(radToDeg(shaft.rotation[0]!).toFixed(2)).toBe("0.92");
    // 8000 / 497 016 = 0,0161 – и от двете страни
    expect(((200 * 40) / (8100 * 61.36)).toFixed(4)).toBe("0.0161");
    expect(((100 * 80) / (8100 * 61.36)).toFixed(4)).toBe("0.0161");
    // общият ъгъл между двете запъвания е нула
    expect(shaft.rotation[1]!).toBeCloseTo(0, 14);
  });

  it("моментът в средата се дели по равно", () => {
    const split = fixedFixedUniform(7, 90, 90);
    expect(split.TA).toBeCloseTo(3.5, 12);
    expect(split.TB).toBeCloseTo(3.5, 12);
  });

  it("въпрос (Леко 1): l = 3 m, T = 6 kN·m на 1 m от A → 4 и 2 kN·m", () => {
    // T_A = 6·2/3 = 4;  T_B = 6·1/3 = 2
    const split = fixedFixedUniform(6, 100, 200);
    expect(split.TA).toBeCloseTo(4, 12);
    expect(split.TB).toBeCloseTo(2, 12);
  });
});

describe("стъпаловиден вал между две запъвания (П1)", () => {
  const segments = [
    { length: 100, D: 8, G },
    { length: 50, D: 6, G },
  ];
  const k1 = segmentStiffness(G, polarMoment(8), 100);
  const k2 = segmentStiffness(G, polarMoment(6), 50);

  it("коравини: 8100·402,12/100 = 32 571,7 и 8100·127,23/50 = 20 611,3 kN·cm/rad", () => {
    expect(polarMoment(8).toFixed(2)).toBe("402.12");
    expect(polarMoment(6).toFixed(2)).toBe("127.23");
    expect(k1.toFixed(0)).toBe("32572");
    // точните стойности са 32 572,04 и 20 611,99; с печатаните I_p се получават 32 571,7 и 20 611,3
    expect(Math.abs(k2 - 20611)).toBeLessThan(1.5);
    expect(((8100 * 402.12) / 100).toFixed(1)).toBe("32571.7");
    expect(((8100 * 127.23) / 50).toFixed(1)).toBe("20611.3");
  });

  it("T_A = 10·32 571,7/53 183,0 = 6,124 kN·m; T_B = 3,876 kN·m", () => {
    const split = fixedFixedSplit(10, k1, k2);
    expect(split.TA.toFixed(3)).toBe("6.124");
    expect(split.TB.toFixed(3)).toBe("3.876");
    expect(split.TA + split.TB).toBeCloseTo(10, 12);
    // с печатаните закръглени коравини
    expect(((10 * 32571.7) / (32571.7 + 20611.3)).toFixed(3)).toBe("6.124");
  });

  it("по-коравият участък поема по-големия дял", () => {
    expect(k1).toBeGreaterThan(k2);
    const split = fixedFixedSplit(10, k1, k2);
    expect(split.TA).toBeGreaterThan(split.TB);
    expect(split.TA / split.TB).toBeCloseTo(k1 / k2, 12);
  });

  it("τ: 612,4/100,53 = 6,09 и 387,6/42,41 = 9,14 kN/cm² – меродавен е тънкият участък", () => {
    const shaft = solveFixedFixedRound(segments, [10]);
    expect(polarModulus(8).toFixed(2)).toBe("100.53");
    expect(polarModulus(6).toFixed(2)).toBe("42.41");
    expect(shaft.tau[0]!.toFixed(2)).toBe("6.09");
    expect(shaft.tau[1]!.toFixed(2)).toBe("9.14");
    expect((612.4 / 100.53).toFixed(2)).toBe("6.09");
    expect((387.6 / 42.41).toFixed(2)).toBe("9.14");
    expect(shaft.tau[1]!).toBeGreaterThan(shaft.tau[0]!);
  });

  it("φ_C = 612,4·100/(8100·402,12) = 0,0188 rad = 1,08°; от B – същото; общо нула", () => {
    const shaft = solveFixedFixedRound(segments, [10]);
    expect(shaft.rotation[0]!.toFixed(4)).toBe("0.0188");
    expect(radToDeg(shaft.rotation[0]!).toFixed(2)).toBe("1.08");
    expect(((612.4 * 100) / (8100 * 402.12)).toFixed(4)).toBe("0.0188");
    expect(((387.6 * 50) / (8100 * 127.23)).toFixed(4)).toBe("0.0188");
    expect(radToDeg(0.0188).toFixed(2)).toBe("1.08");
    expect(shaft.twist[0]! + shaft.twist[1]!).toBeCloseTo(0, 14);
    expect(shaft.T[0]!).toBeCloseTo(shaft.TA, 12);
    expect(shaft.T[1]!).toBeCloseTo(-shaft.TB, 12);
  });

  it("съвпада с независимото решение от Глава 8 (solveFixedFixedShaft)", () => {
    const mine = solveFixedFixedRound(segments, [10]);
    const other = solveFixedFixedShaft(segments, [10, 0]);
    expect(mine.TA).toBeCloseTo(other.reactionStart, 10);
    expect(mine.TB).toBeCloseTo(-other.reactionEnd, 10);
    expect(mine.tau[1]!).toBeCloseTo(other.tau[1]!, 10);
  });

  it("при еднакви сечения общата формула дава T·b/l и T·a/l", () => {
    const ka = segmentStiffness(G, polarMoment(5), 40);
    const kb = segmentStiffness(G, polarMoment(5), 80);
    const general = fixedFixedSplit(3, ka, kb);
    const uniform = fixedFixedUniform(3, 40, 80);
    expect(general.TA).toBeCloseTo(uniform.TA, 12);
    expect(general.TB).toBeCloseTo(uniform.TB, 12);
  });

  it("въпрос (Подробно 1): d = 4 cm, 0,4 m и d = 6 cm, 0,6 m; T = 5 → 1,14 и 3,86 kN·m", () => {
    // I_p/l: 25,13/40 = 0,628;  127,23/60 = 2,12;  5·0,628/2,748 = 1,14
    expect(polarMoment(4).toFixed(2)).toBe("25.13");
    expect((25.13 / 40).toFixed(3)).toBe("0.628");
    expect((127.23 / 60).toFixed(2)).toBe("2.12");
    const split = fixedFixedSplit(
      5,
      segmentStiffness(G, polarMoment(4), 40),
      segmentStiffness(G, polarMoment(6), 60),
    );
    expect(split.TA.toFixed(2)).toBe("1.14");
    expect(split.TB.toFixed(2)).toBe("3.86");
    expect(((5 * 0.628) / (0.628 + 2.12)).toFixed(2)).toBe("1.14");
  });
});

describe("вал с два момента между две запъвания (П2)", () => {
  const segment = { length: 100, D: 6, G };
  const shaft = solveFixedFixedRound([segment, segment, segment], [6, 3]);

  it("T_B = (9 + 3 + 0)/3 = 4 kN·m; T_A = 9 − 4 = 5 kN·m; диаграма +5; −1; −4", () => {
    expect(shaft.TB).toBeCloseTo(4, 12);
    expect(shaft.TA).toBeCloseTo(5, 12);
    expect(shaft.T[0]!).toBeCloseTo(5, 12);
    expect(shaft.T[1]!).toBeCloseTo(-1, 12);
    expect(shaft.T[2]!).toBeCloseTo(-4, 12);
    // равновесие и скокове
    expect(shaft.TA + shaft.TB).toBeCloseTo(6 + 3, 12);
    expect(shaft.T[0]! - shaft.T[1]!).toBeCloseTo(6, 12);
    expect(shaft.T[1]! - shaft.T[2]!).toBeCloseTo(3, 12);
  });

  it("τ_max = 500/42,41 = 11,79 kN/cm² = 117,9 MPa", () => {
    expect(shaft.tau[0]!.toFixed(2)).toBe("11.79");
    expect((500 / 42.41).toFixed(2)).toBe("11.79");
    expect(Math.max(...shaft.tau)).toBeCloseTo(shaft.tau[0]!, 12);
  });

  it("φ_C = 0,0485 rad = 2,78°; φ_D = 0,0485 − 0,0097 = 0,0388 rad = 2,22°; φ_B = 0", () => {
    // 50 000 / (8100·127,23) = 0,0485;  10 000 / … = 0,0097;  40 000 / … = 0,0388
    expect(shaft.rotation[0]!.toFixed(4)).toBe("0.0485");
    expect(Math.abs(shaft.twist[1]!).toFixed(4)).toBe("0.0097");
    expect(shaft.rotation[1]!.toFixed(4)).toBe("0.0388");
    expect((0.0485 - 0.0097).toFixed(4)).toBe("0.0388");
    expect((40000 / (8100 * 127.23)).toFixed(4)).toBe("0.0388");
    expect(radToDeg(shaft.rotation[0]!).toFixed(2)).toBe("2.78");
    expect(radToDeg(shaft.rotation[1]!).toFixed(2)).toBe("2.22");
    expect(radToDeg(0.0485).toFixed(2)).toBe("2.78");
    expect(radToDeg(0.0388).toFixed(2)).toBe("2.22");
    expect(shaft.rotation[2]!).toBeCloseTo(0, 14);
  });

  it("суперпозиция: двата момента поотделно дават същите опорни моменти", () => {
    // 6 kN·m на 1 m от A: T_A = 4, T_B = 2;  3 kN·m на 2 m от A: T_A = 1, T_B = 2
    const first = fixedFixedUniform(6, 100, 200);
    const second = fixedFixedUniform(3, 200, 100);
    expect(first.TA + second.TA).toBeCloseTo(shaft.TA, 12);
    expect(first.TB + second.TB).toBeCloseTo(shaft.TB, 12);
  });
});

describe("съставен вал", () => {
  it("въпрос (Подробно 5): сърцевина d = 4 cm (G = 8100), тръба 6/4 cm (G = 2700) → 42,5 %", () => {
    // G·I_p: 8100·25,13 = 203 553;  2700·102,10 = 275 670;  203 553/479 223 = 0,425
    expect(polarMoment(6, 4).toFixed(2)).toBe("102.10");
    expect((8100 * 25.13).toFixed(0)).toBe("203553");
    expect((2700 * 102.1).toFixed(0)).toBe("275670");
    const parts = compositeShaftSplit(1, [
      { G: 8100, Ip: polarMoment(4) },
      { G: 2700, Ip: polarMoment(6, 4) },
    ]);
    expect((parts[0]! * 100).toFixed(1)).toBe("42.5");
    expect(((203553 / (203553 + 275670)) * 100).toFixed(1)).toBe("42.5");
    expect(parts[0]! + parts[1]!).toBeCloseTo(1, 12);
    // еднакъв ъгъл на единица дължина в двете части
    expect(parts[0]! / (8100 * polarMoment(4))).toBeCloseTo(
      parts[1]! / (2700 * polarMoment(6, 4)),
      15,
    );
  });
});

describe("коефициенти на Сен-Венан за правоъгълно сечение", () => {
  it("квадрат: β = 0,141 и α = 0,208", () => {
    expect(rectBeta(1).toFixed(3)).toBe("0.141");
    expect(rectAlpha(1).toFixed(3)).toBe("0.208");
    expect(rectBeta(1)).toBeCloseTo(0.140577, 6);
    expect(rectAlpha(1)).toBeCloseTo(0.208165, 6);
  });

  it("тънка ивица: α и β клонят към 1/3", () => {
    expect(THIN_STRIP_COEFFICIENT).toBeCloseTo(1 / 3, 15);
    expect(rectBeta(1000)).toBeCloseTo(1 / 3, 3);
    expect(rectAlpha(1000)).toBeCloseTo(1 / 3, 3);
    expect(rectBeta(1e6)).toBeCloseTo(1 / 3, 6);
    // за h/b ≥ 4 важи β ≈ (1 − 0,630·b/h)/3, защото tanh ≈ 1
    expect(rectBeta(10)).toBeCloseTo((1 - 0.63 / 10) / 3, 4);
  });

  it("редовете са сходящи: 5 и 60 члена дават едно и също до шестия знак", () => {
    for (const ratio of [1, 1.5, 2, 3, 4, 6, 10]) {
      expect(rectBeta(ratio, 5)).toBeCloseTo(rectBeta(ratio, 60), 5);
      expect(rectAlpha(ratio, 5)).toBeCloseTo(rectAlpha(ratio, 60), 5);
    }
  });

  it("таблицата в главата е закръглението на редовете до три значещи цифри", () => {
    for (const row of RECT_TABLE) {
      expect(rectAlpha(row.ratio).toFixed(3)).toBe(row.alpha.toFixed(3));
      expect(rectBeta(row.ratio).toFixed(3)).toBe(row.beta.toFixed(3));
    }
    expect(RECT_TABLE.map((row) => row.ratio)).toEqual([
      1, 1.5, 2, 3, 4, 6, 10,
    ]);
  });

  it("α и β растат с h/b и α ≥ β", () => {
    for (let i = 1; i < RECT_TABLE.length; i++) {
      const previous = RECT_TABLE[i - 1]!.ratio;
      const current = RECT_TABLE[i]!.ratio;
      expect(rectBeta(current)).toBeGreaterThan(rectBeta(previous));
      expect(rectAlpha(current)).toBeGreaterThan(rectAlpha(previous));
      expect(rectAlpha(current)).toBeGreaterThanOrEqual(rectBeta(current));
    }
  });

  it("независима проверка: двойният ред на Навие дава същото β", () => {
    for (const ratio of [1, 1.5, 2, 4]) {
      expect(betaDoubleSeries(ratio)).toBeCloseTo(rectBeta(ratio), 5);
    }
  });

  it("независима проверка: крайни разлики за ∇²Φ = −2 дават същите α и β (до 1 %)", () => {
    for (const ratio of [1, 2, 3]) {
      const numeric = finiteDifference(ratio, 40);
      expect(Math.abs(numeric.beta / rectBeta(ratio) - 1)).toBeLessThan(0.01);
      expect(Math.abs(numeric.alpha / rectAlpha(ratio) - 1)).toBeLessThan(0.01);
    }
  });

  it("най-голямото напрежение е в средата на ДЪЛГАТА страна", () => {
    const numeric = finiteDifference(2, 40);
    expect(numeric.tauLong).toBeGreaterThan(numeric.tauShort);
    // при квадрат двете страни са равностойни
    const square = finiteDifference(1, 40);
    expect(square.tauLong).toBeCloseTo(square.tauShort, 8);
  });

  it("невалидно отношение", () => {
    expect(() => rectBeta(0.5)).toThrow();
    expect(() => rectAlpha(Number.NaN)).toThrow();
  });
});

describe("правоъгълен прът 3 × 6 cm (Л2)", () => {
  const { alpha, beta } = table(2);

  it("W_t = 0,246·6·9 = 13,28 cm³; τ_max = 60/13,28 = 4,52 kN/cm²", () => {
    const Wt = rectTorsionModulus(6, 3, alpha);
    expect(Wt.toFixed(2)).toBe("13.28");
    expect(rectMaxStress(0.6, Wt).toFixed(2)).toBe("4.52");
    expect((60 / 13.28).toFixed(2)).toBe("4.52");
    // с точния коефициент от реда – същото до третата цифра
    expect(
      rectMaxStress(0.6, rectTorsionModulus(6, 3, rectAlpha(2))).toFixed(2),
    ).toBe("4.52");
  });

  it("I_t = 0,229·6·27 = 37,10 cm⁴; φ = 6000/(8100·37,10) = 0,01997 rad = 1,14°", () => {
    const It = rectTorsionInertia(6, 3, beta);
    expect(It.toFixed(2)).toBe("37.10");
    const phi = rectTwistAngle(0.6, 100, G, It);
    expect(phi.toFixed(5)).toBe("0.01997");
    expect(radToDeg(phi).toFixed(2)).toBe("1.14");
    expect((6000 / (8100 * 37.1)).toFixed(5)).toBe("0.01997");
    expect(radToDeg(0.01997).toFixed(2)).toBe("1.14");
  });

  it("I_p = I_x + I_y = 13,5 + 54 = 67,5 cm⁴ е 1,82 пъти по-голям от I_t", () => {
    const Ip = (6 * 3 ** 3) / 12 + (3 * 6 ** 3) / 12;
    expect(Ip).toBeCloseTo(67.5, 12);
    expect((Ip / 37.1).toFixed(2)).toBe("1.82");
    expect((Ip / rectTorsionInertia(6, 3, rectBeta(2))).toFixed(2)).toBe(
      "1.82",
    );
  });
});

describe("правоъгълник, квадрат и кръг с еднаква площ 32 cm² (П3)", () => {
  it("правоъгълник 4 × 8: W_t = 31,49 cm³, I_t = 117,25 cm⁴, τ = 6,35 kN/cm², φ = 1,81°", () => {
    const { alpha, beta } = table(2);
    const Wt = rectTorsionModulus(8, 4, alpha);
    const It = rectTorsionInertia(8, 4, beta);
    // 0,246·8·16 = 31,488;  0,229·8·64 = 117,248
    expect(Wt.toFixed(2)).toBe("31.49");
    expect(It.toFixed(2)).toBe("117.25");
    expect(rectMaxStress(2, Wt).toFixed(2)).toBe("6.35");
    expect((200 / 31.49).toFixed(2)).toBe("6.35");
    const phi = rectTwistAngle(2, 150, G, It);
    expect(phi.toFixed(5)).toBe("0.03159");
    expect((30000 / (8100 * 117.25)).toFixed(5)).toBe("0.03159");
    expect(radToDeg(phi).toFixed(2)).toBe("1.81");
    expect(radToDeg(0.03159).toFixed(2)).toBe("1.81");
  });

  it("квадрат a = 5,657 cm: W_t = 37,65 cm³, I_t = 144,38 cm⁴, τ = 5,31 kN/cm², φ = 1,47°", () => {
    const { alpha, beta } = table(1);
    const a = Math.sqrt(32);
    expect(a.toFixed(3)).toBe("5.657");
    const Wt = rectTorsionModulus(a, a, alpha);
    const It = rectTorsionInertia(a, a, beta);
    // a³ = 32·5,657 = 181,02;  0,208·181,02 = 37,65;  a⁴ = 32² = 1024;  0,141·1024 = 144,38
    expect(Wt.toFixed(2)).toBe("37.65");
    expect(It.toFixed(2)).toBe("144.38");
    expect(rectMaxStress(2, Wt).toFixed(2)).toBe("5.31");
    expect((200 / 37.65).toFixed(2)).toBe("5.31");
    expect(radToDeg(rectTwistAngle(2, 150, G, It)).toFixed(2)).toBe("1.47");
    expect(radToDeg(30000 / (8100 * 144.38)).toFixed(2)).toBe("1.47");
  });

  it("кръг d = 6,383 cm: W_p = 51,06 cm³, I_p = 162,97 cm⁴, τ = 3,92 kN/cm², φ = 1,30°", () => {
    const d = Math.sqrt((4 * 32) / Math.PI);
    expect(d.toFixed(3)).toBe("6.383");
    expect(polarModulus(d).toFixed(2)).toBe("51.06");
    expect(polarMoment(d).toFixed(2)).toBe("162.97");
    expect((200 / polarModulus(d)).toFixed(2)).toBe("3.92");
    expect((200 / 51.06).toFixed(2)).toBe("3.92");
    expect(radToDeg(30000 / (8100 * polarMoment(d))).toFixed(2)).toBe("1.30");
    expect(radToDeg(30000 / (8100 * 162.97)).toFixed(2)).toBe("1.30");
  });

  it("квадрат срещу кръг с еднаква площ: 1,35 пъти по-голямо τ и 1,13 пъти по-голям ъгъл", () => {
    // от печатаните числа
    expect((5.31 / 3.92).toFixed(2)).toBe("1.35");
    expect((1.47 / 1.3).toFixed(2)).toBe("1.13");
    // точно, независимо от размера: W_t/W_p = 2·√π·α;  I_t/I_p = 2·π·β
    expect((1 / (2 * Math.sqrt(Math.PI) * rectAlpha(1))).toFixed(2)).toBe(
      "1.36",
    );
    expect(1 / (2 * Math.sqrt(Math.PI) * rectAlpha(1))).toBeCloseTo(1.3551, 3);
    expect((1 / (2 * Math.PI * rectBeta(1))).toFixed(2)).toBe("1.13");
    // кръгът е най-изгоден, после квадратът, после правоъгълникът
    const d = Math.sqrt((4 * 32) / Math.PI);
    const a = Math.sqrt(32);
    expect(polarMoment(d)).toBeGreaterThan(
      rectTorsionInertia(a, a, rectBeta(1)),
    );
    expect(rectTorsionInertia(a, a, rectBeta(1))).toBeGreaterThan(
      rectTorsionInertia(8, 4, rectBeta(2)),
    );
  });

  it("правоъгълник срещу кръг: 1,62 и 1,39 пъти", () => {
    expect((6.35 / 3.92).toFixed(2)).toBe("1.62");
    expect((1.81 / 1.3).toFixed(2)).toBe("1.39");
  });
});

describe("тънка ивица и срязана тръба (П4)", () => {
  it("затворена тръба 10/9 cm: I_p = π·(10 000 − 6561)/32 = 337,62 cm⁴", () => {
    expect(polarMoment(10, 9).toFixed(2)).toBe("337.62");
  });

  it("срязана: ивица 29,85 × 0,5 cm → I_t = 29,85·0,125/3 = 1,244 cm⁴; ≈ 270 пъти по-малко", () => {
    const length = Math.PI * 9.5;
    expect(length.toFixed(2)).toBe("29.85");
    const It = thinOpenInertia([{ h: length, t: 0.5 }]);
    expect(It.toFixed(3)).toBe("1.244");
    expect(((29.85 * 0.125) / 3).toFixed(3)).toBe("1.244");
    const ratio = polarMoment(10, 9) / It;
    expect(Math.round(ratio / 10) * 10).toBe(270);
    expect(Math.round(337.62 / 1.244 / 10) * 10).toBe(270);
    // тънкостенно приближение: 3·(r/t)² = 3·9,5² = 270,75
    expect(3 * (4.75 / 0.5) ** 2).toBeCloseTo(270.75, 10);
    // h/b ≈ 60: точният коефициент е 0,330 – приближението 1/3 греши с около 1 %
    expect(rectBeta(length / 0.5).toFixed(3)).toBe("0.330");
  });

  it("въпрос (Леко 4): двойна дебелина → 8 пъти по-голям I_t", () => {
    expect(
      thinOpenInertia([{ h: 20, t: 0.4 }]) /
        thinOpenInertia([{ h: 20, t: 0.2 }]),
    ).toBeCloseTo(8, 12);
  });

  it("профил от няколко ивици се събира", () => {
    // 10·1³/3 + 20·0,6³/3 = 3,333 + 1,44 = 4,773
    expect(
      thinOpenInertia([
        { h: 10, t: 1 },
        { h: 20, t: 0.6 },
      ]),
    ).toBeCloseTo(4.7733, 4);
  });
});

describe("въпроси за правоъгълно сечение", () => {
  it("Леко 3: квадрат 4 × 4 cm, T = 0,5 kN·m → W_t = 13,31 cm³, τ = 3,76 kN/cm²", () => {
    // 0,208·4·16 = 13,312;  50/13,31 = 3,76
    const Wt = rectTorsionModulus(4, 4, table(1).alpha);
    expect(Wt.toFixed(2)).toBe("13.31");
    expect(rectMaxStress(0.5, Wt).toFixed(2)).toBe("3.76");
    expect((50 / 13.31).toFixed(2)).toBe("3.76");
  });

  it("Подробно 2: шина 2 × 6 cm, T = 0,3 kN·m, l = 1 m → 4,68 kN/cm²; 0,0293 rad = 1,68°", () => {
    const { alpha, beta } = table(3);
    // W_t = 0,267·6·4 = 6,408;  30/6,408 = 4,68
    const Wt = rectTorsionModulus(6, 2, alpha);
    expect(Wt.toFixed(3)).toBe("6.408");
    expect(rectMaxStress(0.3, Wt).toFixed(2)).toBe("4.68");
    // I_t = 0,263·6·8 = 12,62;  3000/(8100·12,62) = 0,0293
    const It = rectTorsionInertia(6, 2, beta);
    expect(It.toFixed(2)).toBe("12.62");
    const phi = rectTwistAngle(0.3, 100, G, It);
    expect(phi.toFixed(4)).toBe("0.0293");
    expect((3000 / (8100 * 12.62)).toFixed(4)).toBe("0.0293");
    expect(radToDeg(phi).toFixed(2)).toBe("1.68");
    expect(radToDeg(0.0293).toFixed(2)).toBe("1.68");
  });
});

describe("невалидни входове", () => {
  it("хвърля грешка", () => {
    expect(() => segmentStiffness(0, 1, 1)).toThrow();
    expect(() => fixedFixedSplit(1, 0, 1)).toThrow();
    expect(() => fixedFixedUniform(1, 0, 1)).toThrow();
    expect(() => solveFixedFixedRound([{ length: 1, D: 1, G }], [])).toThrow();
    expect(() =>
      solveFixedFixedRound(
        [
          { length: 1, D: 1, G },
          { length: 1, D: 1, G },
        ],
        [1, 2],
      ),
    ).toThrow();
    expect(() => compositeShaftSplit(1, [])).toThrow();
    expect(() => rectTorsionModulus(2, 4, 0.2)).toThrow();
    expect(() => rectTorsionInertia(4, 0, 0.2)).toThrow();
    expect(() => rectMaxStress(1, 0)).toThrow();
    expect(() => rectTwistAngle(1, 0, G, 1)).toThrow();
    expect(() => thinOpenInertia([])).toThrow();
  });
});
