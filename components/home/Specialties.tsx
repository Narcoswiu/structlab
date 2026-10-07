import Link from "next/link";
import { TiltCard } from "@/components/three-d/TiltCard";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "./SectionHeading";

const activeModules = [
  "Съпротивление на материалите",
  "Теоретична механика",
  "Инженерна геология",
  "Строителни машини",
];
const upcoming = ["Архитектура", "Геодезия", "Транспортно строителство"];

export function Specialties() {
  return (
    <section
      id="spec"
      className="flex scroll-mt-6 flex-col gap-10 pt-16 lg:pt-[104px]"
    >
      <SectionHeading
        eyebrow="СПЕЦИАЛНОСТИ"
        title="Подредено като в европейските университети"
      >
        Специалност → курс → семестър → модул → тема. Всеки модул показва какво
        трябва да знаеш преди него.
      </SectionHeading>
      <div className="flex flex-wrap gap-4">
        <TiltCard className="flex-[1_1_260px] gap-3.5 border-primary p-6">
          <Badge variant="success">АКТИВНА</Badge>
          <h3 className="text-xl font-extrabold">Строителни специалности</h3>
          <p className="text-sm leading-[1.5] text-muted-foreground">
            ВСУ „Любен Каравелов“: СИ, ССС, ССС-СК, СМ · УАСГ: ССС, УС
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activeModules.map((name) => (
              <Badge key={name} variant="tag">
                {name}
              </Badge>
            ))}
          </div>
          <Link
            href="/demo"
            className="mt-auto inline-flex min-h-11 items-center self-start font-extrabold text-link hover:text-link-hover"
          >
            Към модулите →
          </Link>
        </TiltCard>
        {upcoming.map((name) => (
          <TiltCard key={name} className="flex-[1_1_260px] gap-3.5 p-6">
            <Badge variant="soon">СКОРО</Badge>
            <h3 className="text-xl font-extrabold">{name}</h3>
            <p className="text-sm text-dim">Модулите се уточняват.</p>
          </TiltCard>
        ))}
      </div>
    </section>
  );
}
