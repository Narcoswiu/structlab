import { describe, expect, it } from "vitest";
import type { Beam } from "@/lib/engineering/beam";
import {
  elasticCurve,
  flexuralRigidity,
  rectangleInertia,
  simpleBeamDistributedAt,
  simpleBeamOffCentreForce,
  standardDeflection,
} from "@/lib/engineering/deflection";
import {
  SHEAR_COEFFICIENT_RECTANGLE,
  conjugatePoint,
  deflectionAt,
  fictitiousLoadAt,
  fictitiousReactions,
  fictitiousResultant,
  rectangleShearShareMidForce,
  reducedMoment,
  shearDeflection,
  shearDeflectionSimpleBeam,
  slopeAt,
  standardShearDeflection,
  zeroSlopeSection,
  type BeamPoint,
  type MohrBeam,
} from "@/lib/engineering/mohr-analogy";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над проверката.
// Числата са тези, които се четат в Глава 16 „Аналогия на Мор за еластичната линия“.

/** Дървената греда 10 × 20 cm от Глава 7: E·I = 1100·6666,67/10⁴ = 733,33 kN·m². */
const EI_TIMBER = flexuralRigidity(1100, rectangleInertia(10, 20));
/** Стоманената греда 4 × 10 cm: E·I = 21000·333,33/10⁴ = 700 kN·m². */
const EI_STEEL = flexuralRigidity(21000, rectangleInertia(4, 10));

/**
 * Независима проверка: числено двойно интегриране на w″ = −M/(E·I) по правилото
 * на средната точка (библиотеката интегрира аналитично, участък по участък).
 * Връща φ и w във всички възли след налагане на граничните условия.
 */
function integrateTwice(
  curvature: (x: number) => number, // M/(E·I) в 1/m
  l: number,
  support: "simple" | "fixed-left",
  n = 60000,
) {
  const h = l / n;
  const phi = [0];
  const w = [0];
  for (let i = 0; i < n; i++) {
    const kMid = curvature((i + 0.5) * h);
    const phiNext = phi[i]! - kMid * h;
    // φ е линеен в стъпката (при постоянна кривина в нея) → трапец
    w.push(w[i]! + ((phi[i]! + phiNext) / 2) * h);
    phi.push(phiNext);
  }
  // общо решение: w + C·x + D; запъване вляво → C = D = 0; проста греда → w(l) = 0
  const C = support === "simple" ? -w[n]! / l : 0;
  return {
    phiAt: (x: number) => phi[Math.round(x / h)]! + C,
    wAt: (x: number) => w[Math.round(x / h)]! + C * x,
  };
}

/** ∫ f dx по правилото на средната точка. */
function midpoint(f: (x: number) => number, a: number, b: number, n = 200000) {
  const h = (b - a) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += f(a + (i + 0.5) * h);
  return sum * h;
}

// ---------- гредите от главата ----------

/** Пример А: проста греда l = 6 m, F = 4 kN в средата; M_max = 4·6/4 = 6 kN·m. */
const beamA: MohrBeam = {
  length: 6,
  support: "simple",
  pieces: [
    { x1: 0, x2: 3, m1: 0, m2: 6, EI: EI_TIMBER },
    { x1: 3, x2: 6, m1: 6, m2: 0, EI: EI_TIMBER },
  ],
};

/** Пример Б: конзола, запъната вляво, l = 2 m, F = 6 kN в края; M(0) = −12 kN·m. */
const beamB: MohrBeam = {
  length: 2,
  support: "fixed-left",
  pieces: [{ x1: 0, x2: 2, m1: -12, m2: 0, EI: EI_TIMBER }],
};

/** Пример В: проста греда l = 4 m, q = 4 kN/m; парабола с връх q·l²/8 = 8 kN·m. */
const beamC: MohrBeam = {
  length: 4,
  support: "simple",
  pieces: [{ x1: 0, x2: 4, m1: 0, m2: 0, mMid: 8, EI: EI_TIMBER }],
};

/** Пример Г: l = 6 m, F = 20 kN в средата; E·I = 4000 в крайните третини, 8000 в средната. */
const beamD: MohrBeam = {
  length: 6,
  support: "simple",
  pieces: [
    { x1: 0, x2: 2, m1: 0, m2: 20, EI: 4000 },
    { x1: 2, x2: 3, m1: 20, m2: 30, EI: 8000 },
    { x1: 3, x2: 4, m1: 30, m2: 20, EI: 8000 },
    { x1: 4, x2: 6, m1: 20, m2: 0, EI: 4000 },
  ],
};

