import {
  neutralAxisAngle,
  rectangleCornerStresses,
} from "../engineering/biaxial.ts";
import { figureNumber } from "./beam-figure.ts";

/**
 * Правоъгълно сечение при общо огъване: напреженията в четирите ъгъла и
 * неутралната ос – направо от изчисленията.
 *
 * Оста y сочи надолу, както в текста на главата.
 */
export type BiaxialFigureSpec = {
  title: string;
  /** размери на правоъгълника, cm */
  b: number;
  h: number;
  /** моменти в kN·m: M_x > 0 опъва долу, M_y > 0 опъва вдясно */
  Mx: number;
  My: number;
};

const INK = "var(--fig-ink)";
const MUTED = "var(--fig-muted)";
const LOAD = "var(--fig-load)";
const ACCENT = "var(--fig-accent)";
const FILL = "var(--fig-fill)";
const MONO = "var(--font-mono, monospace)";

const n = (value: number) => (Math.round(value * 10) / 10).toString();
const sub = (base: string, index: string) =>
  `${base}<tspan baseline-shift="sub" font-size="10">${index}</tspan>`;
/** 1.949 → „1,949“; 6 → „6“ (до три знака, без излишни нули). */
const moment = (value: number) =>
  String(Math.round(value * 1000) / 1000)
    .replace(".", ",")
    .replace("-", "−");
/** kN/cm² → MPa с до два знака след запетаята. */
const mpa = (sigma: number) => figureNumber(Math.round(sigma * 1000) / 100);

export function renderBiaxialFigure(spec: BiaxialFigureSpec): string {
  const { b, h } = spec;
  const moments = { Mx: spec.Mx, My: spec.My };
  const section = { Ix: (b * h ** 3) / 12, Iy: (h * b ** 3) / 12 };
  const corners = rectangleCornerStresses(moments, b, h);
  const beta = neutralAxisAngle(moments, section);

  const scale = Math.min(170 / b, 190 / h);
  const cx = 250;
  const cy = 190;
  const halfW = (b * scale) / 2;
  const halfH = (h * scale) / 2;
  const height = Math.round(cy + halfH + 96);
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

  out.push(
    `<rect x="${n(cx - halfW)}" y="${n(cy - halfH)}" width="${n(2 * halfW)}" height="${n(2 * halfH)}" fill="${FILL}" stroke="${INK}" stroke-width="2"/>`,
    // главните оси
    `<line x1="${n(cx - halfW - 30)}" y1="${cy}" x2="${n(cx + halfW + 34)}" y2="${cy}" stroke="${MUTED}" stroke-width="1.2" stroke-dasharray="6 4"/>`,
    `<line x1="${cx}" y1="${n(cy - halfH - 30)}" x2="${cx}" y2="${n(cy + halfH + 34)}" stroke="${MUTED}" stroke-width="1.2" stroke-dasharray="6 4"/>`,
    text(cx + halfW + 40, cy + 5, "x", MUTED),
    text(cx, cy + halfH + 50, "y", MUTED, "middle"),
    text(cx, cy - halfH - 44, `${figureNumber(b)}×${figureNumber(h)} cm`, MUTED, "middle", 12),
  );

  // неутралната ос: σ = 0 → y = −(M_y·I_x)/(M_x·I_y)·x (y сочи надолу, както на екрана)
  const reach = Math.hypot(halfW, halfH) + 6;
  let dx: number;
  let dy: number;
  if (spec.Mx === 0) {
    dx = 0;
    dy = reach;
  } else {
    const slope = -(spec.My * section.Ix) / (spec.Mx * section.Iy);
    const length = Math.hypot(1, slope);
    dx = reach / length;
    dy = (reach * slope) / length;
  }
  out.push(
    `<line x1="${n(cx - dx)}" y1="${n(cy - dy)}" x2="${n(cx + dx)}" y2="${n(cy + dy)}" stroke="${LOAD}" stroke-width="2.2"/>`,
    `<circle cx="${cx}" cy="${cy}" r="4" fill="${LOAD}"/>`,
  );

  // напрежения в ъглите
  const corner = (sx: -1 | 1, sy: -1 | 1, sigma: number) => {
    const x = cx + sx * (halfW + 12);
    const y = cy + sy * (halfH + 20) + (sy > 0 ? 12 : -2);
    out.push(
      `<circle cx="${n(cx + sx * halfW)}" cy="${n(cy + sy * halfH)}" r="4" fill="${ACCENT}"/>`,
      text(x, y, `${mpa(sigma)} MPa`, ACCENT, sx > 0 ? "start" : "end"),
    );
  };
  corner(-1, -1, corners.topLeft);
  corner(1, -1, corners.topRight);
  corner(-1, 1, corners.bottomLeft);
  corner(1, 1, corners.bottomRight);

  // знаците на двете зони – близо до най-натоварените ъгли
  const entries: [number, number, number][] = [
    [-1, -1, corners.topLeft],
    [1, -1, corners.topRight],
    [-1, 1, corners.bottomLeft],
    [1, 1, corners.bottomRight],
  ];
  const most = (pick: (value: number) => number) =>
    entries.reduce((best, item) => (pick(item[2]) > pick(best[2]) ? item : best));
  const tension = most((value) => value);
  const compression = most((value) => -value);
  if (tension[2] > 1e-12) {
    out.push(text(cx + tension[0] * halfW * 0.62, cy + tension[1] * halfH * 0.7 + 5, "⊕", MUTED, "middle"));
  }
  if (compression[2] < -1e-12) {
    out.push(text(cx + compression[0] * halfW * 0.62, cy + compression[1] * halfH * 0.7 + 5, "⊖", MUTED, "middle"));
  }

  const infoX = 455;
  out.push(
    text(infoX, 110, `${sub("M", "x")} = ${moment(spec.Mx)} kN·m`, LOAD),
    text(infoX, 134, `${sub("M", "y")} = ${moment(spec.My)} kN·m`, LOAD),
    `<line x1="${infoX}" y1="166" x2="${infoX + 26}" y2="166" stroke="${LOAD}" stroke-width="2.2"/>`,
    text(infoX + 34, 171, "неутрална ос", INK, "start", 12),
    text(infoX, 195, `β = ${figureNumber(Math.round(beta * 10) / 10)}° от оста x`, MUTED, "start", 12),
    text(infoX, 226, "⊕ опън   ⊖ натиск", MUTED, "start", 12),
    text(320, height - 12, "напрежения в MPa (1 kN/cm² = 10 MPa)", MUTED, "middle", 12),
  );

  const title = spec.title.replace(/[<>&"]/g, "");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${height}" role="img" aria-label="${title}">` +
    out.join("") +
    `</svg>`
  );
}
