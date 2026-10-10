import { describe, expect, it } from "vitest";
import {
  actualOutput,
  bankFromCompacted,
  bankFromLoose,
  bucketPayload,
  bucketsPerTruck,
  compactedFromBank,
  cyclesPerHour,
  excavatorIdealOutput,
  fleetOutput,
  hoursForVolume,
  loadFactor,
  loaderIdealOutput,
  loadingTimePerTruck,
  looseDensity,
  looseFromBank,
  massOutput,
  swellFromLoadFactor,
  timeEfficiency,
  travelTimeMinutes,
  truckCycleTime,
  truckLoad,
  trucksRequired,
  trucksRequiredExact,
  truckWaitPerTrip,
} from "@/lib/engineering/earthmoving";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Единици: m³, t, t/m³, km, km/h, s (цикъл на багера), min, m³/h.

describe("трите състояния на почвата", () => {
  it("числата от загадката и фигурата: 100 → 125 → 90 m³", () => {
    // разбухване 25 %: 100·1,25 = 125 m³ разрохкан
    expect(looseFromBank(100, 0.25)).toBeCloseTo(125, 10);
    // свиване 0,9: 100·0,9 = 90 m³ уплътнен
    expect(compactedFromBank(100, 0.9)).toBeCloseTo(90, 10);
    // от разрохкано към уплътнено: 0,9/1,25 = 0,72 → 125·0,72 = 90
    expect(compactedFromBank(bankFromLoose(125, 0.25), 0.9)).toBeCloseTo(
      90,
      10,
    );
    expect(0.9 / 1.25).toBeCloseTo(0.72, 12);
  });

  it("преводен коефициент k_пл = 1/(1 + s)", () => {
    // 25 % → 1/1,25 = 0,80; 40 % → 1/1,4 = 0,714; 30 % → 0,769; 100 % → 0,5
    expect(loadFactor(0.25)).toBeCloseTo(0.8, 12);
    expect(loadFactor(0.4)).toBeCloseTo(0.714, 3);
    expect(loadFactor(0.3)).toBeCloseTo(0.769, 3);
    expect(loadFactor(1)).toBeCloseTo(0.5, 12);
    // без разбухване обемът не се мени
    expect(loadFactor(0)).toBe(1);
    // обратната връзка
    expect(swellFromLoadFactor(0.8)).toBeCloseTo(0.25, 12);
    expect(swellFromLoadFactor(loadFactor(0.37))).toBeCloseTo(0.37, 12);
  });

  it("двата пътя към плътния обем дават едно и също", () => {
    for (const s of [0.1, 0.25, 0.4, 0.65]) {
      expect(bankFromLoose(240, s)).toBeCloseTo(240 * loadFactor(s), 10);
      expect(bankFromLoose(looseFromBank(73, s), s)).toBeCloseTo(73, 10);
    }
  });

  it("примерите от наръчника на производителя", () => {
    // 1000 m³ плътен, 20 % → 1200 разрохкан; 1000 разрохкан, 25 % → 800 плътен
    expect(looseFromBank(1000, 0.2)).toBeCloseTo(1200, 10);
    expect(bankFromLoose(1000, 0.25)).toBeCloseTo(800, 10);
    // насип 10 000 уплътнени при k_у = 0,80 → 12 500 плътни
    expect(bankFromCompacted(10000, 0.8)).toBeCloseTo(12500, 8);
    // плътност 4125 при 35 % → 4125/1,35 = 3056 (единицата е без значение)
    expect(looseDensity(4125, 0.35)).toBeCloseTo(3056, 0);
  });

  it("насипът от „Подробно“: 4500 уплътнени → 5000 плътни → 6250 разрохкани", () => {
    // 4500/0,9 = 5000; 5000·1,25 = 6250
    const bank = bankFromCompacted(4500, 0.9);
    expect(bank).toBeCloseTo(5000, 9);
    expect(looseFromBank(bank, 0.25)).toBeCloseTo(6250, 9);
  });

  it("плътност в разрохкано състояние: 2,1/1,25 = 1,68 t/m³", () => {
    expect(looseDensity(2.1, 0.25)).toBeCloseTo(1.68, 12);
    // масата се запазва: 1 m³ плътен = 1,25 m³ разрохкан = 2,1 t
    expect(looseFromBank(1, 0.25) * looseDensity(2.1, 0.25)).toBeCloseTo(
      2.1,
      12,
    );
  });

  it("въпроси: 200 m³ при 30 % → 260 m³; 900 уплътнени при 0,9 → 1000 → 1250", () => {
    expect(looseFromBank(200, 0.3)).toBeCloseTo(260, 10);
    expect(bankFromCompacted(900, 0.9)).toBeCloseTo(1000, 9);
    expect(looseFromBank(1000, 0.25)).toBeCloseTo(1250, 9);
  });
});

