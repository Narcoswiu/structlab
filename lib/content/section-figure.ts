import { sectionProperties, type Rect } from "../engineering/section.ts";
import { figureNumber } from "./beam-figure.ts";

/**
 * Чертае сечение от правоъгълници с центъра на тежестта, централните оси и
 * (по избор) главните оси – направо от изчислените характеристики.
 */
export type SectionFigureOptions = {
  title: string;
  /** да се начертаят ли главните оси 1 и 2 и ъгълът α */
  principal?: boolean;
};

const INK = "var(--fig-ink)";
const MUTED = "var(--fig-muted)";
const LOAD = "var(--fig-load)";
const ACCENT = "var(--fig-accent)";
const FILL = "var(--fig-fill)";
const MONO = "var(--font-mono, monospace)";

const n = (value: number) => (Math.round(value * 10) / 10).toString();

export function renderSectionFigure(
  rects: Rect[],
  options: SectionFigureOptions,
): string {
  const props = sectionProperties(rects);
  const solid = rects.filter((rect) => !rect.hole);
  const minX = Math.min(...solid.map((r) => r.x));
  const maxX = Math.max(...solid.map((r) => r.x + r.b));
  const minY = Math.min(...solid.map((r) => r.y));
  const maxY = Math.max(...solid.map((r) => r.y + r.h));

  const scale = Math.min(250 / (maxX - minX), 250 / (maxY - minY));
  const width = 640;
  const height = Math.round((maxY - minY) * scale) + 130;
  const left = 190 - ((maxX - minX) * scale) / 2 + 20;
  const bottom = height - 60;
  const px = (x: number) => left + (x - minX) * scale;
  const py = (y: number) => bottom - (y - minY) * scale;

  const out: string[] = [];
  const text = (
    x: number,
    y: number,
    value: string,
    color: string,
    anchor: "start" | "middle" | "end" = "start",
    size = 14,
  ) =>
    `<text x="${n(x)}" y="${n(y)}" fill="${color}" font-family="${MONO}" font-size="${size}" text-anchor="${anchor}">${value}</text>`;

  for (const rect of rects) {
    out.push(
      `<rect x="${n(px(rect.x))}" y="${n(py(rect.y + rect.h))}" width="${n(rect.b * scale)}" height="${n(rect.h * scale)}" fill="${rect.hole ? "var(--rd-surface, #fff)" : FILL}" stroke="${INK}" stroke-width="2"/>`,
    );
  }
  for (const rect of rects) {
    out.push(
      text(
        px(rect.x + rect.b / 2),
        py(rect.y + rect.h / 2) + 5,
        `${figureNumber(rect.b)}×${figureNumber(rect.h)}`,
        MUTED,
        "middle",
        12,
      ),
    );
  }

  // централни оси
  const cx = px(props.xc);
  const cy = py(props.yc);
  const pad = 34;
  out.push(
    `<line x1="${n(px(minX) - pad)}" y1="${n(cy)}" x2="${n(px(maxX) + pad)}" y2="${n(cy)}" stroke="${LOAD}" stroke-width="1.6" stroke-dasharray="7 4"/>`,
    `<line x1="${n(cx)}" y1="${n(py(maxY) - pad)}" x2="${n(cx)}" y2="${n(py(minY) + pad)}" stroke="${LOAD}" stroke-width="1.6" stroke-dasharray="7 4"/>`,
    text(px(maxX) + pad + 6, cy + 5, "x", LOAD),
    text(cx, py(maxY) - pad - 6, "y", LOAD, "middle"),
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="4.5" fill="${LOAD}"/>`,
    text(cx + 8, cy - 8, "C", LOAD),
  );

  if (options.principal) {
    const a = (props.alpha * Math.PI) / 180;
    const reach = Math.max(maxX - minX, maxY - minY) * scale * 0.62 + 20;
    const axis = (angle: number, label: string) => {
      const dx = Math.cos(angle) * reach;
      const dy = -Math.sin(angle) * reach; // в SVG оста y сочи надолу
      out.push(
        `<line x1="${n(cx - dx)}" y1="${n(cy - dy)}" x2="${n(cx + dx)}" y2="${n(cy + dy)}" stroke="${ACCENT}" stroke-width="2"/>`,
        text(cx + dx * 1.06, cy + dy * 1.06 + 5, label, ACCENT, "middle"),
      );
    };
    axis(a, "1");
    axis(a + Math.PI / 2, "2");
  }

  // стойности вдясно
  const lines = [
    `A = ${figureNumber(props.A)} cm²`,
    `x_c = ${figureNumber(props.xc - minX)} cm`,
    `y_c = ${figureNumber(props.yc - minY)} cm`,
    `I_x = ${figureNumber(props.Ix)} cm⁴`,
    `I_y = ${figureNumber(props.Iy)} cm⁴`,
  ];
  if (options.principal) {
    lines.push(
      `I_xy = ${figureNumber(props.Ixy)} cm⁴`,
      `I_1 = ${figureNumber(props.I1)} cm⁴`,
      `I_2 = ${figureNumber(props.I2)} cm⁴`,
      `α = ${figureNumber(props.alpha)}°`,
    );
  }
  lines.forEach((line, i) => {
    const [name, rest] = line.split(" = ");
    const [base, sub] = name!.split("_");
    const label = sub
      ? `${base}<tspan baseline-shift="sub" font-size="10">${sub}</tspan>`
      : base!;
    out.push(text(410, 40 + i * 24, `${label} = ${rest}`, i < 3 ? MUTED : INK));
  });
  out.push(
    text(
      px((minX + maxX) / 2),
      height - 14,
      "размери в cm; координатите на C са от долния ляв ъгъл",
      MUTED,
      "middle",
      12,
    ),
  );

  const title = options.title.replace(/[<>&"]/g, "");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">` +
    out.join("") +
    `</svg>`
  );
}