describe("правила за спрегнатата греда", () => {
  it("проста → проста; запъване ↔ свободен край; междинна опора ↔ става", () => {
    expect(conjugatePoint("end-support")).toBe("end-support");
    expect(conjugatePoint("fixed-end")).toBe("free-end");
    expect(conjugatePoint("free-end")).toBe("fixed-end");
    expect(conjugatePoint("inner-support")).toBe("inner-hinge");
    expect(conjugatePoint("inner-hinge")).toBe("inner-support");
  });

  it("правилото е взаимно: приложено два пъти, връща същата точка", () => {
    const all: BeamPoint[] = [
      "end-support",
      "fixed-end",
      "free-end",
      "inner-support",
      "inner-hinge",
    ];
    for (const point of all) {
      expect(conjugatePoint(conjugatePoint(point))).toBe(point);
    }
  });

  it("въпрос 1 (Подробно): греда с конзолен край A–B–C → опора, става, запъване", () => {
    const real: BeamPoint[] = ["end-support", "inner-support", "free-end"];
    expect(real.map(conjugatePoint)).toEqual([
      "end-support",
      "inner-hinge",
      "fixed-end",
    ]);
  });
});

describe("Пример А: проста греда със сила в средата (l = 6 m, F = 4 kN)", () => {
  it("коравината е 733,33 kN·m²", () => {
    // I = 10·20³/12 = 6666,67 cm⁴; 1100·6666,67 = 7 333 333 kN·cm² = 733,33 kN·m²
    expect(EI_TIMBER.toFixed(2)).toBe("733.33");
  });

  it("площи: всяка половина 9 kN·m², общо 18 kN·m², център в средата", () => {
    // Ω = 3·6/2 = 9 за половина; 2·9 = 18
    const r = fictitiousResultant(beamA);
    expect(r.omega * EI_TIMBER).toBeCloseTo(18, 9);
    expect(r.xc).toBeCloseTo(3, 9);
  });

  it("фиктивни реакции по 9 kN·m²; φ_A = 0,01227 rad", () => {
    // A_f = B_f = 18/2 = 9; φ_A = 9/733,33 = 0,012273
    const { A, B } = fictitiousReactions(beamA);
    expect(A * EI_TIMBER).toBeCloseTo(9, 9);
    expect(B * EI_TIMBER).toBeCloseTo(9, 9);
    expect(slopeAt(beamA, 0).toFixed(5)).toBe("0.01227");
    // при дясната опора ъгълът е обратен: −B_f
    expect(slopeAt(beamA, 6)).toBeCloseTo(-B, 12);
  });

  it("M_f в средата = 27 − 9 = 18 kN·m³; f = 2,45 cm", () => {
    // M_f = 9·3 − 9·1 = 18; f = 18/733,33 = 0,024545 m
    const f = deflectionAt(beamA, 3);
    expect(f * EI_TIMBER).toBeCloseTo(18, 9);
    expect(f.toFixed(4)).toBe("0.0245");
    expect((f * 100).toFixed(2)).toBe("2.45");
  });

  it("с отпечатаните закръглени числа: 18/733,33 = 0,0245; 9/733,33 = 0,01227", () => {
    expect((18 / 733.33).toFixed(4)).toBe("0.0245");
    expect((9 / 733.33).toFixed(5)).toBe("0.01227");
    // проверката в текста: 864/35 200 и 144/11 733,3
    expect((864 / 35200).toFixed(4)).toBe("0.0245");
    expect((144 / 11733.3).toFixed(5)).toBe("0.01227");
  });

  it("съвпада с формулите от Глава 7: F·l³/(48·E·I) и F·l²/(16·E·I)", () => {
    const closed = standardDeflection("simple-force-mid", 4, 6, EI_TIMBER);
    expect(deflectionAt(beamA, 3)).toBeCloseTo(closed.f, 12);
    expect(slopeAt(beamA, 0)).toBeCloseTo(closed.phi, 12);
  });

  it("съвпада с численото двойно интегриране на M/(E·I)", () => {
    const M = (x: number) => (x <= 3 ? 2 * x : 2 * (6 - x));
    const num = integrateTwice((x) => M(x) / EI_TIMBER, 6, "simple");
    expect(deflectionAt(beamA, 3)).toBeCloseTo(num.wAt(3), 8);
    expect(deflectionAt(beamA, 1.5)).toBeCloseTo(num.wAt(1.5), 8);
    expect(slopeAt(beamA, 0)).toBeCloseTo(num.phiAt(0), 8);
    expect(slopeAt(beamA, 4.5)).toBeCloseTo(num.phiAt(4.5), 8);
  });

  it("в средата Q_f = 0 – там е най-голямото провисване", () => {
    expect(slopeAt(beamA, 3)).toBeCloseTo(0, 12);
    expect(zeroSlopeSection(beamA, 1, 5)).toBeCloseTo(3, 9);
  });
});

