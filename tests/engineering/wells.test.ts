import { describe, expect, it } from "vitest";
import {
  averageUnconfinedThickness,
  confinedDrawdownAt,
  confinedWellInflow,
  cubicMetersPerDayToLitersPerSecond,
  drainInflowOneSide,
  drainInflowTwoSides,
  equivalentRadius,
  litersPerSecondToCubicMetersPerDay,
  metersPerDayToMetersPerSecond,
  superposedDrawdown,
  unconfinedHeadAt,
  unconfinedWellInflow,
  wellNearRiverInflow,
  wellRowUnitDischarge,
} from "@/lib/engineering/wells";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Единици: m, m/d, m³/d; за помпите и l/s (1 l/s = 86,4 m³/d).
// Числата са тези от глава 14 на „Инженерна геология и хидрогеология“.

/**
 * НЕЗАВИСИМА ПРОВЕРКА 1 – напорен пласт. Законът на Дарси през цилиндър с
 * радиус r и височина m: Q = k·(dh/dr)·2π·r·m. Оттук dh = Q·dr / (2π·r·k·m).
 * Сумираме „съпротивлението“ dr / (2π·r·k·m) от r0 до R числено (средни точки
 * върху геометрична мрежа) и делим понижението на него. Не ползва логаритъм и
 * нищо от проверявания файл.
 */
function darcyConfinedNumeric(
  k: number,
  m: number,
  s0: number,
  r0: number,
  R: number,
  steps = 100_000,
): number {
  const ratio = Math.pow(R / r0, 1 / steps);
  let resistance = 0;
  let r = r0;
  for (let i = 0; i < steps; i++) {
    const next = r * ratio;
    const mid = (r + next) / 2;
    resistance += (next - r) / (2 * Math.PI * mid * k * m);
    r = next;
  }
  return s0 / resistance;
}

/**
 * НЕЗАВИСИМА ПРОВЕРКА 2 – безнапорен пласт. Стъпваме по радиуса от кладенеца
 * навън и трупаме нивото по закона на Дарси: dh/dr = Q / (2π·r·k·h) (метод на
 * средната точка). Връща височината на нивото при радиус R за даден дебит Q.
 */
function darcyUnconfinedHeadAtR(
  Q: number,
  k: number,
  h0: number,
  r0: number,
  R: number,
  steps = 100_000,
): number {
  const ratio = Math.pow(R / r0, 1 / steps);
  let r = r0;
  let h = h0;
  for (let i = 0; i < steps; i++) {
    const next = r * ratio;
    const dr = next - r;
    const slope1 = Q / (2 * Math.PI * r * k * h);
    const hMid = h + (slope1 * dr) / 2;
    const rMid = r + dr / 2;
    h += (Q / (2 * Math.PI * rMid * k * hMid)) * dr;
    r = next;
  }
  return h;
}

/**
 * НЕЗАВИСИМА ПРОВЕРКА 3 – дренаж. Плосък поток към дренажа на единица дължина:
 * q = k·h·(dh/dx). Стъпваме от дренажа (h0) на разстояние R и връщаме нивото.
 */
function darcyPlaneHeadAtR(
  q: number,
  k: number,
  h0: number,
  R: number,
  steps = 100_000,
): number {
  const dx = R / steps;
  let h = h0;
  for (let i = 0; i < steps; i++) {
    const hMid = h + (q / (k * h)) * (dx / 2);
    h += (q / (k * hMid)) * dx;
  }
  return h;
}

