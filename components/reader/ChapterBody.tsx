import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { remarkChapter } from "@/lib/content/remark-chapter";
import { isSafeSvg } from "@/lib/content/svg";

type ChapterBodyProps = {
  markdown: string;
  /** име на фигура → SVG */
  figures: Record<string, string>;
};

const FIGURE_PREFIX = "figure:";

/**
 * Превръща текста на главата (Markdown) в HTML на сървъра. Суров HTML в текста
 * не се изпълнява; единственото вградено HTML са фигурите, след проверка.
 */
export function ChapterBody({ markdown, figures }: ChapterBodyProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, remarkDirective, remarkChapter]}
      rehypePlugins={[rehypeKatex]}
      // позволяваме само нашите „figure:“ адреси и обикновени връзки
      urlTransform={(url) =>
        url.startsWith(FIGURE_PREFIX) || /^(https?:|mailto:|#|\/)/.test(url)
          ? url
          : ""
      }
      components={{
        img({ src, alt }) {
          const name =
            typeof src === "string" && src.startsWith(FIGURE_PREFIX)
              ? src.slice(FIGURE_PREFIX.length)
              : null;
          const svg = name ? figures[name] : undefined;
          if (!svg || !isSafeSvg(svg)) {
            return <span className="figure-missing">[липсва фигура]</span>;
          }
          return (
            <span className="figure">
              <span
                className="figure-art"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              {alt ? <span className="figure-caption">{alt}</span> : null}
            </span>
          );
        },
        a({ href, children }) {
          const external = typeof href === "string" && /^https?:/.test(href);
          return (
            <a
              href={href}
              {...(external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {children}
            </a>
          );
        },
        table({ children }) {
          // широките таблици се превъртат настрани; tabIndex ги прави достъпни
          // и от клавиатурата
          return (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Таблица"
            >
              <table>{children}</table>
            </div>
          );
        },
        span({ className, children, ...props }) {
          // дългите формули също се превъртат настрани на тесен екран
          const isDisplayMath =
            typeof className === "string" &&
            className.includes("katex-display");
          return (
            <span
              className={className}
              {...(isDisplayMath ? { tabIndex: 0 } : {})}
              {...props}
            >
              {children}
            </span>
          );
        },
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
