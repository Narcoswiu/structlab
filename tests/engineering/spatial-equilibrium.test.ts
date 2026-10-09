import { describe, expect, it } from "vitest";
import {
  momentAboutAxis,
  momentAboutPoint,
  reduceSpatialLoads,
  rodDirection,
  solvePlateOnThreeSupports,
  solveSpatialBody,
  spatialDeterminacy,
  spatialFixedSupport,
  spatialResiduals,
  sphericalJoint,
  unitVector,
  type PlanPoint,
  type SpatialBody,
  type SpatialConstraint,
  type SpatialLoad,
  type Vec3,
  type VerticalLoad,
} from "@/lib/engineering/spatial-equilibrium";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Знаци: x надясно, y нагоре, z към наблюдателя (дясна система);
// M_x = y·F_z − z·F_y, M_y = z·F_x − x·F_z, M_z = x·F_y − y·F_x.

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const X = v(1, 0, 0);
const Y = v(0, 1, 0);
const Z = v(0, 0, 1);
const link = (at: Vec3, direction: Vec3): SpatialConstraint => ({
  type: "link",
  at,
  direction,
});
const force = (at: Vec3, f: Vec3): SpatialLoad => ({
  type: "force",
  at,
  force: f,
});

/** Шестте остатъка са нула спрямо началото и спрямо точка извън тялото. */
function expectEquilibrium(body: SpatialBody, reactions: number[]) {
  for (const about of [v(0, 0, 0), v(7.3, -2.6, 4.1)]) {
    const r = spatialResiduals(body, reactions, about);
    for (const value of [
      r.force.x,
      r.force.y,
      r.force.z,
      r.moment.x,
      r.moment.y,
      r.moment.z,
    ]) {
      expect(value).toBeCloseTo(0, 9);
    }
  }
}

// Независимо решение на 6×6 система: правило на Крамер с детерминанти по
// развитие по първия ред (нищо общо с Гаусовото изключване в библиотеката).
function det(m: number[][]): number {
  if (m.length === 1) return m[0]![0]!;
  let sum = 0;
  for (let j = 0; j < m.length; j += 1) {
    const minor = m.slice(1).map((row) => row.filter((_, k) => k !== j));
    sum += (j % 2 === 0 ? 1 : -1) * m[0]![j]! * det(minor);
  }
  return sum;
}
function cramer(a: number[][], b: number[]): number[] {
  const d = det(a);
  return b.map(
    (_, j) =>
      det(a.map((row, i) => row.map((value, k) => (k === j ? b[i]! : value)))) /
      d,
  );
}

describe("момент спрямо точка и спрямо ос", () => {
  // „Подробно“, въпрос 3: F_z = 10 kN в точка (2; 3; 0):
  // M_x = y·F_z − z·F_y = 3·10 = 30; M_y = z·F_x − x·F_z = −2·10 = −20; M_z = 0
  it("сила 10 kN по z в (2; 3; 0): M = (30; −20; 0) kN·m", () => {
    const m = momentAboutPoint(v(2, 3, 0), v(0, 0, 10));
    expect(m.x).toBeCloseTo(30, 12);
    expect(m.y).toBeCloseTo(-20, 12);
    expect(m.z).toBeCloseTo(0, 12);
    expect(momentAboutAxis(v(2, 3, 0), v(0, 0, 10), v(0, 0, 0), X)).toBeCloseTo(
      30,
      12,
    );
    expect(momentAboutAxis(v(2, 3, 0), v(0, 0, 10), v(0, 0, 0), Y)).toBeCloseTo(
      -20,
      12,
    );
  });

  it("M_z съвпада с формулата за равнината: сила (3; 4) в (2; 1) → 2·4 − 1·3 = 5", () => {
    expect(momentAboutPoint(v(2, 1, 0), v(3, 4, 0)).z).toBeCloseTo(5, 12);
  });

  it("сила, успоредна на оста или пресичаща я, няма момент спрямо нея", () => {
    // успоредна на y, спрямо оста y
    expect(momentAboutAxis(v(2, 0, 3), v(0, -7, 0), v(0, 0, 0), Y)).toBeCloseTo(
      0,
      12,
    );
    // директрисата минава през точка (0; 5; 0) от оста y
    expect(
      momentAboutAxis(v(2, 3, 4), v(-2, 2, -4), v(0, 0, 0), Y),
    ).toBeCloseTo(0, 12);
  });

  it("двоицата влиза в главния момент без рамо", () => {
    const r = reduceSpatialLoads(
      [{ type: "couple", moment: v(1, -2, 3) }],
      v(5, 5, 5),
    );
    expect(r.force).toEqual(v(0, 0, 0));
    expect(r.moment).toEqual(v(1, -2, 3));
  });

  it("прът от (4; 0; 0) към (0; −3; 0): посока (−0,8; −0,6; 0)", () => {
    const u = rodDirection(v(4, 0, 0), v(0, -3, 0));
    expect(u.x).toBeCloseTo(-0.8, 12);
    expect(u.y).toBeCloseTo(-0.6, 12);
    expect(u.z).toBeCloseTo(0, 12);
  });

  it("невалиден вход", () => {
    expect(() => unitVector(v(0, 0, 0))).toThrow();
    expect(() => rodDirection(v(1, 1, 1), v(1, 1, 1))).toThrow();
    expect(() => momentAboutPoint(v(Number.NaN, 0, 0), v(1, 0, 0))).toThrow();
  });
});

