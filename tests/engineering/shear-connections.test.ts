import { describe, expect, it } from "vitest";
import {
  WELD_THROAT_FACTOR,
  averageShearStress,
  bearingStress,
  bearingThickness,
  boltArea,
  boltShearStress,
  checkBoltedJoint,
  fromMPa,
  netArea,
  netSectionStress,
  punchingForce,
  requiredBolts,
  requiredWeldLength,
  shearDisplacement,
  shearModulus,
  shearStrain,
  toMPa,
  weldCapacity,
  weldStress,
  weldThroat,
  type BoltedJoint,
} from "@/lib/engineering/shear-connections";
import { G_STEEL } from "@/lib/engineering/torsion";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над проверката.
// Числата са тези, които се четат в Глава 13 „Чисто срязване. Болтови и заваръчни съединения“.

// Допустими напрежения, дадени в условията на задачите (kN/cm²) – не са нормативни.
const TAU_ALLOW = 10;
const BEARING_ALLOW = 25;
const SIGMA_ALLOW = 16;
const WELD_ALLOW = 10;

/**
 * Независима проверка: площта на кръга, сметната числено по тънки ивици
 * (правило на средната точка), без формулата π·d²/4.
 */
function circleAreaNumeric(d: number, strips = 200000): number {
  const r = d / 2;
  const step = d / strips;
  let sum = 0;
  for (let i = 0; i < strips; i++) {
    const x = -r + (i + 0.5) * step;
    sum += 2 * Math.sqrt(r * r - x * x) * step;
  }
  return sum;
}

describe("мерни единици и площ на стеблото", () => {
  it("1 kN/cm² = 10 MPa, в двете посоки", () => {
    expect(toMPa(1)).toBe(10);
    expect(fromMPa(60)).toBe(6);
    // 7,96 kN/cm² = 79,6 MPa; 10,96 kN/cm² = 109,6 MPa
    expect(toMPa(7.96)).toBeCloseTo(79.6, 10);
    expect(toMPa(10.96)).toBeCloseTo(109.6, 10);
    expect(fromMPa(toMPa(0.01))).toBeCloseTo(0.01, 14);
  });

  it("A_б = π·d²/4 за диаметрите от главата", () => {
    // d = 2: π·4/4 = π = 3,1416 (в „Леко“ 3,142)
    expect(boltArea(2).toFixed(4)).toBe("3.1416");
    expect(boltArea(2).toFixed(3)).toBe("3.142");
    // d = 1,6: π·2,56/4 = 0,64π = 2,011
    expect(boltArea(1.6).toFixed(3)).toBe("2.011");
    // d = 2,4: π·5,76/4 = 1,44π = 4,524
    expect(boltArea(2.4).toFixed(3)).toBe("4.524");
  });

  it("независима проверка: числената площ на кръга съвпада с формулата", () => {
    expect(circleAreaNumeric(2)).toBeCloseTo(boltArea(2), 5);
    expect(circleAreaNumeric(1.6)).toBeCloseTo(boltArea(1.6), 5);
    expect(circleAreaNumeric(2.4)).toBeCloseTo(boltArea(2.4), 5);
  });
});

