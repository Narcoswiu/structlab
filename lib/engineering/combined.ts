/**
 * Огъване, съчетано с опън или натиск; нецентрична сила; ядро на сечението.
 *
 * Мерни единици: сили в kN, моменти в kN·m, размери в cm, A в cm², I в cm⁴,
 * напрежения в kN/cm² (1 kN/cm² = 10 MPa).
 *
 * Знаци – както в biaxial.ts: оста x сочи надясно, оста y – НАДОЛУ, началото е
 * в центъра на тежестта. N > 0 е опън. M_x > 0 опъва долните влакна (y > 0),
 * M_y > 0 опъва десните (x > 0). σ > 0 е опън.
 */
import {
  biaxialStress,
  type BiaxialMoments,
  type CornerStresses,
} from "./biaxial.ts";

const KNM_TO_KNCM = 100;

export type CombinedSection = { A: number; Ix: number; Iy: number };
export type Point = { x: number; y: number };

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} трябва да е крайно число.`);
  }
}

function requirePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || !(value > 0)) {
    throw new Error(`${name} трябва да е положително число.`);
  }
}

/**
 * Нецентрична сила F (kN; опън +, натиск −), приложена в точка (x_F; y_F) в cm.
 * Пренесена в центъра на тежестта, тя дава N = F, M_x = F·y_F, M_y = F·x_F
 * (моментите са в kN·m).
 */
export function eccentricForce(
  F: number,
  xF: number,
  yF: number,
): { N: number } & BiaxialMoments {
  requireFinite(F, "Силата");
  requireFinite(xF, "Координатата x на силата");
  requireFinite(yF, "Координатата y на силата");
  return {
    N: F,
    Mx: (F * yF) / KNM_TO_KNCM,
    My: (F * xF) / KNM_TO_KNCM,
  };
}

/** σ = N/A + M_x·y/I_x + M_y·x/I_y в точка (x; y). */
export function combinedStress(
  N: number,
  moments: BiaxialMoments,
  section: CombinedSection,
  x: number,
  y: number,
): number {
  requireFinite(N, "Нормалната сила");
  requirePositive(section.A, "Площта");
  return N / section.A + biaxialStress(moments, section, x, y);
}

/** Площ и инерционни моменти на правоъгълник b×h (b по x, h по y). */
export function rectangleSection(b: number, h: number): CombinedSection {
  requirePositive(b, "Ширината b");
  requirePositive(h, "Височината h");
  return { A: b * h, Ix: (b * h ** 3) / 12, Iy: (h * b ** 3) / 12 };
}

/** Напреженията в четирите ъгъла на правоъгълник b×h при N, M_x и M_y. */
export function rectangleCombinedCorners(
  N: number,
  moments: BiaxialMoments,
  b: number,
  h: number,
): CornerStresses {
  const section = rectangleSection(b, h);
  const at = (x: number, y: number) =>
    combinedStress(N, moments, section, x, y);
  return {
    topLeft: at(-b / 2, -h / 2),
    topRight: at(b / 2, -h / 2),
    bottomLeft: at(-b / 2, h / 2),
    bottomRight: at(b / 2, h / 2),
  };
}

/**
 * Огъване в една равнина с нормална сила: напреженията в горното и долното
 * крайно влакно. yTop и yBottom са разстоянията (положителни, cm) от центъра
 * на тежестта до двете влакна: σ = N/A ∓ M·y/I_x.
 */
export function axialBendingExtremes(
  N: number,
  M: number,
  A: number,
  props: { Ix: number; yTop: number; yBottom: number },
): { top: number; bottom: number } {
  requireFinite(N, "Нормалната сила");
  requireFinite(M, "Огъващият момент");
  requirePositive(A, "Площта");
  requirePositive(props.Ix, "Инерционният момент");
  requirePositive(props.yTop, "Разстоянието до горното влакно");
  requirePositive(props.yBottom, "Разстоянието до долното влакно");
  const perCm = (M * KNM_TO_KNCM) / props.Ix;
  return {
    top: N / A - perCm * props.yTop,
    bottom: N / A + perCm * props.yBottom,
  };
}

/**
 * Положение на нулевата линия при огъване в една равнина с нормална сила:
 * y₀ = −(N/A)·I_x/M, в cm (отрицателно – над центъра на тежестта).
 */
export function zeroLineOffset(
  N: number,
  M: number,
  A: number,
  Ix: number,
): number {
  requireFinite(N, "Нормалната сила");
  requirePositive(A, "Площта");
  requirePositive(Ix, "Инерционният момент");
  if (!Number.isFinite(M) || M === 0) {
    throw new Error("При M = 0 няма нулева линия – напрежението е постоянно.");
  }
  return (-(N / A) * Ix) / (M * KNM_TO_KNCM);
}

/**
 * Отрези на нулевата линия по осите при нецентрична сила в точка (x_F; y_F):
 * a_x = −i_y²/x_F, a_y = −i_x²/y_F. Ако силата лежи на едната ос, нулевата
 * линия е успоредна на другата и съответният отрез е Infinity.
 */
export function zeroLineIntercepts(
  xF: number,
  yF: number,
  ix2: number,
  iy2: number,
): { ax: number; ay: number } {
  requireFinite(xF, "Координатата x на силата");
  requireFinite(yF, "Координатата y на силата");
  requirePositive(ix2, "Квадратът на радиуса на инерция i_x");
  requirePositive(iy2, "Квадратът на радиуса на инерция i_y");
  if (xF === 0 && yF === 0) {
    throw new Error("Центрична сила: нулева линия няма.");
  }
  return {
    ax: xF === 0 ? Infinity : -iy2 / xF,
    ay: yF === 0 ? Infinity : -ix2 / yF,
  };
}

/**
 * Обратната задача: нулевата линия има отрези a_x и a_y; къде е силата?
 * x_F = −i_y²/a_x, y_F = −i_x²/a_y (Infinity за отрез → координата 0).
 * С нея се строи ядрото: нулевата линия се допира до контура на сечението.
 */
export function forcePointForZeroLine(
  ax: number,
  ay: number,
  ix2: number,
  iy2: number,
): Point {
  requirePositive(ix2, "Квадратът на радиуса на инерция i_x");
  requirePositive(iy2, "Квадратът на радиуса на инерция i_y");
  if (ax === 0 || ay === 0 || Number.isNaN(ax) || Number.isNaN(ay)) {
    throw new Error("Нулевата линия не може да минава през центъра.");
  }
  // „+ 0“ превръща −0 в 0 (при безкраен отрез)
  return { x: -iy2 / ax + 0, y: -ix2 / ay + 0 };
}

/**
 * Ядро на правоъгълник b×h: ромб с полудиагонали e_x = b/6 (по x) и
 * e_y = h/6 (по y).
 */
export function rectangleCore(
  b: number,
  h: number,
): { ex: number; ey: number } {
  requirePositive(b, "Ширината b");
  requirePositive(h, "Височината h");
  return { ex: b / 6, ey: h / 6 };
}

/** Четирите върха на ромба: дясно, долу, ляво, горе (y сочи надолу). */
export function rectangleCoreVertices(b: number, h: number): Point[] {
  const { ex, ey } = rectangleCore(b, h);
  return [
    { x: ex, y: 0 },
    { x: 0, y: ey },
    { x: -ex, y: 0 },
    { x: 0, y: -ey },
  ];
}

/** Радиус на ядрото на плътен кръг с диаметър d: r = d/8. */
export function circleCoreRadius(d: number): number {
  requirePositive(d, "Диаметърът");
  return d / 8;
}

const CORE_TOLERANCE = 1e-9;

/**
 * Вътре ли е силата в ядрото на правоъгълника (границата се брои за „вътре“):
 * |x_F|/(b/6) + |y_F|/(h/6) ≤ 1.
 */
export function isInsideRectangleCore(
  xF: number,
  yF: number,
  b: number,
  h: number,
): boolean {
  requireFinite(xF, "Координатата x на силата");
  requireFinite(yF, "Координатата y на силата");
  const { ex, ey } = rectangleCore(b, h);
  return Math.abs(xF) / ex + Math.abs(yF) / ey <= 1 + CORE_TOLERANCE;
}

/** Вътре ли е силата в ядрото на плътен кръг: e = √(x_F² + y_F²) ≤ d/8. */
export function isInsideCircleCore(xF: number, yF: number, d: number): boolean {
  requireFinite(xF, "Координатата x на силата");
  requireFinite(yF, "Координатата y на силата");
  const radius = circleCoreRadius(d);
  return Math.hypot(xF, yF) <= radius * (1 + CORE_TOLERANCE);
}
