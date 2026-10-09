/**
 * Четирите вида напомняния като „шаблони“ за преглед и пробно писмо.
 * Отделен файл без зависимости, за да може да се ползва и в браузъра.
 */
export const SAMPLE_TEMPLATES = [
  "review",
  "continue",
  "weekly",
  "new-chapter",
] as const;
export type SampleTemplate = (typeof SAMPLE_TEMPLATES)[number];

export const SAMPLE_LABELS: Record<SampleTemplate, string> = {
  review: "Днес за повторение",
  continue: "Продължи откъдето спря",
  weekly: "Твоята седмица",
  "new-chapter": "Нова глава",
};

export function isSampleTemplate(value: unknown): value is SampleTemplate {
  return SAMPLE_TEMPLATES.some((template) => template === value);
}
