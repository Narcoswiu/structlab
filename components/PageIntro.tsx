"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Button, buttonClass } from "@/components/ui/button";

const STORAGE_PREFIX = "structlab:intro-dismissed:";
const CHANGE_EVENT = "structlab:intro-change";

// До Етап 4 няма потребители, затова „Разбрах“ се помни в браузъра.
// После се мести в user_settings.intro_dismissed.
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function isDismissed(id: string): boolean {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + id) === "1";
  } catch {
    return false;
  }
}

function dismiss(id: string) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, "1");
  } catch {
    // частен режим на браузъра: карето се скрива само до презареждане
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

type PageIntroProps = {
  /** уникално име на екрана, напр. "dashboard" */
  id: string;
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
};

export function PageIntro({ id, title, children, icon }: PageIntroProps) {
  const reduceMotion = useReducedMotion();
  // На сървъра не знаем избора на потребителя, затова там карето е скрито
  // и се появява чак в браузъра – така няма „премигване“.
  const hidden = useSyncExternalStore(
    subscribe,
    () => isDismissed(id),
    () => true,
  );

  if (hidden) return null;

  return (
    <motion.section
      aria-label="Въведение към страницата"
      initial={reduceMotion ? false : { opacity: 0, rotateX: -14, y: -10 }}
      animate={{ opacity: 1, rotateX: 0, y: 0 }}
      transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
      style={{ transformPerspective: 900, transformOrigin: "top center" }}
      className="flex flex-wrap items-center gap-5 rounded-2xl border border-intro-line bg-surface-hi px-6 py-[22px]"
    >
      {icon ? (
        <span className="inline-flex size-[52px] flex-none items-center justify-center rounded-[14px] bg-intro-icon text-link">
          {icon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1.5">
        <span className="text-xs font-extrabold tracking-[1.2px] text-link">
          КАКВО Е ТАЗИ СТРАНИЦА
        </span>
        <span className="text-lg font-extrabold">{title}</span>
        <span className="text-[15px] leading-[1.6] text-muted-foreground">
          {children}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/welcome"
          className={buttonClass({
            variant: "outline",
            className: "border-intro-line bg-transparent px-4",
          })}
        >
          Пълна обиколка
        </Link>
        <Button onClick={() => dismiss(id)}>Разбрах</Button>
      </div>
    </motion.section>
  );
}
