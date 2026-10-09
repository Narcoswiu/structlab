import { describe, expect, it } from "vitest";
import {
  centralAxis,
  classifySpatialReduction,
  cross,
  directionCosines,
  dot,
  forceAlongLine,
  magnitude,
  momentAboutAxis,
  momentAboutPoint3,
  moveSpatialCenter,
  reduceSpatialSystem,
  spatialInvariants,
  type SpatialForce,
  type Vec3,
} from "@/lib/engineering/spatial-reduction";
import {
  classifyReduction,
  directrix,
  moveReductionCenter,
  reducePlaneSystem,
  type PlaneForce,
} from "@/lib/engineering/reduction";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Знаци: x надясно, y нагоре, z към наблюдателя (дясна система);
// M_x = y·F_z − z·F_y, M_y = z·F_x − x·F_z, M_z = x·F_y − y·F_x.

const O: Vec3 = { x: 0, y: 0, z: 0 };
const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };

const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const force = (at: Vec3, F: Vec3): SpatialForce => ({
  ...at,
  Fx: F.x,
  Fy: F.y,
  Fz: F.z,
});

function expectVec(actual: Vec3, expected: Vec3, digits = 10): void {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
  expect(actual.z).toBeCloseTo(expected.z, digits);
}

/** Двете кръстосани сили от загадката (пример Л2 / П1). */
const SKEW: SpatialForce[] = [
  force(O, vec(10, 0, 0)),
  force(vec(0, 2, 0), vec(0, 0, 10)),
];

/** Паралелепипедът 6 × 3 × 2 m от пример П2. */
const A = vec(6, 0, 0);
const G = vec(6, 3, 2);
const H = vec(0, 3, 2);
const BOX: SpatialForce[] = [
  forceAlongLine(14, A, H),
  forceAlongLine(8, H, G),
  force(G, vec(0, -4, 0)),
];

/** Табелата от „В реалния живот“: вятър 4 kN по −z и тегло 2 kN по −y в P(1,5; 6; 0). */
const P = vec(1.5, 6, 0);
const SIGN: SpatialForce[] = [force(P, vec(0, 0, -4)), force(P, vec(0, -2, 0))];

describe("вектори", () => {
  it("векторното произведение следва дясната система: x × y = z", () => {
    expectVec(cross(X, Y), Z);
    expectVec(cross(Y, Z), X);
    expectVec(cross(Z, X), Y);
    // (1; 2; 3) × (4; 5; 6) = (2·6 − 3·5; 3·4 − 1·6; 1·5 − 2·4) = (−3; 6; −3)
    expectVec(cross(vec(1, 2, 3), vec(4, 5, 6)), vec(-3, 6, -3));
  });

  it("скаларно произведение и големина", () => {
    // 1·4 + 2·5 + 3·6 = 32
    expect(dot(vec(1, 2, 3), vec(4, 5, 6))).toBeCloseTo(32, 12);
    // въпрос 1 („Леко“): √(2² + 3² + 6²) = √49 = 7
    expect(magnitude(vec(2, 3, 6))).toBeCloseTo(7, 12);
  });

  it("директорните косинуси имат сбор от квадратите 1", () => {
    // (6; 3; 2), l = 7: 6/7, 3/7, 2/7
    const c = directionCosines(vec(6, 3, 2));
    expectVec(c, vec(6 / 7, 3 / 7, 2 / 7));
    expect(c.x ** 2 + c.y ** 2 + c.z ** 2).toBeCloseTo(1, 12);
    expect(() => directionCosines(O)).toThrow();
  });

  it("отказва безкрайни и нечислови стойности", () => {
    expect(() => cross(vec(NaN, 0, 0), X)).toThrow();
    expect(() => momentAboutPoint3(force(O, vec(Infinity, 0, 0)))).toThrow();
    expect(() => reduceSpatialSystem([], [vec(0, NaN, 0)])).toThrow();
    expect(() => reduceSpatialSystem([], [], vec(0, 0, Infinity))).toThrow();
    expect(() => forceAlongLine(10, O, O)).toThrow();
    expect(() => classifySpatialReduction({ R: X, M: X }, -1)).toThrow();
  });
});