describe("мерни единици", () => {
  it("1 l/s = 86,4 m³/d и обратно", () => {
    // 1 l/s = 0,001 m³/s · 86 400 s/d = 86,4 m³/d
    expect(litersPerSecondToCubicMetersPerDay(1)).toBeCloseTo(86.4, 10);
    // 172,8 m³/d / 86,4 = 2 l/s (въпрос 3 в „Леко“)
    expect(cubicMetersPerDayToLitersPerSecond(172.8)).toBeCloseTo(2, 10);
    expect(
      litersPerSecondToCubicMetersPerDay(
        cubicMetersPerDayToLitersPerSecond(317.4),
      ),
    ).toBeCloseTo(317.4, 10);
  });

  it("k от m/d в m/s", () => {
    // 1 m/d = 1 / 86 400 m/s = 1,157·10⁻⁵ m/s
    expect(metersPerDayToMetersPerSecond(1)).toBeCloseTo(1.157e-5, 8);
    // 12 m/d = 12 / 86 400 = 1,389·10⁻⁴ m/s
    expect(metersPerDayToMetersPerSecond(12)).toBeCloseTo(1.389e-4, 7);
  });
});

describe("Дюпюи – напорен пласт", () => {
  const well = { k: 12, m: 8, s0: 4, r0: 0.15, R: 300 };

  it("Пример 1: Q = 317,4 m³/d = 3,67 l/s", () => {
    // 2π·12·8·4 = 2412,74; ln(300 / 0,15) = ln 2000 = 7,6009
    // Q = 2412,74 / 7,6009 = 317,4 m³/d; 317,4 / 86,4 = 3,67 l/s
    expect(2 * Math.PI * 12 * 8 * 4).toBeCloseTo(2412.74, 2);
    expect(Math.log(2000)).toBeCloseTo(7.6009, 4);
    const Q = confinedWellInflow(well);
    expect(Q).toBeCloseTo(317.4, 1);
    expect(cubicMetersPerDayToLitersPerSecond(Q)).toBeCloseTo(3.67, 2);
  });

  it("независима проверка: числено интегриране на закона на Дарси по радиуса", () => {
    const numeric = darcyConfinedNumeric(12, 8, 4, 0.15, 300);
    expect(numeric).toBeCloseTo(confinedWellInflow(well), 4);
    // и за друг набор от данни
    expect(darcyConfinedNumeric(3, 15, 2.5, 0.2, 80)).toBeCloseTo(
      confinedWellInflow({ k: 3, m: 15, s0: 2.5, r0: 0.2, R: 80 }),
      4,
    );
  });

  it("загадката в „Леко“: двойно по-широк кладенец дава само около 10 % повече", () => {
    // ln(300 / 0,30) = ln 1000 = 6,9078; Q = 2412,74 / 6,9078 = 349,3 m³/d
    // 349,3 / 317,4 = 1,10
    const wide = confinedWellInflow({ ...well, r0: 0.3 });
    expect(Math.log(1000)).toBeCloseTo(6.9078, 4);
    expect(wide).toBeCloseTo(349.3, 1);
    expect(wide / confinedWellInflow(well)).toBeCloseTo(1.1, 2);
  });

  it("слаба чувствителност към R: двойно по-голям R – около 8 % по-малък дебит", () => {
    // ln(600 / 0,15) = ln 4000 = 8,2940; Q = 2412,74 / 8,2940 = 290,9 m³/d
    // 290,9 / 317,4 = 0,917, т.е. с около 8 % по-малко
    const far = confinedWellInflow({ ...well, R: 600 });
    expect(Math.log(4000)).toBeCloseTo(8.294, 3);
    expect(far).toBeCloseTo(290.9, 1);
    expect(1 - far / confinedWellInflow(well)).toBeCloseTo(0.08, 2);
  });

  it("дебитът е правопропорционален на понижението", () => {
    expect(confinedWellInflow({ ...well, s0: 8 })).toBeCloseTo(
      2 * confinedWellInflow(well),
      9,
    );
    expect(confinedWellInflow({ ...well, s0: 0 })).toBe(0);
  });

  it("депресионна крива: s на 10 m от кладенеца е 1,79 m", () => {
    // s = s0·ln(R / r) / ln(R / r0) = 4·ln 30 / ln 2000 = 4·3,4012 / 7,6009 = 1,79 m
    const Q = confinedWellInflow(well);
    expect(Math.log(30)).toBeCloseTo(3.4012, 4);
    expect(confinedDrawdownAt({ Q, k: 12, m: 8, R: 300, r: 10 })).toBeCloseTo(
      1.79,
      2,
    );
    // граници: в кладенеца s = s0, на радиуса на влияние s = 0
    expect(confinedDrawdownAt({ Q, k: 12, m: 8, R: 300, r: 0.15 })).toBeCloseTo(
      4,
      10,
    );
    expect(confinedDrawdownAt({ Q, k: 12, m: 8, R: 300, r: 300 })).toBeCloseTo(
      0,
      12,
    );
  });

  it("въпрос 2 в „Леко“: Q = 91,0 m³/d", () => {
    // 2π·10·5·2 = 628,32; ln(200 / 0,2) = ln 1000 = 6,9078; Q = 628,32 / 6,9078 = 91,0
    expect(
      confinedWellInflow({ k: 10, m: 5, s0: 2, r0: 0.2, R: 200 }),
    ).toBeCloseTo(91.0, 1);
  });
});

