"use client";

import { useActionState } from "react";
import { chooseSpecialty } from "@/app/(app)/actions";
import { FormMessage, SubmitButton, inputClass } from "@/components/ui/form";
import type { SpecialtyOption } from "@/lib/catalog";
import { emptyFormState } from "@/lib/form-state";

type SpecialtyPickerProps = {
  specialties: SpecialtyOption[];
  currentId: string | null;
};

/** Избор на специалност, групиран по университет. */
export function SpecialtyPicker({
  specialties,
  currentId,
}: SpecialtyPickerProps) {
  const [state, action] = useActionState(chooseSpecialty, emptyFormState);
  const universities = [...new Set(specialties.map((s) => s.university.name))];

  return (
    <form action={action} className="flex max-w-[560px] flex-col gap-3">
      <label
        htmlFor="specialtyId"
        className="text-sm font-bold text-muted-foreground"
      >
        Университет и специалност
      </label>
      <select
        id="specialtyId"
        name="specialtyId"
        required
        defaultValue={currentId ?? ""}
        className={inputClass}
      >
        <option value="" disabled>
          Избери…
        </option>
        {universities.map((university) => (
          <optgroup key={university} label={university}>
            {specialties
              .filter((s) => s.university.name === university)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shortName} – {s.name} ({s.degree})
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <FormMessage kind="error">{state.error}</FormMessage>
      <FormMessage kind="success">{state.success}</FormMessage>
      <SubmitButton className="self-start">Запази специалността</SubmitButton>
    </form>
  );
}
