import { describe, expect, it } from "vitest";
import {
  IMPERIAL_CONSTANT,
  KMH_PER_MPH,
  M3_PER_CUBIC_YARD,
  arithmeticMeanSpeed,
  compactionTime,
  compactorProduction,
  compactorProductionImperial,
  compactorsRequired,
  cubicYardToM3,
  effectiveWidth,
  efficiencyFromMinutes,
  feetToM,
  harmonicMeanSpeed,
  inchToMm,
  looseToCompacted,
  looseToCompactedFactor,
  mphToKmh,
  numberOfLifts,
} from "@/lib/engineering/compaction";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Единици: m, km/h, mm, m³, m³/h (уплътнен обем), h.
// Формула: Q = W·S·L·E / N (И1 = FM 5-434, § 11-24; И2 – същата с E = 1).

/**
 * Независим път: площта, която валякът покрива за час с ЕДНО минаване, е
 * W·(1000·S) m²; готовата площ е N пъти по-малка; обемът е площ × дебелина в m.
 * Не ползва функцията от проверявания файл.
 */
function productionByArea(
  widthM: number,
  speedKmh: number,
  liftMm: number,
  passes: number,
  efficiency: number,
): number {
  const finishedAreaPerHour = (widthM * speedKmh * 1000) / passes; // m²/h
  return finishedAreaPerHour * (liftMm / 1000) * efficiency;
}

/**
 * Независим път за скоростта: симулация на минаванията по ивица с дадена
 * дължина; връща уплътнения обем за час чисто работно време.
 */
function productionBySimulation(
  widthM: number,
  speedsKmh: number[],
  liftMm: number,
  stripKm = 1,
): number {
  let hours = 0;
  for (const speed of speedsKmh) hours += stripKm / speed;
  const volume = widthM * stripKm * 1000 * (liftMm / 1000);
  return volume / hours;
}

describe("превръщане на единици", () => {
  it("константата 16,3 е 5280 ÷ 12 ÷ 27", () => {
    // 5280 / 12 = 440; 440 / 27 = 16,296… ≈ 16,3
    expect(IMPERIAL_CONSTANT).toBeCloseTo(16.2963, 4);
    expect(IMPERIAL_CONSTANT).toBeCloseTo(16.3, 1);
  });

  it("скоростите от таблицата на И1 в km/h", () => {
    // 2 mph = 3,22; 4 mph = 6,44; 8 mph = 12,87; 10 mph = 16,09 km/h
    expect(mphToKmh(2)).toBeCloseTo(3.22, 2);
    expect(mphToKmh(4)).toBeCloseTo(6.44, 2);
    expect(mphToKmh(3)).toBeCloseTo(4.83, 2);
    expect(mphToKmh(5)).toBeCloseTo(8.05, 2);
    expect(mphToKmh(8)).toBeCloseTo(12.87, 2);
    expect(mphToKmh(10)).toBeCloseTo(16.09, 2);
    // вибрационна плоча: 0,6–1,2 mph = 0,97–1,93 km/h
    expect(mphToKmh(0.6)).toBeCloseTo(0.97, 2);
    expect(mphToKmh(1.2)).toBeCloseTo(1.93, 2);
  });

  it("дебелини и застъпване", () => {
    // 6 in = 152,4 mm; 8 in = 203,2 mm; 9 in = 228,6 mm; 1 ft = 0,3048 m
    expect(inchToMm(6)).toBeCloseTo(152.4, 10);
    expect(inchToMm(8)).toBeCloseTo(203.2, 10);
    expect(inchToMm(9)).toBeCloseTo(228.6, 10);
    expect(inchToMm(4)).toBeCloseTo(101.6, 10);
    expect(feetToM(1)).toBeCloseTo(0.3048, 10);
  });

  it("кубичен ярд", () => {
    // 0,9144³ = 0,764554857984 m³
    expect(M3_PER_CUBIC_YARD).toBeCloseTo(0.7645549, 7);
    expect(cubicYardToM3(1500)).toBeCloseTo(1146.83, 2);
  });

  it("в SI числовият множител е 1", () => {
    // 16,2963 yd³/h за W = 1 ft, S = 1 mph, L = 1 in →
    // в SI: 0,3048 · 1,609344 · 25,4 = 12,4594 m³/h = 16,2963 · 0,764555
    const si = compactorProduction({
      widthM: feetToM(1),
      speedKmh: mphToKmh(1),
      liftMm: inchToMm(1),
      passes: 1,
    });
    expect(si).toBeCloseTo(12.4594, 4);
    expect(si).toBeCloseTo(cubicYardToM3(IMPERIAL_CONSTANT), 10);
  });
});

