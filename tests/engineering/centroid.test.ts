import { describe, expect, it } from "vitest";
import {
  compositeCentroid,
  containsPoint,
  partRow,
  plateWeight,
  sectorCentroidDistance,
  shapeArea,
  shapeCentroid,
  staticMoments,
  type Shape,
} from "@/lib/engineering/centroid";
import { centroid, type Rect } from "@/lib/engineering/section";
import { parallelResultant } from "@/lib/engineering/reduction";
import { solveSupportReactions } from "@/lib/engineering/plane-body";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Означения: S_x = Σ A·y (спрямо оста x), S_y = Σ A·x (спрямо оста y).
// Размери в cm (площи cm², статични моменти cm³); панелът е в m и kN.

const rect = (
  x: number,
  y: number,
  b: number,
  h: number,
  hole = false,
): Shape => ({ type: "rect", x, y, b, h, hole });

/** Същият правоъгълник във формата на section.ts. */
function toRects(shapes: Shape[]): Rect[] {
  return shapes.map((s) => {
    if (s.type !== "rect") throw new Error("само правоъгълници");
    return { x: s.x, y: s.y, b: s.b, h: s.h, hole: s.hole };
  });
}

/**
 * Независима проверка 1: числено интегриране по мрежа от малки квадратчета.
 * Ползва само `containsPoint` – без нито една формула за център на тежестта.
 */
function integrateGrid(
  shapes: Shape[],
  box: { x0: number; x1: number; y0: number; y1: number },
  step: number,
) {
  let A = 0;
  let Sx = 0;
  let Sy = 0;
  const cell = step * step;
  for (let x = box.x0 + step / 2; x < box.x1; x += step) {
    for (let y = box.y0 + step / 2; y < box.y1; y += step) {
      if (containsPoint(shapes, { x, y })) {
        A += cell;
        Sx += cell * y;
        Sy += cell * x;
      }
    }
  }
  return { A, xc: Sy / A, yc: Sx / A };
}

/**
 * Независима проверка 2: интегриране на тесни ивици. `width(t)` е дължината
 * на материала в ивицата с координата t; връща площта и координатата на центъра.
 */
function integrateStrips(
  width: (t: number) => number,
  from: number,
  to: number,
  n = 200_000,
) {
  const dt = (to - from) / n;
  let A = 0;
  let S = 0;
  for (let i = 0; i < n; i++) {
    const t = from + (i + 0.5) * dt;
    const dA = width(t) * dt;
    A += dA;
    S += dA * t;
  }
  return { A, c: S / A };
}

// ---------------------------------------------------------------------------
// Ъгловата фигура (пример Л1 = П2): върхове (0;0) (8;0) (8;2) (2;2) (2;10) (0;10)
// ---------------------------------------------------------------------------
const L_SPLIT_1 = [rect(0, 0, 2, 10), rect(2, 0, 6, 2)];
const L_SPLIT_2 = [rect(0, 0, 8, 2), rect(0, 2, 2, 8)];
const L_NEGATIVE = [rect(0, 0, 8, 10), rect(2, 2, 6, 8, true)];

