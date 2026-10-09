/**
 * Динамика на материална точка (Теоретична механика – II част, Глава 4).
 *
 * Мерни единици: дължини в m, време в s, маса в kg, сили в N, ъгли на входа в
 * ГРАДУСИ (вътре се обръщат в радиани). ВНИМАНИЕ: останалите файлове в
 * lib/engineering работят в kN. Тук силата е в N, защото в уравнението
 * m·a = ΣF масата е в kg: 1 N = 1 kg·m/s², 1 kN = 1000 N.
 *
 * Знаци: оста x е надясно, оста y е НАГОРЕ; затова при свободен полет
 * a_y = −g. Ъгълът на махалото φ се мери от отвеса и е положителен обратно на
 * часовниковата стрелка. Силата на триене при плъзгане е F_тр = μ·N и е
 * насочена срещу скоростта.
 *
 * Файлът е самостоятелен – не ползва други модули от lib/engineering.
 */

/** Земно ускорение, m/s². */
export const G_ACCELERATION = 9.81;

const RAD = Math.PI / 180;

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

function assertNonNegative(value: number, name: string): void {
  assertFinite(value, name);
  if (value < 0) {
    throw new Error(`Величината „${name}“ не може да е отрицателна.`);
  }
}

/** Тегло G = m·g в N; масата е в kg. */
export function weight(massKg: number): number {
  assertPositive(massKg, "маса");
  return massKg * G_ACCELERATION;
}

/**
 * Нормална реакция върху точка, която се движи по отвеса заедно с опората си
 * (кантар в асансьор, товар на въже): m·a = N − m·g, значи N = m·(g + a).
 * Ускорението a е положително НАГОРЕ, m/s². Резултатът е в N; при a ≤ −g
 * точката се отделя от опората и функцията връща 0.
 */
export function supportReaction(
  massKg: number,
  accelerationUp: number,
): number {
  assertPositive(massKg, "маса");
  assertFinite(accelerationUp, "ускорение");
  return Math.max(0, massKg * (G_ACCELERATION + accelerationUp));
}

export type InclineInput = {
  /** маса, kg */
  mass: number;
  /** ъгъл на наклона спрямо хоризонталата, градуси, 0 ≤ α < 90 */
  angleDeg: number;
  /** коефициент на триене при плъзгане (≥ 0) */
  mu: number;
  /** посока на движението (на скоростта) по наклона */
  direction: "up" | "down";
  /** сила, успоредна на наклона и насочена НАГОРЕ по него, N (по подразбиране 0) */
  pull?: number;
};

export type InclineResult = {
  /** нормална реакция N = m·g·cos α, N */
  normal: number;
  /** големина на силата на триене F_тр = μ·N, N (насочена срещу движението) */
  friction: number;
  /** съставка на теглото по наклона m·g·sin α, N (винаги надолу по наклона) */
  gravityAlong: number;
  /** сбор от силите по посоката на движението, N */
  netForce: number;
  /** ускорение по посоката на движението, m/s² (отрицателно = точката се забавя) */
  a: number;
};

/**
 * Плъзгане на точка по грапава наклонена равнина.
 * Перпендикулярно на наклона няма движение: N = m·g·cos α.
 * По наклона, положителна посока = посоката на движението:
 *   надолу:  m·a = m·g·sin α − μ·N − F
 *   нагоре:  m·a = F − m·g·sin α − μ·N
 */
export function inclineMotion(input: InclineInput): InclineResult {
  const { mass, angleDeg, mu, direction } = input;
  const pull = input.pull ?? 0;
  assertPositive(mass, "маса");
  assertFinite(angleDeg, "ъгъл на наклона");
  assertNonNegative(mu, "коефициент на триене");
  assertFinite(pull, "теглителна сила");
  if (angleDeg < 0 || angleDeg >= 90) {
    throw new Error("Ъгълът на наклона трябва да е от 0° до 90° (без 90°).");
  }
  const G = mass * G_ACCELERATION;
  const normal = G * Math.cos(angleDeg * RAD);
  const gravityAlong = G * Math.sin(angleDeg * RAD);
  const friction = mu * normal;
  const netForce =
    direction === "down"
      ? gravityAlong - friction - pull
      : pull - gravityAlong - friction;
  return { normal, friction, gravityAlong, netForce, a: netForce / mass };
}

