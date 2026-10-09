import { describe, expect, it } from "vitest";
import {
  G_ACCELERATION,
  constantAcceleration,
  curveNormalReaction,
  inclineMotion,
  liftOffSpeed,
  linearDragFall,
  maxFlatCurveSpeed,
  pendulumPeriod,
  pendulumState,
  projectileFlight,
  projectileState,
  springOscillation,
  staysAtRest,
  supportReaction,
  timeToTerminalFraction,
  weight,
} from "@/lib/engineering/dynamics-point";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Единици: m, s, kg, N. Оста y е нагоре (a_y = −g), g = 9,81 m/s².

const g = G_ACCELERATION;
const RAD = Math.PI / 180;

/**
 * Независима проверка: класически метод на Рунге–Кута от 4-ти ред за
 * системата y' = f(t, y). Не ползва нищо от проверявания файл.
 */
function rk4(
  f: (t: number, y: number[]) => number[],
  y0: number[],
  t0: number,
  t1: number,
  steps: number,
): number[] {
  const h = (t1 - t0) / steps;
  let y = [...y0];
  const add = (a: number[], b: number[], factor: number) =>
    a.map((value, i) => value + factor * b[i]!);
  for (let i = 0; i < steps; i++) {
    const t = t0 + i * h;
    const k1 = f(t, y);
    const k2 = f(t + h / 2, add(y, k1, h / 2));
    const k3 = f(t + h / 2, add(y, k2, h / 2));
    const k4 = f(t + h, add(y, k3, h));
    y = y.map(
      (value, j) =>
        value + (h / 6) * (k1[j]! + 2 * k2[j]! + 2 * k3[j]! + k4[j]!),
    );
  }
  return y;
}

/** Числена втора производна (централна разлика). */
function secondDerivative(
  law: (t: number) => number,
  t: number,
  h = 1e-3,
): number {
  return (law(t + h) - 2 * law(t) + law(t - h)) / (h * h);
}

describe("тегло и реакция на опората", () => {
  it("тегло в N", () => {
    // 1 kg · 9,81 = 9,81 N; 20 · 9,81 = 196,2 N; 1200 · 9,81 = 11 772 N
    expect(weight(1)).toBeCloseTo(9.81, 10);
    expect(weight(20)).toBeCloseTo(196.2, 10);
    expect(weight(1200)).toBeCloseTo(11772, 8);
    // „Провери се“ (Леко) 2: 80 · 9,81 = 784,8 N = 0,785 kN
    expect(weight(80)).toBeCloseTo(784.8, 10);
    expect(weight(80) / 1000).toBeCloseTo(0.785, 3);
    // „Провери се“ (Леко) 3: теглото на човек с маса 60 kg е 588,6 N
    expect(weight(60)).toBeCloseTo(588.6, 10);
    // обратно: товар 12 kN = 12 000 N има маса 12 000/9,81 = 1223 kg
    expect(12000 / g).toBeCloseTo(1223, 0);
    expect(weight(12000 / g) / 1000).toBeCloseTo(12, 10);
  });

  it("Пример Л2 – кантар в асансьор, m = 70 kg, a = ±1,2 m/s²", () => {
    // N = m(g + a): 70 · 11,01 = 770,7; 70 · 8,61 = 602,7; 70 · 9,81 = 686,7 N
    const up = supportReaction(70, 1.2);
    const down = supportReaction(70, -1.2);
    const steady = supportReaction(70, 0);
    expect(up).toBeCloseTo(770.7, 8);
    expect(down).toBeCloseTo(602.7, 8);
    expect(steady).toBeCloseTo(686.7, 8);
    // симетрия около теглото: (770,7 + 602,7)/2 = 686,7
    expect((up + down) / 2).toBeCloseTo(steady, 8);
    // m·a = ΣF: 70 · 1,2 = 84 = 770,7 − 686,7
    expect(up - weight(70)).toBeCloseTo(70 * 1.2, 8);
    expect(down - weight(70)).toBeCloseTo(-70 * 1.2, 8);
  });

  it("Л2 – енергийна сверка: работата на N и G е изменението на кинетичната енергия", () => {
    // от покой с a = 1,2 за 2 s: v = 2,4 m/s, път 2,4 m;
    // работа (770,7 − 686,7) · 2,4 = 201,6 J; ½ · 70 · 2,4² = 201,6 J
    const v = 1.2 * 2;
    const s = (1.2 * 2 * 2) / 2;
    expect((supportReaction(70, 1.2) - weight(70)) * s).toBeCloseTo(201.6, 8);
    expect(0.5 * 70 * v * v).toBeCloseTo(201.6, 8);
  });

  it("„Провери се“ (Леко) 1 и 3; „В реалния живот“ – въже на асансьор", () => {
    // 1: a = F/m = 30/6 = 5 m/s²
    expect(30 / 6).toBe(5);
    // 3: N = 60 · (9,81 − 2) = 60 · 7,81 = 468,6 N
    expect(supportReaction(60, -2)).toBeCloseTo(468.6, 8);
    // въже: S = 1000 · (9,81 + 1) = 10 810 N = 10,81 kN; в покой 9810 N = 9,81 kN
    expect(supportReaction(1000, 1)).toBeCloseTo(10810, 8);
    expect(supportReaction(1000, 0)).toBeCloseTo(9810, 8);
    // 10,81 / 9,81 = 1,102 – около 10 % повече
    expect(supportReaction(1000, 1) / supportReaction(1000, 0)).toBeCloseTo(
      1.102,
      3,
    );
  });

  it("свободно падане: опората не носи нищо", () => {
    expect(supportReaction(70, -g)).toBe(0);
    expect(supportReaction(70, -15)).toBe(0);
  });
});

