import {
  equilibriumResiduals,
  loadResultant,
  solveSupportReactions,
  supportConstraints,
  type PlaneLoad,
  type PlaneSupports,
} from "../engineering/plane-body.ts";
import {
  allFinite,
  joinTerms,
  labNumber as n,
  labQuantity as q,
  signedTerm,
  snapZero,
  type LabResult,
  type LabStep,
  type LabTerm,
} from "./format.ts";

/**
 * Лаборатория „Опорни реакции“: хоризонтална греда с неподвижна опора A и
 * подвижна опора B, или със запъване в левия край. Сметките са в
 * lib/engineering/plane-body.ts; тук са подреждането и текстът.
 *
 * Знаци (както в „Теоретична механика – I част“): x надясно, y нагоре;
 * момент обратно на часовниковата стрелка = плюс. Приети посоки на
 * реакциите: A_h надясно, A_v и B_v нагоре, M_A обратно на часовниковата.
 * Отрицателна стойност значи обратна посока. Дължини в m, сили в kN.
 */
export type InclinedDirection =
  "down-right" | "down-left" | "up-right" | "up-left";

export type ReactionLoad =
  /** наклонена сила: големина F, ъгъл спрямо хоризонталата (0–90°) и накъде сочи */
  | {
      kind: "inclined";
      F: number;
      angle: number;
      direction: InclinedDirection;
      x: number;
    }
  /** вертикална сила, насочена надолу */
  | { kind: "vertical"; F: number; x: number }
  /** двоица (момент); M > 0 върти обратно на часовниковата стрелка */
  | { kind: "couple"; M: number; x: number }
  /** равномерен товар надолу върху участъка from–to */
  | { kind: "uniform"; q: number; from: number; to: number }
  /** триъгълен товар надолу: нула при zeroAt, интензивност q при peakAt */
  | { kind: "triangular"; q: number; zeroAt: number; peakAt: number };

export type ReactionsScheme = "pin-roller" | "fixed";

export type ReactionsInput = {
  scheme: ReactionsScheme;
  /** дължина на гредата, m */
  l: number;
  /** места на опорите (при запъване не се ползват – то е в левия край) */
  xA: number;
  xB: number;
  loads: ReactionLoad[];
};

export const MAX_REACTION_LOADS = 5;

export const reactionsSchemes: { id: ReactionsScheme; label: string }[] = [
  { id: "pin-roller", label: "Две опори: A и B" },
  { id: "fixed", label: "Запъване вляво" },
];

export const reactionLoadKinds: {
  id: ReactionLoad["kind"];
  label: string;
}[] = [
  { id: "inclined", label: "Наклонена сила" },
  { id: "vertical", label: "Вертикална сила" },
  { id: "couple", label: "Момент (двоица)" },
  { id: "uniform", label: "Равномерен товар" },
  { id: "triangular", label: "Триъгълен товар" },
];

export const inclinedDirections: {
  id: InclinedDirection;
  label: string;
  /** знаци на проекциите по x и по y */
  sx: 1 | -1;
  sy: 1 | -1;
}[] = [
  { id: "down-right", label: "надолу и надясно ↘", sx: 1, sy: -1 },
  { id: "down-left", label: "надолу и наляво ↙", sx: -1, sy: -1 },
  { id: "up-right", label: "нагоре и надясно ↗", sx: 1, sy: 1 },
  { id: "up-left", label: "нагоре и наляво ↖", sx: -1, sy: 1 },
];

/** Ъгълът спрямо оста x (обратно на часовниковата), както го иска plane-body. */
export function inclinedAngleDeg(
  angle: number,
  direction: InclinedDirection,
): number {
  switch (direction) {
    case "down-right":
      return -angle;
    case "down-left":
      return 180 + angle;
    case "up-right":
      return angle;
    case "up-left":
      return 180 - angle;
  }
}

