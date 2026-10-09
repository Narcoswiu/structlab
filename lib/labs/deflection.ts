import {
  flexuralRigidity,
  rectangleInertia,
  standardDeflection,
  stiffnessCheck,
  toDegrees,
} from "../engineering/deflection.ts";
import type { CurveCase } from "../engineering/deflection-curve.ts";
import {
  allFinite,
  labNumber as n,
  labPrecise,
  labQuantity as q,
  type LabResult,
  type LabStep,
} from "./format.ts";

/**
 * Лаборатория „Провисване на греда“: четирите типови случая при E·I = const.
 * Сметките са в lib/engineering/deflection.ts; тук са подреждането и текстът.
 *
 * l в m; товар F в kN или q в kN/m (надолу); E в kN/cm²; I_x в cm⁴;
 * размери на сечението в cm.
 */
export type DeflectionInput = {
  scheme: CurveCase;
  l: number;
  load: number;
  E: number;
  /** как е зададен инерционният момент */
  inertiaFrom: "value" | "rect";
  I: number;
  b: number;
  h: number;
  /** допустимо провисване l/n – по условието на задачата */
  limit: number;
};

export const deflectionSchemes: {
  id: CurveCase;
  label: string;
  /** буква и мерна единица на товара */
  loadSymbol: "F" | "q";
  loadUnit: "kN" | "kN/m";
  /** формулите, както са в таблицата с типовите случаи */
  fFormula: string;
  phiFormula: string;
  /** числителят и знаменателят с числа – за разписването */
  fNumerator: (load: string, l: string) => string;
  fDivisor: number;
  phiNumerator: (load: string, l: string) => string;
  phiDivisor: number;
  phiWhere: string;
  fWhere: string;
}[] = [
  {
    id: "cantilever-force",
    label: "Конзола със сила в края",
    loadSymbol: "F",
    loadUnit: "kN",
    fFormula: "f = F·l³ / (3·E·I)",
    phiFormula: "φ = F·l² / (2·E·I)",
    fNumerator: (load, l) => `${load}·${l}³`,
    fDivisor: 3,
    phiNumerator: (load, l) => `${load}·${l}²`,
    phiDivisor: 2,
    phiWhere: "в свободния край",
    fWhere: "в свободния край",
  },
  {
    id: "cantilever-distributed",
    label: "Конзола с равномерен товар",
    loadSymbol: "q",
    loadUnit: "kN/m",
    fFormula: "f = q·l⁴ / (8·E·I)",
    phiFormula: "φ = q·l³ / (6·E·I)",
    fNumerator: (load, l) => `${load}·${l}⁴`,
    fDivisor: 8,
    phiNumerator: (load, l) => `${load}·${l}³`,
    phiDivisor: 6,
    phiWhere: "в свободния край",
    fWhere: "в свободния край",
  },
  {
    id: "simple-force-mid",
    label: "Проста греда със сила в средата",
    loadSymbol: "F",
    loadUnit: "kN",
    fFormula: "f = F·l³ / (48·E·I)",
    phiFormula: "φ = F·l² / (16·E·I)",
    fNumerator: (load, l) => `${load}·${l}³`,
    fDivisor: 48,
    phiNumerator: (load, l) => `${load}·${l}²`,
    phiDivisor: 16,
    phiWhere: "при опорите",
    fWhere: "в средата",
  },
  {
    id: "simple-distributed",
    label: "Проста греда с равномерен товар",
    loadSymbol: "q",
    loadUnit: "kN/m",
    fFormula: "f = 5·q·l⁴ / (384·E·I)",
    phiFormula: "φ = q·l³ / (24·E·I)",
    fNumerator: (load, l) => `5·${load}·${l}⁴`,
    fDivisor: 384,
    phiNumerator: (load, l) => `${load}·${l}³`,
    phiDivisor: 24,
    phiWhere: "при опорите",
    fWhere: "в средата",
  },
];

