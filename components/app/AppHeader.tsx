import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/lib/auth";

const navLinkClass =
  "inline-flex min-h-11 items-center text-[15px] font-semibold text-muted-foreground no-underline hover:text-foreground";

export function AppHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-[18px]">
      <Logo />
      <nav
        aria-label="Навигация"
        className="order-last flex w-full flex-wrap gap-x-7 md:order-none md:w-auto md:flex-1"
      >
        <Link href="/dashboard" className={navLinkClass}>
          Табло
        </Link>
        <Link href="/account" className={navLinkClass}>
          Профил
        </Link>
        {user.role === "admin" ? (
          <Link href="/admin" className={navLinkClass}>
            Админ
          </Link>
        ) : null}
      </nav>
      <form
        action="/auth/signout"
        method="post"
        className="flex items-center gap-3"
      >
        <span className="hidden max-w-[220px] truncate text-sm text-dim sm:inline">
          {user.email}
        </span>
        <Button type="submit" variant="outline">
          Изход
        </Button>
      </form>
    </header>
  );
}
