import { describe, expect, it } from "vitest";
import {
  classifyReduction,
  directrix,
  distributedResultant,
  momentAboutPoint,
  moveReductionCenter,
  parallelResultant,
  reducePlaneSystem,
  triangularLoadResultant,
  uniformLoadResultant,
  type PlaneForce,
  type Point,
} from "@/lib/engineering/reduction";

// Всички очаквани стойности са сметнати на ръка и са записани в коментара над теста.
// Знаци: x надясно, y нагоре, момент > 0 обратно на часовниковата стрелка.

const O: Point = { x: 0, y: 0 };

/** Заменя линеен товар (надолу) с n малки сили в средите на равни парчета. */
function subdivide(
  load: { x1: number; x2: number; q1: number; q2: number },
  n: number,
): PlaneForce[] {
  const dx = (load.x2 - load.x1) / n;
  return Array.from({ length: n }, (_, i) => {
    const x = load.x1 + (i + 0.5) * dx;
    const q =
      load.q1 + ((load.q2 - load.q1) * (x - load.x1)) / (load.x2 - load.x1);
    return { x, y: 0, Fx: 0, Fy: -q * dx };
  });
}

describe("момент на сила спрямо точка", () => {
  it("M_O = x·F_y − y·F_x: сила нагоре вдясно от точката върти обратно на часовниковата", () => {
    // сила 10 kN нагоре в (2; 0): M_O = 2·10 − 0·0 = +20
    expect(momentAboutPoint({ x: 2, y: 0, Fx: 0, Fy: 10 })).toBeCloseTo(20, 12);
    // сила 10 kN надясно в (0; 2): M_O = 0·0 − 2·10 = −20 (по часовниковата)
    expect(momentAboutPoint({ x: 0, y: 2, Fx: 10, Fy: 0 })).toBeCloseTo(
      -20,
      12,
    );
  });

  it("сила, чиято директриса минава през точката, няма момент", () => {
    // сила (3; 4) в (6; 8): 6·4 − 8·3 = 0
    expect(momentAboutPoint({ x: 6, y: 8, Fx: 3, Fy: 4 })).toBeCloseTo(0, 12);
  });

  it("отказва безкрайни и нечислови стойности", () => {
    expect(() => momentAboutPoint({ x: NaN, y: 0, Fx: 1, Fy: 1 })).toThrow();
    expect(() =>
      reducePlaneSystem([{ x: 0, y: 0, Fx: Infinity, Fy: 0 }]),
    ).toThrow();
    expect(() => reducePlaneSystem([], [NaN])).toThrow();
  });
});

describe("загадката и пример Л1 („Леко“) – две успоредни сили", () => {
  it("кофи 20 и 30 kg в краищата на дъска 2 m: хваща се на 1,2 m от по-леката", () => {
    // x = (20·0 + 30·2) / 50 = 60/50 = 1,2 m; от по-тежката: 2 − 1,2 = 0,8 m
    // проверка: 20·1,2 = 24 = 30·0,8
    const r = parallelResultant([
      { x: 0, F: -20 },
      { x: 2, F: -30 },
    ]);
    expect(r.value).toBeCloseTo(-50, 12);
    expect(r.x).toBeCloseTo(1.2, 12);
    expect(20 * 1.2).toBeCloseTo(30 * 0.8, 12);
  });

  const forces: PlaneForce[] = [
    { x: 1, y: 0, Fx: 0, Fy: -20 },
    { x: 5, y: 0, Fx: 0, Fy: -30 },
  ];

  it("Л1: 20 kN при x = 1 m и 30 kN при x = 5 m → 50 kN надолу при x = 3,4 m", () => {
    // R = 20 + 30 = 50; x_R = (20·1 + 30·5)/50 = 170/50 = 3,4
    const r = parallelResultant([
      { x: 1, F: -20 },
      { x: 5, F: -30 },
    ]);
    expect(r.value).toBeCloseTo(-50, 12);
    expect(r.x).toBeCloseTo(3.4, 12);
  });

  it("Л1 през общата редукция: M_O = −170 kN·m, d = 170/50 = 3,4 m", () => {
    // M_O = 1·(−20) + 5·(−30) = −170 (по часовниковата)
    const r = reducePlaneSystem(forces);
    expect(r.Rx).toBeCloseTo(0, 12);
    expect(r.Ry).toBeCloseTo(-50, 12);
    expect(r.M).toBeCloseTo(-170, 12);
    const line = directrix(r);
    expect(line.distance).toBeCloseTo(3.4, 12);
    expect(line.xIntercept).toBeCloseTo(3.4, 12);
    // вертикална директриса: няма отрез от оста y и няма ъглов коефициент
    expect(line.yIntercept).toBeNull();
    expect(line.slope).toBeNull();
  });

  it("проверката в Л1: спрямо x = 3,4 m двете сили имат равни моменти 48 kN·m", () => {
    // 20·(3,4 − 1) = 20·2,4 = 48;  30·(5 − 3,4) = 30·1,6 = 48
    const P = { x: 3.4, y: 0 };
    expect(momentAboutPoint(forces[0]!, P)).toBeCloseTo(48, 12);
    expect(momentAboutPoint(forces[1]!, P)).toBeCloseTo(-48, 12);
    expect(reducePlaneSystem(forces, [], P).M).toBeCloseTo(0, 12);
  });
});

