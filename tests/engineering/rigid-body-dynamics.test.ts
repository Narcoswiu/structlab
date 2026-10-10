import { describe, expect, it } from "vitest";
import {
  G_ACCELERATION,
  discInertia,
  drumWithLoad,
  hingedRodRelease,
  inertiaLoads,
  maxRollingAngleDeg,
  physicalPendulum,
  ringInertia,
  rodInertiaAboutCentre,
  rodInertiaAboutEnd,
  rollingOnIncline,
  rpmToRadPerSec,
  shaftReactions,
  translatingBlock,
} from "@/lib/engineering/rigid-body-dynamics";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Единици: m, s, kg, N, N·m, kg·m², rad/s, rad/s². g = 9,81 m/s².
// Ъглите, ω, ε и моментите са положителни обратно на часовниковата стрелка.

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

/** Независима проверка: решава линейна система A·x = b по Гаус с избор на водещ елемент. */
function solveLinear(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
    }
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    for (let row = col + 1; row < n; row++) {
      const factor = a[row]![col]! / a[col]![col]!;
      for (let k = col; k <= n; k++) a[row]![k]! -= factor * a[col]![k]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = a[row]![n]!;
    for (let k = row + 1; k < n; k++) sum -= a[row]![k]! * x[k]!;
    x[row] = sum / a[row]![row]!;
  }
  return x;
}

describe("масови инерционни моменти (дадени формули) и помощни величини", () => {
  it("диск, пръстен, прът", () => {
    // цилиндърът от Л1/П1: ½ · 10 · 0,2² = 0,2 kg·m²
    expect(discInertia(10, 0.2)).toBeCloseTo(0.2, 12);
    // барабанът от Л2: ½ · 20 · 0,25² = 0,625 kg·m²
    expect(discInertia(20, 0.25)).toBeCloseTo(0.625, 12);
    // тръба със същата маса и радиус: 10 · 0,04 = 0,4 kg·m² – два пъти повече
    expect(ringInertia(10, 0.2)).toBeCloseTo(0.4, 12);
    // прътът от П2: 6 · 1,2²/3 = 2,88; 6 · 1,44/12 = 0,72 kg·m²
    expect(rodInertiaAboutEnd(6, 1.2)).toBeCloseTo(2.88, 12);
    expect(rodInertiaAboutCentre(6, 1.2)).toBeCloseTo(0.72, 12);
    // Щайнер (независимо): J_O = J_C + m·(l/2)² = 0,72 + 6 · 0,36 = 2,88
    expect(rodInertiaAboutCentre(6, 1.2) + 6 * 0.6 ** 2).toBeCloseTo(
      rodInertiaAboutEnd(6, 1.2),
      12,
    );
  });

  it("обороти в минута → rad/s", () => {
    // 1200 min⁻¹: π·1200/30 = 40π = 125,664; 1500: 157,08; 3000: 314,16 rad/s
    expect(rpmToRadPerSec(1200)).toBeCloseTo(125.664, 3);
    expect(rpmToRadPerSec(1500)).toBeCloseTo(157.08, 2);
    expect(rpmToRadPerSec(3000)).toBeCloseTo(314.16, 2);
  });

  it("инерционни товари: Φ = −m·a_C, M^Φ = −J_C·ε", () => {
    // прътът от П2 при пускане: a_C = (0; −7,3575), ε = 12,2625, J_C = 0,72
    // Φ = (0; +44,145) N – нагоре; M^Φ = −0,72 · 12,2625 = −8,829 N·m (по часовниковата)
    const loads = inertiaLoads({
      mass: 6,
      aCx: 0,
      aCy: -7.3575,
      inertiaC: 0.72,
      epsilon: 12.2625,
    });
    expect(loads.phiX).toBe(0);
    expect(loads.phiY).toBeCloseTo(44.145, 10);
    expect(loads.moment).toBeCloseTo(-8.829, 10);
  });

  it("„Провери се“ (Леко) 1: ε = M/J", () => {
    // 3 N·m / 0,5 kg·m² = 6 rad/s²
    expect(3 / 0.5).toBe(6);
  });
});