describe("Дюпюи – безнапорен пласт", () => {
  const well = { k: 20, he: 10, s0: 3, r0: 0.15, R: 300 };

  it("Пример 2: Q = 421,6 m³/d = 4,88 l/s", () => {
    // π·20·(2·10 − 3)·3 = π·1020 = 3204,42; ln 2000 = 7,6009
    // Q = 3204,42 / 7,6009 = 421,6 m³/d; 421,6 / 86,4 = 4,88 l/s
    expect(Math.PI * 1020).toBeCloseTo(3204.42, 2);
    const Q = unconfinedWellInflow(well);
    expect(Q).toBeCloseTo(421.6, 1);
    expect(cubicMetersPerDayToLitersPerSecond(Q)).toBeCloseTo(4.88, 2);
  });

  it("осреднена дебелина he − s0/2 и връзката с формулата за напорен пласт", () => {
    // 10 − 3 / 2 = 8,5 m; напорен пласт с m = 8,5 m дава същия дебит
    expect(averageUnconfinedThickness(10, 3)).toBeCloseTo(8.5, 12);
    expect(
      confinedWellInflow({ k: 20, m: 8.5, s0: 3, r0: 0.15, R: 300 }),
    ).toBeCloseTo(unconfinedWellInflow(well), 9);
  });

  it("записът с квадратите: π·k·(he² − h0²) / ln(R / r0)", () => {
    // he² − h0² = 100 − 49 = 51 = (2·10 − 3)·3
    const viaSquares =
      (Math.PI * 20 * (10 ** 2 - 7 ** 2)) / Math.log(300 / 0.15);
    expect(unconfinedWellInflow(well)).toBeCloseTo(viaSquares, 9);
  });

  it("независима проверка: Дарси стъпка по стъпка от кладенеца стига he при R", () => {
    const Q = unconfinedWellInflow(well);
    expect(darcyUnconfinedHeadAtR(Q, 20, 7, 0.15, 300)).toBeCloseTo(10, 5);
    const other = { k: 4, he: 6, s0: 2.5, r0: 0.3, R: 90 };
    expect(
      darcyUnconfinedHeadAtR(unconfinedWellInflow(other), 4, 3.5, 0.3, 90),
    ).toBeCloseTo(6, 5);
  });

  it("загадката в „Подробно“: двойно понижение – само 1,647 пъти по-голям дебит", () => {
    // π·20·(20 − 6)·6 = π·1680 = 5277,88; Q = 5277,88 / 7,6009 = 694,4 m³/d
    // 694,4 / 421,6 = 1,647 = 84 / 51
    const deep = unconfinedWellInflow({ ...well, s0: 6 });
    expect(Math.PI * 1680).toBeCloseTo(5277.88, 2);
    expect(deep).toBeCloseTo(694.4, 1);
    expect(deep / unconfinedWellInflow(well)).toBeCloseTo(1.647, 3);
    expect(deep / unconfinedWellInflow(well)).toBeCloseTo(84 / 51, 12);
  });

  it("депресионна крива: на 10 m от кладенеца h = 8,79 m, s = 1,21 m", () => {
    // h² = he² − (he² − h0²)·ln(R / r) / ln(R / r0) = 100 − 51·3,4012 / 7,6009
    //    = 100 − 22,821 = 77,179; h = 8,79 m; s = 10 − 8,79 = 1,21 m
    const Q = unconfinedWellInflow(well);
    const h = unconfinedHeadAt({ Q, k: 20, he: 10, R: 300, r: 10 });
    expect(h * h).toBeCloseTo(77.179, 3);
    expect(h).toBeCloseTo(8.79, 2);
    expect(10 - h).toBeCloseTo(1.21, 2);
    // граници: h0 = 7 m в кладенеца и he = 10 m на радиуса на влияние
    expect(unconfinedHeadAt({ Q, k: 20, he: 10, R: 300, r: 0.15 })).toBeCloseTo(
      7,
      10,
    );
    expect(unconfinedHeadAt({ Q, k: 20, he: 10, R: 300, r: 300 })).toBeCloseTo(
      10,
      12,
    );
  });

  it("въпрос 1 в „Подробно“: Q = 191,0 m³/d", () => {
    // π·15·(16 − 2)·2 = π·420 = 1319,47; ln(250 / 0,25) = ln 1000 = 6,9078
    // Q = 1319,47 / 6,9078 = 191,0 m³/d
    expect(Math.PI * 420).toBeCloseTo(1319.47, 2);
    expect(
      unconfinedWellInflow({ k: 15, he: 8, s0: 2, r0: 0.25, R: 250 }),
    ).toBeCloseTo(191.0, 1);
  });
});

