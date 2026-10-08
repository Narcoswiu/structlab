import { extremeStresses } from "../engineering/bending.ts";
import { sectionProperties, type Rect } from "../engineering/section.ts";
import { figureNumber } from "./beam-figure.ts";

/**
 * Чертае сечение с неутралната ос и до него диаграмата на нормалните
 * напрежения при огъване – направо от изчисленията.
 *
 * Опънът (⊕) е начертан вдясно от нулевата линия, натискът (⊖) – вляво.
 */
export type BendingStressFigureSpec = {
  title: string;
  section: Rect[];
  /** огъващ момент в kN·m; положителен опъва долните влакна */
  M: number;
};

const INK = "var(--fig-ink)";
const MUTED = "var(--fig-muted)";
const LOAD = "var(--fig-load)";
const ACCENT = "var(--fig-accent)";
const FILL = "var(--fig-fill)";
const MONO = "var(--font-mono, monospace)";

const n = (value: number) => (Math.round(value * 10) / 10).toString();

export function renderBendingStressFigure(spec: BendingStressFigureSpec): string {
  const props = sectionProperties(spec.section);
  const stress = extremeStresses(spec.M, props);
  const solid = spec.section.filter((rect) => !rect.hole);
  const minX = Math.min(...solid.map((r) => r.x));
  const maxX = Math.max(...solid.map((r) => r.x + r.b));
  const minY = Math.min(...solid.map((r) => r.y));
  const maxY = Math.max(...solid.map((r) => r.y + r.h));

  const scale = Math.min(170 / (maxX - minX), 210 / (maxY - minY));
  const sectionHeight = (maxY - minY) * scale;
  const top = 64;
  const bottom = top + sectionHeight;
  const height = Math.round(bottom + 62);
  const left = 130 - ((maxX - minX) * scale) / 2;
  const px = (x: number) => left + (x - minX) * scale;
  const py = (y: number) => bottom - (y - minY) * scale;
  const neutral = py(props.yc);

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

  out.push(text(px(minX), 28, `M = ${figureNumber(spec.M)} kN·m`, LOAD));

  for (const rect of spec.section) {
    out.push(
      `<rect x="${n(px(rect.x))}" y="${n(py(rect.y + rect.h))}" width="${n(rect.b * scale)}" height="${n(rect.h * scale)}" fill="${rect.hole ? "var(--rd-surface, #fff)" : FILL}" stroke="${INK}" stroke-width="2"/>`,
    );
  }

  // диаграма σ: нулевата линия е вертикална, опънът е надясно
  const zero = 450;
  const amp = 105;
  const peak = Math.max(Math.abs(stress.top), Math.abs(stress.bottom), 1e-12);
  const sx = (sigma: number) => zero + (amp * sigma) / peak;

  // неутралната ос минава през сечението и през нулата на диаграмата
  out.push(
    `<line x1="${n(px(minX) - 24)}" y1="${n(neutral)}" x2="${n(zero + amp + 30)}" y2="${n(neutral)}" stroke="${LOAD}" stroke-width="1.6" stroke-dasharray="7 4"/>`,
    `<circle cx="${n(px(props.xc))}" cy="${n(neutral)}" r="4" fill="${LOAD}"/>`,
  );

  // разстояния от неутралната ос до крайните влакна
  const dim = 262;
  const tick = (y: number) =>
    `<line x1="${dim - 6}" y1="${n(y)}" x2="${dim + 6}" y2="${n(y)}" stroke="${MUTED}" stroke-width="1.4"/>`;
  out.push(
    `<line x1="${dim}" y1="${n(top)}" x2="${dim}" y2="${n(bottom)}" stroke="${MUTED}" stroke-width="1.4"/>`,
    tick(top),
    tick(neutral),
    tick(bottom),
    text(dim + 10, (top + neutral) / 2 + 4, `${figureNumber(props.yTop)} cm`, MUTED, "start", 12),
    text(dim + 10, (neutral + bottom) / 2 + 4, `${figureNumber(props.yBottom)} cm`, MUTED, "start", 12),
  );

  out.push(
    `<polygon points="${n(zero)},${n(top)} ${n(sx(stress.top))},${n(top)} ${n(sx(stress.bottom))},${n(bottom)} ${n(zero)},${n(bottom)}" fill="${FILL}" stroke="${ACCENT}" stroke-width="2.2" stroke-linejoin="round"/>`,
    `<line x1="${zero}" y1="${n(top - 14)}" x2="${zero}" y2="${n(bottom + 14)}" stroke="${INK}" stroke-width="1.6"/>`,
    text(zero, top - 26, "σ", INK, "middle"),
  );

  const end = (sigma: number, y: number, labelY: number) => {
    if (Math.abs(sigma) < 1e-12) return;
    const tension = sigma > 0;
    out.push(
      // стойността стои до нулевата линия, откъм своята страна на диаграмата
      text(
        tension ? zero + 8 : zero - 8,
        labelY,
        `${figureNumber(Math.round(sigma * 100) / 10)} MPa`,
        ACCENT,
        tension ? "start" : "end",
      ),
      // знакът стои в триъгълника, на една трета от основата му
      text(
        zero + (amp * sigma) / peak / 3,
        y + (neutral - y) / 3 + 5,
        tension ? "⊕" : "⊖",
        MUTED,
        "middle",
      ),
    );
  };
  end(stress.top, top, top - 8);
  end(stress.bottom, bottom, bottom + 20);

  const upperTension = stress.top > 0;
  out.push(
    // надписът е от празната страна на диаграмата, за да не я застъпва
    text(
      zero + amp + 30,
      upperTension ? neutral + 16 : neutral - 7,
      "неутрална ос",
      LOAD,
      "end",
      12,
    ),
    text(zero + amp + 34, top + 16, upperTension ? "опън" : "натиск", MUTED, "start", 12),
    text(zero + amp + 34, bottom - 6, upperTension ? "натиск" : "опън", MUTED, "start", 12),
    text(
      320,
      height - 12,
      "размери в cm; напрежения в MPa (1 kN/cm² = 10 MPa)",
      MUTED,
      "middle",
      12,
    ),
  );

  const title = spec.title.replace(/[<>&"]/g, "");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${height}" role="img" aria-label="${title}">` +
    out.join("") +
    `</svg>`
  );
}
