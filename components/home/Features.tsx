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
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "./SectionHeading";

type Feature = {
  icon: LucideIcon;
  tone: "blue" | "warm";
  title: string;
  text: string;
  /** налично ли е вече в платформата */
  available: boolean;
};

const features: Feature[] = [
  {
    icon: BookOpen,
    tone: "blue",
    title: "Учебници в два режима",
    text: "„Леко“ – с примери от живота. „Подробно“ – с изводи и граници на валидност. Превключваш на всяка глава.",
    available: true,
  },
  {
    icon: FlaskConical,
    tone: "blue",
    title: "Интерактивни лаборатории",
    text: "Греди и сечения: сменяш числата и резултатът се преизчислява веднага, с решение стъпка по стъпка.",
    available: true,
  },
  {
    icon: MessageCircle,
    tone: "blue",
    title: "AI асистент по учебника",
    text: "Обяснява по-просто, води с въпроси и проверява снимка на ръкописното ти решение.",
    available: false,
  },
  {
    icon: ClipboardList,
    tone: "warm",
    title: "Лични задания",
    text: "Вариантът се смята от факултетния номер, а отговорите се проверяват стъпка по стъпка.",
    available: false,
  },
  {
    icon: RefreshCw,
    tone: "warm",
    title: "Повторение през интервали",
    text: "Въпросите се връщат точно когато започваш да ги забравяш – няколко минути на ден.",
    available: true,
  },
  {
    icon: ChartColumn,
    tone: "warm",
    title: "Ясен напредък",
    text: "Виждаш докъде си стигнал по всеки модул и какво трябва да минеш преди следващия.",
    available: false,
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
        {features.map(({ icon: Icon, tone, title, text, available }) => (
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
            <h3 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xl font-extrabold">
              {title}
              <Badge variant={available ? "success" : "soon"}>
                {available ? "НАЛИЧНО" : "СКОРО"}
              </Badge>
            </h3>
            <p className="leading-[1.6] text-muted-foreground">{text}</p>
          </TiltCard>
        ))}
      </div>
    </section>
  );
}
