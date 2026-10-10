/**
 * Филтрация и закон на Дарси (Инженерна геология и хидрогеология, Глава 13).
 *
 * Формулите са тези от лекциите на катедра „Геотехника“ на УАСГ (2018 г.),
 * въпрос 20 (напор, напорен градиент, разход, фиктивна и действителна
 * скорост) и въпрос 21 (закон на Дарси, коефициент на филтрация, проводимост,
 * коефициент на пиезо- и нивопредаване, закон на Шези–Краснополски).
 *
 * Мерни единици: дължини и напори в m, площи в m², време в ДЕНОНОЩИЯ (d),
 * коефициент на филтрация и скорости в m/d, разход в m³/d, единичен разход и
 * проводимост в m²/d. Напорният градиент и порестостта са безразмерни
 * (порестостта е част от единицата, не процент). Налягане в kPa, обемно тегло
 * в kN/m³. Функциите за превръщане са отделни и носят единиците в името си.
 *
 * Формулите за приток към кладенци не са тук – те са в отделна глава.
 *
 * Файлът е самостоятелен – не ползва други модули от lib/engineering.
 */

/** Секунди в едно денонощие: 24 · 60 · 60. */
export const SECONDS_PER_DAY = 86400;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Величината „${name}“ трябва да е крайно число.`);
  }
}

function assertPositive(value: number, name: string): void {
  assertFinite(value, name);
  if (value <= 0) {
    throw new Error(`Величината „${name}“ трябва да е положителна.`);
  }
}

function assertNonNegative(value: number, name: string): void {
  assertFinite(value, name);
  if (value < 0) {
    throw new Error(`Величината „${name}“ не може да е отрицателна.`);
  }
}

/**
 * Напор H = z + p/γw, m (въпрос 20; скоростната височина v²/2g е
 * пренебрегната). z е височината на точката над сравнителната равнина (m),
 * p е налягането на водата (kPa), γw е обемното тегло на водата (kN/m³).
 */
export function hydraulicHead(
  elevation: number,
  pressure: number,
  waterUnitWeight: number,
): number {
  assertFinite(elevation, "геометрична височина");
  assertNonNegative(pressure, "налягане на водата");
  assertPositive(waterUnitWeight, "обемно тегло на водата");
  return elevation + pressure / waterUnitWeight;
}

/**
 * Скоростна височина v²/(2g), m, при скорост в m/s и земно ускорение в m/s².
 * Служи само да се покаже колко е малка при подземните води.
 */
export function velocityHead(
  velocityMetersPerSecond: number,
  gravity: number,
): number {
  assertFinite(velocityMetersPerSecond, "скорост");
  assertPositive(gravity, "земно ускорение");
  return (velocityMetersPerSecond * velocityMetersPerSecond) / (2 * gravity);
}

/**
 * Среден напорен (хидравличен) градиент I = ΔH / Δl (въпрос 20).
 * headLoss е загубата на напор ΔH (m), pathLength е пътят на филтрация (m).
 */
export function hydraulicGradient(
  headLoss: number,
  pathLength: number,
): number {
  assertNonNegative(headLoss, "загуба на напор");
  assertPositive(pathLength, "път на филтрация");
  return headLoss / pathLength;
}

/**
 * Закон на Дарси: фиктивна скорост на филтрация v = k·I (въпрос 21).
 * k в m/d дава v в m/d.
 */
export function darcyVelocity(
  filtrationCoefficient: number,
  gradient: number,
): number {
  assertPositive(filtrationCoefficient, "коефициент на филтрация");
  assertNonNegative(gradient, "напорен градиент");
  return filtrationCoefficient * gradient;
}

/**
 * Закон на Дарси за разхода: Q = k·I·A (въпрос 21). k в m/d и A в m² дават
 * Q в m³/d.
 */
export function darcyDischarge(
  filtrationCoefficient: number,
  gradient: number,
  area: number,
): number {
  assertPositive(area, "площ на напречното сечение");
  return darcyVelocity(filtrationCoefficient, gradient) * area;
}

/**
 * Коефициент на филтрация от опит в тръба с пясък: от Q = k·A·ΔH/L следва
 * k = Q·L / (A·ΔH). Единицата на k е единицата на Q, разделена на единицата
 * на A (например cm³/s и cm² дават cm/s); L и ΔH са в една и съща единица.
 */
export function filtrationCoefficientFromTest(
  discharge: number,
  area: number,
  headLoss: number,
  pathLength: number,
): number {
  assertPositive(discharge, "разход");
  assertPositive(area, "площ на напречното сечение");
  assertPositive(headLoss, "загуба на напор");
  assertPositive(pathLength, "път на филтрация");
  return (discharge * pathLength) / (area * headLoss);
}

/**
 * Действителна скорост u = v / n₀ (въпрос 20), където n₀ е активната
 * (ефективната) порестост като част от единицата, 0 < n₀ < 1.
 */
export function actualVelocity(
  darcyVelocityValue: number,
  activePorosity: number,
): number {
  assertNonNegative(darcyVelocityValue, "фиктивна скорост");
  assertPositive(activePorosity, "активна порестост");
  if (activePorosity >= 1) {
    throw new Error(
      "Активната порестост е част от единицата и трябва да е под 1.",
    );
  }
  return darcyVelocityValue / activePorosity;
}

/** Време за изминаване на път L (m) със скорост u (m/d): t = L / u, d. */
export function travelTime(distance: number, velocity: number): number {
  assertNonNegative(distance, "път");
  assertPositive(velocity, "скорост");
  return distance / velocity;
}

/**
 * Площ на напречното сечение на потока A = B·h, m² (въпрос 20): B е
 * широчината на сечението, h е средната дебелина на водоносния пласт.
 */
export function flowArea(width: number, thickness: number): number {
  assertPositive(width, "широчина на сечението");
  assertPositive(thickness, "дебелина на пласта");
  return width * thickness;
}

/**
 * Единичен разход q = h·v, m²/d (въпрос 20) – разходът през сечение с
 * широчина 1 m.
 */
export function unitDischarge(
  thickness: number,
  darcyVelocityValue: number,
): number {
  assertPositive(thickness, "дебелина на пласта");
  assertNonNegative(darcyVelocityValue, "фиктивна скорост");
  return thickness * darcyVelocityValue;
}

/**
 * Проводимост на пласта, m²/d (въпрос 21): T = k·m за напорен пласт с
 * дебелина m и T = k·h_ср за безнапорен пласт със средна водонаситена
 * дебелина h_ср.
 */
export function transmissivity(
  filtrationCoefficient: number,
  thickness: number,
): number {
  assertPositive(filtrationCoefficient, "коефициент на филтрация");
  assertPositive(thickness, "дебелина на пласта");
  return filtrationCoefficient * thickness;
}

/**
 * Коефициент на пиезопредаване (напорни води) или на нивопредаване
 * (безнапорни води): a = T / μ, m²/d (въпрос 21). μ е коефициентът на
 * водоотдаване – еластично при напорните и гравитационно при безнапорните.
 */
export function levelConductivity(
  transmissivityValue: number,
  storageCoefficient: number,
): number {
  assertPositive(transmissivityValue, "проводимост");
  assertPositive(storageCoefficient, "коефициент на водоотдаване");
  return transmissivityValue / storageCoefficient;
}

/**
 * Закон на Шези–Краснополски за турбулентно движение: v = k_т·√I
 * (въпрос 21). k_т е коефициентът от този закон, не коефициентът на
 * филтрация от закона на Дарси.
 */
export function chezyKrasnopolskiVelocity(
  coefficient: number,
  gradient: number,
): number {
  assertPositive(coefficient, "коефициент");
  assertNonNegative(gradient, "напорен градиент");
  return coefficient * Math.sqrt(gradient);
}

/** m/d → m/s: дели се на 86 400. */
export function metersPerDayToMetersPerSecond(value: number): number {
  assertFinite(value, "скорост");
  return value / SECONDS_PER_DAY;
}

/** m/s → m/d: умножава се по 86 400. */
export function metersPerSecondToMetersPerDay(value: number): number {
  assertFinite(value, "скорост");
  return value * SECONDS_PER_DAY;
}

/** cm/s → m/d: 1 cm/s = 0,01 m/s = 864 m/d. */
export function centimetersPerSecondToMetersPerDay(value: number): number {
  assertFinite(value, "скорост");
  return (value / 100) * SECONDS_PER_DAY;
}

/** m³/d → l/s: 1 m³ = 1000 l, 1 d = 86 400 s. */
export function cubicMetersPerDayToLitersPerSecond(value: number): number {
  assertFinite(value, "разход");
  return (value * 1000) / SECONDS_PER_DAY;
}

/**
 * Средни стойности на коефициента на филтрация по таблицата в лекцията към
 * въпрос 21, в m/d. Между 30 и 100 m/d таблицата няма ред.
 */
export const FILTRATION_COEFFICIENT_RANGES: readonly {
  from: number;
  to: number;
  name: string;
}[] = [
  { from: 0.01, to: 0.1, name: "глинести почви, песъчливи глини" },
  { from: 0.1, to: 1, name: "прахови пясъци, глинести пясъци" },
  { from: 1, to: 5, name: "дребни пясъци" },
  { from: 5, to: 30, name: "средни пясъци" },
  {
    from: 100,
    to: 200,
    name: "едри и чакълести пясъци, чакъли с песъчлив запълнител",
  },
];

/**
 * Редът от таблицата, в който попада k (m/d), или null, когато таблицата не
 * покрива стойността (под 0,01, между 30 и 100, над 200 m/d). Обща граница
 * на два съседни реда (0,1; 1; 5) се отнася към по-пропускливия – това е
 * уговорка на този файл, таблицата не я решава.
 */
export function classifyByFiltrationCoefficient(
  filtrationCoefficient: number,
): string | null {
  assertPositive(filtrationCoefficient, "коефициент на филтрация");
  let found: string | null = null;
  for (const range of FILTRATION_COEFFICIENT_RANGES) {
    if (
      filtrationCoefficient >= range.from &&
      filtrationCoefficient <= range.to
    ) {
      found = range.name;
    }
  }
  return found;
}