describe("пример П1 („Подробно“) – обща система и директриса", () => {
  const forces: PlaneForce[] = [
    { x: 0, y: 3, Fx: 20, Fy: 0 }, // F1 = 20 kN
    { x: 4, y: 0, Fx: 0, Fy: -30 }, // F2 = 30 kN
    { x: 2, y: 1, Fx: 30, Fy: 40 }, // F3 = 50 kN (3-4-5)
  ];
  const couples = [-25]; // 25 kN·m по часовниковата
  const r = reducePlaneSystem(forces, couples, O);

  it("F3 = √(30² + 40²) = 50 kN", () => {
    expect(Math.hypot(30, 40)).toBeCloseTo(50, 12);
  });

  it("главен вектор: R_x = 50, R_y = 10, R = √2600 = 50,99 kN, α = 11,31°", () => {
    // R_x = 20 + 0 + 30 = 50; R_y = 0 − 30 + 40 = 10
    // R = √(2500 + 100) = 50,990; α = arctg(10/50) = 11,31°
    expect(r.Rx).toBeCloseTo(50, 12);
    expect(r.Ry).toBeCloseTo(10, 12);
    expect(r.R).toBeCloseTo(50.99, 2);
    expect(r.angleDeg).toBeCloseTo(11.31, 2);
  });

  it("моменти на отделните сили спрямо O: −60, −120, +50 kN·m", () => {
    // F1: 0·0 − 3·20 = −60; F2: 4·(−30) − 0·0 = −120; F3: 2·40 − 1·30 = 50
    expect(momentAboutPoint(forces[0]!)).toBeCloseTo(-60, 12);
    expect(momentAboutPoint(forces[1]!)).toBeCloseTo(-120, 12);
    expect(momentAboutPoint(forces[2]!)).toBeCloseTo(50, 12);
  });

  it("главен момент: M_O = −60 − 120 + 50 − 25 = −155 kN·m", () => {
    expect(r.M).toBeCloseTo(-155, 12);
    expect(classifyReduction(r)).toBe("resultant");
  });

  it("директриса: 10x − 50y = −155, т.е. y = 0,2x + 3,1; отрези −15,5 и 3,1 m; d = 3,04 m", () => {
    // x0 = M_O/R_y = −155/10 = −15,5; y0 = −M_O/R_x = 155/50 = 3,1
    // k = R_y/R_x = 10/50 = 0,2; d = 155/50,99 = 3,040
    const line = directrix(r);
    expect(line.a).toBeCloseTo(10, 12);
    expect(line.b).toBeCloseTo(-50, 12);
    expect(line.c).toBeCloseTo(-155, 12);
    expect(line.xIntercept).toBeCloseTo(-15.5, 12);
    expect(line.yIntercept).toBeCloseTo(3.1, 12);
    expect(line.slope).toBeCloseTo(0.2, 12);
    // при x = 0 директрисата е на 3,1 − 3 = 0,1 m над ъгъла (0; 3) на плочата
    expect(line.yIntercept! - 3).toBeCloseTo(0.1, 12);
    expect(line.distance).toBeCloseTo(3.04, 3);
    // с печатаната закръглена стойност на R: 155/50,99 = 3,0398 → 3,04
    expect(155 / 50.99).toBeCloseTo(3.04, 2);
  });

  it("смяна на центъра в B(4; 0): M_B = −155 − 4·10 + 0·50 = −195 kN·m", () => {
    const B = { x: 4, y: 0 };
    const moved = moveReductionCenter(r, B);
    expect(moved.M).toBeCloseTo(-195, 12);
    expect(moved.Rx).toBeCloseTo(50, 12);
    expect(moved.Ry).toBeCloseTo(10, 12);
    // директно: F1: (0−4)·0 − (3−0)·20 = −60; F2: 0;
    // F3: (2−4)·40 − (1−0)·30 = −110; двоица −25 → −195
    expect(momentAboutPoint(forces[0]!, B)).toBeCloseTo(-60, 12);
    expect(momentAboutPoint(forces[1]!, B)).toBeCloseTo(0, 12);
    expect(momentAboutPoint(forces[2]!, B)).toBeCloseTo(-110, 12);
    expect(reducePlaneSystem(forces, couples, B).M).toBeCloseTo(-195, 12);
  });

  it("в точките (0; 3,1) и (−15,5; 0) от директрисата главният момент е нула", () => {
    // (0; 3,1): −155 − 0·10 + 3,1·50 = 0;  (−15,5; 0): −155 + 15,5·10 = 0
    expect(moveReductionCenter(r, { x: 0, y: 3.1 }).M).toBeCloseTo(0, 10);
    expect(moveReductionCenter(r, { x: -15.5, y: 0 }).M).toBeCloseTo(0, 10);
    expect(reducePlaneSystem(forces, couples, { x: 0, y: 3.1 }).M).toBeCloseTo(
      0,
      10,
    );
  });

  it("независима проверка: моментът е нула във всяка точка от директрисата", () => {
    const line = directrix(r);
    for (const x of [-20, -3.7, 0, 1, 4, 12.5]) {
      const point = { x, y: line.slope! * x + line.yIntercept! };
      expect(reducePlaneSystem(forces, couples, point).M).toBeCloseTo(0, 9);
    }
    // най-близката точка лежи на директрисата и е на разстояние d от O
    expect(reducePlaneSystem(forces, couples, line.foot).M).toBeCloseTo(0, 9);
    expect(Math.hypot(line.foot.x, line.foot.y)).toBeCloseTo(line.distance, 12);
  });

  it("директрисата е една и съща, от който и център да се тръгне", () => {
    for (const center of [
      { x: 4, y: 0 },
      { x: -2, y: 7 },
      { x: 3.3, y: -1.9 },
    ]) {
      const line = directrix(reducePlaneSystem(forces, couples, center));
      expect(line.c).toBeCloseTo(-155, 9);
      expect(line.xIntercept).toBeCloseTo(-15.5, 9);
      expect(line.yIntercept).toBeCloseTo(3.1, 9);
    }
  });

  it("преместване A → B → A връща началния момент; пряката редукция съвпада с преместената", () => {
    const B = { x: -2, y: 7 };
    const there = moveReductionCenter(r, B);
    expect(there.M).toBeCloseTo(reducePlaneSystem(forces, couples, B).M, 9);
    expect(moveReductionCenter(there, O).M).toBeCloseTo(-155, 9);
  });
});

