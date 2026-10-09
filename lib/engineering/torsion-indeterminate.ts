/**
 * Глава 17: статически неопределими валове с кръгло сечение и усукване на
 * прът с правоъгълно сечение.
 *
 * Мерни единици: усукващ момент T в kN·m; размери и дължини в cm; I_p и I_t
 * в cm⁴; W_p и W_t в cm³; G в kN/cm²; напрежения в kN/cm² (1 kN/cm² = 10 MPa);
 * ъгли в rad; коравина на участък k = G·I_p / l в kN·cm/rad.
 *
 * Знаци: положителен е външен момент с посоката на първия зададен момент.
 * Усукващият момент T в участък е положителен, когато участъкът е усукан в
 * същата посока, в която е усукан първият участък от положителен външен
 * момент. Знакът е условен – показва само кои участъци са усукани обратно.
 *
 * Коефициентите α и β за правоъгълника НЕ се извеждат в курса. Те идват от
 * решението на Сен-Венан в теорията на еластичността; тук се сумират редовете.
 */
import { polarModulus, polarMoment } from "./torsion.ts";

/** kN·m → kN·cm */
const KNM_TO_KNCM = 100;

function requirePositive(value: number, name: string): void {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new Error(`${name} трябва да е положително число.`);
  }
}

/** Коравина на усукване на участък: k = G·I_p / l, kN·cm/rad. */
export function segmentStiffness(
  G: number,
  Ip: number,
  length: number,
): number {
  requirePositive(G, "G");
  requirePositive(Ip, "I_p");
  requirePositive(length, "Дължината");
  return (G * Ip) / length;
}

export type FixedFixedSplit = {
  /** опорен момент в A (по големина, със знака на T), kN·m */
  TA: number;
  /** опорен момент в B, kN·m */
  TB: number;
};

/**
 * Вал, запънат в двата края A и B, с един външен момент T в сечението между
 * участък 1 (от A, коравина k1) и участък 2 (до B, коравина k2).
 *
 * Статична страна:    T_A + T_B = T
 * Геометрична страна: φ_1 = φ_2 (сечението C е едно)  ⇔  общият ъгъл A–B е нула
 * Физична страна:     φ_1 = T_A / k1,  φ_2 = T_B / k2
 * ⇒ T_A = T·k1 / (k1 + k2),  T_B = T·k2 / (k1 + k2).
 */
export function fixedFixedSplit(
  T: number,
  k1: number,
  k2: number,
): FixedFixedSplit {
  requirePositive(k1, "Коравината k1");
  requirePositive(k2, "Коравината k2");
  if (!Number.isFinite(T)) throw new Error("Моментът трябва да е число.");
  return { TA: (T * k1) / (k1 + k2), TB: (T * k2) / (k1 + k2) };
}

/**
 * Частен случай – постоянно сечение: T_A = T·b / l, T_B = T·a / l,
 * където a е разстоянието от A до натовареното сечение, b = l − a.
 */
export function fixedFixedUniform(
  T: number,
  a: number,
  b: number,
): FixedFixedSplit {
  requirePositive(a, "Разстоянието a");
  requirePositive(b, "Разстоянието b");
  if (!Number.isFinite(T)) throw new Error("Моментът трябва да е число.");
  return { TA: (T * b) / (a + b), TB: (T * a) / (a + b) };
}

export type RoundSegment = {
  /** дължина, cm */
  length: number;
  /** външен диаметър, cm */
  D: number;
  /** вътрешен диаметър, cm (липсва – плътно сечение) */
  d?: number;
  /** модул на срязване, kN/cm² */
  G: number;
};

export type FixedFixedShaftResult = {
  /** опорен момент в A, kN·m; T_A + T_B = сбора на външните моменти */
  TA: number;
  /** опорен момент в B, kN·m */
  TB: number;
  /** усукващ момент във всеки участък, kN·m (със знак) */
  T: number[];
  /** най-голямо тангенциално напрежение във всеки участък, kN/cm² (≥ 0) */
  tau: number[];
  /** ъгъл на усукване на всеки участък, rad (със знак) */
  twist: number[];
  /** завъртане на сечението в края на всеки участък спрямо A, rad */
  rotation: number[];
};

