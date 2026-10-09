import {
  criticalStress,
  limitSlenderness,
  type BucklingSupport,
} from "../engineering/buckling.ts";
import { figureNumber } from "./beam-figure.ts";

/**
 * Фигури за изкълчване: малка схема на изкълчената форма за всеки от
 * четирите случая на подпиране и кривата σ_cr(λ) с точката на пръта.
 */

const INK = "var(--fig-ink)";
const MUTED = "var(--fig-muted)";
const LOAD = "var(--fig-load)";
const ACCENT = "var(--fig-accent)";
const FILL = "var(--fig-fill)";
const MONO = "var(--font-mono, monospace)";

const n = (value: number) => (Math.round(value * 10) / 10).toString();
const clean = (title: string) => title.replace(/[<>&"]/g, "");

/** Корен на tg x = x – за случая запъване–шарнир. */
const K_FIXED_PINNED = 4.493409457909064;
/** Най-голямата стойност на sin(k·s) − s·sin k: при cos(k·s) = sin k / k. */
const FIXED_PINNED_PEAK = (() => {
  const s = Math.acos(Math.sin(K_FIXED_PINNED) / K_FIXED_PINNED) / K_FIXED_PINNED;
  return Math.sin(K_FIXED_PINNED * s) - s * Math.sin(K_FIXED_PINNED);
})();

/**
 * Формата на изкълчване w(ξ), ξ = 0 в долния край, ξ = 1 в горния;
 * най-голямата стойност е 1.
 */
export function bucklingShape(support: BucklingSupport, xi: number): number {
  switch (support) {
    case "pinned-pinned":
      return Math.sin(Math.PI * xi);
    case "fixed-free":
      return 1 - Math.cos((Math.PI * xi) / 2);
    case "fixed-fixed":
      return (1 - Math.cos(2 * Math.PI * xi)) / 2;
    case "fixed-pinned": {
      // s се мери от шарнира горе: w = sin(k·s) − s·sin k, нормирана
      const s = 1 - xi;
      const w = Math.sin(K_FIXED_PINNED * s) - s * Math.sin(K_FIXED_PINNED);
      return w / FIXED_PINNED_PEAK;
    }
    default:
      throw new Error("Непознат случай на подпиране.");
  }
}

/** Схема на пръта: долу и горе – опорите, пунктир – правата ос, крива – изкълчената форма. */
export function renderBucklingModeFigure(
  support: BucklingSupport,
  title: string,
): string {
  const cx = 52;
  const top = 46;
  const bottom = 176;
  const amp = 26;
  const px = (xi: number) => cx + amp * bucklingShape(support, xi);
  const py = (xi: number) => bottom - (bottom - top) * xi;
  const out: string[] = [];

  const hatch = (y: number, direction: 1 | -1) => {
    out.push(
      `<line x1="${cx - 22}" y1="${y}" x2="${cx + 22}" y2="${y}" stroke="${INK}" stroke-width="2.4"/>`,
    );
    for (let k = 0; k < 5; k++) {
      const x = cx - 18 + k * 9;
      out.push(
        `<line x1="${x}" y1="${y}" x2="${x - 6}" y2="${y + 7 * direction}" stroke="${MUTED}" stroke-width="1.2"/>`,
      );
    }
  };

  // долна опора
  if (support === "pinned-pinned") {
    out.push(
      `<polygon points="${cx},${bottom} ${cx - 10},${bottom + 14} ${cx + 10},${bottom + 14}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`,
    );
    hatch(bottom + 14, 1);
  } else {
    hatch(bottom, 1);
  }

  // горна опора
  const topX = px(1);
  if (support === "fixed-fixed") {
    hatch(top, -1);
  } else if (support !== "fixed-free") {
    // шарнир, който не позволява странично изместване
    out.push(
      `<line x1="${cx - 12}" y1="${top - 9}" x2="${cx - 12}" y2="${top + 9}" stroke="${INK}" stroke-width="1.8"/>`,
      `<line x1="${cx + 12}" y1="${top - 9}" x2="${cx + 12}" y2="${top + 9}" stroke="${INK}" stroke-width="1.8"/>`,
    );
  }

  // правата ос и изкълчената форма
  out.push(
    `<line x1="${cx}" y1="${top}" x2="${cx}" y2="${bottom}" stroke="${MUTED}" stroke-width="1.4" stroke-dasharray="5 4"/>`,
  );
  const points: string[] = [];
  for (let k = 0; k <= 40; k++) {
    points.push(`${n(px(k / 40))},${n(py(k / 40))}`);
  }
  out.push(
    `<polyline points="${points.join(" ")}" fill="none" stroke="${ACCENT}" stroke-width="3" stroke-linecap="round"/>`,
  );
  if (support === "pinned-pinned" || support === "fixed-pinned") {
    out.push(
      `<circle cx="${n(topX)}" cy="${top}" r="4" fill="${FILL}" stroke="${INK}" stroke-width="1.6"/>`,
    );
  }
  if (support === "pinned-pinned") {
    out.push(
      `<circle cx="${cx}" cy="${bottom}" r="4" fill="${FILL}" stroke="${INK}" stroke-width="1.6"/>`,
    );
  }

  // натисковата сила
  const arrowTip = support === "fixed-fixed" ? top - 10 : top - 6;
  out.push(
    `<line x1="${n(topX)}" y1="8" x2="${n(topX)}" y2="${arrowTip - 8}" stroke="${LOAD}" stroke-width="2.6"/>`,
    `<polygon points="${n(topX)},${arrowTip} ${n(topX - 5)},${arrowTip - 11} ${n(topX + 5)},${arrowTip - 11}" fill="${LOAD}"/>`,
    `<text x="${n(topX + 10)}" y="20" fill="${LOAD}" font-family="${MONO}" font-size="14">F</text>`,
  );

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 200" role="img" aria-label="${clean(title)}">` +
    out.join("") +
    `</svg>`
  );
}

export type BucklingCurveFigureSpec = {
  title: string;
  /** модул на еластичност, kN/cm² */
  E: number;
  /** граница на пропорционалност, MPa */
  sigmaP: number;
  /** гъвкавост на пръта */
  lambda: number;
};

/**
 * Кривата σ_cr(λ) = π²·E/λ² (хиперболата на Ойлер). Вдясно от λ_гр тя важи
 * (плътна линия); вляво напрежението надхвърля σ_p и формулата не важи
 * (пунктир). Точката на пръта е кръг, когато Ойлер важи, и кръстче, когато не.
 */
export function renderBucklingCurveFigure(spec: BucklingCurveFigureSpec): string {
  const { E, sigmaP, lambda } = spec;
  const limit = limitSlenderness(E, sigmaP / 10);
  const sigma = criticalStress(E, lambda) * 10; // MPa
  const valid = lambda >= limit;

  const W = 480;
  const H = 340;
  const x0 = 56;
  const x1 = 446;
  const y0 = 270;
  const y1 = 58;
  const lambdaMax = Math.max(
    250,
    Math.ceil((1.25 * Math.max(lambda, limit)) / 50) * 50,
  );
  const sigmaMax = 1.6 * sigmaP;
  const sx = (value: number) => x0 + ((x1 - x0) * value) / lambdaMax;
  const sy = (value: number) =>
    y0 - ((y0 - y1) * Math.min(value, sigmaMax)) / sigmaMax;
  const euler = (value: number) => criticalStress(E, value) * 10;

  const out: string[] = [];
  const text = (
    x: number,
    y: number,
    value: string,
    color: string,
    anchor: "start" | "middle" | "end" = "start",
    size = 13,
  ) =>
    `<text x="${n(x)}" y="${n(y)}" fill="${color}" font-family="${MONO}" font-size="${size}" text-anchor="${anchor}">${value}</text>`;

  // областта, в която формулата важи
  out.push(
    `<rect x="${n(sx(limit))}" y="${y1}" width="${n(x1 - sx(limit))}" height="${y0 - y1}" fill="${FILL}"/>`,
  );

  // оси
  out.push(
    `<line x1="${x0}" y1="${y0}" x2="${x1 + 12}" y2="${y0}" stroke="${INK}" stroke-width="1.6"/>`,
    `<line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1 - 14}" stroke="${INK}" stroke-width="1.6"/>`,
    text(x1 + 18, y0 + 5, "λ", INK, "start", 14),
    text(x0 - 8, y1 - 36, "σ_cr, MPa", INK, "start"),
    text(x0, y0 + 18, "0", MUTED, "middle"),
    text(x1, y0 + 18, figureNumber(lambdaMax), MUTED, "middle"),
  );

  // граница на пропорционалност и гранична гъвкавост
  out.push(
    `<line x1="${x0}" y1="${n(sy(sigmaP))}" x2="${x1}" y2="${n(sy(sigmaP))}" stroke="${LOAD}" stroke-width="1.4" stroke-dasharray="7 4"/>`,
    text(x1, sy(sigmaP) - 7, `σ_p = ${figureNumber(sigmaP)} MPa`, LOAD, "end"),
    `<line x1="${n(sx(limit))}" y1="${y0}" x2="${n(sx(limit))}" y2="${y1}" stroke="${LOAD}" stroke-width="1.4" stroke-dasharray="7 4"/>`,
    text(
      // вдясно от линията: кръстчето на къс прът е винаги вляво от нея
      sx(limit) + 6,
      y1 - 8,
      `λ_гр = ${figureNumber(Math.round(limit * 10) / 10)}`,
      LOAD,
      "start",
    ),
  );

  // хиперболата: пунктир до λ_гр, плътна след нея
  const from = Math.sqrt((Math.PI ** 2 * E * 10) / sigmaMax);
  const curve = (a: number, b: number) => {
    const points: string[] = [];
    for (let k = 0; k <= 48; k++) {
      const value = a + ((b - a) * k) / 48;
      points.push(`${n(sx(value))},${n(sy(euler(value)))}`);
    }
    return points.join(" ");
  };
  if (from < limit) {
    out.push(
      `<polyline points="${curve(from, Math.min(limit, lambdaMax))}" fill="none" stroke="${MUTED}" stroke-width="2" stroke-dasharray="4 5"/>`,
    );
  }
  if (limit < lambdaMax) {
    out.push(
      `<polyline points="${curve(limit, lambdaMax)}" fill="none" stroke="${ACCENT}" stroke-width="2.6"/>`,
    );
  }

  // надписи на двете области – до оста, където кривата не минава
  if (x1 - sx(limit) >= 90) {
    out.push(text(sx(limit) + 10, y0 - 9, "Ойлер важи", ACCENT, "start", 12));
  }
  if (sx(limit) - x0 >= 70) {
    out.push(text(sx(limit) - 10, y0 - 9, "не важи", MUTED, "end", 12));
  }

  // точката на пръта
  const px = Math.min(sx(lambda), x1);
  const py = sy(sigma);
  if (valid) {
    out.push(
      `<circle cx="${n(px)}" cy="${n(py)}" r="6" fill="${ACCENT}" stroke="${INK}" stroke-width="1.6"/>`,
    );
  } else {
    out.push(
      `<line x1="${n(px - 7)}" y1="${n(py - 7)}" x2="${n(px + 7)}" y2="${n(py + 7)}" stroke="${INK}" stroke-width="3"/>`,
      `<line x1="${n(px - 7)}" y1="${n(py + 7)}" x2="${n(px + 7)}" y2="${n(py - 7)}" stroke="${INK}" stroke-width="3"/>`,
    );
  }
  const label = valid
    ? `прътът: λ = ${figureNumber(Math.round(lambda * 10) / 10)}; σ_cr = ${figureNumber(Math.round(sigma * 10) / 10)} MPa`
    : `прътът: λ = ${figureNumber(Math.round(lambda * 10) / 10)} – Ойлер не важи`;
  out.push(
    text(W / 2, H - 32, label, INK, "middle"),
    text(
      W / 2,
      H - 10,
      "кръг – прътът е в областта на Ойлер; кръстче – извън нея",
      MUTED,
      "middle",
      12,
    ),
  );

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${clean(spec.title)}">` +
    out.join("") +
    `</svg>`
  );
}
