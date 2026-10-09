import { describe, expect, it } from "vitest";
import {
  crankSlider,
  gearRatio,
  instantCentre,
  planeAcceleration,
  planeVelocity,
  projectionOnLine,
  radPerSecToRpm,
  rollingWheel,
  rotationPoint,
  rpmToRadPerSec,
  uniformlyAcceleratedRotation,
  type Vec2,
} from "@/lib/engineering/kinematics-body";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Единици: m, s, rad. Знаци: x надясно, y нагоре; φ, ω и ε са положителни
// обратно на часовниковата стрелка. Колело, което се търкаля надясно, има ω < 0.

const O: Vec2 = { x: 0, y: 0 };
const vec = (x: number, y: number): Vec2 => ({ x, y });
const length = (a: Vec2): number => Math.hypot(a.x, a.y);
const between = (a: Vec2, b: Vec2): number => Math.hypot(b.x - a.x, b.y - a.y);

function expectVec(actual: Vec2, expected: Vec2, digits = 10): void {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
}

/** Централна разлика за първа производна. */
function derivative(f: (t: number) => number, t: number, h = 1e-5): number {
  return (f(t + h) - f(t - h)) / (2 * h);
}

/** Централна разлика за втора производна. */
function secondDerivative(
  f: (t: number) => number,
  t: number,
  h = 1e-4,
): number {
  return (f(t + h) - 2 * f(t) + f(t - h)) / (h * h);
}

/** Колелото от пример Л2 / П4: R = 0,4 m, център C(0; 0,4), v_C = 6 m/s надясно. */
const R = 0.4;
const C = vec(0, R);
const TOP = vec(0, 2 * R);
const FRONT = vec(R, R);
const CONTACT = vec(0, 0);
const V_C = vec(6, 0);
const A_C = vec(2, 0);

describe("обороти в минута и ъглова скорост", () => {
  it("ω = π·n/30", () => {
    // П1: π·300/30 = 10π = 31,4159 rad/s
    expect(rpmToRadPerSec(300)).toBeCloseTo(31.4159, 4);
    // въпрос 1 от „Леко“: π·120/30 = 4π = 12,566 → 12,57 rad/s
    expect(rpmToRadPerSec(120)).toBeCloseTo(12.566, 3);
    // кулокранът: π·0,6/30 = 0,02π = 0,06283 → 0,0628 rad/s
    expect(rpmToRadPerSec(0.6)).toBeCloseTo(0.06283, 5);
    // един оборот в секунда = 60 min⁻¹ = 2π rad/s
    expect(rpmToRadPerSec(60)).toBeCloseTo(2 * Math.PI, 12);
  });

  it("обратното преобразуване връща същите обороти", () => {
    expect(radPerSecToRpm(rpmToRadPerSec(1450))).toBeCloseTo(1450, 9);
    // 2π rad/s = 60 min⁻¹
    expect(radPerSecToRpm(2 * Math.PI)).toBeCloseTo(60, 12);
  });
});