describe("равнинно движение – цилиндър по грапав наклон (Л1, П1)", () => {
  const input = { mass: 10, radius: 0.2, angleDeg: 30, mu: 0.25 };

  it("Л1 / П1(а): α = 30°, търкаляне без плъзгане", () => {
    const r = rollingOnIncline(input);
    // G = 98,1 N; G·sin 30° = 49,05 N; N = 98,1 · 0,86603 = 84,957 N
    expect(r.gravityAlong).toBeCloseTo(49.05, 10);
    expect(r.normal).toBeCloseTo(84.96, 2);
    expect(98.1 * 0.86603).toBeCloseTo(84.96, 2);
    expect(r.inertiaC).toBeCloseTo(0.2, 12);
    // 10·a = 49,05 − F; 0,2·ε = 0,2·F; a = 0,2·ε  →  F = 5·a; 15·a = 49,05
    // a = 3,27 m/s²; ε = 3,27/0,2 = 16,35 rad/s²; F_тр = 16,35 N
    expect(r.rolls).toBe(true);
    expect(r.acceleration).toBeCloseTo(3.27, 10);
    expect(r.epsilon).toBeCloseTo(16.35, 10);
    expect(r.friction).toBeCloseTo(16.35, 10);
    // формулата: a = (2/3)·g·sin α = (2/3) · 4,905 = 3,27
    expect(r.acceleration).toBeCloseTo((2 / 3) * g * 0.5, 12);
    // нужният μ: 16,35/84,96 = 0,192 = tg 30°/3; наличният: 0,25 · 84,96 = 21,24 N
    expect(r.muRequired).toBeCloseTo(0.192, 3);
    expect(16.35 / 84.96).toBeCloseTo(0.192, 3);
    expect(r.muRequired).toBeCloseTo(Math.tan(30 * RAD) / 3, 12);
    expect(0.25 * r.normal).toBeCloseTo(21.24, 2);
    expect(r.friction).toBeLessThan(0.25 * r.normal);
  });

  it("П1(а): път 3 m – време, скорост, ъглова скорост", () => {
    const { acceleration } = rollingOnIncline(input);
    // t = √(2·3/3,27) = √1,8349 = 1,355 s (само в плана); v = √(2·3,27·3) = √19,62 = 4,429 m/s
    const t = Math.sqrt((2 * 3) / acceleration);
    const v = Math.sqrt(2 * acceleration * 3);
    expect(t).toBeCloseTo(1.355, 3);
    expect(v).toBeCloseTo(4.429, 3);
    // ω = v/R = 4,429/0,2 = 22,15 rad/s (само в плана)
    expect(v / 0.2).toBeCloseTo(22.15, 2);
    // с печатаните закръглени стойности читателят получава същото
    expect(Math.sqrt(6 / 3.27)).toBeCloseTo(1.355, 3);
    expect(4.429 / 0.2).toBeCloseTo(22.15, 2);
  });

  it("два пътя: Нютон–Ойлер и кинетостатика с моменти спрямо точката на допиране", () => {
    const r = rollingOnIncline(input);
    const { mass, radius } = input;
    // Кинетостатика: Φ = m·a в C нагоре по наклона, M^Φ = J_C·ε обратно на въртенето.
    // Спрямо точката на допиране N и F_тр нямат момент:
    //   G·sin α·R − m·a·R − J_C·a/R = 0  →  a = G·sin α·R / (m·R + J_C/R)
    const aKinetostatics =
      (r.gravityAlong * radius) / (mass * radius + r.inertiaC / radius);
    expect(aKinetostatics).toBeCloseTo(r.acceleration, 12);
    // числата от текста: 49,05·0,2 − 32,7·0,2 − 0,2·16,35 = 9,81 − 6,54 − 3,27 = 0
    expect(mass * r.acceleration).toBeCloseTo(32.7, 10);
    expect(49.05 * 0.2 - 32.7 * 0.2 - 0.2 * 16.35).toBeCloseTo(0, 12);
    // проекция по наклона: G·sin α − F_тр − Φ = 0  →  F_тр = 49,05 − 32,7 = 16,35
    expect(r.gravityAlong - mass * aKinetostatics).toBeCloseTo(r.friction, 12);
    // трети път – пълната система (a, ε, F) като три линейни уравнения:
    //   m·a + F = G·sin α;  J·ε − R·F = 0;  a − R·ε = 0
    const [a, eps, friction] = solveLinear(
      [
        [mass, 0, 1],
        [0, r.inertiaC, -radius],
        [1, -radius, 0],
      ],
      [r.gravityAlong, 0, 0],
    );
    expect(a).toBeCloseTo(r.acceleration, 12);
    expect(eps).toBeCloseTo(r.epsilon, 12);
    expect(friction).toBeCloseTo(r.friction, 12);
  });

  it("независимо: енергиен баланс и числено интегриране за 3 m път", () => {
    const r = rollingOnIncline(input);
    const t = Math.sqrt(6 / r.acceleration);
    // РК4 на s'' = a_C и φ'' = ε
    const [s, v, phi, omega] = rk4(
      (_t, y) => [y[1]!, r.acceleration, y[3]!, r.epsilon],
      [0, 0, 0, 0],
      0,
      t,
      1000,
    );
    expect(s).toBeCloseTo(3, 9);
    expect(v).toBeCloseTo(4.4294, 4);
    // без плъзгане: s = R·φ, v = R·ω
    expect(s).toBeCloseTo(0.2 * phi!, 9);
    expect(v).toBeCloseTo(0.2 * omega!, 9);
    // ½·m·v² + ½·J·ω² = 98,1 + 49,05 = 147,15 J = G·sin α·s = 49,05 · 3
    const kinetic = 0.5 * 10 * v! ** 2 + 0.5 * r.inertiaC * omega! ** 2;
    expect(kinetic).toBeCloseTo(147.15, 8);
    expect(r.gravityAlong * 3).toBeCloseTo(147.15, 10);
  });

  it("тръба (пръстен) – отговорът на загадката в „Леко“", () => {
    const pipe = rollingOnIncline({
      ...input,
      mu: 1,
      inertiaC: ringInertia(10, 0.2),
    });
    // a = g·sin 30°/2 = 2,4525 m/s² < 3,27 – плътният цилиндър печели
    expect(pipe.acceleration).toBeCloseTo(2.4525, 10);
    expect(pipe.acceleration).toBeLessThan(
      rollingOnIncline(input).acceleration,
    );
    // отношение 3,27/2,4525 = 4/3
    expect(3.27 / pipe.acceleration).toBeCloseTo(4 / 3, 12);
  });

  it("П1(б): α = 45°, μ = 0,25 – търкаляне с плъзгане", () => {
    const r = rollingOnIncline({ ...input, angleDeg: 45 });
    // (а): tg 30° = 0,577 ≤ 3·μ = 0,75; (б): tg 45° = 1 > 0,75, тоест tg 45°/3 = 0,333 > 0,25
    expect(Math.tan(30 * RAD)).toBeCloseTo(0.577, 3);
    expect(r.muRequired).toBeCloseTo(0.3333, 4);
    expect(r.rolls).toBe(false);
    // N = 98,1 · 0,70711 = 69,37 N; F_тр = 0,25 · 69,37 = 17,34 N; G·sin 45° = 69,37 N
    expect(r.normal).toBeCloseTo(69.37, 2);
    expect(r.gravityAlong).toBeCloseTo(69.37, 2);
    expect(r.friction).toBeCloseTo(17.34, 2);
    // a = (69,37 − 17,34)/10 = 5,203 m/s²; ε = 17,34 · 0,2/0,2 = 17,34 rad/s²
    expect(r.acceleration).toBeCloseTo(5.203, 3);
    expect(r.epsilon).toBeCloseTo(17.34, 2);
    expect((69.37 - 17.34) / 10).toBeCloseTo(5.203, 3);
    // ε·R = 3,468 m/s² < a_C – точката на допиране се хлъзга
    expect(r.epsilon * 0.2).toBeCloseTo(3.468, 3);
    expect(r.epsilon * 0.2).toBeLessThan(r.acceleration);
    // формулата: a = g·(sin α − μ·cos α) = 9,81 · 0,70711 · 0,75 = 5,2025
    expect(r.acceleration).toBeCloseTo(
      g * (Math.sin(45 * RAD) - 0.25 * Math.cos(45 * RAD)),
      12,
    );
  });

  it("П1(б) независимо: работа на теглото и на триенето = кинетичната енергия след 1 s", () => {
    const r = rollingOnIncline({ ...input, angleDeg: 45 });
    const [s, v, phi, omega] = rk4(
      (_t, y) => [y[1]!, r.acceleration, y[3]!, r.epsilon],
      [0, 0, 0, 0],
      0,
      1,
      1000,
    );
    // триенето върши работа върху хлъзгането на точката на допиране: s − R·φ
    const work = r.gravityAlong * s! - r.friction * (s! - 0.2 * phi!);
    const kinetic = 0.5 * 10 * v! ** 2 + 0.5 * r.inertiaC * omega! ** 2;
    expect(kinetic).toBeCloseTo(work, 8);
    expect(kinetic).toBeCloseTo(165.406, 3);
  });

  it("условието без плъзгане tg α ≤ 3·μ – проверка на самата граница", () => {
    // μ = 0,25: tg α = 0,75 → α = 36,87°
    const limit = maxRollingAngleDeg({ mass: 10, radius: 0.2, mu: 0.25 });
    expect(limit).toBeCloseTo(36.87, 2);
    const below = rollingOnIncline({ ...input, angleDeg: limit - 0.01 });
    const above = rollingOnIncline({ ...input, angleDeg: limit + 0.01 });
    expect(below.rolls).toBe(true);
    expect(above.rolls).toBe(false);
    // на границата двата режима дават едно и също ускорение (непрекъснатост)
    expect(above.acceleration).toBeCloseTo(below.acceleration, 2);
    // нужната сила на триене е точно μ·N на границата
    const at = rollingOnIncline({ ...input, mu: 1, angleDeg: limit });
    expect(at.friction / at.normal).toBeCloseTo(0.25, 12);
    // „Провери се“ (Подробно) 1: μ = 0,2 → tg α = 0,6 → α = 30,96°
    expect(maxRollingAngleDeg({ mass: 3, radius: 0.1, mu: 0.2 })).toBeCloseTo(
      30.96,
      2,
    );
    // тръба: tg α ≤ 2·μ
    expect(
      Math.tan(
        maxRollingAngleDeg({
          mass: 5,
          radius: 0.3,
          mu: 0.2,
          inertiaC: ringInertia(5, 0.3),
        }) * RAD,
      ),
    ).toBeCloseTo(0.4, 12);
  });

  it("„Провери се“: обръч на 20° (Леко 2) и тръба на 30° (Подробно 2)", () => {
    // Леко 2: a = g·sin 20°/2 = 9,81 · 0,3420/2 = 1,678 m/s²
    const hoop = rollingOnIncline({
      mass: 2,
      radius: 0.3,
      angleDeg: 20,
      mu: 1,
      inertiaC: ringInertia(2, 0.3),
    });
    expect(hoop.acceleration).toBeCloseTo(1.678, 3);
    expect((9.81 * 0.342) / 2).toBeCloseTo(1.678, 3);
    // Подробно 2: m = 5 kg; a = 9,81 · 0,5/2 = 2,4525 m/s²;
    // F_тр = m·g·sin α − m·a = 24,525 − 12,2625 = 12,26 N; μ ≥ tg 30°/2 = 0,289
    const pipe = rollingOnIncline({
      mass: 5,
      radius: 0.1,
      angleDeg: 30,
      mu: 1,
      inertiaC: ringInertia(5, 0.1),
    });
    expect(pipe.acceleration).toBeCloseTo(2.4525, 10);
    expect(pipe.friction).toBeCloseTo(12.26, 2);
    expect(pipe.muRequired).toBeCloseTo(0.289, 3);
  });

  it("гранични случаи и невалиден вход", () => {
    // хоризонтална равнина: тялото стои
    const flat = rollingOnIncline({ ...input, angleDeg: 0 });
    expect(flat.acceleration).toBe(0);
    expect(flat.friction).toBe(0);
    // гладък наклон (μ = 0): плъзга се без да се завърта, a = g·sin α
    const smooth = rollingOnIncline({ ...input, mu: 0 });
    expect(smooth.rolls).toBe(false);
    expect(smooth.epsilon).toBe(0);
    expect(smooth.acceleration).toBeCloseTo(4.905, 10);
    expect(() => rollingOnIncline({ ...input, mass: 0 })).toThrow();
    expect(() => rollingOnIncline({ ...input, mu: -0.1 })).toThrow();
    expect(() => rollingOnIncline({ ...input, angleDeg: 90 })).toThrow();
    expect(() => rollingOnIncline({ ...input, radius: Number.NaN })).toThrow();
  });
});