describe("сверяване с примера на И1 (FM 5-434, след § 11-26)", () => {
  it("производителност 487 CCY/h", () => {
    // 16,3 · 5 · 6 · 6 · 0,83 / 5 = 487,04 (с 16,3); с точната константа 486,93
    expect(compactorProductionImperial(5, 6, 6, 5, 0.83)).toBeCloseTo(
      486.93,
      2,
    );
    expect(Math.round(compactorProductionImperial(5, 6, 6, 5, 0.83))).toBe(487);
  });

  it("същият пример в SI", () => {
    // W = 1,524 m; S = 9,656 km/h; L = 152,4 mm → 372,29 m³/h = 486,93 · 0,764555
    const si = compactorProduction({
      widthM: feetToM(5),
      speedKmh: mphToKmh(6),
      liftMm: inchToMm(6),
      passes: 5,
      efficiency: 0.83,
    });
    expect(si).toBeCloseTo(372.29, 2);
    expect(si).toBeCloseTo(
      cubicYardToM3(compactorProductionImperial(5, 6, 6, 5, 0.83)),
      9,
    );
  });

  it("средна скорост и брой машини", () => {
    // (4 + 4 + 5 + 8 + 9) / 5 = 6 mph
    expect(arithmeticMeanSpeed([4, 4, 5, 8, 9])).toBeCloseTo(6, 12);
    // 1500 · 0,87 / 487 = 2,68 → 3 машини
    const n = compactorsRequired(1500, 0.87, 487);
    expect(n.exact).toBeCloseTo(2.68, 2);
    expect(n.count).toBe(3);
  });
});

describe("Пример 1 – вибрационен валяк с гладък бандаж", () => {
  const W = effectiveWidth(2.1, 0.3);
  const base = { widthM: W, speedKmh: 4, liftMm: 150, passes: 8 };

  it("уплътнявана широчина", () => {
    // 2,1 − 0,3 = 1,8 m
    expect(W).toBeCloseTo(1.8, 12);
  });

  it("форма без коефициент (И2): 135 m³/h", () => {
    // 1,8 · 4 = 7,2; 7,2 · 150 = 1080; 1080 / 8 = 135
    expect(compactorProduction(base)).toBeCloseTo(135, 10);
    expect(productionByArea(W, 4, 150, 8, 1)).toBeCloseTo(135, 10);
  });

  it("форма с коефициент (И1): 112,05 m³/h", () => {
    // 135 · 0,83 = 112,05
    const q = compactorProduction({ ...base, efficiency: 0.83 });
    expect(q).toBeCloseTo(112.05, 10);
    // площ: 1,8 · 4000 / 8 = 900 m²/h; 900 · 0,15 = 135; · 0,83 = 112,05
    expect(productionByArea(W, 4, 150, 8, 0.83)).toBeCloseTo(112.05, 10);
  });

  it("разлика между двете форми", () => {
    // 135 − 112,05 = 22,95 m³/h, тоест 17 % от 135
    const q60 = compactorProduction(base);
    const q = compactorProduction({ ...base, efficiency: 0.83 });
    expect(q60 - q).toBeCloseTo(22.95, 10);
    expect(((q60 - q) / q60) * 100).toBeCloseTo(17, 10);
  });

  it("уплътнен обем за поемане: 344 m³/h", () => {
    // 400 · 0,86 = 344
    expect(looseToCompacted(400, 0.86)).toBeCloseTo(344, 10);
  });

  it("брой валяци: 4 с коефициента, 3 без него", () => {
    // 344 / 112,05 = 3,07 → 4;  344 / 135 = 2,55 → 3
    const withE = compactorsRequired(400, 0.86, 112.05);
    expect(withE.compactedRate).toBeCloseTo(344, 10);
    expect(withE.exact).toBeCloseTo(3.07, 2);
    expect(withE.count).toBe(4);
    const withoutE = compactorsRequired(400, 0.86, 135);
    expect(withoutE.exact).toBeCloseTo(2.55, 2);
    expect(withoutE.count).toBe(3);
  });

  it("три валяка не стигат", () => {
    // 3 · 112,05 = 336,15 < 344; недостиг 7,85 m³/h; 4 · 112,05 = 448,2
    expect(3 * 112.05).toBeCloseTo(336.15, 10);
    expect(344 - 3 * 112.05).toBeCloseTo(7.85, 10);
    expect(4 * 112.05).toBeCloseTo(448.2, 10);
  });

  it("нощна смяна, 45 минути в час", () => {
    // 45 / 60 = 0,75; 135 · 0,75 = 101,25 m³/h
    expect(efficiencyFromMinutes(45)).toBeCloseTo(0.75, 12);
    expect(
      compactorProduction({ ...base, efficiency: efficiencyFromMinutes(45) }),
    ).toBeCloseTo(101.25, 10);
    // 50 / 60 = 0,833…, в И1 закръглено на 0,83
    expect(efficiencyFromMinutes(50)).toBeCloseTo(0.83, 2);
  });
});

