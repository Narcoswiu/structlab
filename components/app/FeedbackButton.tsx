"use client";

import { useActionState, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquarePlus, X } from "lucide-react";
import { sendFeedback } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { FormMessage, SubmitButton, inputClass } from "@/components/ui/form";
import { emptyFormState } from "@/lib/form-state";

/** Бутон „Обратна връзка“ – стои на всяка вътрешна страница по време на бетата. */
export function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(sendFeedback, emptyFormState);

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3">
      {open ? (
        <div
          role="dialog"
          aria-label="Обратна връзка"
          className="flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3 rounded-2xl border border-line-strong bg-surface p-5 shadow-[0_24px_48px_-20px_rgba(0,0,0,0.7)]"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold">Обратна връзка</h2>
            <Button
              variant="ghost"
              aria-label="Затвори"
              className="px-2.5"
              onClick={() => setOpen(false)}
            >
              <X aria-hidden="true" className="size-5" />
            </Button>
          </div>
          {state.success ? (
            <FormMessage kind="success">{state.success}</FormMessage>
          ) : (
            <form action={action} className="flex flex-col gap-3">
              <input type="hidden" name="page" value={pathname} />
              <label
                htmlFor="feedback-message"
                className="text-sm leading-normal text-muted-foreground"
              >
                Какво не е ясно, какво липсва или какво ти хареса?
              </label>
              <textarea
                id="feedback-message"
                name="message"
                required
                rows={4}
                maxLength={4000}
                className={`${inputClass} py-3`}
              />
              <FormMessage kind="error">{state.error}</FormMessage>
              <SubmitButton pendingText="Изпращане…">Изпрати</SubmitButton>
            </form>
          )}
        </div>
      ) : null}
      <Button
        variant="outline"
        aria-expanded={open}
        aria-label="Обратна връзка"
        className="px-3 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.7)] sm:px-[18px]"
        onClick={() => setOpen((value) => !value)}
      >
        <MessageSquarePlus aria-hidden="true" className="size-[18px]" />
        <span className="hidden sm:inline">Обратна връзка</span>
      </Button>
    </div>
  );
}