describe("ротация около неподвижна ос – барабан с товар (Л2)", () => {
  it("Л2: M = 20 kg, R = 0,25 m, товар 10 kg", () => {
    const r = drumWithLoad({ drumMass: 20, radius: 0.25, loadMass: 10 });
    // J = 0,625; 10·a = 98,1 − S; 0,625·ε = 0,25·S; a = 0,25·ε → S = 10·a
    // 20·a = 98,1 → a = 4,905 m/s²; S = 49,05 N; ε = 4,905/0,25 = 19,62 rad/s²
    expect(r.inertia).toBeCloseTo(0.625, 12);
    expect(r.acceleration).toBeCloseTo(4.905, 10);
    expect(r.tension).toBeCloseTo(49.05, 10);
    expect(r.epsilon).toBeCloseTo(19.62, 10);
    // ос: 20 · 9,81 + 49,05 = 196,2 + 49,05 = 245,25 N; в покой 30 · 9,81 = 294,3 N
    expect(r.axleReaction).toBeCloseTo(245.25, 10);
    expect(r.axleReactionStatic).toBeCloseTo(294.3, 10);
  });

  it("два пътя: кинетостатика за цялата система спрямо оста", () => {
    const M = 20;
    const R = 0.25;
    const m = 10;
    const r = drumWithLoad({ drumMass: M, radius: R, loadMass: m });
    // Инерционна сила на товара m·a нагоре, инерционен момент на барабана J·ε.
    // Спрямо оста: m·g·R − m·a·R − J·a/R = 0 → a = m·g·R/(m·R + J/R)
    const a = (m * g * R) / (m * R + r.inertia / R);
    expect(a).toBeCloseTo(r.acceleration, 12);
    // числата: 24,525 − 12,2625 − 12,2625 = 0
    expect(98.1 * 0.25 - 10 * 4.905 * 0.25 - 0.625 * 19.62).toBeCloseTo(0, 12);
    // ΣF_y за системата: R_O + m·a − (M + m)·g = 0 → R_O = 294,3 − 49,05 = 245,25
    expect((M + m) * g - m * a).toBeCloseTo(r.axleReaction, 12);
  });

  it("независимо: енергиен баланс след спускане с 2 m", () => {
    const r = drumWithLoad({ drumMass: 20, radius: 0.25, loadMass: 10 });
    const v = Math.sqrt(2 * r.acceleration * 2);
    // m·g·h = 10 · 9,81 · 2 = 196,2 J = ½·m·v² + ½·J·(v/R)²
    const kinetic = 0.5 * 10 * v * v + 0.5 * r.inertia * (v / 0.25) ** 2;
    expect(kinetic).toBeCloseTo(196.2, 10);
  });

  it("„Провери се“ (Леко) 3: M = 8 kg, m = 6 kg", () => {
    const r = drumWithLoad({ drumMass: 8, radius: 0.2, loadMass: 6 });
    // S = ½·M·a = 4·a; 6·a = 58,86 − 4·a → a = 5,886 m/s²; S = 4 · 5,886 = 23,54 N
    expect(r.acceleration).toBeCloseTo(5.886, 10);
    expect(r.tension).toBeCloseTo(23.54, 2);
    expect(4 * 5.886).toBeCloseTo(23.54, 2);
    // радиусът не влияе на a и S при плътен диск
    const other = drumWithLoad({ drumMass: 8, radius: 0.5, loadMass: 6 });
    expect(other.acceleration).toBeCloseTo(r.acceleration, 12);
    expect(() =>
      drumWithLoad({ drumMass: 8, radius: 0, loadMass: 6 }),
    ).toThrow();
  });
});