describe("прости фигури", () => {
  it("правоъгълник 6 × 4: център (3; 2) – въпрос 1 от „Леко“", () => {
    const shape = rect(0, 0, 6, 4);
    expect(shapeArea(shape)).toBe(24);
    expect(shapeCentroid(shape)).toEqual({ x: 3, y: 2 });
  });

  it("правоъгълен триъгълник с катети 9 и 6: център (3; 2) – въпрос 3 от „Леко“", () => {
    // A = 9·6/2 = 27; x = (0 + 9 + 0)/3 = 3; y = (0 + 0 + 6)/3 = 2 – на една трета от катетите
    const shape: Shape = {
      type: "triangle",
      a: { x: 0, y: 0 },
      b: { x: 9, y: 0 },
      c: { x: 0, y: 6 },
    };
    expect(shapeArea(shape)).toBeCloseTo(27, 12);
    expect(shapeCentroid(shape).x).toBeCloseTo(3, 12);
    expect(shapeCentroid(shape).y).toBeCloseTo(2, 12);
  });

  it("редът на върховете на триъгълника не променя площта и центъра", () => {
    const a = { x: 12, y: 0 };
    const b = { x: 18, y: 0 };
    const c = { x: 12, y: 9 };
    const ccw: Shape = { type: "triangle", a, b, c };
    const cw: Shape = { type: "triangle", a: c, b, c: a };
    expect(shapeArea(cw)).toBeCloseTo(shapeArea(ccw), 12);
    expect(shapeCentroid(cw).x).toBeCloseTo(shapeCentroid(ccw).x, 12);
    expect(shapeCentroid(cw).y).toBeCloseTo(shapeCentroid(ccw).y, 12);
  });

  it("кръг: площ π·r² и център в центъра", () => {
    const shape: Shape = { type: "circle", cx: 5, cy: 5, r: 2 };
    // π·2² = 12,566
    expect(shapeArea(shape)).toBeCloseTo(12.566, 3);
    expect(shapeCentroid(shape)).toEqual({ x: 5, y: 5 });
  });

  it("полукръг: y_C = 4r/(3π) = 0,424·r", () => {
    // r = 3: 4·3/(3π) = 4/π = 1,2732; r = 6: 8/π = 2,5465 → 2,55 (въпрос 5 от „Подробно“)
    expect(sectorCentroidDistance(3, 90)).toBeCloseTo(1.2732, 4);
    expect(sectorCentroidDistance(6, 90)).toBeCloseTo(2.55, 2);
    expect(sectorCentroidDistance(1, 90)).toBeCloseTo(0.424, 3);
    const half: Shape = {
      type: "sector",
      cx: 0,
      cy: 0,
      r: 6,
      fromDeg: 0,
      toDeg: 180,
    };
    // A = π·36/2 = 56,549
    expect(shapeArea(half)).toBeCloseTo(56.549, 3);
    expect(shapeCentroid(half).x).toBeCloseTo(0, 12);
    expect(shapeCentroid(half).y).toBeCloseTo(8 / Math.PI, 12);
  });

  it("полукръг: статичният момент спрямо диаметъра е 2r³/3", () => {
    // r = 3: 2·27/3 = 18 cm³
    const half: Shape = {
      type: "sector",
      cx: 0,
      cy: 0,
      r: 3,
      fromDeg: 0,
      toDeg: 180,
    };
    expect(partRow(half).Sx).toBeCloseTo(18, 12);
  });

  it("четвърт кръг: центърът е на 4r/(3π) от всеки от двата радиуса", () => {
    const quarter: Shape = {
      type: "sector",
      cx: 0,
      cy: 0,
      r: 3,
      fromDeg: 0,
      toDeg: 90,
    };
    const c = shapeCentroid(quarter);
    expect(shapeArea(quarter)).toBeCloseTo((Math.PI * 9) / 4, 12);
    expect(c.x).toBeCloseTo(4 / Math.PI, 12);
    expect(c.y).toBeCloseTo(4 / Math.PI, 12);
  });

  it("пълен сектор (360°) съвпада с кръга", () => {
    const full: Shape = {
      type: "sector",
      cx: 2,
      cy: -1,
      r: 4,
      fromDeg: 0,
      toDeg: 360,
    };
    expect(shapeArea(full)).toBeCloseTo(Math.PI * 16, 12);
    expect(shapeCentroid(full).x).toBeCloseTo(2, 12);
    expect(shapeCentroid(full).y).toBeCloseTo(-1, 12);
  });
});

