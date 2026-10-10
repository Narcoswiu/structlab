/**
 * Земни работи с еднокошов багер, товарач и самосвали
 * („Строителни машини“, Глава 10; теми 27 и 29 от конспекта на УАСГ).
 *
 * Мерни единици: обем в m³, маса в t, плътност в t/m³, разстояние в km,
 * скорост в km/h, време на цикъла на багера в s, всички останали времена
 * в min, производителност в m³/h.
 *
 * Обемът на една и съща маса почва е различен в трите състояния:
 * плътно (естествено, преди изкопаване), разрохкано (след изкопаване) и
 * уплътнено (след уплътняване в насип). Всяка функция казва в кое
 * състояние е обемът, с който работи.
 *
 * Разбухването, коефициентът на напълване на коша, времето на цикъла и
 * коефициентът на използване по време НЕ са константи – те са входни
 * данни, които се вземат от таблица или от измерване на обекта.
 *
 * Източници на формулите: наръчник на производител на земекопни машини
 * (раздели „Elements of Production“, „Bucket Payload“ и „Earthmoving
 * Production“) и полеви наръчник FM 5-434 (§ 1-14, § 3-28 стъпка 7, § 5-15,
 * § 8-24, § 10-10). Полевият наръчник е в имперски единици; тук всичко е
 * в метрични.
 *
 * Файлът е самостоятелен – не ползва други модули от lib/engineering.
 */

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

/* ------------------------------------------------------------------ */
/* Трите състояния на почвата                                          */
/* ------------------------------------------------------------------ */

/**
 * Обем в разрохкано състояние от обем в плътно състояние:
 * V_р = V_пл·(1 + s). Разбухването s е дробно число (25 % → 0,25).
 */
export function looseFromBank(bankVolume: number, swell: number): number {
  assertNonNegative(bankVolume, "обем в плътно състояние");
  assertNonNegative(swell, "разбухване");
  return bankVolume * (1 + swell);
}

/** Обем в плътно състояние от обем в разрохкано: V_пл = V_р / (1 + s). */
export function bankFromLoose(looseVolume: number, swell: number): number {
  assertNonNegative(looseVolume, "обем в разрохкано състояние");
  assertNonNegative(swell, "разбухване");
  return looseVolume / (1 + swell);
}

/**
 * Преводен коефициент към плътно състояние (в източниците – load factor):
 * k_пл = 1 / (1 + s) = 100 % / (100 % + разбухване в %). V_пл = V_р·k_пл.
 */
export function loadFactor(swell: number): number {
  assertNonNegative(swell, "разбухване");
  return 1 / (1 + swell);
}

/** Разбухване от преводния коефициент: s = 1/k_пл − 1. */
export function swellFromLoadFactor(factor: number): number {
  assertPositive(factor, "преводен коефициент");
  if (factor > 1) {
    throw new Error("Преводният коефициент не може да е по-голям от 1.");
  }
  return 1 / factor - 1;
}

/**
 * Обем в уплътнено състояние от обем в плътно: V_у = V_пл·k_у, където
 * коефициентът на свиване е k_у = V_у / V_пл (в източниците – shrinkage
 * factor). Може да е и над 1 (взривена скала).
 */
export function compactedFromBank(
  bankVolume: number,
  shrinkageFactor: number,
): number {
  assertNonNegative(bankVolume, "обем в плътно състояние");
  assertPositive(shrinkageFactor, "коефициент на свиване");
  return bankVolume * shrinkageFactor;
}

/** Обем в плътно състояние, нужен за даден уплътнен обем: V_пл = V_у / k_у. */
export function bankFromCompacted(
  compactedVolume: number,
  shrinkageFactor: number,
): number {
  assertNonNegative(compactedVolume, "обем в уплътнено състояние");
  assertPositive(shrinkageFactor, "коефициент на свиване");
  return compactedVolume / shrinkageFactor;
}

/**
 * Плътност в разрохкано състояние от плътността в плътно състояние:
 * ρ_р = ρ_пл / (1 + s), t/m³. Масата не се променя, обемът расте.
 */
export function looseDensity(bankDensity: number, swell: number): number {
  assertPositive(bankDensity, "плътност в плътно състояние");
  assertNonNegative(swell, "разбухване");
  return bankDensity / (1 + swell);
}

/* ------------------------------------------------------------------ */
/* Кош, цикъл и часова производителност                                */
/* ------------------------------------------------------------------ */

/**
 * Среден обем почва в коша (разрохкано състояние), m³:
 * q_т = q·k_н – вместимост „с връх“ по коефициента на напълване
 * (дробно число; може да е над 1).
 */
export function bucketPayload(
  heapedCapacity: number,
  fillFactor: number,
): number {
  assertPositive(heapedCapacity, "вместимост на коша");
  assertPositive(fillFactor, "коефициент на напълване");
  return heapedCapacity * fillFactor;
}

