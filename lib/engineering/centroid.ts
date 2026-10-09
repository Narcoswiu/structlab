/**
 * Център на тежестта на равнинна фигура (Теоретична механика – I част, Глава 7).
 *
 * Фигурата е съставена от прости части: правоъгълници, триъгълници, кръгове и
 * кръгови сектори (полукръг, четвърт кръг). Част с `hole: true` е отвор и
 * влиза с ОТРИЦАТЕЛНА площ.
 *
 * Знаци и означения (както в целия модул): оста x сочи надясно, оста y – НАГОРЕ.
 *   S_x = Σ A_i·y_i – статичен момент спрямо оста x;
 *   S_y = Σ A_i·x_i – статичен момент спрямо оста y;
 *   x_C = S_y / A,  y_C = S_x / A.
 * Статичният момент има знак: част под оста x дава отрицателен принос към S_x.
 *
 * Мерни единици: функциите не превръщат единици. Ако дължините са в cm,
 * площите са в cm², а статичните моменти в cm³; ако са в m – съответно m² и m³.
 *
 * Валидност: хомогенна плоча с постоянна дебелина. Частите не бива да се
 * застъпват, а отворите трябва да лежат изцяло в плътните части – функциите
 * не проверяват това.
 */

export type Point = { x: number; y: number };

export type Shape =
  /** правоъгълник със страни b (по x) и h (по y); (x; y) е долният ляв ъгъл */
  | {
      type: "rect";
      x: number;
      y: number;
      b: number;
      h: number;
      hole?: boolean;
    }
  /** триъгълник с върхове a, b, c (в произволен ред) */
  | { type: "triangle"; a: Point; b: Point; c: Point; hole?: boolean }
  /** кръг с център (cx; cy) и радиус r */
  | { type: "circle"; cx: number; cy: number; r: number; hole?: boolean }
  /**
   * кръгов сектор с център (cx; cy) и радиус r, от ъгъл `fromDeg` до ъгъл
   * `toDeg`. Ъглите се мерят от оста x обратно на часовниковата стрелка;
   * 0 < toDeg − fromDeg ≤ 360. Полукръг над диаметъра си: от 0° до 180°;
   * четвърт кръг в първи квадрант: от 0° до 90°.
   */
  | {
      type: "sector";
      cx: number;
      cy: number;
      r: number;
      fromDeg: number;
      toDeg: number;
      hole?: boolean;
    };

/** Ред от таблицата за една част. */
export type PartRow = {
  /** площ със знак: отрицателна за отвор */
  A: number;
  /** собствен център на тежестта на частта */
  x: number;
  y: number;
  /** принос към статичния момент спрямо оста x: A·y */
  Sx: number;
  /** принос към статичния момент спрямо оста y: A·x */
  Sy: number;
};

export type CompositeCentroid = {
  /** обща площ (отворите са извадени) */
  A: number;
  /** статичен момент спрямо оста x: Σ A_i·y_i */
  Sx: number;
  /** статичен момент спрямо оста y: Σ A_i·x_i */
  Sy: number;
  /** координати на центъра на тежестта */
  xc: number;
  yc: number;
  /** редовете на таблицата, в реда на частите */
  parts: PartRow[];
};

