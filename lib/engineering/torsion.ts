/**
 * Усукване на прави пръти с кръгло и с пръстеновидно (тръбно) сечение.
 *
 * Мерни единици: усукващ момент T в kN·m; диаметри, радиуси и дължини в cm;
 * I_p в cm⁴; W_p в cm³; G в kN/cm²; напрежения в kN/cm² (1 kN/cm² = 10 MPa);
 * ъгли в rad, относителен ъгъл на усукване в rad/cm (или в °/m – изрично).
 *
 * Формулите важат САМО за кръгло и за пръстеновидно сечение. Некръглите
 * сечения се изкривяват (депланират) и за тях тези функции не се ползват.
 */

/** kN·m → kN·cm */
const KNM_TO_KNCM = 100;

/** Модул на срязване на стоманата, kN/cm² (БДС EN 1993-1-1, т. 3.2.6: 81 000 N/mm²). */
export const G_STEEL = 8100;

function assertSection(D: number, d: number): void {
  if (!(D > 0)) {
    throw new Error("Външният диаметър трябва да е положителен.");
  }
  if (!(d >= 0) || !(d < D)) {
    throw new Error(
      "Вътрешният диаметър трябва да е между 0 и външния диаметър.",
    );
  }
}

/** Площ на кръг (d = 0) или пръстен: A = π·(D² − d²) / 4, cm². */
export function circularArea(D: number, d = 0): number {
  assertSection(D, d);
  return (Math.PI * (D * D - d * d)) / 4;
}

/** Полярен инерционен момент: I_p = π·(D⁴ − d⁴) / 32, cm⁴ (d = 0 – плътен кръг). */
export function polarMoment(D: number, d = 0): number {
  assertSection(D, d);
  return (Math.PI * (D ** 4 - d ** 4)) / 32;
}

/**
 * Полярен съпротивителен момент: W_p = I_p / (D/2), cm³.
 * За пръстен това НЕ е разлика от съпротивителните моменти на два кръга.
 */
export function polarModulus(D: number, d = 0): number {
  return polarMoment(D, d) / (D / 2);
}

/** τ = T·ρ / I_p на разстояние ρ (cm) от оста на пръта, kN/cm². */
export function torsionStress(T: number, Ip: number, rho: number): number {
  if (!(Ip > 0)) {
    throw new Error("Полярният инерционен момент трябва да е положителен.");
  }
  if (!(rho >= 0)) {
    throw new Error("Разстоянието от оста не може да е отрицателно.");
  }
  return (T * KNM_TO_KNCM * rho) / Ip;
}

/** τ_max = |T| / W_p, kN/cm². */
export function maxTorsionStress(T: number, Wp: number): number {
  if (!(Wp > 0)) {
    throw new Error("Полярният съпротивителен момент трябва да е положителен.");
  }
  return (Math.abs(T) * KNM_TO_KNCM) / Wp;
}

/** Относителен ъгъл на усукване: θ = T / (G·I_p), rad/cm. */
export function twistRate(T: number, G: number, Ip: number): number {
  if (!(G > 0) || !(Ip > 0)) {
    throw new Error("G и I_p трябва да са положителни.");
  }
  return (T * KNM_TO_KNCM) / (G * Ip);
}

/** Ъгъл на усукване на участък с дължина `length` (cm): φ = T·l / (G·I_p), rad. */
export function twistAngle(
  T: number,
  length: number,
  G: number,
  Ip: number,
): number {
  if (!(length > 0)) {
    throw new Error("Дължината трябва да е положителна.");
  }
  return twistRate(T, G, Ip) * length;
}

/** rad → градуси */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** °/m → rad/cm: 1 °/m = π/180/100 rad/cm */
export function degPerMToRadPerCm(degPerM: number): number {
  return (degPerM * Math.PI) / 180 / 100;
}

/** rad/cm → °/m */
export function radPerCmToDegPerM(radPerCm: number): number {
  return radToDeg(radPerCm) * 100;
}

/** Най-големият момент, който сечение с W_p понася: T = W_p·τ_доп, kN·m. */
export function torqueCapacity(Wp: number, tauAllow: number): number {
  if (!(Wp > 0) || !(tauAllow > 0)) {
    throw new Error("W_p и допустимото напрежение трябва да са положителни.");
  }
  return (Wp * tauAllow) / KNM_TO_KNCM;
}

/** Диаметър на плътен прът по условието за якост: d ≥ ∛(16·T / (π·τ_доп)), cm. */
export function diameterForStrength(T: number, tauAllow: number): number {
  if (!(tauAllow > 0)) {
    throw new Error("Допустимото напрежение трябва да е положително.");
  }
  return Math.cbrt((16 * Math.abs(T) * KNM_TO_KNCM) / (Math.PI * tauAllow));
}