describe("пример П2 („Подробно“) – система, която се свежда до двоица", () => {
  // плоча O(0;0), A(4;0), B(4;3), C(0;3)
  // 15 kN от B към O: −15·4/5 = −12 и −15·3/5 = −9
  const forces: PlaneForce[] = [
    { x: 0, y: 0, Fx: 12, Fy: 0 },
    { x: 4, y: 0, Fx: 0, Fy: 9 },
    { x: 4, y: 3, Fx: -12, Fy: -9 },
  ];

  it("диагоналът е 5 m, проекциите на силата 15 kN са −12 и −9 kN", () => {
    expect(Math.hypot(4, 3)).toBeCloseTo(5, 12);
    expect((-15 * 4) / 5).toBeCloseTo(-12, 12);
    expect((-15 * 3) / 5).toBeCloseTo(-9, 12);
  });

  it("R_x = 12 + 0 − 12 = 0; R_y = 0 + 9 − 9 = 0; M_O = 4·9 = 36 kN·m", () => {
    const r = reducePlaneSystem(forces);
    expect(r.Rx).toBeCloseTo(0, 12);
    expect(r.Ry).toBeCloseTo(0, 12);
    expect(r.R).toBeCloseTo(0, 12);
    expect(r.angleDeg).toBeNull();
    expect(r.M).toBeCloseTo(36, 12);
    expect(classifyReduction(r)).toBe("couple");
    expect(() => directrix(r)).toThrow();
  });

  it("моментът е 36 kN·m спрямо O, A, B и C – не зависи от центъра", () => {
    // спрямо B(4;3): сила 1: (0−4)·0 − (0−3)·12 = 36; сили 2 и 3 минават през B
    // спрямо C(0;3): 36 + (4·9) + [4·(−9) − 0] = 36 + 36 − 36 = 36
    for (const center of [
      O,
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
      { x: -11, y: 6.5 },
    ]) {
      expect(reducePlaneSystem(forces, [], center).M).toBeCloseTo(36, 10);
    }
    expect(momentAboutPoint(forces[0]!, { x: 4, y: 3 })).toBeCloseTo(36, 12);
  });

  it("рамо на двоицата: 12 kN по OA и 12 kN обратно на 3 m → 36; еквивалентно 9 kN на 4 m", () => {
    expect(12 * 3).toBe(36);
    expect(9 * 4).toBe(36);
  });
});

