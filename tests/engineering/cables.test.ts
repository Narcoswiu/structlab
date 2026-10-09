import { describe, expect, it } from "vitest";
import {
  cableElongation,
  cableForce,
  cableForceAt,
  cableLengthApprox,
  cableLengthExact,
  cableStress,
  catenaryHorizontalForce,
  catenaryLength,
  catenaryMaxForce,
  catenaryOrdinate,
  catenaryParameter,
  horizontalForce,
  inclinedCable,
  inclinedCableElevation,
  maxCableForce,
  parabolaElongation,
  parabolaOrdinate,
  parabolaSlope,
  pointLoadCable,
  requiredCableArea,
  sagChangeFromLengthChange,
  sagFromHorizontalForce,
  simpleBeamMoment,
  simpleBeamShear,
} from "@/lib/engineering/cables";

// Всички очаквани стойности са сметнати на ръка и са записани в коментара над теста.
// Основен пример на главата: l = 20 m, f = 2 m, q = 3 kN/m (по хоризонталата).

const L = 20; // m
const F = 2; // m
const Q = 3; // kN/m
const E_CABLE = 16000; // kN/cm² – зададен в условието на задачата
const A_CABLE = 2.5; // cm² – приета площ

/** Числено интегриране по правилото на средните точки. */
function integrate(fn: (x: number) => number, from: number, to: number) {
  const n = 20000;
  const step = (to - from) / n;
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += fn(from + (i + 0.5) * step);
  return sum * step;
}

describe("форма на въжето при равномерен товар", () => {
  it("параболата минава през опорите и има стрелка f в средата", () => {
    expect(parabolaOrdinate(L, F, 0)).toBe(0);
    expect(parabolaOrdinate(L, F, L)).toBe(0);
    expect(parabolaOrdinate(L, F, L / 2)).toBeCloseTo(F, 12);
  });

  it("x = 5 m: y = 4·2·5·15/400 = 1,5 m", () => {
    expect(parabolaOrdinate(L, F, 5)).toBeCloseTo(1.5, 12);
  });

  it("наклон в опората: tg α₀ = 4·f/l = 0,4 → α₀ = 21,80°; в средата – 0", () => {
    expect(parabolaSlope(L, F, 0)).toBeCloseTo(0.4, 12);
    expect(parabolaSlope(L, F, L)).toBeCloseTo(-0.4, 12);
    expect(parabolaSlope(L, F, L / 2)).toBeCloseTo(0, 12);
    expect((Math.atan(0.4) * 180) / Math.PI).toBeCloseTo(21.8, 2);
  });

  it("моментно равновесие на всяка отрязана част: H·y(x) = M⁰(x)", () => {
    const H = horizontalForce(Q, L, F);
    for (let x = 0; x <= L; x += 0.5) {
      // лява част, моменти спрямо точката на разреза: V_A·x − q·x²/2 − H·y = 0
      const VA = (Q * L) / 2;
      const y = parabolaOrdinate(L, F, x);
      expect(VA * x - (Q * x * x) / 2 - H * y).toBeCloseTo(0, 9);
      expect(H * y).toBeCloseTo(simpleBeamMoment(Q, L, x), 9);
    }
  });

  it("x = 5 m: M⁰ = 30·5 − 3·5²/2 = 112,5 kN·m = 75·1,5", () => {
    expect(simpleBeamMoment(Q, L, 5)).toBeCloseTo(112.5, 12);
    expect(horizontalForce(Q, L, F) * parabolaOrdinate(L, F, 5)).toBeCloseTo(
      112.5,
      9,
    );
  });

  it("вертикално равновесие на отрязаната част: H·y′(x) = V_A − q·x = Q⁰(x)", () => {
    const H = horizontalForce(Q, L, F);
    for (let x = 0; x <= L; x += 1) {
      const vertical = H * parabolaSlope(L, F, x);
      expect(vertical).toBeCloseTo((Q * L) / 2 - Q * x, 9);
      expect(vertical).toBeCloseTo(simpleBeamShear(Q, L, x), 9);
    }
  });
});

