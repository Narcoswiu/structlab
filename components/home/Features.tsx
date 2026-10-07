import {
  BookOpen,
  ChartColumn,
  ClipboardList,
  FlaskConical,
  MessageCircle,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { TiltCard } from "@/components/three-d/TiltCard";
import { SectionHeading } from "./SectionHeading";

type Feature = {
  icon: LucideIcon;
  tone: "blue" | "warm";
  title: string;
  text: string;
};

const features: Feature[] = [
  {
    icon: BookOpen,
    tone: "blue",
    title: "Учебници в два режима",
    text: "„Леко“ – с примери от живота. „Подробно“ – с изводи и граници на валидност. Превключваш на всяка глава.",
  },
  {
    icon: FlaskConical,
    tone: "blue",
    title: "Интерактивни лаборатории",
    text: "Греди, сечения, кръг на Мор. Местиш товара – диаграмите се преначертават веднага.",
  },
  {
    icon: MessageCircle,
    tone: "blue",
    title: "AI асистент по учебника",
    text: "Обяснява по-просто, води с въпроси и проверява снимка на ръкописното ти решение.",
  },
  {
    icon: ClipboardList,
    tone: "warm",
    title: "Лични задания",
    text: "Вариантът се смята от факултетния номер, а отговорите се проверяват стъпка по стъпка.",
  },
  {
    icon: RefreshCw,
    tone: "warm",
    title: "Повторение през интервали",
    text: "Въпросите се връщат точно когато започваш да ги забравяш – 5 минути на ден.",
  },
  {
    icon: ChartColumn,
    tone: "warm",
    title: "Ясен напредък",
    text: "Виждаш докъде си стигнал по всеки модул и какво трябва да минеш преди следващия.",
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="flex scroll-mt-6 flex-col gap-10 pt-16 lg:pt-[104px]"
    >
      <SectionHeading
        eyebrow="ВЪЗМОЖНОСТИ"
        title="Всичко за един модул – на едно място"
        className="max-w-[640px]"
      />
      <div className="flex flex-wrap gap-4">
        {features.map(({ icon: Icon, tone, title, text }) => (
          <TiltCard key={title} className="flex-[1_1_340px] gap-3.5 p-7">
            <span className="inline-flex size-11 items-center justify-center rounded-xl bg-surface-2">
              <Icon
                aria-hidden="true"
                className={
                  tone === "blue"
                    ? "size-[22px] text-primary"
                    : "size-[22px] text-warm"
                }
              />
            </span>
            <h3 className="text-xl font-extrabold">{title}</h3>
            <p className="leading-[1.6] text-muted-foreground">{text}</p>
          </TiltCard>
        ))}
      </div>
    </section>
  );
}