describe("Пример Л1 – плъзгане по наклон 30°, m = 20 kg, μ = 0,2, l = 4 m", () => {
  const result = inclineMotion({
    mass: 20,
    angleDeg: 30,
    mu: 0.2,
    direction: "down",
  });

  it("сили и ускорение", () => {
    // G = 196,2 N; N = 196,2 · cos 30° = 196,2 · 0,86603 = 169,914 N
    expect(result.normal).toBeCloseTo(169.914, 3);
    // F_тр = 0,2 · 169,914 = 33,983 N
    expect(result.friction).toBeCloseTo(33.983, 3);
    // G·sin 30° = 98,1 N; 20·a = 98,1 − 33,983 = 64,117; a = 3,2059 m/s²
    expect(result.gravityAlong).toBeCloseTo(98.1, 8);
    expect(result.netForce).toBeCloseTo(64.117, 3);
    expect(result.a).toBeCloseTo(3.2059, 4);
    // формулата a = g(sin α − μ cos α) = 9,81 · (0,5 − 0,17321) = 3,2059
    expect(result.a).toBeCloseTo(g * (0.5 - 0.2 * Math.cos(30 * RAD)), 12);
  });

  it("скорост и време в края на наклона", () => {
    // v = √(2 · 3,2059 · 4) = √25,647 = 5,0643 m/s; t = √(8/3,2059) = 1,5797 s
    const end = constantAcceleration({ v0: 0, a: result.a, distance: 4 });
    expect(end.v).toBeCloseTo(5.0643, 4);
    expect(end.time).toBeCloseTo(1.5797, 4);
    // с отпечатаните закръглени стойности: √(2 · 3,206 · 4) = 5,064; √(8/3,206) = 1,580
    expect(Math.sqrt(2 * 3.206 * 4)).toBeCloseTo(5.064, 3);
    expect(Math.sqrt(8 / 3.206)).toBeCloseTo(1.58, 3);
    expect((196.2 * 0.5 - 33.98) / 20).toBeCloseTo(3.206, 3);
  });

  it("законът s(t) = a·t²/2 удовлетворява m·a = ΣF (числена втора производна)", () => {
    const law = (t: number) => (result.a * t * t) / 2;
    for (const t of [0.2, 0.7, 1.1, 1.5]) {
      expect(20 * secondDerivative(law, t)).toBeCloseTo(
        result.gravityAlong - result.friction,
        6,
      );
    }
  });

  it("независимо интегриране (Рунге–Кута) дава същия край", () => {
    const end = constantAcceleration({ v0: 0, a: result.a, distance: 4 });
    // s' = v, v' = g(sin α − μ cos α), написано отделно от функцията
    const a = g * Math.sin(30 * RAD) - 0.2 * g * Math.cos(30 * RAD);
    const state = rk4((_t, y) => [y[1]!, a], [0, 0], 0, end.time, 500);
    expect(state[0]).toBeCloseTo(4, 9);
    expect(state[1]).toBeCloseTo(5.0643, 4);
  });

  it("енергийна сверка: m·g·h − F_тр·l = ½·m·v²", () => {
    // h = 4 · sin 30° = 2 m; 196,2 · 2 − 33,983 · 4 = 392,4 − 135,931 = 256,469 J
    const work = weight(20) * 2 - result.friction * 4;
    expect(work).toBeCloseTo(256.469, 3);
    // ½ · 20 · 5,0643² = 256,47 J
    const { v } = constantAcceleration({ v0: 0, a: result.a, distance: 4 });
    expect(0.5 * 20 * v * v).toBeCloseTo(work, 9);
  });
});

