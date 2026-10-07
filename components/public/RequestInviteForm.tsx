"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { requestInvite } from "@/app/(marketing)/request-invite/actions";
import {
  Field,
  FormMessage,
  SubmitButton,
  inputClass,
} from "@/components/ui/form";
import { emptyFormState } from "@/lib/form-state";

type Option = { university: string; specialty: string; label: string };

const OTHER = "other";
const years = ["I", "II", "III", "IV", "V", "VI"];

export function RequestInviteForm({ options }: { options: Option[] }) {
  const [state, action] = useActionState(requestInvite, emptyFormState);
  const [choice, setChoice] = useState("");
  const errors = state.fieldErrors ?? {};
  const universities = [...new Set(options.map((option) => option.university))];
  const selected = options[Number(choice)];

  if (state.success) {
    return <FormMessage kind="success">{state.success}</FormMessage>;
  }

  return (
    <form action={action} className="flex max-w-[520px] flex-col gap-4">
      <Field
        label="Имейл"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email ?? ""}
        error={errors.email}
      />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="specialtyChoice"
          className="text-sm font-bold text-muted-foreground"
        >
          Университет и специалност
        </label>
        <select
          id="specialtyChoice"
          required
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Избери…
          </option>
          {universities.map((university) => (
            <optgroup key={university} label={university}>
              {options.map((option, index) =>
                option.university === university ? (
                  <option key={option.label} value={index}>
                    {option.label}
                  </option>
                ) : null,
              )}
            </optgroup>
          ))}
          <option value={OTHER}>Друга – ще я напиша</option>
        </select>
      </div>
      {choice === OTHER ? (
        <>
          <Field
            label="Университет"
            name="university"
            required
            maxLength={160}
            defaultValue={state.values?.university ?? ""}
            error={errors.university}
          />
          <Field
            label="Специалност"
            name="specialty"
            required
            maxLength={160}
            defaultValue={state.values?.specialty ?? ""}
            error={errors.specialty}
          />
        </>
      ) : (
        <>
          <input
            type="hidden"
            name="university"
            value={selected?.university ?? ""}
          />
          <input
            type="hidden"
            name="specialty"
            value={selected?.specialty ?? ""}
          />
        </>
      )}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="year"
          className="text-sm font-bold text-muted-foreground"
        >
          Курс
        </label>
        <select
          id="year"
          name="year"
          required
          defaultValue={state.values?.year ?? ""}
          className={inputClass}
        >
          <option value="" disabled>
            Избери…
          </option>
          {years.map((name, index) => (
            <option key={name} value={index + 1}>
              {name} курс
            </option>
          ))}
        </select>
        {errors.year ? (
          <p className="text-sm text-destructive">{errors.year}</p>
        ) : null}
      </div>
      {/* Скрито поле за роботи: хората не го виждат и не го попълват. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] size-px overflow-hidden"
      >
        <label>
          Не попълвай това поле
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="flex min-h-11 items-start gap-3 text-sm leading-[1.5] text-muted-foreground">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 size-5 flex-none accent-(--sl-blue)"
        />
        <span>
          Съгласен съм данните ми да се пазят, за да получа покана, както е
          описано в{" "}
          <Link href="/privacy" target="_blank" className="font-bold text-link">
            Политиката за поверителност
          </Link>
          .
        </span>
      </label>
      {errors.consent ? (
        <FormMessage kind="error">{errors.consent}</FormMessage>
      ) : null}
      <FormMessage kind="error">{state.error}</FormMessage>
      <SubmitButton className="self-start" pendingText="Изпращане…">
        Поискай покана
      </SubmitButton>
    </form>
  );
}
