"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";
import { checkTask, type TaskCheckState } from "@/app/(app)/tasks/actions";
import { FormMessage, SubmitButton, inputClass } from "@/components/ui/form";
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
  const judged = (id: string) =>
    state.values[id] !== undefined &&
    state.values[id] !== "" &&
    id in state.results;
  const correctCount = fields.filter((field) => state.results[field.id]).length;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="task" value={task} />
      <ol className="flex flex-col gap-4">
        {fields.map((field) => {
          const inputId = `answer_${field.id}`;
          const shown = judged(field.id);
          const correct = shown && state.results[field.id] === true;
          const wrong = shown && state.results[field.id] === false;
          const fieldError = state.fieldErrors[field.id];
          return (
            <li key={field.id} className="flex flex-col gap-1.5">
              <label htmlFor={inputId} className="font-bold">
                {field.label}{" "}
                <span className="font-mono text-sm font-normal text-dim">
                  <Symbol text={field.symbol} />
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id={inputId}
                  name={inputId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  maxLength={30}
                  defaultValue={state.values[field.id] ?? ""}
                  aria-invalid={wrong || fieldError ? true : undefined}
                  aria-describedby={`${inputId}-note`}
                  className={cn(
                    inputClass,
                    "w-40 font-mono",
                    (wrong || fieldError) && "border-destructive",
                    correct && "border-success",
                  )}
                />
                <span className="font-mono text-sm text-dim">{field.unit}</span>
                {correct ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-success">
                    <Check aria-hidden="true" className="size-4" /> вярно
                  </span>
                ) : null}
                {wrong ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-warn-fg">
                    <X aria-hidden="true" className="size-4" /> не е вярно
                  </span>
                ) : null}
              </div>
              <p id={`${inputId}-note`} className="text-sm text-dim">
                {fieldError ?? (wrong ? `Насока: ${field.hint}` : "")}
              </p>
            </li>
          );
        })}
      </ol>

      <FormMessage kind="error">{state.error}</FormMessage>
      {state.solved ? (
        <FormMessage kind="success">
          Всички отговори са верни – заданието е решено.
        </FormMessage>
      ) : state.checked ? (
        <p role="status" className="text-sm text-muted-foreground">
          Верни: {correctCount} от {fields.length}. Поправи останалите и провери
          пак.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pendingText="Проверявам…">Провери</SubmitButton>
        <span className="text-sm text-dim">
          Десетична запетая; допуск 0,5 %.
        </span>
      </div>
    </form>
  );
}