describe("Пример 2 – средна скорост на минаванията", () => {
  const speeds = [8, 8, 8, 16, 16];

  it("средноаритметична 11,2 km/h, действителна 10 km/h", () => {
    // (8 + 8 + 8 + 16 + 16) / 5 = 56 / 5 = 11,2
    expect(arithmeticMeanSpeed(speeds)).toBeCloseTo(11.2, 12);
    // 3/8 + 2/16 = 0,375 + 0,125 = 0,5; 5 / 0,5 = 10
    expect(harmonicMeanSpeed(speeds)).toBeCloseTo(10, 12);
  });

  it("производителност по двата начина", () => {
    // 2,0 · 11,2 · 150 / 5 = 672; · 0,83 = 557,76
    const arithmetic = compactorProduction({
      widthM: 2,
      speedKmh: arithmeticMeanSpeed(speeds),
      liftMm: 150,
      passes: 5,
    });
    expect(arithmetic).toBeCloseTo(672, 10);
    expect(arithmetic * 0.83).toBeCloseTo(557.76, 10);
    // 2,0 · 10 · 150 / 5 = 600; · 0,83 = 498
    const harmonic = compactorProduction({
      widthM: 2,
      speedKmh: harmonicMeanSpeed(speeds),
      liftMm: 150,
      passes: 5,
      efficiency: 0.83,
    });
    expect(harmonic).toBeCloseTo(498, 10);
    // 672 / 600 = 1,12 → с 12 % повече
    expect(arithmetic / 600).toBeCloseTo(1.12, 12);
  });

  it("проверка с ивица 1 km", () => {
    // време: 3 · (1/8) + 2 · (1/16) = 0,5 h; обем: 2 · 1000 · 0,15 = 300 m³;
    // 300 / 0,5 = 600 m³/h
    expect(productionBySimulation(2, speeds, 150)).toBeCloseTo(600, 10);
    // резултатът не зависи от дължината на ивицата
    expect(productionBySimulation(2, speeds, 150, 0.35)).toBeCloseTo(600, 10);
  });

  it("при равни скорости двете средни съвпадат", () => {
    expect(harmonicMeanSpeed([6, 6, 6])).toBeCloseTo(6, 12);
    expect(arithmeticMeanSpeed([6, 6, 6])).toBeCloseTo(6, 12);
  });

  it("хармоничната никога не е по-голяма от аритметичната", () => {
    for (const set of [
      [3, 9],
      [5, 5, 6, 12, 15],
      [1, 2, 3, 4, 5, 6],
    ]) {
      expect(harmonicMeanSpeed(set)).toBeLessThanOrEqual(
        arithmeticMeanSpeed(set) + 1e-12,
      );
    }
  });
});

