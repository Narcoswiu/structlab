import { renderBarFigure } from "@/lib/content/axial-figure";
import { renderBeamFigure } from "@/lib/content/beam-figure";
import { renderSectionFigure } from "@/lib/content/section-figure";
import { isSafeSvg } from "@/lib/content/svg";
import type { PersonalTask } from "@/lib/personal-tasks";

/**
 * Схемата към заданието – само даденото, без нищо от търсеното (без
 * стойности на реакции, без диаграми, без център на тежестта).
 */
function renderTaskFigure(task: PersonalTask): string {
  const title = task.figureTitle;
  const figure = task.figure;
  switch (figure.kind) {
    case "beam":
      return renderBeamFigure(figure.beam, {
        title,
        parts: ["scheme"],
        hideReactions: true,
      });
    case "section":
      return renderSectionFigure(figure.rects, { title, outlineOnly: true });
    case "bar":
      return renderBarFigure({
        title,
        segments: figure.segments,
        forces: figure.forces,
        schemeOnly: true,
      });
  }
}

export function TaskFigure({ task }: { task: PersonalTask }) {
  const svg = renderTaskFigure(task);
  if (!isSafeSvg(svg)) return null;
  return (
    <div
      className="lab rounded-2xl border border-line bg-surface p-4 [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-[640px]"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