describe("Форхаймер – кладенец до река", () => {
  it("Пример 3: Q = 479,4 m³/d = 5,55 l/s, с около 14 % повече", () => {
    // ln(2·60 / 0,15) = ln 800 = 6,6846; Q = 3204,42 / 6,6846 = 479,4 m³/d
    // 479,4 / 86,4 = 5,55 l/s; 479,4 / 421,6 = 1,137
    const Q = wellNearRiverInflow({ k: 20, he: 10, s0: 3, r0: 0.15, L: 60 });
    expect(Math.log(800)).toBeCloseTo(6.6846, 4);
    expect(Q).toBeCloseTo(479.4, 1);
    expect(cubicMetersPerDayToLitersPerSecond(Q)).toBeCloseTo(5.55, 2);
    const far = unconfinedWellInflow({
      k: 20,
      he: 10,
      s0: 3,
      r0: 0.15,
      R: 300,
    });
    expect(Q / far).toBeCloseTo(1.137, 3);
  });

  it("съвпада с Дюпюи при R = 2L", () => {
    const river = wellNearRiverInflow({
      k: 20,
      he: 10,
      s0: 3,
      r0: 0.15,
      L: 150,
    });
    const dupuit = unconfinedWellInflow({
      k: 20,
      he: 10,
      s0: 3,
      r0: 0.15,
      R: 300,
    });
    expect(river).toBeCloseTo(dupuit, 9);
  });

  it("независима проверка: огледален кладенец и събиране на he² − h²", () => {
    // За безнапорен пласт се събират разликите he² − h²: реалният кладенец дава
    // (Q/πk)·ln(R/r), огледалният (нагнетателен) – минус (Q/πk)·ln(R/r').
    // При стената на реалния кладенец r = r0 и r' = 2L, а R се съкращава.
    const k = 20;
    const he = 10;
    const L = 60;
    const r0 = 0.15;
    const Q = wellNearRiverInflow({ k, he, s0: 3, r0, L });
    const R = 5000; // произволен, съкращава се
    const real = (Q / (Math.PI * k)) * Math.log(R / r0);
    const image = -(Q / (Math.PI * k)) * Math.log(R / (2 * L));
    expect(Math.sqrt(he * he - (real + image))).toBeCloseTo(7, 9);
    // на реката (r = r' = L) двете се унищожават – нивото остава he
    const atRiver =
      (Q / (Math.PI * k)) * Math.log(R / L) -
      (Q / (Math.PI * k)) * Math.log(R / L);
    expect(atRiver).toBe(0);
  });

  it("въпрос 2 в „Подробно“: Q = 220,2 m³/d", () => {
    // ln(2·50 / 0,25) = ln 400 = 5,9915; Q = 1319,47 / 5,9915 = 220,2 m³/d
    expect(Math.log(400)).toBeCloseTo(5.9915, 4);
    expect(
      wellNearRiverInflow({ k: 15, he: 8, s0: 2, r0: 0.25, L: 50 }),
    ).toBeCloseTo(220.2, 1);
  });
});

