import { Logo } from "@/components/layout/Logo";
import { AppNav, type NavItem } from "@/components/app/AppNav";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/lib/auth";

const navItems: NavItem[] = [
  // главите на учебника се отварят от таблото
  { href: "/dashboard", label: "Табло", also: ["/learn"] },
  { href: "/review", label: "Повторение" },
  { href: "/tasks", label: "Задания" },
  { href: "/labs", label: "Лаборатории" },
  { href: "/account", label: "Профил" },
];

export function AppHeader({ user }: { user: CurrentUser }) {
  const items =
    user.role === "admin"
      ? [...navItems, { href: "/admin", label: "Админ" }]
      : navItems;
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-3 pb-1 md:py-[18px]">
      <Logo />
      <AppNav items={items} />
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
