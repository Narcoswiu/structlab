import type { SectionProperties } from "./section.ts";

/**
 * Нормални напрежения при специално огъване – формула на Навие.
 *
 * Мерни единици: M в kN·m, I в cm⁴, W в cm³, разстояния в cm,
 * напрежения в kN/cm² (1 kN/cm² = 10 MPa).
 *
 * Знаци (както в целия учебник): M > 0 опъва долните влакна; σ > 0 е опън.
 */

/** kN·m → kN·cm */
const KNM_TO_KNCM = 100;

/**
 * σ = M·y / I за влакно на разстояние `yBelow` ПОД неутралната ос
 * (отрицателно `yBelow` е влакно над нея).
 */
export function navierStress(M: number, Ix: number, yBelow: number): number {
  if (!(Ix > 0)) {
    throw new Error("Инерционният момент трябва да е положителен.");
  }
  return (M * KNM_TO_KNCM * yBelow) / Ix;
}

export type ExtremeStresses = {
  /** напрежение в най-горното влакно */
  top: number;
  /** напрежение в най-долното влакно */
  bottom: number;
  /** най-голямото опънно напрежение (≥ 0) */
  maxTension: number;
  /** най-голямото натисково напрежение по абсолютна стойност (≥ 0) */
  maxCompression: number;
};

/** Напреженията в крайните влакна на сечение, огънато с момент M около оста x. */
export function extremeStresses(
  M: number,
  props: Pick<SectionProperties, "Ix" | "yTop" | "yBottom">,
): ExtremeStresses {
  const top = navierStress(M, props.Ix, -props.yTop);
  const bottom = navierStress(M, props.Ix, props.yBottom);
  return {
    top,
    bottom,
    maxTension: Math.max(top, bottom, 0),
    maxCompression: Math.max(-top, -bottom, 0),
  };
}

/** Нужният съпротивителен момент W ≥ |M| / σ_доп, в cm³. */
export function requiredSectionModulus(M: number, sigmaAllow: number): number {
  if (!(sigmaAllow > 0)) {
    throw new Error("Допустимото напрежение трябва да е положително.");
  }
  return (Math.abs(M) * KNM_TO_KNCM) / sigmaAllow;
}

/** Най-големият момент, който сечение със съпротивителен момент W понася, в kN·m. */
export function momentCapacity(W: number, sigmaAllow: number): number {
  return (W * sigmaAllow) / KNM_TO_KNCM;
}

/** Правоъгълник b×h, огънат около оста, успоредна на b: W = b·h² / 6. */
export function rectangleModulus(b: number, h: number): number {
  return (b * h * h) / 6;
}

/** Плътен кръг с диаметър d: W = π·d³ / 32. */
export function circleModulus(d: number): number {
  return (Math.PI * d ** 3) / 32;
}

/**
 * Размери на правоъгълно сечение с отношение h/b = `ratio`, което има
 * съпротивителен момент поне W. От W = b·h²/6 и b = h/ratio: h = ∛(6·ratio·W).
 */
export function rectangleForModulus(
  W: number,
  ratio: number,
): { b: number; h: number } {
  if (!(W > 0) || !(ratio > 0)) {
    throw new Error("W и отношението h/b трябва да са положителни.");
  }
  const h = Math.cbrt(6 * ratio * W);
  return { b: h / ratio, h };
}
