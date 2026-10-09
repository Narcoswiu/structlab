import { figureNumber } from "./beam-figure.ts";

/**
 * Чертеж на равнинна ферма с усилията в прътите.
 *
 * Опънът и натискът се различават по ДВА признака, не само по цвят:
 * опънат прът – плътна линия и положително число; натиснат – пунктир и
 * число с минус; нулев прът – ситен пунктир и „0“.
 * Товарите и реакциите са начертани в действителните си посоки.
 */
export type TrussFigureSpec = {
  /** кратко описание за екранни четци */
  title: string;
  joints: readonly { id: string; x: number; y: number }[];
  /** усилие в kN: > 0 опън, < 0 натиск */
  members: readonly { id: string; from: string; to: string; force: number }[];
  supports: readonly { joint: string; type: "pinned" | "roller" }[];
  /** товари и реакции във възлите, kN; плюс = надясно / нагоре */
  loads: readonly { joint: string; fx: number; fy: number }[];
  reactions: readonly { joint: string; fx: number; fy: number }[];
};

const W = 380;
const MX = 44;
const TOP = 62;
const MAX_H = 170;
const INK = "var(--fig-ink)";
const MUTED = "var(--fig-muted)";
const LOAD = "var(--fig-load)";
const ACCENT = "var(--fig-accent)";
const MONO = "var(--font-mono, monospace)";
const FONT = 12;
const CHAR = 7.3;

const n = (value: number) => (Math.round(value * 10) / 10).toString();
const sub = (base: string, index: string) =>
  `${base}<tspan baseline-shift="sub" font-size="9">${index}</tspan>`;

