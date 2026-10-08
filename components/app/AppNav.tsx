"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  /** други адреси, които принадлежат към същия раздел (напр. /learn → Табло) */
  also?: string[];
};

function isActive(pathname: string, item: NavItem): boolean {
  return [item.href, ...(item.also ?? [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Връзките в горната лента. Текущият раздел е отбелязан с aria-current и с
 * черта отдолу. На телефон връзките са на един ред, който се плъзга настрани.
 */
export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // На телефон текущият раздел може да е извън екрана – показваме го.
  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector('[aria-current="page"]');
    if (!nav || !current) return;
    const item = current.getBoundingClientRect();
    const box = nav.getBoundingClientRect();
    if (item.left < box.left || item.right > box.right - 28) {
      nav.scrollLeft += item.left - box.left - 12;
    }
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      aria-label="Навигация"
      className="sl-nav-scroll order-last -mx-5 flex w-[calc(100%+2.5rem)] gap-x-1 overflow-x-auto pr-7 pl-3 [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] sm:-mx-8 sm:w-[calc(100%+4rem)] sm:pl-6 md:order-none md:mx-0 md:w-auto md:flex-1 md:flex-wrap md:overflow-visible md:px-0 md:[mask-image:none]"
    >
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex min-h-11 flex-none items-center rounded-[10px] px-2.5 text-[15px] font-semibold whitespace-nowrap no-underline transition-colors -outline-offset-2",
              "after:absolute after:inset-x-2.5 after:bottom-1 after:h-0.5 after:rounded-full",
              active
                ? "font-bold text-foreground after:bg-primary"
                : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
