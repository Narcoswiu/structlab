import { describe, expect, it } from "vitest";
import {
  equilibriumResiduals,
  loadResultant,
  reduceLoads,
  solvePlaneBody,
  solveSupportReactions,
  staticDeterminacy,
  supportConstraints,
  type PlaneLoad,
  type PlaneSupports,
  type Point,
} from "@/lib/engineering/plane-body";
import { solveReactions, type Beam } from "@/lib/engineering/beam";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Знаци: x надясно, y нагоре, момент обратно на часовниковата стрелка = плюс.
// В beam.ts е обратното (сила надолу = плюс, момент по часовниковата = плюс) –
// при сравненията знаците се обръщат изрично.

/** Сила право надолу с големина `value` в точка (x; y). */
const down = (x: number, value: number, y = 0): PlaneLoad => ({
  type: "force",
  x,
  y,
  fx: 0,
  fy: -value,
});

/** Равномерен товар надолу върху хоризонтален участък x1–x2 на височина y. */
const uniform = (x1: number, x2: number, q: number, y = 0): PlaneLoad => ({
  type: "uniform",
  from: { x: x1, y },
  to: { x: x2, y },
  q,
});

const simple = (xA: number, xB: number): PlaneSupports => ({
  type: "pin-roller",
  pin: { x: xA, y: 0 },
  roller: { x: xB, y: 0 },
});

/** Трите остатъка спрямо точка `about` за решението на дадените опори и товари. */
function residuals(supports: PlaneSupports, loads: PlaneLoad[], about: Point) {
  const constraints = supportConstraints(supports);
  const reactions = solvePlaneBody({ constraints, loads });
  return equilibriumResiduals({ constraints, loads }, reactions, about);
}

/** Очаква равновесие спрямо две различни точки, едната извън тялото. */
function expectEquilibrium(supports: PlaneSupports, loads: PlaneLoad[]) {
  for (const about of [
    { x: 0, y: 0 },
    { x: 7.3, y: -2.6 },
  ]) {
    const r = residuals(supports, loads, about);
    expect(r.fx).toBeCloseTo(0, 9);
    expect(r.fy).toBeCloseTo(0, 9);
    expect(r.moment).toBeCloseTo(0, 9);
  }
}

describe("равнодействаща на товар", () => {
  it("равномерен товар 6 kN/m върху 4 m: R_q = 24 kN надолу при x = 2 m", () => {
    const r = loadResultant(uniform(0, 4, 6));
    expect(r.fx).toBeCloseTo(0, 12);
    expect(r.fy).toBeCloseTo(-24, 12);
    expect(r.at.x).toBeCloseTo(2, 12);
  });

  it("триъгълен товар 0→9 kN/m върху 6 m: R_q = 9·6/2 = 27 kN на 2/3·6 = 4 m от нулевия край", () => {
    const r = loadResultant({
      type: "triangular",
      from: { x: 0, y: 0 },
      to: { x: 6, y: 0 },
      q: 9,
    });
    expect(r.fy).toBeCloseTo(-27, 12);
    expect(r.at.x).toBeCloseTo(4, 12);
  });

  it("сила 20 kN под 240° (надолу и наляво, 60° спрямо оста): F_x = −10,00; F_y = −17,32 kN", () => {
    // 20·cos 60° = 10; 20·sin 60° = 17,3205
    const r = loadResultant({
      type: "inclined",
      x: 8,
      y: 0,
      magnitude: 20,
      angleDeg: 240,
    });
    expect(r.fx).toBeCloseTo(-10, 9);
    expect(r.fy).toBeCloseTo(-17.3205, 4);
  });

  it("момент спрямо друга точка: M_B = M_O − (x_B·R_y − y_B·R_x)", () => {
    const loads: PlaneLoad[] = [
      { type: "force", x: 2, y: 1, fx: 3, fy: -4 },
      { type: "couple", value: 5 },
    ];
    // M_O = 2·(−4) − 1·3 + 5 = −6; за B(1; 2): −6 − (1·(−4) − 2·3) = 4
    expect(reduceLoads(loads).moment).toBeCloseTo(-6, 12);
    expect(reduceLoads(loads, { x: 1, y: 2 }).moment).toBeCloseTo(4, 12);
  });
});

