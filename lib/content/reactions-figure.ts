import {
  inclinedDirections,
  type ReactionLoad,
  type ReactionsScheme,
} from "../labs/reactions.ts";
import { figureNumber } from "./beam-figure.ts";

/**
 * Схема на греда като свободно тяло: опори, товари и опорните реакции.
 * Реакциите са начертани в ДЕЙСТВИТЕЛНИТЕ си посоки, а до тях стои
 * големината им – знакът от сметката вече е в посоката на стрелката.
 */
export type ReactionsFigureSpec = {
  /** кратко описание за екранни четци */
  title: string;
  scheme: ReactionsScheme;
  /** дължина на гредата, m */
  l: number;
  /** места на опорите, m (при запъване не се ползват) */
  xA: number;
  xB: number;
  loads: readonly ReactionLoad[];
  /** kN и kN·m; плюс = надясно / нагоре / обратно на часовниковата */
  reactions: { Ah: number; Av: number; Bv: number | null; MA: number | null };
};

const W = 400;
const LEFT = 60;
const RIGHT = 340;
const AXIS = 160;
const INK = "var(--fig-ink)";
const MUTED = "var(--fig-muted)";
const LOAD = "var(--fig-load)";
const ACCENT = "var(--fig-accent)";
const MONO = "var(--font-mono, monospace)";
const FONT = 13;
/** приблизителна ширина на един знак при FONT, px */
const CHAR = 7.9;

const n = (value: number) => (Math.round(value * 10) / 10).toString();
const sub = (base: string, index: string) =>
  `${base}<tspan baseline-shift="sub" font-size="10">${index}</tspan>`;