/** Брой цикли за 60 минути непрекъсната работа: n = 3600 / t_ц (t_ц в s). */
export function cyclesPerHour(cycleSeconds: number): number {
  assertPositive(cycleSeconds, "време на цикъла");
  return 3600 / cycleSeconds;
}

/**
 * Производителност на багер за 60 минути непрекъсната работа, m³/h в
 * разрохкано състояние: П₆₀ = (3600 / t_ц)·q·k_н, t_ц в секунди.
 */
export function excavatorIdealOutput(
  heapedCapacity: number,
  fillFactor: number,
  cycleSeconds: number,
): number {
  return (
    cyclesPerHour(cycleSeconds) * bucketPayload(heapedCapacity, fillFactor)
  );
}

/**
 * Производителност на товарач за 60 минути непрекъсната работа, m³/h в
 * разрохкано състояние: П₆₀ = q·k_н·60 / t_ц, t_ц в МИНУТИ (така го дават
 * таблиците за товарачи).
 */
export function loaderIdealOutput(
  heapedCapacity: number,
  fillFactor: number,
  cycleMinutes: number,
): number {
  assertPositive(cycleMinutes, "време на цикъла");
  return (bucketPayload(heapedCapacity, fillFactor) * 60) / cycleMinutes;
}

/**
 * Коефициент на използване по време: k_в = работни минути в часа / 60.
 * 50 минути → 0,8333.
 */
export function timeEfficiency(workMinutesPerHour: number): number {
  assertPositive(workMinutesPerHour, "работни минути в часа");
  if (workMinutesPerHour > 60) {
    throw new Error("Работните минути в часа не могат да са повече от 60.");
  }
  return workMinutesPerHour / 60;
}

/** Действителна производителност: П = П₆₀·k_в, m³/h. */
export function actualOutput(idealOutput: number, efficiency: number): number {
  assertNonNegative(idealOutput, "производителност за 60 минути");
  assertPositive(efficiency, "коефициент на използване по време");
  if (efficiency > 1) {
    throw new Error("Коефициентът на използване по време не може да е над 1.");
  }
  return idealOutput * efficiency;
}

/** Масова производителност, t/h: обемната (разрохкан обем) по ρ_р. */
export function massOutput(
  looseOutput: number,
  looseDensityValue: number,
): number {
  assertNonNegative(looseOutput, "производителност");
  assertPositive(looseDensityValue, "плътност в разрохкано състояние");
  return looseOutput * looseDensityValue;
}

/** Време за даден обем работа, h: T = V / П (в едно и също състояние). */
export function hoursForVolume(volume: number, output: number): number {
  assertNonNegative(volume, "обем");
  assertPositive(output, "производителност");
  return volume / output;
}

/* ------------------------------------------------------------------ */
/* Самосвали                                                           */
/* ------------------------------------------------------------------ */

/**
 * Време за ход в минути: t = 60·L / v, L в km, v в km/h. В полевия наръчник
 * същото е записано като път във футове, делен на 88·скорост в mph.
 */
export function travelTimeMinutes(
  distanceKm: number,
  speedKmh: number,
): number {
  assertNonNegative(distanceKm, "разстояние");
  assertPositive(speedKmh, "скорост");
  return (60 * distanceKm) / speedKmh;
}

/**
 * Брой кошове за един самосвал: най-голямото ЦЯЛО число, при което
 * насипаният обем не надхвърля вместимостта на коша на самосвала.
 */
export function bucketsPerTruck(
  truckBodyVolume: number,
  payloadPerBucket: number,
): number {
  assertPositive(truckBodyVolume, "вместимост на самосвала");
  assertPositive(payloadPerBucket, "обем в един кош");
  // малък допуск срещу 9,999999 вместо 10 при делението
  return Math.floor(truckBodyVolume / payloadPerBucket + 1e-9);
}

export type TruckLoad = {
  /** брой кошове */
  buckets: number;
  /** превозен обем в разрохкано състояние, m³ */
  volume: number;
  /** маса на товара, t */
  mass: number;
  /** true, когато масата не надхвърля товароносимостта */
  withinPayload: boolean;
};

/**
 * Товар на самосвала при цяло число кошове. Ако масата надхвърля
 * товароносимостта, броят кошове се намалява, докато се побере.
 */
export function truckLoad(
  truckBodyVolume: number,
  truckPayloadTonnes: number,
  payloadPerBucket: number,
  looseDensityValue: number,
): TruckLoad {
  assertPositive(truckPayloadTonnes, "товароносимост");
  assertPositive(looseDensityValue, "плътност в разрохкано състояние");
  let buckets = bucketsPerTruck(truckBodyVolume, payloadPerBucket);
  const byVolume = buckets;
  while (
    buckets > 0 &&
    buckets * payloadPerBucket * looseDensityValue > truckPayloadTonnes + 1e-9
  ) {
    buckets -= 1;
  }
  const volume = buckets * payloadPerBucket;
  return {
    buckets,
    volume,
    mass: volume * looseDensityValue,
    withinPayload: buckets === byVolume,
  };
}

