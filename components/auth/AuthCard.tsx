import { Container } from "@/components/layout/Container";
import { Logo } from "@/components/layout/Logo";

type AuthCardProps = {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
};

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <Container className="flex flex-col items-center pb-16">
      <div className="self-start py-[22px]">
        <Logo />
      </div>
      <div className="mt-6 flex w-full max-w-[440px] flex-col gap-6 rounded-[20px] border border-line bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[26px] leading-[1.15] font-bold">
            {title}
          </h1>
          {subtitle ? (
            <p className="leading-[1.6] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {children}
      </div>
    </Container>
  );
}