describe("опит с линийката от „Загадка“ („Леко“)", () => {
  it("опори на 0 и 20 cm, натиск 3 N на 30 cm: B = 3·30/20 = 4,5 N; A = 3 − 4,5 = −1,5 N (надолу)", () => {
    // тук единиците са N и cm – уравненията са същите
    const r = solveSupportReactions(simple(0, 20), [down(30, 3)]);
    expect(r.Bv).toBeCloseTo(4.5, 9);
    expect(r.Av).toBeCloseTo(-1.5, 9);
    expect(r.Ah).toBeCloseTo(0, 9);
  });
});

describe("пример Л1 – проста греда 5 m със сила 20 kN на 2 m", () => {
  const supports = simple(0, 5);
  const loads = [down(2, 20)];

  it("ΣM_A: B_v·5 − 20·2 = 0 → B_v = 8; ΣF_y: A_v = 20 − 8 = 12; A_h = 0", () => {
    const r = solveSupportReactions(supports, loads);
    expect(r.Ah).toBeCloseTo(0, 9);
    expect(r.Av).toBeCloseTo(12, 9);
    expect(r.Bv).toBeCloseTo(8, 9);
    expect(r.MA).toBeNull();
  });

  it("проверка ΣM_B = −12·5 + 20·3 = 0 и равновесие спрямо точка извън гредата", () => {
    expect(residuals(supports, loads, { x: 5, y: 0 }).moment).toBeCloseTo(0, 9);
    expectEquilibrium(supports, loads);
  });

  it("solvePlaneBody с три връзки дава [0; 12; 8] (таблицата в плана)", () => {
    const [Ah, Av, Bv] = solvePlaneBody({
      constraints: [
        { type: "link", x: 0, y: 0, angleDeg: 0 },
        { type: "link", x: 0, y: 0, angleDeg: 90 },
        { type: "link", x: 5, y: 0, angleDeg: 90 },
      ],
      loads,
    });
    expect(Ah).toBeCloseTo(0, 9);
    expect(Av).toBeCloseTo(12, 9);
    expect(Bv).toBeCloseTo(8, 9);
  });

  it("съвпада със solveReactions от beam.ts", () => {
    const beam: Beam = {
      length: 5,
      supports: { type: "simple", xA: 0, xB: 5 },
      loads: [{ type: "force", x: 2, value: 20 }],
    };
    const r = solveReactions(beam);
    expect(r.forces[0]!.value).toBeCloseTo(12, 9);
    expect(r.forces[1]!.value).toBeCloseTo(8, 9);
  });
});

