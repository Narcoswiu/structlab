import { simpleBeamDistributedAt, type StandardCase } from "./deflection.ts";

/**
 * Еластичната линия w(x) на типовите случаи в затворен вид.
 *
 * Мерни единици и знаци – както в `deflection.ts`: товар в kN или kN/m,
 * дължини в m, E·I в kN·m², провисване в m (надолу положително).
 * Конзолата е запъната в левия край (x = 0), свободният край е x = l.
 */
export type CurveCase = Exclude<StandardCase, "cantilever-moment">;

export function standardDeflectionAt(
  kind: CurveCase,
  load: number,
  l: number,
  EI: number,
  x: number,
): number {
  if (!Number.isFinite(load)) throw new Error("Товарът трябва да е число.");
  if (!(l > 0) || !Number.isFinite(l)) {
    throw new Error("Дължината трябва да е положително число.");
  }
  if (!(EI > 0) || !Number.isFinite(EI)) {
    throw new Error("Коравината E·I трябва да е положително число.");
  }
  if (!(x >= 0 && x <= l)) throw new Error("Сечение извън гредата.");
  switch (kind) {
    case "cantilever-force":
      // w = F·x²·(3l − x) / (6·E·I)
      return (load * x ** 2 * (3 * l - x)) / (6 * EI);
    case "cantilever-distributed":
      // w = q·x²·(6l² − 4l·x + x²) / (24·E·I)
      return (load * x ** 2 * (6 * l ** 2 - 4 * l * x + x ** 2)) / (24 * EI);
    case "simple-force-mid": {
      // симетрична: w = F·s·(3l² − 4s²) / (48·E·I), s – до по-близката опора
      const s = Math.min(x, l - x);
      return (load * s * (3 * l ** 2 - 4 * s ** 2)) / (48 * EI);
    }
    case "simple-distributed":
      return simpleBeamDistributedAt(load, l, EI, x);
    default:
      throw new Error("Непознат типов случай.");
  }
}

/** Сечението с най-голямо провисване: свободният край или средата, m. */
export function maxDeflectionPosition(kind: CurveCase, l: number): number {
  return kind.startsWith("cantilever") ? l : l / 2;
}
