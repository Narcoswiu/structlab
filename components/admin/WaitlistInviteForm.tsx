"use client";

import { useActionState } from "react";
import { inviteFromWaitlist, type InviteFormState } from "@/app/admin/actions";
import { FormMessage, SubmitButton, inputClass } from "@/components/ui/form";
import { describePlanDuration } from "@/lib/invites";
import { InviteResults } from "./InviteResults";

type WaitlistInviteFormProps = {
  waitlistId: string;
  plans: {
    id: string;
    name: string;
    duration_days: number;
    is_lifetime: boolean;
  }[];
  emailConfigured: boolean;
};

const initialState: InviteFormState = {};

/** „Покани“ за човек от списъка на чакащите – ползва същия поток за покани. */
export function WaitlistInviteForm({
  waitlistId,
  plans,
  emailConfigured,
}: WaitlistInviteFormProps) {
  const [state, action] = useActionState(inviteFromWaitlist, initialState);

  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="waitlistId" value={waitlistId} />
        <label className="flex min-w-0 flex-[1_1_220px] flex-col gap-1">
          <span className="text-xs font-bold text-dim">План</span>
          <select name="planId" required className={inputClass}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} · {describePlanDuration(plan)}
              </option>
            ))}
          </select>
        </label>
        {emailConfigured ? (
          <input type="hidden" name="sendNow" value="on" />
        ) : null}
        <SubmitButton pendingText="Изпращане…">
          {emailConfigured ? "Покани с имейл" : "Покани (линк)"}
        </SubmitButton>
      </form>
      <FormMessage kind="error">{state.error}</FormMessage>
      <InviteResults results={state.results} />
    </div>
  );
}