describe("точка от въртящо се тяло", () => {
  it("пример Л1: диск φ = 2t², r = 0,3 m, t = 2 s", () => {
    // ω = 4t = 8 rad/s; ε = 4 rad/s²; φ = 2·2² = 8 rad = 8/6,2832 = 1,27 оборота
    // v = 8·0,3 = 2,4 m/s; a_τ = 4·0,3 = 1,2 m/s²; a_n = 8²·0,3 = 19,2 m/s²
    // a = √(1,2² + 19,2²) = √370,08 = 19,2375 → 19,24 m/s²
    const point = rotationPoint({ r: 0.3, omega: 8, epsilon: 4 });
    expect(point.v).toBeCloseTo(2.4, 12);
    expect(point.aTau).toBeCloseTo(1.2, 12);
    expect(point.aN).toBeCloseTo(19.2, 12);
    expect(point.a).toBeCloseTo(19.2375, 4);
    // проверка от Глава 1: a_n = v²/r = 5,76/0,3 = 19,2
    expect(point.v ** 2 / 0.3).toBeCloseTo(19.2, 12);
    expect(8 / (2 * Math.PI)).toBeCloseTo(1.273, 3);
    // tg β = ε/ω² = 4/64 = 0,0625
    expect(Math.tan(point.beta)).toBeCloseTo(0.0625, 12);
  });

  it("законът φ = 2t² наистина дава ω = 8 и ε = 4 при t = 2 s (числена производна)", () => {
    const phi = (t: number) => 2 * t * t;
    expect(derivative(phi, 2)).toBeCloseTo(8, 7);
    expect(secondDerivative(phi, 2)).toBeCloseTo(4, 5);
  });

  it("v = ω·r, a_τ = ε·r, a_n = ω²·r за няколко точки на едно тяло; ъгълът β е общ", () => {
    const omega = -3;
    const epsilon = 5;
    const betas: number[] = [];
    for (const r of [0.1, 0.25, 0.7, 2]) {
      const point = rotationPoint({ r, omega, epsilon });
      expect(point.v).toBeCloseTo(omega * r, 12);
      expect(point.aTau).toBeCloseTo(epsilon * r, 12);
      expect(point.aN).toBeCloseTo(omega * omega * r, 12);
      // a = r·√(ε² + ω⁴) = r·√(25 + 81) = r·10,2956
      expect(point.a).toBeCloseTo(r * Math.sqrt(106), 12);
      betas.push(point.beta);
    }
    for (const beta of betas) expect(beta).toBeCloseTo(betas[0]!, 12);
  });

  it("формулите в проекции съвпадат с v = ω·r и с a_τ, a_n", () => {
    // точка (0,3; 0,4) m, r = 0,5 m; ω = 2 rad/s, ε = −3 rad/s²
    // v = (−ω·y; ω·x) = (−0,8; 0,6), големина 1,0 = 2·0,5
    // a = (−ε·y − ω²·x; ε·x − ω²·y) = (1,2 − 1,2; −0,9 − 1,6) = (0; −2,5)
    // сверка: a_τ = −1,5, a_n = 2,0, a = √(2,25 + 4) = 2,5
    const M = vec(0.3, 0.4);
    const v = planeVelocity(O, 2, O, M);
    const a = planeAcceleration(O, 2, -3, O, M);
    const scalar = rotationPoint({ r: 0.5, omega: 2, epsilon: -3 });
    expectVec(v, vec(-0.8, 0.6));
    expectVec(a, vec(0, -2.5));
    expect(length(v)).toBeCloseTo(Math.abs(scalar.v), 12);
    expect(length(a)).toBeCloseTo(scalar.a, 12);
    // скоростта е перпендикулярна на радиуса
    expect(v.x * M.x + v.y * M.y).toBeCloseTo(0, 12);
    // проекция на a върху радиуса (навън) = −a_n; върху допирателната = a_τ
    expect((a.x * M.x + a.y * M.y) / 0.5).toBeCloseTo(-scalar.aN, 12);
    expect((a.x * -M.y + a.y * M.x) / 0.5).toBeCloseTo(scalar.aTau, 12);
  });

  it("числено диференциране на положението на точка от въртящо се тяло дава същите v и a", () => {
    // φ(t) = 3t − t³ (въпрос 2 от „Подробно“), точка на r = 0,2 m, t = 2 s
    const r = 0.2;
    const phi = (t: number) => 3 * t - t ** 3;
    const x = (t: number) => r * Math.cos(phi(t));
    const y = (t: number) => r * Math.sin(phi(t));
    const M = vec(x(2), y(2));
    const v = planeVelocity(O, -9, O, M);
    const a = planeAcceleration(O, -9, -12, O, M);
    expect(derivative(x, 2)).toBeCloseTo(v.x, 6);
    expect(derivative(y, 2)).toBeCloseTo(v.y, 6);
    expect(secondDerivative(x, 2)).toBeCloseTo(a.x, 3);
    expect(secondDerivative(y, 2)).toBeCloseTo(a.y, 3);
  });

  it("въпрос 2 от „Леко“: r = 0,5 m, ω = 4 rad/s постоянна", () => {
    // v = 4·0,5 = 2 m/s; a_τ = 0; a = a_n = 4²·0,5 = 8 m/s²
    const point = rotationPoint({ r: 0.5, omega: 4, epsilon: 0 });
    expect(point.v).toBeCloseTo(2, 12);
    expect(point.aTau).toBe(0);
    expect(point.aN).toBeCloseTo(8, 12);
    expect(point.a).toBeCloseTo(8, 12);
  });

  it("въпрос 2 от „Подробно“: φ = 3t − t³, r = 0,2 m, t = 2 s", () => {
    // ω = 3 − 3t² = 3 − 12 = −9 rad/s; ε = −6t = −12 rad/s²
    // v = 9·0,2 = 1,8 m/s; a_τ = 12·0,2 = 2,4 m/s²; a_n = 81·0,2 = 16,2 m/s²
    // a = √(2,4² + 16,2²) = √268,2 = 16,377 → 16,38 m/s²
    const phi = (t: number) => 3 * t - t ** 3;
    expect(derivative(phi, 2)).toBeCloseTo(-9, 6);
    expect(secondDerivative(phi, 2)).toBeCloseTo(-12, 4);
    const point = rotationPoint({ r: 0.2, omega: -9, epsilon: -12 });
    expect(point.v).toBeCloseTo(-1.8, 12);
    expect(point.aTau).toBeCloseTo(-2.4, 12);
    expect(point.aN).toBeCloseTo(16.2, 12);
    expect(point.a).toBeCloseTo(16.38, 2);
  });

  it("кулокранът от „В реалния живот“: 0,6 min⁻¹, стрела 40 m", () => {
    // ω = 0,0628 rad/s; v = 0,0628·40 = 2,51 m/s; a_n = 0,0628²·40 = 0,158 m/s²
    const omega = rpmToRadPerSec(0.6);
    const tip = rotationPoint({ r: 40, omega, epsilon: 0 });
    expect(tip.v).toBeCloseTo(2.51, 2);
    expect(tip.aN).toBeCloseTo(0.158, 3);
    // със закръгленото 0,0628: 0,0628·40 = 2,512; 0,0628²·40 = 0,1578
    expect(0.0628 * 40).toBeCloseTo(2.51, 2);
    expect(0.0628 ** 2 * 40).toBeCloseTo(0.158, 3);
    // товар на 10 m: четири пъти по-бавно, 0,0628·10 = 0,63 m/s
    const load = rotationPoint({ r: 10, omega, epsilon: 0 });
    expect(load.v).toBeCloseTo(0.63, 2);
    expect(tip.v / load.v).toBeCloseTo(4, 12);
    expect(tip.aN / load.aN).toBeCloseTo(4, 12);
  });

  it("отрицателно разстояние е грешка", () => {
    expect(() => rotationPoint({ r: -1, omega: 1, epsilon: 0 })).toThrow();
    expect(() => rotationPoint({ r: NaN, omega: 1, epsilon: 0 })).toThrow();
  });
});