describe("Пример Б: конзола със сила в края (l = 2 m, F = 6 kN)", () => {
  it("фиктивният товар сочи нагоре: Ω = −12 kN·m², на 2/3 m от запъването", () => {
    // |Ω| = 2·12/2 = 12; центърът на триъгълника е на l/3 от по-голямата ордината
    const r = fictitiousResultant(beamB);
    expect(r.omega * EI_TIMBER).toBeCloseTo(-12, 9);
    expect(r.xc).toBeCloseTo(2 / 3, 9);
    expect(fictitiousLoadAt(beamB, 0) * EI_TIMBER).toBeCloseTo(-12, 9);
    expect(fictitiousLoadAt(beamB, 2, "left")).toBeCloseTo(0, 12);
  });

  it("φ в свободния край = 12/733,33 = 0,01636 rad, по часовниковата стрелка", () => {
    const phi = slopeAt(beamB, 2);
    expect(phi * EI_TIMBER).toBeCloseTo(12, 9);
    expect(phi.toFixed(5)).toBe("0.01636");
    expect((12 / 733.33).toFixed(5)).toBe("0.01636");
  });

  it("M_f в свободния край = 12·1,333 = 16 kN·m³; f = 2,18 cm надолу", () => {
    // рамо 2 − 2/3 = 1,333 m; f = 16/733,33 = 0,021818 m
    const f = deflectionAt(beamB, 2);
    expect(f * EI_TIMBER).toBeCloseTo(16, 9);
    expect(f.toFixed(5)).toBe("0.02182");
    expect((16 / 733.33).toFixed(5)).toBe("0.02182");
    expect((f * 100).toFixed(2)).toBe("2.18");
  });

  it("в запъването (свободния край на фиктивната греда) φ = 0 и w = 0", () => {
    expect(slopeAt(beamB, 0)).toBeCloseTo(0, 15);
    expect(deflectionAt(beamB, 0)).toBeCloseTo(0, 15);
  });

  it("съвпада с формулите от Глава 7: F·l³/(3·E·I) и F·l²/(2·E·I)", () => {
    const closed = standardDeflection("cantilever-force", 6, 2, EI_TIMBER);
    expect(deflectionAt(beamB, 2)).toBeCloseTo(closed.f, 12);
    expect(slopeAt(beamB, 2)).toBeCloseTo(closed.phi, 12);
    // проверката в текста: 48/2200 и 24/1466,67
    expect((48 / 2200).toFixed(5)).toBe("0.02182");
    expect((24 / 1466.67).toFixed(5)).toBe("0.01636");
  });

  it("съвпада с численото двойно интегриране и с elasticCurve от Глава 7", () => {
    const num = integrateTwice(
      (x) => (-6 * (2 - x)) / EI_TIMBER,
      2,
      "fixed-left",
    );
    expect(deflectionAt(beamB, 2)).toBeCloseTo(num.wAt(2), 8);
    expect(deflectionAt(beamB, 1)).toBeCloseTo(num.wAt(1), 8);
    expect(slopeAt(beamB, 2)).toBeCloseTo(num.phiAt(2), 8);

    const real: Beam = {
      length: 2,
      supports: { type: "cantilever", fixedAt: "left" },
      loads: [{ type: "force", x: 2, value: 6 }],
    };
    for (const point of elasticCurve(real, EI_TIMBER, 4)) {
      expect(deflectionAt(beamB, point.x)).toBeCloseTo(point.w, 10);
      expect(slopeAt(beamB, point.x)).toBeCloseTo(point.phi, 10);
    }
  });

  it("огледалната конзола (запъната вдясно): същото провисване, обратен ъгъл", () => {
    const mirrored: MohrBeam = {
      length: 2,
      support: "fixed-right",
      pieces: [{ x1: 0, x2: 2, m1: 0, m2: -12, EI: EI_TIMBER }],
    };
    expect(deflectionAt(mirrored, 0)).toBeCloseTo(deflectionAt(beamB, 2), 12);
    expect(slopeAt(mirrored, 0)).toBeCloseTo(-slopeAt(beamB, 2), 12);
    expect(deflectionAt(mirrored, 0.5)).toBeCloseTo(
      deflectionAt(beamB, 1.5),
      12,
    );
    expect(slopeAt(mirrored, 2)).toBeCloseTo(0, 12);
    expect(deflectionAt(mirrored, 2)).toBeCloseTo(0, 12);
  });
});