describe("наклон – гранични случаи и условие за покой", () => {
  it("без триене: a = g·sin α", () => {
    const smooth = inclineMotion({
      mass: 3,
      angleDeg: 30,
      mu: 0,
      direction: "down",
    });
    expect(smooth.friction).toBe(0);
    expect(smooth.a).toBeCloseTo(g / 2, 12);
  });

  it("нулев ъгъл: хоризонтална равнина", () => {
    // N = G; плъзгане с триене: a = −μ·g = −0,2 · 9,81 = −1,962 m/s² (забавяне)
    const flat = inclineMotion({
      mass: 5,
      angleDeg: 0,
      mu: 0.2,
      direction: "down",
    });
    expect(flat.normal).toBeCloseTo(49.05, 10);
    expect(flat.gravityAlong).toBeCloseTo(0, 12);
    expect(flat.a).toBeCloseTo(-1.962, 10);
    // гладък под и сила 30 N върху 6 kg („Провери се“, Леко 1): a = 5 m/s²
    const pushed = inclineMotion({
      mass: 6,
      angleDeg: 0,
      mu: 0,
      direction: "up",
      pull: 30,
    });
    expect(pushed.a).toBeCloseTo(5, 12);
  });

  it("ускорението не зависи от масата", () => {
    const light = inclineMotion({
      mass: 1,
      angleDeg: 40,
      mu: 0.3,
      direction: "down",
    });
    const heavy = inclineMotion({
      mass: 500,
      angleDeg: 40,
      mu: 0.3,
      direction: "down",
    });
    expect(heavy.a).toBeCloseTo(light.a, 12);
    // „Провери се“ (Подробно) 2: 9,81 · (0,6428 − 0,3 · 0,7660) = 9,81 · 0,4130 = 4,05 m/s²
    expect(light.a).toBeCloseTo(4.05, 2);
    expect(9.81 * (0.6428 - 0.3 * 0.766)).toBeCloseTo(4.05, 2);
  });

  it("условие за покой tg α ≤ μ", () => {
    // „Провери се“ (Подробно) 1: tg 20° = 0,364 < 0,5 – остава в покой
    expect(Math.tan(20 * RAD)).toBeCloseTo(0.364, 3);
    expect(staysAtRest(20, 0.5)).toBe(true);
    // Л1: tg 30° = 0,577 > 0,2 – тръгва
    expect(staysAtRest(30, 0.2)).toBe(false);
    expect(staysAtRest(0, 0)).toBe(true);
    // на границата ускорението при плъзгане е нула
    const limit = inclineMotion({
      mass: 2,
      angleDeg: 20,
      mu: Math.tan(20 * RAD),
      direction: "down",
    });
    expect(limit.a).toBeCloseTo(0, 12);
  });

  it("невалиден вход", () => {
    const base = {
      mass: 20,
      angleDeg: 30,
      mu: 0.2,
      direction: "down",
    } as const;
    expect(() => inclineMotion({ ...base, mu: -0.1 })).toThrow();
    expect(() => inclineMotion({ ...base, mass: 0 })).toThrow();
    expect(() => inclineMotion({ ...base, mass: -4 })).toThrow();
    expect(() => inclineMotion({ ...base, angleDeg: 90 })).toThrow();
    expect(() => inclineMotion({ ...base, angleDeg: Number.NaN })).toThrow();
    expect(() => staysAtRest(20, -1)).toThrow();
    expect(() => weight(0)).toThrow();
    expect(() => constantAcceleration({ v0: 1, a: -5, distance: 3 })).toThrow();
  });
});

