import { describe, expect, it } from "vitest";
import {
  biaxialStress,
  maxBiaxialStress,
  neutralAxisAngle,
  rectangleCornerStresses,
  resolveMoment,
} from "@/lib/engineering/biaxial";
import { rectangleModulus } from "@/lib/engineering/bending";

// Всички очаквани стойности са сметнати на ръка и са записани над теста.

describe("столица 10×16 cm на покрив с наклон 30°, l = 3 m, q = 2 kN/m", () => {
  // M = 2·3²/8 = 2,25 kN·m; M_x = 2,25·cos 30° = 1,949; M_y = 2,25·sin 30° = 1,125
  const moments = resolveMoment(2.25, 30);
  const Wx = rectangleModulus(10, 16); // 10·16²/6 = 426,67
  const Wy = rectangleModulus(16, 10); // 16·10²/6 = 266,67

  it("съставки на момента", () => {
    expect(moments.Mx.toFixed(3)).toBe("1.949");
    expect(moments.My).toBeCloseTo(1.125, 12);
    expect(Wx.toFixed(2)).toBe("426.67");
    expect(Wy.toFixed(2)).toBe("266.67");
  });

  it("σ_max = 194,9/426,67 + 112,5/266,67 = 0,457 + 0,422 = 0,879 kN/cm²", () => {
    expect(((moments.Mx * 100) / Wx).toFixed(3)).toBe("0.457");
    expect(((moments.My * 100) / Wy).toFixed(3)).toBe("0.422");
    expect(maxBiaxialStress(moments, { Wx, Wy }).toFixed(3)).toBe("0.879");
  });

  it("без наклон същата греда има 225/426,67 = 0,527 kN/cm² – 1,67 пъти по-малко", () => {
    expect((225 / Wx).toFixed(3)).toBe("0.527");
    expect(
      (maxBiaxialStress(moments, { Wx, Wy }) / (225 / Wx)).toFixed(2),
    ).toBe("1.67");
  });

  it("ъглите: ±0,879 в двата противоположни и ±0,035 в другите два", () => {
    const corners = rectangleCornerStresses(moments, 10, 16);
    expect(corners.bottomRight.toFixed(3)).toBe("0.879");
    expect(corners.topLeft.toFixed(3)).toBe("-0.879");
    expect(corners.bottomLeft.toFixed(3)).toBe("0.035");
    expect(corners.topRight.toFixed(3)).toBe("-0.035");
  });

  it("неутралната ос: tg β = (16²/10²)·tg 30° = 2,56·0,577 = 1,478 → β = 55,9°", () => {
    const section = { Ix: (10 * 16 ** 3) / 12, Iy: (16 * 10 ** 3) / 12 };
    expect(section.Ix / section.Iy).toBeCloseTo(2.56, 12);
    expect(neutralAxisAngle(moments, section).toFixed(1)).toBe("55.9");
    // на неутралната ос напрежението е нула
    const beta = (neutralAxisAngle(moments, section) * Math.PI) / 180;
    expect(biaxialStress(moments, section, 3, -3 * Math.tan(beta))).toBeCloseTo(
      0,
      12,
    );
  });
});

describe("конзола 12×20 cm: M_x = 6 kN·m, M_y = 2 kN·m", () => {
  const moments = { Mx: 6, My: 2 };

  it("W_x = 800, W_y = 480 cm³; σ_max = 600/800 + 200/480 = 0,75 + 0,417 = 1,167 kN/cm²", () => {
    expect(rectangleModulus(12, 20)).toBeCloseTo(800, 9);
    expect(rectangleModulus(20, 12)).toBeCloseTo(480, 9);
    expect(maxBiaxialStress(moments, { Wx: 800, Wy: 480 }).toFixed(3)).toBe(
      "1.167",
    );
  });

  it("ъглите: 1,167; 0,333; −0,333; −1,167 kN/cm²", () => {
    const corners = rectangleCornerStresses(moments, 12, 20);
    expect(corners.bottomRight.toFixed(3)).toBe("1.167");
    expect(corners.bottomLeft.toFixed(3)).toBe("0.333");
    expect(corners.topRight.toFixed(3)).toBe("-0.333");
    expect(corners.topLeft.toFixed(3)).toBe("-1.167");
  });

  it("неутралната ос: tg β = (400/144)·(2/6) = 0,926 → β = 42,8°", () => {
    const section = { Ix: (12 * 20 ** 3) / 12, Iy: (20 * 12 ** 3) / 12 };
    expect(neutralAxisAngle(moments, section).toFixed(1)).toBe("42.8");
  });
});