/** Тяло в покой върху грапав наклон остава в покой, когато tg α ≤ μ. */
export function staysAtRest(angleDeg: number, mu: number): boolean {
  assertFinite(angleDeg, "ъгъл на наклона");
  assertNonNegative(mu, "коефициент на триене");
  if (angleDeg < 0 || angleDeg >= 90) {
    throw new Error("Ъгълът на наклона трябва да е от 0° до 90° (без 90°).");
  }
  return Math.tan(angleDeg * RAD) <= mu;
}

/**
 * Праволинейно движение с постоянно ускорение a (m/s²) и начална скорост
 * v0 ≥ 0 (m/s) по посоката на движението. Връща скоростта след път distance
 * (m) и времето за него: v² = v0² + 2·a·s, t = (v − v0)/a.
 */
export function constantAcceleration(input: {
  v0: number;
  a: number;
  distance: number;
}): { v: number; time: number } {
  const { v0, a, distance } = input;
  assertNonNegative(v0, "начална скорост");
  assertFinite(a, "ускорение");
  assertPositive(distance, "път");
  const squared = v0 * v0 + 2 * a * distance;
  if (squared < 0) {
    throw new Error("Точката спира, преди да измине този път.");
  }
  const v = Math.sqrt(squared);
  const time = a === 0 ? distance / v0 : (v - v0) / a;
  if (!Number.isFinite(time)) {
    throw new Error("Точката е в покой и без ускорение – път няма.");
  }
  return { v, time };
}

/**
 * Положение и скорост при свободен полет без съпротивление. Начало в точката
 * на излитане, x надясно, y НАГОРЕ: x = v0x·t, y = v0y·t − g·t²/2.
 * Ъгълът е над хоризонталата (отрицателен = хвърляне надолу).
 */
export function projectileState(input: {
  v0: number;
  angleDeg: number;
  t: number;
}): { x: number; y: number; vx: number; vy: number } {
  const { v0, angleDeg, t } = input;
  assertNonNegative(v0, "начална скорост");
  assertFinite(angleDeg, "ъгъл на хвърляне");
  assertNonNegative(t, "време");
  const vx = v0 * Math.cos(angleDeg * RAD);
  const v0y = v0 * Math.sin(angleDeg * RAD);
  return {
    x: vx * t,
    y: v0y * t - (G_ACCELERATION * t * t) / 2,
    vx,
    vy: v0y - G_ACCELERATION * t,
  };
}

export type ProjectileFlight = {
  /** време до падането, s */
  time: number;
  /** хоризонтално разстояние до точката на падане, m */
  range: number;
  /** проекции на скоростта при падането, m/s (vy < 0 = надолу) */
  vx: number;
  vy: number;
  /** големина на скоростта при падането, m/s */
  speed: number;
  /** ъгъл на скоростта при падането ПОД хоризонталата, градуси */
  impactAngleDeg: number;
  /** височина на най-високата точка над началото, m (0 при хвърляне надолу) */
  apexHeight: number;
  /** време до най-високата точка, s */
  apexTime: number;
};

/**
 * Полет от началото (0; 0) до хоризонталната равнина y = −drop.
 * drop > 0: равнината е ПОД началото; drop < 0: над него (тогава се връща
 * второто, низходящото пресичане). Оста y е нагоре.
 */
export function projectileFlight(input: {
  v0: number;
  angleDeg: number;
  drop: number;
}): ProjectileFlight {
  const { v0, angleDeg, drop } = input;
  assertNonNegative(v0, "начална скорост");
  assertFinite(angleDeg, "ъгъл на хвърляне");
  assertFinite(drop, "понижение");
  if (angleDeg <= -90 || angleDeg >= 90) {
    throw new Error("Ъгълът на хвърляне трябва да е между −90° и 90°.");
  }
  const g = G_ACCELERATION;
  const vx = v0 * Math.cos(angleDeg * RAD);
  const v0y = v0 * Math.sin(angleDeg * RAD);
  // v0y·t − g·t²/2 = −drop  →  t = (v0y + √(v0y² + 2·g·drop)) / g
  const discriminant = v0y * v0y + 2 * g * drop;
  if (discriminant < 0) {
    throw new Error("Точката не достига тази височина.");
  }
  const time = (v0y + Math.sqrt(discriminant)) / g;
  if (!(time > 0)) {
    throw new Error("Няма полет – точката е вече на равнината.");
  }
  const vy = v0y - g * time;
  const apexTime = Math.max(0, v0y / g);
  return {
    time,
    range: vx * time,
    vx,
    vy,
    speed: Math.hypot(vx, vy),
    impactAngleDeg: Math.atan2(-vy, vx) / RAD,
    apexHeight: v0y > 0 ? (v0y * v0y) / (2 * g) : 0,
    apexTime,
  };
}

