"use client";

import { useActionState } from "react";
import { sendContactMessage } from "@/app/(marketing)/contact/actions";
import {
  Field,
  FormMessage,
  SubmitButton,
  inputClass,
} from "@/components/ui/form";
import { emptyFormState } from "@/lib/form-state";

export function ContactForm() {
  const [state, action] = useActionState(sendContactMessage, emptyFormState);
  const errors = state.fieldErrors ?? {};

  if (state.success) {
    return <FormMessage kind="success">{state.success}</FormMessage>;
  }

  return (
    <form action={action} className="flex max-w-[520px] flex-col gap-4">
      <Field
        label="Име"
        name="name"
        autoComplete="name"
        required
        maxLength={120}
        defaultValue={state.values?.name ?? ""}
        error={errors.name}
      />
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
          htmlFor="message"
          className="text-sm font-bold text-muted-foreground"
        >
          Съобщение
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          maxLength={4000}
          defaultValue={state.values?.message ?? ""}
          aria-invalid={errors.message ? true : undefined}
          className={`${inputClass} py-3`}
        />
        {errors.message ? (
          <p className="text-sm text-destructive">{errors.message}</p>
        ) : null}
      </div>
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] size-px overflow-hidden"
      >
        <label>
          Не попълвай това поле
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <FormMessage kind="error">{state.error}</FormMessage>
      <SubmitButton className="self-start" pendingText="Изпращане…">
        Изпрати
      </SubmitButton>
    </form>
  );
}