describe("пример П1 – греда 8 m с конзолен край (изпитен тип)", () => {
  // A при x = 0, B при x = 6 m; q = 6 kN/m от 0 до 4 m; момент 12 kN·m ПО
  // часовниковата при x = 5 m (тук −12); F = 20 kN при x = 8 m, 60° спрямо оста,
  // надолу и наляво (ъгъл 240° спрямо оста x).
  const supports = simple(0, 6);
  const loads: PlaneLoad[] = [
    uniform(0, 4, 6),
    { type: "couple", value: -12 },
    { type: "inclined", x: 8, y: 0, magnitude: 20, angleDeg: 240 },
  ];
  const r = solveSupportReactions(supports, loads);

  it("ΣF_x: A_h − 10 = 0 → A_h = 10,00 kN", () => {
    expect(r.Ah).toBeCloseTo(10, 9);
  });

  it("ΣM_A: B_v = (24·2 + 12 + 17,32·8)/6 = (48 + 12 + 138,56)/6 = 198,56/6 = 33,09 kN", () => {
    expect(r.Bv).toBeCloseTo(33.094, 3);
    // със закръглените междинни стойности, както са отпечатани
    expect((48 + 12 + 138.56) / 6).toBeCloseTo(33.09, 2);
    expect(r.Bv).toBeCloseTo(33.09, 2);
  });

  it("ΣF_y: A_v = 24 + 17,32 − 33,09 = 8,23 kN", () => {
    expect(r.Av).toBeCloseTo(8.2265, 4);
    expect(24 + 17.32 - 33.09).toBeCloseTo(8.23, 9);
    expect(r.Av).toBeCloseTo(8.23, 2);
  });

  it("проверка ΣM_B със закръглените стойности: −8,23·6 + 24·4 − 12 − 17,32·2 = −0,02 ≈ 0", () => {
    expect(-8.23 * 6 + 24 * 4 - 12 - 17.32 * 2).toBeCloseTo(-0.02, 9);
    // с точните стойности остатъкът е нула
    expect(residuals(supports, loads, { x: 6, y: 0 }).moment).toBeCloseTo(0, 9);
    expectEquilibrium(supports, loads);
  });

  it("вертикалната част съвпада със solveReactions от beam.ts (сила надолу и момент по часовниковата = плюс)", () => {
    const beam: Beam = {
      length: 8,
      supports: { type: "simple", xA: 0, xB: 6 },
      loads: [
        { type: "distributed", x1: 0, x2: 4, value: 6 },
        { type: "moment", x: 5, value: 12 },
        { type: "force", x: 8, value: 20 * Math.sin(Math.PI / 3) },
      ],
    };
    const check = solveReactions(beam);
    expect(check.forces[0]!.value).toBeCloseTo(r.Av, 9);
    expect(check.forces[1]!.value).toBeCloseTo(r.Bv, 9);
  });
});

describe("пример Л2 = П2 – конзола 3 m, q = 5 kN/m и сила 8 kN на свободния край", () => {
  const supports: PlaneSupports = { type: "fixed", at: { x: 0, y: 0 } };
  const loads = [uniform(0, 3, 5), down(3, 8)];
  const r = solveSupportReactions(supports, loads);

  it("R_q = 5·3 = 15 kN при x = 1,5 m; A_v = 15 + 8 = 23 kN; A_h = 0", () => {
    expect(r.Av).toBeCloseTo(23, 9);
    expect(r.Ah).toBeCloseTo(0, 9);
    expect(r.B).toBeNull();
  });

  it("ΣM_A: M_A − 15·1,5 − 8·3 = 0 → M_A = 22,5 + 24 = 46,5 kN·m (обратно на часовниковата)", () => {
    expect(r.MA).toBeCloseTo(46.5, 9);
  });

  it("проверка спрямо свободния край: 46,5 − 23·3 + 15·1,5 = 46,5 − 69 + 22,5 = 0", () => {
    expect(46.5 - 23 * 3 + 15 * 1.5).toBeCloseTo(0, 12);
    expect(residuals(supports, loads, { x: 3, y: 0 }).moment).toBeCloseTo(0, 9);
    expectEquilibrium(supports, loads);
  });

  it("съвпада със solveReactions: сила 23 kN, момент −46,5 (там плюсът е по часовниковата)", () => {
    const beam: Beam = {
      length: 3,
      supports: { type: "cantilever", fixedAt: "left" },
      loads: [
        { type: "distributed", x1: 0, x2: 3, value: 5 },
        { type: "force", x: 3, value: 8 },
      ],
    };
    const check = solveReactions(beam);
    expect(check.forces[0]!.value).toBeCloseTo(r.Av, 9);
    expect(-check.moment!.value).toBeCloseTo(r.MA!, 9);
  });
});

