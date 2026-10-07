"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { acceptTrackingNotice } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";

/**
 * Еднократно известие след вход: обяснява какво се записва и защо.
 * Докато не бъде потвърдено, платформата не записва нищо за ученето.
 */
export function TrackingNotice() {
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  if (hidden) return null;

  return (
    <section
      aria-label="Известие за проследяване на ученето"
      className="flex flex-col gap-3 rounded-2xl border border-intro-line bg-surface-hi p-5 sm:p-6"
    >
      <h2 className="text-lg font-extrabold">
        Ново: платформата ще помни докъде си стигнал
      </h2>
      <p className="max-w-[720px] leading-[1.6] text-muted-foreground">
        За да ти показваме прогреса и да те връщаме там, където си спрял, ще
        записваме кои глави и секции отваряш, колко време четеш и кои
        лаборатории ползваш. Не записваме какво пишеш. Данните се пазят до 12
        месеца и ги вижда само администраторът.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await acceptTrackingNotice();
              setHidden(true);
            })
          }
        >
          Разбрах, продължи
        </Button>
        <Link
          href="/privacy"
          target="_blank"
          className="inline-flex min-h-11 items-center text-sm font-bold text-link hover:text-link-hover"
        >
          Прочети Политиката за поверителност
        </Link>
      </div>
    </section>
  );
}
