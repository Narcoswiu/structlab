/**
 * Число, въведено от потребител: приема десетична запетая или точка.
 * Връща null, ако текстът не е число.
 */
export function parseDecimal(input: string): number | null {
  const text = input
    .trim()
    .replace(/\s/g, "")
    .replace("−", "-")
    .replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** 5.4 → „5,4“ за показване в поле за въвеждане (без излишни нули). */
export function formatDecimal(value: number): string {
  return String(Math.round(value * 1000) / 1000).replace(".", ",");
}
