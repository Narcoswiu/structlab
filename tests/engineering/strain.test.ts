import { describe, expect, it } from "vitest";
import { solveBar } from "@/lib/engineering/axial";
import {
  E_STEEL,
  G_STEEL,
  NU_STEEL,
  bulkModulus,
  confinedCompression,
  hookeStrains,
  hookeStresses,
  lateralStrain,
  planeStrainSigmaZ,
  planeStressStrains,
  planeStressStresses,
  poissonFromModuli,
  shearModulus,
  shearStrain,
  sizeChange,
  strainAtAngle,
  volumetricStrain,
  volumetricStrainFromStress,
} from "@/lib/engineering/strain";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над проверката.
// Числата са тези, които се четат в Глава 12 „Деформирано състояние. Обобщен закон на Хук“.
// Деформациите се сравняват в единици 10⁻⁴ (умножени по 10 000).

const E = E_STEEL; // 21 000 kN/cm²
const NU = NU_STEEL; // 0,3

/** деформация в единици 10⁻⁴, с три знака след запетаята */
const e4 = (eps: number) => (eps * 1e4).toFixed(3);

describe("материални константи", () => {
  it("стомана: E = 21 000, ν = 0,3, G по нормата 8100 kN/cm²", () => {
    expect(E_STEEL).toBe(21000);
    expect(NU_STEEL).toBe(0.3);
    expect(G_STEEL).toBe(8100);
  });

  it("G = E/(2(1+ν)) = 21 000/2,6 = 8077 kN/cm²; нормата закръгля на 8100", () => {
    // 21 000 / 2,6 = 8076,92
    expect(shearModulus(E, NU).toFixed(0)).toBe("8077");
    // разлика спрямо 8100: 23,08/8100 = 0,28 % ≈ 0,3 %
    expect(((G_STEEL / shearModulus(E, NU) - 1) * 100).toFixed(1)).toBe("0.3");
  });

  it("обемен модул K = E/(3(1−2ν)) = 21 000/1,2 = 17 500 kN/cm²", () => {
    expect(bulkModulus(E, NU)).toBeCloseTo(17500, 8);
  });

  it("привидни модули: E/(1−ν²) = 23 077; E/(1−ν) = 30 000; E(1−ν)/((1+ν)(1−2ν)) = 28 269", () => {
    // 21 000 / 0,91 = 23 076,9
    expect((E / (1 - NU * NU)).toFixed(0)).toBe("23077");
    // 21 000 / 0,7 = 30 000
    expect(E / (1 - NU)).toBeCloseTo(30000, 8);
    // 21 000·0,7 / (1,3·0,4) = 14 700 / 0,52 = 28 269,2
    expect(((E * (1 - NU)) / ((1 + NU) * (1 - 2 * NU))).toFixed(0)).toBe(
      "28269",
    );
  });

  it("въпрос П5: E = 3000, G = 1250 → ν = 3000/2500 − 1 = 0,2 (и обратно)", () => {
    expect(poissonFromModuli(3000, 1250)).toBeCloseTo(0.2, 12);
    expect(shearModulus(3000, 0.2)).toBeCloseTo(1250, 9);
  });
});

describe("напречна деформация", () => {
  it("въпрос Л1: ε = 0,001 → ε′ = −0,3·0,001 = −0,0003", () => {
    expect(lateralStrain(0.001, NU)).toBeCloseTo(-0.0003, 12);
  });
});