export function renderTrussFigure(spec: TrussFigureSpec): string {
  const xs = spec.joints.map((joint) => joint.x);
  const ys = spec.joints.map((joint) => joint.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, 1e-9);
  const height = Math.max(Math.max(...ys) - minY, 1e-9);
  const scale = Math.min((W - 2 * MX) / span, MAX_H / height);
  const x0 = (W - span * scale) / 2;
  const base = TOP + height * scale;
  const px = (x: number) => x0 + (x - minX) * scale;
  const py = (y: number) => base - (y - minY) * scale;
  const mid = x0 + (span * scale) / 2;
  const at = new Map(
    spec.joints.map((joint) => [
      joint.id,
      { x: px(joint.x), y: py(joint.y), low: joint.y - minY < 1e-9 * height },
    ]),
  );
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

  const arrow = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    width = 2.4,
    head = 9,
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

  // ── пръти: линията се прекъсва около надписа с усилието ──
  type Segment = { x1: number; y1: number; x2: number; y2: number };
  type Box = { cx: number; cy: number; halfW: number; halfH: number };
  const drawn = spec.members.flatMap((member) => {
    const a = at.get(member.from);
    const b = at.get(member.to);
    return a && b ? [{ member, a, b }] : [];
  });
  const segments: Segment[] = drawn.map(({ a, b }) => ({
    x1: a.x,
    y1: a.y,
    x2: b.x,
    y2: b.y,
  }));
  /** Минава ли отсечката през правоъгълника (отрязване по Лян–Барски). */
  const crosses = (segment: Segment, box: Box) => {
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    let t0 = 0;
    let t1 = 1;
    const edges: [number, number][] = [
      [-dx, segment.x1 - (box.cx - box.halfW)],
      [dx, box.cx + box.halfW - segment.x1],
      [-dy, segment.y1 - (box.cy - box.halfH)],
      [dy, box.cy + box.halfH - segment.y1],
    ];
    for (const [p, q] of edges) {
      if (Math.abs(p) < 1e-9) {
        if (q < 0) return false;
        continue;
      }
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
    return true;
  };
  const boxes: Box[] = [];
  const overlaps = (a: Box, b: Box) =>
    Math.abs(a.cx - b.cx) < a.halfW + b.halfW + 1 &&
    Math.abs(a.cy - b.cy) < a.halfH + b.halfH + 1;

  for (const [index, { member, a, b }] of drawn.entries()) {
    const force = Math.abs(member.force) < 1e-7 ? 0 : member.force;
    const label = figureNumber(force);
    const color = force > 0 ? ACCENT : force < 0 ? INK : MUTED;
    const style =
      force > 0
        ? `stroke-width="3"`
        : force < 0
          ? `stroke-width="3" stroke-dasharray="7 4"`
          : `stroke-width="1.6" stroke-dasharray="2 4"`;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / length;
    const uy = (b.y - a.y) / length;
    const halfW = (label.length * CHAR) / 2 + 3;
    const halfH = FONT / 2 + 3;
    const gap = Math.min(
      Math.abs(ux) > 1e-6 ? halfW / Math.abs(ux) : Infinity,
      Math.abs(uy) > 1e-6 ? halfH / Math.abs(uy) : Infinity,
    );
    const line = (x1: number, y1: number, x2: number, y2: number) =>
      `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${color}" ${style} stroke-linecap="butt"/>`;
    if (length > 2 * gap + 18) {
      // надписът се плъзга по пръта, докато не застъпи друг надпис или прът
      const room = gap + 9;
      const candidates = [0.5, 0.4, 0.6, 0.32, 0.68, 0.25, 0.75]
        .map((t) => t * length)
        .filter((along) => along >= room && along <= length - room);
      const boxAt = (along: number): Box => ({
        cx: a.x + ux * along,
        cy: a.y + uy * along,
        halfW,
        halfH,
      });
      const free = (box: Box) =>
        !boxes.some((other) => overlaps(box, other)) &&
        !segments.some((segment, k) => k !== index && crosses(segment, box));
      const along =
        candidates.find((item) => free(boxAt(item))) ?? length / 2;
      const box = boxAt(along);
      boxes.push(box);
      out.push(
        line(a.x, a.y, box.cx - ux * gap, box.cy - uy * gap),
        line(box.cx + ux * gap, box.cy + uy * gap, b.x, b.y),
        text(box.cx, box.cy + FONT / 2 - 2, label, color),
      );
    } else {
      // къс прът: надписът е встрани от него
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      out.push(
        line(a.x, a.y, b.x, b.y),
        text(mx - uy * 14, my + ux * 14 + 4, label, color),
      );
    }
  }

  // ── възли и букви ──
  const leftmost = Math.min(...[...at.values()].map((joint) => joint.x));
  const rightmost = Math.max(...[...at.values()].map((joint) => joint.x));
  for (const [id, joint] of at) {
    out.push(
      `<circle cx="${n(joint.x)}" cy="${n(joint.y)}" r="3.6" fill="${INK}"/>`,
    );
    const right = joint.x > mid + 1 || joint.x === rightmost;
    const outer = joint.x === leftmost || joint.x === rightmost;
    if (joint.low && !outer) {
      out.push(text(joint.x - 8, joint.y + 16, id, INK, "end", 13));
    } else {
      out.push(
        text(
          joint.x + (right ? 9 : -9),
          joint.y - 8,
          id,
          INK,
          right ? "start" : "end",
          13,
        ),
      );
    }
  }

  // ── опори ──
  for (const support of spec.supports) {
    const joint = at.get(support.joint);
    if (!joint) continue;
    const { x, y } = joint;
    if (support.type === "pinned") {
      out.push(
        `<polygon points="${n(x)},${n(y + 5)} ${n(x - 11)},${n(y + 24)} ${n(x + 11)},${n(y + 24)}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`,
        `<line x1="${n(x - 16)}" y1="${n(y + 24)}" x2="${n(x + 16)}" y2="${n(y + 24)}" stroke="${INK}" stroke-width="1.8"/>`,
      );
    } else {
      out.push(
        `<polygon points="${n(x)},${n(y + 5)} ${n(x - 11)},${n(y + 21)} ${n(x + 11)},${n(y + 21)}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`,
        `<circle cx="${n(x - 6)}" cy="${n(y + 25)}" r="2.8" fill="none" stroke="${INK}" stroke-width="1.3"/>`,
        `<circle cx="${n(x + 6)}" cy="${n(y + 25)}" r="2.8" fill="none" stroke="${INK}" stroke-width="1.3"/>`,
        `<line x1="${n(x - 16)}" y1="${n(y + 30)}" x2="${n(x + 16)}" y2="${n(y + 30)}" stroke="${INK}" stroke-width="1.8"/>`,
      );
    }
  }

  // ── товари ──
  for (const load of spec.loads) {
    const joint = at.get(load.joint);
    if (!joint) continue;
    const { x, y } = joint;
    if (load.fy !== 0) {
      const value = `${figureNumber(Math.abs(load.fy))} kN`;
      const down = load.fy < 0;
      if (joint.low) {
        // долен възел: товарът виси под него
        out.push(
          down
            ? arrow(x, y + 8, x, y + 42, LOAD)
            : arrow(x, y + 42, x, y + 8, LOAD),
          text(x, y + 56, value, LOAD),
        );
      } else {
        out.push(
          down
            ? arrow(x, y - 42, x, y - 7, LOAD)
            : arrow(x, y - 7, x, y - 42, LOAD),
          text(x, y - 48, value, LOAD),
        );
      }
    }
    if (load.fx !== 0) {
      // хоризонталната сила се чертае вдясно от възела – там няма прът
      out.push(
        load.fx > 0
          ? arrow(x + 10, y, x + 46, y, LOAD)
          : arrow(x + 46, y, x + 10, y, LOAD),
        text(
          Math.min(x + 50, W - 4 - 6 * CHAR),
          y + (x + 50 > W - 4 - 6 * CHAR ? 18 : 4),
          `${figureNumber(Math.abs(load.fx))} kN`,
          LOAD,
          "start",
        ),
      );
    }
  }

  // ── реакции: действителни посоки, до тях – големините ──
  const amount = (base_: string, index: string, value: number) =>
    value === 0
      ? `${sub(base_, index)} = 0`
      : `${sub(base_, index)} = ${figureNumber(Math.abs(value))} kN`;
  for (const reaction of spec.reactions) {
    const joint = at.get(reaction.joint);
    const support = spec.supports.find((item) => item.joint === reaction.joint);
    if (!joint || !support) continue;
    const { x, y } = joint;
    if (reaction.fy !== 0) {
      out.push(
        reaction.fy > 0
          ? arrow(x, y + 72, x, y + 36, INK)
          : arrow(x, y + 36, x, y + 72, INK),
      );
    }
    if (reaction.fx !== 0) {
      out.push(
        reaction.fx > 0
          ? arrow(x - 48, y, x - 12, y, INK)
          : arrow(x - 12, y, x - 48, y, INK),
      );
    }
    const left = x < mid;
    const tx = left ? Math.max(4, x - 30) : Math.min(W - 4, x + 30);
    const anchor = left ? "start" : "end";
    out.push(
      text(tx, y + 90, amount(reaction.joint, "v", reaction.fy), INK, anchor),
    );
    if (support.type === "pinned") {
      out.push(
        text(tx, y + 109, amount(reaction.joint, "h", reaction.fx), INK, anchor),
      );
    }
  }

  // ── легенда ──
  const legend = [
    "плътна линия – опън (+); пунктир – натиск (−)",
    "0 – нулев прът; усилията са в kN",
    "стрелките са в действителните посоки",
  ];
  legend.forEach((row, index) => {
    out.push(text(W / 2, base + 132 + index * 15, row, MUTED, "middle", 11));
  });

  const title = spec.title.replace(/[<>&"]/g, "");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Math.ceil(base + 172)}" role="img" aria-label="${title}">` +
    out.join("") +
    `</svg>`
  );
}
