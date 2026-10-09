import { extremeStresses } from "../engineering/bending.ts";
import {
  sectionProperties,
  steinerTable,
  type Rect,
  type SectionProperties,
} from "../engineering/section.ts";
import {
  maxShearStress,
  shearShare,
  shearStressAt,
  staticMomentAbove,
  widthAt,
} from "../engineering/shear.ts";
import {
  allFinite,
  labNumber as n,
  labPrecise,
  labQuantity as q,
  toMpa,
  type LabResult,
  type LabStep,
} from "./format.ts";

/**
 * Лаборатория „Напрежения в сечение“: от размерите, M и Q до напреженията
 * σ (Навие) и τ (Журавски). Тук е само подреждането и текстът – самите
 * сметки са в lib/engineering.
 *
 * Размери в cm, M в kN·m (положителен опъва долните влакна), Q в kN.
 */
export type StressSectionKind = "rect" | "tee" | "ibeam";

export type StressInput = {
  kind: StressSectionKind;
  /** правоъгълник: ширина и височина */
  b: number;
  h: number;
  /** „Т“ и „I“: ширина и дебелина на пояса, дебелина и височина на стеблото */
  bf: number;
  tf: number;
  tw: number;
  hw: number;
  M: number;
  Q: number;
};

export type StressSolution =
  | { ok: false; problem: string }
  | {
      ok: true;
      rects: Rect[];
      props: SectionProperties;
      /** напрежения в MPa; опънът е положителен */
      sigmaTop: number;
      sigmaBottom: number;
      maxTension: number;
      maxCompression: number;
      /** най-голямото тангенциално напрежение, MPa, и нивото му (cm от долния ръб) */
      tauMax: number;
      tauY: number;
      tauAtNeutralAxis: boolean;
      /** дял на Q, поет от стеблото (0–1); само за „Т“ и „I“ */
      webShare: number | null;
      results: LabResult[];
      steps: LabStep[];
    };

/** Сечението като правоъгълници с начало в долния ляв ъгъл. */
export function buildStressSection(input: StressInput): Rect[] {
  const { kind, b, h, bf, tf, tw, hw } = input;
  if (kind === "rect") return [{ b, h, x: 0, y: 0 }];
  const web = (y: number): Rect => ({ b: tw, h: hw, x: (bf - tw) / 2, y });
  if (kind === "tee") {
    // стеблото е долу, поясът – горе (както в Глава 2)
    return [web(0), { b: bf, h: tf, x: 0, y: hw }];
  }
  return [
    { b: bf, h: tf, x: 0, y: 0 },
    web(tf),
    { b: bf, h: tf, x: 0, y: tf + hw },
  ];
}

/** Между кои нива е стеблото (cm от долния ръб). */
function webRange(input: StressInput): [number, number] | null {
  if (input.kind === "tee") return [0, input.hw];
  if (input.kind === "ibeam") return [input.tf, input.tf + input.hw];
  return null;
}

export function findStressProblem(input: StressInput): string | null {
  const sizes =
    input.kind === "rect"
      ? [input.b, input.h]
      : [input.bf, input.tf, input.tw, input.hw];
  if (!allFinite([...sizes, input.M, input.Q])) {
    return "Въведи числа във всички полета.";
  }
  if (sizes.some((size) => !(size > 0))) {
    return "Размерите на сечението трябва да са положителни.";
  }
  if (input.kind !== "rect" && !(input.tw < input.bf)) {
    return "Стеблото трябва да е по-тясно от пояса.";
  }
  return null;
}

/** Напрежение в kN/cm² с три знака (0,603) – както в учебника. */
const kn = (stress: number) => `${labPrecise(stress, 3)} kN/cm²`;

/** Число в сметка: отрицателните са в скоби, за да не се слеят знаците. */
const p = (value: number) => (value < 0 ? `(${n(value)})` : n(value));

type Piece = { A: number; d: number };

/**
 * Частите, от които се събира статичният момент S на дадено ниво: площ и
 * разстояние от центъра ѝ до неутралната ос. Взима се страната с по-малко
 * части – двете дават еднакъв по големина S.
 */