describe("чисто срязване и закон на Хук", () => {
  it("Пример 1: гумена подложка 20 × 30 × 4 cm, Q = 6 kN, G = 0,1 kN/cm²", () => {
    // A = 600 cm²; τ = 6/600 = 0,01 kN/cm² = 0,1 MPa
    const tau = averageShearStress(6, 20 * 30);
    expect(tau).toBeCloseTo(0.01, 14);
    expect(toMPa(tau)).toBeCloseTo(0.1, 12);
    // γ = 0,01/0,1 = 0,1 rad; Δs = 0,1·4 = 0,4 cm
    expect(shearStrain(tau, 0.1)).toBeCloseTo(0.1, 12);
    expect(shearDisplacement(6, 4, 0.1, 600)).toBeCloseTo(0.4, 12);
    // проверка по втория път: Δs = Q·h/(G·A) = 24/60 = 0,4 cm
    expect((6 * 4) / (0.1 * 600)).toBeCloseTo(0.4, 12);
  });

  it("Пример 1: стоманен блок – γ = 0,01/8100 = 1,23·10⁻⁶ rad, 81 000 пъти по-малък", () => {
    const steel = shearStrain(0.01, G_STEEL);
    expect((steel * 1e6).toFixed(2)).toBe("1.23");
    expect(shearStrain(0.01, 0.1) / steel).toBeCloseTo(81000, 6);
  });

  it("G = E/(2·(1 + ν)) = 21000/2,6 = 8077 kN/cm² – близо до приетите 8100", () => {
    expect(shearModulus(21000, 0.3).toFixed(0)).toBe("8077");
    expect(Math.abs(shearModulus(21000, 0.3) - G_STEEL) / G_STEEL).toBeLessThan(
      0.003,
    );
  });

  it("въпрос 3 („Подробно“): τ = 60 MPa → γ = 6/8100 = 7,41·10⁻⁴ rad", () => {
    expect((shearStrain(fromMPa(60), G_STEEL) * 1e4).toFixed(2)).toBe("7.41");
  });

  it("знакът на τ и γ следва знака на Q", () => {
    expect(averageShearStress(-6, 600)).toBeCloseTo(-0.01, 14);
    expect(shearStrain(-0.01, 0.1)).toBeCloseTo(-0.1, 12);
  });

  it("независима проверка: по диагонала на елемента σ = τ и няма тангенциално напрежение", () => {
    // Призма с катети a и дебелина t; по катетите действат сили τ·a·t.
    // Нормала към диагонала: (1, 1)/√2; посока на диагонала: (1, −1)/√2.
    const tau = 7.3;
    const a = 2.5;
    const t = 1.1;
    const force = tau * a * t;
    // силата по вертикалния катет е вертикална, по хоризонталния – хоризонтална
    const normal = force * Math.SQRT1_2 + force * Math.SQRT1_2;
    const along = force * Math.SQRT1_2 - force * Math.SQRT1_2;
    const diagonalArea = Math.SQRT2 * a * t;
    expect(normal / diagonalArea).toBeCloseTo(tau, 12);
    expect(along).toBeCloseTo(0, 12);
  });
});