describe("разпор и сила във въжето", () => {
  it("H = q·l²/(8·f) = 3·400/16 = 75 kN; H·f = M⁰_max = 150 kN·m", () => {
    expect(horizontalForce(Q, L, F)).toBeCloseTo(75, 12);
    expect(horizontalForce(Q, L, F) * F).toBeCloseTo(
      simpleBeamMoment(Q, L, L / 2),
      9,
    );
    expect(simpleBeamMoment(Q, L, L / 2)).toBeCloseTo(150, 12);
  });

  it("обратната задача: f = q·l²/(8·H) = 1200/600 = 2 m", () => {
    expect(sagFromHorizontalForce(Q, L, 75)).toBeCloseTo(2, 12);
  });

  it("N_max = √(75² + 30²) = √6525 = 80,78 kN – от съставките", () => {
    expect(maxCableForce(Q, L, F)).toBeCloseTo(80.78, 2);
    expect(maxCableForce(Q, L, F)).toBeCloseTo(Math.sqrt(6525), 9);
    expect(cableForce(75, 30)).toBeCloseTo(maxCableForce(Q, L, F), 12);
    // същото чрез наклона: N = H·√(1 + tg²α₀) = 75·√1,16
    expect(75 * Math.sqrt(1 + 0.4 ** 2)).toBeCloseTo(maxCableForce(Q, L, F), 9);
  });

  it("в средата N = H = 75 kN; при x = 5 m: √(75² + 15²) = 76,49 kN", () => {
    expect(cableForceAt(Q, L, F, L / 2)).toBeCloseTo(75, 12);
    expect(cableForceAt(Q, L, F, 5)).toBeCloseTo(76.49, 2);
    expect(cableForceAt(Q, L, F, 0)).toBeCloseTo(maxCableForce(Q, L, F), 12);
    expect(cableForceAt(Q, L, F, L)).toBeCloseTo(maxCableForce(Q, L, F), 12);
  });

  it("двойно по-малка стрелка → двойно по-голям разпор: f = 1 m → 150 kN, N_max = 153,0 kN", () => {
    // √(150² + 30²) = √23400 = 152,97; 152,97/60 = 2,55 пъти целия товар
    expect(horizontalForce(Q, L, 1)).toBeCloseTo(150, 12);
    expect(maxCableForce(Q, L, 1)).toBeCloseTo(152.97, 2);
    expect(maxCableForce(Q, L, 1) / (Q * L)).toBeCloseTo(2.55, 2);
  });

  it("оразмеряване: A ≥ 80,78/40 = 2,02 cm²; при A = 2,5 cm² σ = 32,31 kN/cm²", () => {
    const N = maxCableForce(Q, L, F);
    expect(requiredCableArea(N, 40)).toBeCloseTo(2.02, 2);
    expect(cableStress(N, A_CABLE)).toBeCloseTo(32.31, 2);
    // с отпечатаната закръглена сила: 80,78/40 = 2,0195; 80,78/2,5 = 32,312
    expect(80.78 / 40).toBeCloseTo(2.02, 2);
    expect(80.78 / 2.5).toBeCloseTo(32.31, 2);
  });
});