describe("Пример П1 (изпитен тип) – наклон 25° с теглителна сила, после полет", () => {
  const ab = inclineMotion({
    mass: 4,
    angleDeg: 25,
    mu: 0.15,
    direction: "up",
    pull: 40,
  });
  const atB = constantAcceleration({ v0: 2, a: ab.a, distance: 6 });
  const flight = projectileFlight({ v0: atB.v, angleDeg: 25, drop: 1.5 });

  it("участък AB – сили и ускорение", () => {
    // m·g = 39,24 N; sin 25° = 0,422618; cos 25° = 0,906308
    // N = 39,24 · 0,906308 = 35,5635 N; F_тр = 0,15 · 35,5635 = 5,3345 N
    expect(ab.normal).toBeCloseTo(35.5635, 4);
    expect(ab.friction).toBeCloseTo(5.3345, 4);
    // m·g·sin α = 39,24 · 0,422618 = 16,5835 N
    expect(ab.gravityAlong).toBeCloseTo(16.5835, 4);
    // 4·a = 40 − 16,5835 − 5,3345 = 18,082; a = 4,5205 m/s²
    expect(ab.netForce).toBeCloseTo(18.082, 3);
    expect(ab.a).toBeCloseTo(4.5205, 4);
    // формулата a = F/m − g(sin α + μ cos α)
    expect(ab.a).toBeCloseTo(
      40 / 4 - g * (Math.sin(25 * RAD) + 0.15 * Math.cos(25 * RAD)),
      12,
    );
    // сметката с отпечатаните числа
    expect(39.24 * 0.906308).toBeCloseTo(35.5635, 4);
    expect(0.15 * 35.5635).toBeCloseTo(5.3345, 4);
    expect(39.24 * 0.422618).toBeCloseTo(16.5835, 4);
    expect((40 - 16.5835 - 5.3345) / 4).toBeCloseTo(4.5205, 6);
  });

  it("участък AB – скорост в B и време", () => {
    // v_B = √(2² + 2 · 4,5205 · 6) = √(4 + 54,246) = √58,246 = 7,6319 m/s
    expect(atB.v).toBeCloseTo(7.6319, 4);
    expect(Math.sqrt(4 + 2 * 4.5205 * 6)).toBeCloseTo(7.632, 3);
    // t_AB = (7,632 − 2)/4,5205 = 1,246 s
    expect(atB.time).toBeCloseTo(1.2459, 4);
    expect((7.632 - 2) / 4.5205).toBeCloseTo(1.246, 3);
  });

  it("AB – законът s(t) удовлетворява m·a = ΣF в няколко момента", () => {
    const law = (t: number) => 2 * t + (ab.a * t * t) / 2;
    for (const t of [0.1, 0.5, 0.9, 1.2]) {
      // ΣF по наклона нагоре: F − m·g·sin α − F_тр
      expect(4 * secondDerivative(law, t)).toBeCloseTo(
        40 - ab.gravityAlong - ab.friction,
        6,
      );
    }
    // законът стига точно до B: s(t_AB) = 6 m
    expect(law(atB.time)).toBeCloseTo(6, 10);
  });

  it("AB – Рунге–Кута: s = 6,0000 m и v = 7,6319 m/s след t_AB", () => {
    const a = 40 / 4 - g * Math.sin(25 * RAD) - 0.15 * g * Math.cos(25 * RAD);
    const [s, v] = rk4((_t, y) => [y[1]!, a], [0, 2], 0, atB.time, 1000) as [
      number,
      number,
    ];
    expect(s).toBeCloseTo(6, 9);
    expect(v).toBeCloseTo(7.6319, 4);
  });

  it("AB – енергийна сверка", () => {
    // работа: (40 − 16,5835 − 5,3345) · 6 = 18,082 · 6 = 108,49 J
    const work = (40 - ab.gravityAlong - ab.friction) * 6;
    expect(work).toBeCloseTo(108.49, 2);
    // ½ · 4 · (7,6319² − 2²) = 2 · (58,246 − 4) = 108,49 J
    expect(0.5 * 4 * (atB.v ** 2 - 2 ** 2)).toBeCloseTo(work, 9);
  });

  it("участък BC – полет", () => {
    // v_Bx = 7,632 · 0,906308 = 6,917 m/s; v_By = 7,632 · 0,422618 = 3,225 m/s
    expect(flight.vx).toBeCloseTo(6.917, 3);
    expect(atB.v * Math.sin(25 * RAD)).toBeCloseTo(3.225, 3);
    expect(7.632 * 0.906308).toBeCloseTo(6.917, 3);
    expect(7.632 * 0.422618).toBeCloseTo(3.225, 3);
    // t_C = (3,225 + √(3,225² + 2 · 9,81 · 1,5))/9,81 = (3,225 + 6,3112)/9,81 = 0,9721 s
    expect(flight.time).toBeCloseTo(0.9721, 4);
    expect((3.225 + Math.sqrt(3.225 ** 2 + 2 * 9.81 * 1.5)) / 9.81).toBeCloseTo(
      0.9721,
      4,
    );
    // d = 6,917 · 0,9721 = 6,724 m
    expect(flight.range).toBeCloseTo(6.7242, 4);
    expect(6.917 * 0.9721).toBeCloseTo(6.724, 3);
    // v_Cy = 3,225 − 9,81 · 0,9721 = −6,311 m/s
    expect(flight.vy).toBeCloseTo(-6.3113, 4);
    expect(3.225 - 9.81 * 0.9721).toBeCloseTo(-6.311, 3);
    // v_C = √(6,917² + 6,311²) = √87,67 = 9,36 m/s; ъгъл arctg(6,311/6,917) = 42,4°
    expect(flight.speed).toBeCloseTo(9.3635, 4);
    expect(Math.hypot(6.917, 6.311)).toBeCloseTo(9.36, 2);
    expect(flight.impactAngleDeg).toBeCloseTo(42.38, 2);
    expect(Math.atan(6.311 / 6.917) / RAD).toBeCloseTo(42.4, 1);
    // най-висока точка: 3,225/9,81 = 0,329 s; 3,225²/19,62 = 0,530 m над B
    expect(flight.apexTime).toBeCloseTo(0.3288, 4);
    expect(flight.apexHeight).toBeCloseTo(0.5302, 4);
    expect(3.225 / 9.81).toBeCloseTo(0.329, 3);
    expect(3.225 ** 2 / 19.62).toBeCloseTo(0.53, 3);
  });

  it("BC – законът x(t), y(t) удовлетворява m·a = ΣF (само теглото)", () => {
    const x = (t: number) => projectileState({ v0: atB.v, angleDeg: 25, t }).x;
    const y = (t: number) => projectileState({ v0: atB.v, angleDeg: 25, t }).y;
    for (const t of [0.1, 0.33, 0.6, 0.9]) {
      expect(4 * secondDerivative(x, t)).toBeCloseTo(0, 5);
      expect(4 * secondDerivative(y, t)).toBeCloseTo(-weight(4), 5);
    }
    const landing = projectileState({
      v0: atB.v,
      angleDeg: 25,
      t: flight.time,
    });
    expect(landing.x).toBeCloseTo(flight.range, 12);
    expect(landing.y).toBeCloseTo(-1.5, 12);
    expect(landing.vy).toBeCloseTo(flight.vy, 12);
  });

  it("BC – Рунге–Кута: (6,7242; −1,5000) и скорост (6,9168; −6,3113)", () => {
    const start = [
      0,
      0,
      7.631893298808081 * Math.cos(25 * RAD),
      7.631893298808081 * Math.sin(25 * RAD),
    ];
    const [x, y, vx, vy] = rk4(
      (_t, s) => [s[2]!, s[3]!, 0, -9.81],
      start,
      0,
      flight.time,
      1000,
    ) as [number, number, number, number];
    expect(x).toBeCloseTo(6.7242, 4);
    expect(y).toBeCloseTo(-1.5, 9);
    expect(vx).toBeCloseTo(6.9168, 4);
    expect(vy).toBeCloseTo(-6.3113, 4);
  });

  it("BC – енергийна сверка: v_C² = v_B² + 2·g·h", () => {
    // 58,246 + 2 · 9,81 · 1,5 = 58,246 + 29,43 = 87,676; √87,676 = 9,3635 m/s
    expect(atB.v ** 2 + 2 * g * 1.5).toBeCloseTo(87.676, 3);
    expect(flight.speed ** 2).toBeCloseTo(atB.v ** 2 + 2 * g * 1.5, 9);
    // работа на теглото m·g·h = 39,24 · 1,5 = 58,86 J = ½·m·(v_C² − v_B²)
    expect(0.5 * 4 * (flight.speed ** 2 - atB.v ** 2)).toBeCloseTo(58.86, 8);
  });

  it("полет – гранични случаи", () => {
    // хоризонтално хвърляне (ъгъл 0) от 4,905 m: t = √(2h/g) = 1 s, d = v0
    const level = projectileFlight({ v0: 3, angleDeg: 0, drop: 4.905 });
    expect(level.time).toBeCloseTo(1, 12);
    expect(level.range).toBeCloseTo(3, 12);
    expect(level.apexHeight).toBe(0);
    // хвърляне под 45° и падане на същото ниво: d = v0²/g, t = 2·v0·sin 45°/g
    const same = projectileFlight({ v0: 9.81, angleDeg: 45, drop: 0 });
    expect(same.range).toBeCloseTo(9.81, 10);
    expect(same.speed).toBeCloseTo(9.81, 10);
    expect(same.impactAngleDeg).toBeCloseTo(45, 10);
    // недостижима височина
    expect(() => projectileFlight({ v0: 1, angleDeg: 30, drop: -5 })).toThrow();
    expect(() => projectileFlight({ v0: 1, angleDeg: 90, drop: 1 })).toThrow();
  });
});