describe("пример П3 – рамка A(0;0), C(0;4), D(6;4), B(6;0)", () => {
  // хоризонтална сила 15 kN надясно в C; q = 10 kN/m върху ригела CD
  const supports = simple(0, 6);
  const loads: PlaneLoad[] = [
    { type: "force", x: 0, y: 4, fx: 15, fy: 0 },
    uniform(0, 6, 10, 4),
  ];
  const r = solveSupportReactions(supports, loads);

  it("ΣF_x: A_h + 15 = 0 → A_h = −15 kN (наляво)", () => {
    expect(r.Ah).toBeCloseTo(-15, 9);
  });

  it("ΣM_A: B_v·6 − 60·3 − 15·4 = 0 → B_v = 240/6 = 40 kN", () => {
    expect(r.Bv).toBeCloseTo(40, 9);
  });

  it("ΣF_y: A_v = 60 − 40 = 20 kN", () => {
    expect(r.Av).toBeCloseTo(20, 9);
  });

  it("проверки: ΣM_B = −20·6 + 60·3 − 15·4 = 0; ΣM_C = −60 − 180 + 240 = 0", () => {
    expect(-20 * 6 + 60 * 3 - 15 * 4).toBe(0);
    expect(-60 - 180 + 240).toBe(0);
    expect(residuals(supports, loads, { x: 6, y: 0 }).moment).toBeCloseTo(0, 9);
    expect(residuals(supports, loads, { x: 0, y: 4 }).moment).toBeCloseTo(0, 9);
    expectEquilibrium(supports, loads);
  });
});

describe("пример П4 – теорема за трите сили", () => {
  // проста греда 6 m; F = 30 kN при x = 2 m, под 45°, надолу и надясно (ъгъл −45°)
  const supports = simple(0, 6);
  const loads: PlaneLoad[] = [
    { type: "inclined", x: 2, y: 0, magnitude: 30, angleDeg: -45 },
  ];
  const r = solveSupportReactions(supports, loads);

  it("F_x = 21,21 kN; F_y = −21,21 kN; B_v = 21,21·2/6 = 7,07 kN", () => {
    const f = loadResultant(loads[0]!);
    expect(f.fx).toBeCloseTo(21.2132, 4);
    expect(f.fy).toBeCloseTo(-21.2132, 4);
    expect(r.Bv).toBeCloseTo(7.0711, 4);
    expect((21.21 * 2) / 6).toBeCloseTo(7.07, 9);
  });

  it("A_v = 21,21 − 7,07 = 14,14 kN; A_h = −21,21 kN (наляво)", () => {
    expect(r.Av).toBeCloseTo(14.1421, 4);
    expect(r.Ah).toBeCloseTo(-21.2132, 4);
  });

  it("A = √(21,21² + 14,14²) = √650 = 25,5 kN (и точно, и със закръглените стойности)", () => {
    expect(Math.hypot(r.Ah, r.Av)).toBeCloseTo(Math.sqrt(650), 9);
    expect(Math.hypot(r.Ah, r.Av)).toBeCloseTo(25.5, 1);
    expect(Math.hypot(21.21, 14.14)).toBeCloseTo(25.5, 1);
  });

  it("директрисата на F пресича вертикалата през B в K(6; −4); реакцията в A минава през K", () => {
    // от (2; 0) с наклон −1: y(6) = −(6 − 2) = −4
    const K = { x: 6, y: -4 };
    // моментът на всяка от трите сили спрямо K е нула
    const f = loadResultant(loads[0]!);
    expect((2 - K.x) * f.fy - (0 - K.y) * f.fx).toBeCloseTo(0, 9);
    expect((0 - K.x) * r.Av - (0 - K.y) * r.Ah).toBeCloseTo(0, 9);
    // наклон на AK: −4/6 = −0,667 (A_v > 0, A_h < 0); ъгъл с оста arctg(4/6) = 33,69°
    expect(r.Av / Math.abs(r.Ah)).toBeCloseTo(4 / 6, 9);
    expect(14.14 / 21.21).toBeCloseTo(0.667, 3);
    expect((Math.atan2(4, 6) * 180) / Math.PI).toBeCloseTo(33.69, 2);
  });

  it("силовият триъгълник се затваря; равновесие спрямо две точки", () => {
    const f = loadResultant(loads[0]!);
    expect(f.fx + r.Ah + r.Bh).toBeCloseTo(0, 9);
    expect(f.fy + r.Av + r.Bv).toBeCloseTo(0, 9);
    expectEquilibrium(supports, loads);
  });
});

