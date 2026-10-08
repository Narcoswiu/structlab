/**
 * Общото между сървъра и браузъра за помощника: режими, граници и формата на
 * отговорите. Тук няма нищо тайно – указанията към модела са в prompt.ts.
 */

/** „lessons“ – търси само в уроците; „ai“ – отговаря външна AI услуга. */
export type AssistantMode = "lessons" | "ai";

export const AI_MODES = [
  { id: "explain", label: "Обясни по-просто" },
  { id: "socratic", label: "Води ме с въпроси" },
  { id: "check", label: "Провери решението ми" },
  { id: "similar", label: "Подобна задача" },
] as const;

export type AiModeId = (typeof AI_MODES)[number]["id"];
export const AI_MODE_IDS = AI_MODES.map((mode) => mode.id) as [
  AiModeId,
  ...AiModeId[],
];

export const QUESTION_MAX = 1500;
export const HISTORY_MAX_ITEMS = 6;
export const HISTORY_ITEM_MAX = 2000;

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Глава, която потребителят може да чете – за „Питаш по: Глава …“. */
export type ChapterRef = {
  module: string;
  slug: string;
  number: number;
  title: string;
};

export type LessonExcerpt = {
  chapterNumber: number;
  chapterTitle: string;
  sectionTitle: string;
  subsectionTitle: string | null;
  markdown: string;
  href: string;
};

export type RelatedChapter = { number: number; title: string; href: string };

/** Отговорът на /api/assistant, когато не е поток от текст. */
export type AssistantJson =
  | {
      kind: "lessons";
      excerpts: LessonExcerpt[];
      related: RelatedChapter[];
      /** потребителят няма достъп до нито една глава */
      noAccess: boolean;
    }
  | { kind: "message"; text: string };

export const ASSISTANT_TEXT = {
  noAccess: "В момента нямаш достъп до учебника, затова няма в какво да търся.",
  notFound:
    "Не намерих това в учебника. Опитай с други думи или виж списъка с главите.",
  found: "Ето какво пише в учебника по въпроса ти:",
} as const;