describe("Пример П2 – падане с линейно съпротивление, m = 2 kg, b = 4 N·s/m", () => {
  it("гранична скорост, v(1) и x(1)", () => {
    const fall = linearDragFall({ mass: 2, b: 4, t: 1 });
    // v∞ = 2 · 9,81/4 = 19,62/4 = 4,905 m/s; m/b = 0,5 s
    expect(fall.vTerminal).toBeCloseTo(4.905, 10);
    expect(fall.timeConstant).toBe(0.5);
    // e^(−2) = 0,13534; v(1) = 4,905 · 0,86466 = 4,2412 m/s
    expect(fall.v).toBeCloseTo(4.2412, 4);
    expect(4.905 * 0.86466).toBeCloseTo(4.241, 3);
    // x(1) = 4,905 · (1 − 0,5 · 0,86466) = 4,905 · 0,56767 = 2,7844 m
    expect(fall.x).toBeCloseTo(2.7844, 4);
    expect(4.905 * (1 - 0.5 * 0.86466)).toBeCloseTo(2.784, 3);
    // 95 % от v∞: t = −0,5 · ln 0,05 = 0,5 · 2,9957 = 1,498 s
    expect(
      timeToTerminalFraction({ mass: 2, b: 4, fraction: 0.95 }),
    ).toBeCloseTo(1.498, 3);
    // без съпротивление за 1 s: v = 9,81 m/s, x = 4,905 m
    expect(g * 1).toBeCloseTo(9.81, 12);
    expect((g * 1 * 1) / 2).toBeCloseTo(4.905, 12);
  });

  it("решението удовлетворява m·a = m·g − b·v в няколко момента", () => {
    const x = (t: number) => linearDragFall({ mass: 2, b: 4, t }).x;
    for (const t of [0.05, 0.3, 1, 2.2]) {
      const state = linearDragFall({ mass: 2, b: 4, t });
      expect(2 * secondDerivative(x, t)).toBeCloseTo(
        weight(2) - 4 * state.v,
        4,
      );
      expect(2 * state.a).toBeCloseTo(weight(2) - 4 * state.v, 10);
    }
    // начало: v = 0, a = g; след дълго време: v → v∞, a → 0
    expect(linearDragFall({ mass: 2, b: 4, t: 0 }).a).toBeCloseTo(g, 12);
    expect(linearDragFall({ mass: 2, b: 4, t: 0 }).x).toBe(0);
    expect(linearDragFall({ mass: 2, b: 4, t: 30 }).v).toBeCloseTo(4.905, 10);
  });

  it("Рунге–Кута на v' = g − (b/m)·v, 2000 стъпки до t = 1 s", () => {
    // трета компонента: работата на съпротивлението ∫ b·v² dt
    const [x, v, dragWork] = rk4(
      (_t, y) => [y[1]!, 9.81 - (4 / 2) * y[1]!, 4 * y[1]! * y[1]!],
      [0, 0, 0],
      0,
      1,
      2000,
    ) as [number, number, number];
    const fall = linearDragFall({ mass: 2, b: 4, t: 1 });
    expect(Math.abs(v - fall.v)).toBeLessThan(1e-6);
    expect(Math.abs(x - fall.x)).toBeLessThan(1e-6);
    expect(v).toBeCloseTo(4.2412, 4);
    expect(x).toBeCloseTo(2.7844, 4);
    // енергийна сверка: m·g·x − ∫b·v² dt = ½·m·v²
    // 19,62 · 2,7844 = 54,630 J; ½ · 2 · 4,2412² = 17,988 J; разликата 36,642 J е отнета от средата
    expect(weight(2) * x - dragWork).toBeCloseTo(0.5 * 2 * v * v, 6);
    expect(0.5 * 2 * fall.v ** 2).toBeCloseTo(17.988, 3);
    expect(dragWork).toBeCloseTo(36.642, 2);
  });

  it("слабо съпротивление → свободно падане", () => {
    // b → 0: v ≈ g·t, x ≈ g·t²/2
    const fall = linearDragFall({ mass: 2, b: 1e-6, t: 1 });
    expect(fall.v).toBeCloseTo(9.81, 5);
    expect(fall.x).toBeCloseTo(4.905, 5);
  });

  it("„Провери се“ (Подробно) 3: v∞ = 0,5 · 9,81/2,5 = 1,962 m/s", () => {
    expect(linearDragFall({ mass: 0.5, b: 2.5, t: 0 }).vTerminal).toBeCloseTo(
      1.962,
      10,
    );
  });

  it("невалиден вход", () => {
    expect(() => linearDragFall({ mass: 2, b: 0, t: 1 })).toThrow();
    expect(() => linearDragFall({ mass: 2, b: 4, t: -1 })).toThrow();
    expect(() =>
      timeToTerminalFraction({ mass: 2, b: 4, fraction: 1 }),
    ).toThrow();
  });
});

