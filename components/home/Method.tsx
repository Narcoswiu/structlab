import { TiltCard } from "@/components/three-d/TiltCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./SectionHeading";

const steps = [
  {
    title: "Загадка",
    text: "Опит от живота: линийка, гъба, спагети.",
    warm: false,
  },
  { title: "Виж и разбери", text: "Рисунка, после формула.", warm: false },
  { title: "Решен пример", text: "Стъпка по стъпка, с „Защо?“.", warm: true },
  { title: "Провери се", text: "Тест и повторение след дни.", warm: true },
];

export function Method() {
  return (
    <section className="flex flex-col gap-10 pt-16 lg:pt-[104px]">
      <SectionHeading
        eyebrow="МЕТОД"
        title="Всяка тема минава през 4 стъпки"
        className="max-w-[640px]"
      />
      <div className="flex flex-wrap gap-4">
        {steps.map((step, index) => (
          <TiltCard
            key={step.title}
            className={cn(
              "flex-[1_1_240px] gap-2.5 border-0 border-t-[3px] p-6",
              step.warm ? "border-warm" : "border-primary",
            )}
          >
            <span
              className={cn(
                "font-mono text-sm",
                step.warm ? "text-warm" : "text-primary",
              )}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="text-[19px] font-extrabold">{step.title}</h3>
            <p className="leading-[1.6] text-muted-foreground">{step.text}</p>
          </TiltCard>
        ))}
      </div>
      <div className="flex flex-wrap overflow-hidden rounded-[18px] border border-line text-ink">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5 bg-paper p-6 sm:p-8">
          <Badge variant="easy">ЛЕКО</Badge>
          <p className="text-lg leading-[1.7]">
            Огъни гъба за миене като усмивка. Горе тя се свива, долу се разтяга,
            а по средата има слой, който не се променя – неутралната ос.
          </p>
        </div>
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5 bg-paper-2 p-6 sm:p-8">
          <Badge variant="detailed">ПОДРОБНО</Badge>
          <p className="text-lg leading-[1.7]">
            По хипотезата на Бернули ε = y/ρ. По закона на Хук σ = E·y/ρ, а от
            равновесието E·I/ρ = M следва σ = M·y/I.
          </p>
        </div>
      </div>
    </section>
  );
}
