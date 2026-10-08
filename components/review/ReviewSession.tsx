"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { answerQuiz } from "@/app/(app)/actions";
import { Button, buttonClass } from "@/components/ui/button";
import { describeOutcome, sofiaToday } from "@/lib/review-format";

export type ReviewCard = {
  questionId: string;
  /** „Глава 3 · Чист опън и натиск“ */
  source: string;
  href: string;
  question: ReactNode;
  answer: ReactNode;
};

type ReviewSessionProps = {
  cards: ReviewCard[];
  /** колко въпроса за днес остават извън тази порция */
  remaining: number;
  /** какво да се покаже, когато при отварянето няма въпроси за днес */
  empty: ReactNode;
};

/**
 * Показва въпросите за днес един по един: въпрос → „Покажи отговора“ →
 * „Знаех го“ / „Не го знаех“ → следващият.
 */
export function ReviewSession(props: ReviewSessionProps) {
  // Порцията се фиксира при отваряне на страницата. След всеки отговор
  // сървърът изпраща нов (по-къс) списък – ако го следвахме, броячът
  // „Въпрос 2 от 5“ щеше да започва отначало по средата на сесията, а след
  // последния въпрос екранът „Готово!“ изобщо нямаше да се появи.
  const [{ cards, remaining }] = useState(props);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [knewCount, setKnewCount] = useState(0);
  const [lastNote, setLastNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const card = cards[index];

  function grade(knew: boolean) {
    if (!card) return;
    setError(null);
    startTransition(async () => {
      const outcome = await answerQuiz(card.questionId, knew);
      if (outcome.status !== "ok") {
        setError(
          outcome.status === "limited"
            ? "Твърде много отговори за кратко време. Опитай пак след минута."
            : "Отговорът не се записа. Опитай пак.",
        );
        return;
      }
      if (knew) setKnewCount((count) => count + 1);
      setLastNote(describeOutcome(outcome, sofiaToday()));
      setRevealed(false);
      setIndex((current) => current + 1);
    });
  }

  if (cards.length === 0) return props.empty;

  if (!card) {
    return (
      <section
        aria-label="Край на повторението"
        className="flex flex-col items-start gap-4 rounded-2xl border border-primary bg-surface-hi p-6"
      >
        <h2 className="text-2xl font-extrabold">Готово!</h2>
        <p className="text-muted-foreground" role="status">
          Знаеше {knewCount} от {cards.length}.{" "}
          {remaining > 0
            ? `За днес остават още ${remaining}.`
            : "За днес няма повече въпроси."}
        </p>
        {remaining > 0 ? (
          // пълно презареждане, за да дойде следващата порция от сървъра
          <a href="/review" className={buttonClass()}>
            Следващите въпроси
          </a>
        ) : (
          <Link href="/dashboard" className={buttonClass()}>
            Към таблото
          </Link>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Въпрос за повторение" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-sm text-dim">
          Въпрос {index + 1} от {cards.length}
        </p>
        <Link
          href={card.href}
          className="inline-flex min-h-11 items-center text-sm font-bold text-link hover:text-link-hover"
        >
          {card.source} →
        </Link>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={cards.length}
        aria-valuenow={index}
        aria-label={`Отговорени въпроси: ${index} от ${cards.length}`}
        className="h-1.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-success"
          style={{ width: `${(index / cards.length) * 100}%` }}
        />
      </div>

      <div className="flex flex-col gap-5 rounded-2xl border border-line-strong bg-surface p-5 sm:p-7">
        <div className="reader review-card">
          <div className="reader-prose">{card.question}</div>
        </div>

        {revealed ? (
          <>
            <div className="reader review-card border-t border-line pt-5">
              <p className="mb-2 text-xs font-extrabold tracking-[1.2px] text-link uppercase">
                Отговор
              </p>
              <div className="reader-prose">{card.answer}</div>
            </div>
            <div className="flex flex-col gap-3">
              <p className="font-extrabold">Знаеше ли отговора?</p>
              <div className="flex flex-wrap gap-3">
                <Button disabled={pending} onClick={() => grade(true)}>
                  Знаех го
                </Button>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => grade(false)}
                >
                  Не го знаех
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div>
            <Button onClick={() => setRevealed(true)}>Покажи отговора</Button>
          </div>
        )}
      </div>

      <p className="min-h-6 text-sm text-dim" role="status">
        {error ? <span className="text-warn-fg">{error}</span> : lastNote}
      </p>
    </section>
  );
}
