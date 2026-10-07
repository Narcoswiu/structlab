import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeading, PublicPage } from "@/components/public/PublicPage";
import { Tour } from "@/components/public/Tour";
import { buttonClass } from "@/components/ui/button";
import { CHAPTER_SECTIONS } from "@/lib/content/sections";

export const metadata: Metadata = {
  title: "Въведение",
  description:
    "Обиколка на StructLab в 7 стъпки: табло, учебник, лаборатории и какво предстои.",
};

export default function WelcomePage() {
  return (
    <PublicPage>
      <PublicHeading title="Как работи сайтът">
        Обиколка за две минути: за какво служи всяка част и как се ползва. Мини
        стъпка по стъпка или избери тема от списъка.
      </PublicHeading>
      <Tour />
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <h2 className="text-xl font-extrabold">
          Седемте стъпки на всяка глава
        </h2>
        <ol className="flex flex-wrap gap-2">
          {CHAPTER_SECTIONS.map((section, index) => (
            <li
              key={section.id}
              className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted-foreground"
            >
              <span className="mr-1.5 font-mono text-primary">{index + 1}</span>
              {section.title}
            </li>
          ))}
        </ol>
        <p className="max-w-[640px] leading-[1.6] text-muted-foreground">
          Всяка глава минава през тези седем стъпки – от опит от живота до
          кратко резюме за преговор.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/demo" className={buttonClass()}>
            Пробвай демото
          </Link>
          <Link
            href="/request-invite"
            className={buttonClass({ variant: "outline" })}
          >
            Поискай покана
          </Link>
        </div>
      </section>
    </PublicPage>
  );
}
