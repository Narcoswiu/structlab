import { describe, expect, it } from "vitest";
import { rectangleModulus } from "@/lib/engineering/bending";
import {
  axialBendingExtremes,
  circleCoreRadius,
  combinedStress,
  eccentricForce,
  forcePointForZeroLine,
  isInsideCircleCore,
  isInsideRectangleCore,
  rectangleCombinedCorners,
  rectangleCore,
  rectangleCoreVertices,
  rectangleSection,
  zeroLineIntercepts,
  zeroLineOffset,
} from "@/lib/engineering/combined";

// Всички очаквани стойности са сметнати на ръка и са записани над теста.
// Напреженията са в kN/cm² (1 kN/cm² = 10 MPa); натискът е отрицателен.

describe("Л1: стълб 30×50 cm, натиск 600 kN, изместен по височината h", () => {
  // A = 30·50 = 1500 cm²; W_x = 30·50²/6 = 12 500 cm³; F/A = 600/1500 = 0,40
  const b = 30;
  const h = 50;
  const F = -600;

  it("геометрия: A = 1500 cm², W_x = 12 500 cm³, i_x² = 50²/12 = 208,33 cm²", () => {
    const section = rectangleSection(b, h);
    expect(section.A).toBe(1500);
    expect(rectangleModulus(b, h)).toBeCloseTo(12500, 9);
    expect((section.Ix / section.A).toFixed(2)).toBe("208.33");
  });

  it("e = 5 cm: M = 30 kN·m, M/W = 0,24 → −0,64 откъм силата и −0,16 отсреща", () => {
    const { N, Mx, My } = eccentricForce(F, 0, 5);
    expect(N).toBe(-600);
    expect(Mx).toBeCloseTo(-30, 12);
    expect(My).toBeCloseTo(0, 12);
    expect((Math.abs(Mx) * 100) / rectangleModulus(b, h)).toBeCloseTo(0.24, 12);
    const corners = rectangleCombinedCorners(N, { Mx, My }, b, h);
    expect(corners.bottomLeft).toBeCloseTo(-0.64, 12);
    expect(corners.bottomRight).toBeCloseTo(-0.64, 12);
    expect(corners.topLeft).toBeCloseTo(-0.16, 12);
    expect(corners.topRight).toBeCloseTo(-0.16, 12);
    expect(isInsideRectangleCore(0, 5, b, h)).toBe(true);
  });

  it("e = h/6 = 8,33 cm: M = 50 kN·m, M/W = 0,40 → −0,80 и точно 0", () => {
    const e = h / 6;
    expect(e.toFixed(2)).toBe("8.33");
    const { N, Mx, My } = eccentricForce(F, 0, e);
    expect(Mx).toBeCloseTo(-50, 12);
    const corners = rectangleCombinedCorners(N, { Mx, My }, b, h);
    expect(corners.bottomLeft).toBeCloseTo(-0.8, 12);
    expect(corners.topLeft).toBeCloseTo(0, 12);
    expect(isInsideRectangleCore(0, e, b, h)).toBe(true);
  });

  it("e = 15 cm: M = 90 kN·m, M/W = 0,72 → −1,12 и +0,32 (опън)", () => {
    const { N, Mx, My } = eccentricForce(F, 0, 15);
    expect(Mx).toBeCloseTo(-90, 12);
    const corners = rectangleCombinedCorners(N, { Mx, My }, b, h);
    expect(corners.bottomRight).toBeCloseTo(-1.12, 12);
    expect(corners.topRight).toBeCloseTo(0.32, 12);
    expect(isInsideRectangleCore(0, 15, b, h)).toBe(false);
  });

  it("e = 15 cm: нулевата линия е на 208,33/15 = 13,89 cm от центъра, на 11,11 cm от ръба", () => {
    const { ax, ay } = zeroLineIntercepts(0, 15, 50 ** 2 / 12, 30 ** 2 / 12);
    expect(ax).toBe(Infinity);
    expect(ay.toFixed(2)).toBe("-13.89");
    expect((h / 2 + ay).toFixed(2)).toBe("11.11");
    // независима проверка: линейна интерполация между +0,32 и −1,12 по 50 cm
    expect(((50 * 0.32) / (0.32 + 1.12)).toFixed(2)).toBe("11.11");
    // и още една: напрежението върху нулевата линия е нула
    const { N, Mx, My } = eccentricForce(F, 0, 15);
    expect(
      combinedStress(N, { Mx, My }, rectangleSection(b, h), 7, ay),
    ).toBeCloseTo(0, 12);
  });

  it("П2: същото по формулата σ = (F/A)·(1 + y_F·y/i_x²): −0,40·2,8 и −0,40·(−0,8)", () => {
    const ix2 = 50 ** 2 / 12;
    expect((1 + (15 * 25) / ix2).toFixed(1)).toBe("2.8");
    expect((1 - (15 * 25) / ix2).toFixed(1)).toBe("-0.8");
    expect(-0.4 * (1 + (15 * 25) / ix2)).toBeCloseTo(-1.12, 12);
    expect(-0.4 * (1 - (15 * 25) / ix2)).toBeCloseTo(0.32, 12);
  });

  it("положението на нулевата линия не зависи от големината на силата", () => {
    const section = rectangleSection(b, h);
    for (const force of [-60, -600, -6000, 250]) {
      const { N, Mx } = eccentricForce(force, 0, 15);
      expect(zeroLineOffset(N, Mx, section.A, section.Ix)).toBeCloseTo(
        -(50 ** 2) / 12 / 15,
        9,
      );
    }
  });
});

