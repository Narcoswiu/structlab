import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const slugPattern = /^[a-z0-9-]{1,80}$/;

/** Модулът с главите му. RLS връща ред само при активен достъп. */
async function loadModule(slug: string) {
  if (!slugPattern.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("modules")
    .select("title, description, chapters(slug, number, title, summary)")
    .eq("slug", slug)
    .order("number", { referencedTable: "chapters" })
    .maybeSingle();
  return data;
}

export async function generateMetadata(
  props: PageProps<"/learn/[module]">,
): Promise<Metadata> {
  const { module: slug } = await props.params;
  await requireUser();
  return { title: (await loadModule(slug))?.title ?? "Модул" };
}

export default async function ModulePage(props: PageProps<"/learn/[module]">) {
  const { module: slug } = await props.params;
  await requireUser();
  const data = await loadModule(slug);
  if (!data) notFound();

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center self-start text-[15px] font-bold text-link hover:text-link-hover"
        >
          ← Табло
        </Link>
        <h1 className="font-display text-[clamp(24px,5vw,36px)] leading-[1.15] font-bold">
          {data.title}
        </h1>
        <p className="max-w-[640px] text-muted-foreground">
          {data.description}
        </p>
      </div>
      {data.chapters.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {data.chapters.map((chapter) => (
            <li key={chapter.slug}>
              <Link
                href={`/learn/${slug}/${chapter.slug}`}
                className="lift flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-5 no-underline sm:p-6"
              >
                <span className="font-mono text-sm text-primary">
                  Глава {chapter.number}
                </span>
                <span className="text-xl font-extrabold text-foreground">
                  {chapter.title}
                </span>
                {chapter.summary ? (
                  <span className="leading-[1.6] text-muted-foreground">
                    {chapter.summary}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-6 text-muted-foreground">
          Главите по тази дисциплина се подготвят.
        </p>
      )}
    </>
  );
}
