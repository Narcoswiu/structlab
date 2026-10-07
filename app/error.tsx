"use client";

import { Container } from "@/components/layout/Container";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";

// Показва се, когато страница се счупи по време на работа. Техническата
// грешка остава в сървърните логове, не пред потребителя.
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <Container className="flex flex-1 flex-col">
      <div className="py-[22px]">
        <Logo />
      </div>
      <main className="flex flex-1 flex-col items-start justify-center gap-5 py-16">
        <h1 className="font-display text-[clamp(26px,6vw,44px)] leading-[1.1] font-bold">
          Нещо се обърка
        </h1>
        <p className="max-w-[520px] text-[17px] leading-[1.65] text-muted-foreground">
          Страницата не можа да се зареди. Опитай пак; ако се повтори, пиши ни
          през бутона „Обратна връзка“.
        </p>
        <Button onClick={reset}>Опитай пак</Button>
      </main>
    </Container>
  );
}
