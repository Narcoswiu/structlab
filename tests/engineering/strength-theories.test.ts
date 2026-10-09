import { describe, expect, it } from "vitest";
import {
  beamEquivalentMaxNormal,
  beamEquivalentMaxStrain,
  beamEquivalentMises,
  beamEquivalentTresca,
  beamPrincipalStresses,
  circularSectionModulus,
  equivalentMaxNormal,
  equivalentMaxStrain,
  equivalentMises,
  equivalentMohr,
  equivalentMoment,
  equivalentTresca,
  isStrengthSatisfied,
  principalStressesPlane,
  shaftDiameter,
  shaftEquivalentStress,
  shearYieldStress,
} from "@/lib/engineering/strength-theories";
import { circleModulus, navierStress } from "@/lib/engineering/bending";
import { sectionProperties } from "@/lib/engineering/section";
import { maxShearStress, shearStressAt } from "@/lib/engineering/shear";
import { maxTorsionStress, polarModulus } from "@/lib/engineering/torsion";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над проверката.
// Числата са тези, които се четат в Глава 15 „Теории за якост“.
// Напрежения в kN/cm² (1 kN/cm² = 10 MPa), моменти в kN·m.

const NU_STEEL = 0.3; // БДС EN 1993-1-1:2005, т. 3.2.6

/**
 * Независима проверка: нормалното и тангенциалното напрежение върху площадка,
 * завъртяна на ъгъл θ, от формулите за завъртане на осите (без формулата за
 * главните напрежения).
 */
function rotated(sigmaX: number, sigmaY: number, tau: number, theta: number) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return {
    normal: sigmaX * c * c + sigmaY * s * s + 2 * tau * s * c,
    shear: (sigmaY - sigmaX) * s * c + tau * (c * c - s * s),
  };
}

/** Най-голямото и най-малкото нормално напрежение – с обхождане на всички площадки. */
function principalByScan(sigmaX: number, sigmaY: number, tau: number) {
  let max = -Infinity;
  let min = Infinity;
  const steps = 180000;
  for (let i = 0; i < steps; i++) {
    const { normal } = rotated(sigmaX, sigmaY, tau, (Math.PI * i) / steps);
    max = Math.max(max, normal);
    min = Math.min(min, normal);
  }
  return { max, min };
}

describe("главни напрежения при равнинно състояние", () => {
  it("σ = 10, τ = 6: ½·√(100 + 144) = ½·√244 = 7,810; σ₁ = 5 + 7,810 = 12,810; σ₂ = 5 − 7,810 = −2,810", () => {
    const { s1, s2 } = beamPrincipalStresses(10, 6);
    expect(s1).toBeCloseTo(12.81, 3);
    expect(s2).toBeCloseTo(-2.81, 3);
    // σ₁ + σ₂ = σ; σ₁·σ₂ = −τ²
    expect(s1 + s2).toBeCloseTo(10, 12);
    expect(s1 * s2).toBeCloseTo(-36, 10);
  });

  it("независима проверка: обхождане на всички площадки дава същите σ₁ и σ₂", () => {
    for (const [sx, sy, t] of [
      [10, 0, 6],
      [4, 0, 3],
      [8, 0, 3],
      [-6, 3, 2],
      [0, 0, 6],
    ] as const) {
      const { s1, s2 } = principalStressesPlane(sx, sy, t);
      const scan = principalByScan(sx, sy, t);
      expect(scan.max).toBeCloseTo(s1, 7);
      expect(scan.min).toBeCloseTo(s2, 7);
    }
  });

  it("по главната площадка няма тангенциално напрежение: tg 2α = 2τ/σ = 12/10, α = 25,1° (фигурата)", () => {
    const alpha = Math.atan2(2 * 6, 10) / 2;
    expect((alpha * 180) / Math.PI).toBeCloseTo(25.1, 1);
    const face = rotated(10, 0, 6, alpha);
    expect(face.shear).toBeCloseTo(0, 12);
    expect(face.normal).toBeCloseTo(12.81, 3);
    // перпендикулярната площадка носи σ₂
    expect(rotated(10, 0, 6, alpha + Math.PI / 2).normal).toBeCloseTo(-2.81, 3);
  });

  it("знакът на τ не променя главните напрежения; подреждането е σ₁ ≥ σ₂", () => {
    expect(beamPrincipalStresses(10, -6)).toEqual(beamPrincipalStresses(10, 6));
    const { s1, s2 } = principalStressesPlane(-8, 2, 0);
    expect(s1).toBeCloseTo(2, 12);
    expect(s2).toBeCloseTo(-8, 12);
  });
});