describe("случаи на редукция", () => {
  it("равновесие, двоица, равнодействаща", () => {
    expect(classifyReduction({ R: 0, M: 0 })).toBe("equilibrium");
    expect(classifyReduction({ R: 0, M: 15 })).toBe("couple");
    expect(classifyReduction({ R: 20, M: 0 })).toBe("resultant");
    expect(classifyReduction({ R: 20, M: -7 })).toBe("resultant");
  });

  it("стойности под допуска се приемат за нула", () => {
    expect(classifyReduction({ R: 1e-12, M: 1e-12 })).toBe("equilibrium");
    expect(classifyReduction({ R: 0.01, M: 0 }, 0.1)).toBe("equilibrium");
    expect(() => classifyReduction({ R: 0, M: 0 }, -1)).toThrow();
  });

  it("празна система е в равновесие", () => {
    expect(classifyReduction(reducePlaneSystem([]))).toBe("equilibrium");
  });

  it("равнодействаща през центъра: d = 0", () => {
    // сила (3; 4) в началото: M_O = 0, директрисата минава през O
    const line = directrix(reducePlaneSystem([{ x: 0, y: 0, Fx: 3, Fy: 4 }]));
    expect(line.distance).toBe(0);
    expect(line.xIntercept).toBeCloseTo(0, 12);
    expect(line.yIntercept).toBeCloseTo(0, 12);
  });

  it("хоризонтална директриса няма отрез от оста x", () => {
    // сила 10 kN надясно в (0; 2): M_O = −20; y0 = 20/10 = 2
    const line = directrix(reducePlaneSystem([{ x: 0, y: 2, Fx: 10, Fy: 0 }]));
    expect(line.xIntercept).toBeNull();
    expect(line.yIntercept).toBeCloseTo(2, 12);
    expect(line.slope).toBeCloseTo(0, 12);
  });
});