describe("П1: IPE 200 с опън 100 kN и момент 12 kN·m", () => {
  // IPE 200: A = 28,5 cm², I_x = 1943 cm⁴, височина 20 cm (y = ±10 cm)
  // M = 6·4²/8 = 12 kN·m = 1200 kN·cm
  // σ_N = 100/28,5 = 3,509; σ_M = 1200·10/1943 = 6,176
  const A = 28.5;
  const Ix = 1943;

  it("момент от q = 6 kN/m при l = 4 m", () => {
    expect((6 * 4 ** 2) / 8).toBe(12);
  });

  it("съставки: 3,509 и 6,176 kN/cm²", () => {
    expect((100 / A).toFixed(3)).toBe("3.509");
    expect(((1200 * 10) / Ix).toFixed(3)).toBe("6.176");
  });

  it("долу 3,509 + 6,176 = 9,685 (опън), горе 3,509 − 6,176 = −2,667 (натиск)", () => {
    const { top, bottom } = axialBendingExtremes(100, 12, A, {
      Ix,
      yTop: 10,
      yBottom: 10,
    });
    expect(bottom.toFixed(3)).toBe("9.685");
    expect(top.toFixed(3)).toBe("-2.667");
    // в MPa, както са в текста
    expect((bottom * 10).toFixed(1)).toBe("96.8");
    expect((top * 10).toFixed(1)).toBe("-26.7");
  });

  it("нулева линия: y₀ = −3,509·1943/1200 = −5,68 cm (над центъра)", () => {
    const y0 = zeroLineOffset(100, 12, A, Ix);
    expect(y0.toFixed(2)).toBe("-5.68");
    // независима проверка: в тази точка общата формула дава нула
    expect(
      combinedStress(100, { Mx: 12, My: 0 }, { A, Ix, Iy: 1 }, 0, y0),
    ).toBeCloseTo(0, 12);
    // без нормална сила нулевата линия е неутралната ос – през центъра
    expect(zeroLineOffset(0, 12, A, Ix)).toBeCloseTo(0, 12);
  });
});

