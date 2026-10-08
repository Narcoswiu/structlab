import "server-only";
import { sofiaToday } from "@/lib/review-format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ReviewSummary = {
  /** въпроси за повторение днес (вкл. закъснелите) */
  due: number;
  /** въпроси, които още се повтарят */
  learning: number;
  /** научени въпроси */
  mastered: number;
  /** най-близкият ден с повторение след днес; null, ако няма */
  nextDueOn: string | null;
};

/**
 * Обобщение за таблото. RLS връща само редовете на влезлия потребител, а
 * вътрешната връзка към въпросите скрива тези от глави без активен достъп.
 */
export async function getReviewSummary(userId: string): Promise<ReviewSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quiz_reviews")
    .select("box, due_on, quiz_questions!inner(id)")
    .eq("user_id", userId);
  const today = sofiaToday();
  const summary: ReviewSummary = {
    due: 0,
    learning: 0,
    mastered: 0,
    nextDueOn: null,
  };
  for (const row of data ?? []) {
    if (row.due_on === null) {
      summary.mastered += 1;
      continue;
    }
    summary.learning += 1;
    if (row.due_on <= today) summary.due += 1;
    else if (!summary.nextDueOn || row.due_on < summary.nextDueOn) {
      summary.nextDueOn = row.due_on;
    }
  }
  return summary;
}

export type DueCard = {
  questionId: string;
  question: string;
  answer: string;
  box: number;
  chapterTitle: string;
  chapterNumber: number;
  moduleTitle: string;
  href: string;
};

/** Въпросите за днес, най-закъснелите първи. */
export async function getDueCards(
  userId: string,
  limit: number,
): Promise<DueCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quiz_reviews")
    .select(
      "box, due_on, question_id, quiz_questions!inner(question, answer, mode, position, chapters!inner(slug, title, number, modules!inner(slug, title)))",
    )
    .eq("user_id", userId)
    .lte("due_on", sofiaToday())
    .order("due_on")
    .order("question_id")
    .limit(limit);
  return (data ?? []).map((row) => {
    const question = row.quiz_questions;
    const chapter = question.chapters;
    return {
      questionId: row.question_id,
      question: question.question,
      answer: question.answer,
      box: row.box,
      chapterTitle: chapter.title,
      chapterNumber: chapter.number,
      moduleTitle: chapter.modules.title,
      href: `/learn/${chapter.modules.slug}/${chapter.slug}?mode=${question.mode}#proveri`,
    };
  });
}

/** Състоянието на въпросите от една глава – за четеца. */
export async function getChapterQuizState(
  userId: string,
  chapterId: string,
  mode: "easy" | "detailed",
): Promise<
  Map<string, { id: string; box: number | null; dueOn: string | null }>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quiz_questions")
    .select("id, key, quiz_reviews(box, due_on, user_id)")
    .eq("chapter_id", chapterId)
    .eq("mode", mode);
  return new Map(
    (data ?? []).map((row) => {
      const mine = row.quiz_reviews.find((review) => review.user_id === userId);
      return [
        row.key,
        { id: row.id, box: mine?.box ?? null, dueOn: mine?.due_on ?? null },
      ];
    }),
  );
}

export type QuizAnswerResult =
  | { status: "ok"; box: number; dueOn: string | null }
  | { status: "limited" | "error" };

/**
 * Записва отговор. Вика се само от сървъра, след като е проверено кой е
 * потребителят и че вижда въпроса (тоест има достъп до главата).
 */
export async function recordQuizAnswer(
  userId: string,
  questionId: string,
  knew: boolean,
): Promise<QuizAnswerResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_quiz_answer", {
    p_user: userId,
    p_question: questionId,
    p_knew: knew,
  });
  const row = data?.[0];
  if (error || !row) return { status: "error" };
  if (row.limited) return { status: "limited" };
  return { status: "ok", box: row.box, dueOn: row.due_on };
}