/** Нов товар с разумни начални стойности за греда с дължина l. */
export function defaultReactionLoad(
  kind: ReactionLoad["kind"],
  l: number,
): ReactionLoad {
  const mid = Math.round((l / 2) * 100) / 100;
  switch (kind) {
    case "inclined":
      return { kind, F: 10, angle: 45, direction: "down-right", x: mid };
    case "vertical":
      return { kind, F: 10, x: mid };
    case "couple":
      return { kind, M: 10, x: mid };
    case "uniform":
      return { kind, q: 5, from: 0, to: l };
    case "triangular":
      return { kind, q: 5, zeroAt: 0, peakAt: l };
  }
}

export function toPlaneLoad(load: ReactionLoad): PlaneLoad {
  switch (load.kind) {
    case "inclined":
      return {
        type: "inclined",
        x: load.x,
        y: 0,
        magnitude: load.F,
        angleDeg: inclinedAngleDeg(load.angle, load.direction),
      };
    case "vertical":
      return { type: "force", x: load.x, y: 0, fx: 0, fy: -load.F };
    case "couple":
      return { type: "couple", value: load.M };
    case "uniform":
      return {
        type: "uniform",
        from: { x: Math.min(load.from, load.to), y: 0 },
        to: { x: Math.max(load.from, load.to), y: 0 },
        q: load.q,
      };
    case "triangular":
      return {
        type: "triangular",
        from: { x: load.zeroAt, y: 0 },
        to: { x: load.peakAt, y: 0 },
        q: load.q,
      };
  }
}

export function toPlaneSupports(input: ReactionsInput): PlaneSupports {
  return input.scheme === "fixed"
    ? { type: "fixed", at: { x: 0, y: 0 } }
    : {
        type: "pin-roller",
        pin: { x: input.xA, y: 0 },
        roller: { x: input.xB, y: 0 },
      };
}

export type ReactionsSolution =
  | { ok: false; problem: string }
  | {
      ok: true;
      /** kN; плюс = надясно / нагоре */
      Ah: number;
      Av: number;
      /** null при запъване */
      Bv: number | null;
      /** kN·m, плюс = обратно на часовниковата; null при две опори */
      MA: number | null;
      /** независимата проверка: ΣM спрямо точка, която не е ползвана */
      check: { point: "B" | "K"; x: number; moment: number };
      balanced: boolean;
      verdict: string;
      results: LabResult[];
      steps: LabStep[];
    };

export function findReactionsProblem(input: ReactionsInput): string | null {
  const { l, xA, xB, loads } = input;
  if (!allFinite([l, xA, xB])) return "Въведи числа във всички полета.";
  if (!(l > 0)) return "Дължината на гредата трябва да е положителна.";
  const inside = (x: number) => x >= -1e-9 && x <= l + 1e-9;
  const range = `от 0 до ${n(l)} m`;
  if (input.scheme === "pin-roller") {
    if (!inside(xA)) return `Опората A е извън гредата (${range}).`;
    if (!inside(xB)) return `Опората B е извън гредата (${range}).`;
    if (Math.abs(xA - xB) < 1e-6) {
      return "Двете опори са в една точка – гредата може да се завърти около нея. Раздалечи опорите A и B.";
    }
  }
  if (loads.length > MAX_REACTION_LOADS) {
    return `Най-много ${MAX_REACTION_LOADS} товара.`;
  }
  for (const [index, load] of loads.entries()) {
    const name = `Товар ${index + 1}`;
    const outside = `${name}: мястото е извън гредата (${range}).`;
    switch (load.kind) {
      case "inclined":
        if (!allFinite([load.F, load.angle, load.x]))
          return `${name}: въведи числа.`;
        if (load.F < 0)
          return `${name}: големината на силата не може да е отрицателна.`;
        if (load.angle < 0 || load.angle > 90) {
          return `${name}: ъгълът спрямо хоризонталата е от 0 до 90°.`;
        }
        if (!inside(load.x)) return outside;
        break;
      case "vertical":
        if (!allFinite([load.F, load.x])) return `${name}: въведи числа.`;
        if (load.F < 0) {
          return `${name}: силата е надолу – въведи положително число. За сила нагоре избери наклонена сила под 90°.`;
        }
        if (!inside(load.x)) return outside;
        break;
      case "couple":
        if (!allFinite([load.M, load.x])) return `${name}: въведи числа.`;
        if (!inside(load.x)) return outside;
        break;
      case "uniform":
        if (!allFinite([load.q, load.from, load.to]))
          return `${name}: въведи числа.`;
        if (load.q < 0)
          return `${name}: товарът е надолу – въведи положително число.`;
        if (!inside(load.from) || !inside(load.to)) return outside;
        if (Math.abs(load.from - load.to) < 1e-6) {
          return `${name}: разпределеният товар трябва да има дължина – началото и краят му съвпадат.`;
        }
        break;
      case "triangular":
        if (!allFinite([load.q, load.zeroAt, load.peakAt]))
          return `${name}: въведи числа.`;
        if (load.q < 0)
          return `${name}: товарът е надолу – въведи положително число.`;
        if (!inside(load.zeroAt) || !inside(load.peakAt)) return outside;
        if (Math.abs(load.zeroAt - load.peakAt) < 1e-6) {
          return `${name}: разпределеният товар трябва да има дължина – началото и краят му съвпадат.`;
        }
        break;
    }
  }
  return null;
}

