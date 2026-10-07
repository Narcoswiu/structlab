/**
 * Проверка на SVG фигура, преди да бъде вградена в страницата.
 *
 * Фигурите се пишат от нас и се записват само от сървъра, но се вграждат
 * директно в HTML-а (за да следват темата на четеца). Затова не допускаме
 * нищо, което може да изпълни код или да зареди външен ресурс.
 */
const FORBIDDEN: { pattern: RegExp; reason: string }[] = [
  { pattern: /<\s*script/i, reason: "елемент <script>" },
  { pattern: /<\s*foreignObject/i, reason: "елемент <foreignObject>" },
  { pattern: /<\s*(iframe|object|embed|image|use|a|style|link|meta)\b/i, reason: "непозволен елемент" },
  { pattern: /\son[a-z]+\s*=/i, reason: "обработчик на събитие (on…=)" },
  { pattern: /javascript\s*:/i, reason: "javascript: адрес" },
  { pattern: /(href|src)\s*=/i, reason: "връзка или външен ресурс" },
  { pattern: /url\s*\(/i, reason: "url(…)" },
  { pattern: /<!ENTITY|<!DOCTYPE|<\?xml/i, reason: "DOCTYPE/ENTITY/XML декларация" },
  { pattern: /@import/i, reason: "@import" },
];

export function findSvgProblem(svg: string): string | null {
  const trimmed = svg.trim();
  if (!/^<svg[\s>]/i.test(trimmed) || !/<\/svg>$/i.test(trimmed)) {
    return "не е единичен <svg> елемент";
  }
  if (trimmed.length > 200_000) return "твърде голям файл";
  for (const { pattern, reason } of FORBIDDEN) {
    if (pattern.test(trimmed)) return reason;
  }
  return null;
}

export function isSafeSvg(svg: string): boolean {
  return findSvgProblem(svg) === null;
}
