import {
  internalForces,
  keyPoints,
  shearZeros,
  solveReactions,
  type Beam,
} from "../engineering/beam.ts";

/**
 * Чертае схема на греда и диаграмите Q и M като SVG, направо от изчисленията –
 * така числата във фигурата не могат да се разминат с тези в текста.
 *
 * Цветовете са CSS променливи (--fig-*), които четецът задава според темата.
 * M-диаграмата е от страната на опънатите нишки: положителен M (опън долу)
 * се чертае ПОД оста.
 */
export type BeamFigureOptions = {
  /** кои части да се начертаят; по подразбиране и трите */
  parts?: ("scheme" | "Q" | "M")[];
  /** кратък надпис за екранни четци */
  title: string;
  /**
   * Само буквите на опорите, без стойностите на реакциите – за задачи, в
   * които реакциите са това, което се търси.
   */
  hideReactions?: boolean;
};

const W = 640;
const LEFT = 70;
const RIGHT = 570;
const INK = "var(--fig-ink)";
const MUTED = "var(--fig-muted)";
const LOAD = "var(--fig-load)";
const ACCENT = "var(--fig-accent)";
const FILL = "var(--fig-fill)";
const MONO = "var(--font-mono, monospace)";

/** 43.2 → „43,2“; цели числа без дробна част; без „-0“. */
export function figureNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const text = (Object.is(rounded, -0) ? 0 : rounded)
    .toFixed(2)
    .replace(/\.?0+$/, "");
  return text.replace(".", ",").replace("-", "−");
}

const n = (value: number) => (Math.round(value * 10) / 10).toString();