export function renderReactionsFigure(spec: ReactionsFigureSpec): string {
  const { l, loads, reactions } = spec;
  const fixed = spec.scheme === "fixed";
  const sx = (x: number) =>
    LEFT + ((RIGHT - LEFT) * Math.min(Math.max(x, 0), l)) / l;
  const out: string[] = [];

  const text = (
    x: number,
    y: number,
    value: string,
    color: string,
    anchor: "start" | "middle" | "end" = "middle",
    size = FONT,
  ) =>
    `<text x="${n(x)}" y="${n(y)}" fill="${color}" font-family="${MONO}" font-size="${size}" text-anchor="${anchor}">${value}</text>`;

  /** Стрелка от (x1; y1) до върха (x2; y2). */
  const arrow = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    width = 2.6,
    head = 10,
  ) => {
    const length = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / length;
    const uy = (y2 - y1) / length;
    const bx = x2 - ux * head;
    const by = y2 - uy * head;
    const half = head * 0.45;
    return (
      `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(bx)}" y2="${n(by)}" stroke="${color}" stroke-width="${width}"/>` +
      `<polygon points="${n(x2)},${n(y2)} ${n(bx - uy * half)},${n(by + ux * half)} ${n(bx + uy * half)},${n(by - ux * half)}" fill="${color}"/>`
    );
  };

  // надписите на товарите не се застъпват: при сблъсък надписът се качва нагоре
  const placed: { x1: number; x2: number; y: number }[] = [];
  const loadLabel = (cx: number, y: number, plain: string) => {
    const width = plain.length * CHAR;
    const x = Math.min(Math.max(cx, width / 2 + 4), W - width / 2 - 4);
    let yy = y;
    const clash = () =>
      placed.some(
        (box) =>
          Math.abs(box.y - yy) < FONT + 2 &&
          box.x1 < x + width / 2 + 4 &&
          box.x2 > x - width / 2 - 4,
      );
    while (clash() && yy > 30) yy -= FONT + 3;
    placed.push({ x1: x - width / 2, x2: x + width / 2, y: yy });
    out.push(text(x, yy, plain, LOAD));
  };

  // ── товари ──
  for (const load of loads) {
    if (load.kind === "uniform") {
      if (!(load.q > 0)) continue;
      const x1 = sx(Math.min(load.from, load.to));
      const x2 = sx(Math.max(load.from, load.to));
      const top = AXIS - 40;
      out.push(
        `<line x1="${n(x1)}" y1="${top}" x2="${n(x2)}" y2="${top}" stroke="${LOAD}" stroke-width="2"/>`,
      );
      const count = Math.max(2, Math.round((x2 - x1) / 30));
      for (let k = 0; k <= count; k++) {
        const x = x1 + ((x2 - x1) * k) / count;
        out.push(arrow(x, top, x, AXIS - 5, LOAD, 1.5, 8));
      }
      placed.push({ x1, x2, y: top + 8 });
      loadLabel((x1 + x2) / 2, top - 8, `q = ${figureNumber(load.q)} kN/m`);
    } else if (load.kind === "triangular") {
      if (!(load.q > 0)) continue;
      const x0 = sx(load.zeroAt);
      const x1 = sx(load.peakAt);
      const top = AXIS - 46;
      out.push(
        `<line x1="${n(x0)}" y1="${AXIS - 5}" x2="${n(x1)}" y2="${top}" stroke="${LOAD}" stroke-width="2"/>`,
      );
      const count = Math.max(3, Math.round(Math.abs(x1 - x0) / 30));
      for (let k = 1; k <= count; k++) {
        const x = x0 + ((x1 - x0) * k) / count;
        const y = AXIS - 5 + ((top - (AXIS - 5)) * k) / count;
        // ниските стрелки са само черти – върхът не се побира
        out.push(
          AXIS - 5 - y > 14
            ? arrow(x, y, x, AXIS - 5, LOAD, 1.5, 8)
            : `<line x1="${n(x)}" y1="${n(y)}" x2="${n(x)}" y2="${AXIS - 5}" stroke="${LOAD}" stroke-width="1.5"/>`,
        );
      }
      placed.push({ x1: Math.min(x0, x1), x2: Math.max(x0, x1), y: top + 8 });
      loadLabel(x1, top - 8, `q = ${figureNumber(load.q)} kN/m`);
    } else if (load.kind === "couple") {
      if (load.M === 0) continue;
      const x = sx(load.x);
      const y = AXIS - 12;
      const counter = load.M > 0;
      out.push(
        `<path d="M ${n(x - 16)} ${y} A 17 17 0 0 1 ${n(x + 16)} ${y}" fill="none" stroke="${LOAD}" stroke-width="2.5"/>`,
        counter
          ? `<polygon points="${n(x - 19)},${y + 8} ${n(x - 9)},${y - 2} ${n(x - 23)},${y - 6}" fill="${LOAD}"/>`
          : `<polygon points="${n(x + 19)},${y + 8} ${n(x + 9)},${y - 2} ${n(x + 23)},${y - 6}" fill="${LOAD}"/>`,
      );
      loadLabel(x, y - 26, `M = ${figureNumber(Math.abs(load.M))} kN·m`);
    } else {
      if (!(load.F > 0)) continue;
      const x = sx(load.x);
      const angle = load.kind === "inclined" ? load.angle : 90;
      const direction =
        load.kind === "inclined"
          ? inclinedDirections.find((item) => item.id === load.direction)!
          : { sx: 1 as const, sy: -1 as const };
      const rad = (angle * Math.PI) / 180;
      // посока в координатите на екрана (y расте надолу)
      const dx = direction.sx * Math.cos(rad);
      const dy = -direction.sy * Math.sin(rad);
      const length = 56;
      const upward = direction.sy > 0 && angle > 0;
      const py = angle === 0 ? AXIS - 14 : AXIS - 5;
      // сила надолу: върхът е на гредата; сила нагоре: началото е на гредата
      const tail = upward
        ? { x, y: py }
        : { x: x - dx * length, y: py - dy * length };
      const tip = upward
        ? { x: x + dx * length, y: py + dy * length }
        : { x, y: py };
      out.push(arrow(tail.x, tail.y, tip.x, tip.y, LOAD, 3, 11));
      const far = upward ? tip : tail;
      loadLabel(
        far.x,
        Math.min(far.y, AXIS - 24) - 8,
        load.kind === "inclined" && angle !== 90
          ? `F = ${figureNumber(load.F)} kN; ${figureNumber(angle)}°`
          : `F = ${figureNumber(load.F)} kN`,
      );
    }
  }

  // ── гредата ──
  out.push(
    `<line x1="${LEFT}" y1="${AXIS}" x2="${RIGHT}" y2="${AXIS}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
  );

  // ── опори и реакции ──
  const rows = [AXIS + 102, AXIS + 121, AXIS + 140];
  const value = (base: string, index: string, amount: number, unit: string) =>
    amount === 0
      ? `${sub(base, index)} = 0`
      : `${sub(base, index)} = ${figureNumber(Math.abs(amount))} ${unit}`;
  const plainLength = (amount: number, unit: string) =>
    amount === 0
      ? 7
      : `A_v = ${figureNumber(Math.abs(amount))} ${unit}`.length - 1;
  const verticalReaction = (x: number, amount: number) => {
    if (amount === 0) return;
    out.push(
      amount > 0
        ? arrow(x, AXIS + 84, x, AXIS + 42, ACCENT)
        : arrow(x, AXIS + 42, x, AXIS + 84, ACCENT),
    );
  };
  const horizontalReaction = (x: number, y: number, amount: number) => {
    if (amount === 0) return;
    out.push(
      amount > 0
        ? arrow(x - 56, y, x - 18, y, ACCENT)
        : arrow(x - 18, y, x - 56, y, ACCENT),
    );
  };

  if (fixed) {
    out.push(
      `<line x1="${LEFT}" y1="${AXIS - 30}" x2="${LEFT}" y2="${AXIS + 30}" stroke="${INK}" stroke-width="3"/>`,
    );
    for (let k = 0; k < 6; k++) {
      const y = AXIS - 28 + k * 10;
      out.push(
        `<line x1="${LEFT}" y1="${y}" x2="${LEFT - 11}" y2="${y + 9}" stroke="${MUTED}" stroke-width="1.4"/>`,
      );
    }
    out.push(
      text(LEFT - 8, AXIS - 38, "A", INK),
      text(RIGHT + 12, AXIS + 5, "K", MUTED, "start"),
    );
    horizontalReaction(LEFT, AXIS, reactions.Ah);
    verticalReaction(LEFT, reactions.Av);
    const MA = reactions.MA ?? 0;
    if (MA !== 0) {
      const cx = LEFT + 38;
      const y = AXIS + 12;
      out.push(
        `<path d="M ${cx - 18} ${y} A 18 18 0 0 0 ${cx + 18} ${y}" fill="none" stroke="${ACCENT}" stroke-width="2.6"/>`,
        MA > 0
          ? `<polygon points="${cx + 18},${y - 9} ${cx + 12},${y + 3} ${cx + 25},${y + 2}" fill="${ACCENT}"/>`
          : `<polygon points="${cx - 18},${y - 9} ${cx - 12},${y + 3} ${cx - 25},${y + 2}" fill="${ACCENT}"/>`,
      );
    }
    out.push(
      text(8, rows[0]!, value("A", "v", reactions.Av, "kN"), ACCENT, "start"),
      text(8, rows[1]!, value("A", "h", reactions.Ah, "kN"), ACCENT, "start"),
      text(8, rows[2]!, value("M", "A", MA, "kN·m"), ACCENT, "start"),
    );
  } else {
    const xa = sx(spec.xA);
    const xb = sx(spec.xB);
    const Bv = reactions.Bv ?? 0;
    out.push(
      // неподвижна опора
      `<polygon points="${n(xa)},${AXIS + 4} ${n(xa - 12)},${AXIS + 26} ${n(xa + 12)},${AXIS + 26}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
      `<line x1="${n(xa - 18)}" y1="${AXIS + 26}" x2="${n(xa + 18)}" y2="${AXIS + 26}" stroke="${INK}" stroke-width="2"/>`,
      // подвижна опора
      `<polygon points="${n(xb)},${AXIS + 4} ${n(xb - 12)},${AXIS + 24} ${n(xb + 12)},${AXIS + 24}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
      `<circle cx="${n(xb - 6)}" cy="${AXIS + 28}" r="3" fill="none" stroke="${INK}" stroke-width="1.4"/>`,
      `<circle cx="${n(xb + 6)}" cy="${AXIS + 28}" r="3" fill="none" stroke="${INK}" stroke-width="1.4"/>`,
      `<line x1="${n(xb - 18)}" y1="${AXIS + 33}" x2="${n(xb + 18)}" y2="${AXIS + 33}" stroke="${INK}" stroke-width="2"/>`,
      text(xa + 16, AXIS + 20, "A", INK, "start"),
      text(xb + 16, AXIS + 20, "B", INK, "start"),
    );
    horizontalReaction(xa, AXIS + 15, reactions.Ah);
    verticalReaction(xa, reactions.Av);
    verticalReaction(xb, Bv);

    const widthA =
      Math.max(
        plainLength(reactions.Av, "kN"),
        plainLength(reactions.Ah, "kN"),
      ) * CHAR;
    const widthB = plainLength(Bv, "kN") * CHAR;
    const centre = (x: number, width: number) =>
      Math.min(Math.max(x, width / 2 + 4), W - width / 2 - 4);
    const ca = centre(xa, widthA);
    const cb = centre(xb, widthB);
    const overlap = Math.abs(ca - cb) < (widthA + widthB) / 2 + 8;
    out.push(
      // двата реда на A започват от едно и също място
      text(ca - widthA / 2, rows[0]!, value("A", "v", reactions.Av, "kN"), ACCENT, "start"),
      text(ca - widthA / 2, rows[1]!, value("A", "h", reactions.Ah, "kN"), ACCENT, "start"),
      text(cb, overlap ? rows[2]! : rows[0]!, value("B", "v", Bv, "kN"), ACCENT),
    );
  }

  // ── дължина и легенда ──
  const dim = AXIS + 158;
  out.push(
    `<line x1="${LEFT}" y1="${dim}" x2="${RIGHT}" y2="${dim}" stroke="${MUTED}" stroke-width="1.4"/>`,
    `<line x1="${LEFT}" y1="${dim - 6}" x2="${LEFT}" y2="${dim + 6}" stroke="${MUTED}" stroke-width="1.4"/>`,
    `<line x1="${RIGHT}" y1="${dim - 6}" x2="${RIGHT}" y2="${dim + 6}" stroke="${MUTED}" stroke-width="1.4"/>`,
    text((LEFT + RIGHT) / 2, dim + 18, `l = ${figureNumber(l)} m`, MUTED),
    text(
      W / 2,
      dim + 40,
      "реакциите са начертани в действителните си посоки",
      MUTED,
      "middle",
      12,
    ),
  );

  const title = spec.title.replace(/[<>&"]/g, "");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${dim + 52}" role="img" aria-label="${title}">` +
    out.join("") +
    `</svg>`
  );
}
