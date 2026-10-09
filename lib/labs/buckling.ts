import {
  allowableBucklingForce,
  circleArea,
  circleInertia,
  criticalStress,
  effectiveLengthFactor,
  eulerCriticalForce,
  isEulerValid,
  limitSlenderness,
  radiusOfGyration,
  slenderness,
  type BucklingSupport,
} from "../engineering/buckling.ts";
import { sectionProperties } from "../engineering/section.ts";
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
 * Лаборатория „Изкълчване на прът“: формула на Ойлер и границата ѝ на
 * приложимост. Сметките са в lib/engineering/buckling.ts.
 *
 * l в m; размери на сечението в cm; E в kN/cm²; σ_p в MPa.
 */
export type BucklingSectionKind = "rect" | "circle" | "tube";

export type BucklingInput = {
  support: BucklingSupport;
  l: number;
  section: BucklingSectionKind;
  /** правоъгълник */
  b: number;
  h: number;
  /** кръг: d; тръба: външен D и вътрешен d */
  D: number;
  d: number;
  E: number;
  /** граница на пропорционалност – по условието, MPa */
  sigmaP: number;
  /** коефициент на сигурност срещу изкълчване (≥ 1) */
  safety: number;
};

export const bucklingSupports: {
  id: BucklingSupport;
  label: string;
  /** описание на изкълчената форма – за надписа на схемата */
  shape: string;
}[] = [
  {
    id: "fixed-free",
    label: "Запъване – свободен край",
    shape:
      "прът, запънат долу и свободен горе; горният край се измества встрани",
  },
  {
    id: "pinned-pinned",
    label: "Шарнир – шарнир",
    shape: "прът с шарнир в двата края; изкълчва се в една полувълна",
  },
  {
    id: "fixed-pinned",
    label: "Запъване – шарнир",
    shape:
      "прът, запънат долу и с шарнир горе; най-голямото огъване е по-близо до шарнира",
  },
  {
    id: "fixed-fixed",
    label: "Запъване – запъване",
    shape: "прът, запънат в двата края; изкълчва се в средната си половина",
  },
];

export type BucklingSolution =
  | { ok: false; problem: string }
  | {
      ok: true;
      mu: number;
      /** по-малкият инерционен момент, cm⁴, и площта, cm² */
      Imin: number;
      A: number;
      /** около коя ос се изкълчва прътът – с думи */
      axis: string;
      imin: number;
      lambda: number;
      lambdaLimit: number;
      /** важи ли формулата на Ойлер (λ ≥ λ_гр) */
      valid: boolean;
      /**
       * Числото, което формулата дава, kN. Когато `valid` е false, то НЕ е
       * критичната сила на пръта и не се показва като резултат.
       */
      FcrFormula: number;
      /** σ_cr по формулата, MPa */
      sigmaFormula: number;
      /** допустима сила F_cr / n, kN; null, когато Ойлер не важи */
      allowable: number | null;
      verdict: string;
      results: LabResult[];
      steps: LabStep[];
    };

export function findBucklingProblem(input: BucklingInput): string | null {
  const sizes =
    input.section === "rect"
      ? [input.b, input.h]
      : input.section === "circle"
        ? [input.D]
        : [input.D, input.d];
  if (!allFinite([input.l, input.E, input.sigmaP, input.safety, ...sizes])) {
    return "Въведи числа във всички полета.";
  }
  if (!(input.l > 0)) return "Дължината трябва да е положителна.";
  if (sizes.some((size) => !(size > 0))) {
    return "Размерите на сечението трябва да са положителни.";
  }
  if (input.section === "tube" && !(input.d < input.D)) {
    return "Вътрешният диаметър трябва да е по-малък от външния.";
  }
  if (!(input.E > 0)) return "Модулът на еластичност трябва да е положителен.";
  if (!(input.sigmaP > 0)) {
    return "Границата на пропорционалност трябва да е положителна.";
  }
  if (!(input.safety >= 1)) {
    return "Коефициентът на сигурност трябва да е поне 1.";
  }
  return null;
}

type SectionData = {
  Imin: number;
  A: number;
  axis: string;
  lines: string[];
};

