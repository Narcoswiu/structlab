import { cn } from "@/lib/utils";

type ActionCardProps = {
  /** името на областта за екранни четци; показва се и като надпис над заглавието */
  label: string;
  tone: "blue" | "success" | "warm";
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** бутонът или връзката за действие */
  action?: React.ReactNode;
  /** основната карта на екрана – само една наведнъж */
  primary?: boolean;
  /** картата е на цял ред: от таблет нагоре действието стои вдясно */
  wide?: boolean;
  /** допълнително съдържание под описанието, напр. лента за прогрес */
  children?: React.ReactNode;
  className?: string;
};

const kickerTone = {
  blue: "text-link",
  success: "text-success",
  warm: "text-warm",
} as const;

/**
 * Карта „какво следва“ на таблото: иконка, надпис, заглавие, едно изречение и
 * едно действие. Трите карти (четене, повторение, задания) са с един строеж.
 */
export function ActionCard({
  label,
  tone,
  icon,
  title,
  description,
  action,
  primary = false,
  wide = primary,
  children,
  className,
}: ActionCardProps) {
  return (
    <section
      aria-label={label}
      className={cn(
        "sl-card flex min-w-0 flex-col gap-4",
        primary ? "sl-card-primary" : "sl-card-strong",
        wide && "sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-4">
        <span
          aria-hidden="true"
          className="sl-chip-icon"
          data-tone={tone === "blue" ? undefined : tone}
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={cn("sl-kicker", kickerTone[tone])}>{label}</span>
          <span
            className={cn(
              "leading-snug font-extrabold text-balance",
              primary ? "text-xl sm:text-2xl" : "text-xl",
            )}
          >
            {title}
          </span>
          {description ? (
            <span className="text-sm leading-normal text-dim">
              {description}
            </span>
          ) : null}
          {children}
        </div>
      </div>
      {action ? (
        <div
          className={cn(
            "flex flex-none",
            // на телефон бутонът е под текста и е подравнен с него
            wide ? "pl-14 sm:pl-0" : "mt-auto pl-14",
          )}
        >
          {action}
        </div>
      ) : null}
    </section>
  );
}
