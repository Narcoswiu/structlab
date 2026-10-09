"use client";

import { useActionState } from "react";
import {
  previewReminders,
  sendTestReminder,
  setRemindersSwitch,
  type DryRunRow,
  type DryRunState,
} from "@/app/admin/reminders-actions";
import { Badge } from "@/components/ui/badge";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { emptyFormState } from "@/lib/form-state";
import type { ReminderKind } from "@/lib/reminders/decide";
import { SAMPLE_LABELS, SAMPLE_TEMPLATES } from "@/lib/reminders/templates";

const kindLabel: Record<ReminderKind, string> = {
  weekly: "Седмичен отчет",
  review_due: "Повторение",
  continue: "Продължи",
};

type RemindersPanelProps = {
  enabled: boolean;
  /** „21.10.2026 от Иван“; null, ако ключът никога не е пипан */
  changed: string | null;
  emailConfigured: boolean;
};

const subheading = "text-base font-extrabold";

function Rows({ rows }: { rows: DryRunRow[] }) {
  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li
          key={row.userId}
          className="flex flex-col gap-1 border-t border-line py-3 first:border-0 first:pt-0"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-bold break-all">{row.name || "без име"}</span>
            <span className="text-sm break-all text-dim">
              {row.maskedEmail}
            </span>
            {row.kind ? <Badge>{kindLabel[row.kind]}</Badge> : null}
          </div>
          <p className="text-sm text-dim">{row.reason}</p>
        </li>
      ))}
    </ul>
  );
}

export function RemindersPanel({
  enabled,
  changed,
  emailConfigured,
}: RemindersPanelProps) {
  const [switchState, switchAction] = useActionState(
    setRemindersSwitch,
    emptyFormState,
  );
  const [testState, testAction] = useActionState(
    sendTestReminder,
    emptyFormState,
  );
  const initialDryRun: DryRunState = {};
  const [dryRun, dryRunAction] = useActionState(
    previewReminders,
    initialDryRun,
  );

  return (
    <>
      <div className="flex flex-col gap-3">
        <h3 className={subheading}>Главен ключ</h3>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Badge variant={enabled ? "success" : "soon"}>
            {enabled ? "ВКЛЮЧЕНИ" : "ИЗКЛЮЧЕНИ"}
          </Badge>
          <span className="text-sm text-dim">
            {changed ? `последна промяна: ${changed}` : "ключът още не е пипан"}
          </span>
        </p>
        <p className="text-muted-foreground">
          {enabled
            ? "Веднъж на ден студентите с включени напомняния получават писмо, ако има повод – най-много едно на три дни."
            : "Докато ключът е изключен, към студентите не тръгва нито едно напомняне. Пробните писма по-долу отиват само при теб."}
        </p>
        <form action={switchAction} className="flex flex-col gap-3">
          {enabled ? (
            <>
              <input type="hidden" name="intent" value="off" />
              <SubmitButton variant="outline" className="self-start">
                Изключи напомнянията
              </SubmitButton>
            </>
          ) : (
            <>
              <input type="hidden" name="intent" value="on" />
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  name="confirm"
                  className="size-5 flex-none"
                />
                <span>
                  Разбирам, че студентите ще започнат да получават писма
                </span>
              </label>
              <SubmitButton variant="warm" className="self-start">
                Включи напомнянията
              </SubmitButton>
            </>
          )}
          <FormMessage kind="error">{switchState.error}</FormMessage>
          <FormMessage kind="success">{switchState.success}</FormMessage>
        </form>
        {enabled && !emailConfigured ? (
          <p className="text-sm text-dim">
            Пощата не е настроена на този сървър – дори при включен ключ няма да
            тръгне нищо.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <h3 className={subheading}>Изпрати ми пробно писмо</h3>
        <p className="text-muted-foreground">
          {emailConfigured
            ? "Писмото отива само на твоя адрес, с примерни данни. Работи и при изключен ключ."
            : "Пощата не е настроена (липсват SMTP_HOST / EMAIL_FROM), затова пробните писма са изключени. Вида им можеш да видиш с „Преглед“."}
        </p>
        <ul className="flex flex-col">
          {SAMPLE_TEMPLATES.map((template) => (
            <li
              key={template}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line py-3 first:border-0 first:pt-0"
            >
              <span className="font-bold">{SAMPLE_LABELS[template]}</span>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/admin/email-preview?template=${template}`}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Преглед на „${SAMPLE_LABELS[template]}“`}
                  className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-link hover:text-link-hover"
                >
                  Преглед
                </a>
                <form action={testAction}>
                  <input type="hidden" name="template" value={template} />
                  <SubmitButton
                    variant="outline"
                    pendingText="Изпращане…"
                    {...(emailConfigured ? {} : { disabled: true })}
                    aria-label={`Изпрати ми пробно писмо „${SAMPLE_LABELS[template]}“`}
                  >
                    Изпрати ми
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <FormMessage kind="error">{testState.error}</FormMessage>
        <FormMessage kind="success">{testState.success}</FormMessage>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <h3 className={subheading}>Какво би се изпратило сега</h3>
        <p className="text-muted-foreground">
          Същите правила като дневната задача, но нищо не се изпраща и нищо не
          се записва. Адресите са скрити.
        </p>
        <form action={dryRunAction} className="flex flex-col gap-3">
          <div className="w-72 max-w-full">
            <Field
              label="Към друг момент (по избор)"
              hint="Българско време. Празно = сега."
              id="reminders-at"
              name="at"
              type="datetime-local"
              defaultValue={dryRun.values?.at ?? ""}
            />
          </div>
          <SubmitButton
            variant="outline"
            className="self-start"
            pendingText="Проверка…"
          >
            Провери
          </SubmitButton>
          <FormMessage kind="error">{dryRun.error}</FormMessage>
        </form>
        {dryRun.result ? (
          <div
            role="status"
            aria-label="Резултат от пробата"
            className="flex flex-col gap-4"
          >
            <p>
              Прегледани {dryRun.result.considered} · ще получат писмо{" "}
              <strong>
                {dryRun.result.counts.weekly +
                  dryRun.result.counts.review_due +
                  dryRun.result.counts.continue}
              </strong>{" "}
              (седмичен отчет: {dryRun.result.counts.weekly}, повторение:{" "}
              {dryRun.result.counts.review_due}, продължи:{" "}
              {dryRun.result.counts.continue})
            </p>
            {dryRun.result.recipients.length > 0 ? (
              <Rows rows={dryRun.result.recipients} />
            ) : (
              <p className="text-muted-foreground">
                Никой не би получил писмо в този момент.
              </p>
            )}
            {dryRun.result.skipped.length > 0 ? (
              <details>
                <summary className="inline-flex min-h-11 cursor-pointer items-center font-bold text-link">
                  Без писмо ({dryRun.result.skipped.length}) – защо
                </summary>
                <div className="pt-3">
                  <Rows rows={dryRun.result.skipped} />
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