describe("„Леко“: две планки 8 × 1 cm, два болта d = 2 cm, F = 60 kN", () => {
  const joint: BoltedJoint = {
    F: 60,
    n: 2,
    m: 1,
    d: 2,
    tBearing: 1,
    b: 8,
    tPlate: 1,
    holes: 1,
    d0: 2.2,
    tauAllow: TAU_ALLOW,
    bearingAllow: BEARING_ALLOW,
    sigmaAllow: SIGMA_ALLOW,
  };

  it("трите напрежения: 9,55; 15; 10,3 kN/cm²", () => {
    const check = checkBoltedJoint(joint);
    // τ = 60/(2·1·3,1416) = 60/6,2832 = 9,55
    expect(check.stress.shear.toFixed(2)).toBe("9.55");
    // σ_см = 60/(2·2·1) = 15
    expect(check.stress.bearing).toBeCloseTo(15, 12);
    // A_нето = (8 − 2,2)·1 = 5,8; σ = 60/5,8 = 10,34 → 10,3
    expect(netArea(8, 1, 1, 2.2)).toBeCloseTo(5.8, 12);
    expect(check.stress.net.toFixed(1)).toBe("10.3");
    expect(check.ok).toBe(true);
  });

  it("със закръглената площ 3,142 се получава същото 9,55 и 4,77", () => {
    expect((60 / (2 * 1 * 3.142)).toFixed(2)).toBe("9.55");
    expect((60 / (2 * 2 * 3.142)).toFixed(2)).toBe("4.77");
  });

  it("най-близо до границата е срязването – и по използване, и по допустима сила", () => {
    const check = checkBoltedJoint(joint);
    expect(check.governing).toBe("shear");
    // допустими сили: 2·3,1416·10 = 62,8; 2·2·1·25 = 100; 5,8·16 = 92,8 kN
    expect(check.capacity.shear.toFixed(1)).toBe("62.8");
    expect(check.capacity.bearing).toBeCloseTo(100, 10);
    expect(check.capacity.net).toBeCloseTo(92.8, 10);
    expect(check.allowableForce).toBe(
      Math.min(
        check.capacity.shear,
        check.capacity.bearing,
        check.capacity.net,
      ),
    );
  });

  it("двусрезно: τ = 4,77 kN/cm² – точно половината; смачкването остава 15", () => {
    const double = checkBoltedJoint({ ...joint, m: 2 });
    expect(double.stress.shear.toFixed(2)).toBe("4.77");
    expect(double.stress.shear).toBeCloseTo(
      checkBoltedJoint(joint).stress.shear / 2,
      12,
    );
    expect(double.stress.bearing).toBeCloseTo(15, 12);
  });

  it("шевът от „В реалния живот“: k = 0,5 → a = 0,35; Σl ≥ 17,1 cm; два по 9 cm", () => {
    // a = 0,7·0,5 = 0,35 cm
    const a = weldThroat(0.5);
    expect(a).toBeCloseTo(0.35, 12);
    // Σl = 60/(0,35·10) = 17,14 → 17,1 cm
    expect(requiredWeldLength(60, a, WELD_ALLOW).toFixed(1)).toBe("17.1");
    // 2·9 = 18 cm ≥ 17,1: τ_ш = 60/(0,35·18) = 9,52 ≤ 10
    expect(weldStress(60, a, 18)).toBeLessThanOrEqual(WELD_ALLOW);
    expect(weldStress(60, a, 18).toFixed(2)).toBe("9.52");
    // два шева по 8 cm не биха стигнали
    expect(weldStress(60, a, 16)).toBeGreaterThan(WELD_ALLOW);
  });
});

describe("въпроси от „Леко“", () => {
  it("въпрос 2: един болт d = 1,6 cm, F = 16 kN → 7,96 kN/cm² = 79,6 MPa", () => {
    // 16/2,011 = 7,96
    const tau = boltShearStress(16, 1, 1, 1.6);
    expect(tau.toFixed(2)).toBe("7.96");
    expect(toMPa(tau).toFixed(1)).toBe("79.6");
    expect((16 / 2.011).toFixed(2)).toBe("7.96");
  });

  it("въпрос 3: F = 60 kN, три болта d = 2 cm, t = 0,8 cm → 12,5 kN/cm²", () => {
    // 60/(3·2·0,8) = 60/4,8 = 12,5
    expect(bearingStress(60, 3, 2, 0.8)).toBeCloseTo(12.5, 12);
  });

  it("въпрос 4: k = 0,5 cm, F = 70 kN → Σl = 70/(0,35·10) = 20 cm", () => {
    expect(requiredWeldLength(70, weldThroat(0.5), WELD_ALLOW)).toBeCloseTo(
      20,
      10,
    );
  });
});