describe("кош, цикъл и производителност на багера", () => {
  it("пример 1: кош 1,0 m³, k_н = 1,05, цикъл 20 s, 50 min, разбухване 25 %", () => {
    // q_т = 1,0·1,05 = 1,05 m³
    expect(bucketPayload(1.0, 1.05)).toBeCloseTo(1.05, 12);
    // 3600/20 = 180 цикъла
    expect(cyclesPerHour(20)).toBeCloseTo(180, 12);
    // П₆₀ = 180·1,05 = 189 m³/h
    const ideal = excavatorIdealOutput(1.0, 1.05, 20);
    expect(ideal).toBeCloseTo(189, 10);
    // k_в = 50/60; П = 189·50/60 = 157,5 m³/h разрохкан
    const real = actualOutput(ideal, timeEfficiency(50));
    expect(real).toBeCloseTo(157.5, 10);
    // плътен: 157,5/1,25 = 126 m³/h; същото с k_пл = 0,8
    expect(bankFromLoose(real, 0.25)).toBeCloseTo(126, 10);
    expect(real * loadFactor(0.25)).toBeCloseTo(126, 10);
  });

  it("независим път: броене на цикли за 50 минути", () => {
    // 50 min = 3000 s → 150 цикъла по 1,05 m³ = 157,5 m³
    let volume = 0;
    for (let t = 20; t <= 3000; t += 20) volume += 1.05;
    expect(volume).toBeCloseTo(157.5, 8);
  });

  it("коефициент на използване по време", () => {
    // 50 min → 0,8333; 45 min → 0,75; 60 min → 1
    expect(timeEfficiency(50)).toBeCloseTo(0.8333, 4);
    expect(timeEfficiency(45)).toBeCloseTo(0.75, 12);
    expect(timeEfficiency(60)).toBe(1);
    expect(() => timeEfficiency(61)).toThrow();
  });

  it("примерът от полевия наръчник (§ 8-24): 55 → 45 → 32", () => {
    // 3600/14·0,25·0,85 = 54,6 ≈ 55; ·50/60 = 45,5; ·0,7 = 31,9 ≈ 32
    const ideal = excavatorIdealOutput(0.25, 0.85, 14);
    expect(ideal).toBeCloseTo(54.64, 2);
    const real = actualOutput(ideal, timeEfficiency(50));
    expect(Math.round(real * 0.7)).toBe(32);
  });

  it("въпрос: кош 0,8 m³, k_н = 0,9, цикъл 18 s → 144 m³/h", () => {
    // 0,8·0,9 = 0,72 m³; 3600/18 = 200; 200·0,72 = 144
    expect(bucketPayload(0.8, 0.9)).toBeCloseTo(0.72, 12);
    expect(excavatorIdealOutput(0.8, 0.9, 18)).toBeCloseTo(144, 10);
  });

  it("производителността е обратнопропорционална на цикъла", () => {
    expect(excavatorIdealOutput(1, 1.05, 40)).toBeCloseTo(189 / 2, 10);
  });

  it("време за котлована: 6300 m³ плътен при 100,8 m³/h → 62,5 h", () => {
    expect(hoursForVolume(6300, 100.8)).toBeCloseTo(62.5, 10);
  });
});

