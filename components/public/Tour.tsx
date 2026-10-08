"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Step = {
  title: string;
  subtitle: string;
  why: string;
  how: string[];
  /** налично ли е вече в платформата */
  available: boolean;
  link?: { href: string; label: string };
};

// Обиколката описва всяка част на сайта. Частите, които още ги няма,
// са отбелязани – не обещаваме нищо като готово, преди да е.
const steps: Step[] = [
  {
    title: "Табло",
    subtitle: "Твоят начален екран",
    why: "Показва учебния план на твоята специалност, курс по курс, и кои дисциплини вече имат глави за четене.",
    how: [
      "Избери университета и специалността си – таблото се подрежда по тях.",
      "Дисциплините със зелен етикет имат готови глави.",
      "„Готово за четене“ е бърз списък на всичко налично.",
    ],
    available: true,
  },
  {
    title: "Учебник",
    subtitle: "Четене, което не уморява",
    why: "Всяка тема е обяснена в 7 стъпки – от загадка от живота до „Запомни“ – в два режима: леко и подробно.",
    how: [
      "Превключвай „Леко ⇄ Подробно“ на всяка глава – оставаш на същата секция.",
      "Избери светла, сепия или тъмна тема и удобен размер на шрифта.",
      "В „Провери се“ отговорите са скрити, докато не ги поискаш.",
    ],
    available: true,
    link: { href: "/demo/uchebnik", label: "Прочети демо глава" },
  },
  {
    title: "Лаборатории",
    subtitle: "Пипни теорията",
    why: "Виждаш как товарите променят реакциите и диаграмите – веднага, без да смяташ на ръка.",
    how: [
      "Греди: избери вид на гредата и въведи товарите. Сечения: сглоби сечение от правоъгълници.",
      "„Примери от учебника“ зарежда готови случаи.",
      "„Покажи решението стъпка по стъпка“ показва уравненията с твоите числа.",
    ],
    available: true,
    link: { href: "/demo/laboratoriya", label: "Отвори лабораторията" },
  },
  {
    title: "AI асистент",
    subtitle: "Учител, който пита",
    why: "Ще обяснява по-просто, ще те води с въпроси и ще отговаря само по учебника, като посочва урока.",
    how: [
      "Режими: „Обясни по-просто“, „Сократов“, „Провери решението ми“ и „Подобна задача“.",
      "Ще питаш за секцията, която четеш в момента.",
      "Курсови за оценка няма да решава – ще ти помага да ги разбереш.",
    ],
    available: false,
  },
  {
    title: "Повторение и тестове",
    subtitle: "За да не забравяш",
    why: "Въпросите се връщат след 1, 3, 7 и 14 дни – точно когато започваш да забравяш.",
    how: [
      "Под всеки отговор в „Провери се“ отбелязваш дали си го знаел.",
      "Таблото показва колко въпроса имаш за деня – отнема няколко минути.",
      "Сгрешен въпрос започва отначало и се връща още на следващия ден.",
    ],
    available: true,
  },
  {
    title: "Лични задания",
    subtitle: "Твоят вариант",
    why: "Вариантът на задачата ще се смята от факултетния ти номер, както в курсовите, а отговорите ще се проверяват стъпка по стъпка.",
    how: [
      "Въвеждаш факултетния си номер.",
      "Решаваш задачата на хартия.",
      "Въвеждаш резултатите и виждаш коя стъпка е грешна.",
    ],
    available: false,
  },
  {
    title: "Админ",
    subtitle: "Само за собственика",
    why: "Управление на достъпа: покани, срокове и списък на чакащите.",
    how: [
      "Достъпът е само с покана.",
      "Всеки акаунт е личен.",
      "С бутона „Обратна връзка“ пишеш направо на екипа.",
    ],
    available: true,
  },
];

/** Обиколка на сайта в 7 стъпки. */
export function Tour() {
  const [index, setIndex] = useState(0);
  const current = steps[index]!;

  return (
    <div className="flex flex-wrap items-start gap-6">
      <ol
        aria-label="Стъпки на обиколката"
        className="flex min-w-0 flex-[1_1_260px] flex-col gap-2"
      >
        {steps.map((step, i) => (
          <li key={step.title}>
            <button
              type="button"
              aria-current={i === index ? "step" : undefined}
              onClick={() => setIndex(i)}
              className={cn(
                "flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-left",
                i === index
                  ? "border-primary bg-surface-2"
                  : "border-line bg-surface hover:bg-surface-2",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-8 flex-none items-center justify-center rounded-full font-mono text-sm font-bold",
                  i === index
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-2 text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-bold">{step.title}</span>
                <span className="text-sm text-dim">{step.subtitle}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <section
        aria-live="polite"
        aria-label={`Стъпка ${index + 1} от ${steps.length}`}
        className="flex min-w-0 flex-[2_1_380px] flex-col gap-5 rounded-2xl border border-line bg-surface p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm text-primary">
            Стъпка {index + 1} от {steps.length}
          </span>
          <Badge variant={current.available ? "success" : "soon"}>
            {current.available ? "НАЛИЧНО" : "СКОРО"}
          </Badge>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-dim">{current.subtitle}</p>
          <h2 className="text-[26px] leading-[1.15] font-extrabold">
            {current.title}
          </h2>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-extrabold tracking-[1.2px] text-warm">
            ЗА КАКВО СЛУЖИ
          </h3>
          <p className="leading-[1.65] text-muted-foreground">{current.why}</p>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-extrabold tracking-[1.2px] text-warm">
            КАК СЕ ПОЛЗВА
          </h3>
          <ol className="flex flex-col gap-2">
            {current.how.map((line, i) => (
              <li
                key={line}
                className="flex gap-3 leading-[1.6] text-muted-foreground"
              >
                <span className="font-mono text-sm text-primary">{i + 1}</span>
                {line}
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="outline"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            ← Назад
          </Button>
          <Button
            disabled={index === steps.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            Напред →
          </Button>
          {current.link ? (
            <Link
              href={current.link.href}
              className={buttonClass({ variant: "outline" })}
            >
              {current.link.label}
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
