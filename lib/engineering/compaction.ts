/**
 * Уплътнителни машини – производителност на валяк и брой валяци
 * („Строителни машини“, Глава 14; конспект на УАСГ, теми 40 и 41).
 *
 * Мерни единици: широчини в m, скорост в km/h, дебелина на пласта в mm,
 * обеми в m³, производителност в m³/h УПЛЪТНЕН обем, време в h.
 *
 * Източници на формулите (отворени, виж meta.json на главата):
 *  – И1: US Army FM 5-434, гл. 11, § 11-24 … 11-26 и § 11-36; гл. 1, табл. 1-1;
 *  – И2: наръчник на производител, раздел „Soil Compactors – Compactor
 *    Production“ и раздел 28 („Swell“, „Shrinkage Factor“), таблица за
 *    превръщане на единици.
 *
 * ВНИМАНИЕ – двата източника се разминават: И2 пише Q = W·S·L / P за
 * 60-минутен час (без коефициент), а И1 пише Q = 16,3·W·S·L·E / N с
 * коефициент E на използване по време. Тук коефициентът е изричен
 * параметър; E = 1 дава формата на И2.
 *
 * Всички коефициенти (E, брой минавания, дебелина, скорост, застъпване,
 * коефициент за обема) са ДАДЕНИ на задачата – функциите не съдържат
 * „типични“ стойности. Файлът е самостоятелен.
 */

/** 1 миля в час = 1,609344 km/h (И2 дава закръглено 1,609). */
export const KMH_PER_MPH = 1.609344;
/** 1 инч = 25,4 mm (И2). */
export const MM_PER_INCH = 25.4;
/** 1 фут = 0,3048 m (И2). */
export const M_PER_FOOT = 0.3048;
/** 1 кубичен ярд = 0,9144³ m³ ≈ 0,7646 m³ (И2 дава 0,7645). */
export const M3_PER_CUBIC_YARD = 0.9144 ** 3;
/** Константата на формулата в имперски единици: 5280 ft ÷ 12 in ÷ 27 ft³ ≈ 16,3 (И2). */
export const IMPERIAL_CONSTANT = 5280 / 12 / 27;

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

function assertEfficiency(value: number): void {
  assertPositive(value, "коефициент на използване по време");
  if (value > 1) {
    throw new Error(
      "Коефициентът на използване по време не може да е по-голям от 1.",
    );
  }
}

function assertSpeeds(speeds: number[]): void {
  if (speeds.length === 0) {
    throw new Error("Нужна е поне една скорост.");
  }
  speeds.forEach((speed, index) =>
    assertPositive(speed, `скорост на минаване ${index + 1}`),
  );
}

export function mphToKmh(mph: number): number {
  assertFinite(mph, "скорост в mph");
  return mph * KMH_PER_MPH;
}

export function inchToMm(inches: number): number {
  assertFinite(inches, "дължина в инчове");
  return inches * MM_PER_INCH;
}

export function feetToM(feet: number): number {
  assertFinite(feet, "дължина във футове");
  return feet * M_PER_FOOT;
}

export function cubicYardToM3(cubicYards: number): number {
  assertFinite(cubicYards, "обем в кубични ярдове");
  return cubicYards * M3_PER_CUBIC_YARD;
}

/**
 * Коефициент на използване по време от работните минути в един час:
 * E = минути / 60. (И1, § 11-25, работи с 50 и с 45 минути – това са
 * стойности на източника, тук се подават като дадени.)
 */
export function efficiencyFromMinutes(workingMinutesPerHour: number): number {
  assertPositive(workingMinutesPerHour, "работни минути в час");
  if (workingMinutesPerHour > 60) {
    throw new Error("Работните минути в един час не може да са повече от 60.");
  }
  return workingMinutesPerHour / 60;
}

/**
 * Уплътнявана широчина на едно минаване, m: W = b − a.
 * b – широчина на бандажа, a – застъпване със съседната ивица.
 * Геометрия: всяка следваща ивица добавя нова широчина b − a.
 * (И1, § 11-36, иска застъпване; стойността му е дадено.)
 */
export function effectiveWidth(drumWidthM: number, overlapM: number): number {
  assertPositive(drumWidthM, "широчина на бандажа");
  assertNonNegative(overlapM, "застъпване");
  if (overlapM >= drumWidthM) {
    throw new Error(
      "Застъпването трябва да е по-малко от широчината на бандажа.",
    );
  }
  return drumWidthM - overlapM;
}

export type CompactorInput = {
  /** W – уплътнявана широчина на едно минаване, m */
  widthM: number;
  /** S – средна скорост, km/h */
  speedKmh: number;
  /** L – дебелина на пласта СЛЕД уплътняване, mm */
  liftMm: number;
  /** N – брой минавания по една и съща ивица */
  passes: number;
  /** E – коефициент на използване по време; 1 = 60-минутен час (форма на И2) */
  efficiency?: number;
};

/**
 * Производителност на уплътнителна машина, m³/h уплътнен обем:
 *
 *   Q = W · S · L · E / N
 *
 * W в m, S в km/h, L в mm. Числовият множител е 1, защото
 * 1 km = 1000 m и 1 mm = 1/1000 m: W·(1000·S)·(L/1000) = W·S·L.
 * С E = 1 това е формулата на И2; с E < 1 – формулата на И1 (§ 11-24),
 * в която 16,3 е само превръщане от ft, mph и in в кубични ярдове.
 */