describe("ъглова фигура – пример Л1 и П2", () => {
  it("начин 1: вертикална 2 × 10 и хоризонтална 6 × 2", () => {
    // A = 20 + 12 = 32
    // S_y = 20·1 + 12·5 = 20 + 60 = 80   → x_C = 80/32 = 2,5
    // S_x = 20·5 + 12·1 = 100 + 12 = 112 → y_C = 112/32 = 3,5
    const result = compositeCentroid(L_SPLIT_1);
    expect(result.parts[0]).toEqual({ A: 20, x: 1, y: 5, Sx: 100, Sy: 20 });
    expect(result.parts[1]).toEqual({ A: 12, x: 5, y: 1, Sx: 12, Sy: 60 });
    expect(result.A).toBe(32);
    expect(result.Sy).toBe(80);
    expect(result.Sx).toBe(112);
    expect(result.xc).toBeCloseTo(2.5, 12);
    expect(result.yc).toBeCloseTo(3.5, 12);
  });

  it("начин 2: хоризонтална 8 × 2 и вертикална 2 × 8 – същият център", () => {
    // S_y = 16·4 + 16·1 = 80; S_x = 16·1 + 16·6 = 112; A = 32
    const result = compositeCentroid(L_SPLIT_2);
    expect(result.A).toBe(32);
    expect(result.Sy).toBe(80);
    expect(result.Sx).toBe(112);
    expect(result.xc).toBeCloseTo(2.5, 12);
    expect(result.yc).toBeCloseTo(3.5, 12);
  });

  it("начин 3: пълен правоъгълник 8 × 10 минус отвор 6 × 8", () => {
    // A = 80 − 48 = 32; S_y = 80·4 − 48·5 = 80; S_x = 80·5 − 48·6 = 112
    const result = compositeCentroid(L_NEGATIVE);
    expect(result.parts[1]).toEqual({ A: -48, x: 5, y: 6, Sx: -288, Sy: -240 });
    expect(result.A).toBe(32);
    expect(result.Sy).toBe(80);
    expect(result.Sx).toBe(112);
    expect(result.xc).toBeCloseTo(2.5, 12);
    expect(result.yc).toBeCloseTo(3.5, 12);
  });

  it("съвпада със section.ts centroid() и за трите разделяния", () => {
    for (const shapes of [L_SPLIT_1, L_SPLIT_2, L_NEGATIVE]) {
      const ours = compositeCentroid(shapes);
      const theirs = centroid(toRects(shapes));
      expect(ours.A).toBeCloseTo(theirs.A, 12);
      expect(ours.xc).toBeCloseTo(theirs.xc, 12);
      expect(ours.yc).toBeCloseTo(theirs.yc, 12);
    }
  });

  it("статичните моменти спрямо осите през центъра на тежестта са нула", () => {
    // 20·(1 − 2,5) + 12·(5 − 2,5) = −30 + 30 = 0
    // 20·(5 − 3,5) + 12·(1 − 3,5) = 30 − 30 = 0
    const { Sx, Sy } = staticMoments(L_SPLIT_1, { x: 2.5, y: 3.5 });
    expect(Sx).toBeCloseTo(0, 12);
    expect(Sy).toBeCloseTo(0, 12);
  });

  it("центърът (2,5; 3,5) е извън фигурата", () => {
    expect(containsPoint(L_SPLIT_1, { x: 2.5, y: 3.5 })).toBe(false);
    expect(containsPoint(L_NEGATIVE, { x: 2.5, y: 3.5 })).toBe(false);
    expect(containsPoint(L_SPLIT_1, { x: 1, y: 5 })).toBe(true);
    expect(containsPoint(L_SPLIT_1, { x: 5, y: 1 })).toBe(true);
  });

  it("C лежи на отсечката C1–C2 и я дели обратно пропорционално на площите", () => {
    // C1(1; 5), C2(5; 1): C = C1 + (12/32)·(C2 − C1) = (1 + 1,5; 5 − 1,5) = (2,5; 3,5)
    const t = 12 / 32;
    expect(1 + t * (5 - 1)).toBeCloseTo(2.5, 12);
    expect(5 + t * (1 - 5)).toBeCloseTo(3.5, 12);
  });

  it("теглата на частите са успоредни сили: равнодействащата им минава през x_C (Глава 2)", () => {
    // тегла, пропорционални на площите: 20 и 12 надолу при x = 1 и x = 5
    // x_R = (20·1 + 12·5)/32 = 2,5
    const resultant = parallelResultant([
      { x: 1, F: -20 },
      { x: 5, F: -12 },
    ]);
    expect(resultant.value).toBe(-32);
    expect(resultant.x).toBeCloseTo(2.5, 12);
    expect(resultant.x).toBeCloseTo(compositeCentroid(L_SPLIT_1).xc, 12);
  });

  it("числено интегриране по мрежа дава същия център", () => {
    const grid = integrateGrid(
      L_SPLIT_1,
      { x0: 0, x1: 8, y0: 0, y1: 10 },
      0.02,
    );
    expect(grid.A).toBeCloseTo(32, 6);
    expect(grid.xc).toBeCloseTo(2.5, 6);
    expect(grid.yc).toBeCloseTo(3.5, 6);
  });

  it("окачване: центърът е точно под точката на окачване (фигура „otves“)", () => {
    // окачена за (0; 10): отвесът сключва с ръба x = 0 ъгъл arctg(2,5/6,5) = 21,04°
    // окачена за (8; 2): отвесът сключва с ръба y = 2 ъгъл arctg(1,5/5,5) = 15,26°
    expect((Math.atan2(2.5, 6.5) * 180) / Math.PI).toBeCloseTo(21.04, 2);
    expect((Math.atan2(1.5, 5.5) * 180) / Math.PI).toBeCloseTo(15.26, 2);
  });
});