describe("Пример 1 – стоманена плоча 120 × 60 × 1,2 cm, σ_x = 14, σ_y = 7 kN/cm²", () => {
  const eps = planeStressStrains(14, 7, E, NU);

  it("деформации: 5,667; 1,333; −3,000 (·10⁻⁴)", () => {
    // ε_x = (14 − 0,3·7)/21 000 = 11,9/21 000 = 5,667·10⁻⁴
    expect(e4(eps.x)).toBe("5.667");
    // ε_y = (7 − 0,3·14)/21 000 = 2,8/21 000 = 1,333·10⁻⁴
    expect(e4(eps.y)).toBe("1.333");
    // ε_z = −0,3·21/21 000 = −3,0·10⁻⁴ (точно)
    expect(eps.z).toBeCloseTo(-3e-4, 15);
    // в „Леко“ същите числа са записани като 0,000567 и 0,000133
    expect(eps.x.toFixed(6)).toBe("0.000567");
    expect(eps.y.toFixed(6)).toBe("0.000133");
  });

  it("промяна на размерите: +0,68 mm; +0,08 mm; −0,0036 mm", () => {
    // Δa = 120·5,667·10⁻⁴ = 0,0680 cm
    expect(sizeChange(120, eps.x)).toBeCloseTo(0.068, 10);
    // Δb = 60·1,333·10⁻⁴ = 0,0080 cm
    expect(sizeChange(60, eps.y)).toBeCloseTo(0.008, 10);
    // Δt = 12 mm·(−3,0·10⁻⁴) = −0,0036 mm
    expect(sizeChange(12, eps.z)).toBeCloseTo(-0.0036, 10);
  });

  it("закръглените междинни стойности дават отпечатаните резултати", () => {
    expect((120 * 5.667e-4 * 10).toFixed(2)).toBe("0.68");
    expect((60 * 1.333e-4 * 10).toFixed(2)).toBe("0.08");
    expect((120 * 0.000567 * 10).toFixed(2)).toBe("0.68");
    expect((60 * 0.000133 * 10).toFixed(2)).toBe("0.08");
  });

  it("обемна деформация 4,0·10⁻⁴ по два пътя; ΔV = 3,456 cm³", () => {
    // 5,667 + 1,333 − 3,0 = 4,0
    expect(volumetricStrain(eps)).toBeCloseTo(4e-4, 15);
    // (1 − 0,6)·(14 + 7)/21 000 = 0,4·21/21 000 = 4,0·10⁻⁴
    expect(
      volumetricStrainFromStress({ x: 14, y: 7, z: 0 }, E, NU),
    ).toBeCloseTo(4e-4, 15);
    // V = 120·60·1,2 = 8640 cm³; 4,0·10⁻⁴·8640 = 3,456 cm³
    expect(volumetricStrain(eps) * 120 * 60 * 1.2).toBeCloseTo(3.456, 9);
  });

  it("само σ_x: ε_x = 14/21 000 = 6,667·10⁻⁴, Δa = 0,80 mm", () => {
    const single = planeStressStrains(14, 0, E, NU);
    expect(e4(single.x)).toBe("6.667");
    expect(sizeChange(120, single.x)).toBeCloseTo(0.08, 10);
  });

  it("обратният закон връща 14 и 7 kN/cm²", () => {
    const s = planeStressStresses(eps.x, eps.y, E, NU);
    expect(s.x).toBeCloseTo(14, 10);
    expect(s.y).toBeCloseTo(7, 10);
    // с отпечатаните числа: 23 077·(5,667 + 0,3·1,333)·10⁻⁴ = 23 077·6,067·10⁻⁴ = 14,0
    expect((5.667 + 0.3 * 1.333).toFixed(3)).toBe("6.067");
    expect((23077 * 6.067e-4).toFixed(1)).toBe("14.0");
    // 23 077·(1,333 + 0,3·5,667)·10⁻⁴ = 23 077·3,033·10⁻⁴ = 7,0
    expect((1.333 + 0.3 * 5.667).toFixed(3)).toBe("3.033");
    expect((23077 * 3.033e-4).toFixed(1)).toBe("7.0");
  });

  it("загадката в „Подробно“: E·ε_y = 21 000·1,333·10⁻⁴ = 2,8 kN/cm², а не 7", () => {
    expect(E * eps.y).toBeCloseTo(2.8, 10);
  });
});

describe("„Леко“ – същата плоча, опъната по x и спряна по y", () => {
  const r = confinedCompression(14, E, NU, 1);

  it("σ_y = 0,3·14 = 4,2 kN/cm²; ε_x = 12,74/21 000 = 0,000607; Δa = 0,73 mm", () => {
    expect(r.lateralStress).toBeCloseTo(4.2, 12);
    // 14 − 0,3·4,2 = 12,74
    expect(14 - 0.3 * 4.2).toBeCloseTo(12.74, 12);
    expect(r.axialStrain.toFixed(6)).toBe("0.000607");
    expect((sizeChange(120, r.axialStrain) * 10).toFixed(2)).toBe("0.73");
    expect((120 * 0.000607 * 10).toFixed(2)).toBe("0.73");
  });

  it("проверка: деформацията по y наистина е нула", () => {
    const eps = planeStressStrains(14, r.lateralStress, E, NU);
    expect(eps.y).toBeCloseTo(0, 15);
    expect(eps.x).toBeCloseTo(r.axialStrain, 15);
  });
});

