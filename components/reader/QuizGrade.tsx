"use client";

import { useState, useTransition } from "react";
import { answerQuiz } from "@/app/(app)/actions";
import {
  MASTERED_BOX,
  describeDue,
  describeOutcome,
  sofiaToday,
} from "@/lib/review-format";

export type QuizGradeState = {
  questionId: string;
  /** в коя кутия е въпросът за този потребител; null = още не е отговарял */
  box: number | null;
  dueOn: string | null;
};

function describeCurrent(state: QuizGradeState): string | null {
  if (state.box === null) return null;
  if (state.box >= MASTERED_BOX || state.dueOn === null) {
    return "Този въпрос вече е научен.";
  }
  return `Следващо повторение: ${describeDue(state.dueOn, sofiaToday())}.`;
}

/**
 * Двата бутона под отговора. Потребителят сам преценява дали е знаел –
 * от това зависи кога въпросът ще се появи пак в „Повторение“.
 */
export function QuizGrade(props: QuizGradeState) {
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(knew: boolean) {
    setFailed(false);
    startTransition(async () => {
      const outcome = await answerQuiz(props.questionId, knew);
      if (outcome.status === "ok") {
        setMessage(describeOutcome(outcome, sofiaToday()));
        return;
      }
      setFailed(true);
      setMessage(
        outcome.status === "limited"
          ? "Твърде много отговори за кратко време. Опитай пак след минута."
          : "Отговорът не се записа. Опитай пак.",
      );
    });
  }

  return (
    <div className="quiz-grade">
      <p className="quiz-grade-ask">Знаеше ли отговора?</p>
      <div className="quiz-grade-buttons">
        <button
          type="button"
          className="quiz-grade-yes"
          disabled={pending}
          onClick={() => submit(true)}
        >
          Знаех го
        </button>
        <button
          type="button"
          className="quiz-grade-no"
          disabled={pending}
          onClick={() => submit(false)}
        >
          Не го знаех
        </button>
      </div>
      <p
        className="quiz-grade-note"
        role="status"
        data-state={failed ? "error" : "ok"}
      >
        {message ??
          describeCurrent(props) ??
          "Отговорът ти се записва, за да ти покажем въпроса пак точно когато започваш да го забравяш."}
      </p>
    </div>
  );
}