function sectionData(input: BucklingInput): SectionData {
  if (input.section === "rect") {
    const { b, h } = input;
    const props = sectionProperties([{ b, h, x: 0, y: 0 }]);
    const small = Math.min(b, h);
    const large = Math.max(b, h);
    const axis =
      b === h
        ? "двете главни оси са равностойни"
        : b < h
          ? "около оста y, успоредна на страната h (по-слабата)"
          : "около оста x, успоредна на страната b (по-слабата)";
    return {
      Imin: Math.min(props.Ix, props.Iy),
      A: props.A,
      axis,
      lines: [
        "Прътът се изкълчва около оста с по-малък инерционен момент – по-малката страна е на трета степен.",
        `I_min = ${n(large)}·${n(small)}³ / 12 = ${q(Math.min(props.Ix, props.Iy), "cm⁴")}`,
        ...(b === h
          ? []
          : [
              `За сравнение: I_max = ${n(small)}·${n(large)}³ / 12 = ${q(Math.max(props.Ix, props.Iy), "cm⁴")}`,
            ]),
        `A = ${n(b)}·${n(h)} = ${q(props.A, "cm²")}`,
      ],
    };
  }
  const inner = input.section === "tube" ? input.d : 0;
  const Imin = circleInertia(input.D, inner);
  const A = circleArea(input.D, inner);
  return {
    Imin,
    A,
    axis: "всяка ос през центъра – сечението е кръгово",
    lines:
      input.section === "tube"
        ? [
            `I = π·(D⁴ − d⁴) / 64 = π·(${n(input.D)}⁴ − ${n(input.d)}⁴) / 64 = ${q(Imin, "cm⁴")}`,
            `A = π·(D² − d²) / 4 = π·(${n(input.D)}² − ${n(input.d)}²) / 4 = ${q(A, "cm²")}`,
          ]
        : [
            `I = π·d⁴ / 64 = π·${n(input.D)}⁴ / 64 = ${q(Imin, "cm⁴")}`,
            `A = π·d² / 4 = π·${n(input.D)}² / 4 = ${q(A, "cm²")}`,
          ],
  };
}

/** Гъвкавост за показване: един знак след запетаята (101,8). */
const one = (value: number) => n(Math.round(value * 10) / 10);