describe("пример Л1 / П1: точка от стоманена греда, σ = 10, τ = 6 kN/cm², σ_доп = 16 kN/cm²", () => {
  it("III теория: √(10² + 4·6²) = √(100 + 144) = √244 = 15,62 kN/cm² = 156,2 MPa", () => {
    expect(beamEquivalentTresca(10, 6)).toBeCloseTo(15.62, 2);
    expect(isStrengthSatisfied(beamEquivalentTresca(10, 6), 16)).toBe(true);
  });

  it("IV теория: √(100 + 3·36) = √208 = 14,42 kN/cm² = 144,2 MPa", () => {
    expect(beamEquivalentMises(10, 6)).toBeCloseTo(14.42, 2);
    expect(isStrengthSatisfied(beamEquivalentMises(10, 6), 16)).toBe(true);
  });

  it("I теория: σ₁ = 12,81 kN/cm² = 128,1 MPa", () => {
    expect(beamEquivalentMaxNormal(10, 6)).toBeCloseTo(12.81, 2);
  });

  it("II теория (ν = 0,3): 12,810 + 0,3·2,810 = 12,810 + 0,843 = 13,65 kN/cm² = 136,5 MPa", () => {
    expect(beamEquivalentMaxStrain(10, 6, NU_STEEL)).toBeCloseTo(13.65, 2);
    expect(equivalentMaxStrain(NU_STEEL, 12.81, -2.81)).toBeCloseTo(13.653, 3);
    expect(0.3 * 2.81).toBeCloseTo(0.843, 3);
  });

  it("проверка чрез главните напрежения: 12,810 − (−2,810) = 15,620; √(164,10 + 36,00 + 7,90) = √208,00 = 14,42", () => {
    const { s1, s2 } = beamPrincipalStresses(10, 6);
    expect(equivalentTresca(s1, s2)).toBeCloseTo(15.62, 3);
    expect(equivalentMises(s1, s2)).toBeCloseTo(14.42, 2);
    // с отпечатаните закръглени стойности читателят получава същото
    expect(12.81 + 2.81).toBeCloseTo(15.62, 10);
    expect(12.81 ** 2).toBeCloseTo(164.1, 2);
    expect(12.81 * 2.81).toBeCloseTo(36.0, 2);
    expect(2.81 ** 2).toBeCloseTo(7.9, 2);
    expect(Math.sqrt(164.1 + 36.0 + 7.9)).toBeCloseTo(14.42, 2);
  });

  it("запасът по III теория: 160/156,2 − 1 = 2,4 %, а само по σ: 160/100 − 1 = 60 %", () => {
    expect((16 / beamEquivalentTresca(10, 6) - 1) * 100).toBeCloseTo(2.4, 1);
    expect((160 / 156.2 - 1) * 100).toBeCloseTo(2.4, 1);
    expect((16 / 10 - 1) * 100).toBeCloseTo(60, 10);
  });

  it("вариант τ = 7: III = √(100 + 196) = √296 = 17,20 > 16; IV = √(100 + 147) = √247 = 15,72 ≤ 16", () => {
    expect(beamEquivalentTresca(10, 7)).toBeCloseTo(17.2, 2);
    expect(beamEquivalentMises(10, 7)).toBeCloseTo(15.72, 2);
    expect(isStrengthSatisfied(beamEquivalentTresca(10, 7), 16)).toBe(false);
    expect(isStrengthSatisfied(beamEquivalentMises(10, 7), 16)).toBe(true);
  });

  it("точките от фигурата с граничните криви: А (0,625; 0,375) е под двете, Б (0,625; 0,4375) – между тях", () => {
    const inside = (s: number, t: number, factor: number) =>
      s * s + factor * t * t <= 1;
    expect(inside(10 / 16, 6 / 16, 4)).toBe(true);
    expect(inside(10 / 16, 6 / 16, 3)).toBe(true);
    expect(inside(10 / 16, 7 / 16, 4)).toBe(false);
    expect(inside(10 / 16, 7 / 16, 3)).toBe(true);
    // пресечни точки на кривите с оста τ: 0,5 и 1/√3 = 0,577
    expect(1 / Math.sqrt(3)).toBeCloseTo(0.577, 3);
  });
});

