const dateFormatter = new Intl.DateTimeFormat("bg-BG", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Sofia",
});

/** 2026-10-21T… → „21.10.2026“ (по българско време). */
export function formatDate(value: string | Date): string {
  return dateFormatter
    .format(typeof value === "string" ? new Date(value) : value)
    .replace(/\s*г\.$/, "");
}

/** Оставащи цели дни до дата; 0, ако е минала. */
export function daysUntil(
  value: string | Date,
  now: Date = new Date(),
): number {
  const target = typeof value === "string" ? new Date(value) : value;
  const diff = target.getTime() - now.getTime();
  return diff <= 0 ? 0 : Math.ceil(diff / (24 * 60 * 60 * 1000));
}