describe("Пример В: проста греда с равномерен товар (l = 4 m, q = 4 kN/m)", () => {
  it("площта на параболата е 21,333 kN·m²; реакциите са по 10,667 kN·m²", () => {
    // Ω = (2/3)·4·8 = 21,333; A_f = 21,333/2 = 10,667
    expect((fictitiousResultant(beamC).omega * EI_TIMBER).toFixed(3)).toBe(
      "21.333",
    );
    const { A, B } = fictitiousReactions(beamC);
    expect((A * EI_TIMBER).toFixed(3)).toBe("10.667");
    expect(B).toBeCloseTo(A, 12);
  });

  it("φ_A = 10,667/733,33 = 0,01455 rad – както в Глава 7, Пример 2", () => {
    expect(slopeAt(beamC, 0).toFixed(5)).toBe("0.01455");
    expect((10.667 / 733.33).toFixed(5)).toBe("0.01455");
  });

  it("M_f в средата = 10,667·(2 − 0,75) = 13,33 kN·m³; f = 1,82 cm", () => {
    // половината парабола 10,667 с център на (3/8)·2 = 0,75 m от средата;
    // рамото на реакцията е 2 m → M_f = 10,667·2 − 10,667·0,75 = 10,667·1,25
    expect((10.667 * 1.25).toFixed(2)).toBe("13.33");
    const f = deflectionAt(beamC, 2);
    expect((f * EI_TIMBER).toFixed(2)).toBe("13.33");
    expect((13.33 / 733.33).toFixed(4)).toBe("0.0182");
    expect((f * 100).toFixed(2)).toBe("1.82");
  });

  it("съвпада с формулите от Глава 7 в няколко сечения", () => {
    const closed = standardDeflection("simple-distributed", 4, 4, EI_TIMBER);
    expect(deflectionAt(beamC, 2)).toBeCloseTo(closed.f, 12);
    expect(slopeAt(beamC, 0)).toBeCloseTo(closed.phi, 12);
    for (const x of [0, 0.5, 1, 2.7, 4]) {
      expect(deflectionAt(beamC, x)).toBeCloseTo(
        simpleBeamDistributedAt(4, 4, EI_TIMBER, x),
        12,
      );
    }
  });

  it("съвпада с численото двойно интегриране", () => {
    const num = integrateTwice(
      (x) => (8 * x - 2 * x * x) / EI_TIMBER,
      4,
      "simple",
    );
    expect(deflectionAt(beamC, 2)).toBeCloseTo(num.wAt(2), 8);
    expect(slopeAt(beamC, 0)).toBeCloseTo(num.phiAt(0), 8);
    expect(slopeAt(beamC, 4)).toBeCloseTo(num.phiAt(4), 8);
  });

  it("общият вид: Ω = q·l³/12, A_f = q·l³/24, M_f = 5·q·l⁴/384", () => {
    const q = 4;
    const l = 4;
    expect(fictitiousResultant(beamC).omega * EI_TIMBER).toBeCloseTo(
      (q * l ** 3) / 12,
      9,
    );
    expect(deflectionAt(beamC, 2) * EI_TIMBER).toBeCloseTo(
      (5 * q * l ** 4) / 384,
      9,
    );
    // (l/2 − 3l/16)/24 = 5l/384
    expect((1 / 24) * (1 / 2 - 3 / 16)).toBeCloseTo(5 / 384, 12);
  });
});

