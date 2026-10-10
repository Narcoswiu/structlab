import { describe, expect, it } from "vitest";
import {
  FILTRATION_COEFFICIENT_RANGES,
  SECONDS_PER_DAY,
  actualVelocity,
  centimetersPerSecondToMetersPerDay,
  chezyKrasnopolskiVelocity,
  classifyByFiltrationCoefficient,
  cubicMetersPerDayToLitersPerSecond,
  darcyDischarge,
  darcyVelocity,
  filtrationCoefficientFromTest,
  flowArea,
  hydraulicGradient,
  hydraulicHead,
  levelConductivity,
  metersPerDayToMetersPerSecond,
  metersPerSecondToMetersPerDay,
  transmissivity,
  travelTime,
  unitDischarge,
  velocityHead,
} from "@/lib/engineering/filtration";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Единици: m, d, m/d, m³/d, m²/d; градиентът и порестостта са безразмерни.

describe("превръщане на единици", () => {
  it("денонощието има 86 400 секунди", () => {
    // 24 · 60 · 60 = 1440 · 60 = 86 400
    expect(SECONDS_PER_DAY).toBe(24 * 60 * 60);
  });

  it("m/d ↔ m/s", () => {
    // 1 m/d = 1/86 400 m/s = 1,1574·10⁻⁵ m/s (в главата: 1,16·10⁻⁵)
    expect(metersPerDayToMetersPerSecond(1)).toBeCloseTo(1.1574e-5, 9);
    // 10 m/d = 1,1574·10⁻⁴ m/s (в главата: 1,16·10⁻⁴)
    expect(metersPerDayToMetersPerSecond(10)).toBeCloseTo(1.1574e-4, 8);
    // 10⁻⁴ m/s · 86 400 = 8,64 m/d
    expect(metersPerSecondToMetersPerDay(1e-4)).toBeCloseTo(8.64, 10);
    // отиване и връщане
    expect(
      metersPerSecondToMetersPerDay(metersPerDayToMetersPerSecond(37.5)),
    ).toBeCloseTo(37.5, 10);
  });

  it("cm/s → m/d", () => {
    // 1 cm/s = 0,01 m/s = 864 m/d; 0,01 cm/s = 8,64 m/d
    expect(centimetersPerSecondToMetersPerDay(1)).toBeCloseTo(864, 9);
    expect(centimetersPerSecondToMetersPerDay(0.01)).toBeCloseTo(8.64, 10);
  });

  it("m³/d → l/s", () => {
    // 45 m³/d = 45 000 l / 86 400 s = 0,5208 l/s (в главата: 0,52)
    expect(cubicMetersPerDayToLitersPerSecond(45)).toBeCloseTo(0.5208, 4);
    // 240 m³/d = 240 000 / 86 400 = 2,7778 l/s (в главата: 2,78)
    expect(cubicMetersPerDayToLitersPerSecond(240)).toBeCloseTo(2.7778, 4);
    // 86,4 m³/d е точно 1 l/s
    expect(cubicMetersPerDayToLitersPerSecond(86.4)).toBeCloseTo(1, 12);
  });

  it("таблицата в лекцията е вътрешно съгласувана: m/s = m/d : 86 400", () => {
    // 0,01 m/d → 1,16·10⁻⁷; 5 m/d → 5,79·10⁻⁵; 30 m/d → 3,47·10⁻⁴;
    // 100 m/d → 1,16·10⁻³; 200 m/d → 2,31·10⁻³
    expect(metersPerDayToMetersPerSecond(0.01)).toBeCloseTo(1.16e-7, 9);
    expect(metersPerDayToMetersPerSecond(5)).toBeCloseTo(5.79e-5, 7);
    expect(metersPerDayToMetersPerSecond(30)).toBeCloseTo(3.47e-4, 6);
    expect(metersPerDayToMetersPerSecond(100)).toBeCloseTo(1.16e-3, 5);
    expect(metersPerDayToMetersPerSecond(200)).toBeCloseTo(2.31e-3, 5);
  });
});

