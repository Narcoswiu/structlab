import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Logo } from "@/components/layout/Logo";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Container className="flex flex-1 flex-col">
      <div className="py-[22px]">
        <Logo />
      </div>
      <main className="flex flex-1 flex-col items-start justify-center gap-5 py-16">
        <span className="font-mono text-sm text-warm">404</span>
        <h1 className="font-display text-[clamp(26px,6vw,44px)] leading-[1.1] font-bold">
          Няма такава страница
        </h1>
        <p className="max-w-[520px] text-[17px] leading-[1.65] text-muted-foreground">
          Адресът е грешен или страницата е преместена.
        </p>
        <Link href="/" className={buttonClass()}>
          Към началото
        </Link>
      </main>
    </Container>
  );
}