describe("Пример 2 – стоманен куб 10 cm в корав канал, σ_y = −12 kN/cm²", () => {
  const r = confinedCompression(-12, E, NU, 1);

  it("σ_x = −3,6; ε_y = −10,92/21 000 = −5,2·10⁻⁴; ε_z = 4,68/21 000 = 2,229·10⁻⁴", () => {
    expect(r.lateralStress).toBeCloseTo(-3.6, 12);
    // −12 − 0,3·(−3,6) = −10,92
    expect(r.axialStrain).toBeCloseTo(-5.2e-4, 15);
    // −0,3·(−3,6 − 12) = 4,68
    expect(e4(r.freeLateralStrain)).toBe("2.229");
  });

  it("сили и премествания: 1200 kN; 360 kN; −0,052 mm; +0,022 mm", () => {
    expect(12 * 10 * 10).toBe(1200);
    expect(Math.abs(r.lateralStress) * 10 * 10).toBeCloseTo(360, 9);
    expect(sizeChange(10, r.axialStrain) * 10).toBeCloseTo(-0.052, 12);
    expect((sizeChange(10, r.freeLateralStrain) * 10).toFixed(3)).toBe("0.022");
    expect((10 * 2.229e-4 * 10).toFixed(3)).toBe("0.022");
  });

  it("свободен куб: −12/21 000 = −5,714·10⁻⁴ → 0,057 mm; отношение 0,91", () => {
    const free = hookeStrains({ x: 0, y: -12, z: 0 }, E, NU);
    expect(e4(free.y)).toBe("-5.714");
    expect((sizeChange(10, free.y) * 10).toFixed(3)).toBe("-0.057");
    // 5,2 / 5,714 = 0,91 = 1 − ν²
    expect(r.axialStrain / free.y).toBeCloseTo(0.91, 12);
  });

  it("независима проверка с пълния закон и с привидния модул", () => {
    const eps = hookeStrains({ x: -3.6, y: -12, z: 0 }, E, NU);
    expect(eps.x).toBeCloseTo(0, 15);
    expect(eps.y).toBeCloseTo(r.axialStrain, 15);
    expect(eps.z).toBeCloseTo(r.freeLateralStrain, 15);
    // −12 / 23 077 = −5,2·10⁻⁴
    expect(-12 / (E / (1 - NU * NU))).toBeCloseTo(-5.2e-4, 15);
    expect(e4(-12 / 23077)).toBe("-5.200");
    // θ = 0 − 5,2 + 2,229 = −2,971; (1 − 0,6)·(−15,6)/21 000 = −2,971·10⁻⁴
    expect(e4(volumetricStrain(eps))).toBe("-2.971");
    expect(
      e4(volumetricStrainFromStress({ x: -3.6, y: -12, z: 0 }, E, NU)),
    ).toBe("-2.971");
  });

  it("затворено гнездо: σ_x = σ_z = −5,143; ε_y = −8,914/21 000 = −4,245·10⁻⁴", () => {
    const full = confinedCompression(-12, E, NU, 2);
    // 0,3·(−12)/0,7 = −5,143
    expect(full.lateralStress.toFixed(3)).toBe("-5.143");
    expect(e4(full.axialStrain)).toBe("-4.245");
    // с отпечатаните числа: 2·0,3·5,143 = 3,086; −12 + 3,086 = −8,914
    expect((2 * 0.3 * 5.143).toFixed(3)).toBe("3.086");
    expect(e4(-8.914 / 21000)).toBe("-4.245");
    // привиден модул 28 269: −12/28 269 = −4,245·10⁻⁴
    expect(e4(-12 / 28269)).toBe("-4.245");
    const eps = hookeStrains(
      { x: full.lateralStress, y: -12, z: full.lateralStress },
      E,
      NU,
    );
    expect(eps.x).toBeCloseTo(0, 15);
    expect(eps.z).toBeCloseTo(0, 15);
    expect(eps.y).toBeCloseTo(full.axialStrain, 15);
  });
});