export function renderBeamFigure(beam: Beam, options: BeamFigureOptions): string {
  const parts = options.parts ?? ["scheme", "Q", "M"];
  const sx = (x: number) => LEFT + ((RIGHT - LEFT) * x) / beam.length;
  const reactions = solveReactions(beam);
  const out: string[] = [];
  let y = 0;

  const text = (
    x: number,
    yy: number,
    value: string,
    color: string,
    anchor: "start" | "middle" | "end" = "middle",
  ) =>
    `<text x="${n(x)}" y="${n(yy)}" fill="${color}" font-family="${MONO}" font-size="14" text-anchor="${anchor}">${value}</text>`;

  if (parts.includes("scheme")) {
    const axis = y + 110;
    // товари
    for (const load of beam.loads) {
      if (load.type === "force") {
        const x = sx(load.x);
        out.push(
          `<line x1="${n(x)}" y1="${axis - 70}" x2="${n(x)}" y2="${axis - 12}" stroke="${LOAD}" stroke-width="3"/>`,
          `<polygon points="${n(x)},${axis - 4} ${n(x - 7)},${axis - 18} ${n(x + 7)},${axis - 18}" fill="${LOAD}"/>`,
          // близо до десния край надписът минава вляво от стрелката, за да не се отреже
          x > RIGHT - 70
            ? text(x - 10, axis - 58, `F = ${figureNumber(load.value)} kN`, LOAD, "end")
            : text(x + 10, axis - 58, `F = ${figureNumber(load.value)} kN`, LOAD, "start"),
        );
      } else if (load.type === "distributed") {
        const x1 = sx(load.x1);
        const x2 = sx(load.x2);
        const top = axis - 46;
        out.push(
          `<line x1="${n(x1)}" y1="${top}" x2="${n(x2)}" y2="${top}" stroke="${LOAD}" stroke-width="2"/>`,
        );
        const count = Math.max(2, Math.round((x2 - x1) / 36));
        for (let i = 0; i <= count; i++) {
          const x = x1 + ((x2 - x1) * i) / count;
          out.push(
            `<line x1="${n(x)}" y1="${top}" x2="${n(x)}" y2="${axis - 10}" stroke="${LOAD}" stroke-width="1.5"/>`,
            `<polygon points="${n(x)},${axis - 4} ${n(x - 4)},${axis - 13} ${n(x + 4)},${axis - 13}" fill="${LOAD}"/>`,
          );
        }
        out.push(
          text((x1 + x2) / 2, top - 10, `q = ${figureNumber(load.value)} kN/m`, LOAD),
        );
      } else {
        const x = sx(load.x);
        const clockwise = load.value > 0;
        out.push(
          `<path d="M ${n(x - 16)} ${axis - 14} A 18 18 0 0 1 ${n(x + 16)} ${axis - 14}" fill="none" stroke="${LOAD}" stroke-width="2.5"/>`,
          clockwise
            ? `<polygon points="${n(x + 20)},${axis - 6} ${n(x + 9)},${axis - 15} ${n(x + 22)},${axis - 20}" fill="${LOAD}"/>`
            : `<polygon points="${n(x - 20)},${axis - 6} ${n(x - 9)},${axis - 15} ${n(x - 22)},${axis - 20}" fill="${LOAD}"/>`,
          text(x, axis - 42, `M = ${figureNumber(Math.abs(load.value))} kN·m`, LOAD),
        );
      }
    }
    // гредата и пунктираното (долно) влакно
    out.push(
      `<line x1="${LEFT}" y1="${axis}" x2="${RIGHT}" y2="${axis}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
      `<line x1="${LEFT}" y1="${axis + 8}" x2="${RIGHT}" y2="${axis + 8}" stroke="${MUTED}" stroke-width="1.2" stroke-dasharray="5 4"/>`,
    );
    // опори
    if (beam.supports.type === "simple") {
      const a = sx(beam.supports.xA);
      const b = sx(beam.supports.xB);
      out.push(
        `<polygon points="${n(a)},${axis + 12} ${n(a - 12)},${axis + 34} ${n(a + 12)},${axis + 34}" fill="none" stroke="${MUTED}" stroke-width="2"/>`,
        `<line x1="${n(a - 17)}" y1="${axis + 38}" x2="${n(a + 17)}" y2="${axis + 38}" stroke="${MUTED}" stroke-width="2"/>`,
        `<polygon points="${n(b)},${axis + 12} ${n(b - 12)},${axis + 30} ${n(b + 12)},${axis + 30}" fill="none" stroke="${MUTED}" stroke-width="2"/>`,
        `<circle cx="${n(b - 6)}" cy="${axis + 34}" r="3" fill="none" stroke="${MUTED}" stroke-width="1.5"/>`,
        `<circle cx="${n(b + 6)}" cy="${axis + 34}" r="3" fill="none" stroke="${MUTED}" stroke-width="1.5"/>`,
        `<line x1="${n(b - 17)}" y1="${axis + 40}" x2="${n(b + 17)}" y2="${axis + 40}" stroke="${MUTED}" stroke-width="2"/>`,
        text(a, axis + 58, options.hideReactions ? "A" : `A = ${figureNumber(reactions.forces[0]!.value)} kN`, MUTED),
        text(b, axis + 58, options.hideReactions ? "B" : `B = ${figureNumber(reactions.forces[1]!.value)} kN`, MUTED),
      );
    } else {
      const left = beam.supports.fixedAt === "left";
      const x = left ? LEFT : RIGHT;
      out.push(
        `<line x1="${x}" y1="${axis - 28}" x2="${x}" y2="${axis + 28}" stroke="${MUTED}" stroke-width="3"/>`,
      );
      for (let i = 0; i < 6; i++) {
        const yy = axis - 26 + i * 10;
        out.push(
          `<line x1="${x}" y1="${yy}" x2="${left ? x - 9 : x + 9}" y2="${yy + 8}" stroke="${MUTED}" stroke-width="1.5"/>`,
        );
      }
      out.push(
        text(
          left ? x + 4 : x - 4,
          axis + 58,
          options.hideReactions
            ? "A"
            : `A = ${figureNumber(reactions.forces[0]!.value)} kN;  M<tspan baseline-shift="sub" font-size="10">A</tspan> = ${figureNumber(reactions.moment!.value)} kN·m`,
          MUTED,
          left ? "start" : "end",
        ),
      );
    }
    out.push(
      text((LEFT + RIGHT) / 2, axis + 84, `L = ${figureNumber(beam.length)} m`, MUTED),
    );
    y += 210;
  }

  const diagram = (kind: "Q" | "M") => {
    const points: { x: number; v: number }[] = [];
    const stops = [...new Set([...keyPoints(beam), ...shearZeros(beam)])].sort(
      (a, b) => a - b,
    );
    for (let i = 0; i < stops.length; i++) {
      const x = stops[i]!;
      if (i > 0) points.push({ x, v: internalForces(beam, x, "left")[kind] });
      if (i < stops.length - 1) {
        points.push({ x, v: internalForces(beam, x, "right")[kind] });
        if (kind === "M") {
          // параболичните участъци се чертаят с междинни точки
          const next = stops[i + 1]!;
          for (let k = 1; k < 12; k++) {
            const xi = x + ((next - x) * k) / 12;
            points.push({ x: xi, v: internalForces(beam, xi)[kind] });
          }
        }
      }
    }
    const peak = Math.max(...points.map((p) => Math.abs(p.v)), 1e-9);
    const hasPositive = points.some((p) => p.v > 1e-9);
    const hasNegative = points.some((p) => p.v < -1e-9);
    const amp = 62;
    // Q: положителното нагоре. M: положителното (опън долу) надолу.
    const direction = kind === "Q" ? -1 : 1;
    const above = kind === "Q" ? hasPositive : hasNegative;
    const below = kind === "Q" ? hasNegative : hasPositive;
    const axis = y + 24 + (above ? amp + 18 : 6);
    const sy = (v: number) => axis + (direction * amp * v) / peak;

    const path = points.map((p) => `${n(sx(p.x))},${n(sy(p.v))}`).join(" ");
    out.push(
      text(LEFT - 12, axis + 5, kind, INK, "end"),
      `<line x1="${LEFT}" y1="${n(axis)}" x2="${RIGHT}" y2="${n(axis)}" stroke="${MUTED}" stroke-width="1.5"/>`,
      `<polygon points="${LEFT},${n(axis)} ${path} ${RIGHT},${n(axis)}" fill="${FILL}" stroke="${ACCENT}" stroke-width="2.2" stroke-linejoin="round"/>`,
    );

    // надписи: стойностите в характерните точки, без повторения и без нули
    const labelled = new Set<string>();
    for (const x of stops) {
      for (const side of ["left", "right"] as const) {
        if ((side === "left" && x === 0) || (side === "right" && x === beam.length)) continue;
        const v = internalForces(beam, x, side)[kind];
        if (Math.abs(v) < 1e-9) continue;
        const key = `${n(sx(x))}|${figureNumber(v)}`;
        if (labelled.has(key)) continue;
        labelled.add(key);
        const yy = sy(v);
        const outward = yy < axis ? -8 : 18;
        const dx = side === "left" ? -6 : 6;
        const atEdge = x === 0 ? "start" : x === beam.length ? "end" : side === "left" ? "end" : "start";
        out.push(
          `<circle cx="${n(sx(x))}" cy="${n(yy)}" r="3.5" fill="${LOAD}"/>`,
          text(sx(x) + (x === 0 || x === beam.length ? 0 : dx), yy + outward, figureNumber(kind === "M" ? Math.abs(v) : v), ACCENT, atEdge),
        );
      }
    }
    if (kind === "Q") {
      if (hasPositive) out.push(text(RIGHT + 14, axis - 12, "⊕", MUTED, "start"));
      if (hasNegative) out.push(text(RIGHT + 14, axis + 22, "⊖", MUTED, "start"));
    }
    out.push(
      text(RIGHT + 14, axis + 5, kind === "Q" ? "kN" : "kN·m", MUTED, "start"),
    );
    y = axis + (below ? amp + 30 : 22);
  };

  if (parts.includes("Q")) diagram("Q");
  if (parts.includes("M")) diagram("M");

  const title = options.title.replace(/[<>&"]/g, "");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Math.ceil(y + 6)}" role="img" aria-label="${title}">` +
    out.join("") +
    `</svg>`
  );
}
