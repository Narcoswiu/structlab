"use client";

import { useActionState } from "react";
import {
  renewInvite,
  revokeInvite,
  type InviteFormState,
} from "@/app/admin/actions";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { InviteResults } from "./InviteResults";

type InviteRowActionsProps = {
  inviteId: string;
  canRevoke: boolean;
  emailConfigured: boolean;
};

const initialState: InviteFormState = {};

export function InviteRowActions({
  inviteId,
  canRevoke,
  emailConfigured,
}: InviteRowActionsProps) {
  const [state, renew] = useActionState(renewInvite, initialState);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <form action={renew}>
          <input type="hidden" name="inviteId" value={inviteId} />
          <SubmitButton variant="outline">Нов линк</SubmitButton>
        </form>
        {emailConfigured ? (
          <form action={renew}>
            <input type="hidden" name="inviteId" value={inviteId} />
            <input type="hidden" name="sendNow" value="on" />
            <SubmitButton variant="outline" pendingText="Изпращане…">
              Изпрати имейл
            </SubmitButton>
          </form>
        ) : null}
        {canRevoke ? (
          <form action={revokeInvite}>
            <input type="hidden" name="inviteId" value={inviteId} />
            <SubmitButton variant="ghost">Отмени</SubmitButton>
          </form>
        ) : null}
      </div>
      <FormMessage kind="error">{state.error}</FormMessage>
      <InviteResults results={state.results} />
    </div>
  );
}