describe("Пример Г: стъпаловидна коравина (l = 6 m, F = 20 kN, 4000/8000/4000)", () => {
  it("приведени ординати: 20 → 10 при x = 2 и 30 → 15 в средата", () => {
    expect(reducedMoment(20, 8000, 4000)).toBe(10);
    expect(reducedMoment(30, 8000, 4000)).toBe(15);
    expect(reducedMoment(20, 4000, 4000)).toBe(20);
    // скок на фиктивния товар при x = 2: 20/4000 = 0,005 и 20/8000 = 0,0025
    expect(fictitiousLoadAt(beamD, 2, "left")).toBeCloseTo(0.005, 12);
    expect(fictitiousLoadAt(beamD, 2, "right")).toBeCloseTo(0.0025, 12);
    expect(fictitiousLoadAt(beamD, 3)).toBeCloseTo(0.00375, 12);
  });

  it("половината приведена площ: 20 + 10 + 2,5 = 32,5 kN·m²; φ_A = 0,008125 rad", () => {
    // триъгълник 2·20/2 = 20; правоъгълник 10·1 = 10; триъгълник 5·1/2 = 2,5
    const { A, B } = fictitiousReactions(beamD);
    expect(A * 4000).toBeCloseTo(32.5, 9);
    expect(B).toBeCloseTo(A, 12);
    expect(32.5 / 4000).toBe(0.008125);
    expect(slopeAt(beamD, 0)).toBeCloseTo(0.008125, 12);
  });

  it("равновесие на фиктивната греда: A_f + B_f = цялата площ; ΣM = 0", () => {
    const { A, B } = fictitiousReactions(beamD);
    const r = fictitiousResultant(beamD);
    expect(A + B).toBeCloseTo(r.omega, 12);
    expect(r.omega * 4000).toBeCloseTo(65, 9);
    // моменти спрямо левия край: B_f·l = Ω·x_c
    expect(B * 6).toBeCloseTo(r.omega * r.xc, 12);
    // независимо: площта чрез числен интеграл на M/(E·I)
    const M = (x: number) => (x <= 3 ? 10 * x : 10 * (6 - x));
    const EI = (x: number) => (x > 2 && x < 4 ? 8000 : 4000);
    expect(midpoint((x) => M(x) / EI(x), 0, 6, 600000)).toBeCloseTo(r.omega, 9);
  });

  it("M_f в средата = 97,5 − 33,333 − 5 − 0,833 = 58,33 kN·m³; f = 1,46 cm", () => {
    // рамена спрямо средата: 3 − 4/3 = 5/3; 0,5; 1/3
    expect((20 * (5 / 3)).toFixed(3)).toBe("33.333");
    expect((2.5 / 3).toFixed(3)).toBe("0.833");
    expect((97.5 - 33.333 - 5 - 0.833).toFixed(2)).toBe("58.33");
    const f = deflectionAt(beamD, 3);
    expect((f * 4000).toFixed(2)).toBe("58.33");
    expect(f.toFixed(5)).toBe("0.01458");
    expect((58.33 / 4000).toFixed(5)).toBe("0.01458");
    expect((f * 100).toFixed(2)).toBe("1.46");
  });

  it("потвърждава се с числено двойно интегриране на M/(E·I)", () => {
    const M = (x: number) => (x <= 3 ? 10 * x : 10 * (6 - x));
    const EI = (x: number) => (x > 2 && x < 4 ? 8000 : 4000);
    const num = integrateTwice((x) => M(x) / EI(x), 6, "simple");
    expect(deflectionAt(beamD, 3)).toBeCloseTo(num.wAt(3), 8);
    expect(deflectionAt(beamD, 2)).toBeCloseTo(num.wAt(2), 8);
    expect(deflectionAt(beamD, 5)).toBeCloseTo(num.wAt(5), 8);
    expect(slopeAt(beamD, 0)).toBeCloseTo(num.phiAt(0), 8);
    expect(slopeAt(beamD, 2)).toBeCloseTo(num.phiAt(2), 8);
  });

  it("сравнение: 2,25 cm с 4000 навсякъде, 1,125 cm с 8000; печели се 70 % от разликата", () => {
    // 20·216/(48·4000) = 4320/192 000 = 0,0225 m
    const soft = standardDeflection("simple-force-mid", 20, 6, 4000).f;
    const stiff = standardDeflection("simple-force-mid", 20, 6, 8000).f;
    expect(soft).toBeCloseTo(0.0225, 12);
    expect(stiff).toBeCloseTo(0.01125, 12);
    const f = deflectionAt(beamD, 3);
    expect(((soft - f) * 100).toFixed(2)).toBe("0.79");
    expect((((soft - f) / (soft - stiff)) * 100).toFixed(0)).toBe("70");
    // с отпечатаните числа: (2,25 − 1,46)/(2,25 − 1,125) = 0,79/1,125
    expect(((0.79 / 1.125) * 100).toFixed(0)).toBe("70");
  });

  it("при еднаква коравина методът връща формулата от Глава 7", () => {
    const uniform: MohrBeam = {
      ...beamD,
      pieces: beamD.pieces.map((piece) => ({ ...piece, EI: 4000 })),
    };
    expect(deflectionAt(uniform, 3)).toBeCloseTo(0.0225, 12);
    expect(slopeAt(uniform, 0)).toBeCloseTo(0.01125, 12);
  });
});