describe("пример Л1 – проекции на сила по диагонала на кутия 6 × 3 × 2", () => {
  it("14 kN от O към (6; 3; 2): проекции 12, 6 и 4 kN", () => {
    // l = √(36 + 9 + 4) = 7; F_x = 14·6/7 = 12; F_y = 14·3/7 = 6; F_z = 14·2/7 = 4
    const F = forceAlongLine(14, O, vec(6, 3, 2));
    expect(F.Fx).toBeCloseTo(12, 10);
    expect(F.Fy).toBeCloseTo(6, 10);
    expect(F.Fz).toBeCloseTo(4, 10);
    // проверка: √(144 + 36 + 16) = √196 = 14
    expect(magnitude(vec(F.Fx, F.Fy, F.Fz))).toBeCloseTo(14, 10);
  });

  it("въпрос 1 („Подробно“): 26 kN от (0; 0; 0) към (3; 4; 12) → (6; 8; 24)", () => {
    // l = √(9 + 16 + 144) = 13; 26·3/13 = 6; 26·4/13 = 8; 26·12/13 = 24
    const F = forceAlongLine(26, O, vec(3, 4, 12));
    expectVec(vec(F.Fx, F.Fy, F.Fz), vec(6, 8, 24));
  });
});

describe("момент спрямо точка и спрямо ос", () => {
  it("z-проекцията е равнинната формула M_z = x·F_y − y·F_x", () => {
    // сила (40; 30; 0) в (2; 1; 0) – пример 2 от Глава 1: 2·30 − 1·40 = 20
    const M = momentAboutPoint3(force(vec(2, 1, 0), vec(40, 30, 0)));
    expectVec(M, vec(0, 0, 20));
  });

  it("въпрос 2 („Подробно“): сила (0; 0; −10) в (2; 3; 0)", () => {
    // M_x = 3·(−10) − 0 = −30; M_y = 0·0 − 2·(−10) = 20; M_z = 2·0 − 3·0 = 0
    const F = force(vec(2, 3, 0), vec(0, 0, -10));
    expectVec(momentAboutPoint3(F), vec(-30, 20, 0));
    expect(momentAboutAxis(F, O, X)).toBeCloseTo(-30, 10);
  });

  it("въпрос 2 („Леко“): сила 5 kN, успоредна на z, през (0; 3; 0)", () => {
    const F = force(vec(0, 3, 0), vec(0, 0, 5));
    // успоредна на оста z → 0
    expect(momentAboutAxis(F, O, Z)).toBeCloseTo(0, 12);
    // на 3 m от оста x → 5·3 = 15 (M_x = 3·5 − 0 = +15)
    expect(momentAboutAxis(F, O, X)).toBeCloseTo(15, 12);
    // пресича оста y → 0
    expect(momentAboutAxis(F, O, Y)).toBeCloseTo(0, 12);
  });

  it("моментът спрямо ос е проекцията на вектора на момента върху оста", () => {
    const F = forceAlongLine(14, A, H); // (−12; 6; 4) в A(6; 0; 0)
    const M = momentAboutPoint3(F); // (0; −24; 36)
    expectVec(M, vec(0, -24, 36));
    expect(momentAboutAxis(F, O, X)).toBeCloseTo(M.x, 10);
    expect(momentAboutAxis(F, O, Y)).toBeCloseTo(M.y, 10);
    expect(momentAboutAxis(F, O, Z)).toBeCloseTo(M.z, 10);
    // наклонена ос през O по (1; 2; 2), l = 3: (0·1 − 24·2 + 36·2)/3 = 24/3 = 8
    const axis = vec(1, 2, 2);
    expect(momentAboutAxis(F, O, axis)).toBeCloseTo(8, 10);
    expect(momentAboutAxis(F, O, axis)).toBeCloseTo(
      dot(M, directionCosines(axis)),
      10,
    );
  });

  it("не зависи от това коя точка от оста е избрана", () => {
    const F = force(vec(1, -2, 3), vec(4, 5, -6));
    const axis = vec(2, -1, 2);
    const onAxis = (t: number) => vec(1 + 2 * t, 1 - t, -1 + 2 * t);
    const reference = momentAboutAxis(F, onAxis(0), axis);
    for (const t of [-3, 0.5, 7]) {
      expect(momentAboutAxis(F, onAxis(t), axis)).toBeCloseTo(reference, 9);
    }
  });

  it("сила, успоредна на оста или пресичаща я, няма момент спрямо нея", () => {
    // успоредна на оста y, встрани от нея
    expect(
      momentAboutAxis(force(vec(3, 0, 2), vec(0, 7, 0)), O, Y),
    ).toBeCloseTo(0, 12);
    // от (3; 5; 4) към точката (0; 2; 0) от оста y – пресича оста
    const towards = forceAlongLine(9, vec(3, 5, 4), vec(0, 2, 0));
    expect(momentAboutAxis(towards, O, Y)).toBeCloseTo(0, 10);
    // перпендикулярна на оста y, на рамо 3 m: сила 7 kN по −z в (3; 5; 0) → +21
    // (M_y = z·F_x − x·F_z = 0 − 3·(−7) = 21)
    expect(
      momentAboutAxis(force(vec(3, 5, 0), vec(0, 0, -7)), O, Y),
    ).toBeCloseTo(21, 12);
  });
});