describe("П3: сечение 20×30 cm, натиск 360 kN в точка (3; 6) cm", () => {
  const b = 20;
  const h = 30;
  const section = rectangleSection(b, h);
  const { N, Mx, My } = eccentricForce(-360, 3, 6);
  const moments = { Mx, My };

  it("геометрия: A = 600; I_x = 45 000; I_y = 20 000; i_x² = 75; i_y² = 33,33; W_x = 3000; W_y = 2000", () => {
    expect(section.A).toBe(600);
    expect(section.Ix).toBeCloseTo(45000, 9);
    expect(section.Iy).toBeCloseTo(20000, 9);
    expect(section.Ix / section.A).toBeCloseTo(75, 12);
    expect((section.Iy / section.A).toFixed(2)).toBe("33.33");
    expect(rectangleModulus(b, h)).toBeCloseTo(3000, 9);
    expect(rectangleModulus(h, b)).toBeCloseTo(2000, 9);
  });

  it("усилия: N = −360 kN; M_x = −360·6 = −2160 kN·cm; M_y = −360·3 = −1080 kN·cm", () => {
    expect(N).toBe(-360);
    expect(Mx).toBeCloseTo(-21.6, 12);
    expect(My).toBeCloseTo(-10.8, 12);
  });

  it("съставки: N/A = −0,60; M_x/W_x = 0,72; M_y/W_y = 0,54", () => {
    expect(N / section.A).toBeCloseTo(-0.6, 12);
    expect(2160 / 3000).toBeCloseTo(0.72, 12);
    expect(1080 / 2000).toBeCloseTo(0.54, 12);
  });

  it("ъгли: −1,86; −0,78; −0,42; +0,66", () => {
    const corners = rectangleCombinedCorners(N, moments, b, h);
    expect(corners.bottomRight).toBeCloseTo(-1.86, 12); // −0,60 − 0,72 − 0,54
    expect(corners.bottomLeft).toBeCloseTo(-0.78, 12); // −0,60 − 0,72 + 0,54
    expect(corners.topRight).toBeCloseTo(-0.42, 12); // −0,60 + 0,72 − 0,54
    expect(corners.topLeft).toBeCloseTo(0.66, 12); // −0,60 + 0,72 + 0,54
    // независима проверка: сборът е 4·N/A = −2,40
    expect(
      corners.bottomRight +
        corners.bottomLeft +
        corners.topRight +
        corners.topLeft,
    ).toBeCloseTo(-2.4, 12);
  });

  it("нулева линия: a_x = −33,33/3 = −11,11 cm; a_y = −75/6 = −12,5 cm", () => {
    const { ax, ay } = zeroLineIntercepts(3, 6, 75, 100 / 3);
    expect(ax.toFixed(2)).toBe("-11.11");
    expect(ay).toBeCloseTo(-12.5, 12);
    // в двата отреза напрежението е нула
    expect(combinedStress(N, moments, section, ax, 0)).toBeCloseTo(0, 12);
    expect(combinedStress(N, moments, section, 0, ay)).toBeCloseTo(0, 12);
    // обратната задача връща точката на силата
    const point = forcePointForZeroLine(ax, ay, 75, 100 / 3);
    expect(point.x).toBeCloseTo(3, 12);
    expect(point.y).toBeCloseTo(6, 12);
  });

  it("нулевата линия пресича горната страна при x = 2,22 cm и лявата при y = −1,25 cm", () => {
    // 1 + 6·y/75 + 3·x/33,33 = 0 → 1 + 0,08·y + 0,09·x = 0
    const xTop = (-1 - 0.08 * -15) / 0.09;
    const yLeft = (-1 - 0.09 * -10) / 0.08;
    expect(xTop.toFixed(2)).toBe("2.22");
    expect(yLeft).toBeCloseTo(-1.25, 12);
    expect(combinedStress(N, moments, section, xTop, -15)).toBeCloseTo(0, 12);
    expect(combinedStress(N, moments, section, -10, yLeft)).toBeCloseTo(0, 12);
  });

  it("силата е извън ядрото: 3/3,33 + 6/5 = 0,9 + 1,2 = 2,1 > 1", () => {
    const { ex, ey } = rectangleCore(b, h);
    expect(3 / ex + 6 / ey).toBeCloseTo(2.1, 12);
    expect(isInsideRectangleCore(3, 6, b, h)).toBe(false);
  });

  it("проверка на якост: 6,6 ≤ 8 MPa на опън и 18,6 ≤ 20 MPa на натиск", () => {
    const corners = rectangleCombinedCorners(N, moments, b, h);
    const values = Object.values(corners);
    expect((Math.max(...values) * 10).toFixed(1)).toBe("6.6");
    expect((Math.min(...values) * 10).toFixed(1)).toBe("-18.6");
    expect(Math.max(...values) * 10).toBeLessThanOrEqual(8);
    expect(-Math.min(...values) * 10).toBeLessThanOrEqual(20);
  });
});