describe("въпроси от „Провери се“", () => {
  it("Леко 3: l = 4 m, F = 12 kN, E·I = 4000 → φ_A = 0,003 rad, f = 0,4 cm", () => {
    // M_max = 12; Ω половина = 2·12/2 = 12; M_f = 12·2 − 12·(2/3) = 24 − 8 = 16
    const beam: MohrBeam = {
      length: 4,
      support: "simple",
      pieces: [
        { x1: 0, x2: 2, m1: 0, m2: 12, EI: 4000 },
        { x1: 2, x2: 4, m1: 12, m2: 0, EI: 4000 },
      ],
    };
    expect(fictitiousReactions(beam).A * 4000).toBeCloseTo(12, 9);
    expect(slopeAt(beam, 0)).toBeCloseTo(0.003, 12);
    expect(deflectionAt(beam, 2) * 4000).toBeCloseTo(16, 9);
    expect(deflectionAt(beam, 2)).toBeCloseTo(0.004, 12);
    expect(deflectionAt(beam, 2)).toBeCloseTo(
      standardDeflection("simple-force-mid", 12, 4, 4000).f,
      12,
    );
    // 12·64/(48·4000) = 768/192 000 = 0,004
    expect(768 / 192000).toBe(0.004);
  });

  it("Подробно 2: конзола l = 2 m, q = 3 kN/m, E·I = 1200 → φ = 0,00333 rad, f = 0,5 cm", () => {
    // M(0) = −q·l²/2 = −6; M(1) = −3·1²/2 = −1,5; Ω = l·h/3 = 2·6/3 = 4, на l/4 = 0,5 m от запъването
    const beam: MohrBeam = {
      length: 2,
      support: "fixed-left",
      pieces: [{ x1: 0, x2: 2, m1: -6, m2: 0, mMid: -1.5, EI: 1200 }],
    };
    const r = fictitiousResultant(beam);
    expect(r.omega * 1200).toBeCloseTo(-4, 9);
    expect(r.xc).toBeCloseTo(0.5, 9);
    expect(slopeAt(beam, 2).toFixed(5)).toBe("0.00333");
    // f = 4·1,5/1200 = 0,005 m
    expect(deflectionAt(beam, 2)).toBeCloseTo(0.005, 12);
    const closed = standardDeflection("cantilever-distributed", 3, 2, 1200);
    expect(deflectionAt(beam, 2)).toBeCloseTo(closed.f, 12);
    expect(slopeAt(beam, 2)).toBeCloseTo(closed.phi, 12);
    expect(48 / 9600).toBe(0.005);
    expect((24 / 7200).toFixed(5)).toBe("0.00333");
  });

  it("Подробно 4: l = 6 m, F = 30 kN на 2 m от A, E·I = 8000 → φ_A = 0,00833 rad, w = 1,33 cm", () => {
    // M_max = 30·2·4/6 = 40; Ω = 6·40/2 = 120, център на (6 + 2)/3 = 2,667 m от A
    const beam: MohrBeam = {
      length: 6,
      support: "simple",
      pieces: [
        { x1: 0, x2: 2, m1: 0, m2: 40, EI: 8000 },
        { x1: 2, x2: 6, m1: 40, m2: 0, EI: 8000 },
      ],
    };
    const r = fictitiousResultant(beam);
    expect(r.omega * 8000).toBeCloseTo(120, 9);
    expect(r.xc.toFixed(3)).toBe("2.667");
    const { A, B } = fictitiousReactions(beam);
    // B_f = 120·2,667/6 = 53,33; A_f = 120 − 53,33 = 66,67
    expect((B * 8000).toFixed(2)).toBe("53.33");
    expect((A * 8000).toFixed(2)).toBe("66.67");
    expect(((120 * (8 / 3)) / 6).toFixed(2)).toBe("53.33");
    expect((120 - 53.33).toFixed(2)).toBe("66.67");
    expect(slopeAt(beam, 0).toFixed(5)).toBe("0.00833");
    expect((66.67 / 8000).toFixed(5)).toBe("0.00833");
    // M_f(2) = 66,67·2 − 40·(2/3) = 133,34 − 26,67 = 106,67
    expect((66.67 * 2 - 26.67).toFixed(2)).toBe("106.67");
    const w = deflectionAt(beam, 2);
    expect((w * 8000).toFixed(2)).toBe("106.67");
    expect((w * 100).toFixed(2)).toBe("1.33");
    expect((106.67 / 8000).toFixed(5)).toBe("0.01333");

    const closed = simpleBeamOffCentreForce(30, 2, 6, 8000);
    expect(w).toBeCloseTo(closed.underLoad, 12);
    expect(slopeAt(beam, 0)).toBeCloseTo(closed.phiA, 12);
    expect(slopeAt(beam, 6)).toBeCloseTo(closed.phiB, 12);
    // най-голямото провисване е там, където Q_f = 0
    const xMax = zeroSlopeSection(beam, 0, 6);
    expect(xMax).toBeCloseTo(closed.xMax, 9);
    expect(deflectionAt(beam, xMax)).toBeCloseTo(closed.max, 12);
    // 30·4·16/(3·8000·6) = 1920/144 000
    expect((1920 / 144000).toFixed(5)).toBe("0.01333");
  });
});

