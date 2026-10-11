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
  /** думите от откъса, които отговарят на въпроса – панелът ги оцветява */
  highlights?: string[];
};

export type RelatedChapter = { number: number; title: string; href: string };

/** Отговорът на /api/assistant, когато не е поток от текст. */
export type AssistantJson =
  | {
      kind: "lessons";
      /** най-добрият откъс е първи */
      excerpts: LessonExcerpt[];
      /** без откъси: главите, чието заглавие е най-близо до въпроса */
      related: RelatedChapter[];
      /** с откъси: до две други глави, в които също пише за това */
      more?: RelatedChapter[];
      /** без откъси: въпроси от главите на потребителя, които имат отговор */
      suggestions?: string[];
      /** потребителят няма достъп до нито една глава */
      noAccess: boolean;
    }
  | { kind: "message"; text: string };

/** Отговорът на GET /api/assistant: примерни въпроси за празния панел. */
export type AssistantSuggestions = { suggestions: string[] };

/** Колко примерни въпроса показва празният панел. */
export const EXAMPLE_QUESTIONS = 4;
/** Колко въпроса се предлагат, когато нищо не е намерено. */
export const NOT_FOUND_SUGGESTIONS = 3;
/** Колко други глави се показват под откъсите („Виж още“). */
export const MORE_CHAPTERS = 2;

export const ASSISTANT_TEXT = {
  /** какво е помощникът и какво не е – стои под името му */
  about:
    "Търся само в уроците на платформата и ти показвам точния откъс с връзка към него.",
  aboutNot: "Не решавам курсови и не измислям отговори.",
  aboutAi:
    "Отговарям само по уроците на платформата и посочвам главата и секцията.",
  noAccess: "В момента нямаш достъп до учебника, затова няма в какво да търся.",
  notFound:
    "Не намерих това в учебника. Опитай с други думи или виж списъка с главите.",
  notFoundTitle: "Не намерих това в уроците.",
  notFoundHint:
    "Помощникът търси по думи. Попитай с термина от учебника, например „огъващ момент“, или опитай с някой от тези въпроси:",
  notFoundPlain:
    "Помощникът търси по думи. Попитай с термина от учебника, например „огъващ момент“.",
  found: "Ето какво пише в учебника по въпроса ти:",
} as const;