describe("напор", () => {
  it("H = z + p/γw (въпрос за самопроверка)", () => {
    // z = 3 m, p = 49,05 kPa, γw = 9,81 kN/m³: p/γw = 5 m, H = 3 + 5 = 8 m
    expect(hydraulicHead(3, 49.05, 9.81)).toBeCloseTo(8, 10);
    // без налягане (точка на свободното ниво) напорът е самата височина
    expect(hydraulicHead(6.5, 0, 9.81)).toBe(6.5);
  });

  it("скоростната височина при подземни води е нищожна", () => {
    // v = 0,05 m/d = 0,05/86 400 = 5,787·10⁻⁷ m/s
    // v²/(2g) = (5,787·10⁻⁷)² / 19,62 = 3,349·10⁻¹³ / 19,62 = 1,707·10⁻¹⁴ m
    const v = metersPerDayToMetersPerSecond(0.05);
    expect(v).toBeCloseTo(5.787e-7, 10);
    const hv = velocityHead(v, 9.81);
    expect(hv / 1.707e-14).toBeCloseTo(1, 3);
    expect(hv).toBeLessThan(1e-13);
  });
});

describe("Пример 1 – два сондажа в безнапорен пласт", () => {
  // Нива над водоупора 6,5 m и 5,5 m, разстояние 200 m, k = 10 m/d, n₀ = 0,25.
  const I = hydraulicGradient(6.5 - 5.5, 200);
  const v = darcyVelocity(10, I);
  const u = actualVelocity(v, 0.25);

  it("градиент, фиктивна и действителна скорост", () => {
    // I = 1/200 = 0,005; v = 10 · 0,005 = 0,05 m/d; u = 0,05/0,25 = 0,2 m/d
    expect(I).toBeCloseTo(0.005, 12);
    expect(v).toBeCloseTo(0.05, 12);
    expect(u).toBeCloseTo(0.2, 12);
    // u/v = 1/n₀ = 4
    expect(u / v).toBeCloseTo(4, 12);
  });

  it("време за път от 200 m", () => {
    // t = 200 / 0,2 = 1000 d; 1000/365 = 2,74 години
    const t = travelTime(200, u);
    expect(t).toBeCloseTo(1000, 9);
    expect(t / 365).toBeCloseTo(2.74, 2);
    // с фиктивната скорост би излязло 200/0,05 = 4000 d – четири пъти повече
    expect(travelTime(200, v)).toBeCloseTo(4000, 9);
  });

  it("независима проверка: водата, минала през сечението, запълва порите", () => {
    // През 1 m² за 1000 d минава обем v·t = 0,05 · 1000 = 50 m³.
    // Той заема активните пори на призма с дължина 200 m: 200 · 1 · 0,25 = 50 m³.
    expect(v * travelTime(200, u)).toBeCloseTo(200 * 0.25, 9);
  });
});

describe("Пример 2 – опит в тръба с пясък", () => {
  // A = 100 cm², L = 50 cm, ΔH = 20 cm, Q = 0,4 cm³/s.
  it("коефициент на филтрация", () => {
    // I = 20/50 = 0,4; v = 0,4/100 = 0,004 cm/s; k = 0,004/0,4 = 0,01 cm/s
    expect(hydraulicGradient(20, 50)).toBeCloseTo(0.4, 12);
    const k = filtrationCoefficientFromTest(0.4, 100, 20, 50);
    expect(k).toBeCloseTo(0.01, 12);
    // 0,01 cm/s = 10⁻⁴ m/s = 8,64 m/d → ред „средни пясъци“ (5–30 m/d)
    const kPerDay = centimetersPerSecondToMetersPerDay(k);
    expect(kPerDay).toBeCloseTo(8.64, 10);
    expect(classifyByFiltrationCoefficient(kPerDay)).toBe("средни пясъци");
  });

  it("обратният път връща измерения разход", () => {
    // Q = k·I·A = 0,01 · 0,4 · 100 = 0,4 cm³/s
    expect(darcyDischarge(0.01, 0.4, 100)).toBeCloseTo(0.4, 12);
  });
});