describe("пример П2: греда „I“ (пояси 10×1,2, стебло 0,8×17,6 cm), M = 30 kN·m, Q = 60 kN", () => {
  const section = [
    { b: 10, h: 1.2, x: 0, y: 0 },
    { b: 0.8, h: 17.6, x: 4.6, y: 1.2 },
    { b: 10, h: 1.2, x: 0, y: 18.8 },
  ];
  const props = sectionProperties(section);

  it("I_x = 2486,97 cm⁴ (Глава 5)", () => {
    expect(props.Ix).toBeCloseTo(2486.97, 2);
  });

  it("крайно влакно: σ = 3000·10/2486,97 = 12,06 kN/cm² = 120,6 MPa, τ = 0", () => {
    const sigma = (3000 * 10) / props.Ix;
    expect(sigma).toBeCloseTo(12.06, 2);
    expect(Math.abs(navierStress(30, props.Ix, 10))).toBeCloseTo(12.06, 2);
    expect(beamEquivalentTresca(sigma, 0)).toBeCloseTo(12.06, 2);
    expect(beamEquivalentMises(sigma, 0)).toBeCloseTo(12.06, 2);
  });

  it("неутрална ос: τ = 60·143,78/(2486,97·0,8) = 4,336; III = 2·4,336 = 8,67; IV = √3·4,336 = 7,51 kN/cm²", () => {
    const tau = maxShearStress(section, 60).tau;
    expect(tau).toBeCloseTo(4.336, 3);
    expect(beamEquivalentTresca(0, tau)).toBeCloseTo(8.67, 2);
    expect(beamEquivalentMises(0, tau)).toBeCloseTo(7.51, 2);
    expect(2 * 4.336).toBeCloseTo(8.67, 2);
    expect(Math.sqrt(3) * 4.336).toBeCloseTo(7.51, 2);
  });

  // стебло до пояса: y = 8,8 cm от неутралната ос; S* = 12·9,4 = 112,8 cm³
  const sigmaJ = (3000 * 8.8) / props.Ix;
  const tauJ = (60 * 112.8) / (props.Ix * 0.8);

  it("стебло до пояса: σ = 3000·8,8/2486,97 = 10,615; τ = 60·112,8/(2486,97·0,8) = 3,402 kN/cm²", () => {
    expect(sigmaJ).toBeCloseTo(10.615, 3);
    expect(tauJ).toBeCloseTo(3.402, 3);
    // независимо: формулата на Журавски от Глава 5, с ширината на стеблото
    expect(shearStressAt(section, 60, 18.8, "below")).toBeCloseTo(3.402, 3);
    expect(Math.abs(navierStress(30, props.Ix, 8.8))).toBeCloseTo(10.615, 3);
  });

  it("III: √(10,615² + 4·3,402²) = √(112,68 + 46,29) = √158,97 = 12,61 kN/cm² = 126,1 MPa", () => {
    expect(beamEquivalentTresca(sigmaJ, tauJ)).toBeCloseTo(12.61, 2);
    expect(Math.sqrt(112.68 + 46.29)).toBeCloseTo(12.61, 2);
    expect(10.615 ** 2).toBeCloseTo(112.68, 2);
    expect(4 * 3.402 ** 2).toBeCloseTo(46.29, 2);
  });

  it("IV: √(112,68 + 3·3,402²) = √(112,68 + 34,72) = √147,40 = 12,14 kN/cm² = 121,4 MPa", () => {
    expect(beamEquivalentMises(sigmaJ, tauJ)).toBeCloseTo(12.14, 2);
    expect(3 * 3.402 ** 2).toBeCloseTo(34.72, 2);
    expect(Math.sqrt(147.4)).toBeCloseTo(12.14, 2);
  });

  it("загадката: в стеблото до пояса 106,2 и 34,0 MPa; σ е с 12 % под най-голямото (8,8/10 = 0,88)", () => {
    expect(sigmaJ * 10).toBeCloseTo(106.2, 1);
    expect(tauJ * 10).toBeCloseTo(34.0, 1);
    expect((1 - sigmaJ / ((3000 * 10) / props.Ix)) * 100).toBeCloseTo(12, 10);
  });

  it("най-опасна е точката в стеблото до пояса: 12,61 и 12,14 > 12,06; всички под σ_доп = 13", () => {
    const edge = (3000 * 10) / props.Ix;
    expect(beamEquivalentTresca(sigmaJ, tauJ)).toBeGreaterThan(edge);
    expect(beamEquivalentMises(sigmaJ, tauJ)).toBeGreaterThan(edge);
    expect(isStrengthSatisfied(beamEquivalentTresca(sigmaJ, tauJ), 13)).toBe(
      true,
    );
    expect((beamEquivalentTresca(sigmaJ, tauJ) / edge - 1) * 100).toBeCloseTo(
      4.5,
      1,
    );
  });
});

