/**
 * Напомняния: чисти помощни функции (без база и без мрежа) – време по
 * българско време, седмици, серии, маскиране на адреси.
 */

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

const sofiaParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Sofia",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type SofiaMoment = {
  /** „2026-10-12“ */
  day: string;
  /** 0–23 */
  hour: number;
  minute: number;
  /** 0 = понеделник … 6 = неделя */
  weekday: number;
};

/** Колко е часът и кой ден е в България в даден момент (лятно/зимно време). */
export function sofiaMoment(moment: Date): SofiaMoment {
  const parts = new Map(
    sofiaParts.formatToParts(moment).map((part) => [part.type, part.value]),
  );
  return {
    day: `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`,
    hour: Number(parts.get("hour")),
    minute: Number(parts.get("minute")),
    weekday: WEEKDAYS.indexOf(parts.get("weekday") ?? ""),
  };
}

/** Ден (ГГГГ-ММ-ДД) плюс или минус няколко дни. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * „2026-10-12T10:30“ по българско време → момент. Връща null при грешен вход.
 * Ползва се от пробата в админ панела („какво би тръгнало в друг момент“).
 */
export function sofiaLocalToDate(local: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return null;
  const guess = Date.parse(`${local}:00Z`);
  if (Number.isNaN(guess)) return null;
  // България е с 2 или 3 часа пред UTC – пробваме и двете
  for (const offset of [3, 2]) {
    const candidate = new Date(guess - offset * HOUR_MS);
    const at = sofiaMoment(candidate);
    if (
      at.day === match[1] &&
      at.hour === Number(match[2]) &&
      at.minute === Number(match[3])
    ) {
      return candidate;
    }
  }
  return null;
}

/** Понеделникът на седмицата, в която е даденият момент (по българско време). */
export function weekStart(now: Date): string {
  const at = sofiaMoment(now);
  return addDays(at.day, -at.weekday);
}

const dayMonth = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;

/** Предишната седмица: седемте ѝ дни (пн–нд) и етикет „29.09 – 05.10“. */
export function previousWeek(now: Date): { days: string[]; label: string } {
  const monday = addDays(weekStart(now), -7);
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  return { days, label: `${dayMonth(days[0]!)} – ${dayMonth(days[6]!)}` };
}

export const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

/**
 * Поредни дни с учене до днес. Ако днес още няма активност, серията се брои
 * до вчера (денят не е свършил). 0 = няма серия.
 */
export function streakDays(activeDays: Iterable<string>, today: string) {
  const active = new Set(activeDays);
  let day = active.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (active.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

/** „maria.petrova@gmail.com“ → „m***@gmail.com“. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

/**
 * Става ли въпросът за „закачка“ в писмо: едно кратко изречение без формули
 * ($…$) и без Markdown/LaTeX, които в имейл биха излезли като сурови знаци.
 */
export function isPlainTeaser(question: string): boolean {
  const text = question.trim();
  if (text.length < 10 || text.length > 220) return false;
  if (/[\n\r]/.test(text)) return false;
  return !/[$\\*_`#<>[\]{}|^~]|!\(|:::/.test(text);
}

/** „Мария Петрова“ → „Мария“. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/**
 * Кратък клас на грешка при изпращане – за лога. Никога не връща текста на
 * грешката: в него може да има адрес на получател.
 */
export function errorClass(error: unknown): string {
  if (error && typeof error === "object") {
    const { code, responseCode, name } = error as Record<string, unknown>;
    if (typeof code === "string" && /^[A-Z0-9_]{2,30}$/.test(code)) return code;
    if (typeof responseCode === "number") return `SMTP_${responseCode}`;
    if (typeof name === "string" && /^[A-Za-z]{2,30}$/.test(name)) return name;
  }
  return "Error";
}