describe("плоча с кръгъл отвор – пример Л2", () => {
  const plate: Shape[] = [
    rect(0, 0, 20, 10),
    { type: "circle", cx: 14, cy: 5, r: 3, hole: true },
  ];

  it("x_C = 9,34 cm, y_C = 5 cm", () => {
    // A_2 = π·3² = 28,274; A = 200 − 28,274 = 171,726
    // S_y = 200·10 − 28,274·14 = 2000 − 395,84 = 1604,16
    // x_C = 1604,16/171,726 = 9,34; y_C = 5 (ос на симетрия)
    const result = compositeCentroid(plate);
    expect(result.parts[1]!.A).toBeCloseTo(-28.274, 3);
    expect(result.parts[1]!.Sy).toBeCloseTo(-395.84, 2);
    expect(result.A).toBeCloseTo(171.726, 3);
    expect(result.Sy).toBeCloseTo(1604.16, 2);
    expect(result.xc).toBeCloseTo(9.34, 2);
    expect(result.yc).toBeCloseTo(5, 12);
  });

  it("сметката със закръглените междинни стойности дава отпечатания резултат", () => {
    expect(28.274 * 14).toBeCloseTo(395.84, 2);
    expect((2000 - 395.84) / 171.726).toBeCloseTo(9.34, 2);
  });

  it("центърът се измества от средата далеч от отвора", () => {
    expect(compositeCentroid(plate).xc).toBeLessThan(10);
  });

  it("интегриране на вертикални ивици дава същото x_C", () => {
    // височина на материала в ивицата: 10 минус хордата на отвора
    const strips = integrateStrips(
      (x) => {
        const dx = Math.abs(x - 14);
        return 10 - (dx < 3 ? 2 * Math.sqrt(9 - dx * dx) : 0);
      },
      0,
      20,
    );
    const result = compositeCentroid(plate);
    expect(strips.A).toBeCloseTo(result.A, 5);
    expect(strips.c).toBeCloseTo(result.xc, 5);
  });

  it("интегриране по мрежа дава същия център", () => {
    const grid = integrateGrid(plate, { x0: 0, x1: 20, y0: 0, y1: 10 }, 0.02);
    const result = compositeCentroid(plate);
    expect(grid.A).toBeCloseTo(result.A, 1);
    expect(grid.xc).toBeCloseTo(result.xc, 3);
    expect(grid.yc).toBeCloseTo(5, 3);
  });
});