describe("пример Л2 / П3: кръгъл вал, M = 3 kN·m, T = 4 kN·m, σ_доп = 10 kN/cm²", () => {
  it("M_екв,III = √(3² + 4²) = 5 kN·m; M_екв,IV = √(9 + 0,75·16) = √21 = 4,583 kN·m", () => {
    expect(equivalentMoment(3, 4, "III")).toBeCloseTo(5, 12);
    expect(equivalentMoment(3, 4, "IV")).toBeCloseTo(4.583, 3);
  });

  it("d ≥ ∛(32·500/(π·10)) = ∛509,3 = 7,99 cm (III); ∛(32·458,3/(π·10)) = ∛466,8 = 7,76 cm (IV)", () => {
    expect(shaftDiameter(3, 4, 10, "III")).toBeCloseTo(7.99, 2);
    expect(shaftDiameter(3, 4, 10, "IV")).toBeCloseTo(7.76, 2);
    expect((32 * 500) / (Math.PI * 10)).toBeCloseTo(509.3, 1);
    expect((32 * 458.3) / (Math.PI * 10)).toBeCloseTo(466.8, 1);
  });

  it("d = 8 cm: W = π·8³/32 = 50,27 cm³; W_p = 2·W = 100,53 cm³", () => {
    expect(circularSectionModulus(8)).toBeCloseTo(50.27, 2);
    expect(circularSectionModulus(8)).toBeCloseTo(circleModulus(8), 10);
    expect(polarModulus(8)).toBeCloseTo(100.53, 2);
    expect(polarModulus(8)).toBeCloseTo(2 * circularSectionModulus(8), 10);
  });

  it("σ_екв,III = 500/50,27 = 9,95 kN/cm² = 99,5 MPa; σ_екв,IV = 458,3/50,27 = 9,12 kN/cm² = 91,2 MPa", () => {
    const W = circularSectionModulus(8);
    expect(shaftEquivalentStress(3, 4, W, "III")).toBeCloseTo(9.95, 2);
    expect(shaftEquivalentStress(3, 4, W, "IV")).toBeCloseTo(9.12, 2);
    expect(500 / 50.27).toBeCloseTo(9.95, 2);
    expect(458.3 / 50.27).toBeCloseTo(9.12, 2);
    expect(isStrengthSatisfied(shaftEquivalentStress(3, 4, W, "III"), 10)).toBe(
      true,
    );
  });

  it("проверка чрез напреженията: σ = 300/50,27 = 5,968; τ = 400/100,53 = 3,979; √(35,62 + 63,33) = 9,95; √(35,62 + 47,50) = 9,12", () => {
    const sigma = 300 / circularSectionModulus(8);
    const tau = maxTorsionStress(4, polarModulus(8));
    expect(sigma).toBeCloseTo(5.968, 3);
    expect(tau).toBeCloseTo(3.979, 3);
    expect(5.968 ** 2).toBeCloseTo(35.62, 2);
    expect(4 * 3.979 ** 2).toBeCloseTo(63.33, 2);
    expect(3 * 3.979 ** 2).toBeCloseTo(47.5, 2);
    expect(beamEquivalentTresca(sigma, tau)).toBeCloseTo(9.95, 2);
    expect(beamEquivalentMises(sigma, tau)).toBeCloseTo(9.12, 2);
  });

  it("независима проверка: еквивалентният момент дава същото като напреженията с W и W_p = 2W", () => {
    for (const [M, T, D, d] of [
      [3, 4, 8, 0],
      [1.5, 2, 6, 0],
      [6, 8, 10, 0],
      [2, 7, 10, 8],
      [5, 0, 7, 0],
      [0, 5, 7, 3],
      [-3, 4, 8, 0],
    ] as const) {
      const W = circularSectionModulus(D, d);
      const Wp = polarModulus(D, d);
      expect(Wp).toBeCloseTo(2 * W, 9);
      const sigma = (M * 100) / W;
      const tau = (T * 100) / Wp;
      expect(shaftEquivalentStress(M, T, W, "III")).toBeCloseTo(
        beamEquivalentTresca(sigma, tau),
        9,
      );
      expect(shaftEquivalentStress(M, T, W, "IV")).toBeCloseTo(
        beamEquivalentMises(sigma, tau),
        9,
      );
    }
  });

  it("тръба 10/8 cm: W = π·(10⁴ − 8⁴)/(32·10) = π·5904/320 = 57,96 cm³ – половината от W_p = 115,92 (Глава 8)", () => {
    expect(circularSectionModulus(10, 8)).toBeCloseTo(57.96, 2);
  });
});