describe("П4: ядро на правоъгълник 20×30 cm и на кръг", () => {
  const b = 20;
  const h = 30;

  it("ромб с полудиагонали 20/6 = 3,33 cm и 30/6 = 5 cm", () => {
    const { ex, ey } = rectangleCore(b, h);
    expect(ex.toFixed(2)).toBe("3.33");
    expect(ey).toBe(5);
    const vertices = rectangleCoreVertices(b, h);
    expect(vertices).toHaveLength(4);
    expect(vertices[0]).toEqual({ x: ex, y: 0 });
    expect(vertices[1]).toEqual({ x: 0, y: 5 });
    expect(vertices[2]).toEqual({ x: -ex, y: 0 });
    expect(vertices[3]).toEqual({ x: 0, y: -5 });
  });

  it("върховете следват от допирателните: a_y = −15 → y_я = 75/15 = 5; a_x = −10 → x_я = 33,33/10 = 3,33", () => {
    const top = forcePointForZeroLine(Infinity, -15, 75, 100 / 3);
    expect(top).toEqual({ x: 0, y: 5 });
    const left = forcePointForZeroLine(-10, Infinity, 75, 100 / 3);
    expect(left.x.toFixed(2)).toBe("3.33");
    expect(left.y).toBe(0);
  });

  it("сила 360 kN във върха (0; 5): горният ръб 0, долният −1,20", () => {
    // N/A = −0,60; M_x/W_x = 360·5/3000 = 0,60
    const { N, Mx, My } = eccentricForce(-360, 0, 5);
    const corners = rectangleCombinedCorners(N, { Mx, My }, b, h);
    expect(corners.topLeft).toBeCloseTo(0, 12);
    expect(corners.topRight).toBeCloseTo(0, 12);
    expect(corners.bottomLeft).toBeCloseTo(-1.2, 12);
    expect(corners.bottomRight).toBeCloseTo(-1.2, 12);
  });

  it("сила във върха (3,33; 0): левият ръб 0, десният −1,20", () => {
    const { N, Mx, My } = eccentricForce(-360, 20 / 6, 0);
    const corners = rectangleCombinedCorners(N, { Mx, My }, b, h);
    expect(corners.topLeft).toBeCloseTo(0, 12);
    expect(corners.bottomLeft).toBeCloseTo(0, 12);
    expect(corners.topRight).toBeCloseTo(-1.2, 12);
    expect(corners.bottomRight).toBeCloseTo(-1.2, 12);
  });

  it("сила в средата на страна на ромба (1,667; 2,5): нулевата линия минава през горния ляв ъгъл", () => {
    const xF = 20 / 12;
    const yF = 2.5;
    const { N, Mx, My } = eccentricForce(-360, xF, yF);
    const corners = rectangleCombinedCorners(N, { Mx, My }, b, h);
    expect(corners.topLeft).toBeCloseTo(0, 12);
    expect(corners.bottomRight).toBeCloseTo(-1.2, 12);
    expect(corners.topRight).toBeCloseTo(-0.6, 12);
    expect(corners.bottomLeft).toBeCloseTo(-0.6, 12);
    // отрези −33,33/1,667 = −20 cm и −75/2,5 = −30 cm
    const { ax, ay } = zeroLineIntercepts(xF, yF, 75, 100 / 3);
    expect(ax).toBeCloseTo(-20, 9);
    expect(ay).toBeCloseTo(-30, 9);
    expect(isInsideRectangleCore(xF, yF, b, h)).toBe(true); // на границата
  });

  it("за всяка сила в ядрото няма опън, а малко извън него има", () => {
    const inside: [number, number][] = [
      [0, 0],
      [1, 1],
      [-2, 1.9],
      [3.3, 0],
      [-1, -3.4],
    ];
    for (const [xF, yF] of inside) {
      expect(isInsideRectangleCore(xF, yF, b, h)).toBe(true);
      const { N, Mx, My } = eccentricForce(-360, xF, yF);
      const corners = rectangleCombinedCorners(N, { Mx, My }, b, h);
      expect(Math.max(...Object.values(corners))).toBeLessThanOrEqual(1e-12);
    }
    const outside: [number, number][] = [
      [3.4, 0],
      [0, -5.1],
      [2, 2.1],
    ];
    for (const [xF, yF] of outside) {
      expect(isInsideRectangleCore(xF, yF, b, h)).toBe(false);
      const { N, Mx, My } = eccentricForce(-360, xF, yF);
      const corners = rectangleCombinedCorners(N, { Mx, My }, b, h);
      expect(Math.max(...Object.values(corners))).toBeGreaterThan(0);
    }
  });

  it("кръг d = 30 cm: i² = d²/16 = 56,25 cm²; r_я = 56,25/15 = 30/8 = 3,75 cm", () => {
    const d = 30;
    const A = (Math.PI * d ** 2) / 4;
    const I = (Math.PI * d ** 4) / 64;
    expect(I / A).toBeCloseTo(56.25, 9);
    expect(circleCoreRadius(d)).toBe(3.75);
    expect(I / A / (d / 2)).toBeCloseTo(3.75, 9);
  });

  it("кръг d = 30 cm, натиск 500 kN на 3,75 cm от центъра: отсреща 0, откъм силата −1,415", () => {
    // A = π·30²/4 = 706,86 cm²; F/A = 0,7074; на границата на ядрото σ_max = 2·F/A
    const d = 30;
    const section = {
      A: (Math.PI * d ** 2) / 4,
      Ix: (Math.PI * d ** 4) / 64,
      Iy: (Math.PI * d ** 4) / 64,
    };
    expect(section.A.toFixed(2)).toBe("706.86");
    const { N, Mx, My } = eccentricForce(-500, 0, circleCoreRadius(d));
    expect(combinedStress(N, { Mx, My }, section, 0, -15)).toBeCloseTo(0, 12);
    const near = combinedStress(N, { Mx, My }, section, 0, 15);
    expect(near.toFixed(3)).toBe("-1.415");
    expect((near * 10).toFixed(1)).toBe("-14.1");
    expect(isInsideCircleCore(0, 3.75, d)).toBe(true);
    expect(isInsideCircleCore(0, 3.8, d)).toBe(false);
    // ядрото е кръг – посоката на изместването няма значение
    expect(isInsideCircleCore(2.6, 2.6, d)).toBe(true); // e = 3,68
    expect(isInsideCircleCore(2.7, 2.7, d)).toBe(false); // e = 3,82
  });
});