/**
 * Падане от покой в среда с линейно съпротивление R = b·v (b в N·s/m).
 * Ос x НАДОЛУ: m·dv/dt = m·g − b·v, v(0) = 0, x(0) = 0.
 *   v(t) = v∞·(1 − e^(−b·t/m)),  v∞ = m·g/b,
 *   x(t) = v∞·[t − (m/b)·(1 − e^(−b·t/m))].
 */
export function linearDragFall(input: { mass: number; b: number; t: number }): {
  /** гранична скорост v∞ = m·g/b, m/s */
  vTerminal: number;
  /** времеконстанта m/b, s */
  timeConstant: number;
  /** скорост в момента t, m/s (надолу) */
  v: number;
  /** изминат път до момента t, m */
  x: number;
  /** ускорение в момента t, m/s² (надолу) */
  a: number;
} {
  const { mass, b, t } = input;
  assertPositive(mass, "маса");
  assertPositive(b, "коефициент на съпротивление");
  assertNonNegative(t, "време");
  const vTerminal = (mass * G_ACCELERATION) / b;
  const timeConstant = mass / b;
  // expm1 пази точността и при много слабо съпротивление (b → 0)
  const growth = -Math.expm1(-t / timeConstant); // 1 − e^(−b·t/m)
  return {
    vTerminal,
    timeConstant,
    v: vTerminal * growth,
    x: vTerminal * (t - timeConstant * growth),
    a: G_ACCELERATION * (1 - growth),
  };
}

/**
 * Време, за което падащото тяло достига дял fraction (0 < fraction < 1) от
 * граничната скорост: t = −(m/b)·ln(1 − fraction).
 */
export function timeToTerminalFraction(input: {
  mass: number;
  b: number;
  fraction: number;
}): number {
  const { mass, b, fraction } = input;
  assertPositive(mass, "маса");
  assertPositive(b, "коефициент на съпротивление");
  assertFinite(fraction, "дял от граничната скорост");
  if (fraction <= 0 || fraction >= 1) {
    throw new Error("Делът от граничната скорост трябва да е между 0 и 1.");
  }
  return -(mass / b) * Math.log(1 - fraction);
}

/**
 * Нормална реакция върху точка, която минава със скорост v (m/s) през връх на
 * изпъкнала крива ("crest") или през дъно на вдлъбната ("valley") с радиус на
 * кривината ρ (m). От m·v²/ρ = ΣF_n (нормалата сочи към центъра на кривината):
 *   връх:  N = m·(g − v²/ρ);   дъно:  N = m·(g + v²/ρ).
 * Отрицателна стойност на върха означава, че точката вече се е отлепила.
 */
export function curveNormalReaction(input: {
  mass: number;
  v: number;
  rho: number;
  kind: "crest" | "valley";
}): number {
  const { mass, v, rho, kind } = input;
  assertPositive(mass, "маса");
  assertNonNegative(v, "скорост");
  assertPositive(rho, "радиус на кривината");
  const an = (v * v) / rho;
  return mass * (kind === "crest" ? G_ACCELERATION - an : G_ACCELERATION + an);
}

/** Скорост на отлепване от връх на изпъкнала крива: N = 0 при v = √(g·ρ), m/s. */
export function liftOffSpeed(rho: number): number {
  assertPositive(rho, "радиус на кривината");
  return Math.sqrt(G_ACCELERATION * rho);
}

/**
 * Най-голяма скорост в хоризонтален завой с радиус ρ (m) без плъзгане:
 * m·v²/ρ = F_тр ≤ μ·m·g, значи v = √(μ·g·ρ), m/s.
 */