/**
 * Диаметър на плътен прът по условието за коравина:
 * d ≥ ⁴√(32·T / (π·G·θ_доп)), cm. Допустимият относителен ъгъл се задава в °/m.
 */
export function diameterForStiffness(
  T: number,
  G: number,
  thetaAllowDegPerM: number,
): number {
  if (!(G > 0) || !(thetaAllowDegPerM > 0)) {
    throw new Error("G и допустимият ъгъл трябва да са положителни.");
  }
  const theta = degPerMToRadPerCm(thetaAllowDegPerM);
  return ((32 * Math.abs(T) * KNM_TO_KNCM) / (Math.PI * G * theta)) ** 0.25;
}

/**
 * Тръба с отношение α = d/D, която има същия W_p като плътен прът с диаметър
 * `solidDiameter`: D³·(1 − α⁴) = d₀³.
 */
export function equalStrengthTube(
  solidDiameter: number,
  alpha: number,
): { D: number; d: number } {
  if (!(solidDiameter > 0)) {
    throw new Error("Диаметърът трябва да е положителен.");
  }
  if (!(alpha >= 0) || !(alpha < 1)) {
    throw new Error("Отношението d/D трябва да е между 0 и 1.");
  }
  const D = solidDiameter / Math.cbrt(1 - alpha ** 4);
  return { D, d: alpha * D };
}

export type ShaftSegment = {
  /** дължина на участъка, cm */
  length: number;
  /** външен диаметър, cm */
  D: number;
  /** вътрешен диаметър, cm (липсва или 0 – плътно сечение) */
  d?: number;
  /** модул на срязване, kN/cm² */
  G: number;
};

export type ShaftResult = {
  /** усукващ момент във всеки участък, kN·m */
  T: number[];
  /** най-голямо тангенциално напрежение във всеки участък, kN/cm² (≥ 0) */
  tau: number[];
  /** ъгъл на усукване на всеки участък, rad */
  twist: number[];
  /** завъртане на сечението в края на всеки участък спрямо началото, rad */
  rotation: number[];
};

function validateShaft(segments: ShaftSegment[], torques: number[]): void {
  if (segments.length === 0) throw new Error("Нужен е поне един участък.");
  if (segments.length !== torques.length) {
    throw new Error("Броят на моментите трябва да е равен на броя участъци.");
  }
  for (const s of segments) {
    assertSection(s.D, s.d ?? 0);
    if (!(s.length > 0) || !(s.G > 0)) {
      throw new Error("Дължината и G на участъка трябва да са положителни.");
    }
  }
}

function fromTorques(segments: ShaftSegment[], T: number[]): ShaftResult {
  const tau = segments.map((s, i) =>
    maxTorsionStress(T[i]!, polarModulus(s.D, s.d ?? 0)),
  );
  const twist = segments.map((s, i) =>
    twistAngle(T[i]!, s.length, s.G, polarMoment(s.D, s.d ?? 0)),
  );
  const rotation: number[] = [];
  let sum = 0;
  for (const angle of twist) {
    sum += angle;
    rotation.push(sum);
  }
  return { T, tau, twist, rotation };
}

/**
 * Стъпаловиден прът, запънат в началото и свободен в края. `torques[i]` е
 * външният усукващ момент (kN·m), приложен в края на участък i.
 * Методът на сечението: T в участък i е сборът на моментите от него до свободния край.
 */
export function solveShaft(
  segments: ShaftSegment[],
  torques: number[],
): ShaftResult {
  validateShaft(segments, torques);
  const T = segments.map((_, i) =>
    torques.slice(i).reduce((sum, t) => sum + t, 0),
  );
  return fromTorques(segments, T);
}

/**
 * Прът, запънат в двата края (статически неопределим). `torques[i]` е моментът
 * в края на участък i за i < n−1; последната стойност трябва да е 0.
 * Допълнителното уравнение: завъртането на втория край спрямо първия е нула.
 * `reactionStart` е усукващият момент в първия участък, `reactionEnd` –
 * моментът X, с който втората опора действа на пръта (със знак).
 */
export function solveFixedFixedShaft(
  segments: ShaftSegment[],
  torques: number[],
): ShaftResult & { reactionStart: number; reactionEnd: number } {
  validateShaft(segments, torques);
  if (torques[torques.length - 1] !== 0) {
    throw new Error("В запънатия край не се задава външен момент.");
  }
  // Освобождаваме втория край и прилагаме там неизвестен момент X.
  const free = solveShaft(segments, torques);
  const flexibility = segments.reduce(
    (sum, s) =>
      sum + (s.length * KNM_TO_KNCM) / (s.G * polarMoment(s.D, s.d ?? 0)),
    0,
  );
  const totalFree = free.rotation[free.rotation.length - 1]!;
  const X = -totalFree / flexibility;
  const result = fromTorques(
    segments,
    free.T.map((t) => t + X),
  );
  return { ...result, reactionStart: result.T[0]!, reactionEnd: X };
}
