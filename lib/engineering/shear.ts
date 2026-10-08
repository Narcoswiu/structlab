import { sectionProperties, type Rect } from "./section.ts";

/**
 * Тангенциални напрежения при огъване с напречна сила – формула на Журавски:
 *
 *   τ = Q · S / (I_x · b)
 *
 * Q – напречна сила в kN; S – статичен момент спрямо неутралната ос на частта
 * от сечението от едната страна на разглежданото ниво, cm³; I_x – инерционен
 * момент на цялото сечение, cm⁴; b – ширина на сечението на това ниво, cm.
 * Напрежението е в kN/cm² (1 kN/cm² = 10 MPa) и се връща по големина.
 *
 * Сечението е от плътни правоъгълници (без отвори), симетрично спрямо
 * вертикалната ос – за такива сечения формулата важи.
 */

function assertSolid(rects: Rect[]) {
  if (rects.some((rect) => rect.hole)) {
    throw new Error("Сечения с отвори не се поддържат.");
  }
}

/** Ширина на сечението на височина y (от началото на координатите). */
export function widthAt(
  rects: Rect[],
  y: number,
  side: "above" | "below",
): number {
  assertSolid(rects);
  const eps = 1e-9;
  // точно на границата между две части: „above“ гледа частта над нея
  const probe = side === "above" ? y + eps : y - eps;
  return rects
    .filter((rect) => probe > rect.y && probe < rect.y + rect.h)
    .reduce((sum, rect) => sum + rect.b, 0);
}

/**
 * Статичен момент спрямо неутралната ос на частта от сечението НАД ниво y.
 * (Частта под нивото дава същата стойност с обратен знак.)
 */
export function staticMomentAbove(rects: Rect[], y: number): number {
  assertSolid(rects);
  const { yc } = sectionProperties(rects);
  let S = 0;
  for (const rect of rects) {
    const bottom = Math.max(rect.y, y);
    const top = rect.y + rect.h;
    if (top <= bottom) continue;
    S += rect.b * (top - bottom) * ((top + bottom) / 2 - yc);
  }
  return S;
}

/** τ = Q·S/(I·b) на височина y; `side` избира ширината при скок на сечението. */
export function shearStressAt(
  rects: Rect[],
  Q: number,
  y: number,
  side: "above" | "below" = "above",
): number {
  const { Ix } = sectionProperties(rects);
  const b = widthAt(rects, y, side);
  if (!(b > 0)) return 0; // най-горният и най-долният ръб са свободни
  return Math.abs((Q * staticMomentAbove(rects, y)) / (Ix * b));
}

export type ShearPoint = { y: number; tau: number };

/**
 * Диаграмата τ по височината: за всяка част с постоянна ширина – редица от
 * точки (парабола). На границите между частите има скок, затова всяка част
 * е отделен списък.
 */
export function shearStressProfile(
  rects: Rect[],
  Q: number,
  pointsPerPart = 24,
): ShearPoint[][] {
  assertSolid(rects);
  const levels = [
    ...new Set(rects.flatMap((rect) => [rect.y, rect.y + rect.h])),
  ].sort((a, b) => a - b);
  const parts: ShearPoint[][] = [];
  for (let i = 0; i < levels.length - 1; i++) {
    const y1 = levels[i]!;
    const y2 = levels[i + 1]!;
    const points: ShearPoint[] = [];
    for (let k = 0; k <= pointsPerPart; k++) {
      const y = y1 + ((y2 - y1) * k) / pointsPerPart;
      const side = k === pointsPerPart ? "below" : "above";
      points.push({ y, tau: shearStressAt(rects, Q, y, side) });
    }
    parts.push(points);
  }
  return parts;
}

/** Най-голямото тангенциално напрежение в сечението и къде е то. */
export function maxShearStress(rects: Rect[], Q: number): ShearPoint {
  const { yc } = sectionProperties(rects);
  const candidates: ShearPoint[] = [
    // на неутралната ос S е най-голям
    { y: yc, tau: shearStressAt(rects, Q, yc) },
    // но при рязко стесняване напрежението може да е по-голямо там
    ...shearStressProfile(rects, Q, 2).flat(),
  ];
  return candidates.reduce((best, point) =>
    point.tau > best.tau ? point : best,
  );
}

/**
 * Каква част от напречната сила поема дадена част от сечението (между две
 * нива): ∫ τ·b dy / Q. За стеблото на профил „I“ това е над 90 %.
 */
export function shearShare(rects: Rect[], y1: number, y2: number): number {
  const steps = 2000;
  const h = (y2 - y1) / steps;
  let sum = 0;
  for (let k = 0; k < steps; k++) {
    const y = y1 + (k + 0.5) * h;
    sum += shearStressAt(rects, 1, y) * widthAt(rects, y, "above") * h;
  }
  return sum;
}

/** Правоъгълник: τ_max = 1,5 · Q / A. */
export function rectangleMaxShear(Q: number, b: number, h: number): number {
  return (1.5 * Math.abs(Q)) / (b * h);
}