describe("Пример 3 – измерени ε_x = 4,0·10⁻⁴ и ε_y = −1,0·10⁻⁴", () => {
  const s = planeStressStresses(4e-4, -1e-4, E, NU);

  it("σ_x = 23 077·3,7·10⁻⁴ = 8,538; σ_y = 23 077·0,2·10⁻⁴ = 0,462 kN/cm²", () => {
    expect(s.x.toFixed(3)).toBe("8.538");
    expect(s.y.toFixed(3)).toBe("0.462");
    expect((23077 * 3.7e-4).toFixed(3)).toBe("8.538");
    expect((23077 * 0.2e-4).toFixed(3)).toBe("0.462");
    // в MPa: 85,4 и 4,6
    expect((s.x * 10).toFixed(1)).toBe("85.4");
    expect((s.y * 10).toFixed(1)).toBe("4.6");
  });

  it("ε_z = −0,3·9,0/21 000 = −1,286·10⁻⁴ по два пътя", () => {
    expect(s.x + s.y).toBeCloseTo(9, 10);
    const eps = planeStressStrains(s.x, s.y, E, NU);
    expect(e4(eps.z)).toBe("-1.286");
    // −ν·(ε_x + ε_y)/(1 − ν) = −0,3·3,0/0,7 = −1,286
    expect(e4((-NU * (4e-4 - 1e-4)) / (1 - NU))).toBe("-1.286");
    // с отпечатаните числа: 8,538 + 0,462 = 9,000
    expect((8.538 + 0.462).toFixed(3)).toBe("9.000");
  });

  it("проверка: правият закон връща измерените деформации", () => {
    const eps = planeStressStrains(s.x, s.y, E, NU);
    expect(eps.x).toBeCloseTo(4e-4, 15);
    expect(eps.y).toBeCloseTo(-1e-4, 15);
    // с отпечатаните числа: 8,538 − 0,3·0,462 = 8,399; 8,399/21 000 = 4,0·10⁻⁴
    expect((8.538 - 0.3 * 0.462).toFixed(3)).toBe("8.399");
    expect(e4(8.399 / 21000).slice(0, 3)).toBe("4.0");
  });

  it("грешният път: E·ε_x = 21 000·4,0·10⁻⁴ = 8,4 и E·ε_y = −2,1 kN/cm²", () => {
    expect(E * 4e-4).toBeCloseTo(8.4, 10);
    // и E·ε_y = 21 000·(−1,0·10⁻⁴) = −2,1 kN/cm² – с грешен знак
    expect(E * -1e-4).toBeCloseTo(-2.1, 10);
  });
});

describe("Пример 4 – чисто срязване, a = 20 cm, τ = 8,1 kN/cm²", () => {
  it("γ = 8,1/8100 = 0,001 rad = 0,0573°; плъзгане 0,2 mm", () => {
    const gamma = shearStrain(8.1, G_STEEL);
    expect(gamma).toBeCloseTo(0.001, 15);
    expect(((gamma * 180) / Math.PI).toFixed(4)).toBe("0.0573");
    expect(sizeChange(20, gamma) * 10).toBeCloseTo(0.2, 12);
  });

  it("диагонал 28,28 cm; ε_d = γ/2 = 5,0·10⁻⁴; Δd = 0,14 mm", () => {
    expect((20 * Math.SQRT2).toFixed(2)).toBe("28.28");
    expect((28.28 * 5e-4).toFixed(4)).toBe("0.0141");
    expect((28.28 * 5e-4 * 10).toFixed(2)).toBe("0.14");
  });

  it("с главните напрежения: ε_d = 8,1·1,3/21 000 = 5,014·10⁻⁴; γ = 8,1/8077 = 1,003·10⁻³", () => {
    const eps = planeStressStrains(8.1, -8.1, E, NU);
    expect(e4(eps.x)).toBe("5.014");
    expect((shearStrain(8.1, 8077) * 1e3).toFixed(3)).toBe("1.003");
    expect(e4(shearStrain(8.1, shearModulus(E, NU)) / 2)).toBe("5.014");
  });
});