describe("плоча на три вертикални опори (пример 1 в двата режима)", () => {
  // Плоча 4 × 3 m в равнината xz. Опори A(0; 0), B(4; 0), C(2; 3) (x; z).
  // Сила 24 kN надолу в K(2,5; 1).
  //   ΣM_x = 0 (оста AB): 3·C − 1·24 = 0            → C_y = 8
  //   ΣM_z = 0: 4·B + 2·8 − 2,5·24 = 0 → 4·B = 44    → B_y = 11
  //   ΣF_y = 0: A = 24 − 11 − 8                      → A_y = 5
  const A: PlanPoint = { x: 0, z: 0 };
  const B: PlanPoint = { x: 4, z: 0 };
  const C: PlanPoint = { x: 2, z: 3 };
  const K: VerticalLoad = { x: 2.5, z: 1, value: 24 };
  const [Ay, By, Cy] = solvePlateOnThreeSupports([A, B, C], [K]);

  it("A_y = 5, B_y = 11, C_y = 8 kN", () => {
    expect(Ay).toBeCloseTo(5, 12);
    expect(By).toBeCloseTo(11, 12);
    expect(Cy).toBeCloseTo(8, 12);
  });

  it("реакциите се събират до товара: 5 + 11 + 8 = 24", () => {
    expect(Ay + By + Cy).toBeCloseTo(24, 12);
  });

  it("моментът спрямо правата през две опори дава третата реакция направо", () => {
    const at = (p: PlanPoint) => v(p.x, 0, p.z);
    const down = v(0, -24, 0);
    const up = Y;
    const cases: [PlanPoint, PlanPoint, PlanPoint, number][] = [
      // ос AB: рамо на C 3 m, рамо на товара 1 m → C = 24·1/3 = 8
      [A, B, C, 8],
      // ос AC: разстояния |3x − 2z|/√13: B → 12/√13, K → 5,5/√13 → B = 24·5,5/12 = 11
      [A, C, B, 11],
      // ос BC: разстояния |3x + 2z − 12|/√13: A → 12/√13, K → 2,5/√13 → A = 24·2,5/12 = 5
      [B, C, A, 5],
    ];
    for (const [p, q, third, expected] of cases) {
      const axis = v(q.x - p.x, 0, q.z - p.z);
      const fromLoad = momentAboutAxis(at(K), down, at(p), axis);
      const perUnit = momentAboutAxis(at(third), up, at(p), axis);
      expect(-fromLoad / perUnit).toBeCloseTo(expected, 12);
    }
    // рамената, отпечатани в текста
    expect(12 / Math.sqrt(13)).toBeCloseTo(3.328, 3);
    expect(5.5 / Math.sqrt(13)).toBeCloseTo(1.525, 3);
    expect(2.5 / Math.sqrt(13)).toBeCloseTo(0.693, 3);
  });

  it("проверката в „Леко“: ос по десния ръб (x = 4) → 5·4 + 8·2 − 24·1,5 = 0", () => {
    expect(Ay * 4 + Cy * 2 - 24 * 1.5).toBeCloseTo(0, 12);
    const about = v(4, 0, 0);
    const total =
      momentAboutAxis(v(0, 0, 0), v(0, Ay, 0), about, Z) +
      momentAboutAxis(v(2, 0, 3), v(0, Cy, 0), about, Z) +
      momentAboutAxis(v(2.5, 0, 1), v(0, -24, 0), about, Z);
    expect(total).toBeCloseTo(0, 12);
  });

  it("същото като 6×6 система: сферична става в A, две връзки в B, една в C", () => {
    const body: SpatialBody = {
      constraints: [
        ...sphericalJoint(v(0, 0, 0)),
        link(v(4, 0, 0), Y),
        link(v(4, 0, 0), Z),
        link(v(2, 0, 3), Y),
      ],
      loads: [force(v(2.5, 0, 1), v(0, -24, 0))],
    };
    const r = solveSpatialBody(body);
    const expected = [0, 5, 0, 11, 0, 8];
    r.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 10));
    expectEquilibrium(body, r);
  });

  it("„Леко“, въпрос 2: опори (0; 0), (6; 0), (3; 4), сила 24 kN в (3; 1) → 9, 9 и 6 kN", () => {
    // ΣM_x: 4·C = 1·24 → C = 6; симетрия спрямо x = 3 → A = B = (24 − 6)/2 = 9
    const r = solvePlateOnThreeSupports(
      [
        { x: 0, z: 0 },
        { x: 6, z: 0 },
        { x: 3, z: 4 },
      ],
      [{ x: 3, z: 1, value: 24 }],
    );
    expect(r[0]).toBeCloseTo(9, 12);
    expect(r[1]).toBeCloseTo(9, 12);
    expect(r[2]).toBeCloseTo(6, 12);
  });

  it("„Подробно“, въпрос 1: опори (0; 0), (4; 0), (0; 3), сила 12 kN в (3; 2) → −5, 9 и 8 kN", () => {
    // ΣM_x: 3·C = 2·12 → C = 8; ΣM_z: 4·B = 3·12 → B = 9; A = 12 − 9 − 8 = −5
    const r = solvePlateOnThreeSupports(
      [
        { x: 0, z: 0 },
        { x: 4, z: 0 },
        { x: 0, z: 3 },
      ],
      [{ x: 3, z: 2, value: 12 }],
    );
    expect(r[0]).toBeCloseTo(-5, 12);
    expect(r[1]).toBeCloseTo(9, 12);
    expect(r[2]).toBeCloseTo(8, 12);
    // товарът е извън триъгълника на опорите: 3/4 + 2/3 > 1
    expect(3 / 4 + 2 / 3).toBeGreaterThan(1);
  });

  it("три опори на една права → грешка", () => {
    expect(() =>
      solvePlateOnThreeSupports(
        [
          { x: 0, z: 0 },
          { x: 2, z: 1 },
          { x: 4, z: 2 },
        ],
        [K],
      ),
    ).toThrow(/една права/);
  });
});