describe("П5: единичен фундамент 2,0×1,5 m, N = 900 kN, M = 150 kN·m", () => {
  // В cm: b = 150 (по x), h = 200 (по y, по посока на момента).
  // 1 kN/cm² = 10 000 kPa.
  const b = 150;
  const h = 200;
  const KPA = 10000;

  it("e = 150/900 = 0,167 m < 2,0/6 = 0,333 m – силата е в ядрото", () => {
    expect((150 / 900).toFixed(3)).toBe("0.167");
    expect((2 / 6).toFixed(3)).toBe("0.333");
    expect(isInsideRectangleCore(0, (150 / 900) * 100, b, h)).toBe(true);
  });

  it("A = 3,0 m²; W = 1,5·2,0²/6 = 1,0 m³; p = 300 ± 150 → 450 и 150 kPa", () => {
    expect(1.5 * 2).toBe(3);
    expect((1.5 * 2 ** 2) / 6).toBeCloseTo(1, 12);
    const corners = rectangleCombinedCorners(-900, { Mx: -150, My: 0 }, b, h);
    expect(-corners.bottomLeft * KPA).toBeCloseTo(450, 9);
    expect(-corners.topLeft * KPA).toBeCloseTo(150, 9);
    // средната стойност е N/A = 300 kPa
    expect(((-corners.bottomLeft - corners.topLeft) / 2) * KPA).toBeCloseTo(
      300,
      9,
    );
  });

  it("на границата: M = 900·0,333 = 300 kN·m → 600 kPa и 0", () => {
    expect(900 * (2 / 6)).toBeCloseTo(300, 9);
    const corners = rectangleCombinedCorners(-900, { Mx: -300, My: 0 }, b, h);
    expect(-corners.bottomLeft * KPA).toBeCloseTo(600, 9);
    expect(corners.topLeft * KPA).toBeCloseTo(0, 9);
  });
});