describe("дължина на въжето", () => {
  it("приближение: L ≈ 20·(1 + 8·4/(3·400)) = 20·1,02667 = 20,533 m", () => {
    expect(cableLengthApprox(L, F)).toBeCloseTo(20.533, 3);
  });

  it("точно: a = 0,4; L = 10·(√1,16 + arsinh(0,4)/0,4) = 10·(1,07703 + 0,97509) = 20,521 m", () => {
    expect(Math.sqrt(1.16)).toBeCloseTo(1.07703, 5);
    expect(Math.asinh(0.4)).toBeCloseTo(0.39004, 5);
    expect(Math.asinh(0.4) / 0.4).toBeCloseTo(0.97509, 5);
    expect(cableLengthExact(L, F)).toBeCloseTo(20.521, 3);
  });

  it("численото интегриране на √(1 + y′²) потвърждава точната формула", () => {
    const numeric = integrate(
      (x) => Math.sqrt(1 + parabolaSlope(L, F, x) ** 2),
      0,
      L,
    );
    expect(numeric).toBeCloseTo(cableLengthExact(L, F), 7);
  });

  it("грешка на приближението при f/l = 1/10: 0,012 m = 0,06 %", () => {
    const error = cableLengthApprox(L, F) - cableLengthExact(L, F);
    expect(error).toBeCloseTo(0.012, 3);
    expect((error / cableLengthExact(L, F)) * 100).toBeCloseTo(0.06, 2);
  });

  it("грешката расте със стрелката: 0,004 %; 0,06 %; 0,77 %; 1,64 %", () => {
    const errorPercent = (ratio: number) =>
      (cableLengthApprox(L, L * ratio) / cableLengthExact(L, L * ratio) - 1) *
      100;
    expect(errorPercent(1 / 20)).toBeCloseTo(0.004, 3);
    expect(errorPercent(1 / 10)).toBeCloseTo(0.06, 2);
    expect(errorPercent(1 / 5)).toBeCloseTo(0.77, 2);
    expect(errorPercent(1 / 4)).toBeCloseTo(1.64, 2);
  });

  it("∫y′² dx = 16·f²/(3·l) – основата на приближението", () => {
    const numeric = integrate((x) => parabolaSlope(L, F, x) ** 2, 0, L);
    expect(numeric).toBeCloseTo((16 * F * F) / (3 * L), 7);
  });
});

describe("удължение на въжето", () => {
  it("ΔL ≈ H·L/(E·A) = 75·2053,3/(16000·2,5) = 3,85 cm", () => {
    const dL = cableElongation(75, cableLengthApprox(L, F), E_CABLE, A_CABLE);
    expect(dL * 100).toBeCloseTo(3.85, 2);
    // с отпечатаната дължина 2053,3 cm
    expect((75 * 2053.3) / (16000 * 2.5)).toBeCloseTo(3.85, 2);
  });

  it("с променливата сила: ΔL = 75·2000·(1 + 16·4/1200)/40000 = 3,95 cm", () => {
    const dL = parabolaElongation(75, L, F, E_CABLE, A_CABLE);
    expect(dL * 100).toBeCloseTo(3.95, 2);
    expect(1 + (16 * 4) / 1200).toBeCloseTo(1.05333, 5);
    // независимо: числен интеграл на N ds = H·(1 + y′²) dx
    const numeric =
      integrate((x) => 75 * (1 + parabolaSlope(L, F, x) ** 2), 0, L) /
      (E_CABLE * A_CABLE);
    expect(numeric).toBeCloseTo(dL, 9);
  });

  it("оценка за стрелката: Δf ≈ 3·20/(16·2)·3,85 = 1,875·3,85 = 7,22 cm", () => {
    expect(sagChangeFromLengthChange(L, F, 1)).toBeCloseTo(1.875, 12);
    expect(sagChangeFromLengthChange(L, F, 3.85)).toBeCloseTo(7.22, 2);
  });

  it("оценката следва от формулата за дължината (малко нарастване на f)", () => {
    const df = 0.001;
    const dL = cableLengthApprox(L, F + df) - cableLengthApprox(L, F);
    expect(sagChangeFromLengthChange(L, F, dL)).toBeCloseTo(df, 5);
  });
});