describe("правоъгълник, триъгълник и кръгъл отвор – пример П1", () => {
  const figure: Shape[] = [
    rect(0, 0, 12, 9),
    {
      type: "triangle",
      a: { x: 12, y: 0 },
      b: { x: 18, y: 0 },
      c: { x: 12, y: 9 },
    },
    { type: "circle", cx: 3, cy: 5, r: 2, hole: true },
  ];

  it("таблицата: площи, центрове и статични моменти на частите", () => {
    // 1: A = 12·9 = 108, C(6; 4,5), A·x = 648, A·y = 486
    // 2: A = 6·9/2 = 27, C((12+18+12)/3; (0+0+9)/3) = (14; 3), A·x = 378, A·y = 81
    // 3: A = −π·2² = −12,566, C(3; 5), A·x = −37,70, A·y = −62,83
    const { parts } = compositeCentroid(figure);
    expect(parts[0]).toEqual({ A: 108, x: 6, y: 4.5, Sx: 486, Sy: 648 });
    expect(parts[1]!.A).toBeCloseTo(27, 12);
    expect(parts[1]!.x).toBeCloseTo(14, 12);
    expect(parts[1]!.y).toBeCloseTo(3, 12);
    expect(parts[1]!.Sy).toBeCloseTo(378, 10);
    expect(parts[1]!.Sx).toBeCloseTo(81, 10);
    expect(parts[2]!.A).toBeCloseTo(-12.566, 3);
    expect(parts[2]!.Sy).toBeCloseTo(-37.7, 2);
    expect(parts[2]!.Sx).toBeCloseTo(-62.83, 2);
  });

  it("x_C = 8,07 cm, y_C = 4,12 cm", () => {
    // A = 108 + 27 − 12,566 = 122,434
    // S_y = 648 + 378 − 37,70 = 988,30 → x_C = 988,30/122,434 = 8,07
    // S_x = 486 + 81 − 62,83 = 504,17  → y_C = 504,17/122,434 = 4,12
    const result = compositeCentroid(figure);
    expect(result.A).toBeCloseTo(122.434, 3);
    expect(result.Sy).toBeCloseTo(988.3, 2);
    expect(result.Sx).toBeCloseTo(504.17, 2);
    expect(result.xc).toBeCloseTo(8.07, 2);
    expect(result.yc).toBeCloseTo(4.12, 2);
    expect(result.xc).toBeCloseTo(8.072, 3);
    expect(result.yc).toBeCloseTo(4.118, 3);
  });

  it("сметката със закръглените междинни стойности дава отпечатания резултат", () => {
    expect(12.566 * 3).toBeCloseTo(37.7, 2);
    expect(12.566 * 5).toBeCloseTo(62.83, 2);
    expect(988.3 / 122.434).toBeCloseTo(8.07, 2);
    expect(504.17 / 122.434).toBeCloseTo(4.12, 2);
  });

  it("проверката в текста: статичен момент спрямо оста през центъра на тежестта ≈ 0", () => {
    // 108·(6 − 8,072) + 27·(14 − 8,072) − 12,566·(3 − 8,072)
    //   = −223,78 + 160,06 + 63,73 = 0,01 (остатък от закръглянето)
    expect(108 * (6 - 8.072)).toBeCloseTo(-223.78, 2);
    expect(27 * (14 - 8.072)).toBeCloseTo(160.06, 2);
    expect(-12.566 * (3 - 8.072)).toBeCloseTo(63.73, 2);
    expect(-223.78 + 160.06 + 63.73).toBeCloseTo(0.01, 2);
    // с точните стойности остатъкът изчезва
    const { xc, yc } = compositeCentroid(figure);
    const exact = staticMoments(figure, { x: xc, y: yc });
    expect(exact.Sx).toBeCloseTo(0, 9);
    expect(exact.Sy).toBeCloseTo(0, 9);
  });

  it("числено интегриране по мрежа дава същия център", () => {
    const grid = integrateGrid(figure, { x0: 0, x1: 18, y0: 0, y1: 9 }, 0.02);
    const result = compositeCentroid(figure);
    expect(grid.A).toBeCloseTo(result.A, 1);
    expect(grid.xc).toBeCloseTo(result.xc, 3);
    expect(grid.yc).toBeCloseTo(result.yc, 3);
  });

  it("центърът лежи върху материала (не е в отвора)", () => {
    expect(containsPoint(figure, { x: 8.07, y: 4.12 })).toBe(true);
    expect(containsPoint(figure, { x: 3, y: 5 })).toBe(false);
  });
});

describe("триъгълник – интегриране на ивици", () => {
  it("y_C = h/3 за триъгълник с основа 6 и височина 9", () => {
    // ивица на височина y има ширина b·(1 − y/h); S_x = b·h²/6 = 81; A = 27; y_C = 3
    const strips = integrateStrips((y) => 6 * (1 - y / 9), 0, 9);
    expect(strips.A).toBeCloseTo(27, 8);
    expect(strips.c).toBeCloseTo(3, 8);
    const triangle: Shape = {
      type: "triangle",
      a: { x: 12, y: 0 },
      b: { x: 18, y: 0 },
      c: { x: 12, y: 9 },
    };
    expect(shapeCentroid(triangle).y).toBeCloseTo(strips.c, 8);
  });

  it("x_C на същия триъгълник: ивица при x има височина 9·(1 − (x − 12)/6)", () => {
    const strips = integrateStrips((x) => 9 * (1 - (x - 12) / 6), 12, 18);
    expect(strips.c).toBeCloseTo(14, 8);
  });

  it("произволен (не правоъгълен) триъгълник – по мрежа", () => {
    const triangle: Shape = {
      type: "triangle",
      a: { x: 0, y: 0 },
      b: { x: 10, y: 1 },
      c: { x: 3, y: 7 },
    };
    const grid = integrateGrid(
      [triangle],
      { x0: 0, x1: 10, y0: 0, y1: 7 },
      0.01,
    );
    // A = |10·7 − 3·1|/2 = 33,5; C = (13/3; 8/3)
    expect(shapeArea(triangle)).toBeCloseTo(33.5, 12);
    expect(grid.A).toBeCloseTo(33.5, 2);
    expect(grid.xc).toBeCloseTo(13 / 3, 3);
    expect(grid.yc).toBeCloseTo(8 / 3, 3);
  });
});