describe("обемни преходи", () => {
  it("коефициент разрохкан → уплътнен от разбухване и свиване", () => {
    // пясък или чакъл (И1, табл. 1-1): 0,95 / 1,11 = 0,856 ≈ 0,86
    expect(looseToCompactedFactor(0.11, 0.95)).toBeCloseTo(0.856, 3);
    // обикновена почва: 0,90 / 1,25 = 0,72
    expect(looseToCompactedFactor(0.25, 0.9)).toBeCloseTo(0.72, 12);
    // глина: 0,90 / 1,43 = 0,629 ≈ 0,63
    expect(looseToCompactedFactor(0.43, 0.9)).toBeCloseTo(0.629, 3);
    // взривена скала: 1,30 / 1,50 = 0,867 ≈ 0,87
    expect(looseToCompactedFactor(0.5, 1.3)).toBeCloseTo(0.867, 3);
  });

  it("Пример 1 през плътното състояние", () => {
    // 400 / 1,11 = 360,36 m³ плътен; · 0,95 = 342,34 m³ уплътнен
    expect(400 / 1.11).toBeCloseTo(360.36, 2);
    expect(
      looseToCompacted(400, looseToCompactedFactor(0.11, 0.95)),
    ).toBeCloseTo(342.34, 2);
    // разлика спрямо 344: 1,66 m³/h, под 0,5 %
    expect(344 - 342.34).toBeCloseTo(1.66, 2);
    expect(((344 - 342.34) / 344) * 100).toBeLessThan(0.5);
  });

  it("обикновена почва: 1 m³ плътен → 1,25 разрохкан → 0,90 уплътнен", () => {
    expect(looseToCompacted(1.25, 0.72)).toBeCloseTo(0.9, 12);
  });
});

describe("задачи от главата", () => {
  it("вибрационна плоча: 12,45 m³/h", () => {
    // 0,5 · 1,2 · 100 / 4 = 15; · 0,83 = 12,45
    const q = compactorProduction({
      widthM: 0.5,
      speedKmh: 1.2,
      liftMm: 100,
      passes: 4,
      efficiency: 0.83,
    });
    expect(q).toBeCloseTo(12.45, 10);
    // 112,05 / 12,45 = 9
    expect(112.05 / q).toBeCloseTo(9, 10);
  });

  it("насип: брой пластове и време", () => {
    // 1200 / 150 = 8 пласта
    expect(numberOfLifts(1200, 150)).toBe(8);
    expect(numberOfLifts(1250, 150)).toBe(9);
    // насипан пласт 1,5–2 пъти по-дебел: 225–300 mm
    expect(150 * 1.5).toBeCloseTo(225, 12);
    expect(150 * 2).toBeCloseTo(300, 12);
    // пласт 12 m × 600 m × 0,15 m = 1080 m³; 1080 / 112,05 = 9,64 h;
    // с два валяка 4,82 h
    expect(12 * 600 * 0.15).toBeCloseTo(1080, 10);
    expect(compactionTime(1080, 112.05)).toBeCloseTo(9.64, 2);
    expect(compactionTime(1080, 112.05, 2)).toBeCloseTo(4.82, 2);
  });

  it("„В реалния живот“ – границата между 3 и 4 валяка", () => {
    // три валяка поемат 336,15 m³/h уплътнен = 336,15 / 0,86 = 390,87 m³/h разрохкан
    expect(336.15 / 0.86).toBeCloseTo(390.87, 2);
    // 7 минавания вместо 8: 1,8 · 4 · 150 / 7 = 154,29; · 0,83 = 128,06 m³/h
    // (същото като 135 · 8/7 · 0,83)
    const q7 = compactorProduction({
      widthM: 1.8,
      speedKmh: 4,
      liftMm: 150,
      passes: 7,
      efficiency: 0.83,
    });
    expect(q7).toBeCloseTo(128.06, 2);
    expect(((135 * 8) / 7) * 0.83).toBeCloseTo(q7, 10);
    // 344 / 128,06 = 2,69 → 3 валяка
    const n = compactorsRequired(400, 0.86, 128.06);
    expect(n.exact).toBeCloseTo(2.69, 2);
    expect(n.count).toBe(3);
  });

  it("въпроси за самопроверка", () => {
    // „Леко“ 2: 2,0 · 5 · 200 / 10 = 200 m³/h
    expect(
      compactorProduction({ widthM: 2, speedKmh: 5, liftMm: 200, passes: 10 }),
    ).toBeCloseTo(200, 10);
    // „Леко“ 3: 200 · 0,75 = 150 m³/h
    expect(
      compactorProduction({
        widthM: 2,
        speedKmh: 5,
        liftMm: 200,
        passes: 10,
        efficiency: 0.75,
      }),
    ).toBeCloseTo(150, 10);
    // „Леко“ 4: 500 · 0,72 = 360; 360 / 150 = 2,4 → 3
    const n = compactorsRequired(500, 0.72, 150);
    expect(n.compactedRate).toBeCloseTo(360, 10);
    expect(n.exact).toBeCloseTo(2.4, 10);
    expect(n.count).toBe(3);
    // „Подробно“ 2: W = 1,7 − 0,3 = 1,4; 1,4 · 5 · 200 · 0,83 / 7 = 166
    expect(effectiveWidth(1.7, 0.3)).toBeCloseTo(1.4, 12);
    expect(
      compactorProduction({
        widthM: 1.4,
        speedKmh: 5,
        liftMm: 200,
        passes: 7,
        efficiency: 0.83,
      }),
    ).toBeCloseTo(166, 10);
    // „Подробно“ 3: скорости 6 и 12 → аритметична 9, действителна 8
    expect(arithmeticMeanSpeed([6, 12])).toBeCloseTo(9, 12);
    expect(harmonicMeanSpeed([6, 12])).toBeCloseTo(8, 12);
    // „Подробно“ 4: 300 · 0,63 = 189; 189 / 60 = 3,15 → 4; 189 / 63 = 3 → 3
    expect(compactorsRequired(300, 0.63, 60).count).toBe(4);
    expect(compactorsRequired(300, 0.63, 63).exact).toBeCloseTo(3, 10);
    expect(compactorsRequired(300, 0.63, 63).count).toBe(3);
  });
});

