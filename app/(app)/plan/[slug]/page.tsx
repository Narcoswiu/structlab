import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { getOutlineBySlug, getOutlineByTitle } from "@/lib/outlines";

export async function generateMetadata(
  props: PageProps<"/plan/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: getOutlineBySlug(slug)?.title ?? "План на дисциплината" };
}

/** Планът на дисциплина, за която още няма уроци: какви глави ще има. */
export default async function OutlinePage(props: PageProps<"/plan/[slug]">) {
  const { slug } = await props.params;
  await requireUser();
  const outline = getOutlineBySlug(slug);
  if (!outline) notFound();
  const related = outline.related.flatMap((title) => {
    const other = getOutlineByTitle(title);
    return other && other.slug !== outline.slug ? [other] : [];
  });

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center self-start text-[15px] font-bold text-link hover:text-link-hover"
        >
          ← Табло
        </Link>
        <div>
          <Badge variant="soon">ПЛАН · УРОЦИТЕ СЕ ПОДГОТВЯТ</Badge>
        </div>
        <h1 className="font-display text-[clamp(24px,5vw,36px)] leading-[1.15] font-bold">
          {outline.title}
        </h1>
        <p className="max-w-[680px] text-muted-foreground">{outline.summary}</p>
      </div>

      <section
        aria-label="Защо ти трябва"
        className="rounded-2xl border border-intro-line bg-surface-hi p-5 sm:p-6"
      >
        <h2 className="text-xs font-extrabold tracking-[1.2px] text-link uppercase">
          Защо ти трябва
        </h2>
        <p className="mt-2 max-w-[680px] leading-[1.65]">{outline.why}</p>
      </section>

      <section aria-label="Какво ще има" className="flex flex-col gap-3">
        <h2 className="text-xl font-extrabold">
          Какво ще има – {outline.chapters.length} глави
        </h2>
        <ol className="flex flex-col gap-3">
          {outline.chapters.map((chapter, index) => (
            <li
              key={chapter.title}
              className="flex gap-4 rounded-2xl border border-line bg-surface p-5"
            >
              <span className="font-mono text-sm text-dim">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-lg font-extrabold">{chapter.title}</span>
                <span className="leading-[1.55] text-muted-foreground">
                  {chapter.summary}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <p className="max-w-[680px] text-sm leading-[1.6] text-dim">
        {outline.official && outline.sourceUrl ? (
          <>
            Планът следва{" "}
            <a
              href={outline.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-link hover:text-link-hover"
            >
              публикуваната програма или анотация на дисциплината
            </a>
            . Разделянето на глави е наше и може да се промени.
          </>
        ) : (
          "Това е примерен план по обичайното съдържание на дисциплината. Ще го сверим с официалната програма, преди да излязат уроците."
        )}{" "}
        StructLab не е свързана с университета. Ако тази дисциплина ти трябва
        по-скоро, пиши ни през „Обратна връзка“.
      </p>

      {related.length > 0 ? (
        <section
          aria-label="Свързани дисциплини"
          className="flex flex-col gap-2"
        >
          <h2 className="text-sm font-extrabold tracking-[1.2px] text-dim uppercase">
            Свързани дисциплини
          </h2>
          <ul className="flex flex-wrap gap-x-6">
            {related.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/plan/${item.slug}`}
                  className="inline-flex min-h-11 items-center font-bold text-link hover:text-link-hover"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