describe("плоча на шест пръта (пример 2, „Подробно“)", () => {
  // Плоча 4 × 3 m в равнината y = 0: A(0;0;0), B(4;0;0), C(4;0;3), D(0;0;3).
  // Основи на 3 m под нея: A′(0;−3;0), B′, C′, D′(0;−3;3).
  // Пръти: 1 = AA′, 2 = BB′, 3 = CC′ (вертикални); 4 = BA′, 6 = CD′ (3-4-5:
  // посока (−0,8; −0,6; 0)); 5 = DA′ (45°: (0; −0,7071; −0,7071)).
  // Товари: F1 = 40 kN надолу в K(3; 0; 1,5); F2 = 12 kN по +x в D; F3 = 6 kN по +z в B.
  // Приема се опън (S > 0): прътът дърпа плочата към основата си.
  const A = v(0, 0, 0);
  const B = v(4, 0, 0);
  const C = v(4, 0, 3);
  const D = v(0, 0, 3);
  const A1 = v(0, -3, 0);
  const B1 = v(4, -3, 0);
  const C1 = v(4, -3, 3);
  const D1 = v(0, -3, 3);
  const body: SpatialBody = {
    constraints: [
      link(A, rodDirection(A, A1)),
      link(B, rodDirection(B, B1)),
      link(C, rodDirection(C, C1)),
      link(B, rodDirection(B, A1)),
      link(D, rodDirection(D, A1)),
      link(C, rodDirection(C, D1)),
    ],
    loads: [
      force(v(3, 0, 1.5), v(0, -40, 0)),
      force(D, v(12, 0, 0)),
      force(B, v(0, 0, 6)),
    ],
  };
  const S = solveSpatialBody(body);

  it("S = [−16; −10; −29; 10; 8,49; 5] kN", () => {
    // ΣF_z: −0,7071·S5 + 6 = 0                         → S5 = 8,485
    // ΣM_y: −2,4·S6 + 3·12 − 4·6 = 0                   → S6 = 5
    // ΣF_x: −0,8·S4 − 0,8·5 + 12 = 0                   → S4 = 10
    // ΣM_x: 3·S3 + 3·3 + 3·6 + 1,5·40 = 0              → S3 = −29
    // ΣM_z: −4·S2 + 4·29 − 4·6 − 4·3 − 3·40 = 0        → S2 = −10
    // ΣF_y: −S1 + 10 + 29 − 6 − 3 − 6 − 40 = 0         → S1 = −16
    const expected = [-16, -10, -29, 10, 6 * Math.SQRT2, 5];
    S.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 10));
    expect(S[4]).toBeCloseTo(8.49, 2);
  });

  it("ръчните уравнения едно по едно, с числата от текста", () => {
    const c45 = 0.7071;
    const S5 = 6 / c45;
    expect(S5).toBeCloseTo(8.49, 2);
    const S6 = (3 * 12 - 4 * 6) / 2.4;
    expect(S6).toBeCloseTo(5, 12);
    const S4 = (12 - 0.8 * S6) / 0.8;
    expect(S4).toBeCloseTo(10, 12);
    const S3 = -(3 * 0.6 * S6 + 3 * 6 + 1.5 * 40) / 3;
    expect(S3).toBeCloseTo(-29, 12);
    const S2 = (-4 * S3 - 4 * 0.6 * S4 - 4 * 0.6 * S6 - 3 * 40) / 4;
    expect(S2).toBeCloseTo(-10, 12);
    const S1 = -S2 - S3 - 0.6 * S4 - 0.6 * S6 - 6 - 40;
    expect(S1).toBeCloseTo(-16, 12);
    // отпечатаното 8,49 дава обратно проекция 6,00 kN
    expect(8.49 * c45).toBeCloseTo(6.0, 2);
  });

  it("решението удовлетворява шестте уравнения спрямо две различни точки", () => {
    expectEquilibrium(body, S);
  });

  it("проверките от текста: ос DC и вертикална ос през C", () => {
    // ос DC (успоредна на x, z = 3): M = −(z − 3)·F_y за сили в равнината y = 0
    //   прът 1 (F_y = 16): 3·16 = 48; прът 2 (F_y = 10): 30; прът 4 (F_y = −6): −18;
    //   F1 (F_y = −40, z = 1,5): −60 → 48 + 30 − 18 − 60 = 0
    expect(3 * 16 + 3 * 10 + 3 * -6 + 1.5 * -40).toBe(0);
    // вертикална ос през C: M = (z − 3)·F_x − (x − 4)·F_z
    //   прът 4 в B (F_x = −8): (−3)·(−8) = 24; прът 5 в D (F_z = −6): −(−4)·(−6) = −24
    expect(-3 * -8 - -4 * -6).toBe(0);
    const r = spatialResiduals(body, S, C);
    expect(r.moment.x).toBeCloseTo(0, 9);
    expect(r.moment.y).toBeCloseTo(0, 9);
  });

  it("независимо решение: ръчно записана 6×6 матрица, правило на Крамер", () => {
    const c = Math.SQRT1_2;
    // редове: ΣF_x, ΣF_y, ΣF_z, ΣM_x, ΣM_y, ΣM_z; стълбове: S1 … S6
    const matrix = [
      [0, 0, 0, -0.8, 0, -0.8],
      [-1, -1, -1, -0.6, -c, -0.6],
      [0, 0, 0, 0, -c, 0],
      // M_x = −z·F_y: прът 3 и прът 6 в C (z = 3), прът 5 в D (z = 3)
      [0, 0, 3, 0, 3 * c, 3 * 0.6],
      // M_y = z·F_x − x·F_z: само прът 6: 3·(−0,8)
      [0, 0, 0, 0, 0, -2.4],
      // M_z = x·F_y: пръти 2, 3, 4, 6 при x = 4
      [0, -4, -4, -2.4, 0, -2.4],
    ];
    // дясна страна = −(товари): ΣF = (12; −40; 6); ΣM = (60; 36 − 24; −120)
    const rhs = [-12, 40, -6, -60, -12, 120];
    const expected = [-16, -10, -29, 10, 6 * Math.SQRT2, 5];
    cramer(matrix, rhs).forEach((value, i) => {
      expect(value).toBeCloseTo(expected[i]!, 9);
      expect(value).toBeCloseTo(S[i]!, 9);
    });
  });
});

