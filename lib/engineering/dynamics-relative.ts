/**
 * Динамика на относителното (релативното) движение на частица
 * (Теоретична механика – II част, Глава 5).
 *
 * Мерни единици: m, s, kg, N, rad. ВНИМАНИЕ: останалите файлове в
 * lib/engineering (статиката) работят в kN; тук силите са в нютони,
 * 1 kN = 1000 N. Ъглите на наклона и географската ширина се подават в градуси,
 * ъгловите скорости – в rad/s.
 *
 * Знаци (както в целия модул): оста x е надясно, оста y е НАГОРЕ, оста z е към
 * наблюдателя. Ъгловата скорост на подвижното тяло ω_e е положителна ОБРАТНО
 * на часовниковата стрелка (вектор по +z).
 *
 * Основно уравнение в подвижната система:
 *   m·a_r = ΣF + Φ_e + Φ_c,   Φ_e = −m·a_e,   Φ_c = −m·a_c = −2m·ω_e × v_r.
 * В равнината ω_e × v_r = (−ω_e·v_ry; ω_e·v_rx), затова
 *   Φ_c = (2m·ω_e·v_ry; −2m·ω_e·v_rx)
 * – векторът v_r, завъртян на 90° СРЕЩУ посоката на въртене.
 *
 * Константите на Земята (ъглова скорост, радиус) не са вградени – подават се
 * като вход, защото са „дадено“ в задачата. Вградено е само g = 9,81 m/s².
 *
 * Файлът е самостоятелен – не ползва други модули от lib/engineering.
 */

/** Земно ускорение, m/s². */
export const G = 9.81;

/** Вектор в равнината (проекции по x и y). */
export type Vec2 = { x: number; y: number };

export type InertiaForces = {
  /** преносна инерционна сила Φ_e = −m·a_e, N */
  phiE: Vec2;
  /** Кориолисова инерционна сила Φ_c = −2m·ω_e × v_r, N */
  phiC: Vec2;
};

export type PendulumRest = {
  /** отклонение на нишката от отвеса, градуси (≥ 0, обратно на a_e) */
  thetaDeg: number;
  /** сила в нишката S, N */
  tension: number;
};

export type InclineResult = {
  /** релативно ускорение по наклона, m/s² (плюс = надолу по наклона) */
  aR: number;
  /** нормална реакция N, N */
  normal: number;
  /** преносно ускорение, при което точката е в релативен покой: g·tg α, m/s² */
  aERest: number;
};

export type TubeExit = {
  /** време до изхода от тръбата, s */
  exitTime: number;
  /** релативна скорост на изхода (по тръбата, навън), m/s */
  rDotExit: number;
  /** хоризонтална реакция на стената на изхода N = 2m·ω·ṙ, N */
  wallForceExit: number;
  /** преносна скорост на изхода ω·l, m/s */
  transportSpeedExit: number;
  /** абсолютна скорост на изхода, m/s */
  absoluteSpeedExit: number;
};

export type TubeState = {
  /** разстояние от оста, m */
  r: number;
  /** релативна скорост по тръбата, m/s */
  rDot: number;
  /** хоризонтална реакция на стената, N (по посока на въртенето) */
  wallForce: number;
};

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