describe("пример П4: чугун, σ = 4, τ = 3 kN/cm²; σ_доп,оп = 7, σ_доп,нат = 21 kN/cm²", () => {
  const { s1, s2 } = beamPrincipalStresses(4, 3);

  it("главни напрежения: ½·√(16 + 36) = ½·√52 = 3,606; σ₁ = 2 + 3,606 = 5,606; σ₂ = 2 − 3,606 = −1,606", () => {
    expect(s1).toBeCloseTo(5.606, 3);
    expect(s2).toBeCloseTo(-1.606, 3);
  });

  it("I теория: σ_екв = 5,606 kN/cm² = 56,1 MPa ≤ 70; натискът 16,1 MPa ≤ 210", () => {
    expect(equivalentMaxNormal(s1, s2)).toBeCloseTo(5.606, 3);
    expect(isStrengthSatisfied(equivalentMaxNormal(s1, s2), 7)).toBe(true);
    expect(Math.abs(s2) * 10).toBeCloseTo(16.1, 1);
  });

  it("Мор: k = 7/21 = 1/3; 5,606 + 1,606/3 = 5,606 + 0,535 = 6,14 kN/cm² = 61,4 MPa ≤ 70", () => {
    expect(equivalentMohr(7 / 21, s1, s2)).toBeCloseTo(6.14, 2);
    expect(1.606 / 3).toBeCloseTo(0.535, 3);
    expect(isStrengthSatisfied(equivalentMohr(7 / 21, s1, s2), 7)).toBe(true);
  });

  it("за сравнение III: 5,606 + 1,606 = 7,21 kN/cm² = 72,1 MPa > 70", () => {
    expect(equivalentTresca(s1, s2)).toBeCloseTo(7.21, 2);
    expect(isStrengthSatisfied(equivalentTresca(s1, s2), 7)).toBe(false);
  });
});