describe("ротация около неподвижна ос – прът около края си (П2)", () => {
  const rod = { mass: 6, length: 1.2 };

  it("П2: моментът на пускане, φ = 0", () => {
    const r = hingedRodRelease({ ...rod, phiDeg: 0 });
    // J_O = 2,88; G = 58,86 N; ε = 58,86 · 0,6/2,88 = 35,316/2,88 = 12,2625 rad/s²
    expect(r.inertiaO).toBeCloseTo(2.88, 12);
    expect(6 * g * 0.6).toBeCloseTo(35.316, 10);
    expect(r.epsilon).toBeCloseTo(12.2625, 10);
    expect(r.omega).toBe(0);
    // a_C = 12,2625 · 0,6 = 7,3575 m/s² надолу
    expect(r.aCx).toBeCloseTo(0, 12);
    expect(r.aCy).toBeCloseTo(-7.3575, 10);
    // O_y = 58,86 − 6 · 7,3575 = 58,86 − 44,145 = 14,715 N = G/4; O_x = 0
    expect(r.reactionY).toBeCloseTo(14.715, 10);
    expect(r.reactionY).toBeCloseTo((6 * g) / 4, 12);
    expect(r.reactionX).toBeCloseTo(0, 12);
    // краят: 12,2625 · 1,2 = 14,715 m/s² = 1,5·g > g (загадката)
    expect(r.tipAcceleration).toBeCloseTo(14.715, 10);
    expect(r.tipAcceleration / g).toBeCloseTo(1.5, 12);
  });

  it("П2: проверка по кинетостатика при φ = 0 (числата от текста)", () => {
    const r = hingedRodRelease({ ...rod, phiDeg: 0 });
    const loads = inertiaLoads({
      mass: 6,
      aCx: r.aCx,
      aCy: r.aCy,
      inertiaC: rodInertiaAboutCentre(6, 1.2),
      epsilon: r.epsilon,
    });
    // Φ = 44,145 N нагоре; M^Φ = −0,72 · 12,2625 = −8,829 N·m
    expect(loads.phiY).toBeCloseTo(44.145, 10);
    expect(loads.moment).toBeCloseTo(-8.829, 10);
    // моменти спрямо O (C е на x = −0,6): тегло +35,316; Φ: (−0,6)·44,145 = −26,487; M^Φ = −8,829
    const momentO = -0.6 * (-6 * g) + -0.6 * loads.phiY + loads.moment;
    expect(-0.6 * loads.phiY).toBeCloseTo(-26.487, 10);
    expect(momentO).toBeCloseTo(0, 10);
    expect(35.316 - 26.487 - 8.829).toBeCloseTo(0, 10);
    // ΣF_y: O_y + Φ − G = 14,715 + 44,145 − 58,86 = 0
    expect(r.reactionY + loads.phiY - 6 * g).toBeCloseTo(0, 10);
  });

  it("П2: отвесно положение, φ = 90°", () => {
    const r = hingedRodRelease({ ...rod, phiDeg: 90 });
    // ω² = 3 · 9,81/1,2 = 24,525; ω = 4,952 rad/s; ε = 0
    expect(r.omega ** 2).toBeCloseTo(24.525, 10);
    expect(r.omega).toBeCloseTo(4.952, 3);
    expect(r.epsilon).toBeCloseTo(0, 10);
    // a_C = 24,525 · 0,6 = 14,715 m/s² нагоре (към оста)
    expect(r.aCy).toBeCloseTo(14.715, 10);
    expect(r.aCx).toBeCloseTo(0, 10);
    // O_y = 58,86 + 6 · 14,715 = 58,86 + 88,29 = 147,15 N = 2,5·G
    expect(6 * 14.715).toBeCloseTo(88.29, 10);
    expect(r.reactionY).toBeCloseTo(147.15, 10);
    expect(r.reactionY / (6 * g)).toBeCloseTo(2.5, 12);
  });

  it("независимо: РК4 на J_O·φ'' = G·(l/2)·cos φ до отвесното положение", () => {
    const k = (6 * g * 0.6) / 2.88;
    const f = (_t: number, y: number[]) => [y[1]!, k * Math.cos(y[0]!)];
    // стъпки по 10⁻⁴ s, докато φ премине 90°; после линейна интерполация
    let y = [0, 0];
    let previous = y;
    let t = 0;
    const h = 1e-4;
    while (y[0]! < Math.PI / 2) {
      previous = y;
      y = rk4(f, y, t, t + h, 1);
      t += h;
    }
    const fraction = (Math.PI / 2 - previous[0]!) / (y[0]! - previous[0]!);
    const omega = previous[1]! + fraction * (y[1]! - previous[1]!);
    expect(omega).toBeCloseTo(
      hingedRodRelease({ ...rod, phiDeg: 90 }).omega,
      6,
    );
    expect(omega).toBeCloseTo(4.95227, 5);
    // и в междинно положение 30°: ω от интегрирането срещу първия интеграл
    y = [0, 0];
    t = 0;
    while (y[0]! < 30 * RAD) {
      previous = y;
      y = rk4(f, y, t, t + h, 1);
      t += h;
    }
    const part = (30 * RAD - previous[0]!) / (y[0]! - previous[0]!);
    const omega30 = previous[1]! + part * (y[1]! - previous[1]!);
    expect(omega30).toBeCloseTo(
      hingedRodRelease({ ...rod, phiDeg: 30 }).omega,
      6,
    );
  });

  it("два пътя при φ = 30°: Нютон–Ойлер спрямо O и система спрямо масовия център", () => {
    const { mass, length } = rod;
    const phi = 30 * RAD;
    const sin = Math.sin(phi);
    const cos = Math.cos(phi);
    const half = length / 2;
    const r = hingedRodRelease({ ...rod, phiDeg: 30 });
    // ръчно: ε = 12,2625 · cos 30° = 10,6196; ω² = 24,525 · 0,5 = 12,2625
    expect(r.epsilon).toBeCloseTo(10.6196, 4);
    expect(r.omega ** 2).toBeCloseTo(12.2625, 10);
    // a_τ = 6,3718; a_n = 7,3575; a_Cx = 6,3718·0,5 + 7,3575·0,86603 = 9,5577
    // a_Cy = −6,3718·0,86603 + 7,3575·0,5 = −1,8394
    expect(r.aCx).toBeCloseTo(9.5577, 4);
    expect(r.aCy).toBeCloseTo(-1.8394, 4);
    // O_x = 6 · 9,5577 = 57,346 N; O_y = 6 · (9,81 − 1,8394) = 47,824 N
    expect(r.reactionX).toBeCloseTo(57.346, 3);
    expect(r.reactionY).toBeCloseTo(47.824, 3);
    // Втори път: неизвестни ε, O_x, O_y; уравненията са спрямо C (J_C, не J_O).
    //   m·a_Cx = O_x,  a_Cx = ε·(l/2)·sin φ + ω²·(l/2)·cos φ
    //   m·a_Cy = O_y − G,  a_Cy = −ε·(l/2)·cos φ + ω²·(l/2)·sin φ
    //   J_C·ε = момент на реакцията спрямо C; O − C = (l/2)·(cos φ; sin φ)
    const omegaSquared = r.omega ** 2;
    const inertiaC = rodInertiaAboutCentre(mass, length);
    const [eps, ox, oy] = solveLinear(
      [
        [mass * half * sin, -1, 0],
        [-mass * half * cos, 0, -1],
        [inertiaC, half * sin, -half * cos],
      ],
      [
        -mass * omegaSquared * half * cos,
        -mass * omegaSquared * half * sin - mass * g,
        0,
      ],
    );
    expect(eps).toBeCloseTo(r.epsilon, 10);
    expect(ox).toBeCloseTo(r.reactionX, 10);
    expect(oy).toBeCloseTo(r.reactionY, 10);
    // Трети път: кинетостатика, моменти спрямо O с Φ и M^Φ в C.
    const loads = inertiaLoads({
      mass,
      aCx: r.aCx,
      aCy: r.aCy,
      inertiaC,
      epsilon: r.epsilon,
    });
    const xC = -half * cos;
    const yC = -half * sin;
    const momentO =
      xC * (-mass * g + loads.phiY) - yC * loads.phiX + loads.moment;
    expect(momentO).toBeCloseTo(0, 10);
    expect(r.reactionX + loads.phiX).toBeCloseTo(0, 10);
    expect(r.reactionY - mass * g + loads.phiY).toBeCloseTo(0, 10);
  });

  it("реакцията в покой: при висящ прът без движение остава само теглото", () => {
    // φ = 90° с ω = 0 е статиката: O_y = G = 58,86 N; динамичната добавка е 88,29 N
    const moving = hingedRodRelease({ ...rod, phiDeg: 90 });
    expect(moving.reactionY - 6 * g).toBeCloseTo(88.29, 10);
    expect(6 * g).toBeCloseTo(58.86, 10);
    expect(() => hingedRodRelease({ ...rod, phiDeg: -5 })).toThrow();
    expect(() => hingedRodRelease({ mass: 6, length: 0, phiDeg: 0 })).toThrow();
  });
});