/**
 * Вал от n участъка с кръгло сечение, запънат в двата края. `torques[i]` е
 * външният момент (kN·m) в сечението между участък i и участък i+1, така че
 * дължината на масива е n − 1.
 *
 * Решение: освобождава се опората B. Тогава усукващият момент в участък i е
 * сборът на външните моменти вдясно от него, намален с T_B. Условието
 * φ_B = Σ T_i·l_i / (G_i·I_p,i) = 0 дава T_B.
 */
export function solveFixedFixedRound(
  segments: RoundSegment[],
  torques: number[],
): FixedFixedShaftResult {
  if (segments.length < 2) {
    throw new Error("Нужни са поне два участъка.");
  }
  if (torques.length !== segments.length - 1) {
    throw new Error(
      "Броят на външните моменти трябва да е с един по-малък от броя участъци.",
    );
  }
  if (torques.some((t) => !Number.isFinite(t))) {
    throw new Error("Моментите трябва да са числа.");
  }
  const Ip = segments.map((s) => polarMoment(s.D, s.d ?? 0));
  const Wp = segments.map((s) => polarModulus(s.D, s.d ?? 0));
  // податливост на участък: ъгъл (rad) от момент 1 kN·cm
  const flex = segments.map((s, i) => {
    requirePositive(s.length, "Дължината");
    requirePositive(s.G, "G");
    return s.length / (s.G * Ip[i]!);
  });
  // усукващ момент при освободена опора B: сборът на моментите вдясно
  const free = segments.map((_, i) =>
    torques.slice(i).reduce((sum, t) => sum + t, 0),
  );
  const freeRotation = free.reduce((sum, t, i) => sum + t * flex[i]!, 0);
  const totalFlex = flex.reduce((sum, f) => sum + f, 0);
  const TB = freeRotation / totalFlex;
  const T = free.map((t) => t - TB);
  const twist = T.map((t, i) => t * KNM_TO_KNCM * flex[i]!);
  const rotation: number[] = [];
  let sum = 0;
  for (const angle of twist) {
    sum += angle;
    rotation.push(sum);
  }
  return {
    TA: T[0]!,
    TB,
    T,
    tau: T.map((t, i) => (Math.abs(t) * KNM_TO_KNCM) / Wp[i]!),
    twist,
    rotation,
  };
}

/**
 * Съставен вал: няколко съосни части (сърцевина и тръби), които се усукват
 * заедно на един и същ ъгъл. Моментът се разпределя според G_i·I_p,i:
 * T_i = T·G_i·I_p,i / Σ(G·I_p). Връща частите на момента в kN·m.
 */
export function compositeShaftSplit(
  T: number,
  parts: { G: number; Ip: number }[],
): number[] {
  if (parts.length === 0) throw new Error("Нужна е поне една част.");
  if (!Number.isFinite(T)) throw new Error("Моментът трябва да е число.");
  for (const p of parts) {
    requirePositive(p.G, "G");
    requirePositive(p.Ip, "I_p");
  }
  const total = parts.reduce((sum, p) => sum + p.G * p.Ip, 0);
  return parts.map((p) => (T * p.G * p.Ip) / total);
}

function requireRatio(ratio: number): void {
  if (!(ratio >= 1) || !Number.isFinite(ratio)) {
    throw new Error("Отношението h/b трябва да е число, не по-малко от 1.");
  }
}

/**
 * Коефициент β за правоъгълник (h – дългата страна, b – късата): I_t = β·h·b³.
 * Ред на Сен-Венан:
 * β = 1/3 · [1 − (192/π⁵)·(b/h)·Σ tanh(n·π·h / (2b)) / n⁵],  n = 1, 3, 5, …
 */
