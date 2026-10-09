/**
 * Кинематика на точка (Теоретична механика – II част, Глава 1).
 *
 * Мерни единици: дължини в m, време в s, скорости в m/s, ускорения в m/s².
 * Ъглите във формулите са в rad. Скорост в km/h се обръща в m/s с делене на 3,6.
 * (Останалите файлове в lib/engineering работят в kN; тук сили няма.)
 *
 * Знаци: оста x е надясно, оста y е НАГОРЕ.
 *  - Тангенциалното ускорение a_τ е проекцията на ускорението върху посоката
 *    на СКОРОСТТА: плюс – големината на скоростта расте (ускорително движение),
 *    минус – намалява (закъснително движение).
 *  - Нормалното ускорение a_n е винаги ≥ 0 и сочи към центъра на кривината.
 *  - Радиусът на кривината ρ е > 0; за праволинейно движение е Infinity.
 *
 * Файлът е самостоятелен – не ползва други модули от lib/engineering.
 */

/** Вектор в равнината (проекции по x и по y). */
export type Vec2 = { x: number; y: number };

export type NaturalComponents = {
  /** големина на скоростта v, m/s (> 0) */
  speed: number;
  /** големина на ускорението a, m/s² (≥ 0) */
  acceleration: number;
  /** тангенциално ускорение a_τ = (v_x·a_x + v_y·a_y)/v, m/s² (със знак) */
  aTau: number;
  /** нормално ускорение a_n = |v_x·a_y − v_y·a_x|/v, m/s² (≥ 0) */
  aN: number;
  /** радиус на кривината ρ = v²/a_n, m; Infinity при a_n = 0 */
  rho: number;
};