describe("вал на лебедка с две опори („В реалния живот“ в двата режима)", () => {
  // Вал по оста x: A(0;0;0) – сферична става, B(1,2;0;0) – цилиндрична става
  // (B_y, B_z). Барабан r = 0,1 m при x = 0,4 m; въжето слиза от точка
  // (0,4; 0; 0,1) с товар F_1 = 1,2 kN надолу. Дръжка в E(1,6; 0,4; 0); силата F_2
  // е хоризонтална, приета по −z.
  //   ΣM_x: −0,1·(−1,2) + 0,4·(−F_2) = 0   → F_2 = 0,12/0,4 = 0,3
  //   ΣF_x: A_x = 0
  //   ΣM_z: 1,2·B_y − 0,4·1,2 = 0        → B_y = 0,4;  A_y = 1,2 − 0,4 = 0,8
  //   ΣM_y: −1,2·B_z + 1,6·0,3 = 0       → B_z = 0,4;  A_z = 0,3 − 0,4 = −0,1
  const E = v(1.6, 0.4, 0);
  const body: SpatialBody = {
    constraints: [
      ...sphericalJoint(v(0, 0, 0)),
      link(v(1.2, 0, 0), Y),
      link(v(1.2, 0, 0), Z),
      link(E, v(0, 0, -1)),
    ],
    loads: [force(v(0.4, 0, 0.1), v(0, -1.2, 0))],
  };
  const r = solveSpatialBody(body);

  it("A = (0; 0,8; −0,1), B = (0,4; 0,4), F_2 = 0,3 kN", () => {
    const expected = [0, 0.8, -0.1, 0.4, 0.4, 0.3];
    r.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 10));
  });

  it("шестте уравнения са изпълнени спрямо две точки", () => {
    expectEquilibrium(body, r);
  });

  it("проверките от текста: моменти спрямо осите през B", () => {
    // ос през B, успоредна на z: −1,2·0,8 + (0,4 − 1,2)·(−1,2) = −0,96 + 0,96
    expect(-1.2 * 0.8 + (0.4 - 1.2) * -1.2).toBeCloseTo(0, 12);
    // ос през B, успоредна на y: −(0 − 1,2)·(−0,1) − (1,6 − 1,2)·(−0,3) = −0,12 + 0,12
    expect(-(0 - 1.2) * -0.1 - (1.6 - 1.2) * -0.3).toBeCloseTo(0, 12);
    // моментите на двете сили спрямо оста на вала: 1,2·0,1 = 0,3·0,4 = 0,12 kN·m
    expect(1.2 * 0.1).toBeCloseTo(0.12, 12);
    expect(0.3 * 0.4).toBeCloseTo(0.12, 12);
  });

  it("„Леко“, въпрос 4: r = 0,15 m, товар 2 kN, рамо на дръжката 0,5 m → F = 0,6 kN", () => {
    // 2·0,15 = 0,3 kN·m; F = 0,3/0,5 = 0,6
    const quiz: SpatialBody = {
      constraints: [
        ...sphericalJoint(v(0, 0, 0)),
        link(v(1.2, 0, 0), Y),
        link(v(1.2, 0, 0), Z),
        link(v(1.6, 0.5, 0), v(0, 0, -1)),
      ],
      loads: [force(v(0.4, 0, 0.15), v(0, -2, 0))],
    };
    expect(solveSpatialBody(quiz)[5]).toBeCloseTo(0.6, 10);
  });
});

