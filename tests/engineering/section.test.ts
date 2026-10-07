import { describe, expect, it } from "vitest";
import {
  centroid,
  rotatedMoments,
  sectionProperties,
  steinerTable,
  type Rect,
} from "@/lib/engineering/section";

/**
 * Независима проверка: същите величини чрез числено интегриране върху мрежа
 * от малки квадратчета – без формулата bh³/12 и без теоремата на Щайнер.
 */
function integrate(rects: Rect[], step = 0.02) {
  const solid = rects.filter((r) => !r.hole);
  const x0 = Math.min(...solid.map((r) => r.x));
  const x1 = Math.max(...solid.map((r) => r.x + r.b));
  const y0 = Math.min(...solid.map((r) => r.y));
  const y1 = Math.max(...solid.map((r) => r.y + r.h));
  const inside = (r: Rect, x: number, y: number) =>
    x > r.x && x < r.x + r.b && y > r.y && y < r.y + r.h;
  const cells: { x: number; y: number }[] = [];
  for (let x = x0 + step / 2; x < x1; x += step) {
    for (let y = y0 + step / 2; y < y1; y += step) {
      const filled =
        solid.some((r) => inside(r, x, y)) &&
        !rects.some((r) => r.hole && inside(r, x, y));
      if (filled) cells.push({ x, y });
    }
  }
  const dA = step * step;
  const A = cells.length * dA;
  const xc = cells.reduce((s, c) => s + c.x, 0) / cells.length;
  const yc = cells.reduce((s, c) => s + c.y, 0) / cells.length;
  let Ix = 0;
  let Iy = 0;
  let Ixy = 0;
  for (const c of cells) {
    Ix += (c.y - yc) ** 2 * dA;
    Iy += (c.x - xc) ** 2 * dA;
    Ixy += (c.x - xc) * (c.y - yc) * dA;
  }
  return { A, xc, yc, Ix, Iy, Ixy };
}

describe("правоъгълник", () => {
  // b = 6 cm, h = 12 cm
  const props = sectionProperties([{ b: 6, h: 12, x: 0, y: 0 }]);

  it("I_x = bh³/12 = 6·12³/12 = 864; I_y = hb³/12 = 12·6³/12 = 216", () => {
    expect(props.A).toBe(72);
    expect(props.Ix).toBeCloseTo(864, 10);
    expect(props.Iy).toBeCloseTo(216, 10);
    expect(props.Ixy).toBeCloseTo(0, 10);
  });

  it("W_x = bh²/6 = 6·144/6 = 144; i_x = h/√12 = 3,464", () => {
    expect(props.WxTop).toBeCloseTo(144, 10);
    expect(props.WxBottom).toBeCloseTo(144, 10);
    expect(props.ix).toBeCloseTo(12 / Math.sqrt(12), 10);
  });

  it("легнал, същият правоъгълник има 4 пъти по-малък I_x", () => {
    const flat = sectionProperties([{ b: 12, h: 6, x: 0, y: 0 }]);
    expect(props.Ix / flat.Ix).toBeCloseTo(4, 10);
  });
});

describe("контролен пример от спецификацията: сечение „Т“ (2×10 + 12×2 cm)", () => {
  // стебло 2×10, пояс 12×2 върху него; y се мери от долния край на стеблото
  const T: Rect[] = [
    { b: 2, h: 10, x: 5, y: 0 },
    { b: 12, h: 2, x: 0, y: 10 },
  ];
  const props = sectionProperties(T);

  it("A = 20 + 24 = 44 cm²; y_c = (20·5 + 24·11)/44 = 8,27 cm", () => {
    expect(props.A).toBe(44);
    expect(props.yc).toBeCloseTo(364 / 44, 10);
    expect(props.yc.toFixed(2)).toBe("8.27");
    expect(props.xc).toBeCloseTo(6, 10);
  });

  it("I_x = 567,39 cm⁴ и I_y = 294,67 cm⁴", () => {
    expect(props.Ix.toFixed(2)).toBe("567.39");
    expect(props.Iy.toFixed(2)).toBe("294.67");
  });

  it("таблицата на Щайнер дава същите междинни числа, каквито са в главата", () => {
    const [web, flange] = steinerTable(T);
    expect(web!.IxOwn).toBeCloseTo(166.667, 3);
    expect(web!.dy).toBeCloseTo(-3.2727, 4);
    expect(web!.AdY2).toBeCloseTo(214.215, 3);
    expect(flange!.IxOwn).toBeCloseTo(8, 10);
    expect(flange!.dy).toBeCloseTo(2.7273, 4);
    expect(flange!.AdY2).toBeCloseTo(178.512, 3);
    expect(web!.IyOwn + flange!.IyOwn).toBeCloseTo(294.667, 3);
  });

  it("сечението е симетрично: I_xy = 0 и главните оси съвпадат с x и y", () => {
    expect(props.Ixy).toBeCloseTo(0, 10);
    expect(props.alpha).toBe(0);
    expect(props.I1).toBeCloseTo(props.Ix, 10);
    expect(props.I2).toBeCloseTo(props.Iy, 10);
  });

  it("W_x е различен за горното и долното влакно", () => {
    // y_горе = 12 − 8,273 = 3,727; y_долу = 8,273
    expect(props.yTop).toBeCloseTo(3.7273, 4);
    expect(props.WxTop).toBeCloseTo(567.39 / 3.7273, 1);
    expect(props.WxBottom).toBeCloseTo(567.39 / 8.2727, 1);
  });

  it("съвпада с численото интегриране", () => {
    const check = integrate(T);
    expect(props.yc).toBeCloseTo(check.yc, 2);
    expect(props.Ix / check.Ix).toBeCloseTo(1, 2);
    expect(props.Iy / check.Iy).toBeCloseTo(1, 2);
  });
});