describe("пример Л2 / П1 – две кръстосани сили по 10 kN", () => {
  const reduction = reduceSpatialSystem(SKEW);

  it("главен вектор (10; 0; 10), R = 14,14 kN; главен момент (20; 0; 0)", () => {
    // R = √(100 + 100) = √200 = 14,142
    expectVec(reduction.R, vec(10, 0, 10));
    expect(reduction.Rmag).toBeCloseTo(14.142, 3);
    // F_1 минава през O; F_2: M_x = 2·10 − 0 = 20, M_y = 0, M_z = 0
    expectVec(reduction.M, vec(20, 0, 0));
  });

  it("втори инвариант 200 → динама с M* = 14,14 kN·m", () => {
    // 10·20 + 0·0 + 10·0 = 200; M* = 200/14,142 = 14,142 (= 10·√2)
    const invariants = spatialInvariants(reduction);
    expect(invariants.scalar).toBeCloseTo(200, 10);
    expect(invariants.minMoment).toBeCloseTo(14.142, 3);
    expect(invariants.minMoment).toBeCloseTo(10 * Math.SQRT2, 10);
    expect(classifySpatialReduction(reduction)).toBe("wrench");
    // с отпечатаната закръглена стойност: 200/14,14 = 14,144 → 14,14
    expect(200 / 14.14).toBeCloseTo(14.14, 2);
  });

  it("централната ос минава през C(0; 1; 0) – средата на OA", () => {
    // R × M_O = (0·0 − 10·0; 10·20 − 10·0; 10·0 − 0·20) = (0; 200; 0); /R² = /200
    expectVec(cross(reduction.R, reduction.M), vec(0, 200, 0));
    const axis = centralAxis(reduction);
    expectVec(axis.point, vec(0, 1, 0));
    expect(axis.distance).toBeCloseTo(1, 10);
    expectVec(axis.direction, vec(Math.SQRT1_2, 0, Math.SQRT1_2));
    expectVec(axis.momentVector, vec(10, 0, 10));
    // параметър p = 200/200 = 1 m
    expect(axis.pitch).toBeCloseTo(1, 10);
  });

  it("проверка: моментът спрямо C е (10; 0; 10) – и по формулата, и директно", () => {
    const C = vec(0, 1, 0);
    // (r_O − r_C) × R = (0; −1; 0) × (10; 0; 10) = (−10; 0; 10)
    expectVec(cross(vec(0, -1, 0), reduction.R), vec(-10, 0, 10));
    expectVec(moveSpatialCenter(reduction, C).M, vec(10, 0, 10));
    // директно: F_1 от (0; −1; 0) → (0; 0; 10); F_2 от (0; 1; 0) → (10; 0; 0)
    expectVec(momentAboutPoint3(SKEW[0]!, C), vec(0, 0, 10));
    expectVec(momentAboutPoint3(SKEW[1]!, C), vec(10, 0, 0));
    expectVec(reduceSpatialSystem(SKEW, [], C).M, vec(10, 0, 10));
  });
});