describe("Пример Д: влияние на напречната сила (стомана 4 × 10 cm, F = 20 kN в средата)", () => {
  const E = 21000;
  const G = 8100;
  const A = 40; // 4·10 cm²
  const k = SHEAR_COEFFICIENT_RECTANGLE;

  it("k = 1,2 за правоъгълник – числено от параболичното τ на Журавски", () => {
    // k = (A/Q²)·∫τ² dA с τ = (3Q/2A)·(1 − 4y²/h²); ръчно: (9/4)·(8/15) = 6/5
    const b = 4;
    const h = 10;
    const Q = 1;
    const tau = (y: number) =>
      ((3 * Q) / (2 * b * h)) * (1 - (4 * y * y) / h ** 2);
    const integral = midpoint((y) => tau(y) ** 2 * b, -h / 2, h / 2);
    expect(((b * h) / Q ** 2) * integral).toBeCloseTo(1.2, 8);
    expect((9 / 4) * (8 / 15)).toBeCloseTo(6 / 5, 12);
    expect(k).toBe(1.2);
  });

  it("коравини: E·I = 700 kN·m², G·A = 324 000 kN", () => {
    expect(EI_STEEL).toBeCloseTo(700, 9);
    expect(G * A).toBe(324000);
  });

  it("l = 2 m: f_M = 4,762 mm, f_Q = 0,0370 mm, дял 0,78 %", () => {
    // f_M = 20·8/(48·700) = 160/33 600; f_Q = 1,2·20·2/(4·324 000) = 48/1 296 000
    const fM = standardDeflection("simple-force-mid", 20, 2, EI_STEEL).f;
    const fQ = standardShearDeflection("simple-force-mid", 20, 2, k, G, A);
    expect((fM * 1000).toFixed(3)).toBe("4.762");
    expect((fQ * 1000).toFixed(4)).toBe("0.0370");
    expect(fM).toBeCloseTo(160 / 33600, 12);
    expect(fQ).toBeCloseTo(48 / 1296000, 15);
    expect(((fQ / fM) * 100).toFixed(2)).toBe("0.78");
    expect(((0.037 / 4.762) * 100).toFixed(2)).toBe("0.78");
  });

  it("l = 1 m: f_M = 0,5952 mm, f_Q = 0,0185 mm, дял 3,1 %", () => {
    // f_M = 20·1/(48·700) = 20/33 600; f_Q = 1,2·20·1/(4·324 000) = 24/1 296 000
    const fM = standardDeflection("simple-force-mid", 20, 1, EI_STEEL).f;
    const fQ = standardShearDeflection("simple-force-mid", 20, 1, k, G, A);
    expect((fM * 1000).toFixed(4)).toBe("0.5952");
    expect((fQ * 1000).toFixed(4)).toBe("0.0185");
    expect(((fQ / fM) * 100).toFixed(1)).toBe("3.1");
    expect(((0.0185 / 0.5952) * 100).toFixed(1)).toBe("3.1");
  });

  it("делът, преизчислен независимо: числен ∫Q·Q̄dx и формулата k·(E/G)·(h/l)²", () => {
    for (const l of [2, 1]) {
      // Q = +F/2 вляво от силата и −F/2 вдясно; Q̄ = ±1/2 по същия начин
      const Q = (x: number) => (x < l / 2 ? 10 : -10);
      const Qbar = (x: number) => (x < l / 2 ? 0.5 : -0.5);
      const integral = midpoint((x) => Q(x) * Qbar(x), 0, l, 20000);
      expect(integral).toBeCloseTo((20 * l) / 4, 9);
      const fQ = shearDeflection(k, integral, G, A);
      expect(fQ).toBeCloseTo(
        standardShearDeflection("simple-force-mid", 20, l, k, G, A),
        14,
      );
      // същото чрез w_Q = k·M/(G·A) с M = F·l/4
      expect(shearDeflectionSimpleBeam(k, (20 * l) / 4, G, A)).toBeCloseTo(
        fQ,
        14,
      );
      const fM = standardDeflection("simple-force-mid", 20, l, EI_STEEL).f;
      expect(fQ / fM).toBeCloseTo(
        rectangleShearShareMidForce(k, E, G, 10, l * 100),
        12,
      );
      // 12·k·E·I/(G·A·l²) със същите мерни единици (cm)
      const I = rectangleInertia(4, 10);
      expect(fQ / fM).toBeCloseTo(
        (12 * k * E * I) / (G * A * (l * 100) ** 2),
        12,
      );
    }
    // 1,2·(21 000/8100) = 3,111; /400 = 0,00778; /100 = 0,0311
    expect((1.2 * (21000 / 8100)).toFixed(3)).toBe("3.111");
    expect((3.111 / 400).toFixed(5)).toBe("0.00778");
    expect((3.111 / 100).toFixed(4)).toBe("0.0311");
  });

  it("въпрос 5 (Подробно): два пъти по-къс отвор → четири пъти по-голям дял", () => {
    const long = rectangleShearShareMidForce(k, E, G, 10, 200);
    const short = rectangleShearShareMidForce(k, E, G, 10, 100);
    expect(short / long).toBeCloseTo(4, 12);
  });

  it("другите типови случаи: q·l²/8, F·l и q·l²/2", () => {
    // проста греда с равномерен товар: w_Q в средата = k·M_max/(G·A)
    expect(
      standardShearDeflection("simple-distributed", 4, 4, k, G, A),
    ).toBeCloseTo(shearDeflectionSimpleBeam(k, 8, G, A), 15);
    // конзола: Q = F, Q̄ = 1 → F·l; с равномерен товар Q = q·(l − x), Q̄ = 1 → q·l²/2
    expect(
      standardShearDeflection("cantilever-force", 6, 2, k, G, A),
    ).toBeCloseTo((k * 12) / (G * A), 15);
    const integral = midpoint((x) => 3 * (2 - x), 0, 2, 20000);
    expect(
      standardShearDeflection("cantilever-distributed", 3, 2, k, G, A),
    ).toBeCloseTo(shearDeflection(k, integral, G, A), 12);
  });
});