describe("сечение „Г“ без ос на симетрия (2×10 + 6×2 cm)", () => {
  // вертикално рамо 2×10 и хоризонтално рамо 6×2 в долния край, вдясно от него
  const L: Rect[] = [
    { b: 2, h: 10, x: 0, y: 0 },
    { b: 6, h: 2, x: 2, y: 0 },
  ];
  const props = sectionProperties(L);

  it("център на тежестта: x_c = (20·1 + 12·5)/32 = 2,5; y_c = (20·5 + 12·1)/32 = 3,5", () => {
    expect(centroid(L)).toEqual({ A: 32, xc: 2.5, yc: 3.5 });
  });

  it("I_x = 166,67 + 20·1,5² + 4 + 12·2,5² = 290,67", () => {
    expect(props.Ix).toBeCloseTo(290.667, 3);
  });

  it("I_y = 6,67 + 20·1,5² + 36 + 12·2,5² = 162,67", () => {
    expect(props.Iy).toBeCloseTo(162.667, 3);
  });

  it("I_xy = 20·(−1,5)·1,5 + 12·2,5·(−2,5) = −120", () => {
    expect(props.Ixy).toBeCloseTo(-120, 10);
  });

  it("главни моменти: 226,67 ± √(64² + 120²) = 226,67 ± 136 → 362,67 и 90,67", () => {
    expect(props.I1).toBeCloseTo(362.667, 3);
    expect(props.I2).toBeCloseTo(90.667, 3);
  });

  it("ъгъл: tg 2α = −2·(−120)/(290,67 − 162,67) = 1,875 → α = 30,96°", () => {
    expect(props.alpha).toBeCloseTo(30.964, 3);
  });

  it("инвариант: I_1 + I_2 = I_x + I_y", () => {
    expect(props.I1 + props.I2).toBeCloseTo(props.Ix + props.Iy, 10);
  });

  it("при завъртане на α осите стават главни: I_uv = 0, I_u = I_1, I_v = I_2", () => {
    const rotated = rotatedMoments(props, props.alpha);
    expect(rotated.Iuv).toBeCloseTo(0, 9);
    expect(rotated.Iu).toBeCloseTo(props.I1, 9);
    expect(rotated.Iv).toBeCloseTo(props.I2, 9);
  });

  it("I_1 е най-големият възможен момент: всяко друго завъртане дава по-малко", () => {
    for (const angle of [-80, -45, -10, 0, 15, 45, 60, 89]) {
      expect(rotatedMoments(props, angle).Iu).toBeLessThanOrEqual(
        props.I1 + 1e-9,
      );
      expect(rotatedMoments(props, angle).Iu).toBeGreaterThanOrEqual(
        props.I2 - 1e-9,
      );
    }
  });

  it("съвпада с численото интегриране, включително знака на I_xy", () => {
    const check = integrate(L);
    expect(props.xc).toBeCloseTo(check.xc, 2);
    expect(props.yc).toBeCloseTo(check.yc, 2);
    expect(props.Ix / check.Ix).toBeCloseTo(1, 2);
    expect(props.Iy / check.Iy).toBeCloseTo(1, 2);
    expect(props.Ixy / check.Ixy).toBeCloseTo(1, 2);
  });
});