describe("въпроси „Провери се“ – Леко", () => {
  it("1) колона 20×40 cm, 400 kN на 4 cm: −0,50 ± 0,30 → −0,80 и −0,20", () => {
    // A = 800 cm²; W = 20·40²/6 = 5333,33 cm³; M = 1600 kN·cm
    expect(rectangleModulus(20, 40).toFixed(2)).toBe("5333.33");
    expect(1600 / rectangleModulus(20, 40)).toBeCloseTo(0.3, 12);
    const { N, Mx, My } = eccentricForce(-400, 0, 4);
    const corners = rectangleCombinedCorners(N, { Mx, My }, 20, 40);
    expect(corners.bottomLeft).toBeCloseTo(-0.8, 12);
    expect(corners.topLeft).toBeCloseTo(-0.2, 12);
  });

  it("2) граница без опън: h/6 = 40/6 = 6,67 cm", () => {
    expect(rectangleCore(20, 40).ey.toFixed(2)).toBe("6.67");
  });

  it("3) сила на границата на ядрото → нула в отсрещния ръб", () => {
    const { N, Mx, My } = eccentricForce(-400, 0, 40 / 6);
    const corners = rectangleCombinedCorners(N, { Mx, My }, 20, 40);
    expect(corners.topLeft).toBeCloseTo(0, 12);
    expect(corners.bottomLeft).toBeCloseTo(-1, 12); // 2·F/A
  });

  it("4) кръгла колона d = 40 cm: d/8 = 5 cm", () => {
    expect(circleCoreRadius(40)).toBe(5);
  });
});

