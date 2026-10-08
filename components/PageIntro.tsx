"use client";

import { useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      // На телефон иконката стои до заглавието, а не на свой ред – карето е
      // по-ниско, без да губи съдържание.
      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 rounded-2xl border border-intro-line bg-surface-hi p-4 sm:flex sm:flex-wrap sm:gap-5 sm:px-6 sm:py-[22px]"
    >
      {icon ? (
        <span className="inline-flex size-10 flex-none items-center justify-center rounded-xl bg-intro-icon text-link sm:size-[52px] sm:rounded-[14px]">
          {icon}
        </span>
      ) : null}
      <div className="contents sm:flex sm:min-w-0 sm:flex-[1_1_360px] sm:flex-col sm:gap-1.5">
        <span
          className={cn(
            "flex min-w-0 flex-col gap-0.5 sm:contents",
            !icon && "col-span-2",
          )}
        >
          <span className="sl-kicker text-link">КАКВО Е ТАЗИ СТРАНИЦА</span>
          <span className="text-base leading-snug font-extrabold sm:text-lg">
            {title}
          </span>
        </span>
        <span className="col-span-2 text-sm leading-[1.55] text-muted-foreground sm:text-[15px] sm:leading-[1.6]">
          {children}
        </span>
      </div>
      <div className="col-span-2 flex flex-wrap gap-2">
        <Button onClick={handleDismiss}>Разбрах</Button>
      </div>
    </motion.section>
  );
}