describe("равнопроменлива ротация", () => {
  it("пример П1: ротор 300 min⁻¹ спира за 20 s, r = 0,25 m", () => {
    // ω₀ = 31,416 rad/s; ε = −31,416/20 = −1,5708 → −1,571 rad/s²
    // φ = ω₀·t/2 = 31,416·20/2 = 314,16 rad; N = 314,16/6,2832 = 50 оборота
    const omega0 = rpmToRadPerSec(300);
    const epsilon = -omega0 / 20;
    expect(omega0).toBeCloseTo(31.416, 3);
    expect(epsilon).toBeCloseTo(-1.571, 3);
    const end = uniformlyAcceleratedRotation({ omega0, epsilon, t: 20 });
    expect(end.omega).toBeCloseTo(0, 12);
    expect(end.phi).toBeCloseTo(314.16, 2);
    expect(end.revolutions).toBeCloseTo(50, 10);
    // в началото: v = 31,416·0,25 = 7,854 m/s; a_n = 31,416²·0,25 = 246,7 m/s²
    // a_τ = −1,571·0,25 = −0,393 m/s²
    const start = rotationPoint({ r: 0.25, omega: omega0, epsilon });
    expect(start.v).toBeCloseTo(7.854, 3);
    expect(start.aN).toBeCloseTo(246.7, 1);
    expect(start.aTau).toBeCloseTo(-0.393, 3);
    // проверка: ω² = ω₀² + 2εφ = 986,96 − 2·1,5708·314,16 = 0
    expect(omega0 ** 2 + 2 * epsilon * end.phi).toBeCloseTo(0, 9);
    expect(omega0 ** 2).toBeCloseTo(986.96, 2);
    // проверка: средно 150 min⁻¹ за 1/3 min = 50 оборота
    expect(150 / 3).toBe(50);
  });

  it("закръглените междинни стойности от П1 дават отпечатаните резултати", () => {
    expect(31.416 / 20).toBeCloseTo(1.571, 3);
    expect((31.416 * 20) / 2).toBeCloseTo(314.16, 2);
    expect(314.16 / (2 * Math.PI)).toBeCloseTo(50.0, 2);
    expect(31.416 * 0.25).toBeCloseTo(7.854, 3);
    expect(31.416 ** 2 * 0.25).toBeCloseTo(246.7, 1);
    expect(1.571 * 0.25).toBeCloseTo(0.393, 3);
    expect(31.416 * 20 - 0.5 * 1.5708 * 20 ** 2).toBeCloseTo(314.16, 2);
    expect(1.5708 * 0.25).toBeCloseTo(0.393, 3);
    // проверката в текста: 31,416² − 2·1,5708·314,16 = 986,97 − 986,97 = 0
    expect(31.416 ** 2).toBeCloseTo(986.97, 2);
    expect(2 * 1.5708 * 314.16).toBeCloseTo(986.97, 2);
  });

  it("ω² = ω₀² + 2εφ важи за произволни стойности", () => {
    const state = uniformlyAcceleratedRotation({
      omega0: 3,
      epsilon: 0.7,
      t: 4,
    });
    // ω = 3 + 2,8 = 5,8; φ = 12 + 0,35·16 = 17,6
    expect(state.omega).toBeCloseTo(5.8, 12);
    expect(state.phi).toBeCloseTo(17.6, 12);
    expect(state.omega ** 2).toBeCloseTo(9 + 2 * 0.7 * 17.6, 12);
  });

  it("отрицателно време е грешка", () => {
    expect(() =>
      uniformlyAcceleratedRotation({ omega0: 1, epsilon: 0, t: -1 }),
    ).toThrow();
  });
});

describe("предавки", () => {
  it("въпрос 3 от „Подробно“: външно зацепване, r₁ = 0,06 m, r₂ = 0,15 m, ω₁ = 20 rad/s", () => {
    // ω₂ = 20·0,06/0,15 = 8 rad/s, в обратна посока → −8
    const omega2 = gearRatio({
      omega1: 20,
      r1: 0.06,
      r2: 0.15,
      external: true,
    });
    expect(omega2).toBeCloseTo(-8, 12);
    // общата точка има една скорост: 20·0,06 = 8·0,15 = 1,2 m/s
    expect(20 * 0.06).toBeCloseTo(Math.abs(omega2) * 0.15, 12);
    // предавателно отношение i = ω₁/|ω₂| = r₂/r₁ = 2,5
    expect(20 / Math.abs(omega2)).toBeCloseTo(2.5, 12);
  });

  it("ремъчната предавка от „В реалния живот“: 1450 min⁻¹, шайби 100 и 250 mm", () => {
    // n₂ = 1450·100/250 = 580 min⁻¹, в същата посока
    expect(
      gearRatio({ omega1: 1450, r1: 100, r2: 250, external: false }),
    ).toBeCloseTo(580, 10);
    // през rad/s излиза същото
    const omega2 = gearRatio({
      omega1: rpmToRadPerSec(1450),
      r1: 0.05,
      r2: 0.125,
      external: false,
    });
    expect(radPerSecToRpm(omega2)).toBeCloseTo(580, 9);
    // i = 250/100 = 2,5; 1450/2,5 = 580
    expect(1450 / 2.5).toBeCloseTo(580, 12);
    // ω₁ = π·1450/30 = 151,84 rad/s; ω₂ = π·580/30 = 60,74 rad/s
    expect(rpmToRadPerSec(1450)).toBeCloseTo(151.84, 2);
    expect(omega2).toBeCloseTo(60.74, 2);
    // скорост на ремъка: 151,84·0,05 = 7,59 m/s = 60,74·0,125
    expect(rotationPoint({ r: 0.05, omega: 151.84, epsilon: 0 }).v).toBeCloseTo(
      7.59,
      2,
    );
    expect(rotationPoint({ r: 0.125, omega: 60.74, epsilon: 0 }).v).toBeCloseTo(
      7.59,
      2,
    );
  });

  it("нулев или отрицателен радиус е грешка", () => {
    expect(() =>
      gearRatio({ omega1: 1, r1: 0, r2: 1, external: true }),
    ).toThrow();
    expect(() =>
      gearRatio({ omega1: 1, r1: 1, r2: -2, external: true }),
    ).toThrow();
  });
});