export function rectBeta(ratio: number, terms = 60): number {
  requireRatio(ratio);
  let sum = 0;
  for (let k = 0; k < terms; k++) {
    const n = 2 * k + 1;
    sum += Math.tanh((n * Math.PI * ratio) / 2) / n ** 5;
  }
  return (1 - (192 / Math.PI ** 5 / ratio) * sum) / 3;
}

/**
 * Коефициент α за правоъгълник: τ_max = T / (α·h·b²), в средата на дългата страна.
 * От решението на Сен-Венан τ_max = G·θ·b·k, където
 * k = 1 − (8/π²)·Σ 1 / (n²·cosh(n·π·h / (2b))),  n = 1, 3, 5, …
 * и T = G·θ·β·h·b³, следователно α = β / k.
 */
export function rectAlpha(ratio: number, terms = 60): number {
  requireRatio(ratio);
  let sum = 0;
  for (let k = 0; k < terms; k++) {
    const n = 2 * k + 1;
    sum += 1 / (n * n * Math.cosh((n * Math.PI * ratio) / 2));
  }
  return rectBeta(ratio, terms) / (1 - (8 / Math.PI ** 2) * sum);
}

/** Граничната стойност на α и β за безкрайно тънка ивица (h/b → ∞). */
export const THIN_STRIP_COEFFICIENT = 1 / 3;

/**
 * Таблицата от главата: стойностите на редовете, закръглени до три значещи
 * цифри. Примерите в текста се смятат с тези закръглени числа.
 */
export const RECT_TABLE: { ratio: number; alpha: number; beta: number }[] = [
  { ratio: 1, alpha: 0.208, beta: 0.141 },
  { ratio: 1.5, alpha: 0.231, beta: 0.196 },
  { ratio: 2, alpha: 0.246, beta: 0.229 },
  { ratio: 3, alpha: 0.267, beta: 0.263 },
  { ratio: 4, alpha: 0.282, beta: 0.281 },
  { ratio: 6, alpha: 0.298, beta: 0.298 },
  { ratio: 10, alpha: 0.312, beta: 0.312 },
];

function requireRect(h: number, b: number): void {
  requirePositive(h, "Дългата страна h");
  requirePositive(b, "Късата страна b");
  if (b > h) {
    throw new Error("b е късата страна: трябва b ≤ h.");
  }
}

/** Съпротивителен момент при усукване на правоъгълник: W_t = α·h·b², cm³. */
export function rectTorsionModulus(
  h: number,
  b: number,
  alpha: number,
): number {
  requireRect(h, b);
  requirePositive(alpha, "α");
  return alpha * h * b * b;
}

/** Инерционен момент при усукване на правоъгълник: I_t = β·h·b³, cm⁴. */
export function rectTorsionInertia(h: number, b: number, beta: number): number {
  requireRect(h, b);
  requirePositive(beta, "β");
  return beta * h * b ** 3;
}

/** τ_max = |T| / W_t, kN/cm² – в средата на дългата страна. */
export function rectMaxStress(T: number, Wt: number): number {
  requirePositive(Wt, "W_t");
  return (Math.abs(T) * KNM_TO_KNCM) / Wt;
}

/** φ = T·l / (G·I_t), rad. */
export function rectTwistAngle(
  T: number,
  length: number,
  G: number,
  It: number,
): number {
  requirePositive(length, "Дължината");
  requirePositive(G, "G");
  requirePositive(It, "I_t");
  return (T * KNM_TO_KNCM * length) / (G * It);
}

/**
 * Отворен тънкостенен профил, съставен от тесни ивици с дължина h_i и
 * дебелина t_i: I_t ≈ Σ h_i·t_i³ / 3, cm⁴. Приближение за h_i ≫ t_i.
 */
export function thinOpenInertia(strips: { h: number; t: number }[]): number {
  if (strips.length === 0) throw new Error("Нужна е поне една ивица.");
  return strips.reduce((sum, s) => {
    requirePositive(s.h, "Дължината на ивицата");
    requirePositive(s.t, "Дебелината на ивицата");
    return sum + (s.h * s.t ** 3) / 3;
  }, 0);
}
