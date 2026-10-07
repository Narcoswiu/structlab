import type { ChapterProgress } from "@/lib/progress";

/** Тясна лента: колко от седемте секции на главата са видени. */
export function ProgressBar({ progress }: { progress: ChapterProgress }) {
  return (
    <span className="flex items-center gap-2">
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.seen}
        aria-label={`Видени секции: ${progress.seen} от ${progress.total}`}
        className="block h-1.5 w-20 overflow-hidden rounded-full bg-surface-2"
      >
        <span
          className="block h-full rounded-full bg-success"
          style={{ width: `${progress.percent}%` }}
        />
      </span>
      <span className="font-mono text-xs text-dim">
        {progress.seen}/{progress.total}
      </span>
    </span>
  );
}
