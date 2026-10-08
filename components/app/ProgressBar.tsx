import { cn } from "@/lib/utils";
import type { ChapterProgress } from "@/lib/progress";

/** Тясна лента: колко от седемте секции на главата са видени. */
export function ProgressBar({
  progress,
  wide = false,
}: {
  progress: ChapterProgress;
  /** по-дълга лента – за основната карта на таблото */
  wide?: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.seen}
        aria-label={`Видени секции: ${progress.seen} от ${progress.total}`}
        className={cn("sl-meter", wide ? "w-40 sm:w-56" : "w-20")}
      >
        <span style={{ width: `${progress.percent}%` }} />
      </span>
      <span className="font-mono text-xs text-dim">
        {progress.seen}/{progress.total}
      </span>
    </span>
  );
}