describe("пример П2 (изпитен тип) – паралелепипед 6 × 3 × 2 с три сили", () => {
  const reduction = reduceSpatialSystem(BOX);

  it("проекции на F_1 = 14 kN по диагонала AH: (−12; 6; 4)", () => {
    // AH = (−6; 3; 2), l = 7; 14·(−6/7) = −12; 14·3/7 = 6; 14·2/7 = 4
    const F1 = BOX[0]!;
    expectVec(vec(F1.Fx, F1.Fy, F1.Fz), vec(-12, 6, 4));
    const F2 = BOX[1]!;
    expectVec(vec(F2.Fx, F2.Fy, F2.Fz), vec(8, 0, 0));
  });

  it("главен вектор (−4; 2; 4), R = 6 kN", () => {
    // R_x = −12 + 8 + 0 = −4; R_y = 6 + 0 − 4 = 2; R_z = 4; R = √(16 + 4 + 16) = 6
    expectVec(reduction.R, vec(-4, 2, 4));
    expect(reduction.Rmag).toBeCloseTo(6, 10);
  });

  it("моменти на трите сили спрямо O и главен момент (8; −8; −12)", () => {
    // F_1 в (6; 0; 0): (0·4 − 0·6; 0·(−12) − 6·4; 6·6 − 0·(−12)) = (0; −24; 36)
    expectVec(momentAboutPoint3(BOX[0]!), vec(0, -24, 36));
    // F_2 в (0; 3; 2): (3·0 − 2·0; 2·8 − 0·0; 0·0 − 3·8) = (0; 16; −24)
    expectVec(momentAboutPoint3(BOX[1]!), vec(0, 16, -24));
    // F_3 в (6; 3; 2): (3·0 − 2·(−4); 2·0 − 6·0; 6·(−4) − 3·0) = (8; 0; −24)
    expectVec(momentAboutPoint3(BOX[2]!), vec(8, 0, -24));
    expectVec(reduction.M, vec(8, -8, -12));
    // M_O = √(64 + 64 + 144) = √272 = 16,49
    expect(reduction.Mmag).toBeCloseTo(16.49, 2);
  });

  it("втори инвариант −96 → динама, M* = −16 kN·m", () => {
    // (−4)·8 + 2·(−8) + 4·(−12) = −32 − 16 − 48 = −96; M* = −96/6 = −16
    const invariants = spatialInvariants(reduction);
    expect(invariants.scalar).toBeCloseTo(-96, 10);
    expect(invariants.minMoment).toBeCloseTo(-16, 10);
    expect(classifySpatialReduction(reduction)).toBe("wrench");
  });

  it("перпендикулярна съставка 4 kN·m и разстояние до централната ос 0,667 m", () => {
    // M_⊥ = √(272 − 256) = 4; d = 4/6 = 0,667
    const axis = centralAxis(reduction);
    expect(Math.sqrt(reduction.Mmag ** 2 - axis.moment ** 2)).toBeCloseTo(
      4,
      10,
    );
    expect(axis.distance).toBeCloseTo(0.667, 3);
    // R × M_O = (2·(−12) − 4·(−8); 4·8 − (−4)·(−12); (−4)·(−8) − 2·8) = (8; −16; 16); /36
    expectVec(axis.point, vec(8 / 36, -16 / 36, 16 / 36));
    // вектор на минималния момент: −16·(−4; 2; 4)/6 = (10,667; −5,333; −10,667)
    expectVec(axis.momentVector, vec(32 / 3, -16 / 3, -32 / 3));
  });

  it("проверка с център G(6; 3; 2): директно и по формулата – (0; 24; −36)", () => {
    // директно: F_2 и F_3 минават през G; F_1 от (0; −3; −2):
    // ((−3)·4 − (−2)·6; (−2)·(−12) − 0·4; 0·6 − (−3)·(−12)) = (0; 24; −36)
    expectVec(momentAboutPoint3(BOX[0]!, G), vec(0, 24, -36));
    expectVec(momentAboutPoint3(BOX[1]!, G), vec(0, 0, 0));
    expectVec(momentAboutPoint3(BOX[2]!, G), vec(0, 0, 0));
    const direct = reduceSpatialSystem(BOX, [], G);
    expectVec(direct.M, vec(0, 24, -36));
    // формулата: (r_O − r_G) × R = (−6; −3; −2) × (−4; 2; 4)
    //   = ((−3)·4 − (−2)·2; (−2)·(−4) − (−6)·4; (−6)·2 − (−3)·(−4)) = (−8; 32; −24)
    expectVec(cross(vec(-6, -3, -2), reduction.R), vec(-8, 32, -24));
    const moved = moveSpatialCenter(reduction, G);
    expectVec(moved.M, direct.M);
    // вторият инвариант за G: (−4)·0 + 2·24 + 4·(−36) = 48 − 144 = −96
    expect(spatialInvariants(moved).scalar).toBeCloseTo(-96, 10);
    expectVec(moved.R, reduction.R);
  });
});

