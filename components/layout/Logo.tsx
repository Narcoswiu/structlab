import Link from "next/link";
import { siteName } from "@/lib/site";

export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      stroke="var(--sl-blue)"
      strokeWidth="3"
      aria-hidden="true"
    >
      <path d="M6 7h24M6 29h24M18 7v22" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link
      href="/"
      className="flex min-h-11 items-center gap-2.5 text-foreground no-underline"
    >
      <span className="inline-flex size-[38px] items-center justify-center rounded-[10px] border border-line-strong bg-surface-2">
        <LogoMark />
      </span>
      <span className="font-display text-[19px] font-bold">{siteName}</span>
    </Link>
  );
}
