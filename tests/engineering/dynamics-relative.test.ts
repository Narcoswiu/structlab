import { describe, expect, it } from "vitest";
import {
  G,
  centrifugalForce,
  horizontalCoriolis,
  inclineOnAcceleratingPlatform,
  inertiaForces,
  minFrictionCoefficient,
  pendulumInAcceleratingFrame,
  pendulumPeriodInLift,
  plumbDeviation,
  plumbDeviationExact,
  radPerSecToRpm,
  rotatingTubeBead,
  rotatingTubePosition,
  rotatingTubeState,
  slideFromRest,
  turntableMaxOmega,
  type Vec2,
} from "@/lib/engineering/dynamics-relative";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Единици: m, s, kg, N, rad. Знаци: x надясно, y нагоре, ω_e > 0 обратно на
// часовниковата стрелка. Φ_e = −m·a_e, Φ_c = −2m·ω_e × v_r.

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Класически метод на Рунге–Кута от четвърти ред за y' = f(t, y). */
function rk4(
  f: (t: number, y: number[]) => number[],
  y0: number[],
  t0: number,
  t1: number,
  steps: number,
): number[] {
  const h = (t1 - t0) / steps;
  let y = [...y0];
  let t = t0;
  const add = (a: number[], b: number[], k: number) =>
    a.map((value, i) => value + k * b[i]!);
  for (let i = 0; i < steps; i += 1) {
    const k1 = f(t, y);
    const k2 = f(t + h / 2, add(y, k1, h / 2));
    const k3 = f(t + h / 2, add(y, k2, h / 2));
    const k4 = f(t + h, add(y, k3, h));
    y = y.map(
      (value, j) =>
        value + (h / 6) * (k1[j]! + 2 * k2[j]! + 2 * k3[j]! + k4[j]!),
    );
    t += h;
  }
  return y;
}

/** Константи на Земята – „дадено“ в примери П3 и П4. */
const EARTH = { omega: 7.292e-5, R: 6.371e6 };

describe("inertiaForces – преносна и Кориолисова инерционна сила", () => {
  it("въпрос Л-1: автобус спира със закъснение 3 m/s², пътник 60 kg", () => {
    // автобусът се движи надясно и спира: a_e = (−3; 0)
    // Φ_e = −60·(−3) = +180 N – напред
    const { phiE, phiC } = inertiaForces({
      mass: 60,
      aE: { x: -3, y: 0 },
      omegaE: 0,
      vR: { x: 0, y: 0 },
    });
    expect(phiE).toEqual({ x: 180, y: 0 });
    expect(phiC).toEqual({ x: 0, y: 0 });
  });

  it("въпрос П-4: m = 2 kg, v_r = 3 m/s, ω_e = 4 rad/s", () => {
    // Φ_c = 2·2·4·3 = 48 N; v_r по +x, въртене обратно на часовниковата ⇒
    // v_r, завъртян на 90° по часовниковата (срещу въртенето): по −y
    const { phiC } = inertiaForces({
      mass: 2,
      aE: { x: 0, y: 0 },
      omegaE: 4,
      vR: { x: 3, y: 0 },
    });
    expect(phiC).toEqual({ x: 0, y: -48 });
    expect(Math.hypot(phiC.x, phiC.y)).toBe(48);
  });

  it("Φ_c е перпендикулярна на v_r и сменя посоката си със знака на ω_e", () => {
    const vR = { x: 1.2, y: -0.7 };
    const plus = inertiaForces({
      mass: 3,
      aE: { x: 0, y: 0 },
      omegaE: 2,
      vR,
    }).phiC;
    const minus = inertiaForces({
      mass: 3,
      aE: { x: 0, y: 0 },
      omegaE: -2,
      vR,
    }).phiC;
    expect(plus.x * vR.x + plus.y * vR.y).toBeCloseTo(0, 12);
    expect(minus.x).toBeCloseTo(-plus.x, 12);
    expect(minus.y).toBeCloseTo(-plus.y, 12);
    // големина 2·3·2·√(1,44 + 0,49) = 12·1,38924 = 16,671 N
    expect(Math.hypot(plus.x, plus.y)).toBeCloseTo(16.671, 3);
  });

  it("кулокранът: центробежна 180 N навън, Кориолисова 192 N напречно", () => {
    // товар 2000 kg на 25 m по +x, ω_e = 0,06 rad/s, количката навън с 0,8 m/s
    // a_e = −ω²·r = −0,0036·25 = −0,09 m/s² (към оста) ⇒ Φ_e = +180 N (навън)
    // Φ_c = 2·2000·0,06·0,8 = 192 N, по −y (срещу въртенето)
    const { phiE, phiC } = inertiaForces({
      mass: 2000,
      aE: { x: -(0.06 ** 2) * 25, y: 0 },
      omegaE: 0.06,
      vR: { x: 0.8, y: 0 },
    });
    expect(phiE.x).toBeCloseTo(180, 9);
    expect(phiE.y).toBe(0);
    expect(phiC.x).toBe(0);
    expect(phiC.y).toBeCloseTo(-192, 9);
    expect(centrifugalForce({ mass: 2000, omega: 0.06, r: 25 })).toBeCloseTo(
      180,
      9,
    );
    // Кориолисово ускорение 2·0,06·0,8 = 0,096 m/s²; тегло 2000·9,81 = 19 620 N
    expect(-phiC.y / 2000).toBeCloseTo(0.096, 12);
    expect(2000 * G).toBeCloseTo(19620, 9);
  });

  it("граничен случай: без преносно ускорение и въртене няма инерционни сили", () => {
    const { phiE, phiC } = inertiaForces({
      mass: 5,
      aE: { x: 0, y: 0 },
      omegaE: 0,
      vR: { x: 4, y: -2 },
    });
    expect(phiE).toEqual({ x: 0, y: 0 });
    expect(phiC).toEqual({ x: 0, y: 0 });
  });

  it("свободна частица: движението в подвижната система, върнато в неподвижната, е праволинейно и равномерно", () => {
    // В неподвижната система няма сили: X(t) = X0 + V·t.
    // В система, въртяща се с ω_e = 0,5 rad/s около O, действат само
    // Φ_e (a_e = −ω²·r′) и Φ_c. Интегрираме РЕЛАТИВНОТО уравнение с РК4 и
    // сравняваме с правата линия, завъртяна на −ω·t.
    const omega = 0.5;
    const X0 = { x: 1, y: 0 };
    const V = { x: 0.8, y: 0.3 };
    // начална релативна скорост: v_r = V − ω × r = (0,8 + 0,5·0; 0,3 − 0,5·1)
    const start = [X0.x, X0.y, V.x + omega * X0.y, V.y - omega * X0.x];
    const T = 3;
    const end = rk4(
      (_t, [x, y, vx, vy]) => {
        const { phiE, phiC } = inertiaForces({
          mass: 1,
          aE: { x: -(omega ** 2) * x!, y: -(omega ** 2) * y! },
          omegaE: omega,
          vR: { x: vx!, y: vy! },
        });
        return [vx!, vy!, phiE.x + phiC.x, phiE.y + phiC.y];
      },
      start,
      0,
      T,
      3000,
    );
    const X = { x: X0.x + V.x * T, y: X0.y + V.y * T }; // (3,4; 0,9)
    const c = Math.cos(omega * T);
    const s = Math.sin(omega * T);
    expect(end[0]).toBeCloseTo(c * X.x + s * X.y, 8);
    expect(end[1]).toBeCloseTo(-s * X.x + c * X.y, 8);
  });

  it("отхвърля невалиден вход", () => {
    const zero = { x: 0, y: 0 };
    expect(() =>
      inertiaForces({ mass: 0, aE: zero, omegaE: 1, vR: zero }),
    ).toThrow();
    expect(() =>
      inertiaForces({ mass: 1, aE: zero, omegaE: Number.NaN, vR: zero }),
    ).toThrow();
    expect(() => centrifugalForce({ mass: 1, omega: 1, r: -1 })).toThrow();
  });
});