describe("въже със съсредоточена сила (Пример 3)", () => {
  // l = 12 m, F = 18 kN на a = 4 m, стрелка под силата 1,5 m
  const cable = pointLoadCable(18, 4, 12, 1.5);

  it("A⁰ = 18·8/12 = 12 kN; B⁰ = 6 kN; M⁰ = 12·4 = 48 kN·m; H = 48/1,5 = 32 kN", () => {
    expect(cable.VA).toBeCloseTo(12, 12);
    expect(cable.VB).toBeCloseTo(6, 12);
    expect(cable.M0).toBeCloseTo(48, 12);
    expect(cable.H).toBeCloseTo(32, 12);
  });

  it("N₁ = √(32² + 12²) = √1168 = 34,18 kN; N₂ = √(32² + 6²) = √1060 = 32,56 kN", () => {
    expect(cable.T1).toBeCloseTo(34.18, 2);
    expect(cable.T2).toBeCloseTo(32.56, 2);
  });

  it("равновесие на възела под силата – от геометрията на двата клона", () => {
    // tg α₁ = 1,5/4 = 0,375; tg α₂ = 1,5/8 = 0,1875
    const alpha1 = Math.atan(1.5 / 4);
    const alpha2 = Math.atan(1.5 / 8);
    // ΣX: хоризонталните съставки на двата клона са равни
    expect(cable.T1 * Math.cos(alpha1)).toBeCloseTo(
      cable.T2 * Math.cos(alpha2),
      9,
    );
    // ΣY: вертикалните съставки носят силата: 32·0,375 + 32·0,1875 = 12 + 6 = 18
    expect(
      cable.T1 * Math.sin(alpha1) + cable.T2 * Math.sin(alpha2),
    ).toBeCloseTo(18, 9);
    expect(32 * 0.375).toBeCloseTo(12, 12);
    expect(32 * 0.1875).toBeCloseTo(6, 12);
  });

  it("простирът от „Леко“: l = 4 m, F = 0,1 kN в средата", () => {
    // H = F·l/(4·f): f = 0,2 m → 0,5 kN (5 пъти товара); f = 0,05 m → 2 kN (20 пъти)
    const loose = pointLoadCable(0.1, 2, 4, 0.2);
    const tight = pointLoadCable(0.1, 2, 4, 0.05);
    expect(loose.H).toBeCloseTo(0.5, 12);
    expect(loose.T1).toBeCloseTo(0.5025, 4);
    expect(loose.H / 0.1).toBeCloseTo(5, 9);
    expect(tight.H).toBeCloseTo(2, 12);
    expect(tight.T1).toBeCloseTo(2.0006, 4);
    expect(tight.H / 0.1).toBeCloseTo(20, 9);
  });
});

describe("опори на различни нива (Пример 4)", () => {
  // l = 20 m, дясната опора е с h = 4 m по-високо, q = 3 kN/m, f = 2 m
  const h = 4;
  const cable = inclinedCable(Q, L, F, h);

  it("H = 75 kN; V_A = 30 − 75·4/20 = 15 kN; V_B = 30 + 15 = 45 kN", () => {
    expect(cable.H).toBeCloseTo(75, 12);
    expect(cable.VA).toBeCloseTo(15, 12);
    expect(cable.VB).toBeCloseTo(45, 12);
  });

  it("N_A = √(75² + 15²) = 76,49 kN; N_B = √(75² + 45²) = √7650 = 87,46 kN", () => {
    expect(cable.TA).toBeCloseTo(76.49, 2);
    expect(cable.TB).toBeCloseTo(87.46, 2);
  });

  it("равновесие на цялото въже: ΣY = 0 и ΣM спрямо двете опори", () => {
    const total = Q * L; // 60 kN в средата на отвора
    expect(cable.VA + cable.VB - total).toBeCloseTo(0, 9);
    // спрямо B(l; h): 15·20 + 75·4 − 60·10 = 300 + 300 − 600 = 0
    expect(cable.VA * L + cable.H * h - (total * L) / 2).toBeCloseTo(0, 9);
    // спрямо A(0; 0): 45·20 − 75·4 − 60·10 = 900 − 300 − 600 = 0
    expect(cable.VB * L - cable.H * h - (total * L) / 2).toBeCloseTo(0, 9);
  });

  it("най-ниската точка: x₀ = 15/3 = 5 m, на 0,5 m под лявата опора", () => {
    expect(cable.xLowest).toBeCloseTo(5, 12);
    // z = 4·5/20 − 4·2·5·15/400 = 1 − 1,5 = −0,5 m
    expect(inclinedCableElevation(L, F, h, 5)).toBeCloseTo(-0.5, 12);
    expect(inclinedCableElevation(L, F, h, 4.9)).toBeGreaterThan(-0.5);
    expect(inclinedCableElevation(L, F, h, 5.1)).toBeGreaterThan(-0.5);
    expect(inclinedCableElevation(L, F, h, L)).toBeCloseTo(h, 12);
  });

  it("наклонът на въжето в опорите дава същите вертикални съставки", () => {
    // z′ = h/l − y′; при A: 0,2 − 0,4 = −0,2 → V_A = 75·0,2 = 15 kN
    const slopeA = h / L - parabolaSlope(L, F, 0);
    const slopeB = h / L - parabolaSlope(L, F, L);
    expect(-cable.H * slopeA).toBeCloseTo(cable.VA, 9);
    expect(cable.H * slopeB).toBeCloseTo(cable.VB, 9);
  });

  it("при h = 0 се получава симетричният случай", () => {
    const level = inclinedCable(Q, L, F, 0);
    expect(level.VA).toBeCloseTo(30, 12);
    expect(level.TB).toBeCloseTo(maxCableForce(Q, L, F), 12);
    expect(level.xLowest).toBeCloseTo(10, 12);
  });
});