describe("физично махало", () => {
  it("П2: прътът като махало – период и приведена дължина", () => {
    const r = physicalPendulum({ inertiaO: 2.88, mass: 6, distance: 0.6 });
    // T₀ = 2π·√(2,88/(58,86 · 0,6)) = 2π·√(2,88/35,316) = 2π · 0,28557 = 1,794 s
    expect(Math.sqrt(2.88 / 35.316)).toBeCloseTo(0.28557, 5);
    expect(r.period).toBeCloseTo(1.794, 3);
    expect(2 * Math.PI * 0.28557).toBeCloseTo(1.794, 3);
    // l_пр = 2,88/(6 · 0,6) = 0,8 m = 2·l/3
    expect(r.reducedLength).toBeCloseTo(0.8, 12);
    // математично махало с l = 0,8 m има същия период
    expect(2 * Math.PI * Math.sqrt(0.8 / g)).toBeCloseTo(r.period, 12);
  });

  it("независимо: периодът от числено интегриране при амплитуда 1°", () => {
    const k2 = (6 * g * 0.6) / 2.88;
    const f = (_t: number, y: number[]) => [y[1]!, -k2 * Math.sin(y[0]!)];
    // пускане от покой при 1°; първото преминаване през нулата е четвърт период
    let y = [1 * RAD, 0];
    let previous = y;
    let t = 0;
    const h = 1e-4;
    while (y[0]! > 0) {
      previous = y;
      y = rk4(f, y, t, t + h, 1);
      t += h;
    }
    const tZero = t - h + (h * previous[0]!) / (previous[0]! - y[0]!);
    const numeric = 4 * tZero;
    const formula = physicalPendulum({
      inertiaO: 2.88,
      mass: 6,
      distance: 0.6,
    }).period;
    // при 1° точният период е по-дълъг с φ₀²/16 ≈ 0,002 %: 1,79431 срещу 1,79428 s
    expect(numeric).toBeCloseTo(1.79431, 4);
    expect(Math.abs(numeric - formula) / formula).toBeLessThan(5e-5);
    expect(numeric).toBeGreaterThan(formula);
  });

  it("„Провери се“ (Подробно) 3 и 4", () => {
    // 3: прът l = 1 m около края: J_O = m/3, d = 0,5 → T₀ = 2π·√(2/(3·9,81)) = 1,638 s
    const m = 2;
    const r = physicalPendulum({
      inertiaO: rodInertiaAboutEnd(m, 1),
      mass: m,
      distance: 0.5,
    });
    expect(r.period).toBeCloseTo(1.638, 3);
    expect(r.reducedLength).toBeCloseTo(0.667, 3);
    // масата не влияе
    expect(
      physicalPendulum({
        inertiaO: rodInertiaAboutEnd(7, 1),
        mass: 7,
        distance: 0.5,
      }).period,
    ).toBeCloseTo(r.period, 12);
    // 4: прът 8 kg, пуснат хоризонтално: O_y = G/4 = 78,48/4 = 19,62 N (не зависи от l)
    expect(
      hingedRodRelease({ mass: 8, length: 2, phiDeg: 0 }).reactionY,
    ).toBeCloseTo(19.62, 10);
    expect(
      hingedRodRelease({ mass: 8, length: 0.5, phiDeg: 0 }).reactionY,
    ).toBeCloseTo(19.62, 10);
    expect(() =>
      physicalPendulum({ inertiaO: 1, mass: 1, distance: 0 }),
    ).toThrow();
  });
});