describe("пример П3 = Л2 – греда с разпределени товари", () => {
  it("равномерен 8 kN/m от 0 до 3 m: 8·3 = 24 kN при 1,5 m", () => {
    const r = uniformLoadResultant(8, 0, 3);
    expect(r.value).toBeCloseTo(24, 12);
    expect(r.x).toBeCloseTo(1.5, 12);
    expect(distributedResultant({ x1: 0, x2: 3, q1: 8, q2: 8 })).toEqual(r);
  });

  it("триъгълен 0 → 12 kN/m от 3 до 6 m: 12·3/2 = 18 kN при 6 − 3/3 = 5,0 m", () => {
    const r = triangularLoadResultant(12, 3, 6, "end");
    expect(r.value).toBeCloseTo(18, 12);
    expect(r.x).toBeCloseTo(5, 12);
    const general = distributedResultant({ x1: 3, x2: 6, q1: 0, q2: 12 });
    expect(general.value).toBeCloseTo(18, 12);
    expect(general.x).toBeCloseTo(5, 12);
  });

  it("триъгълен с връх в началото: на l/3 от по-големия край", () => {
    // 12 → 0 от 3 до 6 m: 18 kN при 3 + 1 = 4 m
    const r = triangularLoadResultant(12, 3, 6, "start");
    expect(r.value).toBeCloseTo(18, 12);
    expect(r.x).toBeCloseTo(4, 12);
    expect(distributedResultant({ x1: 3, x2: 6, q1: 12, q2: 0 }).x).toBeCloseTo(
      4,
      12,
    );
  });

  // трите заместващи сили (надолу)
  const replaced: PlaneForce[] = [
    { x: 1.5, y: 0, Fx: 0, Fy: -24 },
    { x: 5, y: 0, Fx: 0, Fy: -18 },
    { x: 2, y: 0, Fx: 0, Fy: -10 },
  ];

  it("моменти спрямо x = 0: 24·1,5 = 36; 18·5 = 90; 10·2 = 20; общо 146 kN·m", () => {
    expect(24 * 1.5).toBeCloseTo(36, 12);
    expect(18 * 5).toBeCloseTo(90, 12);
    expect(10 * 2).toBeCloseTo(20, 12);
    const r = reducePlaneSystem(replaced);
    // R = 24 + 18 + 10 = 52 kN надолу; M_O = −146 kN·m (по часовниковата)
    expect(r.Ry).toBeCloseTo(-52, 12);
    expect(r.R).toBeCloseTo(52, 12);
    expect(r.M).toBeCloseTo(-146, 12);
  });

  it("равнодействащата е 52 kN при x_R = 146/52 = 2,81 m", () => {
    // 146/52 = 2,8077
    const line = directrix(reducePlaneSystem(replaced));
    expect(line.xIntercept).toBeCloseTo(2.81, 2);
    expect(line.xIntercept).toBeCloseTo(146 / 52, 12);
    const parallel = parallelResultant(
      replaced.map((force) => ({ x: force.x, F: force.Fy })),
    );
    expect(parallel.value).toBeCloseTo(-52, 12);
    expect(parallel.x).toBeCloseTo(2.8077, 4);
  });

  it("независима проверка: ситно разделяне на товарите дава същите R и M_O", () => {
    const fine: PlaneForce[] = [
      ...subdivide({ x1: 0, x2: 3, q1: 8, q2: 8 }, 3000),
      ...subdivide({ x1: 3, x2: 6, q1: 0, q2: 12 }, 3000),
      { x: 2, y: 0, Fx: 0, Fy: -10 },
    ];
    const exact = reducePlaneSystem(replaced);
    const numeric = reducePlaneSystem(fine);
    expect(numeric.Ry).toBeCloseTo(exact.Ry, 6);
    expect(numeric.M).toBeCloseTo(exact.M, 5);
    // и спрямо друг център – десния край на гредата
    const end = { x: 6, y: 0 };
    expect(reducePlaneSystem(fine, [], end).M).toBeCloseTo(
      reducePlaneSystem(replaced, [], end).M,
      5,
    );
    // спрямо десния край: 24·4,5 + 18·1 + 10·4 = 108 + 18 + 40 = 166 kN·m
    expect(reducePlaneSystem(replaced, [], end).M).toBeCloseTo(166, 12);
    // и по формулата за смяна на центъра: −146 − 6·(−52) = 166
    expect(moveReductionCenter(exact, end).M).toBeCloseTo(166, 12);
  });
});