describe("парабола срещу верижна линия при f/l = 1/10", () => {
  it("параметърът c удовлетворява c·(ch(l/(2c)) − 1) = f; c = 25,326 m", () => {
    const c = catenaryParameter(L, F);
    expect(c * (Math.cosh(L / (2 * c)) - 1)).toBeCloseTo(F, 10);
    expect(c).toBeCloseTo(25.326, 3);
  });

  it("H: 3·25,326 = 75,98 kN срещу 75 kN – разлика 1,3 %", () => {
    const Hcat = catenaryHorizontalForce(Q, L, F);
    expect(Hcat).toBeCloseTo(75.98, 2);
    expect(3 * 25.326).toBeCloseTo(75.98, 2);
    const difference = (Hcat / horizontalForce(Q, L, F) - 1) * 100;
    expect(difference).toBeCloseTo(1.3, 1);
    expect(difference).toBeLessThan(1.5);
  });

  it("N_max: 3·(25,326 + 2) = 81,98 kN срещу 80,78 kN – разлика 1,5 %", () => {
    const Tcat = catenaryMaxForce(Q, L, F);
    expect(Tcat).toBeCloseTo(81.98, 2);
    expect((Tcat / maxCableForce(Q, L, F) - 1) * 100).toBeCloseTo(1.5, 1);
    // независимо: вертикалната съставка е половината тегло q·L/2
    const Hcat = catenaryHorizontalForce(Q, L, F);
    const V = (Q * catenaryLength(L, F)) / 2;
    expect(Math.hypot(Hcat, V)).toBeCloseTo(Tcat, 8);
  });

  it("формите почти съвпадат: на четвърт отвор 1,500 m срещу 1,505 m", () => {
    expect(parabolaOrdinate(L, F, 5)).toBeCloseTo(1.5, 12);
    expect(catenaryOrdinate(L, F, 5)).toBeCloseTo(1.505, 3);
    expect(catenaryOrdinate(L, F, 0)).toBeCloseTo(0, 9);
    expect(catenaryOrdinate(L, F, L / 2)).toBeCloseTo(F, 9);
  });

  it("при по-малка стрелка разликата в H намалява, при по-голяма – расте", () => {
    const diff = (ratio: number) =>
      catenaryHorizontalForce(Q, L, L * ratio) /
        horizontalForce(Q, L, L * ratio) -
      1;
    expect(diff(1 / 20) * 100).toBeCloseTo(0.33, 2);
    expect(diff(1 / 5) * 100).toBeCloseTo(4.94, 2);
    expect(diff(1 / 20)).toBeLessThan(diff(1 / 10));
    expect(diff(1 / 10)).toBeLessThan(diff(1 / 5));
  });
});