/** Товар, сведен до сила с проекции в точка x и/или момент. */
type Item = {
  load: ReactionLoad;
  /** означение в сметките: „F“, „F_2“, „R_q“, „R_q1“, „M“… */
  symbol: string;
  fx: number;
  fy: number;
  x: number;
  couple: number;
};

function toItems(loads: ReactionLoad[]): Item[] {
  const count = (kinds: ReactionLoad["kind"][]) =>
    loads.filter((load) => kinds.includes(load.kind)).length;
  const groups: { kinds: ReactionLoad["kind"][]; base: string }[] = [
    { kinds: ["inclined", "vertical"], base: "F" },
    { kinds: ["uniform", "triangular"], base: "R_q" },
    { kinds: ["couple"], base: "M" },
  ];
  const seen = new Map<string, number>();
  return loads.map((load) => {
    const group = groups.find((item) => item.kinds.includes(load.kind))!;
    const order = (seen.get(group.base) ?? 0) + 1;
    seen.set(group.base, order);
    const many = count(group.kinds) > 1;
    const symbol = !many
      ? group.base
      : group.base === "R_q"
        ? `R_q${order}`
        : `${group.base}_${order}`;
    const resultant = loadResultant(toPlaneLoad(load));
    return {
      load,
      symbol,
      fx: snapZero(resultant.fx),
      fy: snapZero(resultant.fy),
      x: resultant.at.x,
      couple: resultant.couple,
    };
  });
}

/** Събираемите на ΣM спрямо точка с абсциса px: моменти на силите и двоиците. */
function momentTerms(items: Item[], px: number): LabTerm[] {
  const terms: LabTerm[] = [];
  for (const item of items) {
    if (item.couple !== 0) {
      terms.push(signedTerm(item.couple, n(Math.abs(item.couple))));
    }
    const arm = snapZero(item.x - px);
    if (item.fy !== 0 && arm !== 0) {
      terms.push(
        signedTerm(
          item.fy * arm,
          `${n(Math.abs(item.fy))}·${n(Math.abs(arm))}`,
        ),
      );
    }
  }
  return terms;
}

const sumMoments = (items: Item[], px: number) =>
  items.reduce((sum, item) => sum + item.couple + item.fy * (item.x - px), 0);

/** „F_x“ за единствена сила, „F_1x“ за номерирана. */
const projection = (symbol: string, axis: "x" | "y") =>
  symbol.includes("_") ? `${symbol}${axis}` : `${symbol}_${axis}`;