describe("разпределен товар – общи проверки", () => {
  it("трапец 4 → 10 kN/m върху 6 m: 24 + 18 = 42 kN при (24·3 + 18·4)/42 = 3,43 m", () => {
    // правоъгълник 4·6 = 24 при 3 m; триъгълник 6·6/2 = 18 при 4 m
    const r = distributedResultant({ x1: 0, x2: 6, q1: 4, q2: 10 });
    expect(r.value).toBeCloseTo(42, 12);
    expect(r.x).toBeCloseTo(144 / 42, 12);
    expect(r.x).toBeCloseTo(3.43, 2);
  });

  it("равномерен 5 kN/m върху 6 m → 30 kN в средата (въпрос в „Леко“)", () => {
    expect(uniformLoadResultant(5, 0, 6)).toEqual({ value: 30, x: 3 });
  });

  it("триъгълен с връх 12 kN/m върху 3 m → 18 kN на 1 m от по-високия край (въпрос в „Леко“)", () => {
    const r = triangularLoadResultant(12, 0, 3, "end");
    expect(r.value).toBeCloseTo(18, 12);
    expect(3 - r.x).toBeCloseTo(1, 12);
  });

  it("всеки линеен товар съвпада със ситното си разделяне (R и момент спрямо две точки)", () => {
    for (const load of [
      { x1: 0, x2: 6, q1: 4, q2: 10 },
      { x1: 1, x2: 4.5, q1: 7, q2: 0 },
      { x1: -2, x2: 3, q1: 0, q2: 9 },
      { x1: 2, x2: 5, q1: 6, q2: 6 },
    ]) {
      const one = distributedResultant(load);
      const single: PlaneForce[] = [{ x: one.x, y: 0, Fx: 0, Fy: -one.value }];
      const fine = subdivide(load, 4000);
      for (const center of [O, { x: 3.7, y: 1.2 }]) {
        const a = reducePlaneSystem(single, [], center);
        const b = reducePlaneSystem(fine, [], center);
        expect(b.Ry).toBeCloseTo(a.Ry, 6);
        expect(b.M).toBeCloseTo(a.M, 5);
      }
    }
  });

  it("отказва невалидни данни", () => {
    expect(() => uniformLoadResultant(5, 3, 3)).toThrow();
    expect(() => uniformLoadResultant(5, 4, 1)).toThrow();
    expect(() => triangularLoadResultant(NaN, 0, 3)).toThrow();
    expect(() =>
      distributedResultant({ x1: 0, x2: 3, q1: -2, q2: 5 }),
    ).toThrow();
    expect(() =>
      distributedResultant({ x1: 0, x2: 3, q1: 0, q2: 0 }),
    ).toThrow();
    expect(() =>
      parallelResultant([
        { x: 0, F: 10 },
        { x: 2, F: -10 },
      ]),
    ).toThrow();
  });
});

