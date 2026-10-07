import { cn } from "@/lib/utils";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-extrabold tracking-[1.5px] text-warm">
      {children}
    </span>
  );
}

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  centered?: boolean;
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  children,
  centered = false,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        centered ? "items-center text-center" : "max-w-[680px]",
        className,
      )}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-[28px] leading-[1.15] font-extrabold tracking-[-0.5px] sm:text-[38px]">
        {title}
      </h2>
      {children ? (
        <p className="text-[17px] leading-[1.6] text-muted-foreground">
          {children}
        </p>
      ) : null}
    </div>
  );
}
