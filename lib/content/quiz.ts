import { createHash } from "node:crypto";

/** Един въпрос от „Провери се“, както е записан в текста на главата. */
export type QuizItem = {
  /** отпечатък на текста на въпроса – постоянен, докато въпросът не се промени */
  key: string;
  /** поредност в главата, от 1 */
  position: number;
  question: string;
  answer: string;
};

const QUIZ_BLOCK =
  /^::::quiz[ \t]*\n([\s\S]*?)\n:::answer[ \t]*\n([\s\S]*?)\n:::[ \t]*\n::::[ \t]*$/gm;

/** „**3.** Колко е…“ → „Колко е…“ (номерът важи само вътре в главата). */
export function stripQuizNumber(question: string): string {
  return question.replace(/^\*\*\d+\.\*\*\s*/, "");
}

export function quizKey(question: string): string {
  const normalized = stripQuizNumber(question.trim()).replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/** Всички въпроси в текста, по реда им. */
export function extractQuizzes(markdown: string): QuizItem[] {
  const items: QuizItem[] = [];
  for (const match of markdown.matchAll(QUIZ_BLOCK)) {
    const question = match[1]!.trim();
    items.push({
      key: quizKey(question),
      position: items.length + 1,
      question,
      answer: match[2]!.trim(),
    });
  }
  return items;
}

/**
 * Проверка на въпросите в един текст: всеки „::::quiz“ трябва да е разпознат,
 * да има отговор, да няма фигури и да не се повтаря.
 */
export function findQuizProblems(markdown: string): string[] {
  const problems: string[] = [];
  const items = extractQuizzes(markdown);
  const opened = (markdown.match(/^::::quiz\b/gm) ?? []).length;
  if (opened !== items.length) {
    problems.push(
      `Има ${opened} блока „::::quiz“, но разпознатите въпроси са ${items.length} – провери „:::answer“ и затварящите редове.`,
    );
  }
  const seen = new Set<string>();
  for (const item of items) {
    if (!stripQuizNumber(item.question) || !item.answer) {
      problems.push(`Въпрос ${item.position} няма текст или отговор.`);
    }
    if (/\]\(figure:/.test(item.question + item.answer)) {
      problems.push(`Въпрос ${item.position} съдържа фигура – не се поддържа.`);
    }
    if (item.question.length > 4000 || item.answer.length > 4000) {
      problems.push(`Въпрос ${item.position} е твърде дълъг.`);
    }
    if (seen.has(item.key)) {
      problems.push(`Въпрос ${item.position} се повтаря в същата глава.`);
    }
    seen.add(item.key);
  }
  return problems;
}