describe("подпорна стена („В реалния живот“)", () => {
  // O е предният ръб на основата; G = 120 kN надолу на 1,2 m от O;
  // E = 40 kN хоризонтално към предния ръб (наляво), на височина 1,2 m
  const forces: PlaneForce[] = [
    { x: 1.2, y: 0, Fx: 0, Fy: -120 },
    { x: 2, y: 1.2, Fx: -40, Fy: 0 },
  ];
  const r = reducePlaneSystem(forces);

  it("R_x = −40, R_y = −120, R = √16000 = 126,49 kN", () => {
    expect(r.Rx).toBeCloseTo(-40, 12);
    expect(r.Ry).toBeCloseTo(-120, 12);
    expect(r.R).toBeCloseTo(126.49, 2);
  });

  it("M_O = 1,2·(−120) − 1,2·(−40) = −144 + 48 = −96 kN·m", () => {
    // G върти по часовниковата (−144), E – обратно (+48)
    expect(momentAboutPoint(forces[0]!)).toBeCloseTo(-144, 12);
    expect(momentAboutPoint(forces[1]!)).toBeCloseTo(48, 12);
    expect(r.M).toBeCloseTo(-96, 12);
  });

  it("равнодействащата пресича основата на x0 = −96/(−120) = 0,8 m от предния ръб", () => {
    const line = directrix(r);
    expect(line.xIntercept).toBeCloseTo(0.8, 12);
    // директрисата минава и през пресечната точка на G и E: (1,2; 1,2)
    expect(reducePlaneSystem(forces, [], { x: 1.2, y: 1.2 }).M).toBeCloseTo(
      0,
      12,
    );
    // и през (0,8; 0)
    expect(moveReductionCenter(r, { x: 0.8, y: 0 }).M).toBeCloseTo(0, 12);
  });

  it("ексцентрицитет 1,0 − 0,8 = 0,2 m; средна третина от 0,667 до 1,333 m; b/6 = 0,333 m", () => {
    const b = 2;
    const x0 = directrix(r).xIntercept!;
    const e = b / 2 - x0;
    expect(e).toBeCloseTo(0.2, 12);
    expect(b / 3).toBeCloseTo(0.667, 3);
    expect((2 * b) / 3).toBeCloseTo(1.333, 3);
    expect(b / 6).toBeCloseTo(0.333, 3);
    expect(x0).toBeGreaterThan(b / 3);
    expect(x0).toBeLessThan((2 * b) / 3);
  });
});

describe("въпросите от „Провери се“", () => {
  it("„Леко“ 1: 10 и 30 kN на 4 m една от друга → 40 kN на 3 m от по-малката", () => {
    // x = 30·4/40 = 3
    const r = parallelResultant([
      { x: 0, F: -10 },
      { x: 4, F: -30 },
    ]);
    expect(r.value).toBeCloseTo(-40, 12);
    expect(r.x).toBeCloseTo(3, 12);
  });

  it("„Леко“ 4: R = 0, M = 15 kN·m → двоица, същият момент спрямо всяка точка", () => {
    const r = reducePlaneSystem([], [15]);
    expect(classifyReduction(r)).toBe("couple");
    expect(moveReductionCenter(r, { x: 8, y: -3 }).M).toBeCloseTo(15, 12);
  });

  const r: ReturnType<typeof reducePlaneSystem> = {
    center: O,
    Rx: 12,
    Ry: -16,
    R: 20,
    angleDeg: null,
    M: 40,
  };

  it("„Подробно“ 1: R = (12; −16), M_O = 40 → R = 20 kN, d = 2,0 m, отрези −2,5 и −3,33 m", () => {
    // R = √(144 + 256) = 20; d = 40/20 = 2; x0 = 40/(−16) = −2,5; y0 = −40/12 = −3,33
    expect(Math.hypot(12, -16)).toBeCloseTo(20, 12);
    const line = directrix(r);
    expect(line.distance).toBeCloseTo(2, 12);
    expect(line.xIntercept).toBeCloseTo(-2.5, 12);
    expect(line.yIntercept).toBeCloseTo(-3.33, 2);
  });

  it("„Подробно“ 2: за B(1; 2): M_B = 40 − 1·(−16) + 2·12 = 80 kN·m", () => {
    expect(moveReductionCenter(r, { x: 1, y: 2 }).M).toBeCloseTo(80, 12);
  });

  it("„Подробно“ 5: −20 при x = 1, −30 при x = 4, +50 при x = 3 → двоица +10 kN·m", () => {
    // R = −20 − 30 + 50 = 0; M_O = −20·1 − 30·4 + 50·3 = −20 − 120 + 150 = 10
    const system = reducePlaneSystem([
      { x: 1, y: 0, Fx: 0, Fy: -20 },
      { x: 4, y: 0, Fx: 0, Fy: -30 },
      { x: 3, y: 0, Fx: 0, Fy: 50 },
    ]);
    expect(system.R).toBeCloseTo(0, 12);
    expect(system.M).toBeCloseTo(10, 12);
    expect(classifyReduction(system)).toBe("couple");
  });
});