describe("Пример 3 – напорен пласт", () => {
  // k = 25 m/d, m = 8 m, ΔH = 2 m на 500 m, B = 300 m, μ_ел = 0,0002, n₀ = 0,2.
  const I = hydraulicGradient(2, 500);
  const T = transmissivity(25, 8);

  it("проводимост, градиент и разход по два пътя", () => {
    // I = 2/500 = 0,004; T = 25 · 8 = 200 m²/d
    expect(I).toBeCloseTo(0.004, 12);
    expect(T).toBe(200);
    // първи път: v = 25 · 0,004 = 0,1 m/d; A = 300 · 8 = 2400 m²; Q = 240 m³/d
    const v = darcyVelocity(25, I);
    expect(v).toBeCloseTo(0.1, 12);
    expect(flowArea(300, 8)).toBe(2400);
    expect(darcyDischarge(25, I, flowArea(300, 8))).toBeCloseTo(240, 9);
    // втори път: q = m·v = 8 · 0,1 = 0,8 m²/d = T·I; Q = q·B = 0,8 · 300 = 240
    const q = unitDischarge(8, v);
    expect(q).toBeCloseTo(0.8, 12);
    expect(T * I).toBeCloseTo(q, 12);
    expect(q * 300).toBeCloseTo(240, 9);
  });

  it("действителна скорост и коефициент на пиезопредаване", () => {
    // u = 0,1/0,2 = 0,5 m/d; 500 m за 500/0,5 = 1000 d
    const u = actualVelocity(0.1, 0.2);
    expect(u).toBeCloseTo(0.5, 12);
    expect(travelTime(500, u)).toBeCloseTo(1000, 9);
    // a = 200 / 0,0002 = 1 000 000 m²/d – в границите 10⁴–10⁷ за напорни пластове
    const a = levelConductivity(T, 0.0002);
    expect(a).toBeCloseTo(1e6, 3);
    expect(a).toBeGreaterThanOrEqual(1e4);
    expect(a).toBeLessThanOrEqual(1e7);
  });
});

describe("В реалния живот – приток към изкоп край сондажите", () => {
  // k = 10 m/d, I = 0,005, h_ср = (6,5 + 5,5)/2 = 6 m, B = 150 m, μ_гр = 0,2.
  it("разход по два пътя", () => {
    // A = 150 · 6 = 900 m²; Q = 10 · 0,005 · 900 = 45 m³/d
    expect(darcyDischarge(10, 0.005, flowArea(150, 6))).toBeCloseTo(45, 9);
    // T = 10 · 6 = 60 m²/d; q = T·I = 0,3 m²/d = h·v = 6 · 0,05; Q = 0,3 · 150 = 45
    const T = transmissivity(10, 6);
    expect(T).toBe(60);
    expect(unitDischarge(6, 0.05)).toBeCloseTo(0.3, 12);
    expect(T * 0.005 * 150).toBeCloseTo(45, 9);
  });

  it("коефициент на нивопредаване", () => {
    // a = 60 / 0,2 = 300 m²/d – в границите 10²–10⁴ за безнапорни пластове
    const a = levelConductivity(60, 0.2);
    expect(a).toBeCloseTo(300, 9);
    expect(a).toBeGreaterThanOrEqual(1e2);
    expect(a).toBeLessThanOrEqual(1e4);
  });
});

describe("числата от въпросите за самопроверка", () => {
  it("„Леко“", () => {
    // ΔH = 0,5 m на 250 m: I = 0,002; k = 20 m/d: v = 0,04 m/d
    const I = hydraulicGradient(0.5, 250);
    expect(I).toBeCloseTo(0.002, 12);
    expect(darcyVelocity(20, I)).toBeCloseTo(0.04, 12);
    // n₀ = 0,2: u = 0,04/0,2 = 0,2 m/d
    expect(actualVelocity(0.04, 0.2)).toBeCloseTo(0.2, 12);
    // T = 30 · 12 = 360 m²/d
    expect(transmissivity(30, 12)).toBe(360);
  });

  it("„Подробно“", () => {
    // хидроизохипси 105 и 104 m на 50 m една от друга: I = 1/50 = 0,02
    const I = hydraulicGradient(105 - 104, 50);
    expect(I).toBeCloseTo(0.02, 12);
    // k = 5 m/d: v = 0,1 m/d
    expect(darcyVelocity(5, I)).toBeCloseTo(0.1, 12);
    // 2,5 m/d = 2,5/86 400 = 2,894·10⁻⁵ m/s (в главата: 2,89·10⁻⁵)
    expect(metersPerDayToMetersPerSecond(2.5)).toBeCloseTo(2.894e-5, 8);
    // Q = 15 · 0,01 · (40 · 5) = 30 m³/d; T = 15 · 5 = 75 m²/d; T·I·B = 30
    expect(darcyDischarge(15, 0.01, flowArea(40, 5))).toBeCloseTo(30, 9);
    expect(transmissivity(15, 5) * 0.01 * 40).toBeCloseTo(30, 9);
  });
});