describe("въпроси „Провери се“", () => {
  it("Леко 1: чисто срязване τ = 6: III = 2·6 = 12 (120 MPa); IV = 1,732·6 = 10,39 (103,9 MPa)", () => {
    expect(beamEquivalentTresca(0, 6)).toBeCloseTo(12, 12);
    expect(beamEquivalentMises(0, 6)).toBeCloseTo(10.39, 2);
    expect(1.732 * 6).toBeCloseTo(10.39, 2);
  });

  it("Леко 2: σ = 9, τ = 6: III = √(81 + 144) = √225 = 15 (150 MPa); IV = √(81 + 108) = √189 = 13,75 (137,5 MPa)", () => {
    expect(beamEquivalentTresca(9, 6)).toBeCloseTo(15, 12);
    expect(beamEquivalentMises(9, 6)).toBeCloseTo(13.75, 2);
  });

  it("Леко 4: вал d = 10 cm, M = 6, T = 8: M_екв = 10 kN·m; W = π·1000/32 = 98,17; 1000/98,17 = 10,19 (101,9 MPa)", () => {
    expect(equivalentMoment(6, 8, "III")).toBeCloseTo(10, 12);
    expect(circularSectionModulus(10)).toBeCloseTo(98.17, 2);
    expect(
      shaftEquivalentStress(6, 8, circularSectionModulus(10), "III"),
    ).toBeCloseTo(10.19, 2);
    expect(1000 / 98.17).toBeCloseTo(10.19, 2);
  });

  it("Подробно 1: σ = 8, τ = 3: ½·√(64 + 36) = 5; σ₁ = 4 + 5 = 9; σ₂ = 4 − 5 = −1; III = √100 = 10; IV = √(64 + 27) = √91 = 9,54", () => {
    const { s1, s2 } = beamPrincipalStresses(8, 3);
    expect(s1).toBeCloseTo(9, 12);
    expect(s2).toBeCloseTo(-1, 12);
    expect(beamEquivalentTresca(8, 3)).toBeCloseTo(10, 12);
    expect(beamEquivalentMises(8, 3)).toBeCloseTo(9.54, 2);
  });

  it("Подробно 2: f_y = 235 MPa на чисто срязване: 235/2 = 117,5 MPa (III); 235/√3 = 135,7 MPa (IV, Глава 5)", () => {
    expect(shearYieldStress(235, "III")).toBeCloseTo(117.5, 10);
    expect(shearYieldStress(235, "IV")).toBeCloseTo(135.7, 1);
    // при това τ еквивалентното напрежение е точно f_y
    expect(beamEquivalentTresca(0, shearYieldStress(235, "III"))).toBeCloseTo(
      235,
      9,
    );
    expect(beamEquivalentMises(0, shearYieldStress(235, "IV"))).toBeCloseTo(
      235,
      9,
    );
  });

  it("Подробно 3: вал d = 6 cm, M = 1,5, T = 2: M_екв = √(2,25 + 4) = 2,5 kN·m; W = π·216/32 = 21,206; 250/21,206 = 11,79 (117,9 MPa)", () => {
    expect(equivalentMoment(1.5, 2, "III")).toBeCloseTo(2.5, 12);
    expect(circularSectionModulus(6)).toBeCloseTo(21.206, 3);
    expect(
      shaftEquivalentStress(1.5, 2, circularSectionModulus(6), "III"),
    ).toBeCloseTo(11.79, 2);
    expect(250 / 21.206).toBeCloseTo(11.79, 2);
  });

  it("Подробно 4: най-голямото отношение III/IV е 2/√3 = 1,155, при чисто срязване", () => {
    expect(beamEquivalentTresca(0, 7) / beamEquivalentMises(0, 7)).toBeCloseTo(
      1.155,
      3,
    );
    expect(2 / Math.sqrt(3)).toBeCloseTo(1.155, 3);
  });

  it("Подробно 5: чугунен вал на чисто усукване, τ = 5: I → 5 ≤ 6; Мор (k = 6/24 = 0,25) → 5 + 0,25·5 = 6,25 > 6", () => {
    const { s1, s2 } = beamPrincipalStresses(0, 5);
    expect(s1).toBeCloseTo(5, 12);
    expect(s2).toBeCloseTo(-5, 12);
    expect(isStrengthSatisfied(equivalentMaxNormal(s1, s2), 6)).toBe(true);
    expect(equivalentMohr(6 / 24, s1, s2)).toBeCloseTo(6.25, 12);
    expect(isStrengthSatisfied(equivalentMohr(6 / 24, s1, s2), 6)).toBe(false);
  });
});