describe("Пример Л1 – махало в ускоряващ автобус", () => {
  // m = 0,5 kg, a_e = 2 m/s²
  // G = 0,5·9,81 = 4,905 N; Φ_e = 0,5·2 = 1,0 N
  // tg θ = 2/9,81 = 0,20387 ⇒ θ = 11,5232°
  // S = √(4,905² + 1,0²) = √(24,059 + 1) = √25,059 = 5,0059 N
  const rest = pendulumInAcceleratingFrame({ mass: 0.5, aE: 2 });

  it("ъгъл 11,52° и сила в нишката 5,006 N", () => {
    expect(0.5 * G).toBeCloseTo(4.905, 12);
    expect(2 / G).toBeCloseTo(0.2039, 4);
    expect(rest.thetaDeg).toBeCloseTo(11.5232, 4);
    expect(rest.tension).toBeCloseTo(5.0059, 4);
    expect(Math.sqrt(4.905 ** 2 + 1.0 ** 2)).toBeCloseTo(5.006, 3);
  });

  it("релативен покой, заместен обратно: ΣF + Φ_e = 0", () => {
    const theta = rad(rest.thetaDeg);
    // хоризонтално: S·sin θ − Φ_e = 0; вертикално: S·cos θ − G = 0
    expect(rest.tension * Math.sin(theta) - 0.5 * 2).toBeCloseTo(0, 12);
    expect(rest.tension * Math.cos(theta) - 0.5 * G).toBeCloseTo(0, 12);
  });

  it("от пътя (без инерционни сили): m·a = S·sin θ, с печатаните закръглени числа", () => {
    // 5,006·sin 11,52° = 5,006·0,19971 = 1,000 N = 0,5·2
    // 5,006·cos 11,52° = 5,006·0,97986 = 4,905 N = G
    expect(5.006 * Math.sin(rad(11.52))).toBeCloseTo(1.0, 3);
    expect(5.006 * Math.cos(rad(11.52))).toBeCloseTo(4.905, 3);
  });

  it("въпрос Л-2: при a_e = g ъгълът е 45°", () => {
    // tg θ = 9,81/9,81 = 1
    expect(
      pendulumInAcceleratingFrame({ mass: 1, aE: G }).thetaDeg,
    ).toBeCloseTo(45, 12);
  });

  it("граничен случай a_e = 0: нишката е отвесна и S = m·g", () => {
    const still = pendulumInAcceleratingFrame({ mass: 0.5, aE: 0 });
    expect(still.thetaDeg).toBe(0);
    expect(still.tension).toBeCloseTo(4.905, 12);
  });

  it("отхвърля невалиден вход", () => {
    expect(() => pendulumInAcceleratingFrame({ mass: -1, aE: 2 })).toThrow();
    expect(() => pendulumInAcceleratingFrame({ mass: 1, aE: -2 })).toThrow();
  });
});