describe("„В реалния живот“ – греда на тераса с q = 12 kN/m", () => {
  it("вариант 1, отвор 4,8 m без конзола: 12·4,8/2 = 28,8 kN върху всяка колона", () => {
    const r = solveSupportReactions(simple(0, 4.8), [uniform(0, 4.8, 12)]);
    expect(r.Av).toBeCloseTo(28.8, 9);
    expect(r.Bv).toBeCloseTo(28.8, 9);
  });

  it("вариант 2, конзола 1,2 m: R_q = 12·6 = 72 kN при x = 3 m; B_v = 72·3/4,8 = 45; A_v = 72 − 45 = 27 kN", () => {
    const supports = simple(0, 4.8);
    const loads = [uniform(0, 6, 12)];
    const r = solveSupportReactions(supports, loads);
    expect(r.Bv).toBeCloseTo(45, 9);
    expect(r.Av).toBeCloseTo(27, 9);
    // проверка ΣM_B: −27·4,8 + 72·1,8 = −129,6 + 129,6 = 0
    expect(-27 * 4.8 + 72 * 1.8).toBeCloseTo(0, 9);
    expectEquilibrium(supports, loads);
    // разлики спрямо вариант 1: 45 − 28,8 = 16,2 kN повече; 28,8 − 27 = 1,8 kN по-малко
    expect(45 - 28.8).toBeCloseTo(16.2, 9);
    expect(28.8 - 27).toBeCloseTo(1.8, 9);

    const check = solveReactions({
      length: 6,
      supports: { type: "simple", xA: 0, xB: 4.8 },
      loads: [{ type: "distributed", x1: 0, x2: 6, value: 12 }],
    });
    expect(check.forces[0]!.value).toBeCloseTo(27, 9);
    expect(check.forces[1]!.value).toBeCloseTo(45, 9);
  });
});

describe("„В реалния живот“ – кога реакцията в A сменя знака си", () => {
  it("конзола, равна на отвора (4,8 m): R_q = 12·9,6 = 115,2 kN точно над B → A_v = 0; при по-дълга конзола A_v < 0", () => {
    // A_v = R_q·(1 − (L/2)/4,8); при L = 9,6 m скобата е нула
    const equal = solveSupportReactions(simple(0, 4.8), [uniform(0, 9.6, 12)]);
    expect(equal.Av).toBeCloseTo(0, 9);
    expect(equal.Bv).toBeCloseTo(115.2, 9);
    const longer = solveSupportReactions(simple(0, 4.8), [uniform(0, 10, 12)]);
    // R_q = 120 kN при x = 5 m: B_v = 120·5/4,8 = 125; A_v = 120 − 125 = −5 kN
    expect(longer.Av).toBeCloseTo(-5, 9);
  });
});