describe("табелата от „В реалния живот“", () => {
  const reduction = reduceSpatialSystem(SIGN);

  it("моменти в основата: M_x = −24, M_y = 6, M_z = −3 kN·m", () => {
    // сила (0; −2; −4) в (1,5; 6; 0):
    // M_x = 6·(−4) − 0·(−2) = −24; M_y = 0·0 − 1,5·(−4) = 6; M_z = 1,5·(−2) − 6·0 = −3
    expectVec(reduction.R, vec(0, -2, -4));
    expectVec(reduction.M, vec(-24, 6, -3));
  });

  it("„Леко“: по големина 4·6 = 24, 4·1,5 = 6 и 2·1,5 = 3", () => {
    const wind = SIGN[0]!;
    const weight = SIGN[1]!;
    expect(Math.abs(momentAboutAxis(wind, O, X))).toBeCloseTo(24, 10);
    expect(Math.abs(momentAboutAxis(wind, O, Y))).toBeCloseTo(6, 10);
    expect(momentAboutAxis(wind, O, Z)).toBeCloseTo(0, 10);
    expect(Math.abs(momentAboutAxis(weight, O, Z))).toBeCloseTo(3, 10);
    expect(momentAboutAxis(weight, O, X)).toBeCloseTo(0, 10);
    expect(momentAboutAxis(weight, O, Y)).toBeCloseTo(0, 10);
  });

  it("вторият инвариант е нула → равнодействаща през P", () => {
    // 0·(−24) + (−2)·6 + (−4)·(−3) = −12 + 12 = 0
    expect(spatialInvariants(reduction).scalar).toBeCloseTo(0, 10);
    expect(classifySpatialReduction(reduction)).toBe("resultant");
    // спрямо P моментът е нула – директрисата минава през P
    expectVec(moveSpatialCenter(reduction, P).M, vec(0, 0, 0));
    const axis = centralAxis(reduction);
    expect(axis.moment).toBeCloseTo(0, 10);
    // P лежи на централната ос: (P − точка) е успореден на R
    const along = cross(
      vec(P.x - axis.point.x, P.y - axis.point.y, P.z - axis.point.z),
      reduction.R,
    );
    expectVec(along, vec(0, 0, 0), 9);
    // R = √(4 + 16) = √20 = 4,47 kN
    expect(reduction.Rmag).toBeCloseTo(4.47, 2);
  });

  it("с теглото на стълба 3 kN по оста му системата става динама", () => {
    // R = (0; −5; −4); M_O не се променя; R·M_O = (−5)·6 + (−4)·(−3) = −30 + 12 = −18
    const withPole = reduceSpatialSystem([
      ...SIGN,
      force(vec(0, 3, 0), vec(0, -3, 0)),
    ]);
    expectVec(withPole.R, vec(0, -5, -4));
    expectVec(withPole.M, vec(-24, 6, -3));
    expect(spatialInvariants(withPole).scalar).toBeCloseTo(-18, 10);
    expect(classifySpatialReduction(withPole)).toBe("wrench");
  });
});

