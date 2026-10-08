import type { ChapterSource } from "@/lib/reader-chapter";

/** Списъкът „Източници“ в края на главата. */
export function ChapterSources({ sources }: { sources: ChapterSource[] }) {
  if (sources.length === 0) return null;
  return (
    <section className="reader-sources" aria-label="Източници">
      <h2>Източници</h2>
      <ul>
        {sources.map((source) => (
          <li key={source.title}>
            {source.url ? (
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}
              </a>
            ) : (
              source.title
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