describe("търкалящо се колело – скорости (пример Л2)", () => {
  const wheel = rollingWheel({ R, vC: 6 });

  it("ω = −v_C/R = −6/0,4 = −15 rad/s (по часовниковата стрелка)", () => {
    expect(wheel.omega).toBeCloseTo(-15, 12);
    expect(wheel.epsilon).toBe(0);
    expectVec(wheel.contact, CONTACT);
  });

  it("точката на допиране има скорост нула", () => {
    // v_x = 6 − (−15)·(0 − 0,4) = 6 − 6 = 0; v_y = 0 + (−15)·0 = 0
    expectVec(planeVelocity(V_C, wheel.omega, C, CONTACT), vec(0, 0));
  });

  it("горна точка 12 m/s надясно; предна точка (6; −6), големина 8,49 m/s", () => {
    // горна: v_x = 6 − (−15)·0,4 = 12; v_y = 0
    expectVec(planeVelocity(V_C, wheel.omega, C, TOP), vec(12, 0));
    // предна: v_x = 6 − (−15)·0 = 6; v_y = 0 + (−15)·0,4 = −6
    const front = planeVelocity(V_C, wheel.omega, C, FRONT);
    expectVec(front, vec(6, -6));
    // √(6² + 6²) = 8,485 → 8,49 m/s, под 45° надолу
    expect(length(front)).toBeCloseTo(8.485, 3);
  });

  it("през МЦС: v = |ω|·PM и v ⊥ PM", () => {
    // PM за горната точка 0,8 m → 15·0,8 = 12; за предната 0,4·√2 = 0,566 m → 15·0,566 = 8,49
    expect(between(CONTACT, TOP)).toBeCloseTo(0.8, 12);
    expect(between(CONTACT, FRONT)).toBeCloseTo(0.566, 3);
    expect(15 * 0.566).toBeCloseTo(8.49, 2);
    for (const M of [C, TOP, FRONT, vec(-0.2, 0.4 + Math.sqrt(0.12))]) {
      const viaPole = planeVelocity(V_C, wheel.omega, C, M);
      const viaCentre = planeVelocity(O, wheel.omega, CONTACT, M);
      expectVec(viaPole, viaCentre);
      expect(length(viaPole)).toBeCloseTo(15 * between(CONTACT, M), 12);
      expect(viaPole.x * M.x + viaPole.y * M.y).toBeCloseTo(0, 12);
    }
  });

  it("МЦС по формулата: x_P = 0 − 0/(−15) = 0, y_P = 0,4 + 6/(−15) = 0", () => {
    expectVec(instantCentre(C, V_C, -15), CONTACT);
  });

  it("числено диференциране на циклоидата дава същите скорости", () => {
    // център x_C = 6t, ъгъл на завъртане φ = −15t; точка с начално положение
    // (dx; dy) спрямо центъра: x = 6t + dx·cos φ − dy·sin φ, y = 0,4 + dx·sin φ + dy·cos φ
    const position = (d: Vec2) => ({
      x: (t: number) =>
        6 * t + d.x * Math.cos(-15 * t) - d.y * Math.sin(-15 * t),
      y: (t: number) => R + d.x * Math.sin(-15 * t) + d.y * Math.cos(-15 * t),
    });
    const cases: [Vec2, Vec2][] = [
      [vec(0, R), vec(12, 0)],
      [vec(0, -R), vec(0, 0)],
      [vec(R, 0), vec(6, -6)],
    ];
    for (const [d, expected] of cases) {
      const p = position(d);
      expect(derivative(p.x, 0)).toBeCloseTo(expected.x, 6);
      expect(derivative(p.y, 0)).toBeCloseTo(expected.y, 6);
    }
  });

  it("въпрос 3 от „Леко“: v_C = 10 m/s → горе 20 m/s, долу 0 (за всеки радиус)", () => {
    for (const radius of [0.3, 0.5, 1.2]) {
      const w = rollingWheel({ R: radius, vC: 10 });
      const centre = vec(0, radius);
      expectVec(
        planeVelocity(vec(10, 0), w.omega, centre, vec(0, 2 * radius)),
        vec(20, 0),
      );
      expectVec(
        planeVelocity(vec(10, 0), w.omega, centre, w.contact),
        vec(0, 0),
      );
    }
  });

  it("колело в покой: ω = 0, без отрицателна нула", () => {
    const still = rollingWheel({ R: 0.5, vC: 0 });
    expect(Object.is(still.omega, 0)).toBe(true);
    expect(() => rollingWheel({ R: 0, vC: 1 })).toThrow();
  });
});