describe("въпроси от „Провери се“", () => {
  it("„Леко“ 3: R = (0; 0; 8), M_O = (6; 0; 0) → равнодействаща на 0,75 m", () => {
    // 0·6 + 0·0 + 8·0 = 0; d = 6/8 = 0,75
    const reduction = {
      center: O,
      R: vec(0, 0, 8),
      Rmag: 8,
      M: vec(6, 0, 0),
      Mmag: 6,
    };
    expect(classifySpatialReduction(reduction)).toBe("resultant");
    expect(centralAxis(reduction).distance).toBeCloseTo(0.75, 12);
  });

  it("„Леко“ 4: R = (0; 0; 8), M_O = (0; 0; 6) → динама", () => {
    // 8·6 = 48 ≠ 0
    const reduction = {
      center: O,
      R: vec(0, 0, 8),
      Rmag: 8,
      M: vec(0, 0, 6),
      Mmag: 6,
    };
    expect(spatialInvariants(reduction).scalar).toBeCloseTo(48, 12);
    expect(classifySpatialReduction(reduction)).toBe("wrench");
    // моментът вече е по силата – централната ос минава през O
    expect(centralAxis(reduction).distance).toBeCloseTo(0, 12);
  });

  it("„Подробно“ 3 и 4: R = (3; 0; 4), M_O = (10; 5; 20)", () => {
    const reduction = {
      center: O,
      R: vec(3, 0, 4),
      Rmag: 5,
      M: vec(10, 5, 20),
      Mmag: Math.hypot(10, 5, 20),
    };
    // 3·10 + 0·5 + 4·20 = 110; M* = 110/5 = 22
    const invariants = spatialInvariants(reduction);
    expect(invariants.scalar).toBeCloseTo(110, 12);
    expect(invariants.minMoment).toBeCloseTo(22, 12);
    expect(classifySpatialReduction(reduction)).toBe("wrench");
    // център B(0; 2; 0): (0; −2; 0) × (3; 0; 4) = (−2·4 − 0; 0·3 − 0·4; 0 − (−2)·3) = (−8; 0; 6)
    const moved = moveSpatialCenter(reduction, vec(0, 2, 0));
    expectVec(moved.M, vec(2, 5, 26));
    // 3·2 + 0·5 + 4·26 = 6 + 104 = 110
    expect(spatialInvariants(moved).scalar).toBeCloseTo(110, 12);
  });

  it("„Подробно“ 5: успоредни сили никога не дават динама", () => {
    const parallel: SpatialForce[] = [
      force(vec(1, 0, 2), vec(0, -10, 0)),
      force(vec(4, 0, -1), vec(0, -25, 0)),
      force(vec(-2, 0, 3), vec(0, 15, 0)),
    ];
    const reduction = reduceSpatialSystem(parallel, [], vec(3, 7, -5));
    expect(spatialInvariants(reduction).scalar).toBeCloseTo(0, 9);
    expect(classifySpatialReduction(reduction)).toBe("resultant");
  });
});