describe("запънат стълб с табела – пространствено запъване (пример 3, „Подробно“)", () => {
  // Стълб по оста y, запънат в A(0;0;0). Табела с център K(2; 5; 0):
  // тегло F_1 = 2 kN надолу, вятър F_2 = 3 kN по −z.
  //   A_x = 0; A_y = 2; A_z = 3
  //   товари: M_x = y·F_z − z·F_y = 5·(−3) = −15 → M_Ax = 15
  //           M_y = z·F_x − x·F_z = −2·(−3) = 6  → M_Ay = −6
  //           M_z = x·F_y − y·F_x = 2·(−2) = −4  → M_Az = 4
  const body: SpatialBody = {
    constraints: spatialFixedSupport(v(0, 0, 0)),
    loads: [force(v(2, 5, 0), v(0, -2, -3))],
  };
  const r = solveSpatialBody(body);

  it("A = (0; 2; 3) kN, M_A = (15; −6; 4) kN·m", () => {
    const expected = [0, 2, 3, 15, -6, 4];
    r.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 10));
  });

  it("шестте уравнения са изпълнени спрямо две точки", () => {
    expectEquilibrium(body, r);
  });

  it("числата от текста: 3·5 = 15, 3·2 = 6, 2·2 = 4", () => {
    expect(Math.abs(r[3]!)).toBeCloseTo(3 * 5, 10);
    expect(Math.abs(r[4]!)).toBeCloseTo(3 * 2, 10);
    expect(Math.abs(r[5]!)).toBeCloseTo(2 * 2, 10);
  });

  it("общият огъващ момент в основата: √(15² + 4²) = √241 = 15,52 kN·m", () => {
    expect(Math.hypot(r[3]!, r[5]!)).toBeCloseTo(15.52, 2);
  });

  it("проверката от текста: ос през върха, успоредна на x → 15 − 3·5 = 0", () => {
    expect(spatialResiduals(body, r, v(0, 5, 0)).moment.x).toBeCloseTo(0, 10);
    expect(15 - 3 * 5).toBe(0);
  });

  it("„Подробно“, въпрос 4: вятър 2 kN по −z в (1,5; 4; 0) → M_Ax = 8, M_Ay = −3, M_Az = 0", () => {
    // товар: M_x = y·F_z = 4·(−2) = −8 → M_Ax = 8; M_y = −x·F_z = 3 → M_Ay = −3
    const quiz = solveSpatialBody({
      constraints: spatialFixedSupport(v(0, 0, 0)),
      loads: [force(v(1.5, 4, 0), v(0, 0, -2))],
    });
    expect(quiz[3]).toBeCloseTo(8, 10);
    expect(quiz[4]).toBeCloseTo(-3, 10);
    expect(quiz[5]).toBeCloseTo(0, 10);
  });
});

