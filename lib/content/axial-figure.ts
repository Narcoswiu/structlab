import {
  solveBar,
  solveFixedFixedBar,
  solveRigidBeamOnRods,
  type Segment,
} from "../engineering/axial.ts";
import { figureNumber } from "./beam-figure.ts";

const INK = "var(--fig-ink)";
const MUTED = "var(--fig-muted)";
const LOAD = "var(--fig-load)";
const ACCENT = "var(--fig-accent)";
const FILL = "var(--fig-fill)";
const MONO = "var(--font-mono, monospace)";

const n = (value: number) => (Math.round(value * 10) / 10).toString();

const text = (
  x: number,
  y: number,
  value: string,
  color: string,
  anchor: "start" | "middle" | "end" = "middle",
  size = 14,
) =>
  `<text x="${n(x)}" y="${n(y)}" fill="${color}" font-family="${MONO}" font-size="${size}" text-anchor="${anchor}">${value}</text>`;

const sub = (base: string, index: string | number) =>
  `${base}<tspan baseline-shift="sub" font-size="10">${index}</tspan>`;

function wall(x: number, y1: number, y2: number, side: "left" | "right"): string[] {
  const out = [
    `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${MUTED}" stroke-width="3"/>`,
  ];
  for (let y = y1 + 4; y < y2; y += 10) {
    out.push(
      `<line x1="${x}" y1="${y}" x2="${side === "left" ? x - 9 : x + 9}" y2="${y + 8}" stroke="${MUTED}" stroke-width="1.5"/>`,
    );
  }
  return out;
}

export type BarFigureSpec = {
  title: string;
  segments: Segment[];
  forces: number[];
  /** запънат и в десния край (статически неопределим) */
  fixedBoth?: boolean;
  /** само схемата, без диаграмата N – за задачи, в които N се търси */
  schemeOnly?: boolean;
};

/** Стъпаловиден прът с товарите и диаграмата на нормалната сила N. */
export function renderBarFigure(spec: BarFigureSpec): string {
  const result = spec.fixedBoth
    ? solveFixedFixedBar(spec.segments, spec.forces)
    : solveBar(spec.segments, spec.forces);
  const LEFT = 80;
  const RIGHT = 540;
  const total = spec.segments.reduce((sum, s) => sum + s.length, 0);
  const maxArea = Math.max(...spec.segments.map((s) => s.area));
  const axis = 84;
  const out: string[] = [];

  let x = LEFT;
  const edges: number[] = [LEFT];
  spec.segments.forEach((segment, i) => {
    const w = ((RIGHT - LEFT) * segment.length) / total;
    const half = 10 + 18 * Math.sqrt(segment.area / maxArea);
    out.push(
      `<rect x="${n(x)}" y="${n(axis - half)}" width="${n(w)}" height="${n(2 * half)}" fill="${FILL}" stroke="${INK}" stroke-width="2"/>`,
      text(x + w / 2, axis + 5, `${sub("A", i + 1)} = ${figureNumber(segment.area)} cm²`, MUTED, "middle", 12),
      text(x + w / 2, axis + half + 20, `${sub("l", i + 1)} = ${figureNumber(segment.length / 100)} m`, MUTED, "middle", 12),
    );
    x += w;
    edges.push(x);
  });
  out.push(...wall(LEFT, axis - 44, axis + 44, "left"));
  if (spec.fixedBoth) out.push(...wall(RIGHT, axis - 44, axis + 44, "right"));

  spec.forces.forEach((force, i) => {
    if (force === 0) return;
    const at = edges[i + 1]!;
    const dir = force > 0 ? 1 : -1;
    const y = axis - 52;
    out.push(
      `<line x1="${n(at)}" y1="${y}" x2="${n(at + dir * 44)}" y2="${y}" stroke="${LOAD}" stroke-width="3"/>`,
      `<polygon points="${n(at + dir * 56)},${y} ${n(at + dir * 42)},${y - 7} ${n(at + dir * 42)},${y + 7}" fill="${LOAD}"/>`,
      `<line x1="${n(at)}" y1="${y}" x2="${n(at)}" y2="${axis - 30}" stroke="${LOAD}" stroke-width="1.2" stroke-dasharray="3 3"/>`,
      text(at + dir * 28, y - 10, `${sub("F", i + 1)} = ${figureNumber(Math.abs(force))} kN`, LOAD),
    );
  });

  const title = spec.title.replace(/[<>&"]/g, "");
  if (spec.schemeOnly) {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${axis + 64}" role="img" aria-label="${title}">` +
      out.join("") +
      `</svg>`
    );
  }

  // диаграма N
  const peak = Math.max(...result.N.map(Math.abs), 1e-9);
  const hasNegative = result.N.some((value) => value < -1e-9);
  const hasPositive = result.N.some((value) => value > 1e-9);
  const amp = 46;
  const zero = axis + 78 + (hasPositive ? amp + 16 : 8);
  out.push(
    text(LEFT - 14, zero + 5, "N", INK, "end"),
    `<line x1="${LEFT}" y1="${n(zero)}" x2="${RIGHT}" y2="${n(zero)}" stroke="${MUTED}" stroke-width="1.5"/>`,
  );
  result.N.forEach((value, i) => {
    const x1 = edges[i]!;
    const x2 = edges[i + 1]!;
    const y = zero - (amp * value) / peak;
    out.push(
      `<rect x="${n(x1)}" y="${n(Math.min(y, zero))}" width="${n(x2 - x1)}" height="${n(Math.abs(y - zero))}" fill="${FILL}" stroke="${ACCENT}" stroke-width="2.2"/>`,
      text((x1 + x2) / 2, value >= 0 ? y - 8 : y + 18, `${figureNumber(value)}`, ACCENT),
      text((x1 + x2) / 2, (y + zero) / 2 + 5, value >= 0 ? "⊕" : "⊖", MUTED),
    );
  });
  out.push(text(RIGHT + 14, zero + 5, "kN", MUTED, "start"));
  const height = Math.ceil(zero + (hasNegative ? amp + 30 : 20));

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${height}" role="img" aria-label="${title}">` +
    out.join("") +
    `</svg>`
  );
}