describe("въпроси от „Провери се“", () => {
  it("Леко 1: проста греда 4 m, сила 12 kN по средата → по 6 kN", () => {
    const r = solveSupportReactions(simple(0, 4), [down(2, 12)]);
    expect(r.Av).toBeCloseTo(6, 9);
    expect(r.Bv).toBeCloseTo(6, 9);
  });

  it("Леко 3: проста греда 6 m, сила 18 kN на 2 m от A → B_v = 18·2/6 = 6; A_v = 12 kN", () => {
    const r = solveSupportReactions(simple(0, 6), [down(2, 18)]);
    expect(r.Bv).toBeCloseTo(6, 9);
    expect(r.Av).toBeCloseTo(12, 9);
  });

  it("Леко 4: конзола 2 m, сила 5 kN на свободния край → A_v = 5 kN; M_A = 5·2 = 10 kN·m", () => {
    const r = solveSupportReactions({ type: "fixed", at: { x: 0, y: 0 } }, [
      down(2, 5),
    ]);
    expect(r.Av).toBeCloseTo(5, 9);
    expect(r.MA).toBeCloseTo(10, 9);
  });

  it("Подробно 1: греда 6 m, q = 4 kN/m, момент 12 kN·m по часовниковата в средата → B_v = (24·3 + 12)/6 = 14; A_v = 24 − 14 = 10 kN", () => {
    const supports = simple(0, 6);
    const loads: PlaneLoad[] = [
      uniform(0, 6, 4),
      { type: "couple", value: -12 },
    ];
    const r = solveSupportReactions(supports, loads);
    expect(r.Bv).toBeCloseTo(14, 9);
    expect(r.Av).toBeCloseTo(10, 9);
    expectEquilibrium(supports, loads);
    const check = solveReactions({
      length: 6,
      supports: { type: "simple", xA: 0, xB: 6 },
      loads: [
        { type: "distributed", x1: 0, x2: 6, value: 4 },
        { type: "moment", x: 3, value: 12 },
      ],
    });
    expect(check.forces[0]!.value).toBeCloseTo(10, 9);
    expect(check.forces[1]!.value).toBeCloseTo(14, 9);
  });

  it("Подробно 2: опори при 0 и 4 m, сила 10 kN при x = 6 m → B_v = 10·6/4 = 15; A_v = 10 − 15 = −5 kN (надолу)", () => {
    const r = solveSupportReactions(simple(0, 4), [down(6, 10)]);
    expect(r.Bv).toBeCloseTo(15, 9);
    expect(r.Av).toBeCloseTo(-5, 9);
    const check = solveReactions({
      length: 6,
      supports: { type: "simple", xA: 0, xB: 4 },
      loads: [{ type: "force", x: 6, value: 10 }],
    });
    expect(check.forces[0]!.value).toBeCloseTo(-5, 9);
    expect(check.forces[1]!.value).toBeCloseTo(15, 9);
  });

  it("Подробно 3: греда 5 m, сила 40 kN при x = 2 m под 30° спрямо оста, надолу и надясно → F_y = −20; F_x = 34,64; B_v = 20·2/5 = 8; A_v = 12; |A_h| = 34,64 kN", () => {
    // надолу и надясно: ъгъл −30° спрямо оста x
    const r = solveSupportReactions(simple(0, 5), [
      { type: "inclined", x: 2, y: 0, magnitude: 40, angleDeg: -30 },
    ]);
    expect(r.Bv).toBeCloseTo(8, 9);
    expect(r.Av).toBeCloseTo(12, 9);
    expect(Math.abs(r.Ah)).toBeCloseTo(34.64, 2);
    expect(r.Ah).toBeLessThan(0);
  });

  it("Подробно 5: една неподвижна и две подвижни опори → C = 2 + 1 + 1 = 4; n = 4 − 3 = 1", () => {
    expect(staticDeterminacy({ disks: 1, hinges: 0, supportLinks: 4 })).toBe(1);
  });
});

describe("степен на статическа определимост", () => {
  it("един диск: n = C − 3", () => {
    expect(staticDeterminacy({ disks: 1, hinges: 0, supportLinks: 3 })).toBe(0);
    expect(staticDeterminacy({ disks: 1, hinges: 0, supportLinks: 2 })).toBe(
      -1,
    );
  });

  it("гредата от загадката с една става: D = 2, S = 1, C = 4 → n = 4 + 2 − 6 = 0", () => {
    expect(staticDeterminacy({ disks: 2, hinges: 1, supportLinks: 4 })).toBe(0);
  });

  it("отказва невалиден брой", () => {
    expect(() =>
      staticDeterminacy({ disks: 0, hinges: 0, supportLinks: 3 }),
    ).toThrow();
    expect(() =>
      staticDeterminacy({ disks: 1, hinges: -1, supportLinks: 3 }),
    ).toThrow();
    expect(() =>
      staticDeterminacy({ disks: 1, hinges: 0, supportLinks: 2.5 }),
    ).toThrow();
  });
});

