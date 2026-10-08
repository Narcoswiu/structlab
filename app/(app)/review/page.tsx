import type { Metadata } from "next";
import Link from "next/link";
import { Repeat } from "lucide-react";
import "katex/dist/katex.min.css";
import { dismissIntro } from "@/app/(app)/actions";
import { PageIntro } from "@/components/PageIntro";
import { ChapterBody } from "@/components/reader/ChapterBody";
import { ReviewSession } from "@/components/review/ReviewSession";
import { buttonClass } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { stripQuizNumber } from "@/lib/content/quiz";
import { getDueCards, getReviewSummary } from "@/lib/review";
import {
  REVIEW_INTERVALS,
  describeDue,
  questionsLabel,
  sofiaToday,
} from "@/lib/review-format";
import { getDismissedIntros } from "@/lib/user-settings";

export const metadata: Metadata = { title: "Повторение" };

/** Колко въпроса се показват наведнъж – за да не е уморително. */
const SESSION_SIZE = 12;

export default async function ReviewPage() {
  const user = await requireUser();
  const [summary, cards, dismissed] = await Promise.all([
    getReviewSummary(user.id),
    getDueCards(user.id, SESSION_SIZE),
    getDismissedIntros(),
  ]);
  const started = summary.learning + summary.mastered > 0;

  return (
    <>
      <PageIntro
        id="review"
        title="Повторение – за да не забравяш"
        icon={<Repeat aria-hidden="true" className="size-6" />}
        dismissed={dismissed.has("review")}
        onDismiss={dismissIntro}
      >
        Въпросите от „Провери се“, на които си отговорил, се връщат тук през все
        по-дълги интервали: след {REVIEW_INTERVALS.join(", ")} дни. Ако сгрешиш,
        въпросът започва отначало.
      </PageIntro>

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(24px,5vw,36px)] leading-[1.15] font-bold">
          Повторение
        </h1>
        <p className="text-muted-foreground">
          {summary.due > 0
            ? `Днес имаш ${questionsLabel(summary.due)} за повторение.`
            : started
              ? "За днес няма въпроси."
              : "Още нямаш въпроси за повторение."}
        </p>
      </div>

      {/* Компонентът стои винаги на едно и също място: така сесията не се
          прекъсва, когато страницата се опресни след отговор. */}
      <ReviewSession
        remaining={Math.max(0, summary.due - cards.length)}
        cards={cards.map((card) => ({
          questionId: card.questionId,
          source: `Глава ${card.chapterNumber} · ${card.chapterTitle}`,
          href: card.href,
          question: (
            <ChapterBody
              markdown={stripQuizNumber(card.question)}
              figures={{}}
            />
          ),
          answer: <ChapterBody markdown={card.answer} figures={{}} />,
        }))}
        empty={
          <section
            aria-label="Няма въпроси за днес"
            className="flex flex-col items-start gap-4 rounded-2xl border border-line-strong bg-surface p-6"
          >
            {started ? (
              <p className="text-muted-foreground">
                {summary.nextDueOn
                  ? `Следващото повторение е ${describeDue(summary.nextDueOn, sofiaToday())}.`
                  : "Всички въпроси, на които си отговорил, са научени."}
              </p>
            ) : (
              <p className="text-muted-foreground">
                Отвори глава, стигни до „Провери се“, виж отговора на въпрос и
                отбележи дали си го знаел. Оттам нататък въпросът сам ще се
                връща тук.
              </p>
            )}
            <Link href="/dashboard" className={buttonClass()}>
              Към главите
            </Link>
          </section>
        }
      />

      {started ? (
        <dl
          aria-label="Обобщение"
          className="flex flex-wrap gap-x-10 gap-y-3 text-sm text-dim"
        >
          <div>
            <dt>Още се повтарят</dt>
            <dd className="font-mono text-xl text-foreground">
              {summary.learning}
            </dd>
          </div>
          <div>
            <dt>Научени</dt>
            <dd className="font-mono text-xl text-foreground">
              {summary.mastered}
            </dd>
          </div>
        </dl>
      ) : null}
    </>
  );
}