/**
 * Време, за което товарната машина обслужва един самосвал, min:
 * t_т = (брой кошове)·t_ц + време за смяна на самосвала. t_ц в секунди.
 */
export function loadingTimePerTruck(
  buckets: number,
  cycleSeconds: number,
  exchangeMinutes = 0,
): number {
  assertPositive(buckets, "брой кошове");
  assertPositive(cycleSeconds, "време на цикъла");
  assertNonNegative(exchangeMinutes, "време за смяна на самосвала");
  return (buckets * cycleSeconds) / 60 + exchangeMinutes;
}

export type TruckCycle = {
  /** товарене заедно със смяната на самосвала, min */
  loading: number;
  /** ход с товар, min */
  haul: number;
  /** разтоварване и маневри на насипището, min */
  dump: number;
  /** ход без товар, min */
  back: number;
};

/** Време на цикъла на самосвала, min: сборът от четирите части. */
export function truckCycleTime(cycle: TruckCycle): number {
  assertPositive(cycle.loading, "време за товарене");
  assertNonNegative(cycle.haul, "ход с товар");
  assertNonNegative(cycle.dump, "разтоварване");
  assertNonNegative(cycle.back, "ход без товар");
  return cycle.loading + cycle.haul + cycle.dump + cycle.back;
}

/**
 * Брой самосвали по полевия наръчник (§ 10-10):
 * N = 1 + T_с / t_т. Единицата е резерв – един самосвал винаги чака при
 * товарната машина. Връща точната стойност; закръгля се нагоре.
 */
export function trucksRequiredExact(
  truckCycleMinutes: number,
  loadingMinutesPerTruck: number,
): number {
  assertPositive(truckCycleMinutes, "цикъл на самосвала");
  assertPositive(loadingMinutesPerTruck, "време за един самосвал");
  return 1 + truckCycleMinutes / loadingMinutesPerTruck;
}

/** Същото, закръглено нагоре до цяло число. */
export function trucksRequired(
  truckCycleMinutes: number,
  loadingMinutesPerTruck: number,
): number {
  return Math.ceil(
    trucksRequiredExact(truckCycleMinutes, loadingMinutesPerTruck) - 1e-9,
  );
}

export type FleetOutput = {
  /** колко може да натовари товарната машина за 60 min, m³/h */
  loader: number;
  /** колко могат да извозят самосвалите за 60 min, m³/h */
  trucks: number;
  /** производителност на звеното – по-малкото от двете, m³/h */
  fleet: number;
  /** кое звено ограничава */
  limitedBy: "loader" | "trucks" | "balanced";
};

/**
 * Производителност на звеното „товарна машина + N самосвала“ за 60 минути
 * (разрохкан обем). Товарната машина: товар·60 / t_т. Самосвалите:
 * N·товар·60 / T_с. Звеното дава по-малкото от двете.
 */
export function fleetOutput(
  truckCount: number,
  truckLoadVolume: number,
  truckCycleMinutes: number,
  loadingMinutesPerTruck: number,
): FleetOutput {
  if (!Number.isInteger(truckCount) || truckCount < 1) {
    throw new Error("Броят самосвали трябва да е цяло положително число.");
  }
  assertPositive(truckLoadVolume, "товар на самосвала");
  assertPositive(truckCycleMinutes, "цикъл на самосвала");
  assertPositive(loadingMinutesPerTruck, "време за един самосвал");
  if (loadingMinutesPerTruck > truckCycleMinutes) {
    throw new Error("Товаренето е част от цикъла и не може да е по-дълго.");
  }
  const loader = (truckLoadVolume * 60) / loadingMinutesPerTruck;
  const trucks = (truckCount * truckLoadVolume * 60) / truckCycleMinutes;
  const diff = trucks - loader;
  const limitedBy =
    Math.abs(diff) < 1e-9 * loader
      ? "balanced"
      : diff < 0
        ? "trucks"
        : "loader";
  return { loader, trucks, fleet: Math.min(loader, trucks), limitedBy };
}

/**
 * Чакане на един самосвал за един курс, min, когато самосвалите са повече,
 * отколкото товарната машина успява да натовари: N·t_т − T_с (нула, ако
 * ограничават самосвалите).
 */
export function truckWaitPerTrip(
  truckCount: number,
  truckCycleMinutes: number,
  loadingMinutesPerTruck: number,
): number {
  if (!Number.isInteger(truckCount) || truckCount < 1) {
    throw new Error("Броят самосвали трябва да е цяло положително число.");
  }
  assertPositive(truckCycleMinutes, "цикъл на самосвала");
  assertPositive(loadingMinutesPerTruck, "време за един самосвал");
  return Math.max(0, truckCount * loadingMinutesPerTruck - truckCycleMinutes);
}