function assertLatitude(latitudeDeg: number): void {
  assertFinite(latitudeDeg, "географска ширина");
  if (latitudeDeg < -90 || latitudeDeg > 90) {
    throw new Error("Географската ширина трябва да е между −90° и 90°.");
  }
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Инерционните сили в равнинния случай.
 * mass – kg; aE – преносно ускорение на мястото на точката, m/s²;
 * omegaE – ъглова скорост на подвижното тяло, rad/s (плюс = обратно на
 * часовниковата стрелка); vR – релативна скорост, m/s.
 */
export function inertiaForces(input: {
  mass: number;
  aE: Vec2;
  omegaE: number;
  vR: Vec2;
}): InertiaForces {
  const { mass, aE, omegaE, vR } = input;
  assertPositive(mass, "маса");
  assertFinite(aE.x, "a_e.x");
  assertFinite(aE.y, "a_e.y");
  assertFinite(omegaE, "ω_e");
  assertFinite(vR.x, "v_r.x");
  assertFinite(vR.y, "v_r.y");
  // „+ 0“ превръща −0 в 0, за да няма отрицателна нула в резултата
  return {
    phiE: { x: -mass * aE.x + 0, y: -mass * aE.y + 0 },
    phiC: {
      x: 2 * mass * omegaE * vR.y + 0,
      y: -2 * mass * omegaE * vR.x + 0,
    },
  };
}

/**
 * Големина на центробежната съставка на преносната инерционна сила при
 * въртене около неподвижна ос: Φ = m·ω²·r, N. Насочена е от оста навън.
 */
export function centrifugalForce(input: {
  mass: number;
  omega: number;
  r: number;
}): number {
  assertPositive(input.mass, "маса");
  assertFinite(input.omega, "ω_e");
  assertNonNegative(input.r, "разстояние до оста");
  return input.mass * input.omega ** 2 * input.r;
}

/**
 * Махало в релативен покой в система с хоризонтално преносно ускорение aE
 * (m/s², големина). tg θ = a_e/g; S = m·√(g² + a_e²). Нишката се отклонява
 * от отвеса на ъгъл θ в посока, обратна на ускорението.
 */
export function pendulumInAcceleratingFrame(input: {
  mass: number;
  aE: number;
}): PendulumRest {
  assertPositive(input.mass, "маса");
  assertNonNegative(input.aE, "преносно ускорение");
  return {
    thetaDeg: (Math.atan2(input.aE, G) * 180) / Math.PI,
    tension: input.mass * Math.hypot(G, input.aE),
  };
}

/**
 * Период на малките трептения на махало в система с ВЕРТИКАЛНО преносно
 * ускорение aUp (m/s², плюс = нагоре): T₀ = 2π·√(l/(g + a_e)), s.
 * При aUp ≤ −g нишката не е опъната и трептения няма.
 */
export function pendulumPeriodInLift(input: {
  length: number;
  aUp: number;
}): number {
  assertPositive(input.length, "дължина на нишката");
  assertFinite(input.aUp, "преносно ускорение");
  const effective = G + input.aUp;
  if (effective <= 0) {
    throw new Error(
      "При ускорение надолу, не по-малко от g, нишката не е опъната.",
    );
  }
  return 2 * Math.PI * Math.sqrt(input.length / effective);
}

/**
 * Гладък наклон с ъгъл angleDeg (0° < α < 90°), закрепен върху платформа с
 * хоризонтално транслационно ускорение aE, m/s².
 * Знак на aE: ПЛЮС, когато платформата се ускорява към по-ниския край на
 * наклона (тогава Φ_e сочи към по-високия край и притиска точката към наклона).
 *   a_r = g·sin α − a_e·cos α  (плюс = надолу по наклона),
 *   N = m·(g·cos α + a_e·sin α).
 */
export function inclineOnAcceleratingPlatform(input: {
  mass: number;
  angleDeg: number;
  aE: number;
}): InclineResult {
  const { mass, angleDeg, aE } = input;
  assertPositive(mass, "маса");
  assertFinite(angleDeg, "ъгъл на наклона");
  assertFinite(aE, "преносно ускорение");
  if (angleDeg <= 0 || angleDeg >= 90) {
    throw new Error("Ъгълът на наклона трябва да е между 0° и 90°.");
  }
  const alpha = toRad(angleDeg);
  const normal = mass * (G * Math.cos(alpha) + aE * Math.sin(alpha));
  if (normal < 0) {
    throw new Error("При това ускорение точката се отделя от наклона (N < 0).");
  }
  return {
    aR: G * Math.sin(alpha) - aE * Math.cos(alpha),
    normal,
    aERest: G * Math.tan(alpha),
  };
}

/**
 * Равноускорително релативно движение от релативен покой с ускорение aR
 * (m/s²) на път distance (m): t = √(2s/a), v = √(2·a·s).
 */
export function slideFromRest(input: { aR: number; distance: number }): {
  time: number;
  speed: number;
} {
  assertPositive(input.aR, "релативно ускорение");
  assertPositive(input.distance, "път");
  return {
    time: Math.sqrt((2 * input.distance) / input.aR),
    speed: Math.sqrt(2 * input.aR * input.distance),
  };
}

/**
 * Най-голямата ъглова скорост (rad/s), при която тяло остава в релативен покой
 * върху хоризонтална въртяща се платформа: m·ω²·r ≤ μ·m·g ⇒ ω = √(μ·g/r).
 */
export function turntableMaxOmega(input: { r: number; mu: number }): number {
  assertPositive(input.r, "разстояние до оста");
  assertNonNegative(input.mu, "коефициент на триене");
  return Math.sqrt((input.mu * G) / input.r);
}

/** Ъглова скорост от rad/s в обороти в минута: n = 30·ω/π. */
export function radPerSecToRpm(omega: number): number {
  assertFinite(omega, "ω");
  return (30 * omega) / Math.PI;
}

/**
 * Най-малкият коефициент на триене, при който тяло върху хоризонтална
 * платформа остава в релативен покой при хоризонтално преносно ускорение
 * (или закъснение) aE, m/s²: μ·m·g ≥ m·a_e ⇒ μ = a_e/g.
 */
export function minFrictionCoefficient(aE: number): number {
  assertNonNegative(aE, "преносно ускорение");
  return aE / G;
}

/**
 * Разстояние от оста (m) на частица в гладка тръба, която се върти в
 * хоризонтална равнина с постоянна ъглова скорост omega (rad/s). Частицата е
 * пусната от релативен покой при r0: r = r₀·ch(ω·t).
 */
export function rotatingTubePosition(input: {
  omega: number;
  r0: number;
  t: number;
}): number {
  assertPositive(input.r0, "начално разстояние");
  assertFinite(input.omega, "ω_e");
  assertNonNegative(input.t, "време");
  return input.r0 * Math.cosh(input.omega * input.t);
}

/**
 * Състояние на частицата в тръбата в момента t: r = r₀·ch ωt,
 * ṙ = r₀·ω·sh ωt, N = 2m·ω·ṙ (напречно на тръбата, по посока на въртенето).
 */
export function rotatingTubeState(input: {
  mass: number;
  omega: number;
  r0: number;
  t: number;
}): TubeState {
  const { mass, omega, r0, t } = input;
  assertPositive(mass, "маса");
  assertPositive(omega, "ω_e");
  assertPositive(r0, "начално разстояние");
  assertNonNegative(t, "време");
  const rDot = r0 * omega * Math.sinh(omega * t);
  return {
    r: r0 * Math.cosh(omega * t),
    rDot,
    wallForce: 2 * mass * omega * rDot,
  };
}

/**
 * Частица в гладка въртяща се тръба с дължина length (m), пусната от релативен
 * покой при r0 < length. Изход при ch(ω·t) = l/r₀; ṙ = ω·√(l² − r₀²).
 */
export function rotatingTubeBead(input: {
  mass: number;
  omega: number;
  r0: number;
  length: number;
}): TubeExit {
  const { mass, omega, r0, length } = input;
  assertPositive(mass, "маса");
  assertPositive(omega, "ω_e");
  assertPositive(r0, "начално разстояние");
  assertPositive(length, "дължина на тръбата");
  if (length <= r0) {
    throw new Error(
      "Дължината на тръбата трябва да е по-голяма от началното разстояние.",
    );
  }
  const exitTime = Math.acosh(length / r0) / omega;
  const rDotExit = omega * Math.sqrt(length ** 2 - r0 ** 2);
  const transportSpeedExit = omega * length;
  return {
    exitTime,
    rDotExit,
    wallForceExit: 2 * mass * omega * rDotExit,
    transportSpeedExit,
    absoluteSpeedExit: Math.hypot(rDotExit, transportSpeedExit),
  };
}

/**
 * Отклонение на отвеса от радиуса на Земята (rad), приближена формула за
 * ω_e²R ≪ g: δ ≈ ω_e²·R·sin ψ·cos ψ / g. Отклонението е към екватора.
 * omega – rad/s; R – m; latitudeDeg – географска ширина в градуси.
 */
export function plumbDeviation(input: {
  omega: number;
  R: number;
  latitudeDeg: number;
}): number {
  assertFinite(input.omega, "ω");
  assertPositive(input.R, "радиус");
  assertLatitude(input.latitudeDeg);
  const psi = toRad(input.latitudeDeg);
  return (
    Math.abs(input.omega ** 2 * input.R * Math.sin(psi) * Math.cos(psi)) / G
  );
}

/**
 * Същото отклонение без приближението ω_e²R ≪ g:
 * tg δ = ω_e²R·sin ψ·cos ψ / (g₀ − ω_e²R·cos² ψ), където g₀ е ускорението само от
 * привличането (m/s²); по подразбиране се приема g₀ = 9,81.
 */
export function plumbDeviationExact(input: {
  omega: number;
  R: number;
  latitudeDeg: number;
  gravity?: number;
}): number {
  assertFinite(input.omega, "ω");
  assertPositive(input.R, "радиус");
  assertLatitude(input.latitudeDeg);
  const g0 = input.gravity ?? G;
  assertPositive(g0, "ускорение от привличането");
  const psi = toRad(input.latitudeDeg);
  const centrifugal = input.omega ** 2 * input.R * Math.cos(psi);
  return Math.atan2(
    Math.abs(centrifugal * Math.sin(psi)),
    g0 - centrifugal * Math.cos(psi),
  );
}

/**
 * Хоризонтално Кориолисово ускорение на точка, която се движи със скорост v
 * (m/s) по повърхността на въртяща се сфера, на ширина ψ: 2·ω_e·v·sin ψ, m/s².
 * Резултатът е със знак: плюс = отклонение НАДЯСНО от движението (северно
 * полукълбо, ψ > 0), минус = наляво (южно полукълбо).
 */
export function horizontalCoriolis(input: {
  omega: number;
  v: number;
  latitudeDeg: number;
}): number {
  assertFinite(input.omega, "ω");
  assertNonNegative(input.v, "скорост");
  assertLatitude(input.latitudeDeg);
  return 2 * input.omega * input.v * Math.sin(toRad(input.latitudeDeg));
}
