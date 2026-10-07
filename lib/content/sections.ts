/** Седемте стъпки на всяка глава (CONTENT_GUIDE.md) – заглавие и постоянен id. */
export const CHAPTER_SECTIONS = [
  { id: "zagadka", title: "Загадка" },
  { id: "vizh", title: "Виж" },
  { id: "razberi", title: "Разбери" },
  { id: "primer", title: "Решен пример" },
  { id: "zhivot", title: "В реалния живот" },
  { id: "proveri", title: "Провери се" },
  { id: "zapomni", title: "Запомни" },
] as const;

export type SectionId = (typeof CHAPTER_SECTIONS)[number]["id"];

const idByTitle = new Map<string, string>(
  CHAPTER_SECTIONS.map((section) => [section.title, section.id]),
);

export function sectionIdForTitle(title: string): string | undefined {
  return idByTitle.get(title.trim());
}

/** Заглавията от второ ниво (## …) в реда, в който са в текста. */
export function extractSectionTitles(markdown: string): string[] {
  const titles: string[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (/^(```|~~~)/.test(line)) inFence = !inFence;
    const match = !inFence && /^##\s+(.+?)\s*$/.exec(line);
    if (match) titles.push(match[1]!);
  }
  return titles;
}