describe("pendulumPeriodInLift – въпрос П-1", () => {
  it("асансьор с ускорение 3 m/s² надолу, l = 1 m", () => {
    // g′ = 9,81 − 3 = 6,81 m/s²; T₀ = 2π·√(1/6,81) = 6,28319·0,38320 = 2,408 s
    expect(pendulumPeriodInLift({ length: 1, aUp: -3 })).toBeCloseTo(2.408, 3);
  });

  it("граничен случай a_e = 0: T₀ = 2π·√(l/g) = 2,006 s", () => {
    // 6,28319/√9,81 = 6,28319/3,13209 = 2,0061 s
    expect(pendulumPeriodInLift({ length: 1, aUp: 0 })).toBeCloseTo(2.0061, 4);
    expect(pendulumPeriodInLift({ length: 1, aUp: 0 })).toBeCloseTo(
      2 * Math.PI * Math.sqrt(1 / G),
      12,
    );
  });

  it("независима проверка с РК4: период на малки трептения при g′ = 6,81", () => {
    // θ″ = −(g′/l)·sin θ, θ(0) = 0,01 rad, θ′(0) = 0. След един период
    // махалото се връща в началното положение със скорост нула.
    const period = pendulumPeriodInLift({ length: 1, aUp: -3 });
    const [theta, thetaDot] = rk4(
      (_t, [th, om]) => [om!, -(G - 3) * Math.sin(th!)],
      [0.01, 0],
      0,
      period,
      4000,
    );
    expect(theta).toBeCloseTo(0.01, 6);
    expect(thetaDot).toBeCloseTo(0, 5);
  });

  it("свободно падащ асансьор: грешка", () => {
    expect(() => pendulumPeriodInLift({ length: 1, aUp: -G })).toThrow();
    expect(() => pendulumPeriodInLift({ length: 0, aUp: 0 })).toThrow();
  });
});

describe("Пример Л2 – тяло върху въртяща се платформа", () => {
  it("ω_max = 1,617 rad/s = 15,45 min⁻¹", () => {
    // ω = √(0,4·9,81/1,5) = √2,616 = 1,6174 rad/s
    // n = 30·1,6174/π = 15,445 min⁻¹
    const omega = turntableMaxOmega({ r: 1.5, mu: 0.4 });
    expect((0.4 * G) / 1.5).toBeCloseTo(2.616, 12);
    expect(omega).toBeCloseTo(1.6174, 4);
    expect(radPerSecToRpm(omega)).toBeCloseTo(15.445, 3);
    // с печатаната закръглена стойност: 30·1,617/π = 15,44… ≈ 15,4
    expect(radPerSecToRpm(1.617)).toBeCloseTo(15.44, 2);
  });

  it("релативен покой, заместен обратно: m·ω²·r = μ·m·g на границата", () => {
    const omega = turntableMaxOmega({ r: 1.5, mu: 0.4 });
    // 5·2,616·1,5 = 19,62 N = 0,4·5·9,81
    expect(centrifugalForce({ mass: 5, omega, r: 1.5 })).toBeCloseTo(19.62, 10);
    expect(0.4 * 5 * G).toBeCloseTo(19.62, 12);
  });

  it("при ω_e = 1 rad/s нужното триене е 7,5 N < 19,62 N", () => {
    // 5·1²·1,5 = 7,5 N
    expect(centrifugalForce({ mass: 5, omega: 1, r: 1.5 })).toBe(7.5);
  });

  it("въпрос Л-4: 3 kg на 0,5 m при 2 rad/s – 6 N", () => {
    // 3·2²·0,5 = 6 N
    expect(centrifugalForce({ mass: 3, omega: 2, r: 0.5 })).toBe(6);
  });

  it("от земята: центростремителната сила m·v²/r е същото число", () => {
    // v = ω·r = 1·1,5 = 1,5 m/s; 5·1,5²/1,5 = 7,5 N
    const v = 1 * 1.5;
    expect((5 * v ** 2) / 1.5).toBe(7.5);
  });

  it("отхвърля невалиден вход", () => {
    expect(() => turntableMaxOmega({ r: 0, mu: 0.4 })).toThrow();
    expect(() => turntableMaxOmega({ r: 1, mu: -0.1 })).toThrow();
  });
});

