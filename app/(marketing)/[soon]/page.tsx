import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { comingSoonPages, type ComingSoonSlug } from "@/lib/site";

// Временни страници „Очаквай скоро“ за /login, /welcome, /demo и др.
// Всяка ще бъде заменена с истинската в своя етап.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(comingSoonPages).map((soon) => ({ soon }));
}

function getPage(slug: string) {
  return slug in comingSoonPages
    ? comingSoonPages[slug as ComingSoonSlug]
    : null;
}

export async function generateMetadata(
  props: PageProps<"/[soon]">,
): Promise<Metadata> {
  const { soon } = await props.params;
  return { title: getPage(soon)?.title, robots: { index: false } };
}

export default async function ComingSoonPage(props: PageProps<"/[soon]">) {
  const { soon } = await props.params;
  const page = getPage(soon);
  if (!page) notFound();

  return (
    <Container>
      <SiteHeader />
      <section className="flex flex-col items-start gap-5 py-16 lg:py-24">
        <Badge variant="soon">СКОРО</Badge>
        <h1 className="font-display text-[clamp(26px,6vw,44px)] leading-[1.1] font-bold">
          {page.title}
        </h1>
        <p className="max-w-[560px] text-[17px] leading-[1.65] text-muted-foreground">
          {page.text}
        </p>
        <Link href="/" className={buttonClass({ variant: "outline" })}>
          ← Към началото
        </Link>
      </section>
    </Container>
  );
}