describe("независими проверки", () => {
  /** Произволна система с двоица – без „хубави“ числа. */
  const forces: SpatialForce[] = [
    force(vec(1, 2, -1), vec(3, -4, 5)),
    force(vec(-2, 0.5, 3), vec(-1, 6, 2)),
    force(vec(4, -3, 2), vec(7, 1, -8)),
  ];
  const couples: Vec3[] = [vec(5, -2, 9)];
  const centerA = vec(1, 1, 1);
  const centerB = vec(-3, 4, 2.5);

  it("главният момент спрямо втори център: директно = M_A + (r_A − r_B) × R", () => {
    const atA = reduceSpatialSystem(forces, couples, centerA);
    const direct = reduceSpatialSystem(forces, couples, centerB);
    const moved = moveSpatialCenter(atA, centerB);
    expectVec(moved.M, direct.M, 9);
    expectVec(moved.R, direct.R, 9);
    expect(moved.center).toEqual(centerB);
    // и обратно – връщането в A дава началния момент
    expectVec(moveSpatialCenter(moved, centerA).M, atA.M, 9);
  });

  it("двата инварианта са еднакви за два различни центъра", () => {
    const atA = spatialInvariants(
      reduceSpatialSystem(forces, couples, centerA),
    );
    const atB = spatialInvariants(
      reduceSpatialSystem(forces, couples, centerB),
    );
    expectVec(atA.R, atB.R, 9);
    expect(atA.scalar).toBeCloseTo(atB.scalar, 8);
    expect(atA.minMoment!).toBeCloseTo(atB.minMoment!, 8);
  });

  it("по централната ос моментът е успореден на R и е най-малкият", () => {
    const reduction = reduceSpatialSystem(forces, couples, centerA);
    const axis = centralAxis(reduction);
    for (const t of [-2, 0, 3.5]) {
      const point = vec(
        axis.point.x + t * axis.direction.x,
        axis.point.y + t * axis.direction.y,
        axis.point.z + t * axis.direction.z,
      );
      const there = reduceSpatialSystem(forces, couples, point);
      expectVec(cross(there.M, there.R), vec(0, 0, 0), 8);
      expectVec(there.M, axis.momentVector, 8);
      expect(there.Mmag).toBeCloseTo(Math.abs(axis.moment), 8);
    }
    // встрани от оста моментът е по-голям
    expect(reduction.Mmag).toBeGreaterThan(Math.abs(axis.moment));
    // централната ос не зависи от центъра, от който е намерена
    const fromB = centralAxis(reduceSpatialSystem(forces, couples, centerB));
    const between = vec(
      fromB.point.x - axis.point.x,
      fromB.point.y - axis.point.y,
      fromB.point.z - axis.point.z,
    );
    expectVec(cross(between, reduction.R), vec(0, 0, 0), 8);
    expect(fromB.moment).toBeCloseTo(axis.moment, 8);
  });

  it("равнинна система (z = 0, F_z = 0) повтаря резултатите от reduction.ts", () => {
    // пример 1 от Глава 2: R = (50; 10), M_O = −155, M_B(4; 0) = −195
    const plane: PlaneForce[] = [
      { x: 0, y: 3, Fx: 20, Fy: 0 },
      { x: 4, y: 0, Fx: 0, Fy: -30 },
      { x: 2, y: 1, Fx: 30, Fy: 40 },
    ];
    const planeCouples = [-25];
    const spatial = plane.map((f) =>
      force(vec(f.x, f.y, 0), vec(f.Fx, f.Fy, 0)),
    );
    const spatialCouples = planeCouples.map((m) => vec(0, 0, m));

    const flat = reducePlaneSystem(plane, planeCouples);
    const full = reduceSpatialSystem(spatial, spatialCouples);
    expectVec(full.R, vec(flat.Rx, flat.Ry, 0));
    expectVec(full.M, vec(0, 0, flat.M));
    expect(full.M.z).toBeCloseTo(-155, 10);
    expect(full.Rmag).toBeCloseTo(flat.R, 10);

    const flatB = moveReductionCenter(flat, { x: 4, y: 0 });
    const fullB = moveSpatialCenter(full, vec(4, 0, 0));
    expectVec(fullB.M, vec(0, 0, flatB.M));
    expect(fullB.M.z).toBeCloseTo(-195, 10);

    // вторият инвариант на равнинна система е нула; случаят е равнодействаща
    expect(spatialInvariants(full).scalar).toBeCloseTo(0, 10);
    expect(classifySpatialReduction(full)).toBe("resultant");
    expect(classifyReduction(flat)).toBe("resultant");

    // централната ос съвпада с директрисата: най-близка точка и разстояние
    const line = directrix(flat);
    const axis = centralAxis(full);
    expectVec(axis.point, vec(line.foot.x, line.foot.y, 0));
    expect(axis.distance).toBeCloseTo(line.distance, 10);
    expect(axis.moment).toBeCloseTo(0, 10);
  });

  it("равнинна двоица (пример 2 от Глава 2) остава двоица с M_z = 36", () => {
    const plane: PlaneForce[] = [
      { x: 0, y: 0, Fx: 12, Fy: 0 },
      { x: 4, y: 0, Fx: 0, Fy: 9 },
      { x: 4, y: 3, Fx: -12, Fy: -9 },
    ];
    const full = reduceSpatialSystem(
      plane.map((f) => force(vec(f.x, f.y, 0), vec(f.Fx, f.Fy, 0))),
    );
    expectVec(full.M, vec(0, 0, reducePlaneSystem(plane).M));
    expect(full.M.z).toBeCloseTo(36, 10);
    expect(classifySpatialReduction(full)).toBe("couple");
  });
});

