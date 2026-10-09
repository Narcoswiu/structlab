import {
  maxDeflectionPosition,
  standardDeflectionAt,
  type CurveCase,
} from "../engineering/deflection-curve.ts";
import { figureNumber } from "./beam-figure.ts";

/**
 * Чертае типов случай на огъване: опори, товар и еластичната линия –
 * направо от затворената формула за w(x). Провисването е увеличено, за да
 * се вижда; истинската му стойност е надписана при най-голямото.
 */
export type DeflectionFigureSpec = {
  title: string;
  scheme: CurveCase;
  /** дължина или отвор, m */
  l: number;
  /** F в kN или q в kN/m, надолу */
  load: number;
  /** коравина E·I, kN·m² */
  EI: number;
};

const W = 480;
const LEFT = 50;
const RIGHT = 430;
const AXIS = 118;
const AMP = 66;
const INK = "var(--fig-ink)";
const MUTED = "var(--fig-muted)";
const LOAD = "var(--fig-load)";
const ACCENT = "var(--fig-accent)";
const MONO = "var(--font-mono, monospace)";

const n = (value: number) => (Math.round(value * 10) / 10).toString();

export function renderDeflectionFigure(spec: DeflectionFigureSpec): string {
  const { scheme, l, load, EI } = spec;
  const cantilever = scheme.startsWith("cantilever");
  const distributed = scheme.endsWith("distributed");
  const sx = (x: number) => LEFT + ((RIGHT - LEFT) * x) / l;
  const xMax = maxDeflectionPosition(scheme, l);
  const f = standardDeflectionAt(scheme, load, l, EI, xMax);
  // формата не зависи от големината на товара – мащабира се до AMP
  const peak = standardDeflectionAt(scheme, 1, l, 1, xMax);
  const sy = (x: number) =>
    AXIS + (f === 0 ? 0 : (AMP * standardDeflectionAt(scheme, 1, l, 1, x)) / peak);

  const out: string[] = [];
  const text = (
    x: number,
    y: number,
    value: string,
    color: string,
    anchor: "start" | "middle" | "end" = "middle",
    size = 14,
  ) =>
    `<text x="${n(x)}" y="${n(y)}" fill="${color}" font-family="${MONO}" font-size="${size}" text-anchor="${anchor}">${value}</text>`;
  const arrow = (x: number, y1: number, y2: number, width: number) =>
    `<line x1="${n(x)}" y1="${n(y1)}" x2="${n(x)}" y2="${n(y2 - 8)}" stroke="${LOAD}" stroke-width="${width}"/>` +
    `<polygon points="${n(x)},${n(y2)} ${n(x - 5)},${n(y2 - 11)} ${n(x + 5)},${n(y2 - 11)}" fill="${LOAD}"/>`;

  // товар
  if (distributed) {
    const top = AXIS - 44;
    out.push(
      `<line x1="${LEFT}" y1="${top}" x2="${RIGHT}" y2="${top}" stroke="${LOAD}" stroke-width="2"/>`,
    );
    for (let k = 0; k <= 8; k++) {
      out.push(arrow(LEFT + ((RIGHT - LEFT) * k) / 8, top, AXIS - 5, 1.6));
    }
    out.push(
      text((LEFT + RIGHT) / 2, top - 10, `q = ${figureNumber(load)} kN/m`, LOAD),
    );
  } else {
    const x = sx(xMax);
    out.push(arrow(x, AXIS - 66, AXIS - 5, 3));
    out.push(
      cantilever
        ? text(x - 12, AXIS - 52, `F = ${figureNumber(load)} kN`, LOAD, "end")
        : text(x + 12, AXIS - 52, `F = ${figureNumber(load)} kN`, LOAD, "start"),
    );
  }

  // опори
  if (cantilever) {
    out.push(
      `<line x1="${LEFT}" y1="${AXIS - 34}" x2="${LEFT}" y2="${AXIS + 34}" stroke="${INK}" stroke-width="3"/>`,
    );
    for (let k = 0; k < 7; k++) {
      const y = AXIS - 30 + k * 10;
      out.push(
        `<line x1="${LEFT}" y1="${y}" x2="${LEFT - 12}" y2="${y + 10}" stroke="${MUTED}" stroke-width="1.4"/>`,
      );
    }
  } else {
    const support = (x: number, roller: boolean) => {
      const base = AXIS + 24;
      out.push(
        `<polygon points="${x},${AXIS + 3} ${x - 13},${base} ${x + 13},${base}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
        `<line x1="${x - 20}" y1="${base + (roller ? 7 : 0)}" x2="${x + 20}" y2="${base + (roller ? 7 : 0)}" stroke="${INK}" stroke-width="2"/>`,
      );
      if (roller) {
        out.push(
          `<circle cx="${x - 7}" cy="${base + 3.5}" r="3" fill="none" stroke="${INK}" stroke-width="1.4"/>`,
          `<circle cx="${x + 7}" cy="${base + 3.5}" r="3" fill="none" stroke="${INK}" stroke-width="1.4"/>`,
        );
      }
    };
    support(LEFT, false);
    support(RIGHT, true);
  }

  // гредата преди натоварването
  out.push(
    `<line x1="${LEFT}" y1="${AXIS}" x2="${RIGHT}" y2="${AXIS}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  );

  // еластичната линия
  const points: string[] = [];
  for (let k = 0; k <= 60; k++) {
    const x = (l * k) / 60;
    points.push(`${n(sx(x))},${n(sy(x))}`);
  }
  out.push(
    `<polyline points="${points.join(" ")}" fill="none" stroke="${ACCENT}" stroke-width="2.6" stroke-dasharray="9 5" stroke-linecap="round"/>`,
  );

  // най-голямото провисване
  const px = sx(xMax);
  const py = sy(xMax);
  if (f !== 0) {
    out.push(
      `<line x1="${n(px)}" y1="${AXIS}" x2="${n(px)}" y2="${n(py)}" stroke="${MUTED}" stroke-width="1.4"/>`,
      `<line x1="${n(px - 6)}" y1="${n(py)}" x2="${n(px + 6)}" y2="${n(py)}" stroke="${MUTED}" stroke-width="1.4"/>`,
    );
  }
  out.push(
    `<circle cx="${n(px)}" cy="${n(py)}" r="4.5" fill="${ACCENT}"/>`,
    text(
      cantilever ? px + 8 : px,
      AXIS + AMP + 24,
      `f = ${figureNumber(f * 1000)} mm`,
      ACCENT,
      cantilever ? "end" : "middle",
    ),
  );

  // дължината
  const dim = AXIS + AMP + 46;
  out.push(
    `<line x1="${LEFT}" y1="${dim}" x2="${RIGHT}" y2="${dim}" stroke="${MUTED}" stroke-width="1.4"/>`,
    `<line x1="${LEFT}" y1="${dim - 6}" x2="${LEFT}" y2="${dim + 6}" stroke="${MUTED}" stroke-width="1.4"/>`,
    `<line x1="${RIGHT}" y1="${dim - 6}" x2="${RIGHT}" y2="${dim + 6}" stroke="${MUTED}" stroke-width="1.4"/>`,
    text((LEFT + RIGHT) / 2, dim + 20, `l = ${figureNumber(l)} m`, MUTED),
    text(
      W / 2,
      dim + 46,
      "пунктир – еластичната линия (начертана увеличено)",
      MUTED,
      "middle",
      12,
    ),
  );

  const height = dim + 58;
  const title = spec.title.replace(/[<>&"]/g, "");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" role="img" aria-label="${title}">` +
    out.join("") +
    `</svg>`
  );
}