const DEFAULT_TOLERANCE = 1e-12;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Величината „${name}“ трябва да е крайно число.`);
  }
}

function assertPositive(value: number, name: string): void {
  assertFinite(value, name);
  if (value <= 0) {
    throw new Error(`Величината „${name}“ трябва да е положителна.`);
  }
}

/** Скорост от km/h в m/s (делене на 3,6). */
export function kmhToMs(kmh: number): number {
  assertFinite(kmh, "скорост в km/h");
  return kmh / 3.6;
}

/** Големина на вектор в равнината. */
export function magnitude2(v: Vec2): number {
  assertFinite(v.x, "проекция по x");
  assertFinite(v.y, "проекция по y");
  return Math.hypot(v.x, v.y);
}

/**
 * Естествени съставки на ускорението от декартовите проекции на скоростта
 * (m/s) и на ускорението (m/s²).
 *
 *   a_τ = (v_x·a_x + v_y·a_y)/v,   a_n = |v_x·a_y − v_y·a_x|/v,   ρ = v²/a_n.
 *
 * При v = 0 посоката на допирателната не е определена – хвърля грешка.
 */
export function naturalComponents(v: Vec2, a: Vec2): NaturalComponents {
  const speed = magnitude2(v);
  const acceleration = magnitude2(a);
  if (speed <= DEFAULT_TOLERANCE) {
    throw new Error(
      "При скорост нула допирателната не е определена – естествените съставки не могат да се намерят.",
    );
  }
  const aTau = (v.x * a.x + v.y * a.y) / speed;
  const aN = Math.abs(v.x * a.y - v.y * a.x) / speed;
  const rho =
    aN <= DEFAULT_TOLERANCE * Math.max(1, acceleration)
      ? Infinity
      : (speed * speed) / aN;
  return { speed, acceleration, aTau, aN, rho };
}

/**
 * Радиус на кривината на крива y = y(x) в m:
 *   ρ = (1 + y'²)^(3/2) / |y''|.
 * dy е първата производна y' (без единица), d2y – втората y'' (1/m).
 * При y'' = 0 (инфлексна точка или права) връща Infinity.
 */
export function curvatureRadius(dy: number, d2y: number): number {
  assertFinite(dy, "y'");
  assertFinite(d2y, "y''");
  if (d2y === 0) return Infinity;
  return Math.pow(1 + dy * dy, 1.5) / Math.abs(d2y);
}

/**
 * Равнопроменливо движение по права:
 *   v = v0 + a·t,   x = x0 + v0·t + a·t²/2.
 * x0 в m, v0 в m/s, a в m/s² (със знак по оста x), t в s (t ≥ 0).
 */
export function uniformAcceleration(input: {
  x0: number;
  v0: number;
  a: number;
  t: number;
}): { x: number; v: number } {
  const { x0, v0, a, t } = input;
  assertFinite(x0, "x0");
  assertFinite(v0, "v0");
  assertFinite(a, "a");
  assertFinite(t, "t");
  if (t < 0) throw new Error("Времето t не може да е отрицателно.");
  return { x: x0 + v0 * t + (a * t * t) / 2, v: v0 + a * t };
}

/**
 * Път и време до спиране при постоянно закъснение.
 * v0 – начална скорост, m/s (≥ 0); deceleration – големина на закъснението,
 * m/s² (> 0). Връща пътя v0²/(2·a) в m и времето v0/a в s.
 */
export function stoppingDistance(
  v0: number,
  deceleration: number,
): { distance: number; time: number } {
  assertFinite(v0, "начална скорост");
  if (v0 < 0) throw new Error("Началната скорост не може да е отрицателна.");
  assertPositive(deceleration, "закъснение");
  return {
    distance: (v0 * v0) / (2 * deceleration),
    time: v0 / deceleration,
  };
}

/**
 * Движение по окръжност с радиус R (m) при скорост v (m/s) и тангенциално
 * ускорение a_τ (m/s², със знак):
 *   a_n = v²/R,   a = √(a_τ² + a_n²).
 */
export function circularMotion(input: { R: number; v: number; aTau: number }): {
  aN: number;
  a: number;
} {
  const { R, v, aTau } = input;
  assertPositive(R, "радиус R");
  assertFinite(v, "скорост v");
  assertFinite(aTau, "тангенциално ускорение");
  const aN = (v * v) / R;
  return { aN, a: Math.hypot(aTau, aN) };
}

/**
 * Хармонично движение x = A·sin(k·t + β): амплитуда A в m (> 0), кръгова
 * честота k в rad/s (> 0). Връща v_max = A·k (m/s), a_max = A·k² (m/s²)
 * и периода T0 = 2π/k (s).
 */
export function harmonicMotion(input: { A: number; k: number }): {
  vMax: number;
  aMax: number;
  period: number;
} {
  const { A, k } = input;
  assertPositive(A, "амплитуда A");
  assertPositive(k, "кръгова честота k");
  return { vMax: A * k, aMax: A * k * k, period: (2 * Math.PI) / k };
}

/**
 * Числени производни на закон f(t) с централни разлики – само за тестове
 * и фигури. Стъпката h е в s (по подразбиране 0,001 s).
 */
export function differentiateLaw(
  f: (t: number) => number,
  t: number,
  h = 1e-3,
): { first: number; second: number } {
  assertFinite(t, "t");
  assertPositive(h, "стъпка h");
  const plus = f(t + h);
  const zero = f(t);
  const minus = f(t - h);
  return {
    first: (plus - minus) / (2 * h),
    second: (plus - 2 * zero + minus) / (h * h),
  };
}

/**
 * Обратна задача по права: v(t) и x(t) от a(t) (m/s²) и началните условия
 * x0 (m), v0 (m/s). Интегрира числено от 0 до t (s): скоростта по правилото
 * на средната точка, координатата по правилото на Симпсън.
 */
export function integrateAcceleration(
  a: (t: number) => number,
  input: { x0: number; v0: number; t: number; steps?: number },
): { x: number; v: number } {
  const { x0, v0, t, steps = 2000 } = input;
  assertFinite(x0, "x0");
  assertFinite(v0, "v0");
  assertFinite(t, "t");
  if (t < 0) throw new Error("Времето t не може да е отрицателно.");
  if (!Number.isInteger(steps) || steps < 1) {
    throw new Error("Броят на стъпките трябва да е цяло положително число.");
  }
  const h = t / steps;
  let v = v0;
  let x = x0;
  for (let i = 0; i < steps; i += 1) {
    const start = i * h;
    // скорост в средата и в края на стъпката (средна точка на всяка половина)
    const vMid = v + a(start + h / 4) * (h / 2);
    const vEnd = vMid + a(start + (3 * h) / 4) * (h / 2);
    x += (h * (v + 4 * vMid + vEnd)) / 6;
    v = vEnd;
  }
  return { x, v };
}

/**
 * Изминат път – числен интеграл на големината на скоростта |v(t)| (m/s)
 * от t0 до t1 (s) по правилото на Симпсън. Резултатът е в m и е ≥ 0.
 * Точен е, когато |v(t)| е гладка; при смяна на посоката (v минава през
 * нула) грешката намалява с броя на стъпките.
 */
export function pathLength(
  speed: (t: number) => number,
  t0: number,
  t1: number,
  steps = 2000,
): number {
  assertFinite(t0, "t0");
  assertFinite(t1, "t1");
  if (t1 < t0) throw new Error("Краят на интервала е преди началото му.");
  if (!Number.isInteger(steps) || steps < 1) {
    throw new Error("Броят на стъпките трябва да е цяло положително число.");
  }
  const h = (t1 - t0) / steps;
  let sum = 0;
  for (let i = 0; i < steps; i += 1) {
    const start = t0 + i * h;
    sum +=
      (h *
        (Math.abs(speed(start)) +
          4 * Math.abs(speed(start + h / 2)) +
          Math.abs(speed(start + h)))) /
      6;
  }
  return sum;
}
