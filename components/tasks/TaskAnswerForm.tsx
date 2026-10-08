"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Check, LoaderCircle, PartyPopper, X } from "lucide-react";
import { checkTask, type TaskCheckState } from "@/app/(app)/tasks/actions";
import { Button } from "@/components/ui/button";
import { FormMessage, inputClass } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export type AnswerField = {
  id: string;
  label: string;
  symbol: string;
  unit: string;
  hint: string;
};

/** „M_max“ → M с долен индекс „max“. */
function Symbol({ text }: { text: string }) {
  const parts = text.split(/_([A-Za-z0-9]+)/);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? <sub key={index}>{part}</sub> : part,
      )}
    </>
  );
}

/** Бутонът „Провери“: докато сървърът смята, е изключен и върти иконка. */
function CheckButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className="sl-press w-full sm:w-auto"
    >
      {pending ? (
        <>
          <LoaderCircle aria-hidden="true" className="sl-spin size-5" />
          Проверявам…
        </>
      ) : (
        "Провери"
      )}
    </Button>
  );
}

type TaskAnswerFormProps = {
  task: string;
  fields: AnswerField[];
  /** състоянието от последната проверка, записано в базата */
  initial: TaskCheckState;
};

/**
 * Полетата за отговор. След „Провери“ до всяко поле излиза дали е вярно;
 * при грешка се показва насока, но не и самото число.
 */
export function TaskAnswerForm({ task, fields, initial }: TaskAnswerFormProps) {
  const [state, action] = useActionState(checkTask, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const judged = (id: string) =>
    state.values[id] !== undefined &&
    state.values[id] !== "" &&
    id in state.results;
  const correctCount = fields.filter((field) => state.results[field.id]).length;

  // След проверка с клавиатура фокусът отива на първото поле за поправяне.
  // На екран с докосване не го местим – клавиатурата би закрила резултата.
  useEffect(() => {
    if (state === initial || state.solved) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const first = formRef.current?.querySelector<HTMLInputElement>(
      'input[aria-invalid="true"]',
    );
    if (first) {
      first.focus();
      first.select();
    }
  }, [state, initial]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-5">
      <input type="hidden" name="task" value={task} />
      <ol className="flex flex-col gap-5">
        {fields.map((field) => {
          const inputId = `answer_${field.id}`;
          const shown = judged(field.id);
          const correct = shown && state.results[field.id] === true;
          const wrong = shown && state.results[field.id] === false;
          const fieldError = state.fieldErrors[field.id];
          const note = fieldError ?? (wrong ? `Насока: ${field.hint}` : "");
          return (
            <li key={field.id} className="flex flex-col gap-2">
              <label htmlFor={inputId} className="leading-snug font-bold">
                {field.label}{" "}
                <span className="font-mono text-sm font-normal text-dim">
                  <Symbol text={field.symbol} />
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <input
                  id={inputId}
                  name={inputId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  enterKeyHint="done"
                  maxLength={30}
                  defaultValue={state.values[field.id] ?? ""}
                  aria-invalid={wrong || fieldError ? true : undefined}
                  aria-describedby={`${inputId}-note`}
                  className={cn(
                    inputClass,
                    "min-h-12 w-40 font-mono text-lg transition-colors focus-visible:border-primary",
                    (wrong || fieldError) && "border-destructive bg-danger-bg",
                    correct && "border-success bg-success-bg",
                  )}
                />
                <span className="font-mono text-sm text-dim">{field.unit}</span>
                {correct ? (
                  <span className="sl-pop inline-flex min-h-7 items-center gap-1 rounded-full bg-success-bg px-2.5 text-sm font-bold text-success-fg">
                    <Check
                      aria-hidden="true"
                      className="size-4"
                      strokeWidth={3}
                    />{" "}
                    вярно
                  </span>
                ) : null}
                {wrong ? (
                  <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-warn-bg px-2.5 text-sm font-bold text-warn-fg">
                    <X aria-hidden="true" className="size-4" strokeWidth={3} />{" "}
                    не е вярно
                  </span>
                ) : null}
              </div>
              <p
                id={`${inputId}-note`}
                className={cn(
                  "text-sm leading-normal",
                  note
                    ? "sl-rise max-w-[68ch] border-l-2 pl-3"
                    : "sr-only",
                  fieldError
                    ? "border-destructive text-danger-fg"
                    : "border-warm text-muted-foreground",
                )}
              >
                {note}
              </p>
            </li>
          );
        })}
      </ol>

      <FormMessage kind="error">{state.error}</FormMessage>
      {state.solved ? (
        <p
          role="status"
          className="sl-rise flex items-center gap-3 rounded-xl border border-success bg-success-bg p-4 leading-normal font-bold text-success-fg"
        >
          <span
            aria-hidden="true"
            className="sl-pop inline-flex size-10 flex-none items-center justify-center rounded-full bg-success text-primary-foreground"
          >
            <PartyPopper className="size-5" />
          </span>
          <span>Всички отговори са верни – заданието е решено.</span>
        </p>
      ) : state.checked ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* по една чертичка на въпрос – колко остава се вижда с един поглед */}
          <span aria-hidden="true" className="flex gap-1.5">
            {fields.map((field) => (
              <span
                key={field.id}
                className={cn(
                  "h-2 w-7 rounded-full",
                  state.results[field.id] === true
                    ? "bg-success"
                    : judged(field.id)
                      ? "bg-warm"
                      : "bg-line-strong",
                )}
              />
            ))}
          </span>
          <p role="status" className="text-sm text-muted-foreground">
            Верни: {correctCount} от {fields.length}. Поправи останалите и
            провери пак.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <CheckButton />
        <span className="text-sm text-dim">
          Десетична запетая; допуск 0,5 %.
        </span>
      </div>
    </form>
  );
}