function resultantSteps(items: Item[]): LabStep[] {
  const steps: LabStep[] = [];
  const distributed = items.filter(
    (item) => item.load.kind === "uniform" || item.load.kind === "triangular",
  );
  if (distributed.length > 0) {
    const lines: string[] = [
      "Разпределеният товар се замества с една сила – равнодействащата му.",
    ];
    for (const item of distributed) {
      const { load, symbol } = item;
      if (load.kind === "uniform") {
        const from = Math.min(load.from, load.to);
        const a = Math.abs(load.to - load.from);
        lines.push(
          `${symbol} = q·a = ${n(load.q)}·${n(a)} = ${q(Math.abs(item.fy), "kN")}`,
          `${symbol} действа в средата на участъка: x = ${n(from)} + ${n(a)} / 2 = ${q(item.x, "m")}.`,
        );
      } else if (load.kind === "triangular") {
        const a = Math.abs(load.peakAt - load.zeroAt);
        const toRight = load.peakAt > load.zeroAt;
        lines.push(
          `${symbol} = q·a / 2 = ${n(load.q)}·${n(a)} / 2 = ${q(Math.abs(item.fy), "kN")}`,
          `${symbol} е на 2/3 от нулевия край: x = ${n(load.zeroAt)} ${toRight ? "+" : "−"} 2/3·${n(a)} = ${q(item.x, "m")}.`,
        );
      }
    }
    steps.push({ title: "Равнодействащи на разпределените товари", lines });
  }

  const inclined = items.filter((item) => item.load.kind === "inclined");
  if (inclined.length > 0) {
    const lines: string[] = [];
    for (const item of inclined) {
      if (item.load.kind !== "inclined") continue;
      const { F, angle } = item.load;
      const fxName = projection(item.symbol, "x");
      const fyName = projection(item.symbol, "y");
      lines.push(
        `${fxName} = ${item.symbol}·cos α = ${n(F)}·cos ${n(angle)}° = ${q(Math.abs(item.fx), "kN")}${item.fx === 0 ? "" : item.fx > 0 ? " (надясно)" : " (наляво)"}`,
        `${fyName} = ${item.symbol}·sin α = ${n(F)}·sin ${n(angle)}° = ${q(Math.abs(item.fy), "kN")}${item.fy === 0 ? "" : item.fy > 0 ? " (нагоре)" : " (надолу)"}`,
      );
    }
    steps.push({ title: "Проекции на наклонените сили", lines });
  }
  return steps;
}

