/**
 * Гъвкави въжета – полегато въже под вертикален товар.
 *
 * Въжето е идеално гъвкаво: носи само опън, няма коравина на огъване.
 *
 * Мерни единици: отвор l, стрелка f, ординати и дължини в m; товар q в kN/m
 * (по ХОРИЗОНТАЛАТА, освен при верижната линия – там е по дължината на
 * въжето); сили в kN; площ A в cm²; E в kN/cm²; напрежения в kN/cm²
 * (1 kN/cm² = 10 MPa).
 *
 * Знаци: x се мери от лявата опора надясно; ординатата y е вертикалното
 * разстояние от хордата (правата през двете опори) НАДОЛУ до въжето, y ≥ 0;
 * товарите са положителни надолу; силите във въжето са опън (положителни).
 * M⁰ и Q⁰ са огъващият момент и напречната сила на проста греда със същия
 * отвор и товар (M > 0 – опън долу; Q > 0 – върти частта по часовниковата
 * стрелка).
 */

function requirePositive(value: number, name: string): void {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new Error(`${name} трябва да е положително число.`);
  }
}

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} трябва да е крайно число.`);
  }
}

function requireWithinSpan(x: number, span: number): void {
  if (!(x >= 0) || !(x <= span)) {
    throw new Error("Сечението трябва да е между двете опори (0 ≤ x ≤ l).");
  }
}

/** Ордината на параболата: y = 4·f·x·(l − x)/l², m (надолу от хордата). */
export function parabolaOrdinate(span: number, sag: number, x: number): number {
  requirePositive(span, "Отворът");
  requirePositive(sag, "Стрелката");
  requireWithinSpan(x, span);
  return (4 * sag * x * (span - x)) / span ** 2;
}

/**
 * Наклон на параболата: y′ = 4·f·(l − 2x)/l² (безразмерен). Положителен,
 * когато въжето слиза надясно (лявата половина).
 */
export function parabolaSlope(span: number, sag: number, x: number): number {
  requirePositive(span, "Отворът");
  requirePositive(sag, "Стрелката");
  requireWithinSpan(x, span);
  return (4 * sag * (span - 2 * x)) / span ** 2;
}

/** Огъващ момент на проста греда с равномерен товар: M⁰ = q·x·(l − x)/2, kN·m. */
export function simpleBeamMoment(q: number, span: number, x: number): number {
  requirePositive(q, "Товарът");
  requirePositive(span, "Отворът");
  requireWithinSpan(x, span);
  return (q * x * (span - x)) / 2;
}

/** Напречна сила на проста греда с равномерен товар: Q⁰ = q·(l/2 − x), kN. */
export function simpleBeamShear(q: number, span: number, x: number): number {
  requirePositive(q, "Товарът");
  requirePositive(span, "Отворът");
  requireWithinSpan(x, span);
  return q * (span / 2 - x);
}

/** Разпор (хоризонтална сила) при равномерен товар: H = q·l²/(8·f), kN. */
export function horizontalForce(q: number, span: number, sag: number): number {
  requirePositive(q, "Товарът");
  requirePositive(span, "Отворът");
  requirePositive(sag, "Стрелката");
  return (q * span ** 2) / (8 * sag);
}

/** Стрелка при зададен разпор: f = q·l²/(8·H), m. */
export function sagFromHorizontalForce(
  q: number,
  span: number,
  H: number,
): number {
  requirePositive(q, "Товарът");
  requirePositive(span, "Отворът");
  requirePositive(H, "Разпорът");
  return (q * span ** 2) / (8 * H);
}

/** Сила във въжето от двете ѝ съставки: N = √(H² + V²), kN. */
export function cableForce(H: number, V: number): number {
  requirePositive(H, "Разпорът");
  requireFinite(V, "Вертикалната съставка");
  return Math.hypot(H, V);
}

/**
 * Сила във въжето в сечение x при равномерен товар:
 * N(x) = √(H² + Q⁰(x)²), kN. Най-малка е в средата (N = H).
 */
export function cableForceAt(
  q: number,
  span: number,
  sag: number,
  x: number,
): number {
  return cableForce(horizontalForce(q, span, sag), simpleBeamShear(q, span, x));
}

/** Най-голямата сила (в опорите): N_max = √(H² + (q·l/2)²), kN. */
export function maxCableForce(q: number, span: number, sag: number): number {
  return cableForce(horizontalForce(q, span, sag), (q * span) / 2);
}

/**
 * Дължина на параболичното въже – приближение за малка стрелка:
 * L ≈ l·(1 + 8·f²/(3·l²)), m.
 */
export function cableLengthApprox(span: number, sag: number): number {
  requirePositive(span, "Отворът");
  requirePositive(sag, "Стрелката");
  return span * (1 + (8 * sag ** 2) / (3 * span ** 2));
}

/**
 * Точна дължина на параболата (затворен вид на интеграла ∫√(1 + y′²) dx):
 * L = (l/2)·[√(1 + a²) + arsinh(a)/a], a = 4·f/l, m.
 */
export function cableLengthExact(span: number, sag: number): number {
  requirePositive(span, "Отворът");
  requirePositive(sag, "Стрелката");
  const a = (4 * sag) / span;
  return (span / 2) * (Math.sqrt(1 + a * a) + Math.asinh(a) / a);
}

/**
 * Приближено удължение на въжето: ΔL = H·L/(E·A). Силата се приема равна на
 * H по цялата дължина. L в m, E в kN/cm², A в cm² → резултат в m.
 */
export function cableElongation(
  H: number,
  length: number,
  E: number,
  A: number,
): number {
  requirePositive(H, "Разпорът");
  requirePositive(length, "Дължината");
  requirePositive(E, "Модулът на еластичност");
  requirePositive(A, "Площта");
  return (H * length) / (E * A);
}

/**
 * Удължение на параболичното въже с променливата сила N(x):
 * ΔL = ∫N ds/(E·A) = H·l·(1 + 16·f²/(3·l²))/(E·A), m.
 */
export function parabolaElongation(
  H: number,
  span: number,
  sag: number,
  E: number,
  A: number,
): number {
  requirePositive(H, "Разпорът");
  requirePositive(span, "Отворът");
  requirePositive(sag, "Стрелката");
  requirePositive(E, "Модулът на еластичност");
  requirePositive(A, "Площта");
  return (H * span * (1 + (16 * sag ** 2) / (3 * span ** 2))) / (E * A);
}

/**
 * Геометрична оценка: с колко расте стрелката, когато дължината на въжето
 * расте с ΔL при същия отвор: Δf ≈ 3·l/(16·f)·ΔL (от L ≈ l + 8·f²/(3·l)).
 * Не отчита, че разпорът намалява с нарастването на стрелката.
 */
export function sagChangeFromLengthChange(
  span: number,
  sag: number,
  deltaLength: number,
): number {
  requirePositive(span, "Отворът");
  requirePositive(sag, "Стрелката");
  requireFinite(deltaLength, "Промяната на дължината");
  return ((3 * span) / (16 * sag)) * deltaLength;
}

/** Напрежение във въжето: σ = N/A, kN/cm². */
export function cableStress(N: number, A: number): number {
  requirePositive(N, "Силата във въжето");
  requirePositive(A, "Площта");
  return N / A;
}

/** Нужна площ: A ≥ N_max/σ_доп, cm² (σ_доп е дадено в условието). */
export function requiredCableArea(N: number, allowableStress: number): number {
  requirePositive(N, "Силата във въжето");
  requirePositive(allowableStress, "Допустимото напрежение");
  return N / allowableStress;
}

export type PointLoadCable = {
  /** вертикални съставки в лявата и в дясната опора (A⁰ и B⁰), kN */
  VA: number;
  VB: number;
  /** гредовият момент под силата, kN·m */
  M0: number;
  /** разпор, kN */
  H: number;
  /** сили в левия и в десния клон, kN */
  T1: number;
  T2: number;
};

/**
 * Въже с една съсредоточена сила F на разстояние a от лявата опора; опорите
 * са на едно ниво, f е стрелката под силата. Формата е начупена линия.
 * H = M⁰/f = F·a·b/(l·f).
 */
export function pointLoadCable(
  F: number,
  a: number,
  span: number,
  sag: number,
): PointLoadCable {
  requirePositive(F, "Силата");
  requirePositive(span, "Отворът");
  requirePositive(sag, "Стрелката");
  if (!(a > 0) || !(a < span)) {
    throw new Error("Силата трябва да е между двете опори (0 < a < l).");
  }
  const b = span - a;
  const VA = (F * b) / span;
  const VB = (F * a) / span;
  const M0 = VA * a;
  const H = M0 / sag;
  return { VA, VB, M0, H, T1: Math.hypot(H, VA), T2: Math.hypot(H, VB) };
}

export type InclinedCable = {
  /** разпор, kN */
  H: number;
  /** вертикални съставки на опорните реакции (нагоре > 0), kN */
  VA: number;
  VB: number;
  /** сили във въжето при лявата и при дясната опора, kN */
  TA: number;
  TB: number;
  /** абсциса на най-ниската точка, m (може да е извън отвора) */
  xLowest: number;
};

/**
 * Опори на различни нива: дясната опора е с h по-високо от лявата (h < 0 –
 * по-ниско). Товарът q е по хоризонталата, f е вертикалното разстояние от
 * хордата до въжето в средата на отвора.
 * H = q·l²/(8·f); V_A = q·l/2 − H·h/l; V_B = q·l/2 + H·h/l.
 */
export function inclinedCable(
  q: number,
  span: number,
  sag: number,
  rise: number,
): InclinedCable {
  requireFinite(rise, "Денивелацията");
  const H = horizontalForce(q, span, sag);
  const VA = (q * span) / 2 - (H * rise) / span;
  const VB = (q * span) / 2 + (H * rise) / span;
  return {
    H,
    VA,
    VB,
    TA: Math.hypot(H, VA),
    TB: Math.hypot(H, VB),
    xLowest: VA / q,
  };
}

/**
 * Височина на точка от въжето спрямо лявата опора при опори на различни
 * нива (нагоре > 0): z = h·x/l − 4·f·x·(l − x)/l², m.
 */
export function inclinedCableElevation(
  span: number,
  sag: number,
  rise: number,
  x: number,
): number {
  requireFinite(rise, "Денивелацията");
  return (rise * x) / span - parabolaOrdinate(span, sag, x);
}

/**
 * Параметър c на верижната линия z = c·(ch(x/c) − 1) с отвор l и стрелка f
 * (опори на едно ниво): корен на c·(ch(l/(2c)) − 1) = f, m. Решава се с
 * разполовяване; лявата страна намалява с нарастването на c.
 */
export function catenaryParameter(span: number, sag: number): number {
  requirePositive(span, "Отворът");
  requirePositive(sag, "Стрелката");
  const sagFor = (c: number) => c * (Math.cosh(span / (2 * c)) - 1);
  let low = span / 1400; // ch не препълва: l/(2c) = 700
  let high = span ** 2 / (8 * sag) + span + sag; // тук стрелката е под f
  while (sagFor(high) > sag) high *= 2;
  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2;
    if (sagFor(mid) > sag) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** Верижна линия, товар q по ДЪЛЖИНАТА на въжето: H = q·c, kN. */
export function catenaryHorizontalForce(
  q: number,
  span: number,
  sag: number,
): number {
  requirePositive(q, "Товарът");
  return q * catenaryParameter(span, sag);
}

/** Верижна линия: най-голямата сила (в опорите) N_max = q·(c + f), kN. */
export function catenaryMaxForce(q: number, span: number, sag: number): number {
  requirePositive(q, "Товарът");
  return q * (catenaryParameter(span, sag) + sag);
}

/** Дължина на верижната линия: L = 2·c·sh(l/(2c)), m. */
export function catenaryLength(span: number, sag: number): number {
  const c = catenaryParameter(span, sag);
  return 2 * c * Math.sinh(span / (2 * c));
}

/**
 * Ордината на верижната линия под хордата в сечение x от лявата опора:
 * y = f − c·(ch((x − l/2)/c) − 1), m.
 */
export function catenaryOrdinate(span: number, sag: number, x: number): number {
  requireWithinSpan(x, span);
  const c = catenaryParameter(span, sag);
  return sag - c * (Math.cosh((x - span / 2) / c) - 1);
}