describe("търкалящо се колело – ускорения (пример П4)", () => {
  const wheel = rollingWheel({ R, vC: 6, aC: 2 });

  it("ε = −a_C/R = −2/0,4 = −5 rad/s²", () => {
    expect(wheel.omega).toBeCloseTo(-15, 12);
    expect(wheel.epsilon).toBeCloseTo(-5, 12);
  });

  it("точката на допиране: v = 0, но a = (0; 90) m/s²", () => {
    // a_x = 2 − (−5)·(−0,4) − 225·0 = 2 − 2 = 0
    // a_y = 0 + (−5)·0 − 225·(−0,4) = 90 (нагоре, към центъра)
    expectVec(
      planeAcceleration(A_C, wheel.omega, wheel.epsilon, C, CONTACT),
      vec(0, 90),
    );
    // ω²·R = 15²·0,4 = 90
    expect(15 ** 2 * 0.4).toBeCloseTo(90, 12);
    // грешната сметка „като при въртене около P“ за горната точка: 15²·0,8 = 180
    expect(15 ** 2 * 0.8).toBeCloseTo(180, 12);
  });

  it("горна точка (4; −90), a = 90,09; предна точка (−88; −2), a = 88,02 m/s²", () => {
    // горна: a_x = 2 − (−5)·0,4 − 0 = 4; a_y = 0 + 0 − 225·0,4 = −90
    const top = planeAcceleration(A_C, wheel.omega, wheel.epsilon, C, TOP);
    expectVec(top, vec(4, -90));
    // √(4² + 90²) = √8116 = 90,089
    expect(length(top)).toBeCloseTo(90.09, 2);
    // предна: a_x = 2 − 0 − 225·0,4 = −88; a_y = 0 + (−5)·0,4 − 0 = −2
    const front = planeAcceleration(A_C, wheel.omega, wheel.epsilon, C, FRONT);
    expectVec(front, vec(-88, -2));
    // √(88² + 2²) = √7748 = 88,023
    expect(length(front)).toBeCloseTo(88.02, 2);
  });

  it("втора числена производна на циклоидата при x_C = 6t + t² дава същите ускорения", () => {
    // φ = −x_C/R (търкаляне без плъзгане); при t = 0: v_C = 6, a_C = 2
    const xC = (t: number) => 6 * t + t * t;
    const phi = (t: number) => -xC(t) / R;
    const position = (d: Vec2) => ({
      x: (t: number) => xC(t) + d.x * Math.cos(phi(t)) - d.y * Math.sin(phi(t)),
      y: (t: number) => R + d.x * Math.sin(phi(t)) + d.y * Math.cos(phi(t)),
    });
    const cases: [Vec2, Vec2][] = [
      [vec(0, -R), vec(0, 90)],
      [vec(0, R), vec(4, -90)],
      [vec(R, 0), vec(-88, -2)],
    ];
    for (const [d, expected] of cases) {
      const p = position(d);
      expect(secondDerivative(p.x, 0)).toBeCloseTo(expected.x, 3);
      expect(secondDerivative(p.y, 0)).toBeCloseTo(expected.y, 3);
    }
  });
});