describe("независими проверки на теориите", () => {
  it("чисто срязване: I → τ; II → (1 + ν)·τ = 1,3·τ; III → 2·τ; IV → √3·τ", () => {
    for (const tau of [0.5, 3, 6, 13.57]) {
      expect(equivalentMaxNormal(tau, -tau)).toBeCloseTo(tau, 12);
      expect(equivalentMaxStrain(NU_STEEL, tau, -tau)).toBeCloseTo(
        1.3 * tau,
        12,
      );
      expect(equivalentTresca(tau, -tau)).toBeCloseTo(2 * tau, 12);
      expect(equivalentMises(tau, -tau)).toBeCloseTo(Math.sqrt(3) * tau, 12);
      expect(beamEquivalentTresca(0, tau)).toBeCloseTo(2 * tau, 12);
      expect(beamEquivalentMises(0, tau)).toBeCloseTo(Math.sqrt(3) * tau, 12);
      expect(beamEquivalentMaxNormal(0, tau)).toBeCloseTo(tau, 12);
      expect(beamEquivalentMaxStrain(0, tau, NU_STEEL)).toBeCloseTo(
        1.3 * tau,
        12,
      );
    }
  });

  it("едноосен опън: всички теории връщат σ", () => {
    for (const sigma of [1, 12, 23.5]) {
      expect(equivalentMaxNormal(sigma, 0)).toBeCloseTo(sigma, 12);
      expect(equivalentMaxStrain(NU_STEEL, sigma, 0)).toBeCloseTo(sigma, 12);
      expect(equivalentTresca(sigma, 0)).toBeCloseTo(sigma, 12);
      expect(equivalentMises(sigma, 0)).toBeCloseTo(sigma, 12);
      expect(equivalentMohr(0.25, sigma, 0)).toBeCloseTo(sigma, 12);
      expect(beamEquivalentMaxNormal(sigma, 0)).toBeCloseTo(sigma, 12);
      expect(beamEquivalentMaxStrain(sigma, 0, NU_STEEL)).toBeCloseTo(
        sigma,
        12,
      );
      expect(beamEquivalentTresca(sigma, 0)).toBeCloseTo(sigma, 12);
      expect(beamEquivalentMises(sigma, 0)).toBeCloseTo(sigma, 12);
    }
  });

  it("едноосен натиск −σ: III и IV връщат σ; I връща 0 (няма опън); Мор връща k·σ", () => {
    expect(equivalentTresca(-12, 0)).toBeCloseTo(12, 12);
    expect(equivalentMises(0, -12)).toBeCloseTo(12, 12);
    expect(equivalentMaxNormal(-12, 0)).toBe(0);
    // k·σ ≤ σ_доп,оп е същото като σ ≤ σ_доп,нат
    expect(equivalentMohr(0.25, -12, 0)).toBeCloseTo(3, 12);
    // II: напречното удължение ν·σ/E
    expect(equivalentMaxStrain(NU_STEEL, -12, 0)).toBeCloseTo(3.6, 12);
    expect(beamEquivalentMaxStrain(-12, 0, NU_STEEL)).toBeCloseTo(3.6, 12);
  });

  it("IV ≤ III за всяко равнинно състояние (мрежа от главни напрежения и мрежа σ–τ)", () => {
    for (let a = -20; a <= 20; a += 2.5) {
      for (let b = -20; b <= 20; b += 2.5) {
        expect(equivalentMises(a, b)).toBeLessThanOrEqual(
          equivalentTresca(a, b) + 1e-12,
        );
        // и не е под III·√3/2
        expect(equivalentMises(a, b)).toBeGreaterThanOrEqual(
          (Math.sqrt(3) / 2) * equivalentTresca(a, b) - 1e-12,
        );
        expect(beamEquivalentMises(a, b)).toBeLessThanOrEqual(
          beamEquivalentTresca(a, b) + 1e-12,
        );
      }
    }
  });

  it("формулите чрез главните напрежения съвпадат с формулите „σ и τ“ за греда", () => {
    for (let sigma = -20; sigma <= 20; sigma += 4) {
      for (let tau = -10; tau <= 10; tau += 2.5) {
        const { s1, s2 } = beamPrincipalStresses(sigma, tau);
        expect(equivalentTresca(s1, s2)).toBeCloseTo(
          beamEquivalentTresca(sigma, tau),
          10,
        );
        expect(equivalentMises(s1, s2)).toBeCloseTo(
          beamEquivalentMises(sigma, tau),
          10,
        );
        expect(equivalentMaxNormal(s1, s2)).toBeCloseTo(
          beamEquivalentMaxNormal(sigma, tau),
          10,
        );
        expect(equivalentMaxStrain(NU_STEEL, s1, s2)).toBeCloseTo(
          beamEquivalentMaxStrain(sigma, tau, NU_STEEL),
          10,
        );
      }
    }
  });

  it("равнинно състояние с еднакви знаци: в III теория участва и нулевото трето напрежение", () => {
    // σ₁ = 10, σ₂ = 6, σ₃ = 0 → σ_max − σ_min = 10 − 0 = 10 (а не 10 − 6 = 4)
    expect(equivalentTresca(10, 6)).toBeCloseTo(10, 12);
    expect(equivalentTresca(-10, -6)).toBeCloseTo(10, 12);
    // IV: √(100 − 60 + 36) = √76 = 8,718
    expect(equivalentMises(10, 6)).toBeCloseTo(8.718, 3);
  });

  it("всестранно еднакъв натиск: III и IV дават нула", () => {
    expect(equivalentTresca(-9, -9, -9)).toBeCloseTo(0, 12);
    expect(equivalentMises(-9, -9, -9)).toBeCloseTo(0, 12);
  });

  it("редът на главните напрежения няма значение", () => {
    expect(equivalentTresca(-2, 7, 3)).toBeCloseTo(
      equivalentTresca(7, 3, -2),
      12,
    );
    expect(equivalentMises(-2, 7, 3)).toBeCloseTo(
      equivalentMises(3, -2, 7),
      12,
    );
    expect(equivalentMohr(0.5, -2, 7, 3)).toBeCloseTo(8, 12);
    expect(equivalentMaxStrain(0.25, -2, 7, 3)).toBeCloseTo(6.75, 12);
  });

  it("Мор с k = 1 съвпада с III теория", () => {
    for (const [a, b] of [
      [5.606, -1.606],
      [10, 6],
      [-3, -8],
    ] as const) {
      expect(equivalentMohr(1, a, b)).toBeCloseTo(equivalentTresca(a, b), 12);
    }
  });

  it("еквивалентен момент: само огъване → |M|; само усукване → |T| (III) и 0,866·|T| (IV)", () => {
    expect(equivalentMoment(-7, 0, "III")).toBeCloseTo(7, 12);
    expect(equivalentMoment(7, 0, "IV")).toBeCloseTo(7, 12);
    expect(equivalentMoment(0, 4, "III")).toBeCloseTo(4, 12);
    expect(equivalentMoment(0, 4, "IV")).toBeCloseTo(3.464, 3);
  });
});