describe("хоризонтален дренаж", () => {
  const drain = { k: 6, B: 40, he: 5, h0: 1, R: 60 };

  it("Пример 4: 48 m³/d от едната страна, 96 m³/d от двете", () => {
    // 40·6·(5² − 1²) / (2·60) = 240·24 / 120 = 48 m³/d; двойно: 96 m³/d
    expect(drainInflowOneSide(drain)).toBeCloseTo(48, 10);
    expect(drainInflowTwoSides(drain)).toBeCloseTo(96, 10);
  });

  it("независима проверка: Дарси в плосък поток стига he на разстояние R", () => {
    // на единица дължина q = 48 / 40 = 1,2 m²/d
    const q = drainInflowOneSide(drain) / drain.B;
    expect(q).toBeCloseTo(1.2, 12);
    expect(darcyPlaneHeadAtR(q, 6, 1, 60)).toBeCloseTo(5, 5);
  });

  it("въпрос 3 в „Подробно“: 10 m³/d и 20 m³/d", () => {
    // 25·4·(3² − 1²) / (2·40) = 100·8 / 80 = 10 m³/d
    const d = { k: 4, B: 25, he: 3, h0: 1, R: 40 };
    expect(drainInflowOneSide(d)).toBeCloseTo(10, 10);
    expect(drainInflowTwoSides(d)).toBeCloseTo(20, 10);
  });

  it("без понижение няма приток", () => {
    expect(drainInflowOneSide({ ...drain, h0: 5 })).toBe(0);
  });
});

describe("изкоп като „голям кладенец“", () => {
  it("приведен радиус: 30 × 20 m → 13,82 m; 40 × 25 m → 17,84 m", () => {
    // F = 600 m²; 600 / π = 190,99; √190,99 = 13,82 m
    expect(600 / Math.PI).toBeCloseTo(190.99, 2);
    expect(equivalentRadius(600)).toBeCloseTo(13.82, 2);
    // F = 1000 m²; 1000 / π = 318,31; √318,31 = 17,84 m (въпрос 4 в „Подробно“)
    expect(equivalentRadius(1000)).toBeCloseTo(17.84, 2);
    // кръг с този радиус има същата площ
    expect(Math.PI * equivalentRadius(600) ** 2).toBeCloseTo(600, 9);
  });

  it("„В реалния живот“: Q = 183,1 m³/d = 2,12 l/s", () => {
    // rп = 13,82 m; ln(120 / 13,82) = ln 8,683 = 2,1614
    // π·8·(2·6 − 1,5)·1,5 = π·126 = 395,84; Q = 395,84 / 2,1614 = 183,1 m³/d
    // 183,1 / 86,4 = 2,12 l/s – под границата 4–5 l/s за открито отводняване
    expect(Math.log(120 / 13.82)).toBeCloseTo(2.1614, 4);
    expect(Math.PI * 126).toBeCloseTo(395.84, 2);
    const Q = unconfinedWellInflow({
      k: 8,
      he: 6,
      s0: 1.5,
      r0: equivalentRadius(600),
      R: 120,
    });
    expect(Q).toBeCloseTo(183.1, 1);
    expect(cubicMetersPerDayToLitersPerSecond(Q)).toBeCloseTo(2.12, 2);
    expect(cubicMetersPerDayToLitersPerSecond(Q)).toBeLessThan(4);
    // със закръгления радиус 13,82 m резултатът е същият до 0,1 m³/d
    expect(
      unconfinedWellInflow({ k: 8, he: 6, s0: 1.5, r0: 13.82, R: 120 }),
    ).toBeCloseTo(183.1, 1);
  });
});

