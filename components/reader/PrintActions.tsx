"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { trackEvent } from "@/components/tracking/trackEvent";

type PrintActionsProps = {
  /** адресът на главата в четеца, за връзката „Обратно“ */
  backHref: string;
  /** ако е подадено, натискането на бутона се записва като събитие */
  track?: { module: string; chapter: string };
};

/** Бутоните над версията за печат. На хартията не се виждат. */
export function PrintActions({ backHref, track }: PrintActionsProps) {
  function print() {
    if (track) trackEvent({ type: "pdf_download", ...track });
    window.print();
  }

  return (
    <div className="print-bar">
      <Link href={backHref} className="reader-back">
        ← Обратно към главата
      </Link>
      <button type="button" onClick={print} className="print-button">
        <Printer aria-hidden="true" className="size-4" />
        Отпечатай / запази като PDF
      </button>
      <p className="print-hint">
        В прозореца за печат избери „Запази като PDF“. Копието е лично – на
        всяка страница стои твоят имейл.
      </p>
    </div>
  );
}