describe("класификация на построени примери", () => {
  it("равновесие: две равни и противоположни сили по една права", () => {
    const reduction = reduceSpatialSystem(
      [force(vec(1, 1, 1), vec(2, 4, 4)), force(vec(2, 3, 3), vec(-2, -4, -4))],
      [],
      vec(5, -1, 2),
    );
    expect(classifySpatialReduction(reduction)).toBe("equilibrium");
    expect(() => centralAxis(reduction)).toThrow();
    expect(spatialInvariants(reduction).minMoment).toBeNull();
  });

  it("двоица: равни и противоположни сили на успоредни прави", () => {
    // ±6 kN по z, на 2 m една от друга по x: M = (2; 0; 0) × (0; 0; 6) = (0; −12; 0)
    const pair = [force(vec(2, 0, 0), vec(0, 0, 6)), force(O, vec(0, 0, -6))];
    const reduction = reduceSpatialSystem(pair);
    expectVec(reduction.M, vec(0, -12, 0));
    expect(classifySpatialReduction(reduction)).toBe("couple");
    // моментът на двоицата е един и същ за всеки център
    expectVec(reduceSpatialSystem(pair, [], vec(7, -3, 11)).M, vec(0, -12, 0));
    expect(() => centralAxis(reduction)).toThrow();
  });

  it("равнодействаща: сходящи сили в пространството", () => {
    const at = vec(2, -1, 3);
    const reduction = reduceSpatialSystem([
      force(at, vec(3, 0, 1)),
      force(at, vec(-1, 5, 2)),
      force(at, vec(0, 2, -7)),
    ]);
    expect(reduction.Mmag).toBeGreaterThan(1);
    expect(classifySpatialReduction(reduction)).toBe("resultant");
    expectVec(moveSpatialCenter(reduction, at).M, vec(0, 0, 0), 9);
  });

  it("динама: сила и двоица около самата нея (отвертката)", () => {
    // сила 10 kN по −x през O и двоица с момент 3 kN·m по −x
    const reduction = reduceSpatialSystem(
      [force(O, vec(-10, 0, 0))],
      [vec(-3, 0, 0)],
    );
    expect(classifySpatialReduction(reduction)).toBe("wrench");
    const axis = centralAxis(reduction);
    expect(axis.moment).toBeCloseTo(3, 12);
    expect(axis.distance).toBeCloseTo(0, 12);
  });

  it("допускът решава граничните случаи", () => {
    const tiny = { R: vec(1e-12, 0, 0), M: vec(0, 0, 1e-12) };
    expect(classifySpatialReduction(tiny)).toBe("equilibrium");
    expect(classifySpatialReduction(tiny, 0)).toBe("resultant");
    expect(
      classifySpatialReduction(
        { R: vec(0, 0, 1e-3), M: vec(0, 0, 1e-3) },
        1e-5,
      ),
    ).toBe("resultant");
  });
});
