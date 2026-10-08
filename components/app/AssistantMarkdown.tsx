"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { remarkChapter } from "@/lib/content/remark-chapter";

/**
 * Текст от учебника или от асистента като Markdown с формули (KaTeX) и
 * карета (:::why …). Суров HTML не се изпълнява, а картинки не се зареждат.
 * Зарежда се отделно от останалата страница – чак когато има какво да покаже.
 */
export default function AssistantMarkdown({ children }: { children: string }) {
  return (
    <div className="assistant-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkDirective, remarkChapter]}
        rehypePlugins={[rehypeKatex]}
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