function staticMomentPieces(
  rects: Rect[],
  y: number,
  yc: number,
): { side: "над" | "под"; pieces: Piece[] } {
  const above: Piece[] = [];
  const below: Piece[] = [];
  for (const rect of rects) {
    const top = rect.y + rect.h;
    const cutLow = Math.max(rect.y, y);
    if (top - cutLow > 1e-9) {
      above.push({ A: rect.b * (top - cutLow), d: (top + cutLow) / 2 - yc });
    }
    const cutHigh = Math.min(top, y);
    if (cutHigh - rect.y > 1e-9) {
      below.push({
        A: rect.b * (cutHigh - rect.y),
        d: yc - (cutHigh + rect.y) / 2,
      });
    }
  }
  return below.length < above.length
    ? { side: "под", pieces: below }
    : { side: "над", pieces: above };
}

function inertiaLines(input: StressInput, rects: Rect[], Ix: number): string[] {
  if (input.kind === "rect") {
    return [
      `I_x = b·h³ / 12 = ${n(input.b)}·${n(input.h)}³ / 12 = ${q(Ix, "cm⁴")}`,
    ];
  }
  const terms = steinerTable(rects).map(
    (row) => `(${n(row.IxOwn)} + ${n(row.A)}·${p(row.dy)}²)`,
  );
  return [
    "По теоремата на Щайнер, за всяка част: собствен I_x + A·d².",
    `I_x = ${terms.join(" + ")} = ${q(Ix, "cm⁴")}`,
  ];
}

