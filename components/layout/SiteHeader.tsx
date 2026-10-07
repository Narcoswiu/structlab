import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { navLinks } from "@/lib/site";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-[22px]">
      <Logo />
      {/* На телефон менюто минава на втори ред (без JavaScript). */}
      <nav
        aria-label="Основна навигация"
        className="order-last flex w-full flex-wrap gap-x-7 text-[15px] font-semibold lg:order-none lg:w-auto"
      >
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex min-h-11 items-center text-muted-foreground no-underline hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="flex gap-2.5">
        <Link href="/login" className={buttonClass({ variant: "ghost" })}>
          Вход
        </Link>
        <Link href="/demo" className={buttonClass({ className: "px-5" })}>
          Пробвай демото
        </Link>
      </div>
    </header>
  );
}
