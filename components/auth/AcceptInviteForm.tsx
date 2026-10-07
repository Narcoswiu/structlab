"use client";

import { useActionState } from "react";
import Link from "next/link";
import { acceptInvite } from "@/app/(marketing)/invite/[token]/actions";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { emptyFormState } from "@/lib/form-state";

type AcceptInviteFormProps = {
  token: string;
  email: string;
  fullName: string;
};

export function AcceptInviteForm({
  token,
  email,
  fullName,
}: AcceptInviteFormProps) {
  const [state, action] = useActionState(acceptInvite, emptyFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Field
        label="Имейл"
        name="email"
        type="email"
        value={email}
        readOnly
        autoComplete="username"
        hint="С този адрес ще влизаш."
      />
      <Field
        label="Име и фамилия"
        name="fullName"
        defaultValue={state.values?.fullName ?? fullName}
        autoComplete="name"
        required
        error={errors.fullName}
      />
      <Field
        label="Парола"
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
      <label className="flex min-h-11 items-start gap-3 text-sm leading-[1.5] text-muted-foreground">
        <input
          type="checkbox"
          name="terms"
          required
          className="mt-0.5 size-5 flex-none accent-(--sl-blue)"
        />
        <span>
          Приемам{" "}
          <Link href="/terms" target="_blank" className="font-bold text-link">
            Общите условия
          </Link>{" "}
          и{" "}
          <Link href="/privacy" target="_blank" className="font-bold text-link">
            Политиката за поверителност
          </Link>
          . Знам, че платформата записва активността ми (отворени уроци, време
          за четене), за да показва напредъка ми.
        </span>
      </label>
      {errors.terms ? (
        <FormMessage kind="error">{errors.terms}</FormMessage>
      ) : null}
      <FormMessage kind="error">{state.error}</FormMessage>
      <SubmitButton size="block" pendingText="Създаване на акаунт…">
        Създай акаунт и влез
      </SubmitButton>
    </form>
  );
}
