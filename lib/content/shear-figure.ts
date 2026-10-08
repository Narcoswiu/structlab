import { sectionProperties, type Rect } from "../engineering/section.ts";
import { maxShearStress, shearStressProfile } from "../engineering/shear.ts";
import { figureNumber } from "./beam-figure.ts";

/**
 * Чертае сечение и до него диаграмата на тангенциалните напрежения при
 * огъване (формула на Журавски) – направо от изчисленията.
 */
export type ShearStressFigureSpec = {
  title: string;
  section: Rect[];
  /** напречна сила в kN */
  Q: number;
};

const INK = "var(--fig-ink)";
const MUTED = "var(--fig-muted)";
const LOAD = "var(--fig-load)";
const ACCENT = "var(--fig-accent)";
const FILL = "var(--fig-fill)";
const MONO = "var(--font-mono, monospace)";

const n = (value: number) => (Math.round(value * 10) / 10).toString();
/** kN/cm² → MPa с три значещи цифри: 43,4; 5,77; 0,6. */
const mpa = (tau: number) => {
  const value = tau * 10;
  return figureNumber(
    value >= 10 ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100,
  );
};

export function renderShearStressFigure(spec: ShearStressFigureSpec): string {
  const props = sectionProperties(spec.section);
  const parts = shearStressProfile(spec.section, spec.Q);
  const peak = maxShearStress(spec.section, spec.Q);
  const minX = Math.min(...spec.section.map((r) => r.x));
  const maxX = Math.max(...spec.section.map((r) => r.x + r.b));
  const minY = Math.min(...spec.section.map((r) => r.y));
  const maxY = Math.max(...spec.section.map((r) => r.y + r.h));

  const scale = Math.min(170 / (maxX - minX), 210 / (maxY - minY));
  const top = 64;
  const bottom = top + (maxY - minY) * scale;
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

  out.push(text(px(minX), 28, `Q = ${figureNumber(spec.Q)} kN`, LOAD));
  for (const rect of spec.section) {
    out.push(
      `<rect x="${n(px(rect.x))}" y="${n(py(rect.y + rect.h))}" width="${n(rect.b * scale)}" height="${n(rect.h * scale)}" fill="${FILL}" stroke="${INK}" stroke-width="2"/>`,
    );
  }

  // диаграма τ: нулевата линия е вертикална, напреженията са надясно
  const zero = 330;
  const amp = 150;
  const sx = (tau: number) => zero + (amp * tau) / peak.tau;

  out.push(
    `<line x1="${n(px(minX) - 24)}" y1="${n(neutral)}" x2="${n(zero + amp + 16)}" y2="${n(neutral)}" stroke="${LOAD}" stroke-width="1.6" stroke-dasharray="7 4"/>`,
    `<circle cx="${n(px(props.xc))}" cy="${n(neutral)}" r="4" fill="${LOAD}"/>`,
  );
  for (const points of parts) {
    const path = [
      `${zero},${n(py(points[0]!.y))}`,
      ...points.map((point) => `${n(sx(point.tau))},${n(py(point.y))}`),
      `${zero},${n(py(points.at(-1)!.y))}`,
    ].join(" ");
    out.push(
      `<polygon points="${path}" fill="${FILL}" stroke="${ACCENT}" stroke-width="2.2" stroke-linejoin="round"/>`,
    );
  }
  out.push(
    `<line x1="${zero}" y1="${n(top - 14)}" x2="${zero}" y2="${n(bottom + 14)}" stroke="${INK}" stroke-width="1.6"/>`,
    text(zero, top - 26, "τ", INK, "middle"),
  );

  // стойности: най-голямото и двете страни на всеки скок
  const labelX = zero + amp + 22;
  out.push(
    text(labelX, neutral + 5, `${mpa(peak.tau)} MPa`, ACCENT),
    `<circle cx="${n(sx(peak.tau))}" cy="${n(py(peak.y))}" r="3.5" fill="${ACCENT}"/>`,
  );
  // на всеки скок: стойността над границата / стойността под нея
  for (let i = 0; i < parts.length - 1; i++) {
    const below = parts[i]!.at(-1)!;
    const above = parts[i + 1]![0]!;
    const y = py(below.y);
    out.push(
      text(
        labelX,
        // надписът стои от страната, която е по-далеч от неутралната ос
        y < neutral ? y - 6 : y + 16,
        `${mpa(above.tau)} / ${mpa(below.tau)} MPa`,
        MUTED,
        "start",
        12,
      ),
    );
  }

  out.push(
    text(
      320,
      height - 12,
      "MPa; при скок: над / под границата; пунктир – неутралната ос",
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
