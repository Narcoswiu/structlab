/**
 * Приток към водовземни съоръжения при стабилизирана филтрация
 * (Инженерна геология и хидрогеология, Глава 14).
 *
 * Формулите са сверени с лекциите на катедра „Геотехника“ на УАСГ (2018 г.):
 * въпрос 23 (формула на Дюпюи за напорен и за безнапорен пласт, формула на
 * Форхаймер за кладенец до река, хоризонтален дренаж, сумиране на
 * пониженията) и въпрос 24 (приведен радиус на изкоп). Депресионната крива в
 * безнапорен пласт е формулата на Дюпюи между два радиуса (Kruseman, de Ridder,
 * ILRI Publ. 47, уравнение 5.7).
 *
 * Мерни единици (както в курса): дължини в m, коефициент на филтрация k в m/d,
 * дебит Q в m³/d. За помпите дебитът се дава и в l/s: 1 l/s = 86,4 m³/d.
 *
 * Означения: k – коефициент на филтрация; m – дебелина на напорния пласт;
 * he – естествена водонаситена дебелина на безнапорния пласт (от водоупора до
 * статичното ниво); s0 – понижение в кладенеца; h0 = he − s0 – воден стълб в
 * кладенеца (дренажа); r0 – радиус на кладенеца; R – радиус на влияние
 * (ЗАДАВА се; лекцията не дава формула за него); L – разстояние до реката.
 *
 * Валидност: съвършен кладенец (филтърът пресича целия пласт), еднороден пласт
 * с хоризонтален водоупор, стабилизирана филтрация, валиден закон на Дарси
 * v = k·I. Файлът е самостоятелен – не ползва други модули от lib/engineering.
 */

/** Секунди в едно денонощие. */
export const SECONDS_PER_DAY = 86_400;

/** m³/d в 1 l/s: 86 400 s · 0,001 m³ = 86,4. */
export const CUBIC_METERS_PER_DAY_IN_LITER_PER_SECOND = 86.4;

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

/** Проверява r0 < R (иначе логаритъмът не е положителен). */
function assertRadii(inner: number, outer: number): void {
  assertPositive(inner, "вътрешен радиус");
  assertPositive(outer, "външен радиус");
  if (outer <= inner) {
    throw new Error("Външният радиус трябва да е по-голям от вътрешния.");
  }
}

/** Проверява понижението в безнапорен пласт: 0 ≤ s0 < he. */
function assertUnconfinedDrawdown(he: number, s0: number): void {
  assertPositive(he, "водонаситена дебелина he");
  assertNonNegative(s0, "понижение s0");
  if (s0 >= he) {
    throw new Error("Понижението s0 трябва да е по-малко от дебелината he.");
  }
}

/** Дебит от m³/d в l/s. */
export function cubicMetersPerDayToLitersPerSecond(q: number): number {
  assertFinite(q, "дебит");
  return q / CUBIC_METERS_PER_DAY_IN_LITER_PER_SECOND;
}

/** Дебит от l/s в m³/d. */
export function litersPerSecondToCubicMetersPerDay(q: number): number {
  assertFinite(q, "дебит");
  return q * CUBIC_METERS_PER_DAY_IN_LITER_PER_SECOND;
}

/** Коефициент на филтрация от m/d в m/s. */
export function metersPerDayToMetersPerSecond(k: number): number {
  assertFinite(k, "коефициент на филтрация");
  return k / SECONDS_PER_DAY;
}

export type ConfinedWell = {
  /** коефициент на филтрация, m/d */
  k: number;
  /** дебелина на напорния пласт, m */
  m: number;
  /** понижение в кладенеца, m */
  s0: number;
  /** радиус на кладенеца, m */
  r0: number;
  /** радиус на влияние, m */
  R: number;
};

/**
 * Формула на Дюпюи за съвършен кладенец в НАПОРЕН пласт (въпрос 23, т. 1.1):
 * Q = 2π·k·m·s0 / ln(R / r0), m³/d.
 */