const DEG = Math.PI / 180;
/** под тази площ фигурата се приема за изродена */
const AREA_TOLERANCE = 1e-12;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Величината „${name}“ трябва да е крайно число.`);
  }
}

function assertPositive(value: number, name: string): void {
  assertFinite(value, name);
  if (!(value > 0)) {
    throw new Error(`Величината „${name}“ трябва да е положителна.`);
  }
}

function assertPoint(point: Point, name: string): void {
  assertFinite(point.x, `${name}.x`);
  assertFinite(point.y, `${name}.y`);
}

/** Удвоената ориентирана площ на триъгълника abc (> 0 при обход обратно на часовниковата). */
function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
}

/** Половината от централния ъгъл на сектора, в радиани; проверява входа. */
function sectorHalfAngle(fromDeg: number, toDeg: number): number {
  assertFinite(fromDeg, "fromDeg");
  assertFinite(toDeg, "toDeg");
  const span = toDeg - fromDeg;
  if (!(span > 0) || span > 360) {
    throw new Error("Ъгълът на сектора трябва да е между 0° и 360°.");
  }
  return (span * DEG) / 2;
}

function validate(shape: Shape): void {
  switch (shape.type) {
    case "rect":
      assertFinite(shape.x, "x");
      assertFinite(shape.y, "y");
      assertPositive(shape.b, "b");
      assertPositive(shape.h, "h");
      return;
    case "triangle":
      assertPoint(shape.a, "a");
      assertPoint(shape.b, "b");
      assertPoint(shape.c, "c");
      if (Math.abs(cross(shape.a, shape.b, shape.c)) <= AREA_TOLERANCE) {
        throw new Error("Върховете на триъгълника лежат на една права.");
      }
      return;
    case "circle":
      assertFinite(shape.cx, "cx");
      assertFinite(shape.cy, "cy");
      assertPositive(shape.r, "r");
      return;
    case "sector":
      assertFinite(shape.cx, "cx");
      assertFinite(shape.cy, "cy");
      assertPositive(shape.r, "r");
      sectorHalfAngle(shape.fromDeg, shape.toDeg);
      return;
  }
}

/**
 * Разстояние от центъра на кръга до центъра на тежестта на кръгов сектор с
 * радиус r и ПОЛОВИН централен ъгъл α (в градуси, 0 < α ≤ 180):
 *   d = 2·r·sin α / (3·α), α в радиани.
 * Центърът лежи на ъглополовящата. Полукръг (α = 90°): d = 4r/(3π).
 */
export function sectorCentroidDistance(
  r: number,
  halfAngleDeg: number,
): number {
  assertPositive(r, "r");
  assertFinite(halfAngleDeg, "halfAngleDeg");
  if (!(halfAngleDeg > 0) || halfAngleDeg > 180) {
    throw new Error("Половината от ъгъла на сектора е между 0° и 180°.");
  }
  const alpha = halfAngleDeg * DEG;
  return (2 * r * Math.sin(alpha)) / (3 * alpha);
}

/** Площ на една част – винаги положителна (знакът за отвор се слага в `partRow`). */
export function shapeArea(shape: Shape): number {
  validate(shape);
  switch (shape.type) {
    case "rect":
      return shape.b * shape.h;
    case "triangle":
      return Math.abs(cross(shape.a, shape.b, shape.c)) / 2;
    case "circle":
      return Math.PI * shape.r ** 2;
    case "sector":
      // A = r²·α, α – половината от централния ъгъл
      return shape.r ** 2 * sectorHalfAngle(shape.fromDeg, shape.toDeg);
  }
}

/**
 * Център на тежестта на една част:
 *   правоъгълник – пресечната точка на диагоналите;
 *   триъгълник – средното аритметично на върховете (пресечната точка на медианите);
 *   кръг – центърът му;
 *   сектор – на ъглополовящата, на разстояние 2·r·sin α / (3·α) от центъра.
 */
export function shapeCentroid(shape: Shape): Point {
  validate(shape);
  switch (shape.type) {
    case "rect":
      return { x: shape.x + shape.b / 2, y: shape.y + shape.h / 2 };
    case "triangle":
      return {
        x: (shape.a.x + shape.b.x + shape.c.x) / 3,
        y: (shape.a.y + shape.b.y + shape.c.y) / 3,
      };
    case "circle":
      return { x: shape.cx, y: shape.cy };
    case "sector": {
      const alpha = sectorHalfAngle(shape.fromDeg, shape.toDeg);
      const d = (2 * shape.r * Math.sin(alpha)) / (3 * alpha);
      const bisector = ((shape.fromDeg + shape.toDeg) / 2) * DEG;
      return {
        x: shape.cx + d * Math.cos(bisector),
        y: shape.cy + d * Math.sin(bisector),
      };
    }
  }
}

/** Ред от таблицата: площ със знак, собствен център и двата статични момента. */
export function partRow(shape: Shape): PartRow {
  const A = (shape.hole ? -1 : 1) * shapeArea(shape);
  const { x, y } = shapeCentroid(shape);
  return { A, x, y, Sx: A * y, Sy: A * x };
}

/**
 * Статични моменти на фигурата спрямо оси през точката `origin`, успоредни на
 * x и y: S_x = Σ A_i·(y_i − y_0), S_y = Σ A_i·(x_i − x_0).
 * За оси през центъра на тежестта и двата са нула.
 */
export function staticMoments(
  shapes: Shape[],
  origin: Point = { x: 0, y: 0 },
): { Sx: number; Sy: number } {
  assertPoint(origin, "origin");
  let Sx = 0;
  let Sy = 0;
  for (const shape of shapes) {
    const row = partRow(shape);
    Sx += row.A * (row.y - origin.y);
    Sy += row.A * (row.x - origin.x);
  }
  return { Sx, Sy };
}

/**
 * Център на тежестта на съставна фигура: x_C = S_y / A, y_C = S_x / A.
 * Грешка, ако няма части или общата площ не е положителна.
 */
export function compositeCentroid(shapes: Shape[]): CompositeCentroid {
  if (shapes.length === 0) {
    throw new Error("Фигурата трябва да има поне една част.");
  }
  const parts = shapes.map(partRow);
  let A = 0;
  let Sx = 0;
  let Sy = 0;
  for (const row of parts) {
    A += row.A;
    Sx += row.Sx;
    Sy += row.Sy;
  }
  if (!(A > AREA_TOLERANCE)) {
    throw new Error("Площта на фигурата трябва да е положителна.");
  }
  return { A, Sx, Sy, xc: Sy / A, yc: Sx / A, parts };
}

/** Лежи ли точката в една част (границата се брои за вътрешна). */
function inShape(shape: Shape, p: Point): boolean {
  switch (shape.type) {
    case "rect":
      return (
        p.x >= shape.x &&
        p.x <= shape.x + shape.b &&
        p.y >= shape.y &&
        p.y <= shape.y + shape.h
      );
    case "triangle": {
      const d1 = cross(shape.a, shape.b, p);
      const d2 = cross(shape.b, shape.c, p);
      const d3 = cross(shape.c, shape.a, p);
      const negative = d1 < 0 || d2 < 0 || d3 < 0;
      const positive = d1 > 0 || d2 > 0 || d3 > 0;
      return !(negative && positive);
    }
    case "circle":
      return Math.hypot(p.x - shape.cx, p.y - shape.cy) <= shape.r;
    case "sector": {
      if (Math.hypot(p.x - shape.cx, p.y - shape.cy) > shape.r) return false;
      const span = shape.toDeg - shape.fromDeg;
      const angle = Math.atan2(p.y - shape.cy, p.x - shape.cx) / DEG;
      // ъгълът на точката, приведен в интервала [fromDeg, fromDeg + 360)
      const relative = (((angle - shape.fromDeg) % 360) + 360) % 360;
      return relative <= span;
    }
  }
}

/**
 * Лежи ли точката върху материала на фигурата: в поне една плътна част и в
 * нито един отвор. С нея се проверява дали центърът на тежестта е извън фигурата.
 */
export function containsPoint(shapes: Shape[], point: Point): boolean {
  assertPoint(point, "point");
  for (const shape of shapes) validate(shape);
  const inSolid = shapes.some((s) => !s.hole && inShape(s, point));
  const inHole = shapes.some((s) => s.hole && inShape(s, point));
  return inSolid && !inHole;
}

/**
 * Тегло на хомогенна плоча с формата на фигурата и точката, през която минава
 * то. `weightPerArea` е теглото на единица площ (напр. kN/m² при размери в m):
 * G = weightPerArea·A. Теглото минава през центъра на тежестта на фигурата.
 */
export function plateWeight(
  shapes: Shape[],
  weightPerArea: number,
): { G: number; x: number; y: number } {
  assertPositive(weightPerArea, "weightPerArea");
  const { A, xc, yc } = compositeCentroid(shapes);
  return { G: weightPerArea * A, x: xc, y: yc };
}
