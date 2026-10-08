import { formatDate } from "@/lib/format-date";

/**
 * Текстът на личния воден знак върху разпечатаната глава:
 * „Лично копие за ivan@example.com · 09.10.2026 · StructLab“.
 * Датата е по българско време.
 */
export function buildWatermarkText(
  email: string,
  date: Date = new Date(),
): string {
  const owner = email.trim();
  return [
    owner ? `Лично копие за ${owner}` : "Лично копие",
    formatDate(date),
    "StructLab",
  ].join(" · ");
}