describe("Пример П1 – гладък наклон върху ускоряваща се платформа", () => {
  // α = 20° (изкачва се надясно), a_e = 2 m/s² наляво (към ниския край), m = 10 kg
  // sin 20° = 0,34202; cos 20° = 0,93969
  // a_r = 9,81·0,34202 − 2·0,93969 = 3,355 − 1,879 = 1,476 m/s²
  // N = 10·(9,81·0,93969 + 2·0,34202) = 10·(9,218 + 0,684) = 99,02 N
  // a_e за релативен покой: 9,81·tg 20° = 9,81·0,36397 = 3,571 m/s²
  const alpha = rad(20);
  const result = inclineOnAcceleratingPlatform({
    mass: 10,
    angleDeg: 20,
    aE: 2,
  });

  it("релативно ускорение, реакция и ускорение за релативен покой", () => {
    expect(Math.sin(alpha)).toBeCloseTo(0.34202, 5);
    expect(Math.cos(alpha)).toBeCloseTo(0.93969, 5);
    expect(G * Math.sin(alpha)).toBeCloseTo(3.355, 3);
    expect(2 * Math.cos(alpha)).toBeCloseTo(1.879, 3);
    expect(result.aR).toBeCloseTo(1.4758, 4);
    expect(3.355 - 1.879).toBeCloseTo(1.476, 10);
    expect(G * Math.cos(alpha)).toBeCloseTo(9.218, 3);
    expect(2 * Math.sin(alpha)).toBeCloseTo(0.684, 3);
    expect(result.normal).toBeCloseTo(99.024, 3);
    expect(10 * (9.218 + 0.684)).toBeCloseTo(99.02, 10);
    expect(result.aERest).toBeCloseTo(3.5705, 4);
  });

  it("време и релативна скорост след 1,5 m", () => {
    // t = √(2·1,5/1,476) = √2,0325 = 1,426 s; v_r = √(2·1,476·1,5) = √4,428 = 2,104 m/s
    const exact = slideFromRest({ aR: result.aR, distance: 1.5 });
    expect(exact.time).toBeCloseTo(1.4257, 4);
    expect(exact.speed).toBeCloseTo(2.1042, 3);
    const printed = slideFromRest({ aR: 1.476, distance: 1.5 });
    expect(printed.time).toBeCloseTo(1.426, 3);
    expect(printed.speed).toBeCloseTo(2.104, 3);
  });

  it("в неподвижната система важи m·a_a = N + G (без инерционни сили)", () => {
    // a_a = a_e + a_r = (−2 − 1,476·0,93969; −1,476·0,34202) = (−3,387; −0,505)
    // по x: −99,02·0,34202 = −33,87 N = 10·(−3,387)
    // по y: 99,02·0,93969 − 98,1 = −5,05 N = 10·(−0,505)
    const aAx = -2 - result.aR * Math.cos(alpha);
    const aAy = -result.aR * Math.sin(alpha);
    expect(aAx).toBeCloseTo(-3.387, 3);
    expect(aAy).toBeCloseTo(-0.505, 3);
    expect(-result.normal * Math.sin(alpha)).toBeCloseTo(10 * aAx, 10);
    expect(result.normal * Math.cos(alpha) - 10 * G).toBeCloseTo(10 * aAy, 10);
    // с печатаните закръглени числа
    expect(-99.02 * 0.34202).toBeCloseTo(-33.87, 2);
    expect(99.02 * 0.93969 - 98.1).toBeCloseTo(-5.05, 2);
    expect(-2 - 1.476 * 0.93969).toBeCloseTo(-3.387, 3);
    expect(-1.476 * 0.34202).toBeCloseTo(-0.505, 3);
  });

  it("независимо РК4 в неподвижната система възпроизвежда релативното движение", () => {
    // Действат само N (по нормалата (−sin α; cos α)) и G. Платформата се
    // премества с −½·2·t². Релативното преместване трябва да е 1,5 m по
    // наклона надолу: (−1,5·cos 20°; −1,5·sin 20°) = (−1,4095; −0,5130) m.
    const { time } = slideFromRest({ aR: result.aR, distance: 1.5 });
    const fx = -result.normal * Math.sin(alpha);
    const fy = result.normal * Math.cos(alpha) - 10 * G;
    const [x, y] = rk4(
      (_t, [, , vx, vy]) => [vx!, vy!, fx / 10, fy / 10],
      [0, 0, 0, 0],
      0,
      time,
      2000,
    );
    const rel = { x: x! + 0.5 * 2 * time ** 2, y: y! };
    expect(rel.x).toBeCloseTo(-1.4095, 4);
    expect(rel.y).toBeCloseTo(-0.513, 4);
    expect(Math.hypot(rel.x, rel.y)).toBeCloseTo(1.5, 9);
    expect((Math.atan2(-rel.y, -rel.x) * 180) / Math.PI).toBeCloseTo(20, 8);
  });

  it("релативен покой при a_e = g·tg α; въпрос П-3 (α = 30°): 5,66 m/s²", () => {
    const rest = inclineOnAcceleratingPlatform({
      mass: 10,
      angleDeg: 20,
      aE: result.aERest,
    });
    expect(rest.aR).toBeCloseTo(0, 12);
    // тогава N = m·g/cos α = 98,1/0,93969 = 104,40 N
    expect(rest.normal).toBeCloseTo(104.4, 1);
    // 9,81·tg 30° = 9,81·0,57735 = 5,664 m/s²
    expect(
      inclineOnAcceleratingPlatform({ mass: 1, angleDeg: 30, aE: 0 }).aERest,
    ).toBeCloseTo(5.664, 3);
  });

  it("граничен случай a_e = 0: a_r = g·sin α, N = m·g·cos α (абсолютното движение)", () => {
    const fixed = inclineOnAcceleratingPlatform({
      mass: 10,
      angleDeg: 20,
      aE: 0,
    });
    expect(fixed.aR).toBeCloseTo(G * Math.sin(alpha), 12);
    expect(fixed.normal).toBeCloseTo(10 * G * Math.cos(alpha), 12);
  });

  it("отхвърля невалиден вход и отделяне от наклона", () => {
    expect(() =>
      inclineOnAcceleratingPlatform({ mass: 10, angleDeg: 0, aE: 2 }),
    ).toThrow();
    expect(() =>
      inclineOnAcceleratingPlatform({ mass: 10, angleDeg: 90, aE: 2 }),
    ).toThrow();
    // a_e = −30 m/s²: g·cos α + a_e·sin α = 9,218 − 10,26 < 0
    expect(() =>
      inclineOnAcceleratingPlatform({ mass: 10, angleDeg: 20, aE: -30 }),
    ).toThrow();
    expect(() => slideFromRest({ aR: 0, distance: 1 })).toThrow();
  });
});