describe("статични и динамични реакции на вал (П3)", () => {
  const shaft = { mass: 40, eccentricity: 0.002, span: 0.8, position: 0.3 };

  it("П3: n = 1200 min⁻¹", () => {
    const omega = rpmToRadPerSec(1200);
    const r = shaftReactions({ ...shaft, omega });
    // G = 392,4 N; A_ст = 392,4 · 0,5/0,8 = 245,25 N; B_ст = 392,4 · 0,3/0,8 = 147,15 N
    expect(r.weight).toBeCloseTo(392.4, 10);
    expect(r.staticA).toBeCloseTo(245.25, 10);
    expect(r.staticB).toBeCloseTo(147.15, 10);
    // Φ = 40 · 0,002 · 125,664² = 0,08 · 15 791,4 = 1263,3 N – около 3,2 пъти теглото
    expect(r.inertiaForce).toBeCloseTo(1263.3, 1);
    expect(0.08 * 125.664 ** 2).toBeCloseTo(1263.3, 1);
    expect(r.inertiaForce / r.weight).toBeCloseTo(3.2, 1);
    // A_д = 1263,3 · 0,625 = 789,6 N; B_д = 1263,3 · 0,375 = 473,7 N
    expect(r.dynamicA).toBeCloseTo(789.6, 1);
    expect(r.dynamicB).toBeCloseTo(473.7, 1);
    expect(1263.3 * 0.625).toBeCloseTo(789.6, 1);
    expect(1263.3 * 0.375).toBeCloseTo(473.7, 1);
    // A за един оборот: 245,25 + 789,6 = 1035 N; 245,25 − 789,6 = −544 N (надолу)
    expect(Math.round(r.maxA)).toBe(1035);
    expect(Math.round(r.minA)).toBe(-544);
    expect(Math.round(245.25 + 789.6)).toBe(1035);
    expect(Math.round(245.25 - 789.6)).toBe(-544);
  });

  it("независимо: реакциите от равновесие на вала с добавена Φ (моменти спрямо B и A)", () => {
    const omega = rpmToRadPerSec(1200);
    const r = shaftReactions({ ...shaft, omega });
    const phi = 40 * 0.002 * omega * omega;
    // масовият център е под оста: Φ надолу, събира се с теглото
    // ΣM_B = 0: A·0,8 − (G + Φ)·0,5 = 0;  ΣM_A = 0: B·0,8 − (G + Φ)·0,3 = 0
    const a = ((40 * g + phi) * 0.5) / 0.8;
    const b = ((40 * g + phi) * 0.3) / 0.8;
    expect(a).toBeCloseTo(r.maxA, 9);
    expect(b).toBeCloseTo(r.maxB, 9);
    expect(a + b).toBeCloseTo(40 * g + phi, 9);
    // масовият център е над оста: Φ нагоре
    expect(((40 * g - phi) * 0.5) / 0.8).toBeCloseTo(r.minA, 9);
    expect(((40 * g - phi) * 0.3) / 0.8).toBeCloseTo(r.minB, 9);
    // сборът на динамичните реакции е самата Φ
    expect(r.dynamicA + r.dynamicB).toBeCloseTo(r.inertiaForce, 9);
  });

  it("при ω = 0 или при масов център на оста остават само статичните реакции", () => {
    const rest = shaftReactions({ ...shaft, omega: 0 });
    expect(rest.inertiaForce).toBe(0);
    expect(rest.dynamicA).toBe(0);
    expect(rest.dynamicB).toBe(0);
    expect(rest.maxA).toBeCloseTo(245.25, 10);
    expect(rest.minA).toBeCloseTo(245.25, 10);
    expect(rest.maxB).toBeCloseTo(147.15, 10);
    const balanced = shaftReactions({ ...shaft, eccentricity: 0, omega: 500 });
    expect(balanced.dynamicA).toBe(0);
    expect(balanced.maxA).toBeCloseTo(balanced.staticA, 12);
    // динамичната част расте с квадрата на ω: двойно по-бързо → четири пъти
    const slow = shaftReactions({ ...shaft, omega: 50 });
    const fast = shaftReactions({ ...shaft, omega: 100 });
    expect(fast.dynamicA / slow.dynamicA).toBeCloseTo(4, 12);
    expect(fast.staticA).toBeCloseTo(slow.staticA, 12);
    expect(() => shaftReactions({ ...shaft, omega: 1, position: 1 })).toThrow();
    expect(() => shaftReactions({ ...shaft, omega: 1, span: 0 })).toThrow();
  });

  it("небалансиран ротор: допълнителен случай и „Провери се“ (Подробно) 5", () => {
    // извън текста: m = 50 kg, e = 1 mm, 1500 min⁻¹: ω = 157,08; Φ = 0,05 · 157,08² = 1233,7 N; G = 490,5 N
    const fan = shaftReactions({
      mass: 50,
      eccentricity: 0.001,
      omega: rpmToRadPerSec(1500),
      span: 1,
      position: 0.5,
    });
    expect(fan.inertiaForce).toBeCloseTo(1233.7, 1);
    expect(0.05 * 157.08 ** 2).toBeCloseTo(1233.7, 1);
    expect(fan.weight).toBeCloseTo(490.5, 10);
    expect(fan.inertiaForce / fan.weight).toBeCloseTo(2.5, 1);
    // Подробно 5: m = 20 kg, e = 0,5 mm, 3000 min⁻¹: Φ = 0,01 · 314,16² = 987 N; G = 196,2 N
    const rotor = shaftReactions({
      mass: 20,
      eccentricity: 0.0005,
      omega: rpmToRadPerSec(3000),
      span: 1,
      position: 0.5,
    });
    expect(Math.round(rotor.inertiaForce)).toBe(987);
    expect(Math.round(0.01 * 314.16 ** 2)).toBe(987);
    expect(rotor.weight).toBeCloseTo(196.2, 10);
    expect(rotor.inertiaForce / rotor.weight).toBeCloseTo(5.03, 2);
  });
});

