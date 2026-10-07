"use client";

import { useActionState } from "react";
import { updatePlanDuration } from "@/app/admin/actions";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { emptyFormState } from "@/lib/form-state";

export function PlanDurationForm({
  plan,
}: {
  plan: { id: string; name: string; duration_days: number };
}) {
  const [state, action] = useActionState(updatePlanDuration, emptyFormState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="planId" value={plan.id} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64 max-w-full">
          <Field
            label={`„${plan.name}“ – дни`}
            id={`days-${plan.id}`}
            name="durationDays"
            type="number"
            inputMode="numeric"
            min={1}
            max={3660}
            defaultValue={plan.duration_days}
            required
          />
        </div>
        <SubmitButton variant="outline">Запази</SubmitButton>
      </div>
      <FormMessage kind="error">{state.error}</FormMessage>
      <FormMessage kind="success">{state.success}</FormMessage>
    </form>
  );
}