export function maxFlatCurveSpeed(input: { rho: number; mu: number }): number {
  assertPositive(input.rho, "радиус на кривината");
  assertNonNegative(input.mu, "коефициент на триене");
  return Math.sqrt(input.mu * G_ACCELERATION * input.rho);
}

/**
 * Точка с маса m (kg) на пружина с коравина c (N/m): m·x'' = −c·x.
 * Кръгова честота k = √(c/m) в rad/s и период 2π/k в s.
 */
export function springOscillation(input: { mass: number; c: number }): {
  k: number;
  period: number;
} {
  assertPositive(input.mass, "маса");
  assertPositive(input.c, "коравина на пружината");
  const k = Math.sqrt(input.c / input.mass);
  return { k, period: (2 * Math.PI) / k };
}

/** Аритметично-геометрична средна на две положителни числа. */
function agm(first: number, second: number): number {
  let a = first;
  let b = second;
  for (let i = 0; i < 60 && Math.abs(a - b) > 1e-16 * a; i++) {
    const next = (a + b) / 2;
    b = Math.sqrt(a * b);
    a = next;
  }
  return (a + b) / 2;
}

/**
 * Период на математично махало с дължина l (m).
 *   small  – малки трептения: T0 = 2π·√(l/g);
 *   exact  – точен период при амплитуда φ0 (пускане от покой):
 *            τ = 4·√(l/g)·K(sin(φ0/2)) = T0 / AGM(1; cos(φ0/2));
 *   series – приближение T0·(1 + φ0²/16 + 11·φ0⁴/3072), φ0 в rad.
 * Амплитудата е в градуси, 0 ≤ φ0 < 180; без нея exact = series = small.
 */
export function pendulumPeriod(input: {
  length: number;
  amplitudeDeg?: number;
}): { small: number; exact: number; series: number; ratio: number } {
  const amplitudeDeg = input.amplitudeDeg ?? 0;
  assertPositive(input.length, "дължина на махалото");
  assertFinite(amplitudeDeg, "амплитуда");
  if (amplitudeDeg < 0 || amplitudeDeg >= 180) {
    throw new Error("Амплитудата трябва да е от 0° до 180° (без 180°).");
  }
  const small = 2 * Math.PI * Math.sqrt(input.length / G_ACCELERATION);
  const phi0 = amplitudeDeg * RAD;
  const ratio = 1 / agm(1, Math.cos(phi0 / 2));
  const series = small * (1 + phi0 ** 2 / 16 + (11 * phi0 ** 4) / 3072);
  return { small, exact: small * ratio, series, ratio };
}

/**
 * Състояние на математично махало при ъгъл φ след пускане от покой при φ0.
 * От първия интеграл: v² = 2·g·l·(cos φ − cos φ0);
 * от уравнението по нормалата: S = m·g·(3·cos φ − 2·cos φ0).
 * Ъглите са в градуси; 0 ≤ φ0 ≤ 90 (нишката остава опъната), |φ| ≤ φ0.
 */
export function pendulumState(input: {
  mass: number;
  length: number;
  phi0Deg: number;
  phiDeg: number;
}): {
  /** големина на скоростта, m/s */
  v: number;
  /** големина на ъгловата скорост, rad/s */
  omega: number;
  /** сила в нишката, N (опън) */
  tension: number;
} {
  const { mass, length, phi0Deg, phiDeg } = input;
  assertPositive(mass, "маса");
  assertPositive(length, "дължина на махалото");
  assertFinite(phi0Deg, "начален ъгъл");
  assertFinite(phiDeg, "ъгъл");
  if (phi0Deg < 0 || phi0Deg > 90) {
    throw new Error("Началният ъгъл трябва да е от 0° до 90°.");
  }
  if (Math.abs(phiDeg) > phi0Deg) {
    throw new Error("Махалото не достига този ъгъл.");
  }
  const cosPhi = Math.cos(phiDeg * RAD);
  const cosPhi0 = Math.cos(phi0Deg * RAD);
  const v = Math.sqrt(
    Math.max(0, 2 * G_ACCELERATION * length * (cosPhi - cosPhi0)),
  );
  return {
    v,
    omega: v / length,
    tension: mass * G_ACCELERATION * (3 * cosPhi - 2 * cosPhi0),
  };
}