describe("Пример 2: едносрезно съединение, планки 12 × 1 cm, 4 болта, F = 120 kN", () => {
  const joint: BoltedJoint = {
    F: 120,
    n: 4,
    m: 1,
    d: 2,
    tBearing: 1,
    b: 12,
    tPlate: 1,
    holes: 2,
    d0: 2.2,
    tauAllow: TAU_ALLOW,
    bearingAllow: BEARING_ALLOW,
    sigmaAllow: SIGMA_ALLOW,
  };
  const check = checkBoltedJoint(joint);

  it("напрежения: 9,55; 15; 15,79 kN/cm²", () => {
    // τ = 120/(4·1·3,1416) = 120/12,566 = 9,55
    expect(check.stress.shear.toFixed(2)).toBe("9.55");
    expect((120 / (4 * 1 * 3.1416)).toFixed(2)).toBe("9.55");
    // σ_см = 120/(4·2·1) = 15
    expect(check.stress.bearing).toBeCloseTo(15, 12);
    // A_нето = (12 − 2·2,2)·1 = 7,6; σ = 120/7,6 = 15,79
    expect(netArea(12, 1, 2, 2.2)).toBeCloseTo(7.6, 12);
    expect(check.stress.net.toFixed(2)).toBe("15.79");
    expect(check.ok).toBe(true);
  });

  it("без отворите σ = 120/12 = 10 kN/cm²; отворите го увеличават с 58 %", () => {
    const gross = netSectionStress(120, 12, 1, 0, 0);
    expect(gross).toBeCloseTo(10, 12);
    expect(((check.stress.net / gross - 1) * 100).toFixed(0)).toBe("58");
  });

  it("таблицата: използване 0,955; 0,600; 0,987 и допустими сили 125,7; 200,0; 121,6 kN", () => {
    expect(check.utilization.shear.toFixed(3)).toBe("0.955");
    expect(check.utilization.bearing.toFixed(3)).toBe("0.600");
    expect(check.utilization.net.toFixed(3)).toBe("0.987");
    // 4·3,1416·10 = 125,7; 4·2·1·25 = 200; 7,6·16 = 121,6
    expect(check.capacity.shear.toFixed(1)).toBe("125.7");
    expect(check.capacity.bearing.toFixed(1)).toBe("200.0");
    expect(check.capacity.net.toFixed(1)).toBe("121.6");
  });

  it("меродавно е отслабеното сечение – по двата независими пътя", () => {
    expect(check.governing).toBe("net");
    // втори път: най-малката от площ · допустимо напрежение
    const capacities = {
      shear: 4 * 1 * boltArea(2) * TAU_ALLOW,
      bearing: 4 * 2 * 1 * BEARING_ALLOW,
      net: 7.6 * SIGMA_ALLOW,
    };
    const smallest = Math.min(...Object.values(capacities));
    expect(smallest).toBe(capacities.net);
    expect(check.allowableForce).toBeCloseTo(smallest, 10);
    expect(check.allowableForce).toBeGreaterThanOrEqual(120);
  });

  it("при сила, равна на допустимата, меродавната проверка е точно на границата", () => {
    const atLimit = checkBoltedJoint({ ...joint, F: check.allowableForce });
    expect(atLimit.utilization.net).toBeCloseTo(1, 12);
    expect(atLimit.ok).toBe(true);
    expect(checkBoltedJoint({ ...joint, F: 122 }).ok).toBe(false);
  });
});