export function solveReactions(input: ReactionsInput): ReactionsSolution {
  const problem = findReactionsProblem(input);
  if (problem) return { ok: false, problem };

  try {
    const fixed = input.scheme === "fixed";
    const supports = toPlaneSupports(input);
    const planeLoads = input.loads.map(toPlaneLoad);
    const raw = solveSupportReactions(supports, planeLoads);
    const checkX = fixed ? input.l : input.xB;
    const residual = equilibriumResiduals(
      { constraints: supportConstraints(supports), loads: planeLoads },
      [raw.Ah, raw.Av, fixed ? raw.MA! : raw.B!],
      { x: checkX, y: 0 },
    );
    const Ah = snapZero(raw.Ah);
    const Av = snapZero(raw.Av);
    const Bv = fixed ? null : snapZero(raw.Bv);
    const MA = fixed ? snapZero(raw.MA ?? 0) : null;
    if (!allFinite([Ah, Av, Bv ?? 0, MA ?? 0, residual.moment])) {
      return {
        ok: false,
        problem: "С тези числа сметката не излиза. Провери данните.",
      };
    }

    const items = toItems(input.loads);
    const scale = Math.max(
      1,
      ...items.map(
        (item) => Math.abs(item.fy) * input.l + Math.abs(item.couple),
      ),
    );
    const balanced = Math.abs(residual.moment) < 1e-7 * scale;
    const moment = balanced ? 0 : residual.moment;
    const point = fixed ? "K" : "B";
    const verdict = balanced
      ? `Проверката излиза: ΣM_${point} = 0 – гредата е в равновесие.`
      : `Проверката не излиза: ΣM_${point} = ${q(moment, "kN·m")}.`;

    const horizontal = (value: number) =>
      value > 0
        ? "надясно"
        : value < 0
          ? "наляво – обратно на приетата посока"
          : "няма хоризонтален товар";
    const vertical = (value: number) =>
      value > 0
        ? "нагоре"
        : value < 0
          ? "надолу – обратно на приетата посока"
          : "опората не е натоварена";
    const results: LabResult[] = [
      { name: "A_h", value: q(Ah, "kN"), note: horizontal(Ah) },
      { name: "A_v", value: q(Av, "kN"), note: vertical(Av) },
    ];
    if (Bv !== null) {
      results.push({ name: "B_v", value: q(Bv, "kN"), note: vertical(Bv) });
    }
    if (MA !== null) {
      results.push({
        name: "M_A",
        value: q(MA, "kN·m"),
        note:
          MA > 0
            ? "обратно на часовниковата стрелка"
            : MA < 0
              ? "по часовниковата стрелка – обратно на приетата посока"
              : "няма момент в запъването",
      });
    }
    results.push({
      name: `Проверка ΣM_${point}`,
      value: q(moment, "kN·m"),
      note: fixed
        ? "спрямо свободния край K"
        : "спрямо опората B – точка, която не е ползвана",
    });

    // ── сметките, в реда, в който се решават на ръка ──
    const steps: LabStep[] = [
      {
        title: "Приети посоки и знаци",
        lines: [
          fixed
            ? "Запъването дава три реакции: A_h (надясно), A_v (нагоре) и момент M_A (обратно на часовниковата стрелка)."
            : "Неподвижната опора A дава A_h (надясно) и A_v (нагоре). Подвижната опора B дава само B_v (нагоре).",
          "Проекции: надясно и нагоре са плюс. Моменти: обратно на часовниковата стрелка е плюс.",
          "Ако реакция излезе с минус, тя действа обратно на приетата посока.",
        ],
      },
      ...resultantSteps(items),
    ];

    const horizontalTerms: LabTerm[] = [
      { sign: 1, text: "A_h" },
      ...items
        .filter((item) => item.fx !== 0)
        .map((item) => signedTerm(item.fx, n(Math.abs(item.fx)))),
    ];
    steps.push({
      title: "Проекции по x: хоризонталната реакция в A",
      lines: [
        `ΣF_x = ${joinTerms(horizontalTerms)} = 0`,
        horizontalTerms.length === 1
          ? "A_h = 0 kN – няма хоризонтални товари."
          : `A_h = ${q(Ah, "kN")}`,
      ],
    });

    const verticalLoads = items
      .filter((item) => item.fy !== 0)
      .map((item) => signedTerm(item.fy, n(Math.abs(item.fy))));

    if (!fixed && Bv !== null) {
      const span = input.xB - input.xA;
      const loadMoment = sumMoments(items, input.xA);
      steps.push({
        title: "Моменти спрямо A: реакцията в B",
        lines: [
          "Моментите са спрямо A: там рамото на A_h и A_v е нула и остава само B_v.",
          `ΣM_A = ${joinTerms([signedTerm(span, `B_v·${n(Math.abs(span))}`), ...momentTerms(items, input.xA)])} = 0`,
          Bv === 0
            ? "B_v = 0 kN"
            : `B_v = ${n(-loadMoment)} / ${span < 0 ? `(${n(span)})` : n(span)} = ${q(Bv, "kN")}`,
        ],
      });
      steps.push({
        title: "Проекции по y: вертикалната реакция в A",
        lines: [
          `ΣF_y = ${joinTerms([
            { sign: 1, text: "A_v" },
            ...(Bv === 0 ? [] : [signedTerm(Bv, n(Math.abs(Bv)))]),
            ...verticalLoads,
          ])} = 0`,
          `A_v = ${q(Av, "kN")}`,
        ],
      });
      const lever = input.xA - input.xB;
      steps.push({
        title: "Проверка: моменти спрямо B",
        lines: [
          "Уравнение, което не е ползвано досега – моменти спрямо B.",
          `ΣM_B = ${joinTerms([
            ...(Av === 0
              ? []
              : [
                  signedTerm(
                    Av * lever,
                    `${n(Math.abs(Av))}·${n(Math.abs(lever))}`,
                  ),
                ]),
            ...momentTerms(items, input.xB),
          ])} = ${balanced ? "0" : n(moment)}`,
        ],
      });
    } else if (MA !== null) {
      steps.push({
        title: "Проекции по y: вертикалната реакция в A",
        lines: [
          `ΣF_y = ${joinTerms([{ sign: 1, text: "A_v" }, ...verticalLoads])} = 0`,
          `A_v = ${q(Av, "kN")}`,
        ],
      });
      steps.push({
        title: "Моменти спрямо A: моментът в запъването",
        lines: [
          "Моментите са спрямо запъването A: там рамото на A_h и A_v е нула.",
          `ΣM_A = ${joinTerms([{ sign: 1, text: "M_A" }, ...momentTerms(items, 0)])} = 0`,
          `M_A = ${q(MA, "kN·m")}`,
        ],
      });
      steps.push({
        title: "Проверка: моменти спрямо свободния край K",
        lines: [
          `Уравнение, което не е ползвано досега – моменти спрямо свободния край K (x = ${q(input.l, "m")}).`,
          `ΣM_K = ${joinTerms([
            ...(MA === 0 ? [] : [signedTerm(MA, n(Math.abs(MA)))]),
            ...(Av === 0
              ? []
              : [
                  signedTerm(-Av * input.l, `${n(Math.abs(Av))}·${n(input.l)}`),
                ]),
            ...momentTerms(items, input.l),
          ])} = ${balanced ? "0" : n(moment)}`,
        ],
      });
    }

    const last = steps.at(-1)!;
    const shown = [
      Ah,
      Av,
      Bv ?? 0,
      MA ?? 0,
      ...items.flatMap((item) => [item.fx, item.fy]),
    ];
    if (
      shown.some(
        (value) => Math.abs(value * 100 - Math.round(value * 100)) > 1e-7,
      )
    ) {
      last.lines.push(
        "Нулата е сметната с пълните стойности. Със закръглените до стотни числа може да излязат няколко стотни.",
      );
    }
    const negative = [
      ["A_h", Ah],
      ["A_v", Av],
      ["B_v", Bv ?? 0],
      ["M_A", MA ?? 0],
    ].filter(([, value]) => (value as number) < 0) as [string, number][];
    if (negative.length > 0) {
      last.lines.push(
        `${negative.map(([name]) => name).join(" и ")} ${negative.length > 1 ? "са" : "е"} с минус: ${negative.length > 1 ? "действат" : "действа"} обратно на приетата посока.`,
      );
    }

    return {
      ok: true,
      Ah,
      Av,
      Bv,
      MA,
      check: { point, x: checkX, moment },
      balanced,
      verdict,
      results,
      steps,
    };
  } catch (error) {
    return {
      ok: false,
      problem:
        error instanceof Error && error.message
          ? error.message
          : "С тези числа сметката не излиза. Провери данните.",
    };
  }
}