describe("невалидни данни", () => {
  it("отказва безсмислени стойности", () => {
    expect(() => equivalentMaxStrain(0.6, 1, 0)).toThrow();
    expect(() => equivalentMaxStrain(-0.1, 1, 0)).toThrow();
    expect(() => beamEquivalentMaxStrain(1, 1, 0.7)).toThrow();
    expect(() => equivalentMohr(0, 1, -1)).toThrow();
    expect(() => equivalentMohr(1.2, 1, -1)).toThrow();
    expect(() => equivalentTresca(Number.NaN, 0)).toThrow();
    expect(() => equivalentMises(1, Number.POSITIVE_INFINITY)).toThrow();
    expect(() => principalStressesPlane(1, 2, Number.NaN)).toThrow();
    expect(() => beamEquivalentTresca(Number.NaN, 1)).toThrow();
    expect(() => shearYieldStress(0, "IV")).toThrow();
    expect(() => isStrengthSatisfied(5, 0)).toThrow();
    expect(() => circularSectionModulus(0)).toThrow();
    expect(() => circularSectionModulus(8, 8)).toThrow();
    expect(() => shaftEquivalentStress(3, 4, 0, "III")).toThrow();
    expect(() => shaftDiameter(3, 4, 0, "III")).toThrow();
    expect(() => shaftDiameter(0, 0, 10, "III")).toThrow();
  });
});