describe("правоъгълник с полукръг – пример П3", () => {
  const figure: Shape[] = [
    rect(0, 0, 6, 8),
    { type: "sector", cx: 3, cy: 8, r: 3, fromDeg: 0, toDeg: 180 },
  ];

  it("x_C = 3 cm (ос на симетрия), y_C = 5,20 cm", () => {
    // A_2 = π·9/2 = 14,1372; y_2 = 8 + 4·3/(3π) = 8 + 1,2732 = 9,2732
    // A = 48 + 14,1372 = 62,1372
    // S_x = 48·4 + 14,1372·9,2732 = 192 + 131,10 = 323,10
    // y_C = 323,10/62,1372 = 5,20
    const result = compositeCentroid(figure);
    expect(result.parts[1]!.A).toBeCloseTo(14.1372, 4);
    expect(result.parts[1]!.y).toBeCloseTo(9.2732, 4);
    expect(result.parts[1]!.Sx).toBeCloseTo(131.1, 2);
    expect(result.A).toBeCloseTo(62.1372, 4);
    expect(result.Sx).toBeCloseTo(323.1, 2);
    expect(result.xc).toBeCloseTo(3, 12);
    expect(result.yc).toBeCloseTo(5.2, 2);
  });

  it("сметката със закръглените междинни стойности дава отпечатания резултат", () => {
    expect(14.1372 * 9.2732).toBeCloseTo(131.1, 2);
    expect(323.1 / 62.1372).toBeCloseTo(5.2, 2);
    // проверката в текста: 14,1372·8 + 18 = 131,10
    expect(14.1372 * 8 + 18).toBeCloseTo(131.1, 2);
  });

  it("интегриране на хоризонтални ивици дава същото y_C", () => {
    // до y = 8 ширината е 6; над това е хордата 2·√(9 − (y − 8)²)
    const strips = integrateStrips(
      (y) => (y <= 8 ? 6 : 2 * Math.sqrt(9 - (y - 8) ** 2)),
      0,
      11,
    );
    const result = compositeCentroid(figure);
    expect(strips.A).toBeCloseTo(result.A, 5);
    expect(strips.c).toBeCloseTo(result.yc, 5);
  });

  it("интегриране по мрежа: центърът е на оста на симетрия", () => {
    const grid = integrateGrid(figure, { x0: 0, x1: 6, y0: 0, y1: 11 }, 0.02);
    expect(grid.xc).toBeCloseTo(3, 6);
    expect(grid.yc).toBeCloseTo(compositeCentroid(figure).yc, 3);
  });
});

describe("симетрия", () => {
  it("една ос на симетрия: „Т“ фигурата от въпрос 1 на „Подробно“", () => {
    // стебло 2 × 8 (x от 4 до 6), пояс 10 × 2 върху него; ос на симетрия x = 5
    // y_C = (16·4 + 20·9)/36 = 244/36 = 6,78
    const tee = [rect(4, 0, 2, 8), rect(0, 8, 10, 2)];
    const result = compositeCentroid(tee);
    expect(result.A).toBe(36);
    expect(result.Sx).toBe(244);
    expect(result.xc).toBeCloseTo(5, 12);
    expect(result.yc).toBeCloseTo(6.78, 2);
    const theirs = centroid(toRects(tee));
    expect(result.xc).toBeCloseTo(theirs.xc, 12);
    expect(result.yc).toBeCloseTo(theirs.yc, 12);
  });

  it("две оси на симетрия: рамка с централен отвор – центърът е в пресечната им точка", () => {
    const frame = [rect(0, 0, 12, 8), rect(3, 2, 6, 4, true)];
    const result = compositeCentroid(frame);
    expect(result.xc).toBeCloseTo(6, 12);
    expect(result.yc).toBeCloseTo(4, 12);
  });

  it("огледалната фигура има огледален център", () => {
    // ъгловата фигура, отразена спрямо оста y: x_C сменя знака, y_C остава
    const mirrored = [rect(-2, 0, 2, 10), rect(-8, 0, 6, 2)];
    const result = compositeCentroid(mirrored);
    expect(result.xc).toBeCloseTo(-2.5, 12);
    expect(result.yc).toBeCloseTo(3.5, 12);
  });

  it("равнораменна ъглова фигура: центърът е на оста на симетрия y = x", () => {
    const equal = [rect(0, 0, 4, 12), rect(4, 0, 8, 4)];
    const result = compositeCentroid(equal);
    // S_y = 48·2 + 32·8 = 352; S_x = 48·6 + 32·2 = 352; A = 80 → 4,4
    expect(result.xc).toBeCloseTo(4.4, 12);
    expect(result.yc).toBeCloseTo(4.4, 12);
  });
});

