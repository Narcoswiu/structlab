"use client";

import { useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";

type PageIntroProps = {
  /** уникално име на екрана, напр. "dashboard" */
  id: string;
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  /** дали потребителят вече го е скрил (идва от user_settings в базата) */
  dismissed: boolean;
  /** записва избора в базата */
  onDismiss: (id: string) => Promise<void>;
};

export function PageIntro({
  id,
  title,
  children,
  icon,
  dismissed,
  onDismiss,
}: PageIntroProps) {
  const reduceMotion = useReducedMotion();
  const [hidden, setHidden] = useState(dismissed);
  const [, startTransition] = useTransition();

  if (hidden) return null;

  function handleDismiss() {
    // Скриваме веднага; записът в базата върви на заден план.
    setHidden(true);
    startTransition(() => onDismiss(id));
  }

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
        <Button onClick={handleDismiss}>Разбрах</Button>
      </div>
    </motion.section>
  );
}