export type DeflectionSolution =
  | { ok: false; problem: string }
  | {
      ok: true;
      /** инерционен момент, cm⁴ */
      I: number;
      /** коравина, kN·m² */
      EI: number;
      /** най-голямо провисване, mm */
      fMm: number;
      /** ъгъл на завъртане, rad */
      phi: number;
      /** l/f; null, когато няма провисване */
      ratio: number | null;
      /** допустимо провисване l/n, mm */
      allowMm: number;
      /** изпълнено ли е f ≤ l/n */
      withinLimit: boolean;
      /** присъдата с думи – не само с цвят */
      verdict: string;
      results: LabResult[];
      steps: LabStep[];
    };

/** „l/220“; при много малко провисване – „под l/100 000“. */
export function spanRatioLabel(ratio: number | null): string {
  if (ratio === null) return "няма провисване";
  if (ratio > 100_000) return "под l/100 000";
  return `l/${Math.round(ratio)}`;
}

export function findDeflectionProblem(input: DeflectionInput): string | null {
  const used = input.inertiaFrom === "rect" ? [input.b, input.h] : [input.I];
  if (!allFinite([input.l, input.load, input.E, input.limit, ...used])) {
    return "Въведи числа във всички полета.";
  }
  if (!(input.l > 0)) return "Дължината трябва да е положителна.";
  if (!(input.E > 0)) return "Модулът на еластичност трябва да е положителен.";
  if (used.some((value) => !(value > 0))) {
    return "Инерционният момент и размерите трябва да са положителни.";
  }
  if (!(input.limit > 0)) return "Числото n в l/n трябва да е положително.";
  if (input.load < 0) return "Товарът е надолу – въведи положително число.";
  return null;
}