export function compactorProduction(input: CompactorInput): number {
  const { widthM, speedKmh, liftMm, passes, efficiency = 1 } = input;
  assertPositive(widthM, "уплътнявана широчина");
  assertPositive(speedKmh, "скорост");
  assertPositive(liftMm, "дебелина на пласта");
  assertPositive(passes, "брой минавания");
  assertEfficiency(efficiency);
  return (widthM * speedKmh * liftMm * efficiency) / passes;
}

/**
 * Същата формула в единиците на И1: W във ft, S в mph, L в in;
 * резултат в кубични ярдове уплътнен обем за час. Служи само за
 * сверяване с примера на източника.
 */
export function compactorProductionImperial(
  widthFt: number,
  speedMph: number,
  liftIn: number,
  passes: number,
  efficiency = 1,
): number {
  assertPositive(widthFt, "уплътнявана широчина");
  assertPositive(speedMph, "скорост");
  assertPositive(liftIn, "дебелина на пласта");
  assertPositive(passes, "брой минавания");
  assertEfficiency(efficiency);
  return (
    (IMPERIAL_CONSTANT * widthFt * speedMph * liftIn * efficiency) / passes
  );
}

/**
 * Средноаритметична скорост на минаванията, km/h – така я смята И1
 * (§ 11-25 и примерът след § 11-26).
 */
export function arithmeticMeanSpeed(speedsKmh: number[]): number {
  assertSpeeds(speedsKmh);
  return speedsKmh.reduce((sum, speed) => sum + speed, 0) / speedsKmh.length;
}

/**
 * Скорост, която дава действителното време: всяко минаване по ивица с
 * дължина l трае l / v_i, значи N минавания траят l·Σ(1/v_i) и
 * v = N / Σ(1/v_i) (средна хармонична), km/h. Това е собствен извод от
 * t = s / v, не формула от източниците; винаги е ≤ средноаритметичната.
 */
export function harmonicMeanSpeed(speedsKmh: number[]): number {
  assertSpeeds(speedsKmh);
  const inverseSum = speedsKmh.reduce((sum, speed) => sum + 1 / speed, 0);
  return speedsKmh.length / inverseSum;
}

/**
 * Коефициент за преминаване от разрохкан към уплътнен обем, изразен чрез
 * определенията на И2: разрохкан = плътен·(1 + разбухване),
 * коефициент на свиване = уплътнен / плътен. Следователно
 * уплътнен / разрохкан = свиване / (1 + разбухване).
 * swell е дроб (0,25 за 25 %).
 */
export function looseToCompactedFactor(
  swell: number,
  shrinkageFactor: number,
): number {
  assertNonNegative(swell, "разбухване");
  assertPositive(shrinkageFactor, "коефициент на свиване");
  return shrinkageFactor / (1 + swell);
}

/**
 * Уплътнен обем (или обем за час) от разрохкан: V_у = V_р · k,
 * k – коефициент „разрохкан → уплътнен“ (И1, табл. 1-1), дадено.
 */
export function looseToCompacted(looseVolume: number, factor: number): number {
  assertNonNegative(looseVolume, "разрохкан обем");
  assertPositive(factor, "коефициент за обема");
  return looseVolume * factor;
}

export type CompactorsRequired = {
  /** уплътнен обем, който трябва да се поеме за час, m³/h */
  compactedRate: number;
  /** точното отношение (нецяло число) */
  exact: number;
  /** брой машини – закръглен НАГОРЕ */
  count: number;
};

/**
 * Брой уплътнителни машини (И1, § 11-26):
 * n = (доставян разрохкан обем за час × коефициент за обема) / Q,
 * закръглен нагоре до цяло число.
 */
export function compactorsRequired(
  looseRateM3h: number,
  looseToCompactedK: number,
  productionM3h: number,
): CompactorsRequired {
  assertPositive(productionM3h, "производителност на една машина");
  const compactedRate = looseToCompacted(looseRateM3h, looseToCompactedK);
  const exact = compactedRate / productionM3h;
  // малкият допуск пази от 3,0000000001 → 4 заради двоичното закръгляне
  const count = Math.ceil(exact - 1e-9);
  return { compactedRate, exact, count };
}

/** Време за уплътняване на обем volume (m³ уплътнен) с count машини, h. */
export function compactionTime(
  compactedVolumeM3: number,
  productionM3h: number,
  count = 1,
): number {
  assertNonNegative(compactedVolumeM3, "уплътнен обем");
  assertPositive(productionM3h, "производителност на една машина");
  assertPositive(count, "брой машини");
  if (!Number.isInteger(count)) {
    throw new Error("Броят на машините трябва да е цяло число.");
  }
  return compactedVolumeM3 / (productionM3h * count);
}

/**
 * Брой пластове за насип с дадена височина (уплътнена), закръглен нагоре.
 * Двете величини са в една и съща единица (mm).
 */
export function numberOfLifts(fillHeightMm: number, liftMm: number): number {
  assertPositive(fillHeightMm, "височина на насипа");
  assertPositive(liftMm, "дебелина на пласта");
  return Math.ceil(fillHeightMm / liftMm - 1e-9);
}