describe("въпроси от „Провери се“", () => {
  it("Леко 2: l = 30 m, f = 2,5 m, q = 2 kN/m → H = 1800/20 = 90 kN; N_max = √9000 = 94,87 kN", () => {
    expect(horizontalForce(2, 30, 2.5)).toBeCloseTo(90, 12);
    expect(maxCableForce(2, 30, 2.5)).toBeCloseTo(94.87, 2);
  });

  it("Леко 3: простир 6 m, 0,06 kN в средата, f = 0,3 m → H = 0,06·6/1,2 = 0,3 kN", () => {
    const line = pointLoadCable(0.06, 3, 6, 0.3);
    expect(line.H).toBeCloseTo(0.3, 12);
    expect(line.H / 0.06).toBeCloseTo(5, 9);
  });

  it("Подробно 1: l = 24 m, f = 1,6 m, q = 4 kN/m → H = 2304/12,8 = 180 kN; N_max = √34704 = 186,29 kN; A ≥ 3,73 cm²", () => {
    expect(horizontalForce(4, 24, 1.6)).toBeCloseTo(180, 9);
    expect(maxCableForce(4, 24, 1.6)).toBeCloseTo(186.29, 2);
    expect(requiredCableArea(maxCableForce(4, 24, 1.6), 50)).toBeCloseTo(
      3.73,
      2,
    );
    expect(186.29 / 50).toBeCloseTo(3.73, 2);
  });

  it("Подробно 2: L ≈ 24·(1 + 8·2,56/1728) = 24·1,011852 = 24,284 m", () => {
    expect(cableLengthApprox(24, 1.6)).toBeCloseTo(24.284, 3);
    expect((8 * 1.6 ** 2) / (3 * 24 ** 2)).toBeCloseTo(0.011852, 6);
    expect((cableLengthApprox(24, 1.6) - 24) * 100).toBeCloseTo(28.4, 1);
  });

  it("Подробно 3: l = 10 m, F = 12 kN на 2,5 m, f = 1 m → 9 и 3 kN; H = 22,5 kN; 24,23 и 22,70 kN", () => {
    const cable = pointLoadCable(12, 2.5, 10, 1);
    expect(cable.VA).toBeCloseTo(9, 12);
    expect(cable.VB).toBeCloseTo(3, 12);
    expect(cable.H).toBeCloseTo(22.5, 12);
    expect(cable.T1).toBeCloseTo(24.23, 2);
    expect(cable.T2).toBeCloseTo(22.7, 2);
  });

  it("Подробно 4: l = 30 m, h = 3 m, f = 3 m, q = 2 kN/m → H = 75 kN; 22,5 и 37,5 kN; N_max = 83,85 kN", () => {
    const cable = inclinedCable(2, 30, 3, 3);
    expect(cable.H).toBeCloseTo(75, 12);
    expect(cable.VA).toBeCloseTo(22.5, 12);
    expect(cable.VB).toBeCloseTo(37.5, 12);
    expect(cable.TB).toBeCloseTo(83.85, 2);
    expect(cable.TB).toBeGreaterThan(cable.TA);
  });

  it("Подробно 5: по-голяма стрелка → по-малък разпор", () => {
    expect(horizontalForce(Q, L, 2.1)).toBeLessThan(horizontalForce(Q, L, 2));
  });
});

describe("невалидни входни данни", () => {
  it("отвор, стрелка, товар и площ трябва да са положителни", () => {
    expect(() => horizontalForce(0, 20, 2)).toThrow();
    expect(() => horizontalForce(3, -20, 2)).toThrow();
    expect(() => horizontalForce(3, 20, 0)).toThrow();
    expect(() => horizontalForce(3, 20, Number.NaN)).toThrow();
    expect(() => cableLengthApprox(20, 0)).toThrow();
    expect(() => cableLengthExact(0, 2)).toThrow();
    expect(() => cableStress(80, 0)).toThrow();
    expect(() => requiredCableArea(80, -1)).toThrow();
    expect(() => cableElongation(75, 20, 0, 2.5)).toThrow();
    expect(() => catenaryParameter(20, 0)).toThrow();
  });

  it("сечението и силата трябва да са в отвора", () => {
    expect(() => parabolaOrdinate(20, 2, -1)).toThrow();
    expect(() => parabolaOrdinate(20, 2, 21)).toThrow();
    expect(() => pointLoadCable(18, 0, 12, 1.5)).toThrow();
    expect(() => pointLoadCable(18, 12, 12, 1.5)).toThrow();
    expect(() => inclinedCable(3, 20, 2, Number.POSITIVE_INFINITY)).toThrow();
  });
});