describe("кухо правоъгълно сечение (отвор)", () => {
  // външно 10×16, отвор 6×12, центриран
  const box: Rect[] = [
    { b: 10, h: 16, x: 0, y: 0 },
    { b: 6, h: 12, x: 2, y: 2, hole: true },
  ];
  const props = sectionProperties(box);

  it("I_x = (10·16³ − 6·12³)/12 = 2549,33", () => {
    expect(props.A).toBe(160 - 72);
    expect(props.Ix).toBeCloseTo((10 * 16 ** 3 - 6 * 12 ** 3) / 12, 9);
    expect(props.Ix).toBeCloseTo(2549.333, 3);
  });

  it("съвпада с численото интегриране", () => {
    const check = integrate(box, 0.04);
    expect(props.Ix / check.Ix).toBeCloseTo(1, 2);
    expect(props.Iy / check.Iy).toBeCloseTo(1, 2);
  });
});

describe("невалидни данни", () => {
  it("отхвърля нулев размер и сечение само от отвори", () => {
    expect(() => sectionProperties([{ b: 0, h: 2, x: 0, y: 0 }])).toThrow();
    expect(() =>
      sectionProperties([{ b: 2, h: 2, x: 0, y: 0, hole: true }]),
    ).toThrow();
  });
});

describe("сравнение при еднаква площ 72 cm² (числата от Глава 2)", () => {
  // двойно „Т“: два пояса 12×2 и стебло 2×12, обща височина 16 cm
  const I: Rect[] = [
    { b: 12, h: 2, x: 0, y: 0 },
    { b: 2, h: 12, x: 5, y: 2 },
    { b: 12, h: 2, x: 0, y: 14 },
  ];

  it("двойното „Т“ има I_x = 288 + 2·(8 + 24·7²) = 2656 cm⁴", () => {
    const props = sectionProperties(I);
    expect(props.A).toBe(72);
    expect(props.Ix).toBeCloseTo(2656, 9);
    expect(props.yc).toBeCloseTo(8, 10);
  });

  it("това е 3,07 пъти повече от правоъгълник 6×12 и 6,15 пъти повече от квадрат", () => {
    const rectangle = sectionProperties([{ b: 6, h: 12, x: 0, y: 0 }]).Ix;
    const side = Math.sqrt(72);
    const square = sectionProperties([{ b: side, h: side, x: 0, y: 0 }]).Ix;
    expect(square).toBeCloseTo(432, 9);
    expect((2656 / rectangle).toFixed(2)).toBe("3.07");
    expect((2656 / square).toFixed(2)).toBe("6.15");
  });
});

describe("останалите числа от Глава 2", () => {
  it("двойно „Т“: I_y = 584 cm⁴; поясите дават 89 % от I_x", () => {
    const props = sectionProperties([
      { b: 12, h: 2, x: 0, y: 0 },
      { b: 2, h: 12, x: 5, y: 2 },
      { b: 12, h: 2, x: 0, y: 14 },
    ]);
    expect(props.Iy).toBeCloseTo(584, 9);
    expect(((2 * 1184) / props.Ix).toFixed(2)).toBe("0.89");
    expect(props.Ix / props.Iy).toBeGreaterThan(4);
  });

  it("кухо сечение: отворът отнема 45 % от площта и 25 % от I_x", () => {
    expect((72 / 160).toFixed(2)).toBe("0.45");
    expect((864 / 3413.333).toFixed(2)).toBe("0.25");
  });

  it("сечение „Т“: W_горе = 152,2 и W_долу = 68,6 cm³", () => {
    const props = sectionProperties([
      { b: 2, h: 10, x: 5, y: 0 },
      { b: 12, h: 2, x: 0, y: 10 },
    ]);
    expect(props.WxTop.toFixed(1)).toBe("152.2");
    expect(props.WxBottom.toFixed(1)).toBe("68.6");
  });

  it("въпрос 2 от „Провери се“: при I_xy = 0 завъртане на 45° дава средната стойност", () => {
    expect(rotatedMoments({ Ix: 500, Iy: 300, Ixy: 0 }, 45).Iu).toBeCloseTo(
      400,
      9,
    );
  });

  it("дъска 5×20 cm: на ръб е 16 пъти по-добра, отколкото легнала", () => {
    const edge = sectionProperties([{ b: 5, h: 20, x: 0, y: 0 }]).Ix;
    const flat = sectionProperties([{ b: 20, h: 5, x: 0, y: 0 }]).Ix;
    expect(edge / flat).toBeCloseTo(16, 9);
  });
});