describe("граници и свойства", () => {
  const base = { widthM: 1.8, speedKmh: 4, liftMm: 150, passes: 8 };

  it("пропорционалности", () => {
    const q = compactorProduction(base);
    expect(compactorProduction({ ...base, passes: 16 })).toBeCloseTo(q / 2, 10);
    expect(compactorProduction({ ...base, speedKmh: 8 })).toBeCloseTo(
      2 * q,
      10,
    );
    expect(compactorProduction({ ...base, liftMm: 75 })).toBeCloseTo(q / 2, 10);
    expect(compactorProduction({ ...base, efficiency: 0.5 })).toBeCloseTo(
      q / 2,
      10,
    );
  });

  it("без застъпване широчината е тази на бандажа", () => {
    expect(effectiveWidth(2.1, 0)).toBeCloseTo(2.1, 12);
  });

  it("точно кратен обем не добавя машина", () => {
    // 270 · 1 / 135 = 2 → 2, не 3
    expect(compactorsRequired(270, 1, 135).count).toBe(2);
    expect(compactorsRequired(270.5, 1, 135).count).toBe(3);
  });

  it("константите за превръщане", () => {
    expect(KMH_PER_MPH).toBeCloseTo(1.609, 3);
  });

  it("невалидни входни данни", () => {
    expect(() => compactorProduction({ ...base, passes: 0 })).toThrow();
    expect(() => compactorProduction({ ...base, widthM: -1 })).toThrow();
    expect(() => compactorProduction({ ...base, efficiency: 1.2 })).toThrow();
    expect(() => compactorProduction({ ...base, efficiency: 0 })).toThrow();
    expect(() =>
      compactorProduction({ ...base, liftMm: Number.NaN }),
    ).toThrow();
    expect(() => effectiveWidth(2, 2)).toThrow();
    expect(() => effectiveWidth(2, -0.1)).toThrow();
    expect(() => efficiencyFromMinutes(61)).toThrow();
    expect(() => arithmeticMeanSpeed([])).toThrow();
    expect(() => harmonicMeanSpeed([5, 0])).toThrow();
    expect(() => compactorsRequired(100, 0.8, 0)).toThrow();
    expect(() => looseToCompactedFactor(-0.1, 0.9)).toThrow();
    expect(() => compactionTime(100, 50, 1.5)).toThrow();
    expect(() => numberOfLifts(0, 150)).toThrow();
  });
});