describe("Пример П2 – частица във въртяща се тръба", () => {
  // ω_e = 2 rad/s, m = 0,2 kg, r₀ = 0,3 m, l = 1,2 m
  // ch(2t) = 1,2/0,3 = 4 ⇒ 2t = ln(4 + √15) = ln 7,87298 = 2,0634 ⇒ t = 1,0317 s
  // ṙ = 2·√(1,44 − 0,09) = 2·1,16190 = 2,3238 m/s
  // N = 2·0,2·2·2,324 = 1,859 N
  // v_e = 2·1,2 = 2,4 m/s; v_a = √(2,324² + 2,4²) = √(5,401 + 5,76) = 3,341 m/s
  const m = 0.2;
  const omega = 2;
  const r0 = 0.3;
  const exit = rotatingTubeBead({ mass: m, omega, r0, length: 1.2 });

  it("време, скорости и реакция на изхода", () => {
    expect(Math.log(4 + Math.sqrt(15))).toBeCloseTo(2.0634, 4);
    expect(exit.exitTime).toBeCloseTo(1.0317, 4);
    expect(exit.rDotExit).toBeCloseTo(2.3238, 4);
    expect(exit.wallForceExit).toBeCloseTo(1.859, 3);
    expect(2 * 0.2 * 2 * 2.324).toBeCloseTo(1.859, 3);
    expect(exit.transportSpeedExit).toBeCloseTo(2.4, 12);
    expect(exit.absoluteSpeedExit).toBeCloseTo(3.3407, 4);
    expect(Math.sqrt(2.324 ** 2 + 2.4 ** 2)).toBeCloseTo(3.341, 3);
  });

  it("положение при t = 0,5 s и въпрос П-2", () => {
    // 0,3·ch 1 = 0,3·1,54308 = 0,4629 m
    expect(rotatingTubePosition({ omega: 2, r0: 0.3, t: 0.5 })).toBeCloseTo(
      0.4629,
      4,
    );
    // 0,2·ch 1,5 = 0,2·2,35241 = 0,4705 m
    expect(rotatingTubePosition({ omega: 3, r0: 0.2, t: 0.5 })).toBeCloseTo(
      0.4705,
      4,
    );
    expect(Math.cosh(1)).toBeCloseTo(1.543, 3);
    expect(Math.cosh(1.5)).toBeCloseTo(2.352, 3);
  });

  it("състоянието в момента на изхода съвпада с rotatingTubeBead", () => {
    const state = rotatingTubeState({
      mass: m,
      omega,
      r0,
      t: exit.exitTime,
    });
    expect(state.r).toBeCloseTo(1.2, 12);
    expect(state.rDot).toBeCloseTo(exit.rDotExit, 12);
    expect(state.wallForce).toBeCloseTo(exit.wallForceExit, 12);
    // ṙ = ω·√(r² − r₀²) във всеки момент
    const mid = rotatingTubeState({ mass: m, omega, r0, t: 0.7 });
    expect(mid.rDot).toBeCloseTo(omega * Math.sqrt(mid.r ** 2 - r0 ** 2), 12);
  });

  it("РК4 на релативното уравнение r″ = ω²·r", () => {
    const [r, rDot] = rk4(
      (_t, [rr, vv]) => [vv!, omega ** 2 * rr!],
      [r0, 0],
      0,
      exit.exitTime,
      2000,
    );
    expect(r).toBeCloseTo(1.2, 9);
    expect(rDot).toBeCloseTo(2.3238, 4);
  });

  it("релативното движение, пренесено в неподвижната система, удовлетворява m·a = N там", () => {
    // Абсолютно положение: X(t) = r₀·ch ωt·(cos ωt; sin ωt). Ускорението се
    // намира с числено диференциране; единствената хоризонтална сила е
    // реакцията N = 2m·ω·ṙ по напречната посока (−sin ωt; cos ωt).
    const pos = (t: number): Vec2 => {
      const r = rotatingTubePosition({ omega, r0, t });
      return { x: r * Math.cos(omega * t), y: r * Math.sin(omega * t) };
    };
    const h = 1e-4;
    for (const t of [0.2, 0.5, 0.8, 1.0]) {
      const a = pos(t - h);
      const b = pos(t);
      const c = pos(t + h);
      const ax = (a.x - 2 * b.x + c.x) / h ** 2;
      const ay = (a.y - 2 * b.y + c.y) / h ** 2;
      const { wallForce } = rotatingTubeState({ mass: m, omega, r0, t });
      expect(m * ax).toBeCloseTo(-wallForce * Math.sin(omega * t), 5);
      expect(m * ay).toBeCloseTo(wallForce * Math.cos(omega * t), 5);
    }
  });

  it("независимо РК4 в неподвижни декартови оси: частицата остава в тръбата", () => {
    // Сила: само N·e_φ(t), N = 2m·ω·(v·e_r). Начало (0,3; 0), скорост
    // (0; ω·r₀) = (0; 0,6) m/s. На изхода: разстояние 1,2 m, скорост 3,3407 m/s,
    // полярен ъгъл ω·t = 2,0634 rad.
    const [x, y, vx, vy] = rk4(
      (t, [, , ux, uy]) => {
        const er = { x: Math.cos(omega * t), y: Math.sin(omega * t) };
        const ephi = { x: -er.y, y: er.x };
        const N = 2 * m * omega * (ux! * er.x + uy! * er.y);
        return [ux!, uy!, (N * ephi.x) / m, (N * ephi.y) / m];
      },
      [r0, 0, 0, omega * r0],
      0,
      exit.exitTime,
      4000,
    );
    expect(Math.hypot(x!, y!)).toBeCloseTo(1.2, 8);
    expect(Math.hypot(vx!, vy!)).toBeCloseTo(3.3407, 4);
    expect(Math.atan2(y!, x!)).toBeCloseTo(omega * exit.exitTime, 8);
    expect(Math.atan2(y!, x!)).toBeCloseTo(2.0634, 4);
  });

  it("енергийна проверка: работата на N е равна на изменението на ½·m·v²", () => {
    // A = m·ω²·(l² − r₀²) = 0,2·4·1,35 = 1,080 J
    // ΔT = 0,1·(3,341² − 0,6²) = 0,1·(11,16 − 0,36) = 1,080 J
    const work = m * omega ** 2 * (1.2 ** 2 - r0 ** 2);
    expect(work).toBeCloseTo(1.08, 12);
    expect(
      0.5 * m * (exit.absoluteSpeedExit ** 2 - (omega * r0) ** 2),
    ).toBeCloseTo(work, 12);
    expect(3.341 ** 2).toBeCloseTo(11.16, 2);
  });

  it("теглото е уравновесено от вертикалната реакция 1,962 N", () => {
    expect(m * G).toBeCloseTo(1.962, 12);
  });

  it("невалиден вход", () => {
    expect(() =>
      rotatingTubeBead({ mass: m, omega, r0: 0.3, length: 0.3 }),
    ).toThrow();
    expect(() =>
      rotatingTubeBead({ mass: m, omega, r0: 0.3, length: 0.2 }),
    ).toThrow();
    expect(() =>
      rotatingTubeBead({ mass: m, omega: 0, r0: 0.3, length: 1.2 }),
    ).toThrow();
    expect(() => rotatingTubePosition({ omega, r0, t: -1 })).toThrow();
  });
});

