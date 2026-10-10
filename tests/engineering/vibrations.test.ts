import { describe, expect, it } from "vitest";
import {
  G_ACCELERATION,
  classifyEquilibrium,
  criticalDamping,
  dampedVibration,
  dynamicFactor,
  forcedResponse,
  forcedVibration,
  freeVibration,
  frequencyFromStaticDeflection,
  hangingSpringPotential,
  invertedPendulumPotential,
  invertedPendulumSecondDerivative,
  invertedPendulumStability,
  kinematicEquivalentForce,
  logDecrement,
  naturalFrequency,
  period,
  springsParallel,
  springsSeries,
  staticDeflection,
} from "@/lib/engineering/vibrations";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Единици: m, s, kg, N, rad. Уравнение: m·ẍ + b·ẋ + c·x = F(t).

const g = G_ACCELERATION;
const DEG = Math.PI / 180;

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

/** Дясна страна на m·ẍ + b·ẋ + c·x = F(t) като система от първи ред. */
function oscillator(
  m: number,
  b: number,
  c: number,
  force: (t: number) => number = () => 0,
) {
  return (t: number, y: number[]) => [
    y[1]!,
    (force(t) - b * y[1]! - c * y[0]!) / m,
  ];
}

/** Числена първа и втора производна (централни разлики). */
function firstDerivative(f: (x: number) => number, x: number, h = 1e-5) {
  return (f(x + h) - f(x - h)) / (2 * h);
}
function secondDerivative(f: (x: number) => number, x: number, h = 1e-4) {
  return (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
}

/**
 * Върхове (локални максимуми) на x(t) от стъпкова RK4 симулация:
 * моментът, в който скоростта минава от + към −, с линейна интерполация.
 */
function simulatedPeaks(
  f: (t: number, y: number[]) => number[],
  y0: number[],
  count: number,
  dt = 1e-4,
): { t: number; x: number }[] {
  const peaks: { t: number; x: number }[] = [];
  let y = [...y0];
  let t = 0;
  while (peaks.length < count && t < 100) {
    const next = rk4(f, y, t, t + dt, 1);
    if (y[1]! > 0 && next[1]! <= 0) {
      const fraction = y[1]! / (y[1]! - next[1]!);
      const at = rk4(f, y, t, t + dt * fraction, 1);
      peaks.push({ t: t + dt * fraction, x: at[0]! });
    }
    y = next;
    t += dt;
  }
  return peaks;
}

describe("пружини – еквивалентна коравина", () => {
  it("успоредно: коравините се събират", () => {
    // 300 + 600 = 900 N/m; „Провери се“ (Леко) 2: 225 + 225 = 450 N/m
    expect(springsParallel(300, 600)).toBe(900);
    expect(springsParallel(225, 225)).toBe(450);
    expect(springsParallel(100, 200, 300)).toBe(600);
  });

  it("последователно: събират се податливостите", () => {
    // 1/300 + 1/600 = 3/600 → c = 200 N/m
    expect(springsSeries(300, 600)).toBeCloseTo(200, 10);
    // П2: 6000·3000/(6000 + 3000) = 18 000 000/9000 = 2000 N/m
    expect(springsSeries(6000, 3000)).toBeCloseTo(2000, 9);
    // две еднакви последователно → половината
    expect(springsSeries(500, 500)).toBeCloseTo(250, 10);
  });

  it("независима проверка със сили и удължения", () => {
    // сила 60 N върху последователни 300 и 600: удължения 0,2 + 0,1 = 0,3 m → 60/0,3 = 200
    const force = 60;
    expect(force / (force / 300 + force / 600)).toBeCloseTo(
      springsSeries(300, 600),
      10,
    );
    // преместване 0,1 m при успоредни 300 и 600: сили 30 + 60 = 90 N → 90/0,1 = 900
    expect((300 * 0.1 + 600 * 0.1) / 0.1).toBeCloseTo(
      springsParallel(300, 600),
      10,
    );
    // последователното свързване е по-меко от всяка от пружините, успоредното – по-кораво
    expect(springsSeries(300, 600)).toBeLessThan(300);
    expect(springsParallel(300, 600)).toBeGreaterThan(600);
  });

  it("П2: c = c12 + c3 = 2000 + 2000 = 4000 N/m", () => {
    expect(springsParallel(springsSeries(6000, 3000), 2000)).toBeCloseTo(
      4000,
      9,
    );
  });

  it("отказва невалиден вход", () => {
    expect(() => springsParallel()).toThrow();
    expect(() => springsSeries(100, 0)).toThrow();
    expect(() => springsParallel(100, -5)).toThrow();
  });
});

describe("Пример Л1 – свободни трептения, m = 4 kg, c = 1600 N/m, x0 = 0,03 m, v0 = 0,8 m/s", () => {
  const input = { mass: 4, stiffness: 1600, x0: 0.03, v0: 0.8 };
  const result = freeVibration(input);

  it("честота, период, амплитуда", () => {
    // k = √(1600/4) = √400 = 20 rad/s
    expect(result.k).toBeCloseTo(20, 12);
    expect(naturalFrequency(1600, 4)).toBeCloseTo(20, 12);
    // T0 = 2π/20 = 0,31416 s → 0,314 s; f = 1/0,31416 = 3,183 Hz → 3,18
    expect(result.period).toBeCloseTo(0.314, 3);
    expect(period(20)).toBeCloseTo(0.31416, 5);
    expect(result.frequencyHz).toBeCloseTo(3.18, 2);
    expect(1 / 0.314).toBeCloseTo(3.18, 2);
    // v0/k = 0,8/20 = 0,04 m; A = √(0,03² + 0,04²) = √0,0025 = 0,05 m
    expect(0.8 / result.k).toBeCloseTo(0.04, 12);
    expect(result.amplitude).toBeCloseTo(0.05, 12);
    // най-голяма скорост k·A = 20 · 0,05 = 1 m/s
    expect(result.maxSpeed).toBeCloseTo(1, 12);
    // tg α = k·x0/v0 = 0,6/0,8 = 0,75 → α = 36,87°
    expect(result.phase / DEG).toBeCloseTo(36.87, 2);
  });

  it("двата записа на решението съвпадат и изпълняват началните условия", () => {
    expect(result.x(0)).toBeCloseTo(0.03, 12);
    expect(result.v(0)).toBeCloseTo(0.8, 12);
    for (const t of [0.05, 0.1, 0.2, 0.37]) {
      expect(result.x(t)).toBeCloseTo(
        result.amplitude * Math.sin(result.k * t + result.phase),
        12,
      );
    }
    // x(0,1) = 0,03·cos 2 + 0,04·sin 2 = 0,03·(−0,41615) + 0,04·0,90930 = 0,02389 m
    expect(result.x(0.1)).toBeCloseTo(0.02389, 5);
  });

  it("затвореното решение съвпада с RK4 на 4ẍ + 1600x = 0", () => {
    for (const t of [0.1, 0.25, 1]) {
      const [x, v] = rk4(oscillator(4, 0, 1600), [0.03, 0.8], 0, t, 4000);
      expect(result.x(t)).toBeCloseTo(x!, 8);
      expect(result.v(t)).toBeCloseTo(v!, 6);
    }
  });

  it("енергията се запазва без затихване", () => {
    // ½·4·0,8² + ½·1600·0,03² = 1,28 + 0,72 = 2 J = ½·1600·0,05²
    const energy = (x: number, v: number) =>
      0.5 * 4 * v * v + 0.5 * 1600 * x * x;
    expect(energy(0.03, 0.8)).toBeCloseTo(2, 12);
    expect(result.energy).toBeCloseTo(2, 12);
    for (const t of [0.07, 0.3, 1.9]) {
      expect(energy(result.x(t), result.v(t))).toBeCloseTo(2, 10);
    }
    // и в числената симулация – след 20 периода
    const [x, v] = rk4(oscillator(4, 0, 1600), [0.03, 0.8], 0, 6.2832, 60000);
    expect(energy(x!, v!)).toBeCloseTo(2, 8);
  });

  it("периодът и амплитудата от симулацията", () => {
    const peaks = simulatedPeaks(oscillator(4, 0, 1600), [0.03, 0.8], 3);
    expect(peaks[0]!.x).toBeCloseTo(0.05, 7);
    expect(peaks[1]!.x).toBeCloseTo(0.05, 7);
    expect(peaks[1]!.t - peaks[0]!.t).toBeCloseTo(0.31416, 5);
  });

  it("периодът не зависи от началните условия", () => {
    const other = freeVibration({ ...input, x0: 0.2, v0: -3 });
    expect(other.period).toBeCloseTo(result.period, 12);
  });
});

describe("статично преместване и потенциална енергия на окачено тяло (Леко)", () => {
  it("x_ст = m·g/c", () => {
    // 4 · 9,81 = 39,24 N; 39,24/1600 = 0,024525 m → 0,0245 m
    expect(4 * g).toBeCloseTo(39.24, 12);
    expect(staticDeflection(4, 1600)).toBeCloseTo(0.024525, 12);
  });

  it("Π = 800x² − 39,24x в трите точки от текста", () => {
    const system = { mass: 4, stiffness: 1600 };
    // x = 0: Π = 0
    expect(hangingSpringPotential(system, 0)).toBeCloseTo(0, 12);
    // x = 0,0245: 800·0,00060025 − 39,24·0,0245 = 0,4802 − 0,9614 = −0,481 J
    expect(hangingSpringPotential(system, 0.0245)).toBeCloseTo(-0.481, 3);
    // x = 0,0490: 800·0,002401 − 39,24·0,049 = 1,9208 − 1,9228 = −0,002 ≈ 0 J
    expect(hangingSpringPotential(system, 0.049)).toBeCloseTo(0, 2);
    // точно: Π(2·x_ст) = 0, Π(x_ст) = −(m·g)²/(2c) = −39,24²/3200 = −0,4812 J
    expect(hangingSpringPotential(system, 2 * 0.024525)).toBeCloseTo(0, 12);
    expect(hangingSpringPotential(system, 0.024525)).toBeCloseTo(-0.4812, 4);
  });

  it("минимумът е в положението на статично равновесие (числени производни)", () => {
    const system = { mass: 4, stiffness: 1600 };
    const potential = (x: number) => hangingSpringPotential(system, x);
    const xs = staticDeflection(4, 1600);
    expect(firstDerivative(potential, xs)).toBeCloseTo(0, 6);
    // Π″ = c = 1600 N/m > 0
    expect(secondDerivative(potential, xs)).toBeCloseTo(1600, 3);
    expect(classifyEquilibrium(secondDerivative(potential, xs))).toBe("stable");
    expect(potential(xs)).toBeLessThan(potential(xs - 0.005));
    expect(potential(xs)).toBeLessThan(potential(xs + 0.005));
  });

  it("честота от статичното преместване: k = √(g/x_ст)", () => {
    // същото тяло: √(9,81/0,024525) = √400 = 20 rad/s
    expect(
      frequencyFromStaticDeflection(staticDeflection(4, 1600)),
    ).toBeCloseTo(20, 10);
    // „В реалния живот“: x_ст = 4 mm → √(9,81/0,004) = √2452,5 = 49,5 rad/s
    const k = frequencyFromStaticDeflection(0.004);
    expect(9.81 / 0.004).toBeCloseTo(2452.5, 9);
    expect(k).toBeCloseTo(49.5, 1);
    // f = 49,52/(2π) = 7,88 Hz; с отпечатаното 49,5: 49,5/6,2832 = 7,88
    expect(k / (2 * Math.PI)).toBeCloseTo(7.88, 2);
    expect(49.5 / (2 * Math.PI)).toBeCloseTo(7.88, 2);
    // „Провери се“ (Подробно) 2: 20 mm → √490,5 = 22,15 rad/s; T0 = 2π/22,15 = 0,284 s
    const k2 = frequencyFromStaticDeflection(0.02);
    expect(9.81 / 0.02).toBeCloseTo(490.5, 9);
    expect(k2).toBeCloseTo(22.15, 2);
    expect(period(k2)).toBeCloseTo(0.284, 3);
    expect((2 * Math.PI) / 22.15).toBeCloseTo(0.284, 3);
  });
});

describe("Пример П2 – свободни затихващи трептения, m = 10 kg, c = 4000 N/m, b = 60 N·s/m", () => {
  const input = { mass: 10, stiffness: 4000, damping: 60, x0: 0.05, v0: 0.6 };
  const result = dampedVibration(input);

  it("характеристики на трептенето", () => {
    // k = √(4000/10) = 20 rad/s; n = 60/(2·10) = 3 s⁻¹
    expect(result.k).toBeCloseTo(20, 12);
    expect(result.n).toBeCloseTo(3, 12);
    expect(result.regime).toBe("small");
    // k1 = √(400 − 9) = √391 = 19,774 rad/s
    expect(result.k1).toBeCloseTo(19.774, 3);
    // τ1 = 2π/19,774 = 0,31775 s; T0 = 2π/20 = 0,31416 s
    expect(result.period).toBeCloseTo(0.31775, 5);
    expect((2 * Math.PI) / 19.774).toBeCloseTo(0.31775, 5);
    expect(period(result.k)).toBeCloseTo(0.31416, 5);
    expect(result.period).toBeGreaterThan(period(result.k));
    // δ = n·τ1 = 3 · 0,31775 = 0,953; e^0,953 = 2,59
    expect(result.decrement).toBeCloseTo(0.953, 3);
    expect(3 * 0.31775).toBeCloseTo(0.953, 3);
    expect(result.ratio).toBeCloseTo(2.59, 2);
    expect(Math.exp(0.953)).toBeCloseTo(2.59, 2);
    // b_кр = 2·√(4000·10) = 2·200 = 400 N·s/m
    expect(criticalDamping(10, 4000)).toBeCloseTo(400, 10);
  });

  it("константи от началните условия", () => {
    // C1 = x0 = 0,05; C2 = (0,6 + 3·0,05)/19,774 = 0,75/19,774 = 0,037929 m
    expect(0.75 / 19.774).toBeCloseTo(0.037929, 6);
    // A = √(0,05² + 0,037929²) = √(0,0025 + 0,0014386) = 0,06276 m
    expect(result.amplitude).toBeCloseTo(0.06276, 5);
    expect(Math.hypot(0.05, 0.037929)).toBeCloseTo(0.06276, 5);
    // tg α = C1/C2 = 0,05/0,037929 = 1,318 → α = 52,8°
    expect(Math.tan(result.phase)).toBeCloseTo(1.318, 3);
    expect(0.05 / 0.037929).toBeCloseTo(1.318, 3);
    expect(result.phase / DEG).toBeCloseTo(52.8, 1);
    expect(Math.atan(1.318) / DEG).toBeCloseTo(52.8, 1);
    expect(result.x(0)).toBeCloseTo(0.05, 12);
    expect(result.v(0)).toBeCloseTo(0.6, 12);
  });

  it("x(0,2 s) = −0,0340 m", () => {
    // k1·t = 19,774·0,2 = 3,9548 rad; cos = −0,68721; sin = −0,72646; e^(−0,6) = 0,54881
    expect(Math.cos(3.9548)).toBeCloseTo(-0.68721, 4);
    expect(Math.sin(3.9548)).toBeCloseTo(-0.72646, 4);
    expect(Math.exp(-0.6)).toBeCloseTo(0.54881, 5);
    // x = 0,54881·(0,05·(−0,68721) + 0,037929·(−0,72646))
    //   = 0,54881·(−0,034361 − 0,027554) = 0,54881·(−0,061915) = −0,03398 m
    const byHand = 0.54881 * (0.05 * -0.68721 + 0.037929 * -0.72646);
    expect(byHand).toBeCloseTo(-0.034, 4);
    expect(result.x(0.2)).toBeCloseTo(-0.034, 4);
  });

  it("затвореното решение съвпада с RK4 на 10ẍ + 60ẋ + 4000x = 0", () => {
    for (const t of [0.1, 0.2, 0.5, 1.5]) {
      const [x, v] = rk4(oscillator(10, 60, 4000), [0.05, 0.6], 0, t, 6000);
      expect(result.x(t)).toBeCloseTo(x!, 9);
      expect(result.v(t)).toBeCloseTo(v!, 7);
    }
    // записът с амплитуда и фаза е същото решение
    for (const t of [0.13, 0.4]) {
      expect(result.x(t)).toBeCloseTo(
        result.amplitude *
          Math.exp(-3 * t) *
          Math.sin(result.k1 * t + result.phase),
        12,
      );
    }
  });

  it("логаритмичният декремент от симулираните върхове", () => {
    const peaks = simulatedPeaks(oscillator(10, 60, 4000), [0.05, 0.6], 3);
    // първи връх 0,0575 m при t = 0,0252 s; втори 0,0222 m при t = 0,3430 s
    expect(peaks[0]!.t).toBeCloseTo(0.0252, 4);
    expect(peaks[0]!.x).toBeCloseTo(0.0575, 4);
    expect(peaks[1]!.t).toBeCloseTo(0.343, 3);
    expect(peaks[1]!.x).toBeCloseTo(0.0222, 4);
    // върховете са през τ1 = 0,31775 s
    expect(peaks[1]!.t - peaks[0]!.t).toBeCloseTo(0.31775, 5);
    expect(peaks[2]!.t - peaks[1]!.t).toBeCloseTo(0.31775, 5);
    // δ = ln(x1/x2) = 0,953 и е едно и също за всяка двойка
    expect(logDecrement(peaks[0]!.x, peaks[1]!.x)).toBeCloseTo(0.953, 3);
    expect(logDecrement(peaks[1]!.x, peaks[2]!.x)).toBeCloseTo(0.953, 3);
    expect(logDecrement(peaks[0]!.x, peaks[2]!.x, 2)).toBeCloseTo(0.953, 3);
    // 0,0575/0,0222 = 2,59
    expect(0.0575 / 0.0222).toBeCloseTo(2.59, 2);
  });

  it("енергията намалява при затихване", () => {
    const energy = (t: number) =>
      0.5 * 10 * result.v(t) ** 2 + 0.5 * 4000 * result.x(t) ** 2;
    expect(energy(0.3)).toBeLessThan(energy(0));
    expect(energy(1)).toBeLessThan(energy(0.3));
  });
});

describe("затихване – гранично и голямо, „Провери се“", () => {
  it("гранично затихване n = k: движението е апериодично и съвпада с RK4", () => {
    const result = dampedVibration({
      mass: 10,
      stiffness: 4000,
      damping: 400,
      x0: 0.05,
      v0: 0.6,
    });
    expect(result.regime).toBe("critical");
    for (const t of [0.05, 0.2, 0.6]) {
      const [x] = rk4(oscillator(10, 400, 4000), [0.05, 0.6], 0, t, 6000);
      expect(result.x(t)).toBeCloseTo(x!, 9);
    }
    // x = e^(−20t)·(0,05 + 1,6t) остава положително – няма минаване през нулата
    for (const t of [0.1, 0.5, 1]) expect(result.x(t)).toBeGreaterThan(0);
  });

  it("голямо затихване n > k съвпада с RK4", () => {
    const result = dampedVibration({
      mass: 10,
      stiffness: 4000,
      damping: 600,
      x0: 0.05,
      v0: 0.6,
    });
    expect(result.regime).toBe("large");
    expect(Number.isNaN(result.decrement)).toBe(true);
    for (const t of [0.05, 0.2, 0.6]) {
      const [x, v] = rk4(oscillator(10, 600, 4000), [0.05, 0.6], 0, t, 8000);
      expect(result.x(t)).toBeCloseTo(x!, 9);
      expect(result.v(t)).toBeCloseTo(v!, 7);
    }
  });

  it("без демпфер се получават свободните незатихващи трептения", () => {
    const damped = dampedVibration({
      mass: 4,
      stiffness: 1600,
      damping: 0,
      x0: 0.03,
      v0: 0.8,
    });
    const free = freeVibration({ mass: 4, stiffness: 1600, x0: 0.03, v0: 0.8 });
    expect(damped.decrement).toBeCloseTo(0, 12);
    expect(damped.x(0.37)).toBeCloseTo(free.x(0.37), 12);
  });

  it("„Провери се“ (Леко) 3: върхове 40 mm и 25 mm", () => {
    // 40/25 = 1,6; δ = ln 1,6 = 0,470; следващият връх 25/1,6 = 15,6 mm
    expect(logDecrement(40, 25)).toBeCloseTo(0.47, 3);
    expect(25 / 1.6).toBeCloseTo(15.6, 1);
  });

  it("„Провери се“ (Подробно) 3: m = 2 kg, c = 800 N/m, b = 8 N·s/m", () => {
    const result = dampedVibration({
      mass: 2,
      stiffness: 800,
      damping: 8,
      x0: 0.01,
      v0: 0,
    });
    // k = √400 = 20; n = 8/4 = 2; k1 = √(400 − 4) = √396 = 19,90 rad/s
    expect(result.k).toBeCloseTo(20, 12);
    expect(result.n).toBeCloseTo(2, 12);
    expect(result.k1).toBeCloseTo(19.9, 2);
    // τ1 = 2π/19,90 = 0,3157 s; δ = 2 · 0,3157 = 0,631; e^0,631 = 1,88
    expect(result.period).toBeCloseTo(0.3157, 4);
    expect((2 * Math.PI) / 19.9).toBeCloseTo(0.3157, 4);
    expect(result.decrement).toBeCloseTo(0.631, 3);
    expect(2 * 0.3157).toBeCloseTo(0.631, 3);
    expect(result.ratio).toBeCloseTo(1.88, 2);
    expect(Math.exp(0.631)).toBeCloseTo(1.88, 2);
  });

  it("отказва невалиден вход", () => {
    expect(() =>
      dampedVibration({ mass: 1, stiffness: 1, damping: -1, x0: 0, v0: 0 }),
    ).toThrow();
    expect(() => logDecrement(1, 0)).toThrow();
    expect(() => logDecrement(2, 1, 0)).toThrow();
    expect(() => naturalFrequency(0, 1)).toThrow();
    expect(() => period(0)).toThrow();
  });
});

describe("динамичен коефициент", () => {
  it("η = 1/|1 − (θ/k)²| при няколко отношения на честотите", () => {
    // r = 0: 1; r = 0,5: 1/0,75 = 1,333; r = 0,75: 1/0,4375 = 2,2857;
    // r = 0,8: 1/0,36 = 2,778; r = 0,95: 1/0,0975 = 10,256
    expect(dynamicFactor(0)).toBeCloseTo(1, 12);
    expect(dynamicFactor(0.5)).toBeCloseTo(1.333, 3);
    expect(dynamicFactor(0.75)).toBeCloseTo(2.2857, 4);
    expect(dynamicFactor(0.8)).toBeCloseTo(2.778, 3);
    expect(dynamicFactor(0.95)).toBeCloseTo(10.256, 3);
    // над резонанса: r = 1,25: 1/0,5625 = 1,778; r = √2: 1; r = 2: 1/3 = 0,333
    expect(dynamicFactor(1.25)).toBeCloseTo(1.778, 3);
    expect(dynamicFactor(Math.SQRT2)).toBeCloseTo(1, 10);
    expect(dynamicFactor(2)).toBeCloseTo(0.333, 3);
    // резонанс без затихване
    expect(dynamicFactor(1)).toBe(Number.POSITIVE_INFINITY);
    // за всяко r съвпада с пряката формула
    for (const r of [0.1, 0.3, 0.6, 0.9, 1.1, 1.5, 3]) {
      expect(dynamicFactor(r)).toBeCloseTo(1 / Math.abs(1 - r * r), 10);
    }
  });

  it("със затихване върхът е краен", () => {
    // при r = 1: η = 1/(2·n/k); n/k = 0,15 → 3,333
    expect(dynamicFactor(1, 0.15)).toBeCloseTo(3.333, 3);
    expect(dynamicFactor(0.75, 0.15)).toBeLessThan(dynamicFactor(0.75));
  });
});

describe("Пример Л2 – принудени трептения, m = 4 kg, c = 1600 N/m, F0 = 40 N", () => {
  const base = { mass: 4, stiffness: 1600, forceAmplitude: 40 };

  it("θ = 15 rad/s", () => {
    const result = forcedVibration({ ...base, forcingFrequency: 15 });
    // x_ст = 40/1600 = 0,025 m; θ/k = 15/20 = 0,75; 0,75² = 0,5625
    expect(result.staticDisplacement).toBeCloseTo(0.025, 12);
    expect(result.frequencyRatio).toBeCloseTo(0.75, 12);
    // η = 1/(1 − 0,5625) = 1/0,4375 = 2,2857 → 2,29
    expect(result.dynamicFactor).toBeCloseTo(2.2857, 4);
    // B = 2,2857 · 0,025 = 0,0571 m
    expect(result.amplitude).toBeCloseTo(0.0571, 4);
    expect(2.2857 * 0.025).toBeCloseTo(0.0571, 4);
    expect(result.phaseLag).toBeCloseTo(0, 12);
  });

  it("θ = 19 rad/s – близо до резонанса", () => {
    const result = forcedVibration({ ...base, forcingFrequency: 19 });
    // θ/k = 0,95; 0,95² = 0,9025; η = 1/0,0975 = 10,256; B = 10,256·0,025 = 0,256 m
    expect(result.dynamicFactor).toBeCloseTo(10.256, 3);
    expect(result.amplitude).toBeCloseTo(0.256, 3);
    expect(10.256 * 0.025).toBeCloseTo(0.256, 3);
  });

  it("θ = 40 rad/s – далеч над резонанса", () => {
    const result = forcedVibration({ ...base, forcingFrequency: 40 });
    // θ/k = 2; η = 1/|1 − 4| = 0,333; B = 0,025/3 = 0,0083 m; противофаза
    expect(result.dynamicFactor).toBeCloseTo(0.333, 3);
    expect(result.amplitude).toBeCloseTo(0.0083, 4);
    expect(result.phaseLag).toBeCloseTo(Math.PI, 12);
  });

  it("при θ = k амплитудата без затихване е безкрайна", () => {
    const result = forcedVibration({ ...base, forcingFrequency: 20 });
    expect(result.amplitude).toBe(Number.POSITIVE_INFINITY);
  });

  it("амплитудата от симулация с малък демпфер клони към B", () => {
    // RK4 с b = 0 пази собствените трептения завинаги; затова проверката е
    // спрямо пълното решение: x = B·(sin θt − (θ/k)·sin kt)
    const B = forcedVibration({ ...base, forcingFrequency: 15 }).amplitude;
    for (const t of [0.2, 0.9, 2.3]) {
      const [x] = rk4(
        oscillator(4, 0, 1600, (time) => 40 * Math.sin(15 * time)),
        [0, 0],
        0,
        t,
        20000,
      );
      expect(B * (Math.sin(15 * t) - 0.75 * Math.sin(20 * t))).toBeCloseTo(
        x!,
        8,
      );
    }
  });

  it("„Провери се“ (Леко) 4: θ = 0,5k и θ = 2k", () => {
    // 1/(1 − 0,25) = 1,33; 1/|1 − 4| = 0,33
    expect(dynamicFactor(0.5)).toBeCloseTo(1.33, 2);
    expect(dynamicFactor(2)).toBeCloseTo(0.33, 2);
  });
});

describe("Пример П3 – принудени трептения, m = 10 kg, c = 4000 N/m, F0 = 120 N, θ = 16 rad/s", () => {
  const base = {
    mass: 10,
    stiffness: 4000,
    forceAmplitude: 120,
    forcingFrequency: 16,
  };
  const force = (t: number) => 120 * Math.sin(16 * t);

  it("без затихване: амплитуда и динамичен коефициент", () => {
    const result = forcedVibration(base);
    // h = 120/10 = 12 m/s²; x_ст = 120/4000 = 0,03 m; θ/k = 0,8
    expect(result.h).toBeCloseTo(12, 12);
    expect(result.staticDisplacement).toBeCloseTo(0.03, 12);
    expect(result.frequencyRatio).toBeCloseTo(0.8, 12);
    // η = 1/(1 − 0,64) = 1/0,36 = 2,778; B = 12/(400 − 256) = 12/144 = 0,0833 m
    expect(result.dynamicFactor).toBeCloseTo(2.778, 3);
    expect(result.amplitude).toBeCloseTo(0.0833, 4);
    expect(12 / (400 - 256)).toBeCloseTo(0.0833, 4);
    expect(2.778 * 0.03).toBeCloseTo(0.0833, 4);
  });

  it("пълното решение при нулеви начални условия съвпада с RK4", () => {
    const x = forcedResponse(base);
    // x = 0,0833·(sin 16t − 0,8·sin 20t)
    for (const t of [0.3, 1, 2.7]) {
      const [numeric] = rk4(
        oscillator(10, 0, 4000, force),
        [0, 0],
        0,
        t,
        30000,
      );
      expect(x(t)).toBeCloseTo(numeric!, 8);
      expect(x(t)).toBeCloseTo(
        (12 / 144) * (Math.sin(16 * t) - 0.8 * Math.sin(20 * t)),
        12,
      );
    }
    // x(0,3) = 0,08333·(sin 4,8 − 0,8·sin 6) = 0,08333·(−0,99616 + 0,22353) = −0,0644 m
    expect(x(0.3)).toBeCloseTo(-0.0644, 4);
  });

  it("пълното решение с ненулеви начални условия съвпада с RK4", () => {
    const x = forcedResponse({ ...base, x0: 0.02, v0: -0.5 });
    for (const t of [0.4, 1.3]) {
      const [numeric] = rk4(
        oscillator(10, 0, 4000, force),
        [0.02, -0.5],
        0,
        t,
        30000,
      );
      expect(x(t)).toBeCloseTo(numeric!, 8);
    }
  });

  it("със затихване b = 60 N·s/m: формулата за амплитудата", () => {
    const result = forcedVibration({ ...base, damping: 60 });
    // (k² − θ²)² + 4n²θ² = 144² + (2·3·16)² = 20 736 + 9216 = 29 952; √ = 173,07
    expect(144 ** 2 + 96 ** 2).toBe(29952);
    expect(Math.sqrt(29952)).toBeCloseTo(173.07, 2);
    // B = 12/173,07 = 0,0693 m
    expect(result.amplitude).toBeCloseTo(0.0693, 4);
    expect(12 / 173.07).toBeCloseTo(0.0693, 4);
    // tg γ = 96/144 = 0,6667 → γ = 33,69°
    expect(Math.tan(result.phaseLag)).toBeCloseTo(96 / 144, 10);
    expect(result.phaseLag / DEG).toBeCloseTo(33.69, 2);
    // по-малка от амплитудата без затихване 0,0833 m
    expect(result.amplitude).toBeLessThan(forcedVibration(base).amplitude);
  });

  it("със затихване: пълното решение съвпада с RK4, а след затихване на собствените остава B", () => {
    const x = forcedResponse({ ...base, damping: 60, x0: 0.01, v0: 0.2 });
    for (const t of [0.2, 0.8, 2]) {
      const [numeric] = rk4(
        oscillator(10, 60, 4000, force),
        [0.01, 0.2],
        0,
        t,
        30000,
      );
      expect(x(t)).toBeCloseTo(numeric!, 8);
    }
    // след 10 s собствените трептения са затихнали (e^(−30)); върховете са B = 0,0693 m
    const state = rk4(oscillator(10, 60, 4000, force), [0, 0], 0, 10, 100000);
    let largest = 0;
    let y = state;
    for (let i = 0; i < 8000; i++) {
      y = rk4(
        oscillator(10, 60, 4000, force),
        y,
        10 + i * 1e-4,
        10 + (i + 1) * 1e-4,
        1,
      );
      largest = Math.max(largest, Math.abs(y[0]!));
    }
    expect(largest).toBeCloseTo(0.0693, 4);
    const steady = forcedVibration({ ...base, damping: 60 });
    expect(steady.steady(10.123)).toBeCloseTo(
      rk4(oscillator(10, 60, 4000, force), [0, 0], 0, 10.123, 100000)[0]!,
      8,
    );
  });

  it("резонанс θ = k = 20 rad/s", () => {
    // със затихване: B = h/(2·n·k) = 12/(2·3·20) = 0,100 m
    const damped = forcedVibration({
      ...base,
      forcingFrequency: 20,
      damping: 60,
    });
    expect(damped.amplitude).toBeCloseTo(0.1, 12);
    expect(damped.phaseLag / DEG).toBeCloseTo(90, 10);
    // без затихване: x = −(h/2k)·t·cos kt + (h/2k²)·sin kt; h/(2k) = 0,3 m/s
    const x = forcedResponse({ ...base, forcingFrequency: 20 });
    for (const t of [0.5, 1, 2]) {
      const [numeric] = rk4(
        oscillator(10, 0, 4000, (time) => 120 * Math.sin(20 * time)),
        [0, 0],
        0,
        t,
        30000,
      );
      expect(x(t)).toBeCloseTo(numeric!, 8);
      expect(x(t)).toBeCloseTo(
        -0.3 * t * Math.cos(20 * t) + (12 / 800) * Math.sin(20 * t),
        12,
      );
    }
    // отклоненията растат: |x| след 2 s е над това след 1 s
    expect(Math.abs(x(2))).toBeGreaterThan(Math.abs(x(1)));
  });

  it("кинематично смущение: ξ0 = 0,02 m е като сила 80 N", () => {
    // F0 = c·ξ0 = 4000 · 0,02 = 80 N
    expect(kinematicEquivalentForce(4000, 0.02)).toBeCloseTo(80, 12);
    // RK4 на 10ẍ + 4000(x − ξ) = 0 съвпада с решението за сила 80 N
    const x = forcedResponse({ ...base, forceAmplitude: 80 });
    const [numeric] = rk4(
      (t, y) => [y[1]!, (-4000 * (y[0]! - 0.02 * Math.sin(16 * t))) / 10],
      [0, 0],
      0,
      0.9,
      30000,
    );
    expect(x(0.9)).toBeCloseTo(numeric!, 8);
  });

  it("„Провери се“ (Подробно) 4: x_ст = 4 mm, θ/k = 1,25", () => {
    // 1,25² = 1,5625; η = 1/0,5625 = 1,778; B = 1,778 · 4 = 7,11 mm
    expect(dynamicFactor(1.25)).toBeCloseTo(1.778, 3);
    expect(1.778 * 4).toBeCloseTo(7.11, 2);
    // θ > k: противофаза
    const result = forcedVibration({
      mass: 1,
      stiffness: 100,
      forceAmplitude: 0.4,
      forcingFrequency: 12.5,
    });
    expect(result.staticDisplacement).toBeCloseTo(0.004, 12);
    expect(result.amplitude * 1000).toBeCloseTo(7.11, 2);
    expect(result.phaseLag).toBeCloseTo(Math.PI, 12);
  });

  it("отказва голямо затихване в пълното решение", () => {
    expect(() => forcedResponse({ ...base, damping: 400 })).toThrow();
  });
});

describe("Пример П1 – обърнато махало с пружина, m = 20 kg, l = 1,5 m, c = 400 N/m, d = 1 m", () => {
  const input = { mass: 20, length: 1.5, stiffness: 400, springHeight: 1 };
  const potential = (phi: number) => invertedPendulumPotential(input, phi);
  const result = invertedPendulumStability(input);

  it("отвесното положение е равновесно и устойчиво", () => {
    // m·g·l = 20 · 9,81 · 1,5 = 294,3 N·m; c·d² = 400 · 1 = 400 N·m
    expect(result.weightTerm).toBeCloseTo(294.3, 10);
    expect(result.springTerm).toBeCloseTo(400, 10);
    // Π″(0) = 400 − 294,3 = 105,7 N·m > 0
    expect(result.secondDerivative).toBeCloseTo(105.7, 10);
    expect(result.kind).toBe("stable");
    // гранична коравина c_кр = 294,3/1² = 294,3 N/m
    expect(result.criticalStiffness).toBeCloseTo(294.3, 10);
  });

  it("знакът на числената втора производна на Π потвърждава извода", () => {
    expect(firstDerivative(potential, 0)).toBeCloseTo(0, 8);
    const numeric = secondDerivative(potential, 0);
    expect(numeric).toBeCloseTo(105.7, 3);
    expect(numeric).toBeGreaterThan(0);
    expect(classifyEquilibrium(numeric)).toBe("stable");
    expect(invertedPendulumSecondDerivative(input, 0)).toBeCloseTo(numeric, 3);
    // Π(0) = 294,3 J е по-малко от стойностите наблизо
    expect(potential(0)).toBeCloseTo(294.3, 10);
    expect(potential(0.1)).toBeGreaterThan(potential(0));
    expect(potential(-0.1)).toBeGreaterThan(potential(0));
  });

  it("малки трептения около отвеса", () => {
    // a = m·l² = 20 · 2,25 = 45 kg·m²; k² = 105,7/45 = 2,3489; k = 1,5326 rad/s
    expect(result.inertia).toBeCloseTo(45, 12);
    expect(105.7 / 45).toBeCloseTo(2.3489, 4);
    expect(result.k).toBeCloseTo(1.5326, 4);
    expect(Math.sqrt(2.3489)).toBeCloseTo(1.5326, 4);
    // T0 = 2π/1,5326 = 4,10 s
    expect(result.period).toBeCloseTo(4.1, 2);
    expect((2 * Math.PI) / 1.5326).toBeCloseTo(4.1, 2);
  });

  it("периодът от RK4 на нелинейното уравнение m·l²·φ̈ = −Π′(φ)", () => {
    const rhs = (_t: number, y: number[]) => [
      y[1]!,
      -firstDerivative(potential, y[0]!) / 45,
    ];
    // пускане от покой при 0,01 rad: върховете са в t = T0, 2·T0
    const peaks = simulatedPeaks(rhs, [0.0099999, 1e-9], 2, 1e-3);
    expect(peaks[1]!.t - peaks[0]!.t).toBeCloseTo(4.1, 2);
    expect(peaks[1]!.x).toBeCloseTo(0.01, 5);
  });

  it("наклонените равновесни положения са неустойчиви", () => {
    // cos φ = 294,3/400 = 0,73575 → φ = 42,63°
    expect(294.3 / 400).toBeCloseTo(0.73575, 12);
    expect(result.tiltedEquilibriumDeg).toBeCloseTo(42.63, 2);
    const phi = result.tiltedEquilibriumDeg * DEG;
    expect(firstDerivative(potential, phi)).toBeCloseTo(0, 5);
    // Π″ = c·d²·(cos²φ − 1) = 400·(0,54133 − 1) = −183,5 N·m
    expect(0.73575 ** 2).toBeCloseTo(0.54133, 5);
    expect(400 * (0.54133 - 1)).toBeCloseTo(-183.5, 1);
    expect(secondDerivative(potential, phi)).toBeCloseTo(-183.5, 1);
    expect(invertedPendulumSecondDerivative(input, phi)).toBeCloseTo(-183.5, 1);
    expect(classifyEquilibrium(secondDerivative(potential, phi))).toBe(
      "unstable",
    );
    expect(firstDerivative(potential, -phi)).toBeCloseTo(0, 5);
  });

  it("с по-мека пружина c = 200 N/m равновесието е неустойчиво", () => {
    const soft = { ...input, stiffness: 200 };
    const softResult = invertedPendulumStability(soft);
    // Π″(0) = 200 − 294,3 = −94,3 N·m
    expect(softResult.secondDerivative).toBeCloseTo(-94.3, 10);
    expect(softResult.kind).toBe("unstable");
    expect(Number.isNaN(softResult.k)).toBe(true);
    expect(Number.isNaN(softResult.tiltedEquilibriumDeg)).toBe(true);
    const softPotential = (phi: number) => invertedPendulumPotential(soft, phi);
    expect(secondDerivative(softPotential, 0)).toBeCloseTo(-94.3, 3);
    // симулация: от 0,01 rad прътът се отдалечава от отвеса
    const [phi] = rk4(
      (_t, y) => [y[1]!, -firstDerivative(softPotential, y[0]!) / 45],
      [0.01, 0],
      0,
      3,
      30000,
    );
    expect(phi!).toBeGreaterThan(0.3);
  });

  it("при граничната коравина честотата е нула", () => {
    const limit = invertedPendulumStability({ ...input, stiffness: 294.3 });
    expect(limit.secondDerivative).toBeCloseTo(0, 9);
    // малко над границата периодът е много дълъг
    const near = invertedPendulumStability({ ...input, stiffness: 295 });
    expect(near.period).toBeGreaterThan(45);
  });

  it("„Провери се“ (Подробно) 5: пружината на d = 0,8 m", () => {
    const lower = invertedPendulumStability({ ...input, springHeight: 0.8 });
    // c·d² = 400 · 0,64 = 256 N·m < 294,3 → неустойчиво
    expect(lower.springTerm).toBeCloseTo(256, 10);
    expect(lower.kind).toBe("unstable");
    // нужна височина d > √(294,3/400) = √0,73575 = 0,858 m
    expect(Math.sqrt(294.3 / 400)).toBeCloseTo(0.858, 3);
    expect(
      invertedPendulumStability({ ...input, springHeight: 0.86 }).kind,
    ).toBe("stable");
  });

  it("отказва невалиден вход", () => {
    expect(() =>
      invertedPendulumStability({ ...input, springHeight: 2 }),
    ).toThrow();
    expect(() => invertedPendulumPotential({ ...input, mass: 0 }, 0)).toThrow();
  });
});

describe("„Провери се“ – останалите числа", () => {
  it("(Леко) 2: 0,5 kg на две успоредни пружини по 225 N/m", () => {
    // c = 450 N/m; k = √(450/0,5) = √900 = 30 rad/s; T0 = 2π/30 = 0,209 s
    const k = naturalFrequency(springsParallel(225, 225), 0.5);
    expect(k).toBeCloseTo(30, 12);
    expect(period(k)).toBeCloseTo(0.209, 3);
  });

  it("(Подробно) 1: Π = 2q³ − 6q", () => {
    const potential = (q: number) => 2 * q ** 3 - 6 * q;
    // Π′ = 6q² − 6 = 0 → q = ±1; Π″ = 12q: +12 (устойчиво) и −12 (неустойчиво)
    expect(firstDerivative(potential, 1)).toBeCloseTo(0, 6);
    expect(firstDerivative(potential, -1)).toBeCloseTo(0, 6);
    expect(secondDerivative(potential, 1)).toBeCloseTo(12, 4);
    expect(secondDerivative(potential, -1)).toBeCloseTo(-12, 4);
    expect(classifyEquilibrium(12)).toBe("stable");
    expect(classifyEquilibrium(-12)).toBe("unstable");
    expect(classifyEquilibrium(0)).toBe("undecided");
  });
});