describe("IPE 200 (W_x = 194 cm³, W_y = 28,5 cm³), M = 10 kN·m, наклон 5°", () => {
  const moments = resolveMoment(10, 5);

  it("σ = 996,2/194 + 87,16/28,5 = 5,14 + 3,06 = 8,19 kN/cm²", () => {
    expect((moments.Mx * 100).toFixed(1)).toBe("996.2");
    expect((moments.My * 100).toFixed(2)).toBe("87.16");
    expect(maxBiaxialStress(moments, { Wx: 194, Wy: 28.5 }).toFixed(2)).toBe(
      "8.19",
    );
  });

  it("без наклон: 1000/194 = 5,15 kN/cm²; наклон от 5° вдига напрежението с 59 %", () => {
    expect((1000 / 194).toFixed(2)).toBe("5.15");
    const ratio =
      maxBiaxialStress(moments, { Wx: 194, Wy: 28.5 }) / (1000 / 194);
    expect(((ratio - 1) * 100).toFixed(0)).toBe("59");
  });
});

describe("оразмеряване и въпроси", () => {
  it("столицата при σ_доп = 1 kN/cm² и h = 1,5b: W_x ≥ 194,9 + 1,5·112,5 = 363,6 cm³ → b = 9,90 cm", () => {
    const need = 194.86 + 1.5 * 112.5;
    expect(need.toFixed(1)).toBe("363.6");
    // W_x = b·(1,5b)²/6 = 0,375·b³
    expect(Math.cbrt(need / 0.375).toFixed(2)).toBe("9.90");
  });

  it("приетото 10×15 cm: W_x = 375, W_y = 250; σ = 0,520 + 0,450 = 0,970 kN/cm²", () => {
    expect(rectangleModulus(10, 15)).toBeCloseTo(375, 9);
    expect(rectangleModulus(15, 10)).toBeCloseTo(250, 9);
    expect(
      maxBiaxialStress(resolveMoment(2.25, 30), { Wx: 375, Wy: 250 }).toFixed(
        3,
      ),
    ).toBe("0.970");
  });

  it("квадрат 10×10, M = 4 kN·m по диагонала (45°): 3,39 kN/cm² срещу 2,40 по оста", () => {
    const W = rectangleModulus(10, 10);
    expect(
      maxBiaxialStress(resolveMoment(4, 45), { Wx: W, Wy: W }).toFixed(2),
    ).toBe("3.39");
    expect((400 / W).toFixed(2)).toBe("2.40");
  });

  it("правоъгълник 6×12, M_x = 3, M_y = 1 kN·m: 300/144 + 100/72 = 3,47 kN/cm²", () => {
    expect(
      maxBiaxialStress({ Mx: 3, My: 1 }, { Wx: 144, Wy: 72 }).toFixed(2),
    ).toBe("3.47");
  });

  it("гранични случаи", () => {
    expect(neutralAxisAngle({ Mx: 5, My: 0 }, { Ix: 1, Iy: 1 })).toBe(0);
    expect(neutralAxisAngle({ Mx: 0, My: 5 }, { Ix: 1, Iy: 1 })).toBe(90);
    expect(() =>
      maxBiaxialStress({ Mx: 1, My: 1 }, { Wx: 0, Wy: 1 }),
    ).toThrow();
    expect(() =>
      biaxialStress({ Mx: 1, My: 1 }, { Ix: 0, Iy: 1 }, 0, 0),
    ).toThrow();
  });

  it("I_x = 4·I_y, α = 10°: tg β = 4·0,1763 = 0,705 → β = 35,2°", () => {
    const moments = resolveMoment(1, 10);
    expect((4 * Math.tan((10 * Math.PI) / 180)).toFixed(3)).toBe("0.705");
    expect(neutralAxisAngle(moments, { Ix: 4, Iy: 1 }).toFixed(1)).toBe("35.2");
  });

  it("IPE 200: съставката по слабата ос е 8,7 % от момента, а W_x/W_y = 6,8", () => {
    expect((resolveMoment(10, 5).My * 10).toFixed(1)).toBe("8.7");
    expect((194 / 28.5).toFixed(1)).toBe("6.8");
  });
});