describe("транслация – палет върху платформа, която спира", () => {
  const pallet = { mass: 400, height: 1.8, width: 0.9, mu: 0.4 };

  it("„В реалния живот“: спиране с 3 m/s²", () => {
    const r = translatingBlock({ ...pallet, acceleration: 3 });
    // G = 3924 N; Φ = 400 · 3 = 1200 N; F_тр = 1200 N ≤ 0,4 · 3924 = 1569,6 N
    expect(r.weight).toBeCloseTo(3924, 10);
    expect(r.inertiaForce).toBe(1200);
    expect(r.frictionNeeded).toBe(1200);
    expect(r.frictionLimit).toBeCloseTo(1569.6, 10);
    expect(r.slides).toBe(false);
    // изместване на N: 1200 · 0,9/3924 = 0,275 m < 0,45 m
    expect(r.normalShift).toBeCloseTo(0.275, 3);
    expect(r.tips).toBe(false);
    // граници: плъзгане при 0,4 · 9,81 = 3,924 m/s²; преобръщане при 9,81 · 0,9/1,8 = 4,905 m/s²
    expect(r.slideAcceleration).toBeCloseTo(3.924, 10);
    // „Леко“: моменти спрямо предния долен ръб – обръщащ Φ·h/2 = 1200 · 0,9 = 1080 N·m,
    // задържащ G·b/2 = 3924 · 0,45 = 1765,8 N·m
    expect(r.inertiaForce * (1.8 / 2)).toBeCloseTo(1080, 10);
    expect(r.weight * (0.9 / 2)).toBeCloseTo(1765.8, 10);
    expect(r.tipAcceleration).toBeCloseTo(4.905, 10);
  });

  it("два пътя: ΣM_C = 0 (Нютон–Ойлер) и кинетостатика с моменти спрямо предния ръб", () => {
    const { mass, height, width } = pallet;
    const a = 3;
    const r = translatingBlock({ ...pallet, acceleration: a });
    // Нютон–Ойлер: m·a = F; N = G; ΣM_C = 0 → N·x − F·h/2 = 0
    const friction = mass * a;
    const normal = mass * g;
    const x1 = (friction * height) / 2 / normal;
    // Кинетостатика: Φ = m·a напред в C. Спрямо предния долен ръб F_тр няма момент:
    //   G·b/2 − N·(b/2 − x) − Φ·h/2 = 0, а от ΣF_y = 0: N = G
    const phi = mass * a;
    const x2 =
      width / 2 - (mass * g * (width / 2) - (phi * height) / 2) / normal;
    expect(x1).toBeCloseTo(r.normalShift, 12);
    expect(x2).toBeCloseTo(r.normalShift, 12);
    // ΣF_x: Φ − F_тр = 0
    expect(phi - r.frictionNeeded).toBe(0);
    // на прага на преобръщане N е точно в ръба: x = b/2
    const edge = translatingBlock({ ...pallet, mu: 1, acceleration: 4.905 });
    expect(edge.normalShift).toBeCloseTo(0.45, 12);
  });

  it("плъзгане, преобръщане и „Провери се“ (Леко) 4", () => {
    // 4 m/s² > 3,924: плъзга се, но още не се преобръща
    const slide = translatingBlock({ ...pallet, acceleration: 4 });
    expect(slide.slides).toBe(true);
    expect(slide.tips).toBe(false);
    // с μ = 0,6 при 5 m/s² > 4,905: преобръща се, преди да се плъзне (0,6 · 9,81 = 5,886)
    const tip = translatingBlock({ ...pallet, mu: 0.6, acceleration: 5 });
    expect(tip.slides).toBe(false);
    expect(tip.tips).toBe(true);
    // Леко 4: шкаф h = 2 m, b = 0,6 m: a = 9,81 · 0,6/2 = 2,943 m/s²
    expect(
      translatingBlock({
        mass: 60,
        height: 2,
        width: 0.6,
        mu: 1,
        acceleration: 0,
      }).tipAcceleration,
    ).toBeCloseTo(2.943, 10);
    // в покой: N е в средата, триене не трябва
    const rest = translatingBlock({ ...pallet, acceleration: 0 });
    expect(rest.normalShift).toBe(0);
    expect(rest.frictionNeeded).toBe(0);
    expect(() => translatingBlock({ ...pallet, acceleration: -1 })).toThrow();
    expect(() =>
      translatingBlock({ ...pallet, height: 0, acceleration: 1 }),
    ).toThrow();
  });
});