describe("Пример 3: необходим брой болтове", () => {
  it("вариант А (едносрезно): 31,42 и 50 kN на болт → 3,82 → 4, меродавно срязването", () => {
    const need = requiredBolts(120, 1, 2, 1, TAU_ALLOW, BEARING_ALLOW);
    // 3,1416·10 = 31,42; 2·1·25 = 50
    expect(need.shearPerBolt.toFixed(2)).toBe("31.42");
    expect(need.bearingPerBolt).toBeCloseTo(50, 12);
    // 120/31,42 = 3,82; 120/50 = 2,4
    expect(need.byShear.toFixed(2)).toBe("3.82");
    expect((120 / 31.42).toFixed(2)).toBe("3.82");
    expect(need.byBearing).toBeCloseTo(2.4, 12);
    expect(need.n).toBe(4);
    expect(need.governing).toBe("shear");
  });

  it("вариант Б (двусрезно): 62,83 и 50 kN → 1,91 и 2,4 → 3, меродавно смачкването", () => {
    // t_min = min(1,0; 2·0,6 = 1,2) = 1,0 cm
    const t = bearingThickness(1, 0.6);
    expect(t).toBe(1);
    const need = requiredBolts(120, 2, 2, t, TAU_ALLOW, BEARING_ALLOW);
    expect(need.shearPerBolt.toFixed(2)).toBe("62.83");
    expect((2 * 31.416).toFixed(2)).toBe("62.83"); // в текста: 2·31,416 = 62,83
    expect(need.byShear.toFixed(2)).toBe("1.91");
    expect((120 / 62.83).toFixed(2)).toBe("1.91");
    expect(need.byBearing).toBeCloseTo(2.4, 12);
    expect(need.n).toBe(3);
    expect(need.governing).toBe("bearing");
  });

  it("вторият срез удвоява само силата на срязване на един болт", () => {
    const single = requiredBolts(120, 1, 2, 1, TAU_ALLOW, BEARING_ALLOW);
    const double = requiredBolts(120, 2, 2, 1, TAU_ALLOW, BEARING_ALLOW);
    expect(double.shearPerBolt).toBeCloseTo(2 * single.shearPerBolt, 12);
    expect(double.bearingPerBolt).toBe(single.bearingPerBolt);
    // броят пада от 4 на 3, не на 2
    expect([single.n, double.n]).toEqual([4, 3]);
  });

  const threeBolts: BoltedJoint = {
    F: 120,
    n: 3,
    m: 2,
    d: 2,
    tBearing: 1,
    b: 12,
    tPlate: 1,
    holes: 1,
    d0: 2.2,
    tauAllow: TAU_ALLOW,
    bearingAllow: BEARING_ALLOW,
    sigmaAllow: SIGMA_ALLOW,
  };

  it("с три болта и трите проверки са изпълнени: 6,37; 20; 12,24 kN/cm²", () => {
    const check = checkBoltedJoint(threeBolts);
    // τ = 120/(3·2·3,1416) = 120/18,85 = 6,37
    expect(check.stress.shear.toFixed(2)).toBe("6.37");
    expect((120 / (3 * 2 * 3.1416)).toFixed(2)).toBe("6.37");
    // σ_см = 120/(3·2·1) = 20
    expect(check.stress.bearing).toBeCloseTo(20, 12);
    // средна планка: A_нето = (12 − 2,2)·1 = 9,8; σ = 120/9,8 = 12,24
    expect(netArea(12, 1, 1, 2.2)).toBeCloseTo(9.8, 12);
    expect(check.stress.net.toFixed(2)).toBe("12.24");
    expect(check.ok).toBe(true);
    expect(check.governing).toBe("bearing");
  });

  it("двете накладки: A_нето = 9,8·1,2 = 11,76 cm²; σ = 10,20 kN/cm²", () => {
    // сборната дебелина на накладките е 2·0,6 = 1,2 cm
    expect(netArea(12, 2 * 0.6, 1, 2.2)).toBeCloseTo(11.76, 12);
    const sigma = netSectionStress(120, 12, 2 * 0.6, 1, 2.2);
    expect(sigma.toFixed(2)).toBe("10.20");
    expect(sigma).toBeLessThanOrEqual(SIGMA_ALLOW);
  });

  it("с два болта смачкването е 30 kN/cm² > 25 – съединението не минава", () => {
    const check = checkBoltedJoint({ ...threeBolts, n: 2 });
    expect(check.stress.bearing).toBeCloseTo(30, 12);
    expect(check.ok).toBe(false);
    // срязването само по себе си би минало: 120/(2·2·3,1416) = 9,55 ≤ 10
    expect(check.stress.shear).toBeLessThanOrEqual(TAU_ALLOW);
  });

  it("закръгленият нагоре брой удовлетворява срязването и смачкването, а с един по-малко – не", () => {
    const cases = [
      { F: 120, m: 1, d: 2, t: 1 },
      { F: 120, m: 2, d: 2, t: 1 },
      { F: 200, m: 2, d: 2.4, t: 1.4 },
      { F: 60, m: 1, d: 2, t: 1 },
      { F: 100, m: 2, d: 2, t: 1 }, // смачкването дава точно n = 2
    ];
    for (const c of cases) {
      const { n } = requiredBolts(c.F, c.m, c.d, c.t, TAU_ALLOW, BEARING_ALLOW);
      const passes = (count: number) =>
        boltShearStress(c.F, count, c.m, c.d) <= TAU_ALLOW + 1e-9 &&
        bearingStress(c.F, count, c.d, c.t) <= BEARING_ALLOW + 1e-9;
      expect(passes(n)).toBe(true);
      if (n > 1) expect(passes(n - 1)).toBe(false);
    }
    expect(requiredBolts(100, 2, 2, 1, TAU_ALLOW, BEARING_ALLOW).n).toBe(2);
  });
});