describe("въпросите от „Провери се“", () => {
  it("„Леко“ 2: части 30 cm² при x = 2 и 10 cm² при x = 6 → x_C = 3 cm", () => {
    // (30·2 + 10·6)/(30 + 10) = 120/40 = 3
    const result = compositeCentroid([rect(0, 0, 4, 7.5), rect(4, 0, 4, 2.5)]);
    expect(result.parts[0]!.A).toBe(30);
    expect(result.parts[0]!.x).toBe(2);
    expect(result.parts[1]!.A).toBe(10);
    expect(result.parts[1]!.x).toBe(6);
    expect(result.xc).toBeCloseTo(3, 12);
  });

  it("„Леко“ 4: плоча 12 × 10 с отвор 4 × 5 с център (9; 5) → (5,4; 5)", () => {
    // A = 120 − 20 = 100; S_y = 120·6 − 20·9 = 720 − 180 = 540 → 5,4; y_C = 5
    const shapes = [rect(0, 0, 12, 10), rect(7, 2.5, 4, 5, true)];
    const result = compositeCentroid(shapes);
    expect(result.A).toBe(100);
    expect(result.Sy).toBe(540);
    expect(result.xc).toBeCloseTo(5.4, 12);
    expect(result.yc).toBeCloseTo(5, 12);
    expect(centroid(toRects(shapes)).xc).toBeCloseTo(5.4, 12);
  });

  it("„Подробно“ 2: правоъгълник 6 × 4 и триъгълник (6;0) (9;0) (6;4) → (3,8; 1,87)", () => {
    // A = 24 + 6 = 30; S_y = 24·3 + 6·7 = 72 + 42 = 114 → 3,8
    // S_x = 24·2 + 6·(4/3) = 48 + 8 = 56 → 1,87
    const result = compositeCentroid([
      rect(0, 0, 6, 4),
      {
        type: "triangle",
        a: { x: 6, y: 0 },
        b: { x: 9, y: 0 },
        c: { x: 6, y: 4 },
      },
    ]);
    expect(result.A).toBeCloseTo(30, 12);
    expect(result.parts[1]!.x).toBeCloseTo(7, 12);
    expect(result.Sy).toBeCloseTo(114, 10);
    expect(result.Sx).toBeCloseTo(56, 10);
    expect(result.xc).toBeCloseTo(3.8, 10);
    expect(result.yc).toBeCloseTo(1.87, 2);
  });

  it("„Подробно“ 3: кръг r = 6 с отвор r = 2 с център (3; 0) → x_C = −0,375 cm", () => {
    // A = π·(36 − 4) = 32π; S_y = −4π·3 = −12π; x_C = −12/32 = −0,375; y_C = 0
    const result = compositeCentroid([
      { type: "circle", cx: 0, cy: 0, r: 6 },
      { type: "circle", cx: 3, cy: 0, r: 2, hole: true },
    ]);
    expect(result.A).toBeCloseTo(32 * Math.PI, 10);
    expect(result.xc).toBeCloseTo(-0.375, 12);
    expect(result.yc).toBeCloseTo(0, 12);
  });

  it("„Подробно“ 4: статичният момент спрямо ос през центъра е нула", () => {
    const shapes: Shape[] = [
      rect(0, 0, 6, 4),
      { type: "circle", cx: 9, cy: 7, r: 2 },
    ];
    const { xc, yc } = compositeCentroid(shapes);
    const { Sx, Sy } = staticMoments(shapes, { x: xc, y: yc });
    expect(Sx).toBeCloseTo(0, 10);
    expect(Sy).toBeCloseTo(0, 10);
  });
});