describe("въпроси „Провери се“ – Подробно", () => {
  it("1) 24×36 cm, 432 kN с e = 9 cm: −0,50 ± 0,75 → −1,25 и +0,25; нулева линия на 12 cm", () => {
    // A = 864 cm²; W = 24·36²/6 = 5184 cm³; M = 432·9 = 3888 kN·cm
    expect(rectangleModulus(24, 36)).toBeCloseTo(5184, 9);
    expect(3888 / 5184).toBeCloseTo(0.75, 12);
    const { N, Mx, My } = eccentricForce(-432, 0, 9);
    const corners = rectangleCombinedCorners(N, { Mx, My }, 24, 36);
    expect(corners.bottomLeft).toBeCloseTo(-1.25, 12);
    expect(corners.topLeft).toBeCloseTo(0.25, 12);
    // i_x² = 36²/12 = 108; a_y = −108/9 = −12
    expect(zeroLineIntercepts(0, 9, 108, 48).ay).toBeCloseTo(-12, 12);
  });

  it("2) планка 6×12 cm, N = 72 kN, M = 1,44 kN·m: 1,0 ± 1,0 → 2,0 и 0", () => {
    // A = 72 cm²; W = 6·12²/6 = 144 cm³; I = 6·12³/12 = 864 cm⁴
    expect(rectangleModulus(6, 12)).toBeCloseTo(144, 9);
    const { top, bottom } = axialBendingExtremes(72, 1.44, 72, {
      Ix: 864,
      yTop: 6,
      yBottom: 6,
    });
    expect(bottom).toBeCloseTo(2, 12);
    expect(top).toBeCloseTo(0, 12);
  });

  it("3) 30×60 cm, 900 kN в (5; 10): −1,5; −0,5; −0,5; +0,5; отрези −15 и −30 cm", () => {
    // N/A = −0,50; M_x/W_x = 9000/18 000 = 0,50; M_y/W_y = 4500/9000 = 0,50
    expect(rectangleModulus(30, 60)).toBeCloseTo(18000, 9);
    expect(rectangleModulus(60, 30)).toBeCloseTo(9000, 9);
    const { N, Mx, My } = eccentricForce(-900, 5, 10);
    const corners = rectangleCombinedCorners(N, { Mx, My }, 30, 60);
    expect(corners.bottomRight).toBeCloseTo(-1.5, 12);
    expect(corners.bottomLeft).toBeCloseTo(-0.5, 12);
    expect(corners.topRight).toBeCloseTo(-0.5, 12);
    expect(corners.topLeft).toBeCloseTo(0.5, 12);
    // i_y² = 30²/12 = 75; i_x² = 60²/12 = 300
    const { ax, ay } = zeroLineIntercepts(5, 10, 300, 75);
    expect(ax).toBeCloseTo(-15, 12);
    expect(ay).toBeCloseTo(-30, 12);
  });

  it("5) кръг d = 32 cm, 400 kN на 3 cm: ядро 4 cm; −0,497·1,75 = −0,870 и −0,497·0,25 = −0,124", () => {
    const d = 32;
    expect(circleCoreRadius(d)).toBe(4);
    expect(isInsideCircleCore(3, 0, d)).toBe(true);
    const section = {
      A: (Math.PI * d ** 2) / 4,
      Ix: (Math.PI * d ** 4) / 64,
      Iy: (Math.PI * d ** 4) / 64,
    };
    expect(section.A.toFixed(1)).toBe("804.2");
    expect((400 / section.A).toFixed(3)).toBe("0.497");
    expect(section.Iy / section.A).toBeCloseTo(64, 9); // i² = d²/16
    const { N, Mx, My } = eccentricForce(-400, 3, 0);
    expect(combinedStress(N, { Mx, My }, section, 16, 0).toFixed(3)).toBe(
      "-0.870",
    );
    expect(combinedStress(N, { Mx, My }, section, -16, 0).toFixed(3)).toBe(
      "-0.124",
    );
  });
});

describe("проверка на входните данни", () => {
  it("отхвърля невалидна геометрия", () => {
    expect(() => rectangleSection(0, 30)).toThrow();
    expect(() => rectangleCore(20, -1)).toThrow();
    expect(() => circleCoreRadius(0)).toThrow();
    expect(() =>
      combinedStress(10, { Mx: 1, My: 0 }, { A: 0, Ix: 1, Iy: 1 }, 0, 0),
    ).toThrow();
    expect(() =>
      axialBendingExtremes(1, 1, 10, { Ix: 0, yTop: 1, yBottom: 1 }),
    ).toThrow();
    expect(() => eccentricForce(Number.NaN, 0, 0)).toThrow();
  });

  it("центрична сила няма нулева линия; чисто N няма отместване", () => {
    expect(() => zeroLineIntercepts(0, 0, 75, 33)).toThrow();
    expect(() => zeroLineOffset(100, 0, 28.5, 1943)).toThrow();
    expect(() => forcePointForZeroLine(0, -15, 75, 33)).toThrow();
  });

  it("опънна сила със същата точка дава същата нулева линия и обратни знаци", () => {
    const compression = eccentricForce(-360, 3, 6);
    const tension = eccentricForce(360, 3, 6);
    const a = rectangleCombinedCorners(compression.N, compression, 20, 30);
    const c = rectangleCombinedCorners(tension.N, tension, 20, 30);
    expect(c.topLeft).toBeCloseTo(-a.topLeft, 12);
    expect(c.bottomRight).toBeCloseTo(-a.bottomRight, 12);
  });
});