export function confinedWellInflow({ k, m, s0, r0, R }: ConfinedWell): number {
  assertPositive(k, "коефициент на филтрация k");
  assertPositive(m, "дебелина на пласта m");
  assertNonNegative(s0, "понижение s0");
  assertRadii(r0, R);
  return (2 * Math.PI * k * m * s0) / Math.log(R / r0);
}

/**
 * Понижение на пиезометричното ниво на разстояние r от оста на кладенец в
 * напорен пласт (въпрос 23, т. 1.1): s = Q·ln(R / r) / (2π·k·m), m.
 * Валидно за r0 ≤ r ≤ R; при r = R понижението е нула.
 */
export function confinedDrawdownAt(input: {
  Q: number;
  k: number;
  m: number;
  R: number;
  r: number;
}): number {
  const { Q, k, m, R, r } = input;
  assertNonNegative(Q, "дебит Q");
  assertPositive(k, "коефициент на филтрация k");
  assertPositive(m, "дебелина на пласта m");
  assertPositive(R, "радиус на влияние R");
  assertPositive(r, "разстояние r");
  if (r > R) {
    throw new Error(
      "Разстоянието r не може да е по-голямо от радиуса на влияние R.",
    );
  }
  return (Q * Math.log(R / r)) / (2 * Math.PI * k * m);
}

/**
 * Осреднена дебелина на безнапорния пласт при кладенеца (въпрос 23, т. 1.1):
 * (he + h0) / 2 = he − s0 / 2, m.
 */
export function averageUnconfinedThickness(he: number, s0: number): number {
  assertUnconfinedDrawdown(he, s0);
  return he - s0 / 2;
}

export type UnconfinedWell = {
  /** коефициент на филтрация, m/d */
  k: number;
  /** естествена водонаситена дебелина, m */
  he: number;
  /** понижение в кладенеца, m */
  s0: number;
  /** радиус на кладенеца, m */
  r0: number;
  /** радиус на влияние, m */
  R: number;
};

/**
 * Формула на Дюпюи за съвършен кладенец в БЕЗНАПОРЕН пласт (въпрос 23, т. 1.1):
 * Q = π·k·(2he − s0)·s0 / ln(R / r0), m³/d.
 * Същото е Q = π·k·(he² − h0²) / ln(R / r0) с h0 = he − s0.
 */
export function unconfinedWellInflow({
  k,
  he,
  s0,
  r0,
  R,
}: UnconfinedWell): number {
  assertPositive(k, "коефициент на филтрация k");
  assertUnconfinedDrawdown(he, s0);
  assertRadii(r0, R);
  return (Math.PI * k * (2 * he - s0) * s0) / Math.log(R / r0);
}

/**
 * Височина на депресионната крива над водоупора на разстояние r от оста на
 * кладенец в безнапорен пласт: h = √(he² − Q·ln(R / r) / (π·k)), m.
 * Това е формулата на Дюпюи между радиусите r и R. Валидно за r0 ≤ r ≤ R.
 */
export function unconfinedHeadAt(input: {
  Q: number;
  k: number;
  he: number;
  R: number;
  r: number;
}): number {
  const { Q, k, he, R, r } = input;
  assertNonNegative(Q, "дебит Q");
  assertPositive(k, "коефициент на филтрация k");
  assertPositive(he, "водонаситена дебелина he");
  assertPositive(R, "радиус на влияние R");
  assertPositive(r, "разстояние r");
  if (r > R) {
    throw new Error(
      "Разстоянието r не може да е по-голямо от радиуса на влияние R.",
    );
  }
  const squared = he * he - (Q * Math.log(R / r)) / (Math.PI * k);
  if (squared < 0) {
    throw new Error("При този дебит пластът е осушен на това разстояние.");
  }
  return Math.sqrt(squared);
}

/**
 * Формула на Форхаймер за съвършен кладенец в безнапорен пласт до река
 * (въпрос 23, т. 1.2): Q = π·k·(2he − s0)·s0 / ln(2L / r0), m³/d.
 * Условие: съвършена хидравлична връзка между реката и подземната вода.
 */
