"use client";

import { useActionState } from "react";
import { requestLoginLink } from "@/app/(marketing)/login/actions";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { emptyFormState } from "@/lib/form-state";

export function LoginLinkForm() {
  const [state, action] = useActionState(requestLoginLink, emptyFormState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        label="Имейл"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />
      <FormMessage kind="error">{state.error}</FormMessage>
      <FormMessage kind="success">{state.success}</FormMessage>
      <SubmitButton name="kind" value="recovery" size="block">
        Изпрати линк за нова парола
      </SubmitButton>
      <SubmitButton
        name="kind"
        value="magiclink"
        size="block"
        variant="outline"
      >
        Изпрати линк за вход без парола
      </SubmitButton>
    </form>
  );
}
