import data from "./outlines.generated.json";

/**
 * Планове на дисциплините – какви глави ще има всяка. Данните идват от
 * content/outlines/*.yml през `pnpm outlines:build`.
 */
export type Outline = {
  title: string;
  slug: string;
  summary: string;
  why: string;
  related: string[];
  /** главите следват официална програма или анотация на университета */
  official: boolean;
  sourceUrl: string | null;
  chapters: { title: string; summary: string }[];
};

const outlines = data as Outline[];
const byTitle = new Map(outlines.map((outline) => [outline.title, outline]));
const bySlug = new Map(outlines.map((outline) => [outline.slug, outline]));

export function getOutlineByTitle(title: string): Outline | undefined {
  return byTitle.get(title);
}

export function getOutlineBySlug(slug: string): Outline | undefined {
  return bySlug.get(slug);
}

export function outlineCount(): number {
  return outlines.length;
}