describe("Пример 4: ъглов заваръчен шев", () => {
  it("a = 0,7·k; коефициентът е близо до cos 45° = 0,707", () => {
    expect(WELD_THROAT_FACTOR).toBe(0.7);
    expect(Math.cos(Math.PI / 4).toFixed(3)).toBe("0.707");
    expect(weldThroat(0.6)).toBeCloseTo(0.42, 12);
    expect(weldThroat(0.8)).toBeCloseTo(0.56, 12);
  });

  it("k = 0,6 cm: Σl ≥ 28,57 cm, по 14,29 cm; с 2 × 15 cm τ_ш = 9,52 kN/cm²", () => {
    const a = weldThroat(0.6);
    // 120/(0,42·10) = 120/4,2 = 28,57
    const total = requiredWeldLength(120, a, WELD_ALLOW);
    expect(total.toFixed(2)).toBe("28.57");
    expect((total / 2).toFixed(2)).toBe("14.29");
    // 120/(0,42·30) = 120/12,6 = 9,52
    expect(weldStress(120, a, 30).toFixed(2)).toBe("9.52");
    expect(weldStress(120, a, 30)).toBeLessThanOrEqual(WELD_ALLOW);
    // F_доп = 0,42·30·10 = 126 kN ≥ 120
    expect(weldCapacity(a, 30, WELD_ALLOW)).toBeCloseTo(126, 10);
    // два шева по 14 cm не стигат
    expect(weldStress(120, a, 28)).toBeGreaterThan(WELD_ALLOW);
  });

  it("k = 0,8 cm: Σl ≥ 21,43 cm; с 2 × 11 cm τ_ш = 9,74 kN/cm²", () => {
    const a = weldThroat(0.8);
    // 120/(0,56·10) = 21,43;  120/(0,56·22) = 120/12,32 = 9,74
    expect(requiredWeldLength(120, a, WELD_ALLOW).toFixed(2)).toBe("21.43");
    expect(weldStress(120, a, 22).toFixed(2)).toBe("9.74");
    expect(weldStress(120, a, 20)).toBeGreaterThan(WELD_ALLOW);
  });

  it("независима проверка: необходимата дължина връща точно допустимото напрежение", () => {
    for (const [F, k] of [
      [120, 0.6],
      [120, 0.8],
      [60, 0.5],
      [70, 0.5],
    ] as const) {
      const a = weldThroat(k);
      const total = requiredWeldLength(F, a, WELD_ALLOW);
      expect(weldStress(F, a, total)).toBeCloseTo(WELD_ALLOW, 12);
      expect(weldCapacity(a, total, WELD_ALLOW)).toBeCloseTo(F, 10);
    }
  });
});