describe("Пример П3 – отклонение на отвеса", () => {
  // ω_e²R = (7,292·10⁻⁵)²·6,371·10⁶ = 5,3173·10⁻⁹·6,371·10⁶ = 0,033877 m/s²
  // sin 43°·cos 43° = ½·sin 86° = 0,49878
  // δ ≈ 0,033877·0,49878/9,81 = 0,016897/9,81 = 1,7224·10⁻³ rad
  //   = 0,0987° = 5,92′; на 100 m: 0,172 m
  const delta = plumbDeviation({ ...EARTH, latitudeDeg: 43 });

  it("δ = 1,722·10⁻³ rad = 0,0987° = 5,9′; 0,172 m на 100 m", () => {
    const w2R = EARTH.omega ** 2 * EARTH.R;
    expect(w2R).toBeCloseTo(0.033877, 6);
    expect(Math.sin(rad(43)) * Math.cos(rad(43))).toBeCloseTo(0.49878, 5);
    expect(0.033877 * 0.49878).toBeCloseTo(0.016897, 6);
    expect(delta * 1e3).toBeCloseTo(1.7224, 4);
    expect((0.016897 / 9.81) * 1e3).toBeCloseTo(1.722, 3);
    expect((1.722e-3 * 180) / Math.PI).toBeCloseTo(0.0987, 4);
    expect(0.0987 * 60).toBeCloseTo(5.92, 2);
    expect(100 * 1.722e-3).toBeCloseTo(0.172, 3);
    // ω_e²R/g = 0,033877/9,81 = 0,35 %
    expect((w2R / G) * 100).toBeCloseTo(0.35, 2);
  });

  it("точната формула с g₀ = 9,828 дава същите 5,92′; с g₀ = 9,81 – 5,93′", () => {
    // cos² 43° = 0,53488; g₀ ≈ 9,81 + 0,033877·0,53488 = 9,81 + 0,018 = 9,828
    // знаменател 9,828 − 0,018 = 9,81; tg δ = 0,016897/9,81 = 1,722·10⁻³ ⇒ δ = 5,92′
    const minutes = (value: number) => ((value * 180) / Math.PI) * 60;
    const g0 = G + EARTH.omega ** 2 * EARTH.R * Math.cos(rad(43)) ** 2;
    expect(g0).toBeCloseTo(9.828, 3);
    expect(9.81 + 0.033877 * 0.53488).toBeCloseTo(9.828, 3);
    const checked = plumbDeviationExact({
      ...EARTH,
      latitudeDeg: 43,
      gravity: g0,
    });
    expect(Math.tan(checked) * 1e3).toBeCloseTo(1.722, 3);
    expect(minutes(checked)).toBeCloseTo(5.92, 2);
    expect(minutes(delta)).toBeCloseTo(5.92, 2);
    // без поправката (g₀ = 9,81): знаменател 9,79188 ⇒ δ = 5,932′ – по-неточно
    const exact = plumbDeviationExact({ ...EARTH, latitudeDeg: 43 });
    expect(minutes(exact)).toBeCloseTo(5.93, 2);
    expect((exact - delta) / delta).toBeLessThan(0.002);
  });

  it("релативен покой, заместен обратно: привличане + Φ_e + S = 0", () => {
    // Меридианна равнина: ос ρ (от оста на въртене навън) и ос z (по оста, на
    // север). Радиалният единичен вектор е (cos ψ; sin ψ). На 1 kg:
    // привличане −g·e_R, Φ_e = ω_e²R·cos ψ по +ρ. Нишката е по сбора им.
    const psi = rad(43);
    const eR = { x: Math.cos(psi), y: Math.sin(psi) };
    const south = { x: Math.sin(psi), y: -Math.cos(psi) }; // хоризонтално, към екватора
    const phiE = EARTH.omega ** 2 * EARTH.R * Math.cos(psi);
    const sum = { x: -G * eR.x + phiE, y: -G * eR.y };
    const alongRadius = -(sum.x * eR.x + sum.y * eR.y);
    const towardEquator = sum.x * south.x + sum.y * south.y;
    // хоризонталната съставка е ω_e²R·cos ψ·sin ψ и сочи към екватора (> 0)
    expect(towardEquator).toBeCloseTo(0.016897, 6);
    expect(towardEquator).toBeGreaterThan(0);
    expect(Math.atan2(towardEquator, alongRadius)).toBeCloseTo(
      plumbDeviationExact({ ...EARTH, latitudeDeg: 43 }),
      14,
    );
    // силата в нишката (обратна на сбора) затваря силовия многоъгълник
    const S = { x: -sum.x, y: -sum.y };
    expect(S.x - G * eR.x + phiE).toBeCloseTo(0, 14);
    expect(S.y - G * eR.y).toBeCloseTo(0, 14);
  });

  it("нула на екватора и на полюса, най-голямо при 45°", () => {
    expect(plumbDeviation({ ...EARTH, latitudeDeg: 0 })).toBeCloseTo(0, 15);
    expect(plumbDeviation({ ...EARTH, latitudeDeg: 90 })).toBeCloseTo(0, 15);
    const at45 = plumbDeviation({ ...EARTH, latitudeDeg: 45 });
    // ω_e²R/(2g) = 0,033877/19,62 = 1,7266·10⁻³ rad
    expect(at45 * 1e3).toBeCloseTo(1.7266, 4);
    expect(at45).toBeGreaterThan(delta);
    expect(at45).toBeGreaterThan(plumbDeviation({ ...EARTH, latitudeDeg: 47 }));
  });

  it("граничен случай ω_e = 0: отвесът е по радиуса", () => {
    expect(plumbDeviation({ omega: 0, R: EARTH.R, latitudeDeg: 43 })).toBe(0);
    expect(plumbDeviationExact({ omega: 0, R: EARTH.R, latitudeDeg: 43 })).toBe(
      0,
    );
  });

  it("невалиден вход", () => {
    expect(() => plumbDeviation({ ...EARTH, latitudeDeg: 91 })).toThrow();
    expect(() =>
      plumbDeviation({ omega: 1e-5, R: 0, latitudeDeg: 10 }),
    ).toThrow();
  });
});