describe("статическа определимост и изменяеми случаи", () => {
  it("n = C − 6", () => {
    // сферична (3) + цилиндрична (2) + прът (1) = 6 → n = 0
    expect(spatialDeterminacy(3 + 2 + 1)).toBe(0);
    // плоча на четири вертикални пръта и три хоризонтални: 7 → n = 1
    expect(spatialDeterminacy(7)).toBe(1);
    // три вертикални пръта: n = −3
    expect(spatialDeterminacy(3)).toBe(-3);
    expect(() => spatialDeterminacy(2.5)).toThrow();
    expect(() => spatialDeterminacy(-1)).toThrow();
  });

  it("връзките не са шест → грешка", () => {
    expect(() =>
      solveSpatialBody({ constraints: sphericalJoint(v(0, 0, 0)), loads: [] }),
    ).toThrow(/шест/);
  });

  it("шест успоредни пръта → изменяемо тяло", () => {
    const points = [
      v(0, 0, 0),
      v(4, 0, 0),
      v(4, 0, 3),
      v(0, 0, 3),
      v(2, 0, 0),
      v(2, 0, 3),
    ];
    expect(() =>
      solveSpatialBody({
        constraints: points.map((p) => link(p, Y)),
        loads: [force(v(1, 0, 1), v(0, -10, 0))],
      }),
    ).toThrow(/изменяемо/);
  });

  it("„Подробно“, въпрос 2: две сферични стави (C = 6) → тялото се върти около правата през тях", () => {
    expect(() =>
      solveSpatialBody({
        constraints: [
          ...sphericalJoint(v(0, 0, 0)),
          ...sphericalJoint(v(3, 0, 0)),
        ],
        loads: [force(v(1, 0, 1), v(0, -10, 0))],
      }),
    ).toThrow(/изменяемо/);
  });

  it("шест пръта, които всички пресичат една права → изменяемо тяло", () => {
    // всички връзки минават през оста x или са успоредни на нея
    expect(() =>
      solveSpatialBody({
        constraints: [
          link(v(0, 0, 0), Y),
          link(v(0, 0, 0), Z),
          link(v(2, 0, 0), Y),
          link(v(2, 0, 0), Z),
          link(v(4, 0, 0), X),
          link(v(4, 0, 0), Y),
        ],
        loads: [],
      }),
    ).toThrow(/изменяемо/);
  });

  it("невалиден брой реакции при проверката", () => {
    expect(() =>
      spatialResiduals(
        { constraints: sphericalJoint(v(0, 0, 0)), loads: [] },
        [1, 2],
      ),
    ).toThrow();
  });
});