describe("коляно-мотовилков механизъм (примери П2 и П3)", () => {
  const input = { r: 0.2, l: 0.5, phiDeg: 60, omega1: 10 };
  const m = crankSlider(input);
  const P = instantCentre(m.A, m.vA, m.omega2);

  it("геометрия: A(0,1; 0,1732), B(0,5690; 0)", () => {
    // x_A = 0,2·cos 60° = 0,1; y_A = 0,2·sin 60° = 0,17321
    // x_B − x_A = √(0,5² − 0,1732²) = √(0,25 − 0,03) = √0,22 = 0,46904
    expectVec(m.A, vec(0.1, 0.17321), 5);
    expect(m.B.x - m.A.x).toBeCloseTo(0.46904, 5);
    expectVec(m.B, vec(0.56904, 0), 5);
    expect(between(m.A, m.B)).toBeCloseTo(0.5, 12);
    expect(between(O, m.A)).toBeCloseTo(0.2, 12);
  });

  it("скорост на A: (−1,732; 1,000), v_A = 2 m/s", () => {
    // v_Ax = −ω₁·y_A = −10·0,1732 = −1,732; v_Ay = ω₁·x_A = 10·0,1 = 1,000
    expectVec(m.vA, vec(-1.7321, 1), 4);
    expect(length(m.vA)).toBeCloseTo(2, 12);
    expect(rotationPoint({ r: 0.2, omega: 10, epsilon: 0 }).v).toBeCloseTo(
      2,
      12,
    );
  });

  it("начин 1 – полюс A: ω₂ = −2,132 rad/s, v_Bx = −2,101 m/s", () => {
    // 0 = 1,000 + ω₂·0,4690 → ω₂ = −1/0,4690 = −2,132
    // v_Bx = −1,732 − (−2,132)·(0 − 0,1732) = −1,732 − 0,369 = −2,101
    expect(m.omega2).toBeCloseTo(-2.132, 4);
    expect(m.vB).toBeCloseTo(-2.1013, 4);
    expect(-1 / 0.469).toBeCloseTo(-2.132, 3);
    expect(2.132 * 0.1732).toBeCloseTo(0.369, 3);
    expect(-1.732 - 0.369).toBeCloseTo(-2.101, 3);
    expectVec(planeVelocity(m.vA, m.omega2, m.A, m.B), vec(m.vB, 0));
  });

  it("начин 2 – МЦС: P(0,5690; 0,9856), PA = 0,9381, PB = 0,9856 m", () => {
    // P е на правата OA и над B: x_P = x_B = 0,56904; y_P = 0,56904·tg 60° = 0,56904·1,7321 = 0,9856
    expectVec(P, vec(0.569, 0.9856), 4);
    expect(P.x).toBeCloseTo(m.B.x, 12);
    expect(P.y / P.x).toBeCloseTo(Math.tan(Math.PI / 3), 10);
    expect(0.569 * 1.7321).toBeCloseTo(0.9856, 4);
    // OP = 0,56904/cos 60° = 1,1381; PA = 1,1381 − 0,2 = 0,9381
    expect(between(O, P)).toBeCloseTo(1.1381, 4);
    expect(between(P, m.A)).toBeCloseTo(0.9381, 4);
    expect(between(P, m.B)).toBeCloseTo(0.9856, 4);
    // |ω₂| = v_A/PA = 2/0,9381 = 2,132; v_B = 2,132·0,9856 = 2,101
    expect(2 / 0.9381).toBeCloseTo(2.132, 3);
    expect(2.132 * 0.9856).toBeCloseTo(2.101, 3);
    expect(length(m.vA) / between(P, m.A)).toBeCloseTo(Math.abs(m.omega2), 10);
    expect(Math.abs(m.omega2) * between(P, m.B)).toBeCloseTo(
      Math.abs(m.vB),
      10,
    );
  });

  it("скоростите през полюса и през МЦС съвпадат за всяка точка от мотовилката", () => {
    for (const s of [0, 0.25, 0.5, 0.8, 1]) {
      const M = vec(m.A.x + s * (m.B.x - m.A.x), m.A.y + s * (m.B.y - m.A.y));
      const viaPole = planeVelocity(m.vA, m.omega2, m.A, M);
      const viaCentre = planeVelocity(O, m.omega2, P, M);
      expectVec(viaPole, viaCentre);
      expect(length(viaPole)).toBeCloseTo(
        Math.abs(m.omega2) * between(P, M),
        10,
      );
      // скоростта е перпендикулярна на PM
      expect(viaPole.x * (M.x - P.x) + viaPole.y * (M.y - P.y)).toBeCloseTo(
        0,
        10,
      );
    }
  });

  it("начин 3 – проектирани скорости: проекциите върху AB са равни (−1,971 m/s)", () => {
    // единичен вектор по AB: (0,46904/0,5; −0,1732/0,5) = (0,9381; −0,3464)
    // проекция на v_A: −1,732·0,9381 + 1,000·(−0,3464) = −1,625 − 0,346 = −1,971
    // v_Bx·0,9381 = −1,971 → v_Bx = −2,101
    const projA = projectionOnLine(m.vA, m.A, m.B);
    const projB = projectionOnLine(vec(m.vB, 0), m.A, m.B);
    expect(projA).toBeCloseTo(-1.971, 3);
    expect(projB).toBeCloseTo(projA, 10);
    expect(-1.732 * 0.9381 - 1.0 * 0.3464).toBeCloseTo(-1.971, 3);
    expect(-1.971 / 0.9381).toBeCloseTo(-2.101, 3);
  });

  it("средата C на мотовилката: (−1,917; 0,500), v_C = 1,981 m/s", () => {
    // C − A = (0,2345; −0,0866)
    // v_Cx = −1,732 − (−2,132)·(−0,0866) = −1,732 − 0,185 = −1,917
    // v_Cy = 1,000 + (−2,132)·0,2345 = 1,000 − 0,500 = 0,500
    // v_C = √(1,917² + 0,500²) = 1,981; сверка: 2,132·PC = 2,132·0,9291 = 1,981
    const mid = vec((m.A.x + m.B.x) / 2, (m.A.y + m.B.y) / 2);
    const v = planeVelocity(m.vA, m.omega2, m.A, mid);
    expectVec(v, vec(-1.917, 0.5), 3);
    expect(length(v)).toBeCloseTo(1.981, 3);
    expect(between(P, mid)).toBeCloseTo(0.9291, 4);
    expect(2.132 * 0.9291).toBeCloseTo(1.981, 3);
    expect(Math.hypot(1.917, 0.5)).toBeCloseTo(1.981, 3);
  });

  it("числена производна на x_B(φ) съвпада с v_B, а на ъгъла на мотовилката – с ω₂", () => {
    // точен закон: x_B = r·cos φ + √(l² − r²·sin² φ), φ = π/3 + 10t
    const phi = (t: number) => Math.PI / 3 + 10 * t;
    const xB = (t: number) =>
      0.2 * Math.cos(phi(t)) + Math.sqrt(0.25 - (0.2 * Math.sin(phi(t))) ** 2);
    // ъгъл на AB с оста x: ψ = −arcsin(r·sin φ / l)
    const psi = (t: number) => -Math.asin((0.2 * Math.sin(phi(t))) / 0.5);
    expect(derivative(xB, 0)).toBeCloseTo(m.vB, 6);
    expect(derivative(psi, 0)).toBeCloseTo(m.omega2, 6);
    // същото през самата функция при φ ± Δ
    const d = 1e-4;
    const plus = crankSlider({ ...input, phiDeg: 60 + d });
    const minus = crankSlider({ ...input, phiDeg: 60 - d });
    const dPhi = (2 * d * Math.PI) / 180;
    expect(((plus.B.x - minus.B.x) / dPhi) * 10).toBeCloseTo(m.vB, 6);
  });

  it("пример П3: a_A = (−10,00; −17,32), ε₂ = 35,25 rad/s², a_Bx = −6,027 m/s²", () => {
    // a_A = −ω₁²·OA = −100·(0,1; 0,1732) = (−10,00; −17,32)
    // ω₂² = 2,132² = 4,545
    // a_By = 0: −17,32 + ε₂·0,4690 − 4,545·(−0,1732) = 0
    //   → ε₂ = (17,32 − 0,787)/0,4690 = 16,533/0,4690 = 35,25
    // a_Bx = −10,00 − 35,25·(−0,1732) − 4,545·0,4690 = −10,00 + 6,105 − 2,132 = −6,027
    expectVec(m.aA, vec(-10, -17.3205), 4);
    expect(m.omega2 ** 2).toBeCloseTo(4.545, 3);
    expect(m.epsilon2).toBeCloseTo(35.2489, 4);
    expect(m.aB).toBeCloseTo(-6.0267, 4);
    expect(4.545 * 0.1732).toBeCloseTo(0.787, 3);
    expect((17.32 - 0.787) / 0.469).toBeCloseTo(35.25, 2);
    expect(35.25 * 0.1732).toBeCloseTo(6.105, 3);
    expect(4.545 * 0.469).toBeCloseTo(2.132, 3);
    expect(-10 + 6.105 - 2.132).toBeCloseTo(-6.027, 3);
    expectVec(
      planeAcceleration(m.aA, m.omega2, m.epsilon2, m.A, m.B),
      vec(m.aB, 0),
    );
  });

  it("П3: втора числена производна на x_B(t) и на ъгъла на мотовилката", () => {
    const phi = (t: number) => Math.PI / 3 + 10 * t;
    const xB = (t: number) =>
      0.2 * Math.cos(phi(t)) + Math.sqrt(0.25 - (0.2 * Math.sin(phi(t))) ** 2);
    const psi = (t: number) => -Math.asin((0.2 * Math.sin(phi(t))) / 0.5);
    expect(secondDerivative(xB, 0)).toBeCloseTo(m.aB, 4);
    expect(secondDerivative(psi, 0)).toBeCloseTo(m.epsilon2, 4);
  });

  it("с ъглово ускорение на коляното: a_A получава и въртелива съставка", () => {
    // φ = 90°, r = 0,2, ω₁ = 0, ε₁ = 5: A(0; 0,2); a_A = (−ε₁·y_A; 0) = (−1; 0)
    const start = crankSlider({
      r: 0.2,
      l: 0.5,
      phiDeg: 90,
      omega1: 0,
      epsilon1: 5,
    });
    expectVec(start.aA, vec(-1, 0), 12);
    // a_Ay = 0 и ω₂ = 0 → ε₂ = 0, плъзгачът тръгва с a_B = −1 m/s²
    expect(start.epsilon2).toBeCloseTo(0, 12);
    expect(start.aB).toBeCloseTo(-1, 12);
  });

  it("твърде къса мотовилка е грешка", () => {
    expect(() =>
      crankSlider({ r: 0.2, l: 0.1, phiDeg: 60, omega1: 10 }),
    ).toThrow();
    expect(() =>
      crankSlider({ r: 0.2, l: 0.2, phiDeg: 90, omega1: 10 }),
    ).toThrow();
    expect(() =>
      crankSlider({ r: -0.2, l: 0.5, phiDeg: 60, omega1: 10 }),
    ).toThrow();
  });
});