export function solveBuckling(input: BucklingInput): BucklingSolution {
  const problem = findBucklingProblem(input);
  if (problem) return { ok: false, problem };

  try {
    const mu = effectiveLengthFactor(input.support);
    const lCm = input.l * 100;
    const section = sectionData(input);
    const { Imin, A } = section;
    const imin = radiusOfGyration(Imin, A);
    const lambda = slenderness(lCm, mu, imin);
    const sigmaPkN = input.sigmaP / 10;
    const lambdaLimit = limitSlenderness(input.E, sigmaPkN);
    const valid = isEulerValid(lambda, lambdaLimit);
    const FcrFormula = eulerCriticalForce(input.E, Imin, lCm, mu);
    const sigmaFormula = toMpa(criticalStress(input.E, lambda));
    const allowable = valid
      ? allowableBucklingForce(FcrFormula, input.safety)
      : null;

    if (
      !allFinite([
        Imin,
        A,
        imin,
        lambda,
        lambdaLimit,
        FcrFormula,
        sigmaFormula,
        allowable ?? 0,
      ])
    ) {
      return {
        ok: false,
        problem: "С тези числа сметката не излиза. Провери данните.",
      };
    }

    const verdict = valid
      ? `Формулата на Ойлер е приложима: λ = ${one(lambda)} ≥ λ_гр = ${one(lambdaLimit)}.`
      : `Формулата на Ойлер НЕ е приложима: λ = ${one(lambda)} < λ_гр = ${one(lambdaLimit)}. Прътът е твърде къс и дебел – критичната сила не може да се сметне по Ойлер.`;

    const results: LabResult[] = [
      { name: "I_min", value: q(Imin, "cm⁴"), note: section.axis },
      { name: "i_min", value: q(imin, "cm") },
      {
        name: "Гъвкавост λ",
        value: one(lambda),
        note: `μ = ${n(mu)}; μ·l = ${q(mu * lCm, "cm")}`,
      },
      { name: "Гранична гъвкавост λ_гр", value: one(lambdaLimit) },
      valid
        ? { name: "Критична сила F_cr", value: q(FcrFormula, "kN") }
        : {
            name: "Критична сила F_cr",
            value: "не се определя по Ойлер",
            note: "λ < λ_гр",
          },
      valid
        ? { name: "Критично напрежение σ_cr", value: q(sigmaFormula, "MPa") }
        : {
            name: "Критично напрежение σ_cr",
            value: "не се определя по Ойлер",
            note: `по формулата би излязло над σ_p = ${q(input.sigmaP, "MPa")}`,
          },
    ];
    if (allowable !== null) {
      results.push({
        name: "Допустима сила F_доп",
        value: q(allowable, "kN"),
        note: `F_cr / n при n = ${n(input.safety)}`,
      });
    }

    const pi2E = Math.PI ** 2 * input.E;
    const steps: LabStep[] = [
      { title: "Инерционен момент и площ", lines: section.lines },
      {
        title: "Радиус на инерция",
        lines: [
          `i_min = √(I_min / A) = √(${n(Imin)} / ${n(A)}) = ${q(imin, "cm")}`,
        ],
      },
      {
        title: "Гъвкавост",
        lines: [
          `l = ${q(input.l, "m")} = ${q(lCm, "cm")}; за това подпиране μ = ${n(mu)}.`,
          `Свободна дължина: μ·l = ${n(mu)}·${n(lCm)} = ${q(mu * lCm, "cm")}`,
          `λ = μ·l / i_min = ${n(mu * lCm)} / ${n(imin)} = ${one(lambda)}`,
        ],
      },
      {
        title: "Гранична гъвкавост",
        lines: [
          `σ_p = ${q(input.sigmaP, "MPa")} = ${q(sigmaPkN, "kN/cm²")} (1 kN/cm² = 10 MPa) – по условието.`,
          `λ_гр = π·√(E / σ_p) = π·√(${n(input.E)} / ${n(sigmaPkN)}) = ${one(lambdaLimit)}`,
        ],
      },
      valid
        ? {
            title: "Критична сила и напрежение",
            lines: [
              verdict,
              `π²·E = 9,8696·${n(input.E)} = ${q(pi2E, "kN/cm²")}`,
              `F_cr = π²·E·I_min / (μ·l)² = ${n(pi2E)}·${n(Imin)} / ${n(mu * lCm)}² = ${q(FcrFormula, "kN")}`,
              `σ_cr = F_cr / A = ${n(FcrFormula)} / ${n(A)} = ${labPrecise(sigmaFormula / 10, 3)} kN/cm² = ${q(sigmaFormula, "MPa")}`,
              `Проверка: σ_cr = ${q(sigmaFormula, "MPa")} ≤ σ_p = ${q(input.sigmaP, "MPa")}.`,
              ...(allowable !== null
                ? [
                    `F_доп = F_cr / n = ${n(FcrFormula)} / ${n(input.safety)} = ${q(allowable, "kN")}`,
                  ]
                : []),
            ],
          }
        : {
            title: "Защо формулата на Ойлер не важи тук",
            lines: [
              verdict,
              `Ако все пак заместим: π²·E / λ² = ${n(pi2E)} / ${one(lambda)}² = ${q(sigmaFormula, "MPa")}. Това е над σ_p = ${q(input.sigmaP, "MPa")}.`,
              "Формулата е изведена за материал, който следва закона на Хук. Над σ_p той вече не важи, затова числото не е критичната сила на пръта.",
              "За такива къси и дебели пръти критичната сила се търси с други методи – те не са част от тази лаборатория.",
            ],
          },
    ];

    return {
      ok: true,
      mu,
      Imin,
      A,
      axis: section.axis,
      imin,
      lambda,
      lambdaLimit,
      valid,
      FcrFormula,
      sigmaFormula,
      allowable,
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

const steelBar: BucklingInput = {
  support: "pinned-pinned",
  l: 1.5,
  section: "circle",
  b: 3,
  h: 6,
  D: 4,
  d: 3,
  E: 21000,
  sigmaP: 200,
  safety: 3,
};

/** Готови примери – решените в Глава 10 на учебника (стомана, σ_p = 200 MPa). */
export const bucklingPresets: { label: string; input: BucklingInput }[] = [
  { label: "Прът d = 4 cm", input: steelBar },
  {
    label: "Същият, запънат в двата края",
    input: { ...steelBar, support: "fixed-fixed" },
  },
  {
    label: "Тръба 10/8 cm",
    input: { ...steelBar, section: "tube", l: 4, D: 10, d: 8 },
  },
  {
    label: "Шина 3×6 cm",
    input: { ...steelBar, section: "rect", support: "fixed-pinned", l: 2 },
  },
];
