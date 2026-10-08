"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Check, LoaderCircle, RotateCcw } from "lucide-react";
import { answerQuiz } from "@/app/(app)/actions";
import { Button, buttonClass } from "@/components/ui/button";
import { describeOutcome, sofiaToday } from "@/lib/review-format";
import { cn } from "@/lib/utils";

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
 *
 * С клавиатура: Enter показва отговора, после 1 = „Знаех го“, 2 = „Не го
 * знаех“. Клавишите работят само докато фокусът е в самата карта.
 */
export function ReviewSession(props: ReviewSessionProps) {
  // Порцията се фиксира при отваряне на страницата. След всеки отговор
  // сървърът изпраща нов (по-къс) списък – ако го следвахме, броячът
  // „Въпрос 2 от 5“ щеше да започва отначало по средата на сесията, а след
  // последния въпрос екранът „Готово!“ изобщо нямаше да се появи.
  const [{ cards, remaining }] = useState(props);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  // отговорите дотук, по реда на въпросите: true = „Знаех го“
  const [results, setResults] = useState<boolean[]>([]);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [lastNote, setLastNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const revealRef = useRef<HTMLButtonElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  // фокусът се мести само след действие на потребителя, не при отваряне
  const acted = useRef(false);

  const card = cards[index];
  const finished = cards.length > 0 && !card;
  const knewCount = results.filter(Boolean).length;

  // След всяка стъпка фокусът отива там, където е следващото действие.
  useEffect(() => {
    if (!acted.current) return;
    if (finished) doneRef.current?.focus();
    else if (revealed) answerRef.current?.focus();
    else revealRef.current?.focus();
  }, [index, revealed, finished]);

  function reveal() {
    acted.current = true;
    setRevealed(true);
  }

  function grade(knew: boolean) {
    if (!card || pending) return;
    acted.current = true;
    setError(null);
    setChoice(knew);
    startTransition(async () => {
      const outcome = await answerQuiz(card.questionId, knew);
      setChoice(null);
      if (outcome.status !== "ok") {
        setError(
          outcome.status === "limited"
            ? "Твърде много отговори за кратко време. Опитай пак след минута."
            : "Отговорът не се записа. Опитай пак.",
        );
        return;
      }
      setResults((current) => [...current, knew]);
      setLastNote(describeOutcome(outcome, sofiaToday()));
      setRevealed(false);
      setIndex((current) => current + 1);
    });
  }

  function handleKeys(event: KeyboardEvent<HTMLElement>) {
    if (!revealed || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "1") grade(true);
    else if (event.key === "2") grade(false);
  }

  if (cards.length === 0) return props.empty;

  if (!card) {
    return (
      <section
        aria-label="Край на повторението"
        className="sl-card sl-card-primary sl-rise flex flex-col items-start gap-4"
      >
        <span
          aria-hidden="true"
          className="sl-pop inline-flex size-14 items-center justify-center rounded-full bg-success-bg text-success-fg"
        >
          <Check className="size-7" strokeWidth={3} />
        </span>
        <h2
          ref={doneRef}
          tabIndex={-1}
          className="text-2xl font-extrabold outline-none"
        >
          Готово!
        </h2>
        <p className="text-muted-foreground" role="status">
          Знаеше {knewCount} от {cards.length}.{" "}
          {remaining > 0
            ? `За днес остават още ${remaining}.`
            : "За днес няма повече въпроси."}
        </p>
        {/* по една чертичка на въпрос: зелена = знаел, оранжева = за повторение */}
        <span aria-hidden="true" className="flex flex-wrap gap-1.5">
          {results.map((knew, position) => (
            <span
              key={position}
              className={cn(
                "h-2 w-7 rounded-full",
                knew ? "bg-success" : "bg-warm",
              )}
            />
          ))}
        </span>
        {remaining > 0 ? (
          // пълно презареждане, за да дойде следващата порция от сървъра
          <a href="/review" className={buttonClass({ size: "lg" })}>
            Следващите въпроси
          </a>
        ) : (
          <Link href="/dashboard" className={buttonClass({ size: "lg" })}>
            Към таблото
          </Link>
        )}
      </section>
    );
  }

  return (
    // клавишите 1 и 2 се слушат тук, а не в целия прозорец
    <section
      aria-label="Въпрос за повторение"
      className="flex flex-col gap-3"
      onKeyDown={handleKeys}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4">
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
        className="sl-meter"
      >
        <div style={{ width: `${(index / cards.length) * 100}%` }} />
      </div>

      <div
        key={card.questionId}
        className="sl-card sl-card-strong sl-rise mt-1 flex flex-col gap-5 sm:p-7"
      >
        <div className="reader review-card">
          <div className="reader-prose">{card.question}</div>
        </div>

        {revealed ? (
          <>
            {/* рамката е отвън: .review-card нулира отстъпите на четеца */}
            <div
              ref={answerRef}
              tabIndex={-1}
              className="sl-rise border-t border-line pt-5 outline-none"
            >
              <p className="sl-kicker mb-2 text-link">Отговор</p>
              <div className="reader review-card">
                <div className="reader-prose">{card.answer}</div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <p className="font-extrabold">Знаеше ли отговора?</p>
              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                <Button
                  variant="success"
                  size="lg"
                  className="sl-press gap-2 px-3 sm:gap-2.5 sm:px-[26px]"
                  disabled={pending}
                  onClick={() => grade(true)}
                >
                  {choice === true ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="sl-spin size-5"
                    />
                  ) : (
                    <Check aria-hidden="true" className="size-5" />
                  )}
                  Знаех го
                  <span aria-hidden="true" className="sl-kbd">
                    1
                  </span>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="sl-press gap-2 px-3 sm:gap-2.5 sm:px-[26px]"
                  disabled={pending}
                  onClick={() => grade(false)}
                >
                  {choice === false ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="sl-spin size-5"
                    />
                  ) : (
                    <RotateCcw aria-hidden="true" className="size-5" />
                  )}
                  Не го знаех
                  <span aria-hidden="true" className="sl-kbd">
                    2
                  </span>
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div>
            <Button
              ref={revealRef}
              size="lg"
              className="sl-press w-full sm:w-auto"
              onClick={reveal}
            >
              Покажи отговора
            </Button>
          </div>
        )}
      </div>

      <p className="min-h-6 text-sm text-dim" role="status">
        {error ? <span className="text-warn-fg">{error}</span> : lastNote}
      </p>
    </section>
  );
}