export function solveStresses(input: StressInput): StressSolution {
  const problem = findStressProblem(input);
  if (problem) return { ok: false, problem };

  try {
    const rects = buildStressSection(input);
    const props = sectionProperties(rects);
    const stress = extremeStresses(input.M, props);
    const peak = maxShearStress(rects, input.Q);
    const range = webRange(input);
    const webShare = range ? shearShare(rects, range[0], range[1]) : null;

    const sigmaTop = toMpa(stress.top);
    const sigmaBottom = toMpa(stress.bottom);
    const maxTension = toMpa(stress.maxTension);
    const maxCompression = toMpa(stress.maxCompression);
    const tauMax = toMpa(peak.tau);
    const tauAtNeutralAxis = Math.abs(peak.y - props.yc) < 1e-6;

    if (
      !allFinite([
        props.Ix,
        props.WxTop,
        props.WxBottom,
        sigmaTop,
        sigmaBottom,
        tauMax,
        peak.y,
        webShare ?? 0,
      ])
    ) {
      return {
        ok: false,
        problem: "С тези числа сметката не излиза. Провери размерите.",
      };
    }

    const where = (top: boolean) =>
      top ? "в горното влакно" : "в долното влакно";
    const tauWhere = tauAtNeutralAxis
      ? "на неутралната ос"
      : `на ${q(peak.y, "cm")} над долния ръб`;

    const results: LabResult[] = [
      { name: "I_x", value: q(props.Ix, "cm⁴") },
      {
        name: "Неутрална ос",
        value: q(props.yc, "cm"),
        note: "над долния ръб",
      },
      { name: "W_x горе", value: q(props.WxTop, "cm³") },
      { name: "W_x долу", value: q(props.WxBottom, "cm³") },
      {
        name: "σ_max опън",
        value: q(maxTension, "MPa"),
        note: maxTension > 0 ? where(stress.top > 0) : "няма огъващ момент",
      },
      {
        name: "σ_max натиск",
        value: q(maxCompression, "MPa"),
        note: maxCompression > 0 ? where(stress.top < 0) : "няма огъващ момент",
      },
      {
        name: "τ_max",
        value: q(tauMax, "MPa"),
        note: tauMax > 0 ? tauWhere : "няма напречна сила",
      },
    ];
    if (webShare !== null) {
      results.push({
        name: "Дял на Q в стеблото",
        value: `${n(Math.round(webShare * 100))} %`,
        note: "останалото поемат поясите",
      });
    }

    // „Покажи как се смята“
    const Mcm = input.M * 100;
    // от коя страна на нивото е ширината, дала най-голямото напрежение
    const side =
      Math.abs(shearStressAt(rects, input.Q, peak.y, "above") - peak.tau) <=
      Math.abs(shearStressAt(rects, input.Q, peak.y, "below") - peak.tau)
        ? "above"
        : "below";
    const width = widthAt(rects, peak.y, side);
    const S = Math.abs(staticMomentAbove(rects, peak.y));
    const { side: pieceSide, pieces } = staticMomentPieces(
      rects,
      peak.y,
      props.yc,
    );

    const steps: LabStep[] = [
      {
        title: "Инерционен момент и неутрална ос",
        lines: [
          `Неутралната ос минава през центъра на тежестта: на ${q(props.yc, "cm")} над долния ръб.`,
          ...inertiaLines(input, rects, props.Ix),
          `До крайните влакна: y_горе = ${q(props.yTop, "cm")}; y_долу = ${q(props.yBottom, "cm")}.`,
        ],
      },
      {
        title: "Съпротивителни моменти",
        lines: [
          `W_горе = I_x / y_горе = ${n(props.Ix)} / ${n(props.yTop)} = ${q(props.WxTop, "cm³")}`,
          `W_долу = I_x / y_долу = ${n(props.Ix)} / ${n(props.yBottom)} = ${q(props.WxBottom, "cm³")}`,
        ],
      },
      {
        title: "Нормални напрежения – формула на Навие",
        lines: [
          "σ = M·y / I_x; y се мери от неутралната ос. Положителен M опъва долните влакна.",
          `M = ${q(input.M, "kN·m")} = ${q(Mcm, "kN·cm")} (1 m = 100 cm)`,
          `σ_долу = M·y_долу / I_x = ${p(Mcm)}·${n(props.yBottom)} / ${n(props.Ix)} = ${kn(stress.bottom)} = ${q(sigmaBottom, "MPa")}${stress.bottom > 0 ? " (опън)" : stress.bottom < 0 ? " (натиск)" : ""}`,
          `σ_горе = −M·y_горе / I_x = −${p(Mcm)}·${n(props.yTop)} / ${n(props.Ix)} = ${kn(stress.top)} = ${q(sigmaTop, "MPa")}${stress.top > 0 ? " (опън)" : stress.top < 0 ? " (натиск)" : ""}`,
          "1 kN/cm² = 10 MPa.",
        ],
      },
      {
        title: "Тангенциални напрежения – формула на Журавски",
        lines: [
          "τ = Q·S / (I_x·b); S е статичният момент на частта от едната страна на нивото, b е ширината на това ниво.",
          `Най-голямото напрежение е ${tauWhere}; там b = ${q(width, "cm")}.`,
          `Частта ${pieceSide} нивото (площ · разстояние до неутралната ос): S = ${pieces.map((piece) => `${n(piece.A)}·${p(piece.d)}`).join(" + ")} = ${q(S, "cm³")}`,
          `τ_max = Q·S / (I_x·b) = ${n(Math.abs(input.Q))}·${n(S)} / (${n(props.Ix)}·${n(width)}) = ${kn(peak.tau)} = ${q(tauMax, "MPa")}`,
          ...(input.kind === "rect"
            ? [
                `Проверка за правоъгълник: τ_max = 1,5·Q / A = 1,5·${n(Math.abs(input.Q))} / ${n(props.A)} = ${kn(peak.tau)}`,
              ]
            : []),
        ],
      },
    ];
    if (webShare !== null) {
      steps.push({
        title: "Кой носи напречната сила",
        lines: [
          `Сборът на τ·b по височината на стеблото е ${n(Math.round(webShare * 100))} % от Q. Затова при такива сечения напречната сила се приписва на стеблото.`,
        ],
      });
    }
    steps.push({
      title: "За закръглението",
      lines: [
        "Междинните числа са показани закръглени до втория знак, а сметката се води с пълната им точност. Затова последната цифра може да се различава, ако пресметнеш със закръглените.",
      ],
    });

    return {
      ok: true,
      rects,
      props,
      sigmaTop,
      sigmaBottom,
      maxTension,
      maxCompression,
      tauMax,
      tauY: peak.y,
      tauAtNeutralAxis,
      webShare,
      results,
      steps,
    };
  } catch {
    return {
      ok: false,
      problem: "С тези числа сметката не излиза. Провери размерите.",
    };
  }
}

/** Готови примери – същите сечения и числа като в Глави 4 и 5. */
export const stressPresets: { label: string; input: StressInput }[] = [
  {
    label: "Правоъгълник 10×20",
    input: {
      kind: "rect",
      b: 10,
      h: 20,
      bf: 12,
      tf: 2,
      tw: 2,
      hw: 10,
      M: 8,
      Q: 8,
    },
  },
  {
    label: "Сечение „Т“",
    input: {
      kind: "tee",
      b: 10,
      h: 20,
      bf: 12,
      tf: 2,
      tw: 2,
      hw: 10,
      M: 4,
      Q: 10,
    },
  },
  {
    label: "Сечение „I“",
    input: {
      kind: "ibeam",
      b: 10,
      h: 20,
      bf: 10,
      tf: 1.2,
      tw: 0.8,
      hw: 17.6,
      M: 40,
      Q: 60,
    },
  },
];
