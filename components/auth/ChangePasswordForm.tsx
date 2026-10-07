"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/(app)/actions";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { emptyFormState } from "@/lib/form-state";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, emptyFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex max-w-[440px] flex-col gap-4">
      <Field
        label="Нова парола"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        required
        hint="Поне 10 знака."
        error={errors.password}
      />
      <Field
        label="Повтори паролата"
        name="passwordAgain"
        type="password"
        autoComplete="new-password"
        required
        error={errors.passwordAgain}
      />
      <FormMessage kind="error">{state.error}</FormMessage>
      <FormMessage kind="success">{state.success}</FormMessage>
      <SubmitButton className="self-start">Запази паролата</SubmitButton>
    </form>
  );
}
