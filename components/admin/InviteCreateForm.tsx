"use client";

import { useActionState } from "react";
import { createInvites, type InviteFormState } from "@/app/admin/actions";
import {
  Field,
  FormMessage,
  SubmitButton,
  inputClass,
} from "@/components/ui/form";
import { describePlanDuration } from "@/lib/invites";
import { InviteResults } from "./InviteResults";

type InviteCreateFormProps = {
  plans: {
    id: string;
    name: string;
    duration_days: number;
    is_lifetime: boolean;
  }[];
  emailConfigured: boolean;
};

const initialState: InviteFormState = {};

export function InviteCreateForm({
  plans,
  emailConfigured,
}: InviteCreateFormProps) {
  const [state, action] = useActionState(createInvites, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="emails"
          className="text-sm font-bold text-muted-foreground"
        >
          Имейли
        </label>
        <textarea
          id="emails"
          name="emails"
          required
          rows={3}
          placeholder="по един на ред"
          defaultValue={state.values?.emails ?? ""}
          className={`${inputClass} py-3 font-mono text-sm`}
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="min-w-0 flex-[1_1_240px]">
          <Field
            label="Име (по избор)"
            name="fullName"
            defaultValue={state.values?.fullName ?? ""}
            hint="Ползва се в поздрава, ако поканата е една."
          />
        </div>
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
          <label
            htmlFor="planId"
            className="text-sm font-bold text-muted-foreground"
          >
            План
          </label>
          <select id="planId" name="planId" required className={inputClass}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} · {describePlanDuration(plan)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="sendNow"
          disabled={!emailConfigured}
          className="size-5 flex-none accent-(--sl-blue)"
        />
        <span>
          Изпрати имейла с поканата веднага
          {emailConfigured ? "" : " (пощата още не е настроена)"}
        </span>
      </label>
      <FormMessage kind="error">{state.error}</FormMessage>
      <SubmitButton className="self-start" pendingText="Създаване…">
        Създай покани
      </SubmitButton>
      <InviteResults results={state.results} />
    </form>
  );
}