describe("линейният закон и отклоненията от него", () => {
  it("при Дарси скоростта е пропорционална на градиента", () => {
    // двоен градиент → двойна скорост; k е скоростта при I = 1
    expect(darcyVelocity(10, 0.01)).toBeCloseTo(2 * darcyVelocity(10, 0.005));
    expect(darcyVelocity(7.3, 1)).toBe(7.3);
    expect(darcyVelocity(10, 0)).toBe(0);
  });

  it("при Шези–Краснополски четири пъти по-голям градиент дава двойна скорост", () => {
    // v = k_т·√I: √(4·I) = 2·√I
    const v1 = chezyKrasnopolskiVelocity(3, 2);
    const v2 = chezyKrasnopolskiVelocity(3, 8);
    expect(v2 / v1).toBeCloseTo(2, 12);
    // обратната форма I = (v/k_т)²
    expect((v1 / 3) ** 2).toBeCloseTo(2, 12);
  });

  it("числена проверка: наклонът на v(I) по Дарси е k навсякъде", () => {
    for (const I of [0.001, 0.01, 0.1, 1]) {
      const slope = (darcyVelocity(12, I + 1e-6) - darcyVelocity(12, I)) / 1e-6;
      expect(slope).toBeCloseTo(12, 5);
    }
  });
});

describe("таблица на коефициента на филтрация", () => {
  it("редове и празнини", () => {
    expect(classifyByFiltrationCoefficient(0.05)).toBe(
      "глинести почви, песъчливи глини",
    );
    expect(classifyByFiltrationCoefficient(0.5)).toBe(
      "прахови пясъци, глинести пясъци",
    );
    expect(classifyByFiltrationCoefficient(3)).toBe("дребни пясъци");
    expect(classifyByFiltrationCoefficient(10)).toBe("средни пясъци");
    expect(classifyByFiltrationCoefficient(25)).toBe("средни пясъци");
    expect(classifyByFiltrationCoefficient(150)).toBe(
      "едри и чакълести пясъци, чакъли с песъчлив запълнител",
    );
    // таблицата няма ред между 30 и 100 m/d, под 0,01 и над 200 m/d
    expect(classifyByFiltrationCoefficient(60)).toBeNull();
    expect(classifyByFiltrationCoefficient(0.001)).toBeNull();
    expect(classifyByFiltrationCoefficient(500)).toBeNull();
  });

  it("редовете са подредени и не се застъпват", () => {
    for (let i = 1; i < FILTRATION_COEFFICIENT_RANGES.length; i++) {
      expect(FILTRATION_COEFFICIENT_RANGES[i]!.from).toBeGreaterThanOrEqual(
        FILTRATION_COEFFICIENT_RANGES[i - 1]!.to,
      );
    }
  });
});

describe("невалидни входни данни", () => {
  it("хвърля грешка", () => {
    expect(() => hydraulicGradient(1, 0)).toThrow();
    expect(() => hydraulicGradient(-1, 10)).toThrow();
    expect(() => darcyVelocity(0, 0.1)).toThrow();
    expect(() => darcyVelocity(10, -0.1)).toThrow();
    expect(() => darcyDischarge(10, 0.1, 0)).toThrow();
    expect(() => actualVelocity(0.1, 0)).toThrow();
    expect(() => actualVelocity(0.1, 1)).toThrow();
    expect(() => actualVelocity(0.1, 25)).toThrow();
    expect(() => travelTime(10, 0)).toThrow();
    expect(() => transmissivity(10, 0)).toThrow();
    expect(() => levelConductivity(60, 0)).toThrow();
    expect(() => filtrationCoefficientFromTest(1, 1, 0, 1)).toThrow();
    expect(() => hydraulicHead(1, 10, 0)).toThrow();
    expect(() => metersPerDayToMetersPerSecond(Number.NaN)).toThrow();
    expect(() => classifyByFiltrationCoefficient(0)).toThrow();
  });
});
