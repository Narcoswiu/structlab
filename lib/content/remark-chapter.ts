import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import { sectionIdForTitle } from "./sections.ts";

/** Каретата, които може да се ползват в текста: :::why … ::: и т.н. */
export const CALLOUTS = {
  why: "Защо?",
  real: "В практиката",
  remember: "Запомни",
  note: "Внимание",
  quiz: "Въпрос",
} as const;

type DirectiveNode = {
  type: "containerDirective" | "leafDirective" | "textDirective";
  name: string;
  children: unknown[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
};

function textOf(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { value?: unknown; children?: unknown[] };
  if (typeof n.value === "string") return n.value;
  return (n.children ?? []).map(textOf).join("");
}

/**
 * Превръща нашите означения в HTML:
 *  - „## Загадка“ получава постоянен id (за превключвателя Леко ⇄ Подробно);
 *  - :::why / :::real / :::remember / :::note / :::quiz стават карета;
 *  - :::answer става сгъваем блок „Покажи отговора“;
 *  - непознати означения се връщат като обикновен текст.
 */
export function remarkChapter() {
  return (tree: Root) => {
    let fallback = 0;
    // поредният номер на въпроса в главата (от 0) – по него четецът намира
    // кой въпрос от базата стои зад „Покажи отговора“
    let quizIndex = -1;
    visit(tree, "heading", (node) => {
      if (node.depth !== 2) return;
      const id = sectionIdForTitle(textOf(node)) ?? `chast-${++fallback}`;
      node.data = { ...node.data, hProperties: { id } };
    });

    visit(tree, (node, index, parent) => {
      // remark-directive добавя тези три вида възли; в типовете на mdast ги няма.
      const kind: string = node.type;
      if (
        kind !== "containerDirective" &&
        kind !== "leafDirective" &&
        kind !== "textDirective"
      ) {
        return;
      }
      const directive = node as unknown as DirectiveNode;

      if (directive.type === "containerDirective" && directive.name in CALLOUTS) {
        if (directive.name === "quiz") quizIndex += 1;
        directive.data = {
          hName: "aside",
          hProperties: {
            className: ["callout", `callout-${directive.name}`],
            "data-label": CALLOUTS[directive.name as keyof typeof CALLOUTS],
          },
        };
        return;
      }
      if (directive.type === "containerDirective" && directive.name === "answer") {
        directive.data = {
          hName: "details",
          hProperties: {
            className: ["answer"],
            ...(quizIndex >= 0 ? { "data-quiz": String(quizIndex) } : {}),
          },
        };
        directive.children.unshift({
          type: "paragraph",
          data: { hName: "summary" },
          children: [{ type: "text", value: "Покажи отговора" }],
        });
        return;
      }

      // Непознато означение (напр. „1:а“ в текста): оставяме го като текст.
      if (parent && typeof index === "number") {
        const prefix = directive.type === "textDirective" ? ":" : directive.type === "leafDirective" ? "::" : ":::";
        (parent.children as unknown[])[index] = {
          type: "text",
          value: `${prefix}${directive.name}${textOf(directive)}`,
        };
      }
    });
  };
}