export function solveDeflection(input: DeflectionInput): DeflectionSolution {
  const problem = findDeflectionProblem(input);
  if (problem) return { ok: false, problem };
  const scheme = deflectionSchemes.find((item) => item.id === input.scheme);
  if (!scheme) return { ok: false, problem: "Непозната схема." };

  try {
    const I =
      input.inertiaFrom === "rect"
        ? rectangleInertia(input.b, input.h)
        : input.I;
    const EI = flexuralRigidity(input.E, I);
    const { f, phi } = standardDeflection(
      input.scheme,
      input.load,
      input.l,
      EI,
    );
    const fMm = f * 1000;
    const lMm = input.l * 1000;
    const allowMm = lMm / input.limit;
    const ratio = fMm > 0 ? lMm / fMm : null;
    const withinLimit = stiffnessCheck(fMm, allowMm).ok;
    if (!allFinite([I, EI, fMm, phi, allowMm, ratio ?? 0])) {
      return {
        ok: false,
        problem: "С тези числа сметката не излиза. Провери данните.",
      };
    }

    const verdict = withinLimit
      ? `Условието е изпълнено: f = ${q(fMm, "mm")} ≤ l/${n(input.limit)} = ${q(allowMm, "mm")}.`
      : `Условието не е изпълнено: f = ${q(fMm, "mm")} > l/${n(input.limit)} = ${q(allowMm, "mm")}.`;

    const results: LabResult[] = [
      {
        name: "Най-голямо провисване f",
        value: q(fMm, "mm"),
        note: `${q(fMm / 10, "cm")} – ${scheme.fWhere}`,
      },
      {
        name: "Ъгъл на завъртане φ",
        value: `${labPrecise(phi)} rad`,
        note: `${n(toDegrees(phi))}° – ${scheme.phiWhere}`,
      },
      {
        name: "Отношение l/f",
        value: spanRatioLabel(ratio),
        note: "провисването като част от дължината",
      },
      {
        name: "Допустимо провисване по условието на задачата",
        value: q(allowMm, "mm"),
        note: `l/${n(input.limit)}`,
      },
      { name: "I_x", value: q(I, "cm⁴") },
      { name: "Коравина E·I", value: q(EI, "kN·m²") },
    ];

    const load = n(input.load);
    const l = n(input.l);
    const steps: LabStep[] = [
      {
        title: "Инерционен момент",
        lines:
          input.inertiaFrom === "rect"
            ? [
                `I_x = b·h³ / 12 = ${n(input.b)}·${n(input.h)}³ / 12 = ${q(I, "cm⁴")}`,
              ]
            : [`I_x = ${q(I, "cm⁴")} – зададен направо.`],
      },
      {
        title: "Коравина на огъване E·I",
        lines: [
          `E·I = ${n(input.E)}·${n(I)} = ${q(input.E * I, "kN·cm²")}`,
          `1 m² = 10 000 cm², затова делим на 10 000: E·I = ${q(EI, "kN·m²")}`,
          "Така товарът (kN, kN/m) и дължината (m) остават в метри.",
        ],
      },
      {
        title: `Най-голямо провисване – ${scheme.fWhere}`,
        lines: [
          scheme.fFormula,
          `f = ${scheme.fNumerator(load, l)} / (${scheme.fDivisor}·${n(EI)}) = ${labPrecise(f)} m`,
          `f = ${labPrecise(f)}·1000 = ${q(fMm, "mm")} (${q(fMm / 10, "cm")})`,
        ],
      },
      {
        title: `Ъгъл на завъртане – ${scheme.phiWhere}`,
        lines: [
          scheme.phiFormula,
          `φ = ${scheme.phiNumerator(load, l)} / (${scheme.phiDivisor}·${n(EI)}) = ${labPrecise(phi)} rad`,
          `В градуси: φ·180 / π = ${n(toDegrees(phi))}°`,
        ],
      },
      {
        title: "Сравнение с допустимото провисване",
        lines: [
          `l = ${q(input.l, "m")} = ${q(lMm, "mm")}`,
          ...(ratio === null
            ? ["Няма товар – няма и провисване."]
            : [
                `l / f = ${n(lMm)} / ${n(fMm)} = ${n(ratio)}, тоест f е ${spanRatioLabel(ratio)}.`,
              ]),
          `Допустимо по условието: l / ${n(input.limit)} = ${n(lMm)} / ${n(input.limit)} = ${q(allowMm, "mm")}`,
          verdict,
          "Числото n е от условието на задачата. Лабораторията не го взима от норма.",
        ],
      },
    ];

    return {
      ok: true,
      I,
      EI,
      fMm,
      phi,
      ratio,
      allowMm,
      withinLimit,
      verdict,
      results,
      steps,
    };
  } catch {
    return {
      ok: false,
      problem: "С тези числа сметката не излиза. Провери данните.",
    };
  }
}

/** Модули на еластичност за бързия избор, kN/cm². */
export const E_STEEL = 21000;
/** Примерна стойност за дърво – така е зададена в задачите от учебника. */
export const E_TIMBER_EXAMPLE = 1100;

/** Готови примери – решените в Глава 6 на учебника. */
export const deflectionPresets: { label: string; input: DeflectionInput }[] = [
  {
    label: "Дървена греда 10×20",
    input: {
      scheme: "simple-distributed",
      l: 4,
      load: 4,
      E: E_TIMBER_EXAMPLE,
      inertiaFrom: "rect",
      I: 1943,
      b: 10,
      h: 20,
      limit: 250,
    },
  },
  {
    label: "Стоманена конзола",
    input: {
      scheme: "cantilever-force",
      l: 2,
      load: 10,
      E: E_STEEL,
      inertiaFrom: "value",
      I: 1943,
      b: 10,
      h: 20,
      limit: 250,
    },
  },
  {
    label: "Сила в средата",
    input: {
      scheme: "simple-force-mid",
      l: 3,
      load: 6,
      E: E_TIMBER_EXAMPLE,
      inertiaFrom: "rect",
      I: 1943,
      b: 8,
      h: 16,
      limit: 250,
    },
  },
  {
    label: "Конзола с товар",
    input: {
      scheme: "cantilever-distributed",
      l: 1.5,
      load: 8,
      E: E_STEEL,
      inertiaFrom: "rect",
      I: 1943,
      b: 4,
      h: 10,
      limit: 250,
    },
  },
];
