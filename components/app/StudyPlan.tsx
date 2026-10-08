import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { PlanItem, PlanYear, SpecialtyOption } from "@/lib/catalog";
import { getOutlineByTitle } from "@/lib/outlines";

const yearNames = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function Discipline({ item }: { item: PlanItem }) {
  if (item.module && item.module.chapterCount > 0) {
    return (
      <li>
        <Link
          href={`/learn/${item.module.slug}`}
          className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-1.5 font-bold text-link hover:text-link-hover"
        >
          {item.title}
          <Badge variant="success">
            {item.module.chapterCount}{" "}
            {item.module.chapterCount === 1 ? "ГЛАВА" : "ГЛАВИ"}
          </Badge>
        </Link>
      </li>
    );
  }
  // още няма уроци, но има план какво ще съдържа дисциплината
  const outline = getOutlineByTitle(item.title);
  if (outline) {
    return (
      <li>
        <Link
          href={`/plan/${outline.slug}`}
          className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-muted-foreground hover:text-foreground"
        >
          {item.title}
          {item.module ? (
            <Badge variant="soon">ПОДГОТВЯ СЕ</Badge>
          ) : (
            <Badge variant="tag">ПЛАН</Badge>
          )}
        </Link>
      </li>
    );
  }
  return (
    <li className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-muted-foreground">
      {item.title}
      {item.module ? <Badge variant="soon">ПОДГОТВЯ СЕ</Badge> : null}
    </li>
  );
}

function Term({ name, items }: { name: string; items: PlanItem[] }) {
  return (
    <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
      <h4 className="text-xs font-extrabold tracking-[1.2px] text-dim uppercase">
        {name} семестър
      </h4>
      {items.length > 0 ? (
        <ul className="flex flex-col">
          {items.map((item) => (
            <Discipline key={item.title} item={item} />
          ))}
        </ul>
      ) : (
        <p className="py-1.5 text-sm text-dim">Няма публикувани данни.</p>
      )}
    </div>
  );
}

/** Учебният план на специалността: курс → семестър → дисциплини. */
export function StudyPlan({
  specialty,
  plan,
}: {
  specialty: SpecialtyOption;
  plan: PlanYear[];
}) {
  return (
    <section aria-label="Учебен план" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-extrabold">
          {specialty.university.shortName} · {specialty.name}
        </h2>
        <p className="text-sm text-dim">
          {specialty.degree}, {specialty.years} години ·{" "}
          <Link
            href="/account"
            className="font-bold text-link hover:text-link-hover"
          >
            смени специалността
          </Link>
        </p>
      </div>
      {plan.map((year) => (
        <div key={year.year} className="sl-card flex flex-col gap-4">
          <h3 className="text-lg font-extrabold">
            {yearNames[year.year - 1]} курс
          </h3>
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <Term name="Зимен" items={year.winter} />
            <Term name="Летен" items={year.summer} />
          </div>
        </div>
      ))}
      {specialty.note ? (
        <p className="text-sm leading-[1.6] text-dim">
          <strong className="text-muted-foreground">Откъде са данните:</strong>{" "}
          {specialty.note} StructLab не е свързана с университета; сверявай с
          официалния си учебен план.
        </p>
      ) : null}
    </section>
  );
}