describe("товарач", () => {
  it("кош 3,0 m³, k_н = 0,9, цикъл 0,5 min → 324 → 270 m³/h → 432 t/h", () => {
    // 3,0·0,9 = 2,7 m³; 2,7·60/0,5 = 324; ·50/60 = 270; ·1,6 = 432
    const ideal = loaderIdealOutput(3.0, 0.9, 0.5);
    expect(ideal).toBeCloseTo(324, 10);
    const real = actualOutput(ideal, timeEfficiency(50));
    expect(real).toBeCloseTo(270, 10);
    expect(massOutput(real, 1.6)).toBeCloseTo(432, 10);
  });

  it("с пренасяне на 60 m: цикъл 1,25 min → 129,6 → 108 m³/h", () => {
    // с товар 8 km/h: 60·0,06/8 = 0,45 min; обратно 12 km/h: 0,30 min
    const there = travelTimeMinutes(0.06, 8);
    const back = travelTimeMinutes(0.06, 12);
    expect(there).toBeCloseTo(0.45, 12);
    expect(back).toBeCloseTo(0.3, 12);
    const cycle = 0.5 + there + back;
    expect(cycle).toBeCloseTo(1.25, 12);
    // 2,7·60/1,25 = 129,6; ·50/60 = 108
    const ideal = loaderIdealOutput(3.0, 0.9, cycle);
    expect(ideal).toBeCloseTo(129.6, 10);
    expect(actualOutput(ideal, timeEfficiency(50))).toBeCloseTo(108, 10);
  });

  it("формулата за багер и за товарач е една и съща в различни единици", () => {
    // 0,5 min = 30 s
    expect(loaderIdealOutput(3, 0.9, 0.5)).toBeCloseTo(
      excavatorIdealOutput(3, 0.9, 30),
      10,
    );
  });

  it("примерът от полевия наръчник (§ 5-15): 332 → 277", () => {
    // 2,5·1,05·60/0,475 = 331,6 ≈ 332; ·50/60 = 276,3 (там: 277 от 332)
    const ideal = loaderIdealOutput(2.5, 1.05, 0.475);
    expect(Math.round(ideal)).toBe(332);
    expect(actualOutput(332, timeEfficiency(50))).toBeCloseTo(276.7, 1);
  });
});

