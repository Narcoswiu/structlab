"use client";

import { useActionState } from "react";
import { setFacultyNumber } from "@/app/(app)/tasks/actions";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { emptyFormState } from "@/lib/form-state";

/**
 * Номерът се изпраща веднъж до сървъра, който взема от него последните три
 * цифри и не пази нищо друго. Полето се изчиства след изпращане.
 */
export function FacultyNumberForm({ submitLabel }: { submitLabel: string }) {
  const [state, action] = useActionState(setFacultyNumber, emptyFormState);
  return (
    <form action={action} className="flex max-w-[360px] flex-col gap-3">
      <Field
        label="Факултетен номер"
        name="facultyNumber"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={20}
        required
        error={state.fieldErrors?.facultyNumber}
        hint="Не го записваме. Пазим само последните три цифри."
        className="font-mono"
      />
      <FormMessage kind="error">{state.error}</FormMessage>
      <FormMessage kind="success">{state.success}</FormMessage>
      <div>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