export function wellNearRiverInflow(input: {
  k: number;
  he: number;
  s0: number;
  r0: number;
  /** разстояние от кладенеца до реката, m */
  L: number;
}): number {
  const { k, he, s0, r0, L } = input;
  assertPositive(k, "коефициент на филтрация k");
  assertUnconfinedDrawdown(he, s0);
  assertPositive(L, "разстояние до реката L");
  assertRadii(r0, 2 * L);
  return (Math.PI * k * (2 * he - s0) * s0) / Math.log((2 * L) / r0);
}

export type Drain = {
  /** коефициент на филтрация, m/d */
  k: number;
  /** дължина на дренажа, m */
  B: number;
  /** естествена водонаситена дебелина (напор над водоупора), m */
  he: number;
  /** воден стълб в дренажа, m */
  h0: number;
  /** широчина на зоната на влияние от едната страна, m */
  R: number;
};

function assertDrain({ k, B, he, h0, R }: Drain): void {
  assertPositive(k, "коефициент на филтрация k");
  assertPositive(B, "дължина на дренажа B");
  assertPositive(he, "водонаситена дебелина he");
  assertNonNegative(h0, "воден стълб в дренажа h0");
  assertPositive(R, "зона на влияние R");
  if (h0 > he) {
    throw new Error(
      "Водният стълб в дренажа h0 не може да е над естественото ниво he.",
    );
  }
}

/**
 * Приток към съвършен хоризонтален дренаж ОТ ЕДНАТА страна (въпрос 23, т. 1.3,
 * дренаж напречно на потока): Q = B·k·(he² − h0²) / (2R), m³/d.
 */
export function drainInflowOneSide(drain: Drain): number {
  assertDrain(drain);
  const { k, B, he, h0, R } = drain;
  return (B * k * (he * he - h0 * h0)) / (2 * R);
}

/**
 * Приток към съвършен хоризонтален дренаж ОТ ДВЕТЕ страни (въпрос 23, т. 1.3,
 * дренаж, успореден на потока): Q = B·k·(he² − h0²) / R, m³/d – двойно повече.
 */
export function drainInflowTwoSides(drain: Drain): number {
  return 2 * drainInflowOneSide(drain);
}

/**
 * Приведен радиус на строителен изкоп с площ F (въпрос 24, т. 1.1.1):
 * rп = √(F / π), m – радиусът на кръг със същата площ.
 */
export function equivalentRadius(areaF: number): number {
  assertPositive(areaF, "площ на изкопа F");
  return Math.sqrt(areaF / Math.PI);
}

/**
 * Метод на суперпозицията (въпрос 23, т. 3.1): понижението в една точка е сбор
 * от пониженията, които създават там отделните кладенци, m.
 */
export function superposedDrawdown(drawdowns: readonly number[]): number {
  let sum = 0;
  drawdowns.forEach((s, i) => {
    assertNonNegative(s, `понижение ${i + 1}`);
    sum += s;
  });
  return sum;
}

/**
 * Метод на еквивалентните филтрационни съпротивления (въпрос 23, т. 3.2): ред
 * от близки кладенци се заменя с дренаж с единичен дебит q = Q / σ, m²/d.
 * ВНИМАНИЕ: Q е дебитът на ЕДИН кладенец, σ – разстоянието между съседните.
 * По баланса на водата n кладенеца на дължина n·σ дават q = n·Q / (n·σ).
 * В лекцията Q е наречен „сумарен дебит“ – с него формулата не е вярна.
 */
export function wellRowUnitDischarge(input: {
  /** дебит на един кладенец, m³/d */
  wellDischarge: number;
  /** разстояние между съседните кладенци, m */
  spacing: number;
}): number {
  assertNonNegative(input.wellDischarge, "дебит на един кладенец Q");
  assertPositive(input.spacing, "разстояние между кладенците σ");
  return input.wellDischarge / input.spacing;
}