describe("проверка на входните данни", () => {
  it("отказва невалидни греди и сечения", () => {
    expect(() => slopeAt({ ...beamA, length: 0 }, 0)).toThrow();
    expect(() => slopeAt({ ...beamA, pieces: [] }, 0)).toThrow();
    expect(() => deflectionAt(beamA, 7)).toThrow();
    expect(() => deflectionAt(beamA, -0.1)).toThrow();
    expect(() =>
      slopeAt(
        {
          ...beamA,
          pieces: [{ x1: 0, x2: 3, m1: 0, m2: 6, EI: 0 }],
        },
        1,
      ),
    ).toThrow();
    expect(() =>
      slopeAt(
        {
          ...beamA,
          pieces: [{ x1: 3, x2: 2, m1: 0, m2: 6, EI: 100 }],
        },
        1,
      ),
    ).toThrow();
    expect(() => fictitiousReactions(beamB)).toThrow();
    expect(() => zeroSlopeSection(beamA, 0, 1)).toThrow();
    expect(() => reducedMoment(10, 0, 4000)).toThrow();
    expect(() => shearDeflection(1.2, 5, 0, 40)).toThrow();
    expect(() => shearDeflection(0, 5, 8100, 40)).toThrow();
    expect(() =>
      standardShearDeflection("simple-force-mid", 20, 0, 1.2, 8100, 40),
    ).toThrow();
    expect(() =>
      rectangleShearShareMidForce(1.2, 21000, 8100, 10, 0),
    ).toThrow();
  });

  it("извън участъците фиктивният товар е нула", () => {
    const partialLoad: MohrBeam = {
      length: 4,
      support: "simple",
      pieces: [{ x1: 1, x2: 2, m1: 5, m2: 5, EI: 100 }],
    };
    expect(fictitiousLoadAt(partialLoad, 3)).toBe(0);
    expect(fictitiousLoadAt(partialLoad, 1.5)).toBeCloseTo(0.05, 12);
  });
});