describe("„В реалния живот“ и въпроси от „Подробно“", () => {
  it("пробиване: d = 2 cm, t = 0,5 cm, якост 30 kN/cm² → 3,14 cm² и 94,2 kN", () => {
    // π·2·0,5 = 3,14 cm²; 3,14·30 = 94,2 kN
    expect((Math.PI * 2 * 0.5).toFixed(2)).toBe("3.14");
    expect(punchingForce(2, 0.5, 30).toFixed(1)).toBe("94.2");
    expect((3.14 * 30).toFixed(1)).toBe("94.2");
  });

  it("въпрос 1: F = 200 kN, d = 2,4 cm, двусрезно, t = 1,4 / 2 × 0,8 cm → 3 болта", () => {
    // t_min = min(1,4; 1,6) = 1,4
    const t = bearingThickness(1.4, 0.8);
    expect(t).toBe(1.4);
    const need = requiredBolts(200, 2, 2.4, t, TAU_ALLOW, BEARING_ALLOW);
    // 2·4,524·10 = 90,48 kN; 200/90,48 = 2,21
    expect(need.shearPerBolt.toFixed(2)).toBe("90.48");
    expect(need.byShear.toFixed(2)).toBe("2.21");
    // 2,4·1,4·25 = 84 kN; 200/84 = 2,38
    expect(need.bearingPerBolt).toBeCloseTo(84, 10);
    expect(need.byBearing.toFixed(2)).toBe("2.38");
    expect(need.n).toBe(3);
    expect(need.governing).toBe("bearing");
  });

  it("въпрос 2: планка 15 × 1,2 cm, два отвора 1,8 cm, F = 150 kN → 10,96 kN/cm²", () => {
    // A_нето = (15 − 3,6)·1,2 = 13,68; σ = 150/13,68 = 10,96; бруто 150/18 = 8,33
    expect(netArea(15, 1.2, 2, 1.8)).toBeCloseTo(13.68, 12);
    const sigma = netSectionStress(150, 15, 1.2, 2, 1.8);
    expect(sigma.toFixed(2)).toBe("10.96");
    expect(toMPa(sigma).toFixed(1)).toBe("109.6");
    expect(netSectionStress(150, 15, 1.2, 0, 0).toFixed(2)).toBe("8.33");
  });

  it("въпрос 4: два шева по 12 cm, k = 0,8 cm → F_доп = 0,56·24·10 = 134,4 kN", () => {
    expect(weldCapacity(weldThroat(0.8), 2 * 12, WELD_ALLOW)).toBeCloseTo(
      134.4,
      10,
    );
  });
});

describe("входни данни", () => {
  it("невалидни стойности се отхвърлят", () => {
    expect(() => boltArea(0)).toThrow();
    expect(() => averageShearStress(10, 0)).toThrow();
    expect(() => averageShearStress(Number.NaN, 5)).toThrow();
    expect(() => shearStrain(1, 0)).toThrow();
    expect(() => shearModulus(21000, 0.6)).toThrow();
    expect(() => shearDisplacement(6, 0, 0.1, 600)).toThrow();
    expect(() => boltShearStress(-5, 2, 1, 2)).toThrow();
    expect(() => boltShearStress(60, 0, 1, 2)).toThrow();
    expect(() => boltShearStress(60, 2.5, 1, 2)).toThrow();
    expect(() => boltShearStress(60, 2, 0, 2)).toThrow();
    expect(() => bearingStress(60, 2, 2, 0)).toThrow();
    expect(() => bearingThickness(0, 1)).toThrow();
    expect(() => netArea(8, 1, -1, 2.2)).toThrow();
    expect(() => netArea(8, 1, 4, 2.2)).toThrow(); // отворите са по-широки от планката
    expect(() => requiredBolts(120, 1, 2, 1, 0, 25)).toThrow();
    expect(() => weldThroat(0)).toThrow();
    expect(() => weldThroat(0.6, 1.2)).toThrow();
    expect(() => weldStress(120, 0.42, 0)).toThrow();
    expect(() => requiredWeldLength(120, 0.42, 0)).toThrow();
    expect(() => weldCapacity(0.42, -1, 10)).toThrow();
    expect(() => punchingForce(2, 0.5, Number.POSITIVE_INFINITY)).toThrow();
  });
});
