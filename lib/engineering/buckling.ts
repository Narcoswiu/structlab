/**
 * Изкълчване на центрично натиснати пръти – формула на Ойлер.
 *
 * Мерни единици: дължини в cm (1 m = 100 cm – превръща се ПРЕДИ извикването),
 * E в kN/cm², I в cm⁴, A в cm², сили в kN, напрежения в kN/cm²
 * (1 kN/cm² = 10 MPa). Гъвкавостта λ и коефициентът μ са безразмерни.
 *
 * Навсякъде I е по-малкият главен централен инерционен момент (I_min), когато
 * подпирането е еднакво в двете главни равнини.
 */

export type BucklingSupport =
  /** шарнир – шарнир (основен случай) */
  | "pinned-pinned"
  /** запъване – свободен край (конзола) */
  | "fixed-free"
  /** запъване – шарнир */
  | "fixed-pinned"
  /** запъване – запъване */
  | "fixed-fixed";

const LENGTH_FACTORS: Record<BucklingSupport, number> = {
  "pinned-pinned": 1,
  "fixed-free": 2,
  "fixed-pinned": 0.7,
  "fixed-fixed": 0.5,
};

function requirePositive(value: number, name: string): void {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new Error(`${name} трябва да е положително число.`);
  }
}

/** Коефициент на дължината μ за четирите класически случая на подпиране. */
export function effectiveLengthFactor(support: BucklingSupport): number {
  const mu = LENGTH_FACTORS[support];
  if (mu === undefined) {
    throw new Error("Непознат случай на подпиране.");
  }
  return mu;
}

/** Свободна дължина μ·l, в cm. */
export function effectiveLength(length: number, mu = 1): number {
  requirePositive(length, "Дължината");
  requirePositive(mu, "Коефициентът на дължината");
  return mu * length;
}

/** Критична сила по Ойлер: F_cr = π²·E·I_min / (μ·l)², в kN. */
export function eulerCriticalForce(
  E: number,
  Imin: number,
  length: number,
  mu = 1,
): number {
  requirePositive(E, "Модулът на еластичност");
  requirePositive(Imin, "Инерционният момент");
  const l0 = effectiveLength(length, mu);
  return (Math.PI ** 2 * E * Imin) / l0 ** 2;
}

/** Радиус на инерция i = √(I/A), в cm. */
export function radiusOfGyration(I: number, A: number): number {
  requirePositive(I, "Инерционният момент");
  requirePositive(A, "Площта");
  return Math.sqrt(I / A);
}

/** Гъвкавост λ = μ·l / i (безразмерна). */
export function slenderness(length: number, mu: number, i: number): number {
  requirePositive(i, "Радиусът на инерция");
  return effectiveLength(length, mu) / i;
}

/** Критично напрежение по Ойлер: σ_cr = π²·E / λ², в kN/cm². */
export function criticalStress(E: number, lambda: number): number {
  requirePositive(E, "Модулът на еластичност");
  requirePositive(lambda, "Гъвкавостта");
  return (Math.PI ** 2 * E) / lambda ** 2;
}

/**
 * Гранична гъвкавост λ_гр = π·√(E/σ_p). Под нея критичното напрежение по
 * Ойлер надхвърля границата на пропорционалност σ_p (в kN/cm²).
 */
export function limitSlenderness(E: number, sigmaP: number): number {
  requirePositive(E, "Модулът на еластичност");
  requirePositive(sigmaP, "Границата на пропорционалност");
  return Math.PI * Math.sqrt(E / sigmaP);
}

/** Формулата на Ойлер е приложима, когато λ ≥ λ_гр. */
export function isEulerValid(lambda: number, lambdaLimit: number): boolean {
  requirePositive(lambda, "Гъвкавостта");
  requirePositive(lambdaLimit, "Граничната гъвкавост");
  return lambda >= lambdaLimit;
}

/**
 * Допустима натискова сила F_доп = F_cr / n, където n ≥ 1 е коефициентът на
 * сигурност срещу изкълчване (зададен в условието на задачата).
 */
export function allowableBucklingForce(Fcr: number, safety: number): number {
  requirePositive(Fcr, "Критичната сила");
  if (!(safety >= 1) || !Number.isFinite(safety)) {
    throw new Error("Коефициентът на сигурност трябва да е поне 1.");
  }
  return Fcr / safety;
}

/**
 * Нужният инерционен момент, за да носи прътът сила F с коефициент на
 * сигурност n: I_min ≥ n·F·(μ·l)² / (π²·E), в cm⁴.
 */
export function requiredInertiaForBuckling(
  F: number,
  safety: number,
  E: number,
  length: number,
  mu = 1,
): number {
  requirePositive(F, "Силата");
  requirePositive(E, "Модулът на еластичност");
  if (!(safety >= 1) || !Number.isFinite(safety)) {
    throw new Error("Коефициентът на сигурност трябва да е поне 1.");
  }
  const l0 = effectiveLength(length, mu);
  return (safety * F * l0 ** 2) / (Math.PI ** 2 * E);
}

function requireRing(D: number, d: number): void {
  requirePositive(D, "Външният диаметър");
  if (!(d >= 0) || !(d < D)) {
    throw new Error("Вътрешният диаметър трябва да е между 0 и външния.");
  }
}

/** Кръг или тръба (външен диаметър D, вътрешен d): I = π·(D⁴ − d⁴)/64, cm⁴. */
export function circleInertia(D: number, d = 0): number {
  requireRing(D, d);
  return (Math.PI * (D ** 4 - d ** 4)) / 64;
}

/** Кръг или тръба: A = π·(D² − d²)/4, cm². */
export function circleArea(D: number, d = 0): number {
  requireRing(D, d);
  return (Math.PI * (D * D - d * d)) / 4;
}

/** Диаметър на плътен кръг с инерционен момент I: d = ⁴√(64·I/π), cm. */
export function circleDiameterForInertia(I: number): number {
  requirePositive(I, "Инерционният момент");
  return ((64 * I) / Math.PI) ** 0.25;
}

export type AxisBuckling = {
  /** коефициент на дължината за изкълчване около тази ос */
  mu: number;
  /** радиус на инерция спрямо тази ос, cm */
  i: number;
};

/**
 * Различно подпиране в двете главни равнини: меродавна е по-голямата
 * гъвкавост (при равенство – оста x).
 */
export function governingSlenderness(
  length: number,
  x: AxisBuckling,
  y: AxisBuckling,
): { lambda: number; axis: "x" | "y"; lambdaX: number; lambdaY: number } {
  const lambdaX = slenderness(length, x.mu, x.i);
  const lambdaY = slenderness(length, y.mu, y.i);
  return lambdaY > lambdaX
    ? { lambda: lambdaY, axis: "y", lambdaX, lambdaY }
    : { lambda: lambdaX, axis: "x", lambdaX, lambdaY };
}