describe("въпроси „Провери се“", () => {
  it("Л2: σ_x = σ_y = 10,5 → ε_x = 7,35/21 000 = 0,00035", () => {
    // 10,5 − 0,3·10,5 = 7,35
    expect(planeStressStrains(10.5, 10.5, E, NU).x).toBeCloseTo(0.00035, 15);
  });

  it("Л4: τ = 4,05, G = 8100 → γ = 0,0005 rad", () => {
    expect(shearStrain(4.05, G_STEEL)).toBeCloseTo(0.0005, 15);
  });

  it("П1: σ_x = 10, σ_y = −5 → 5,476; −3,810; −0,714; θ = 0,952 (·10⁻⁴)", () => {
    const eps = planeStressStrains(10, -5, E, NU);
    // (10 + 1,5)/21 000 = 11,5/21 000
    expect(e4(eps.x)).toBe("5.476");
    // (−5 − 3)/21 000 = −8/21 000
    expect(e4(eps.y)).toBe("-3.810");
    // −0,3·5/21 000 = −1,5/21 000
    expect(e4(eps.z)).toBe("-0.714");
    // 0,4·5/21 000 = 2/21 000
    expect(e4(volumetricStrain(eps))).toBe("0.952");
    // сборът на отпечатаните числа: 5,476 − 3,810 − 0,714 = 0,952
    expect((5.476 - 3.81 - 0.714).toFixed(3)).toBe("0.952");
  });

  it("П2: ε_x = ε_y = 3,0·10⁻⁴ → σ = 21 000·3,0·10⁻⁴/0,7 = 9,0 kN/cm²", () => {
    const s = planeStressStresses(3e-4, 3e-4, E, NU);
    expect(s.x).toBeCloseTo(9, 10);
    expect(s.y).toBeCloseTo(9, 10);
  });

  it("П3: всестранен натиск 10 kN/cm² → θ = −10/17 500 = −5,714·10⁻⁴", () => {
    const stress = { x: -10, y: -10, z: -10 };
    // −0,4·30/21 000 = −12/21 000
    expect(e4(volumetricStrainFromStress(stress, E, NU))).toBe("-5.714");
    expect(e4(-10 / bulkModulus(E, NU))).toBe("-5.714");
    expect(e4(volumetricStrain(hookeStrains(stress, E, NU)))).toBe("-5.714");
  });

  it("П4: равнинно деформирано, σ_x = 8, σ_y = 2 → σ_z = 0,3·10 = 3 kN/cm²", () => {
    const sz = planeStrainSigmaZ(8, 2, NU);
    expect(sz).toBeCloseTo(3, 12);
    expect(hookeStrains({ x: 8, y: 2, z: sz }, E, NU).z).toBeCloseTo(0, 15);
  });
});

