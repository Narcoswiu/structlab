import type { InviteResult } from "@/app/admin/actions";
import { CopyButton } from "./CopyButton";

/** Линковете се показват само веднъж – в базата остава единствено хешът им. */
export function InviteResults({ results }: { results?: InviteResult[] }) {
  if (!results?.length) return null;
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-intro-line bg-surface-hi p-4"
    >
      <p className="text-sm leading-normal text-muted-foreground">
        Линковете се показват само сега. Ако ги загубиш, натисни „Нов линк“ при
        поканата.
      </p>
      {results.map((result) => (
        <div
          key={result.email}
          className="flex flex-col gap-2 border-t border-line pt-3 first:border-0 first:pt-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold break-all">{result.email}</span>
            <span
              className={
                result.error
                  ? "text-sm text-warn-fg"
                  : result.emailed
                    ? "text-sm text-success"
                    : "text-sm text-dim"
              }
            >
              {result.error ??
                (result.emailed
                  ? "Имейлът е изпратен"
                  : "Без имейл – копирай линка")}
            </span>
          </div>
          {result.url ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 rounded-lg bg-background px-3 py-2 font-mono text-xs break-all text-muted-foreground">
                {result.url}
              </code>
              <CopyButton value={result.url} label="Копирай линка" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
