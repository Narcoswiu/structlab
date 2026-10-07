import Link from "next/link";
import { footerLinks, siteName } from "@/lib/site";
import { Container } from "./Container";

export function SiteFooter() {
  return (
    <Container>
      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line-soft pt-4 pb-7 text-sm text-dim">
        <span>© {siteName}</span>
        <div className="flex flex-wrap gap-x-6">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center text-dim hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </footer>
    </Container>
  );
}
