import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Repeat } from "lucide-react";
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
        <h1 className="sl-page-title">Повторение</h1>
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
            className="sl-card sl-card-strong flex flex-col items-start gap-4"
          >
            <span
              aria-hidden="true"
              className="sl-chip-icon"
              data-tone="success"
            >
              <CalendarCheck className="size-5" />
            </span>
            {started ? (
              <p className="max-w-[60ch] leading-[1.6] text-muted-foreground">
                {summary.nextDueOn
                  ? `Следващото повторение е ${describeDue(summary.nextDueOn, sofiaToday())}.`
                  : "Всички въпроси, на които си отговорил, са научени."}
              </p>
            ) : (
              <p className="max-w-[60ch] leading-[1.6] text-muted-foreground">
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
        <dl aria-label="Обобщение" className="grid max-w-md grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-xl bg-surface p-4">
            <dt className="text-sm text-dim">Още се повтарят</dt>
            <dd className="font-mono text-2xl text-foreground">
              {summary.learning}
            </dd>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-surface p-4">
            <dt className="text-sm text-dim">Научени</dt>
            <dd className="font-mono text-2xl text-success">
              {summary.mastered}
            </dd>
          </div>
        </dl>
      ) : null}
    </>
  );
}