describe("Пример П3 – автомобил 1200 kg с 15 m/s по крива с ρ = 50 m", () => {
  const crest = curveNormalReaction({
    mass: 1200,
    v: 15,
    rho: 50,
    kind: "crest",
  });
  const valley = curveNormalReaction({
    mass: 1200,
    v: 15,
    rho: 50,
    kind: "valley",
  });

  it("реакции на върха и на дъното", () => {
    // v²/ρ = 225/50 = 4,5 m/s²; G = 11 772 N
    // връх: N = 1200 · (9,81 − 4,5) = 1200 · 5,31 = 6372 N
    expect(crest).toBeCloseTo(6372, 8);
    // дъно: N = 1200 · (9,81 + 4,5) = 1200 · 14,31 = 17 172 N
    expect(valley).toBeCloseTo(17172, 8);
    // сборът е 2G = 23 544 N
    expect(crest + valley).toBeCloseTo(2 * weight(1200), 8);
  });

  it("m·a_n = ΣF_n към центъра на кривината", () => {
    // връх (центърът е отдолу): G − N = 11 772 − 6372 = 5400 = 1200 · 4,5
    expect(weight(1200) - crest).toBeCloseTo(1200 * 4.5, 8);
    // дъно (центърът е отгоре): N − G = 17 172 − 11 772 = 5400
    expect(valley - weight(1200)).toBeCloseTo(1200 * 4.5, 8);
    // принцип на Даламбер на върха: Φ = m·v²/ρ = 5400 N нагоре; N + Φ − G = 0
    expect(crest + 5400 - weight(1200)).toBeCloseTo(0, 8);
  });

  it("отлепване на върха", () => {
    // v = √(9,81 · 50) = √490,5 = 22,15 m/s = 79,7 km/h
    expect(liftOffSpeed(50)).toBeCloseTo(22.15, 2);
    expect(liftOffSpeed(50) * 3.6).toBeCloseTo(79.7, 1);
    expect(
      curveNormalReaction({
        mass: 1200,
        v: liftOffSpeed(50),
        rho: 50,
        kind: "crest",
      }),
    ).toBeCloseTo(0, 8);
  });

  it("гранични случаи: покой и много голям радиус дават N = G", () => {
    expect(
      curveNormalReaction({ mass: 1200, v: 0, rho: 50, kind: "crest" }),
    ).toBeCloseTo(11772, 8);
    expect(
      curveNormalReaction({ mass: 1200, v: 15, rho: 1e12, kind: "valley" }),
    ).toBeCloseTo(11772, 5);
    expect(() =>
      curveNormalReaction({ mass: 1200, v: 15, rho: 0, kind: "crest" }),
    ).toThrow();
  });

  it("„Провери се“ (Подробно) 4: хоризонтален завой, ρ = 80 m, μ = 0,6", () => {
    // v = √(0,6 · 9,81 · 80) = √470,88 = 21,7 m/s = 78,1 km/h
    const v = maxFlatCurveSpeed({ rho: 80, mu: 0.6 });
    expect(v).toBeCloseTo(21.7, 2);
    expect(v * 3.6).toBeCloseTo(78.1, 1);
    // при тази скорост нужната сила m·v²/ρ е точно μ·m·g
    expect((1000 * v * v) / 80).toBeCloseTo(0.6 * weight(1000), 8);
    // без триене завой не може да се вземе
    expect(maxFlatCurveSpeed({ rho: 80, mu: 0 })).toBe(0);
  });
});

