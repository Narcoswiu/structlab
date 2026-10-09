import { figureNumber } from "../content/beam-figure.ts";

/**
 * Общи помощници за лабораториите: числа за показване и вид на резултатите.
 */

/** Ред от списъка с резултати. */
export type LabResult = {
  name: string;
  value: string;
  /** по избор: уточнение под стойността */
  note?: string;
};

/** Стъпка от „Покажи как се смята“. */
export type LabStep = {
  title: string;
  /** редове с текст и сметки */
  lines: string[];
};

/**
 * Число за показване: десетична запетая, до два знака след нея.
 * Много малките стойности пазят две значещи цифри (0,0049), вместо да
 * се закръглят до нула. Никога не връща „NaN“ или „∞“.
 */
export function labNumber(value: number): string {
  if (!Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 10_000) return groupThousands(figureNumber(value));
  if (abs >= 0.1) return figureNumber(value);
  if (abs < 1e-6) return "≈ 0";
  const text = String(Number(abs.toPrecision(2))).replace(".", ",");
  return value < 0 ? `−${text}` : text;
}

/** 7333333,33 → „7 333 333,33“ (непрекъсваем интервал между тройките). */
function groupThousands(text: string): string {
  const [whole = "", fraction] = text.split(",");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}

/**
 * Малка величина с фиксиран брой знаци след запетаята (0,01818 m;
 * 0,0049 rad) – както е отпечатана в учебника. Крайните нули отпадат.
 */
export function labPrecise(value: number, decimals = 5): string {
  if (!Number.isFinite(value)) return "–";
  const rounded = Number(value.toFixed(decimals));
  if (rounded === 0) return labNumber(value);
  return String(rounded).replace(".", ",").replace("-", "−");
}

/** Стойност с мерна единица: „12 MPa“. */
export function labQuantity(value: number, unit: string): string {
  return `${labNumber(value)} ${unit}`;
}

/** kN/cm² → MPa. */
export function toMpa(stress: number): number {
  return stress * 10;
}

/** Всички числа в записа са крайни (няма NaN и безкрайност). */
export function allFinite(values: readonly number[]): boolean {
  return values.every((value) => Number.isFinite(value));
}

/** Събираемо в уравнение: знак и запис без знак („24·2“, „S_AC“). */
export type LabTerm = { sign: 1 | -1; text: string };

/** Събираемо, чийто знак идва от стойността му. */
export function signedTerm(value: number, text: string): LabTerm {
  return { sign: value < 0 ? -1 : 1, text };
}

/** „−24·2 + 12 − S_AC“; празен списък → „0“. */
export function joinTerms(terms: readonly LabTerm[]): string {
  if (terms.length === 0) return "0";
  return terms
    .map((term, index) =>
      index === 0
        ? `${term.sign < 0 ? "−" : ""}${term.text}`
        : `${term.sign < 0 ? "−" : "+"} ${term.text}`,
    )
    .join(" ");
}

/** Много малките стойности от плаващата запетая стават точно нула. */
export function snapZero(value: number, eps = 1e-9): number {
  return Math.abs(value) < eps ? 0 : value;
}