export type RigidBeamFigureSpec = {
  title: string;
  rods: (Segment & { arm: number })[];
  load: { F: number; arm: number };
};

/** Корава греда на шарнир, окачена на вертикални пръти, с изчислените сили. */
export function renderRigidBeamFigure(spec: RigidBeamFigureSpec): string {
  const result = solveRigidBeamOnRods(spec.rods, spec.load);
  const LEFT = 90;
  const maxArm = Math.max(spec.load.arm, ...spec.rods.map((rod) => rod.arm));
  const sx = (arm: number) => LEFT + (430 * arm) / maxArm;
  const ceiling = 30;
  const beam = 170;
  const out: string[] = [];

  out.push(
    `<line x1="${LEFT - 30}" y1="${ceiling}" x2="${n(sx(maxArm) + 20)}" y2="${ceiling}" stroke="${MUTED}" stroke-width="3"/>`,
  );
  for (let x = LEFT - 26; x < sx(maxArm) + 20; x += 12) {
    out.push(
      `<line x1="${n(x)}" y1="${ceiling}" x2="${n(x + 8)}" y2="${ceiling - 9}" stroke="${MUTED}" stroke-width="1.5"/>`,
    );
  }
  // гредата (абсолютно корава) и шарнирът
  out.push(
    `<rect x="${LEFT}" y="${beam - 7}" width="${n(sx(maxArm) - LEFT)}" height="14" fill="${INK}"/>`,
    `<polygon points="${LEFT},${beam + 7} ${LEFT - 13},${beam + 31} ${LEFT + 13},${beam + 31}" fill="none" stroke="${MUTED}" stroke-width="2"/>`,
    `<line x1="${LEFT - 19}" y1="${beam + 35}" x2="${LEFT + 19}" y2="${beam + 35}" stroke="${MUTED}" stroke-width="2"/>`,
    `<circle cx="${LEFT}" cy="${beam}" r="5" fill="var(--rd-surface, #fff)" stroke="${MUTED}" stroke-width="2"/>`,
    text(LEFT - 22, beam + 5, "A", MUTED, "end"),
  );
  spec.rods.forEach((rod, i) => {
    const x = sx(rod.arm);
    out.push(
      `<line x1="${n(x)}" y1="${ceiling}" x2="${n(x)}" y2="${beam - 7}" stroke="${ACCENT}" stroke-width="3"/>`,
      `<circle cx="${n(x)}" cy="${beam - 7}" r="3.5" fill="${ACCENT}"/>`,
      text(x + 10, (ceiling + beam) / 2 - 6, `${sub("N", i + 1)} = ${figureNumber(result.N[i]!)} kN`, ACCENT, "start"),
      text(x + 10, (ceiling + beam) / 2 + 14, `${sub("Δl", i + 1)} = ${figureNumber(result.deltaL[i]! * 10)} mm`, MUTED, "start", 12),
      text(x, beam + 62, `${figureNumber(rod.arm / 100)} m`, MUTED, "middle", 12),
      `<line x1="${n(x)}" y1="${beam + 40}" x2="${n(x)}" y2="${beam + 48}" stroke="${MUTED}" stroke-width="1.2"/>`,
    );
  });
  const fx = sx(spec.load.arm);
  out.push(
    `<line x1="${n(fx)}" y1="${beam + 10}" x2="${n(fx)}" y2="${beam + 58}" stroke="${LOAD}" stroke-width="3"/>`,
    `<polygon points="${n(fx)},${beam + 70} ${n(fx - 7)},${beam + 56} ${n(fx + 7)},${beam + 56}" fill="${LOAD}"/>`,
    text(fx - 12, beam + 62, `F = ${figureNumber(spec.load.F)} kN`, LOAD, "end"),
    text(fx, beam + 92, `${figureNumber(spec.load.arm / 100)} m от A`, MUTED, "middle", 12),
  );

  const title = spec.title.replace(/[<>&"]/g, "");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${beam + 104}" role="img" aria-label="${title}">` +
    out.join("") +
    `</svg>`
  );
}
