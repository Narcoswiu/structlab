"use client";

import { useFormStatus } from "react-dom";
import { setReminders } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

function Switch({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={enabled}
      aria-labelledby="reminders-title"
      disabled={pending}
      className="inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] pr-2 font-bold disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-block h-7 w-12 flex-none rounded-full border transition-colors",
          enabled
            ? "border-transparent bg-primary"
            : "border-line-strong bg-surface-2",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 size-5 -translate-y-1/2 rounded-full transition-[left]",
            enabled
              ? "left-[24px] bg-primary-foreground"
              : "left-[3px] bg-muted-foreground",
          )}
        />
      </span>
      <span>{enabled ? "Включени" : "Изключени"}</span>
    </button>
  );
}

/** Ключът „Напомняния по имейл“ в профила: едно натискане го обръща. */
export function ReminderToggle({ enabled }: { enabled: boolean }) {
  return (
    <form action={setReminders}>
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <Switch enabled={enabled} />
    </form>
  );
}