describe("самосвали и звено", () => {
  it("време за ход: 6 km при 32 и при 40 km/h", () => {
    // 60·6/32 = 11,25 min; 60·6/40 = 9 min
    expect(travelTimeMinutes(6, 32)).toBeCloseTo(11.25, 12);
    expect(travelTimeMinutes(6, 40)).toBeCloseTo(9, 12);
    expect(travelTimeMinutes(0, 40)).toBe(0);
  });

  it("превръщане на формулата от полевия наръчник: 800 ft при 25 mph → 0,36 min", () => {
    // 800/(88·25) = 0,3636 min; в SI: 0,24384 km при 40,2336 km/h
    const km = (800 * 0.3048) / 1000;
    const kmh = 25 * 1.609344;
    expect(travelTimeMinutes(km, kmh)).toBeCloseTo(800 / (88 * 25), 10);
    // 1 km/h = 1000/60 = 16,67 m/min
    expect(1000 / 60).toBeCloseTo(16.67, 2);
  });

  it("пример 2: товар на самосвала – 9 коша, 9,45 m³, 15,876 t", () => {
    // 10/1,05 = 9,52 → 9 коша; 9·1,05 = 9,45 m³; 9,45·1,68 = 15,876 t ≤ 18 t
    expect(bucketsPerTruck(10, 1.05)).toBe(9);
    const load = truckLoad(10, 18, 1.05, 1.68);
    expect(load.buckets).toBe(9);
    expect(load.volume).toBeCloseTo(9.45, 10);
    expect(load.mass).toBeCloseTo(15.876, 10);
    expect(load.withinPayload).toBe(true);
    // втори път за масата: 9,45/1,25 = 7,56 m³ плътен по 2,1 t/m³
    expect(bankFromLoose(9.45, 0.25) * 2.1).toBeCloseTo(15.876, 10);
    // десети кош: 10,5 m³ > 10 m³
    expect(10 * 1.05).toBeGreaterThan(10);
  });

  it("въпрос: тежък материал – ограничава масата, не обемът", () => {
    // кош 1,0 m³, ρ_р = 1,9: 10 коша = 19 t > 18 t → 9 коша = 17,1 t
    const load = truckLoad(10, 18, 1.0, 1.9);
    expect(bucketsPerTruck(10, 1.0)).toBe(10);
    expect(load.buckets).toBe(9);
    expect(load.mass).toBeCloseTo(17.1, 10);
    expect(load.withinPayload).toBe(false);
  });

  it("пример 2: време за един самосвал и цикъл", () => {
    // 9·20 s = 180 s = 3,0 min; + 0,75 min смяна = 3,75 min
    const tLoad = loadingTimePerTruck(9, 20, 0.75);
    expect(tLoad).toBeCloseTo(3.75, 12);
    // T_с = 3,75 + 11,25 + 1,0 + 9,0 = 25,0 min
    const cycle = truckCycleTime({
      loading: tLoad,
      haul: travelTimeMinutes(6, 32),
      dump: 1.0,
      back: travelTimeMinutes(6, 40),
    });
    expect(cycle).toBeCloseTo(25, 12);
  });

  it("пример 2: брой самосвали N = 1 + 25/3,75 = 7,67 → 8", () => {
    expect(trucksRequiredExact(25, 3.75)).toBeCloseTo(7.667, 3);
    expect(trucksRequired(25, 3.75)).toBe(8);
  });

  it("примерът от полевия наръчник (§ 10-10): 42 и 22 самосвала", () => {
    // 1 + 20,5/0,5 = 42; 1 + 21/1 = 22
    expect(trucksRequired(20.5, 0.5)).toBe(42);
    expect(trucksRequired(21, 1)).toBe(22);
    // производителност там: 2·60/0,5 = 240 и 3·60/1 = 180
    expect(fleetOutput(42, 2, 20.5, 0.5).fleet).toBeCloseTo(240, 10);
    expect(fleetOutput(22, 3, 21, 1).fleet).toBeCloseTo(180, 10);
  });

  it("въпрос: цикъл 20 min, товарене 4 min → 6 самосвала", () => {
    expect(trucksRequired(20, 4)).toBe(6);
  });

  it("пример 2: производителност на звеното", () => {
    // багерът: 9,45·60/3,75 = 151,2 m³/h; един самосвал: 9,45·60/25 = 22,68 m³/h
    const six = fleetOutput(6, 9.45, 25, 3.75);
    expect(six.loader).toBeCloseTo(151.2, 10);
    // 6·22,68 = 136,08 < 151,2 → ограничават самосвалите
    expect(six.trucks).toBeCloseTo(136.08, 10);
    expect(six.fleet).toBeCloseTo(136.08, 10);
    expect(six.limitedBy).toBe("trucks");
    // 7·22,68 = 158,76 > 151,2 → ограничава багерът
    const seven = fleetOutput(7, 9.45, 25, 3.75);
    expect(seven.trucks).toBeCloseTo(158.76, 10);
    expect(seven.fleet).toBeCloseTo(151.2, 10);
    expect(seven.limitedBy).toBe("loader");
    // 8·22,68 = 181,44; звеното остава 151,2
    const eight = fleetOutput(8, 9.45, 25, 3.75);
    expect(eight.trucks).toBeCloseTo(181.44, 10);
    expect(eight.fleet).toBeCloseTo(151.2, 10);
    // с 50 работни минути: 151,2·50/60 = 126,0 разрохкан; ·0,8 = 100,8 плътен
    const real = actualOutput(eight.fleet, timeEfficiency(50));
    expect(real).toBeCloseTo(126, 10);
    expect(real * loadFactor(0.25)).toBeCloseTo(100.8, 10);
  });

  it("смяната на самосвалите сваля производителността на багера от 189 на 151,2", () => {
    // без смяна: 9,45·60/3,0 = 189 = П₆₀ на багера
    expect((9.45 * 60) / loadingTimePerTruck(9, 20, 0)).toBeCloseTo(
      excavatorIdealOutput(1, 1.05, 20),
      10,
    );
    expect(fleetOutput(8, 9.45, 25, 3.75).loader / 189).toBeCloseTo(0.8, 10);
  });

  it("равновесният брой е T_с / t_т = 6,67 самосвала", () => {
    // 151,2/22,68 = 6,667 = 25/3,75
    expect(151.2 / 22.68).toBeCloseTo(25 / 3.75, 10);
    // при цяло отношение звеното е уравновесено
    expect(fleetOutput(5, 10, 20, 4).limitedBy).toBe("balanced");
  });

  it("чакане на самосвал: 8 самосвала → 5 min на курс; 7 → 1,25 min; 6 → 0", () => {
    // 8·3,75 − 25 = 5; 7·3,75 − 25 = 1,25
    expect(truckWaitPerTrip(8, 25, 3.75)).toBeCloseTo(5, 12);
    expect(truckWaitPerTrip(7, 25, 3.75)).toBeCloseTo(1.25, 12);
    expect(truckWaitPerTrip(6, 25, 3.75)).toBe(0);
  });

  it("независим път: симулация на опашката за 10 часа", () => {
    // Багерът обслужва по един самосвал за 3,75 min; останалата част от
    // курса е 21,25 min. Броим натоварените самосвали за 600 min.
    const simulate = (n: number) => {
      const ready = Array.from({ length: n }, () => 0);
      let free = 0;
      let loads = 0;
      for (;;) {
        ready.sort((a, b) => a - b);
        const start = Math.max(free, ready[0]!);
        if (start + 3.75 > 600) break;
        free = start + 3.75;
        ready[0] = free + 21.25;
        loads += 1;
      }
      return (loads * 9.45) / 10;
    };
    // 7 и 8 самосвала → около 151,2 m³/h; 6 самосвала → около 136,08 m³/h
    expect(simulate(7)).toBeCloseTo(151.2, 0);
    expect(simulate(8)).toBeCloseTo(151.2, 0);
    expect(simulate(6) / 136.08).toBeCloseTo(1, 1);
    expect(simulate(6)).toBeLessThan(simulate(7));
  });

  it("котлованът: 7875 m³ разрохкан = 834 курса", () => {
    // 6300·1,25 = 7875; 7875/9,45 = 833,3 → 834
    expect(looseFromBank(6300, 0.25)).toBeCloseTo(7875, 9);
    expect(Math.ceil(7875 / 9.45)).toBe(834);
  });
});

describe("проверка на входните данни", () => {
  it("отказва безсмислени стойности", () => {
    expect(() => looseFromBank(-1, 0.2)).toThrow();
    expect(() => loadFactor(-0.1)).toThrow();
    expect(() => swellFromLoadFactor(1.2)).toThrow();
    expect(() => bucketPayload(0, 1)).toThrow();
    expect(() => cyclesPerHour(0)).toThrow();
    expect(() => actualOutput(100, 1.1)).toThrow();
    expect(() => travelTimeMinutes(5, 0)).toThrow();
    expect(() => fleetOutput(0, 9, 25, 3)).toThrow();
    expect(() => fleetOutput(2.5, 9, 25, 3)).toThrow();
    expect(() => fleetOutput(3, 9, 2, 3)).toThrow();
    expect(() => trucksRequired(Number.NaN, 3)).toThrow();
  });
});