describe("стълбата (загадката и въпрос 1 от „Подробно“)", () => {
  const A = vec(3, 0);
  const B = vec(0, 4);
  const vA = vec(2, 0);

  it("МЦС е в (3; 4); ω = 2/4 = 0,5 rad/s; v_B = 0,5·3 = 1,5 m/s надолу", () => {
    // v_Bx = 0: 2 − ω·(4 − 0) = 0 → ω = 0,5 (обратно на часовниковата)
    // v_By = 0 + 0,5·(0 − 3) = −1,5
    const vB = planeVelocity(vA, 0.5, A, B);
    expectVec(vB, vec(0, -1.5));
    // x_P = 3 − 0/0,5 = 3; y_P = 0 + 2/0,5 = 4
    const P = instantCentre(A, vA, 0.5);
    expectVec(P, vec(3, 4));
    expect(between(P, A)).toBeCloseTo(4, 12);
    expect(between(P, B)).toBeCloseTo(3, 12);
    expect(between(A, B)).toBeCloseTo(5, 12);
    // МЦС не е на стълбата: разстоянието му до правата AB е 3·4/5 = 2,4 m
    expect(between(P, vec(1.5, 2))).toBeCloseTo(2.5, 12);
  });

  it("проекциите на двете скорости върху стълбата са равни: 2·(−3/5) = −1,5·(4/5) = −1,2 m/s", () => {
    expect(projectionOnLine(vA, A, B)).toBeCloseTo(-1.2, 12);
    expect(projectionOnLine(vec(0, -1.5), A, B)).toBeCloseTo(-1.2, 12);
  });

  it("числена производна на y_B = √(25 − x_A²) при x_A = 3 + 2t", () => {
    const yB = (t: number) => Math.sqrt(25 - (3 + 2 * t) ** 2);
    expect(derivative(yB, 0)).toBeCloseTo(-1.5, 7);
    // ъгъл на стълбата с пода, отчетен обратно на часовниковата: θ = π − arccos(x_A/5)
    const theta = (t: number) => Math.PI - Math.acos((3 + 2 * t) / 5);
    expect(derivative(theta, 0)).toBeCloseTo(0.5, 7);
  });
});