describe("Пример П4 – правилото на Бер", () => {
  // 2·ω_e·v·sin ψ = 2·7,292·10⁻⁵·1,5·0,6820 = 2,1876·10⁻⁴·0,6820 = 1,492·10⁻⁴ m/s²
  const a = horizontalCoriolis({ omega: EARTH.omega, v: 1.5, latitudeDeg: 43 });

  it("ускорение, сила върху 1000 kg и напречен наклон на водата", () => {
    expect(Math.sin(rad(43))).toBeCloseTo(0.682, 4);
    expect(a * 1e4).toBeCloseTo(1.4919, 4);
    expect(2 * 7.292e-5 * 1.5 * 0.682 * 1e4).toBeCloseTo(1.492, 3);
    // 1000·1,492·10⁻⁴ = 0,149 N
    expect(1000 * a).toBeCloseTo(0.149, 3);
    // наклон 1,492·10⁻⁴/9,81 = 1,52·10⁻⁵; 200 m·1,52·10⁻⁵ = 3,04 mm ≈ 3,0 mm
    expect((1.492e-4 / 9.81) * 1e5).toBeCloseTo(1.52, 2);
    expect(200 * 1.52e-5 * 1000).toBeCloseTo(3.04, 10);
    expect(200 * (a / G) * 1000).toBeCloseTo(3.04, 2);
  });

  it("пространствена проверка: −2m·ω_e × v_r е НАДЯСНО от движението за четирите посоки", () => {
    // Земни оси: Z по оста на въртене (на север), ω_e = (0; 0; ω_e). На ширина ψ
    // (дължина 0): изток E = (0; 1; 0), север N = (−sin ψ; 0; cos ψ),
    // нагоре U = (cos ψ; 0; sin ψ). „Надясно“ от посока d (гледано отгоре) е
    // d × U.
    type V3 = [number, number, number];
    const psi = rad(43);
    const E: V3 = [0, 1, 0];
    const N: V3 = [-Math.sin(psi), 0, Math.cos(psi)];
    const U: V3 = [Math.cos(psi), 0, Math.sin(psi)];
    const cross = (p: V3, q: V3): V3 => [
      p[1] * q[2] - p[2] * q[1],
      p[2] * q[0] - p[0] * q[2],
      p[0] * q[1] - p[1] * q[0],
    ];
    const dot = (p: V3, q: V3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
    const scale = (p: V3, k: number): V3 => [p[0] * k, p[1] * k, p[2] * k];
    const w: V3 = [0, 0, EARTH.omega];
    const v = 1.5;
    const directions: V3[] = [N, scale(N, -1), E, scale(E, -1)];
    for (const d of directions) {
      const phiC = scale(cross(w, scale(d, v)), -2); // на 1 kg
      const right = cross(d, U);
      // съставката надясно е точно 2·ω_e·v·sin ψ, а по посоката на движение – нула
      expect(dot(phiC, right)).toBeCloseTo(a, 14);
      expect(dot(phiC, d)).toBeCloseTo(0, 14);
    }
    // въпрос П-5: движение на север ⇒ силата е на изток (дясната релса)
    const north = scale(cross(w, scale(N, v)), -2);
    expect(dot(north, E)).toBeCloseTo(a, 14);
    expect(dot(north, E)).toBeGreaterThan(0);
  });

  it("знак: надясно в северното полукълбо, наляво в южното, нула на екватора", () => {
    expect(a).toBeGreaterThan(0);
    expect(
      horizontalCoriolis({ omega: EARTH.omega, v: 1.5, latitudeDeg: -43 }),
    ).toBeCloseTo(-a, 15);
    expect(
      horizontalCoriolis({ omega: EARTH.omega, v: 1.5, latitudeDeg: 0 }),
    ).toBe(0);
  });

  it("граничен случай ω_e = 0 или v = 0: няма отклонение", () => {
    expect(horizontalCoriolis({ omega: 0, v: 1.5, latitudeDeg: 43 })).toBe(0);
    expect(
      horizontalCoriolis({ omega: EARTH.omega, v: 0, latitudeDeg: 43 }),
    ).toBe(0);
  });

  it("невалиден вход", () => {
    expect(() =>
      horizontalCoriolis({ omega: EARTH.omega, v: -1, latitudeDeg: 43 }),
    ).toThrow();
    expect(() =>
      horizontalCoriolis({ omega: EARTH.omega, v: 1, latitudeDeg: 120 }),
    ).toThrow();
  });
});

describe("В реалния живот – товар върху каросерията при спиране", () => {
  it("нужен коефициент на триене 5/9,81 = 0,51", () => {
    expect(minFrictionCoefficient(5)).toBeCloseTo(0.51, 2);
    expect(minFrictionCoefficient(5)).toBeCloseTo(0.5097, 4);
  });

  it("релативен покой, заместен обратно: μ·m·g = m·a_e на границата", () => {
    const mu = minFrictionCoefficient(5);
    // товар 800 kg: Φ_e = 800·5 = 4000 N; най-голямо триене μ·800·9,81 = 4000 N
    expect(mu * 800 * G).toBeCloseTo(800 * 5, 9);
    expect(
      inertiaForces({
        mass: 800,
        aE: { x: -5, y: 0 },
        omegaE: 0,
        vR: { x: 0, y: 0 },
      }).phiE,
    ).toEqual({ x: 4000, y: 0 });
  });

  it("граничен случай: без закъснение не е нужно триене", () => {
    expect(minFrictionCoefficient(0)).toBe(0);
    expect(() => minFrictionCoefficient(-1)).toThrow();
  });
});