describe("стенен панел с отвор за врата – „В реалния живот“", () => {
  // панел 6,0 × 3,0 m; отвор 1,5 × 2,0 m от x = 3,75 до 5,25 m, от долния ръб
  const panel = [rect(0, 0, 6, 3), rect(3.75, 0, 1.5, 2, true)];

  it("A = 15 m², G = 75 kN, C(2,70; 1,60) m", () => {
    // тегло на единица площ: 25·0,20 = 5 kN/m²
    // A = 18 − 3 = 15; G = 5·15 = 75
    // S_y = 18·3 − 3·4,5 = 54 − 13,5 = 40,5 → x_C = 2,70
    // S_x = 18·1,5 − 3·1,0 = 27 − 3 = 24   → y_C = 1,60
    expect(25 * 0.2).toBeCloseTo(5, 12);
    const result = compositeCentroid(panel);
    expect(result.A).toBeCloseTo(15, 12);
    expect(result.Sy).toBeCloseTo(40.5, 12);
    expect(result.Sx).toBeCloseTo(24, 12);
    const weight = plateWeight(panel, 5);
    expect(weight.G).toBeCloseTo(75, 12);
    expect(weight.x).toBeCloseTo(2.7, 12);
    expect(weight.y).toBeCloseTo(1.6, 12);
    const theirs = centroid(toRects(panel));
    expect(weight.x).toBeCloseTo(theirs.xc, 12);
    expect(weight.y).toBeCloseTo(theirs.yc, 12);
  });

  it("центърът е на 0,30 m от средата, далеч от отвора", () => {
    expect(3 - plateWeight(panel, 5).x).toBeCloseTo(0.3, 12);
  });

  it("халки при x = 1,0 и 5,0 m: 43,125 и 31,875 kN", () => {
    // ΣM_A = 0: B_v·4 − 75·(2,7 − 1,0) = 0 → B_v = 127,5/4 = 31,875
    // ΣF_y = 0: A_v = 75 − 31,875 = 43,125
    // проверка ΣM_B: −43,125·4 + 75·(5,0 − 2,7) = −172,5 + 172,5 = 0
    const { G, x } = plateWeight(panel, 5);
    const reactions = solveSupportReactions(
      { type: "pin-roller", pin: { x: 1, y: 3 }, roller: { x: 5, y: 3 } },
      [{ type: "force", x, y: 1.6, fx: 0, fy: -G }],
    );
    expect(reactions.Ah).toBeCloseTo(0, 12);
    expect(reactions.Av).toBeCloseTo(43.125, 10);
    expect(reactions.Bv).toBeCloseTo(31.875, 10);
    expect(75 * 1.7).toBeCloseTo(127.5, 12);
    expect(-43.125 * 4 + 75 * 2.3).toBeCloseTo(0, 10);
    expect(43.125 + 31.875 - 75).toBeCloseTo(0, 12);
  });

  it("халки, симетрични спрямо центъра (1,2 и 4,2 m): по 37,5 kN", () => {
    const { G, x } = plateWeight(panel, 5);
    const reactions = solveSupportReactions(
      { type: "pin-roller", pin: { x: 1.2, y: 3 }, roller: { x: 4.2, y: 3 } },
      [{ type: "force", x, y: 1.6, fx: 0, fy: -G }],
    );
    expect(reactions.Av).toBeCloseTo(37.5, 10);
    expect(reactions.Bv).toBeCloseTo(37.5, 10);
  });
});

describe("невалиден вход", () => {
  it("неположителни или безкрайни размери", () => {
    expect(() => shapeArea(rect(0, 0, 0, 5))).toThrow();
    expect(() => shapeArea(rect(0, 0, 2, -1))).toThrow();
    expect(() => shapeArea(rect(Number.NaN, 0, 2, 1))).toThrow();
    expect(() => shapeArea({ type: "circle", cx: 0, cy: 0, r: 0 })).toThrow();
    expect(() =>
      shapeCentroid({ type: "circle", cx: 0, cy: Infinity, r: 1 }),
    ).toThrow();
  });

  it("триъгълник с върхове на една права", () => {
    expect(() =>
      shapeArea({
        type: "triangle",
        a: { x: 0, y: 0 },
        b: { x: 1, y: 1 },
        c: { x: 2, y: 2 },
      }),
    ).toThrow();
  });

  it("сектор с невалиден ъгъл", () => {
    const sector = (fromDeg: number, toDeg: number): Shape => ({
      type: "sector",
      cx: 0,
      cy: 0,
      r: 1,
      fromDeg,
      toDeg,
    });
    expect(() => shapeArea(sector(90, 90))).toThrow();
    expect(() => shapeArea(sector(0, 400))).toThrow();
    expect(() => sectorCentroidDistance(1, 0)).toThrow();
    expect(() => sectorCentroidDistance(1, 200)).toThrow();
  });

  it("празна фигура и фигура с неположителна площ", () => {
    expect(() => compositeCentroid([])).toThrow();
    expect(() =>
      compositeCentroid([rect(0, 0, 2, 2), rect(0, 0, 2, 2, true)]),
    ).toThrow();
    expect(() => plateWeight([rect(0, 0, 2, 2)], 0)).toThrow();
  });

  it("containsPoint за сектор следи ъгъла", () => {
    const half: Shape[] = [
      { type: "sector", cx: 0, cy: 0, r: 3, fromDeg: 0, toDeg: 180 },
    ];
    expect(containsPoint(half, { x: 0, y: 1 })).toBe(true);
    expect(containsPoint(half, { x: 0, y: -1 })).toBe(false);
    expect(containsPoint(half, { x: 0, y: 4 })).toBe(false);
  });
});