/** Готови примери – решените в главата за опорните реакции. */
export const reactionsPresets: { label: string; input: ReactionsInput }[] = [
  {
    label: "Греда 8 m с конзолен край",
    input: {
      scheme: "pin-roller",
      l: 8,
      xA: 0,
      xB: 6,
      loads: [
        { kind: "uniform", q: 6, from: 0, to: 4 },
        { kind: "couple", M: -12, x: 5 },
        { kind: "inclined", F: 20, angle: 60, direction: "down-left", x: 8 },
      ],
    },
  },
  {
    label: "Проста греда, сила 20 kN",
    input: {
      scheme: "pin-roller",
      l: 5,
      xA: 0,
      xB: 5,
      loads: [{ kind: "vertical", F: 20, x: 2 }],
    },
  },
  {
    label: "Конзола: q и сила",
    input: {
      scheme: "fixed",
      l: 3,
      xA: 0,
      xB: 3,
      loads: [
        { kind: "uniform", q: 5, from: 0, to: 3 },
        { kind: "vertical", F: 8, x: 3 },
      ],
    },
  },
  {
    label: "Сила 30 kN под 45°",
    input: {
      scheme: "pin-roller",
      l: 6,
      xA: 0,
      xB: 6,
      loads: [
        { kind: "inclined", F: 30, angle: 45, direction: "down-right", x: 2 },
      ],
    },
  },
  {
    label: "Триъгълен товар 0 → 9 kN/m",
    input: {
      scheme: "pin-roller",
      l: 6,
      xA: 0,
      xB: 6,
      loads: [{ kind: "triangular", q: 9, zeroAt: 0, peakAt: 6 }],
    },
  },
];