describe("взаимодействащи кладенци – суперпозиция", () => {
  it("Пример 5: два кладенеца по 300 m³/d, в средата s = 2,69 m", () => {
    // 2π·12·8 = 603,19; ln(300 / 20) = ln 15 = 2,7081
    // s₁ = 300·2,7081 / 603,19 = 812,43 / 603,19 = 1,347 m; s = 2·1,347 = 2,694 ≈ 2,69 m
    expect(2 * Math.PI * 96).toBeCloseTo(603.19, 2);
    expect(Math.log(15)).toBeCloseTo(2.7081, 4);
    const s1 = confinedDrawdownAt({ Q: 300, k: 12, m: 8, R: 300, r: 20 });
    expect(s1).toBeCloseTo(1.347, 3);
    expect(superposedDrawdown([s1, s1])).toBeCloseTo(2.69, 2);
  });

  it("сборът е обикновена сума", () => {
    expect(superposedDrawdown([])).toBe(0);
    expect(superposedDrawdown([0.5, 1.25, 0.25])).toBeCloseTo(2, 12);
  });
});

describe("ред от кладенци като дренаж", () => {
  it("q = Q / σ с дебита на ЕДИН кладенец: 100 m³/d през 20 m → 5 m²/d", () => {
    // баланс на водата: 10 кладенеца по 100 m³/d на дължина 10·20 = 200 m
    // q = 1000 / 200 = 5 m²/d = 100 / 20; със „сумарния“ дебит би излязло 50
    const q = wellRowUnitDischarge({ wellDischarge: 100, spacing: 20 });
    expect(q).toBeCloseTo(5, 12);
    expect(q).toBeCloseTo((10 * 100) / (10 * 20), 12);
    expect(q).not.toBeCloseTo(1000 / 20, 6);
  });

  it("отхвърля нулево разстояние", () => {
    expect(() =>
      wellRowUnitDischarge({ wellDischarge: 100, spacing: 0 }),
    ).toThrow();
  });
});

describe("проверка на входните данни", () => {
  it("отхвърля невъзможни стойности", () => {
    expect(() =>
      confinedWellInflow({ k: 0, m: 8, s0: 4, r0: 0.15, R: 300 }),
    ).toThrow();
    expect(() =>
      confinedWellInflow({ k: 12, m: 8, s0: -1, r0: 0.15, R: 300 }),
    ).toThrow();
    expect(() =>
      confinedWellInflow({ k: 12, m: 8, s0: 4, r0: 300, R: 300 }),
    ).toThrow();
    expect(() =>
      unconfinedWellInflow({ k: 20, he: 10, s0: 10, r0: 0.15, R: 300 }),
    ).toThrow();
    expect(() =>
      unconfinedWellInflow({ k: 20, he: 10, s0: 3, r0: 0.15, R: 0.1 }),
    ).toThrow();
    expect(() =>
      wellNearRiverInflow({ k: 20, he: 10, s0: 3, r0: 0.15, L: 0.05 }),
    ).toThrow();
    expect(() =>
      drainInflowOneSide({ k: 6, B: 40, he: 5, h0: 6, R: 60 }),
    ).toThrow();
    expect(() => equivalentRadius(0)).toThrow();
    expect(() =>
      confinedDrawdownAt({ Q: 300, k: 12, m: 8, R: 300, r: 301 }),
    ).toThrow();
    expect(() =>
      unconfinedHeadAt({ Q: 1e6, k: 20, he: 10, R: 300, r: 1 }),
    ).toThrow();
    expect(() => superposedDrawdown([1, Number.NaN])).toThrow();
    expect(() =>
      cubicMetersPerDayToLitersPerSecond(Number.POSITIVE_INFINITY),
    ).toThrow();
  });
});
