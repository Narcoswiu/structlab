const NBSP = " ";

/** 5.4 → "5,4" (десетична запетая, както в CONTENT_GUIDE.md). */
export function formatNumber(value: number, decimals = 0): string {
  return value.toFixed(decimals).replace(".", ",").replace("-", "−");
}

/**
 * 5.4, "m", 1 → "5,4 m". Между числото и единицата има непрекъсваем интервал,
 * за да не се пренасят на различни редове.
 */
export function formatQuantity(
  value: number,
  unit: string,
  decimals = 0,
): string {
  return `${formatNumber(value, decimals)}${NBSP}${unit}`;
}
