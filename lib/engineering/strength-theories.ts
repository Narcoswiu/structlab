/**
 * Теории за якост: еквивалентно (приведено) напрежение при сложно напрегнато
 * състояние.
 *
 * Мерни единици: напрежения в kN/cm² (1 kN/cm² = 10 MPa); моменти в kN·m;
 * диаметри в cm; съпротивителни моменти в cm³.
 *
 * Знаци: нормалното напрежение е положително при опън. Знакът на
 * тангенциалното напрежение не влияе на нито един резултат тук.
 *
 * Главните напрежения се подават в произволен ред. При равнинно напрегнато
 * състояние третото главно напрежение е нула – това е стойността по
 * подразбиране и тя УЧАСТВА в сметките (важно за III теория и за теорията на
 * Мор, когато двете главни напрежения в равнината са с еднакъв знак).
 */

/** kN·m → kN·cm */
const KNM_TO_KNCM = 100;

export type ShaftTheory = "III" | "IV";

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} трябва да е крайно число.`);
  }
}

function requirePositive(value: number, name: string): void {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new Error(`${name} трябва да е положително число.`);
  }
}

function requirePoisson(nu: number): void {
  if (!(nu >= 0) || !(nu <= 0.5)) {
    throw new Error("Коефициентът на Поасон трябва да е между 0 и 0,5.");
  }
}

function requirePrincipal(s1: number, s2: number, s3: number): void {
  requireFinite(s1, "Главното напрежение σ₁");
  requireFinite(s2, "Главното напрежение σ₂");
  requireFinite(s3, "Третото главно напрежение");
}

/**
 * Главни напрежения при равнинно напрегнато състояние:
 * σ₁,₂ = (σx + σy)/2 ± √(((σx − σy)/2)² + τ²), като σ₁ ≥ σ₂.
 */
export function principalStressesPlane(
  sigmaX: number,
  sigmaY: number,
  tau: number,
): { s1: number; s2: number } {
  requireFinite(sigmaX, "Напрежението σx");
  requireFinite(sigmaY, "Напрежението σy");
  requireFinite(tau, "Тангенциалното напрежение");
  const mean = (sigmaX + sigmaY) / 2;
  const radius = Math.hypot((sigmaX - sigmaY) / 2, tau);
  return { s1: mean + radius, s2: mean - radius };
}

/**
 * Главни напрежения в точка от греда (σ по оста на гредата, τ в сечението,
 * σy = 0): σ₁,₂ = σ/2 ± ½·√(σ² + 4τ²). При τ ≠ 0 винаги σ₁ > 0 > σ₂.
 */
export function beamPrincipalStresses(
  sigma: number,
  tau: number,
): { s1: number; s2: number } {
  return principalStressesPlane(sigma, 0, tau);
}

/**
 * I теория (най-големи нормални напрежения): σ_екв = най-голямото главно
 * напрежение. При равнинно състояние третото е нула, затова резултатът не е
 * отрицателен; нула означава, че в точката няма опън.
 */
export function equivalentMaxNormal(s1: number, s2: number, s3 = 0): number {
  requirePrincipal(s1, s2, s3);
  return Math.max(s1, s2, s3);
}

/**
 * II теория (най-големи линейни деформации): σ_екв = E·ε_max, тоест
 * най-голямата от стойностите σi − ν·(σj + σk).
 */
export function equivalentMaxStrain(
  nu: number,
  s1: number,
  s2: number,
  s3 = 0,
): number {
  requirePoisson(nu);
  requirePrincipal(s1, s2, s3);
  return Math.max(
    s1 - nu * (s2 + s3),
    s2 - nu * (s1 + s3),
    s3 - nu * (s1 + s2),
  );
}

/**
 * III теория (най-големи тангенциални напрежения, Треска):
 * σ_екв = σ_max − σ_min = 2·τ_max.
 */
export function equivalentTresca(s1: number, s2: number, s3 = 0): number {
  requirePrincipal(s1, s2, s3);
  return Math.max(s1, s2, s3) - Math.min(s1, s2, s3);
}

/**
 * IV теория (енергия на формоизменението, Хубер–Мизес):
 * σ_екв = √(½·[(σ₁ − σ₂)² + (σ₂ − σ₃)² + (σ₃ − σ₁)²]).
 */
export function equivalentMises(s1: number, s2: number, s3 = 0): number {
  requirePrincipal(s1, s2, s3);
  return Math.sqrt(((s1 - s2) ** 2 + (s2 - s3) ** 2 + (s3 - s1) ** 2) / 2);
}

/**
 * Теория на Мор (опростена, с права гранична обвивка):
 * σ_екв = σ_max − k·σ_min, където k = σ_доп,оп / σ_доп,нат (0 < k ≤ 1).
 * Резултатът се сравнява с допустимото напрежение на ОПЪН. При k = 1 съвпада
 * с III теория.
 */
export function equivalentMohr(
  k: number,
  s1: number,
  s2: number,
  s3 = 0,
): number {
  if (!(k > 0) || !(k <= 1)) {
    throw new Error(
      "Отношението k на якостите на опън и на натиск трябва да е между 0 и 1.",
    );
  }
  requirePrincipal(s1, s2, s3);
  return Math.max(s1, s2, s3) - k * Math.min(s1, s2, s3);
}

/** Точка от греда, I теория: σ_екв = σ/2 + ½·√(σ² + 4τ²). */
export function beamEquivalentMaxNormal(sigma: number, tau: number): number {
  return beamPrincipalStresses(sigma, tau).s1;
}

/** Точка от греда, II теория: σ_екв = (1 − ν)/2·σ + (1 + ν)/2·√(σ² + 4τ²). */
export function beamEquivalentMaxStrain(
  sigma: number,
  tau: number,
  nu: number,
): number {
  requirePoisson(nu);
  requireFinite(sigma, "Нормалното напрежение");
  requireFinite(tau, "Тангенциалното напрежение");
  return ((1 - nu) / 2) * sigma + ((1 + nu) / 2) * Math.hypot(sigma, 2 * tau);
}

/** Точка от греда, III теория: σ_екв = √(σ² + 4τ²). */
export function beamEquivalentTresca(sigma: number, tau: number): number {
  requireFinite(sigma, "Нормалното напрежение");
  requireFinite(tau, "Тангенциалното напрежение");
  return Math.hypot(sigma, 2 * tau);
}

/** Точка от греда, IV теория: σ_екв = √(σ² + 3τ²). */
export function beamEquivalentMises(sigma: number, tau: number): number {
  requireFinite(sigma, "Нормалното напрежение");
  requireFinite(tau, "Тангенциалното напрежение");
  return Math.hypot(sigma, Math.sqrt(3) * tau);
}

/**
 * Тангенциалното напрежение, при което настъпва провлачане при чисто срязване:
 * f_y/2 по III теория и f_y/√3 по IV теория.
 */
export function shearYieldStress(fy: number, theory: ShaftTheory): number {
  requirePositive(fy, "Границата на провлачане");
  return theory === "III" ? fy / 2 : fy / Math.sqrt(3);
}

/** Условие за якост: σ_екв ≤ σ_доп. */
export function isStrengthSatisfied(
  equivalent: number,
  sigmaAllow: number,
): boolean {
  requireFinite(equivalent, "Еквивалентното напрежение");
  requirePositive(sigmaAllow, "Допустимото напрежение");
  return equivalent <= sigmaAllow;
}

/**
 * Съпротивителен момент на кръг (d = 0) или пръстен спрямо централна ос:
 * W = π·(D⁴ − d⁴) / (32·D), cm³. Полярният е двойно по-голям: W_p = 2·W.
 */
export function circularSectionModulus(D: number, d = 0): number {
  requirePositive(D, "Външният диаметър");
  if (!(d >= 0) || !(d < D)) {
    throw new Error("Вътрешният диаметър трябва да е между 0 и външния.");
  }
  return (Math.PI * (D ** 4 - d ** 4)) / (32 * D);
}

/**
 * Еквивалентен момент за кръгъл вал на огъване с усукване, kN·m:
 * √(M² + T²) по III теория и √(M² + 0,75·T²) по IV теория.
 */
export function equivalentMoment(
  M: number,
  T: number,
  theory: ShaftTheory,
): number {
  requireFinite(M, "Огъващият момент");
  requireFinite(T, "Усукващият момент");
  return theory === "III"
    ? Math.hypot(M, T)
    : Math.hypot(M, (Math.sqrt(3) / 2) * T);
}

/**
 * Еквивалентно напрежение в опасната точка на кръгъл вал: σ_екв = M_екв / W,
 * kN/cm². M и T са в kN·m, W (осовият съпротивителен момент) е в cm³.
 */
export function shaftEquivalentStress(
  M: number,
  T: number,
  W: number,
  theory: ShaftTheory,
): number {
  requirePositive(W, "Съпротивителният момент");
  return (equivalentMoment(M, T, theory) * KNM_TO_KNCM) / W;
}

/**
 * Диаметър на плътен кръгъл вал по условието σ_екв ≤ σ_доп:
 * d ≥ ∛(32·M_екв / (π·σ_доп)), cm.
 */
export function shaftDiameter(
  M: number,
  T: number,
  sigmaAllow: number,
  theory: ShaftTheory,
): number {
  requirePositive(sigmaAllow, "Допустимото напрежение");
  const Meq = equivalentMoment(M, T, theory) * KNM_TO_KNCM;
  if (!(Meq > 0)) {
    throw new Error("Поне един от двата момента трябва да е различен от нула.");
  }
  return Math.cbrt((32 * Meq) / (Math.PI * sigmaAllow));
}