describe("Пример П4 – математично махало, l = 1 m, m = 0,5 kg, φ0 = 60°", () => {
  const period = pendulumPeriod({ length: 1, amplitudeDeg: 60 });

  it("период – приблизително и точно решение", () => {
    // T0 = 2π·√(1/9,81) = 6,28319 · 0,319275 = 2,0061 s
    expect(period.small).toBeCloseTo(2.0061, 4);
    // τ = T0/AGM(1; cos 30°) = 2,0061 · 1,07318 = 2,1529 s – със 7,3 % по-дълъг
    expect(period.ratio).toBeCloseTo(1.0732, 4);
    expect(period.exact).toBeCloseTo(2.1529, 4);
    expect(2.006 * 1.0732).toBeCloseTo(2.153, 3);
    // редът: φ0 = 1,0472 rad; φ0²/16 = 0,0685; 11·φ0⁴/3072 = 0,0043;
    // 1 + 0,0685 + 0,0043 = 1,0728; 2,006 · 1,0728 = 2,152 s
    expect(60 * RAD).toBeCloseTo(1.0472, 4);
    expect((60 * RAD) ** 2 / 16).toBeCloseTo(0.0685, 4);
    expect((11 * (60 * RAD) ** 4) / 3072).toBeCloseTo(0.0043, 4);
    expect(period.series).toBeCloseTo(2.152, 3);
    expect(2.006 * 1.0728).toBeCloseTo(2.152, 3);
  });

  it("таблицата τ/T0 по амплитуди", () => {
    const ratio = (deg: number) =>
      pendulumPeriod({ length: 1, amplitudeDeg: deg }).ratio;
    expect(ratio(5)).toBeCloseTo(1.0005, 4);
    expect(ratio(10)).toBeCloseTo(1.0019, 4);
    expect(ratio(20)).toBeCloseTo(1.0077, 4);
    expect(ratio(30)).toBeCloseTo(1.0174, 4);
    expect(ratio(45)).toBeCloseTo(1.04, 4);
    expect(ratio(60)).toBeCloseTo(1.0732, 4);
    expect(ratio(90)).toBeCloseTo(1.18034, 5);
    // гранични случаи: нулева амплитуда; отношението не зависи от дължината
    expect(ratio(0)).toBe(1);
    expect(pendulumPeriod({ length: 7, amplitudeDeg: 60 }).ratio).toBeCloseTo(
      ratio(60),
      12,
    );
  });

  it("точният период – независимо, с числено интегриране на елиптичния интеграл", () => {
    // τ = 4·√(l/g)·K(k), K(k) = ∫0..π/2 dψ/√(1 − k²·sin²ψ), k = sin 30° = 0,5
    const k = Math.sin(30 * RAD);
    const n = 2000;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const psi = ((i + 0.5) * Math.PI) / (2 * n);
      sum += 1 / Math.sqrt(1 - k * k * Math.sin(psi) ** 2);
    }
    const K = (sum * Math.PI) / (2 * n);
    expect(4 * Math.sqrt(1 / g) * K).toBeCloseTo(period.exact, 9);
  });

  it("Рунге–Кута на φ'' = −(g/l)·sin φ: четвърт период и скорост в най-ниската точка", () => {
    // интегриране точно за τ/4: махалото трябва да е в отвеса (φ = 0)
    const [phi, omega] = rk4(
      (_t, y) => [y[1]!, -(9.81 / 1) * Math.sin(y[0]!)],
      [Math.PI / 3, 0],
      0,
      period.exact / 4,
      5000,
    ) as [number, number];
    expect(phi).toBeCloseTo(0, 8);
    // ъглова скорост там: √(2·g/l·(1 − cos 60°)) = √9,81 = 3,1321 rad/s (по часовниковата стрелка)
    expect(omega).toBeCloseTo(-3.1321, 4);
    // след цял период махалото се връща в началното положение в покой
    const [phiEnd, omegaEnd] = rk4(
      (_t, y) => [y[1]!, -9.81 * Math.sin(y[0]!)],
      [Math.PI / 3, 0],
      0,
      period.exact,
      20000,
    ) as [number, number];
    expect(phiEnd).toBeCloseTo(Math.PI / 3, 7);
    expect(omegaEnd).toBeCloseTo(0, 6);
    // за сравнение: по приблизителния период T0 то още не се е върнало
    const [phiSmall] = rk4(
      (_t, y) => [y[1]!, -9.81 * Math.sin(y[0]!)],
      [Math.PI / 3, 0],
      0,
      period.small,
      20000,
    ) as [number, number];
    expect(phiSmall).toBeLessThan(Math.PI / 3 - 0.05);
  });

  it("скорост и сила в нишката в най-ниската точка", () => {
    const low = pendulumState({ mass: 0.5, length: 1, phi0Deg: 60, phiDeg: 0 });
    // v = √(2 · 9,81 · 1 · (1 − 0,5)) = √9,81 = 3,132 m/s
    expect(low.v).toBeCloseTo(3.1321, 4);
    // S = m·g·(3 − 2·cos 60°) = 2·m·g = 2 · 4,905 = 9,81 N
    expect(low.tension).toBeCloseTo(9.81, 10);
    // по нормалата: m·v²/l = S − m·g → S = 0,5 · (9,81 + 9,81) = 9,81 N
    expect(0.5 * (g + low.v ** 2 / 1)).toBeCloseTo(low.tension, 10);
  });

  it("m·a = ΣF по естествените оси в няколко положения", () => {
    for (const phiDeg of [50, 30, 10, -20, -45]) {
      const state = pendulumState({
        mass: 0.5,
        length: 1,
        phi0Deg: 60,
        phiDeg,
      });
      // нормала: m·v²/l = S − m·g·cos φ
      expect((0.5 * state.v ** 2) / 1).toBeCloseTo(
        state.tension - weight(0.5) * Math.cos(phiDeg * RAD),
        10,
      );
      // допирателна: m·l·φ'' = −m·g·sin φ; φ'' от първия интеграл
      // φ'² = (2g/l)(cos φ − cos φ0) → φ'' = d(φ'²/2)/dφ, числено
      const half = (deg: number) =>
        pendulumState({ mass: 0.5, length: 1, phi0Deg: 60, phiDeg: deg })
          .omega **
          2 /
        2;
      const h = 1e-3;
      const epsilon = (half(phiDeg + h) - half(phiDeg - h)) / (2 * h * RAD);
      expect(0.5 * 1 * epsilon).toBeCloseTo(
        -weight(0.5) * Math.sin(phiDeg * RAD),
        6,
      );
    }
  });

  it("енергийна сверка: работата на теглото = кинетичната енергия", () => {
    // слизане h = l·(cos φ − cos φ0); при φ = 0: 0,5 m; m·g·h = 4,905 · 0,5 = 2,4525 J
    const low = pendulumState({ mass: 0.5, length: 1, phi0Deg: 60, phiDeg: 0 });
    expect(0.5 * 0.5 * low.v ** 2).toBeCloseTo(2.4525, 10);
    const mid = pendulumState({
      mass: 0.5,
      length: 1,
      phi0Deg: 60,
      phiDeg: 30,
    });
    expect(0.5 * 0.5 * mid.v ** 2).toBeCloseTo(
      weight(0.5) * (Math.cos(30 * RAD) - 0.5),
      10,
    );
  });

  it("гранични случаи на махалото", () => {
    // в крайното положение: v = 0, S = m·g·cos φ0 = 4,905 · 0,5 = 2,4525 N
    const top = pendulumState({
      mass: 0.5,
      length: 1,
      phi0Deg: 60,
      phiDeg: 60,
    });
    expect(top.v).toBe(0);
    expect(top.tension).toBeCloseTo(2.4525, 10);
    // нулева амплитуда: махалото виси, S = G
    const rest = pendulumState({ mass: 0.5, length: 1, phi0Deg: 0, phiDeg: 0 });
    expect(rest.v).toBe(0);
    expect(rest.tension).toBeCloseTo(4.905, 10);
    // малка амплитуда: приблизителното решение φ = φ0·cos(k·t) удовлетворява φ'' = −k²·φ
    const k = Math.sqrt(g / 1);
    const law = (t: number) => 0.05 * Math.cos(k * t);
    for (const t of [0.1, 0.4, 1.3]) {
      expect(secondDerivative(law, t, 1e-4)).toBeCloseTo(-k * k * law(t), 5);
    }
    expect(() =>
      pendulumState({ mass: 0.5, length: 1, phi0Deg: 60, phiDeg: 70 }),
    ).toThrow();
    expect(() => pendulumPeriod({ length: 1, amplitudeDeg: 180 })).toThrow();
    expect(() => pendulumPeriod({ length: 0 })).toThrow();
  });

  it("„В реалния живот“ и „Провери се“", () => {
    // товар на въже 20 m: T0 = 2π·√(20/9,81) = 6,28319 · 1,42784 = 8,97 s
    expect(pendulumPeriod({ length: 20 }).small).toBeCloseTo(8.9714, 4);
    // Леко 4: четири пъти по-дълго махало → два пъти по-дълъг период
    expect(
      pendulumPeriod({ length: 4 }).small / pendulumPeriod({ length: 1 }).small,
    ).toBeCloseTo(2, 12);
    // Подробно 5: k = √(200/2) = 10 rad/s; период 2π/10 = 0,628 s
    const spring = springOscillation({ mass: 2, c: 200 });
    expect(spring.k).toBeCloseTo(10, 12);
    expect(spring.period).toBeCloseTo(0.628, 3);
    // x = cos(k·t) удовлетворява m·x'' = −c·x
    const law = (t: number) => 0.03 * Math.cos(spring.k * t);
    expect(2 * secondDerivative(law, 0.2, 1e-4)).toBeCloseTo(
      -200 * law(0.2),
      4,
    );
  });
});