describe("независими проверки на теорията", () => {
  const cases: { x: number; y: number; z: number }[] = [
    { x: 14, y: 7, z: 0 },
    { x: 10, y: -5, z: 3 },
    { x: -12, y: -3.6, z: 0 },
    { x: -4, y: 9, z: -15 },
  ];

  it("обратният обобщен закон връща напреженията", () => {
    for (const stress of cases) {
      for (const nu of [0, 0.2, 0.3, 0.45]) {
        const back = hookeStresses(hookeStrains(stress, E, nu), E, nu);
        expect(back.x).toBeCloseTo(stress.x, 9);
        expect(back.y).toBeCloseTo(stress.y, 9);
        expect(back.z).toBeCloseTo(stress.z, 9);
      }
    }
  });

  it("θ = ε_x + ε_y + ε_z = (1 − 2ν)·(σ_x + σ_y + σ_z)/E", () => {
    for (const stress of cases) {
      for (const nu of [0, 0.2, 0.3, 0.5]) {
        const eps = hookeStrains(stress, E, nu);
        expect(volumetricStrain(eps)).toBeCloseTo(
          volumetricStrainFromStress(stress, E, nu),
          15,
        );
        expect(volumetricStrain(eps)).toBeCloseTo(
          ((1 - 2 * nu) * (stress.x + stress.y + stress.z)) / E,
          15,
        );
      }
    }
  });

  it("θ съвпада с действителната промяна на обема на паралелепипед (до малки от втори ред)", () => {
    const eps = planeStressStrains(14, 7, E, NU);
    const exact = (1 + eps.x) * (1 + eps.y) * (1 + eps.z) - 1;
    // разликата е от порядъка на ε² ≈ 10⁻⁷
    expect(Math.abs(exact - volumetricStrain(eps))).toBeLessThan(2e-7);
  });

  it("ν = 0,5: обемът не се променя при никакви напрежения", () => {
    for (const stress of cases) {
      expect(volumetricStrain(hookeStrains(stress, E, 0.5))).toBeCloseTo(0, 15);
    }
  });

  it("чисто срязване като σ₁ = τ, σ₂ = −τ: ε на диагонала = γ/2 точно при G = E/(2(1+ν))", () => {
    for (const nu of [0, 0.2, 0.3, 0.5]) {
      const tau = 6;
      // физика: деформация по опънатия диагонал от обобщения закон
      const diagonal = planeStressStrains(tau, -tau, E, nu);
      expect(diagonal.x).toBeCloseTo((tau * (1 + nu)) / E, 15);
      expect(diagonal.y).toBeCloseTo(-diagonal.x, 15);
      // геометрия: γ = τ/G; завъртане на 45° дава ε = γ/2
      const gamma = shearStrain(tau, shearModulus(E, nu));
      expect(strainAtAngle(0, 0, gamma, 45)).toBeCloseTo(gamma / 2, 15);
      expect(strainAtAngle(0, 0, gamma, 135)).toBeCloseTo(-gamma / 2, 15);
      expect(diagonal.x).toBeCloseTo(gamma / 2, 15);
    }
  });

  it("геометрия без формула: диагоналът на квадрат, срязан на ъгъл γ, се удължава с γ/2", () => {
    const gamma = 1e-6;
    // връх (0,0) → (0,0); връх (1,1) → (1 + γ, 1)
    const stretched = Math.hypot(1 + gamma, 1) / Math.SQRT2 - 1;
    // връх (1,0) → (1,0); връх (0,1) → (γ, 1)
    const shortened = Math.hypot(1 - gamma, 1) / Math.SQRT2 - 1;
    expect(stretched / gamma).toBeCloseTo(0.5, 5);
    expect(shortened / gamma).toBeCloseTo(-0.5, 5);
  });

  it("strainAtAngle: по осите връща ε_x и ε_y", () => {
    expect(strainAtAngle(3e-4, -1e-4, 2e-4, 0)).toBeCloseTo(3e-4, 15);
    expect(strainAtAngle(3e-4, -1e-4, 2e-4, 90)).toBeCloseTo(-1e-4, 15);
  });

  it("едноосният случай се свежда до формулите от Глава 3", () => {
    // участък 1 от примера в Глава 3: N = 50 kN, A = 4 cm², l = 100 cm
    const bar = solveBar([{ length: 100, area: 4, E }], [50]);
    const sigma = bar.sigma[0]!;
    expect(sigma).toBeCloseTo(12.5, 12);
    const eps = hookeStrains({ x: sigma, y: 0, z: 0 }, E, NU);
    // ε = σ/E и Δl = ε·l = N·l/(E·A) = 0,0595 cm
    expect(eps.x).toBeCloseTo(sigma / E, 15);
    expect(sizeChange(100, eps.x)).toBeCloseTo(bar.deltaL[0]!, 15);
    expect(sizeChange(100, eps.x).toFixed(4)).toBe("0.0595");
    // ε′ = −ν·ε в двете напречни посоки
    expect(eps.y).toBeCloseTo(lateralStrain(eps.x, NU), 15);
    expect(eps.z).toBeCloseTo(lateralStrain(eps.x, NU), 15);
  });

  it("равнинно деформирано състояние: σ_z = ν(σ_x + σ_y) прави ε_z = 0", () => {
    for (const nu of [0, 0.2, 0.3, 0.5]) {
      const sz = planeStrainSigmaZ(8, -3, nu);
      expect(hookeStrains({ x: 8, y: -3, z: sz }, E, nu).z).toBeCloseTo(0, 15);
    }
  });
});

describe("проверка на входа", () => {
  it("отхвърля невалидни модули и коефициент на Поасон", () => {
    expect(() => shearModulus(0, 0.3)).toThrow();
    expect(() => shearModulus(21000, 0.6)).toThrow();
    expect(() => shearModulus(21000, -1)).toThrow();
    expect(() => hookeStrains({ x: 1, y: 0, z: 0 }, -5, 0.3)).toThrow();
    expect(() => hookeStresses({ x: 1, y: 0, z: 0 }, 21000, 0.5)).toThrow();
    expect(() => bulkModulus(21000, 0.5)).toThrow();
    expect(() => shearStrain(1, 0)).toThrow();
    expect(() => sizeChange(0, 0.001)).toThrow();
    expect(() => poissonFromModuli(21000, 5000)).toThrow();
    expect(() => confinedCompression(-12, 21000, 0.5, 2)).toThrow();
    expect(() => planeStrainSigmaZ(1, 1, 0.7)).toThrow();
  });
});
