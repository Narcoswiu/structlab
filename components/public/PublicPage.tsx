import { Container } from "@/components/layout/Container";
import { SiteHeader } from "@/components/layout/SiteHeader";

/** Обща рамка на публичните страници: хедър + съдържание. */
export function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <Container>
      <SiteHeader />
      <div className="flex flex-col gap-8 py-8 lg:py-12">{children}</div>
    </Container>
  );
}

export function PublicHeading({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex max-w-[680px] flex-col gap-3">
      <h1 className="font-display text-[clamp(26px,6vw,42px)] leading-[1.1] font-bold">
        {title}
      </h1>
      {children ? (
        <p className="text-[17px] leading-[1.65] text-muted-foreground">
          {children}
        </p>
      ) : null}
    </header>
  );
}
