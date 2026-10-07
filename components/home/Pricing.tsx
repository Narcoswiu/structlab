import Link from "next/link";
import { Check } from "lucide-react";
import { TiltCard } from "@/components/three-d/TiltCard";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { formatQuantity } from "@/lib/format";
import { pricePlans } from "@/lib/site";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./SectionHeading";

export function Pricing() {
  return (
    <section
      id="prices"
      className="flex scroll-mt-6 flex-col gap-10 pt-16 lg:pt-[104px]"
    >
      <SectionHeading eyebrow="ЦЕНИ" title="Прост и честен достъп" centered />
      <div className="flex flex-wrap justify-center gap-4">
        {pricePlans.map((plan) => (
          <TiltCard
            key={plan.name}
            className={cn(
              "max-w-[420px] flex-[1_1_320px] gap-[18px] rounded-[20px] p-6 sm:p-8",
              plan.recommended && "border-primary bg-surface-hi",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-extrabold">{plan.name}</h3>
              {plan.recommended ? <Badge>ПРЕПОРЪЧАН</Badge> : null}
            </div>
            <span className="font-display text-[32px] sm:text-[40px]">
              {plan.priceEur === null
                ? "Скоро"
                : formatQuantity(plan.priceEur, "€")}
            </span>
            <ul className="flex flex-col gap-2.5 text-muted-foreground">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5">
                  <Check
                    aria-hidden="true"
                    className="size-[18px] flex-none text-primary"
                    strokeWidth={2.5}
                  />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              aria-label={`Избери план „${plan.name}“`}
              className={buttonClass({
                variant: plan.recommended ? "default" : "outline",
                size: "block",
                className: cn(
                  "mt-auto font-extrabold",
                  !plan.recommended && "bg-transparent",
                ),
              })}
            >
              Избери
            </Link>
          </TiltCard>
        ))}
      </div>
    </section>
  );
}
