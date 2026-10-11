"use client";

import type { Element, ElementContent, Root, RootContent } from "hast";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { remarkChapter } from "@/lib/content/remark-chapter";

const LETTER = /[\p{L}\p{N}]/u;

/**
 * Огражда с <mark> думите от откъса, които отговарят на въпроса. Работи върху
 * дървото на вече разчетения Markdown: пипа само текстови възли и ги реже
 * на парчета – никъде не се вмъква HTML като низ. Формулите и кодът (по това
 * време още са <code>) се прескачат.
 */
function rehypeHighlight(terms: string[]) {
  const wanted = terms
    .filter((term) => term.trim().length > 1)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  const pattern =
    wanted.length > 0 ? new RegExp(wanted.join("|"), "giu") : null;

  const split = (value: string): ElementContent[] | null => {
    if (!pattern) return null;
    const parts: ElementContent[] = [];
    let last = 0;
    for (const match of value.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      // само цели думи: „ос“ не се оцветява вътре в „основа“
      if (LETTER.test(value[start - 1] ?? "") || LETTER.test(value[end] ?? ""))
        continue;
      if (start > last) {
        parts.push({ type: "text", value: value.slice(last, start) });
      }
      parts.push({
        type: "element",
        tagName: "mark",
        properties: {},
        children: [{ type: "text", value: match[0] }],
      });
      last = end;
    }
    if (parts.length === 0) return null;
    if (last < value.length) {
      parts.push({ type: "text", value: value.slice(last) });
    }
    return parts;
  };

  const walk = (node: Root | Element) => {
    const children: (RootContent | ElementContent)[] = [];
    for (const child of node.children) {
      if (child.type === "text") {
        children.push(...(split(child.value) ?? [child]));
        continue;
      }
      if (
        child.type === "element" &&
        !["code", "pre", "mark"].includes(child.tagName)
      ) {
        walk(child);
      }
      children.push(child);
    }
    node.children = children as typeof node.children;
  };

  return () => (tree: Root) => walk(tree);
}

/**
 * Текст от учебника или от асистента като Markdown с формули (KaTeX) и
 * карета (:::why …). Суров HTML не се изпълнява, а картинки не се зареждат.
 * Зарежда се отделно от останалата страница – чак когато има какво да покаже.
 */
export default function AssistantMarkdown({
  children,
  highlights,
}: {
  children: string;
  /** думи и изрази, които да се оцветят в текста */
  highlights?: string[];
}) {
  return (
    <div className="assistant-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkDirective, remarkChapter]}
        rehypePlugins={[rehypeHighlight(highlights ?? []), rehypeKatex]}
        urlTransform={(url) => (/^(https:|#|\/(?!\/))/.test(url) ? url : "")}
        components={{
          img: () => null,
          a({ href, children: label }) {
            const external = typeof href === "string" && /^https:/.test(href);
            return (
              <a
                href={href}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {label}
              </a>
            );
          },
          table({ children: rows }) {
            return (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Таблица"
              >
                <table>{rows}</table>
              </div>
            );
          },
          span({ className, children: content, node, ...props }) {
            void node; // вътрешен възел на react-markdown – не е HTML атрибут
            // дългите формули се превъртат настрани и с клавиатурата
            const isDisplayMath =
              typeof className === "string" &&
              className.includes("katex-display");
            return (
              <span
                className={className}
                {...(isDisplayMath ? { tabIndex: 0 } : {})}
                {...props}
              >
                {content}
              </span>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
