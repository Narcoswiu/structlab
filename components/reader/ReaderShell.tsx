"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileDown, Minus, Plus } from "lucide-react";
import { saveReaderSettings } from "@/app/(app)/learn/actions";
import { trackEvent } from "@/components/tracking/trackEvent";
import { cn } from "@/lib/utils";

export type ReaderTheme = "light" | "sepia" | "dark";
export type ReaderMode = "easy" | "detailed";

type ReaderShellProps = {
  basePath: string;
  mode: ReaderMode;
  initialTheme: ReaderTheme;
  initialFontSize: number;
  header: React.ReactNode;
  children: React.ReactNode;
  /** ако е подадено, смяната на режима се записва като събитие */
  track?: { module: string; chapter: string };
};

const themes: { id: ReaderTheme; label: string; swatch: string }[] = [
  { id: "light", label: "Светла", swatch: "#F7F8FA" },
  { id: "sepia", label: "Сепия", swatch: "#F1E7D0" },
  { id: "dark", label: "Тъмна", swatch: "#0A0F1C" },
];

const controlButton =
  "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[10px] border border-(--rd-line) px-3 text-sm font-bold disabled:cursor-default disabled:opacity-40";

/** Рамката на четеца: режим Леко/Подробно, тема и размер на шрифта. */
export function ReaderShell({
  basePath,
  mode,
  initialTheme,
  initialFontSize,
  header,
  children,
  track,
}: ReaderShellProps) {
  const router = useRouter();
  const [theme, setTheme] = useState(initialTheme);
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [pending, startTransition] = useTransition();
  const articleRef = useRef<HTMLElement>(null);
  const currentSection = useRef<string>("");
  const progressRef = useRef<HTMLSpanElement>(null);

  // Тънката лента най-горе: каква част от главата е превъртяна.
  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      const article = articleRef.current;
      const bar = progressRef.current;
      if (!article || !bar) return;
      const box = article.getBoundingClientRect();
      const distance = box.height - window.innerHeight;
      const done =
        distance > 0 ? Math.min(1, Math.max(0, -box.top / distance)) : 0;
      bar.style.transform = `scaleX(${done})`;
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [mode, fontSize]);

  // Помним коя секция се чете, за да се върнем на нея след смяна на режима.
  useEffect(() => {
    const headings = articleRef.current?.querySelectorAll("h2[id]");
    if (!headings?.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) currentSection.current = entry.target.id;
        }
      },
      { rootMargin: "0px 0px -60% 0px" },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [mode]);

  function changeTheme(next: ReaderTheme) {
    setTheme(next);
    startTransition(() => saveReaderSettings({ theme: next }));
  }

  function changeFontSize(next: number) {
    setFontSize(next);
    startTransition(() => saveReaderSettings({ font_size: next }));
  }

  function changeMode(next: ReaderMode) {
    if (next === mode) return;
    const hash = currentSection.current ? `#${currentSection.current}` : "";
    if (track) trackEvent({ type: "mode_toggle", ...track, mode: next });
    startTransition(async () => {
      await saveReaderSettings({ reader_mode: next });
      router.push(`${basePath}?mode=${next}${hash}`);
    });
  }

  return (
    <div
      className="reader reader-shell"
      data-theme={theme}
      data-size={fontSize}
    >
      <div aria-hidden="true" className="reader-progress">
        <span ref={progressRef} />
      </div>
      <div className="reader-toolbar">
        <div
          role="group"
          aria-label="Режим на четене"
          className="reader-segment reader-segment-wide"
        >
          {(
            [
              ["easy", "Леко"],
              ["detailed", "Подробно"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              disabled={pending}
              onClick={() => changeMode(id)}
              className={cn(
                controlButton,
                "px-4",
                mode === id && "bg-(--rd-accent) text-(--rd-on-accent)",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Тема" className="reader-segment">
          {themes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Тема: ${item.label}`}
              aria-pressed={theme === item.id}
              onClick={() => changeTheme(item.id)}
              className={cn(
                controlButton,
                "px-0",
                theme === item.id && "!border-(--rd-accent) bg-(--rd-bg)",
              )}
            >
              <span
                aria-hidden="true"
                className="size-5 rounded-full border border-(--rd-muted)"
                style={{ background: item.swatch }}
              />
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-label="Размер на шрифта"
          className="reader-segment"
        >
          <button
            type="button"
            aria-label="По-малък шрифт"
            disabled={fontSize <= 1}
            onClick={() => changeFontSize(fontSize - 1)}
            className={controlButton}
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="По-голям шрифт"
            disabled={fontSize >= 4}
            onClick={() => changeFontSize(fontSize + 1)}
            className={controlButton}
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
        {/* версия за печат на главата в текущия режим */}
        <Link
          href={`${basePath}/print?mode=${mode}`}
          prefetch={false}
          className={cn(controlButton, "gap-2 no-underline")}
        >
          <FileDown aria-hidden="true" className="size-4" />
          Изтегли PDF
        </Link>
      </div>
      <article ref={articleRef} className="reader-article">
        {header}
        <div className="reader-prose">{children}</div>
      </article>
    </div>
  );
}