describe("наклонена подвижна опора и триъгълен товар (без пример в главата)", () => {
  it("греда 4 m, сила 10 kN по средата, реакция в B под 60° спрямо оста: B·sin 60°·4 = 20 → B = 5,7735; B_v = 5; B_h = 2,8868; A_h = −2,8868; A_v = 5", () => {
    const supports: PlaneSupports = {
      type: "pin-roller",
      pin: { x: 0, y: 0 },
      roller: { x: 4, y: 0 },
      rollerAngleDeg: 60,
    };
    const loads = [down(2, 10)];
    const r = solveSupportReactions(supports, loads);
    expect(r.B).toBeCloseTo(5.7735, 4);
    expect(r.Bv).toBeCloseTo(5, 9);
    expect(r.Bh).toBeCloseTo(2.8868, 4);
    expect(r.Ah).toBeCloseTo(-2.8868, 4);
    expect(r.Av).toBeCloseTo(5, 9);
    expectEquilibrium(supports, loads);
  });

  it("проста греда 6 m, триъгълен товар 0→9 kN/m: R_q = 27 kN при x = 4 m; B_v = 27·4/6 = 18; A_v = 9 kN", () => {
    const supports = simple(0, 6);
    const loads: PlaneLoad[] = [
      { type: "triangular", from: { x: 0, y: 0 }, to: { x: 6, y: 0 }, q: 9 },
    ];
    const r = solveSupportReactions(supports, loads);
    expect(r.Bv).toBeCloseTo(18, 9);
    expect(r.Av).toBeCloseTo(9, 9);
    expectEquilibrium(supports, loads);
  });
});

describe("геометрично изменяеми системи и невалидни данни", () => {
  const load = [down(2, 10)];

  it("три успоредни връзки (три подвижни опори) – грешка", () => {
    expect(() =>
      solvePlaneBody({
        constraints: [
          { type: "link", x: 0, y: 0, angleDeg: 90 },
          { type: "link", x: 3, y: 0, angleDeg: 90 },
          { type: "link", x: 6, y: 0, angleDeg: 90 },
        ],
        loads: load,
      }),
    ).toThrow(/геометрично изменяема/);
  });

  it("три връзки през една точка – грешка", () => {
    // и трите директриси минават през (3; 3)
    expect(() =>
      solvePlaneBody({
        constraints: [
          { type: "link", x: 0, y: 0, angleDeg: 45 },
          { type: "link", x: 3, y: 0, angleDeg: 90 },
          { type: "link", x: 6, y: 0, angleDeg: 135 },
        ],
        loads: load,
      }),
    ).toThrow(/геометрично изменяема/);
  });

  it("подвижна опора, чиято реакция минава през неподвижната – грешка", () => {
    expect(() =>
      solveSupportReactions(
        {
          type: "pin-roller",
          pin: { x: 0, y: 0 },
          roller: { x: 5, y: 0 },
          rollerAngleDeg: 0,
        },
        load,
      ),
    ).toThrow(/геометрично изменяема/);
  });

  it("двете опори в една и съща точка – грешка", () => {
    expect(() => solveSupportReactions(simple(2, 2), load)).toThrow();
  });

  it("отказва невалидни товари", () => {
    const supports = simple(0, 5);
    expect(() =>
      solveSupportReactions(supports, [
        { type: "force", x: Number.NaN, y: 0, fx: 0, fy: -1 },
      ]),
    ).toThrow();
    expect(() =>
      solveSupportReactions(supports, [
        { type: "inclined", x: 1, y: 0, magnitude: -5, angleDeg: 0 },
      ]),
    ).toThrow();
    expect(() => solveSupportReactions(supports, [uniform(2, 2, 5)])).toThrow();
  });
});
