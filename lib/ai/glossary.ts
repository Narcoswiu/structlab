import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import {
  EMPTY_SYNONYMS,
  buildSynonymIndex,
  type GlossaryTerm,
  type SynonymIndex,
} from "./retrieval";

let cached: SynonymIndex | undefined;

/**
 * Синонимите и означенията от content/glossary.yml. Файлът се чете веднъж на
 * сървър; ако липсва или е повреден, търсенето работи и без синоними.
 */
export function getSynonyms(): SynonymIndex {
  if (cached) return cached;
  try {
    const file = path.join(process.cwd(), "content", "glossary.yml");
    const parsed: unknown = parseYaml(readFileSync(file, "utf8"));
    const terms = (Array.isArray(parsed) ? parsed : []).flatMap(
      (item): GlossaryTerm[] => {
        if (!item || typeof item !== "object") return [];
        const { preferred, also_ok, avoid, symbol } = item as Record<
          string,
          unknown
        >;
        if (typeof preferred !== "string") return [];
        const strings = (value: unknown) =>
          Array.isArray(value)
            ? value.filter(
                (entry): entry is string => typeof entry === "string",
              )
            : [];
        return [
          {
            preferred,
            also_ok: strings(also_ok),
            avoid: strings(avoid),
            symbol: typeof symbol === "string" ? symbol : undefined,
          },
        ];
      },
    );
    cached = buildSynonymIndex(terms);
  } catch {
    cached = EMPTY_SYNONYMS;
  }
  return cached;
}
