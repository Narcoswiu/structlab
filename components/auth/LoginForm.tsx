"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "@/app/(marketing)/login/actions";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { emptyFormState } from "@/lib/form-state";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, emptyFormState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field
        label="Имейл"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        required
      />
      <Field
        label="Парола"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormMessage kind="error">{state.error}</FormMessage>
      <SubmitButton size="block" pendingText="Влизане…">
        Вход
      </SubmitButton>
      <Link
        href="/forgot-password"
        className="inline-flex min-h-11 items-center self-center text-sm font-bold text-link hover:text-link-hover"
      >
        Забравена парола или вход с линк
      </Link>
    </form>
  );
}