describe("теорема за проектираните скорости", () => {
  it("въпрос 4 от „Подробно“: v_B = 4·cos 30°/cos 60° = 6,93 m/s", () => {
    const rad = (deg: number) => (deg * Math.PI) / 180;
    // 4·0,8660 = 3,464; 3,464/0,5 = 6,928
    const vB = (4 * Math.cos(rad(30))) / Math.cos(rad(60));
    expect(vB).toBeCloseTo(6.928, 3);
    expect(4 * 0.866).toBeCloseTo(3.464, 3);
    expect(3.464 / 0.5).toBeCloseTo(6.93, 2);
    // сверка през векторите: A(0; 0), B(1; 0)
    const vA = vec(4 * Math.cos(rad(30)), 4 * Math.sin(rad(30)));
    const vBvec = vec(vB * Math.cos(rad(60)), vB * Math.sin(rad(60)));
    expect(projectionOnLine(vA, O, vec(1, 0))).toBeCloseTo(
      projectionOnLine(vBvec, O, vec(1, 0)),
      12,
    );
  });

  it("важи за произволно равнинно движение и произволна двойка точки", () => {
    const A = vec(1.2, -0.7);
    const vA = vec(-3.1, 2.4);
    const omega = 1.9;
    const points = [vec(0, 0), vec(2.5, 1.5), vec(-1, 3), vec(4, -2)];
    for (const B of points) {
      for (const D of points) {
        if (B === D) continue;
        const vB = planeVelocity(vA, omega, A, B);
        const vD = planeVelocity(vA, omega, A, D);
        expect(projectionOnLine(vB, B, D)).toBeCloseTo(
          projectionOnLine(vD, B, D),
          10,
        );
      }
    }
  });

  it("съвпадащи точки са грешка", () => {
    expect(() => projectionOnLine(vec(1, 0), O, O)).toThrow();
  });
});

describe("моментен център на скоростите – общи свойства", () => {
  it("скоростта в МЦС е нула и не зависи от избора на полюс", () => {
    const A = vec(1.2, -0.7);
    const vA = vec(-3.1, 2.4);
    const omega = -1.9;
    const P = instantCentre(A, vA, omega);
    expectVec(planeVelocity(vA, omega, A, P), vec(0, 0));
    // друг полюс от същото тяло дава същия център
    const B = vec(-2, 5);
    const vB = planeVelocity(vA, omega, A, B);
    expectVec(instantCentre(B, vB, omega), P);
  });

  it("ω = 0 е моментна транслация – грешка, а скоростите на всички точки са равни", () => {
    expect(() => instantCentre(O, vec(1, 0), 0)).toThrow(/моментна транслация/);
    expectVec(planeVelocity(vec(3, 1), 0, O, vec(7, -4)), vec(3, 1));
    // въпрос 5 от „Подробно“: при ω = 0 ускоренията пак се различават, ако ε ≠ 0
    const a1 = planeAcceleration(vec(0, 0), 0, 2, O, vec(1, 0));
    expectVec(a1, vec(0, 2));
  });

  it("числено диференциране на положението на точка при общо равнинно движение", () => {
    // полюс: x_A = 1 + 2t, y_A = 0,5t²; ъгъл φ = 0,3 + 1,5t − 0,4t²; точка (0,6; 0,2) в осите на тялото
    const xA = (t: number) => 1 + 2 * t;
    const yA = (t: number) => 0.5 * t * t;
    const phi = (t: number) => 0.3 + 1.5 * t - 0.4 * t * t;
    const x = (t: number) =>
      xA(t) + 0.6 * Math.cos(phi(t)) - 0.2 * Math.sin(phi(t));
    const y = (t: number) =>
      yA(t) + 0.6 * Math.sin(phi(t)) + 0.2 * Math.cos(phi(t));
    const t = 1.3;
    // v_A = (2; t) = (2; 1,3); a_A = (0; 1); ω = 1,5 − 0,8t = 0,46; ε = −0,8
    const A = vec(xA(t), yA(t));
    const M = vec(x(t), y(t));
    const v = planeVelocity(vec(2, 1.3), 0.46, A, M);
    const a = planeAcceleration(vec(0, 1), 0.46, -0.8, A, M);
    expect(derivative(x, t)).toBeCloseTo(v.x, 7);
    expect(derivative(y, t)).toBeCloseTo(v.y, 7);
    expect(secondDerivative(x, t)).toBeCloseTo(a.x, 5);
    expect(secondDerivative(y, t)).toBeCloseTo(a.y, 5);
  });
});
