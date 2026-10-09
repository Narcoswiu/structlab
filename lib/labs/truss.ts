import {
  ritterSection,
  solveTrussJoints,
  supportLinkCount,
  zeroForceMembers,
  type Truss,
  type TrussJoint,
  type TrussLoad,
  type TrussMember,
  type TrussReaction,
} from "../engineering/truss.ts";
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
 * Лаборатория „Ферма“: три готови геометрии с избираем отвор, височина и
 * вертикални товари във възлите. Сметките са в lib/engineering/truss.ts;
 * тук са геометрията, подреждането и текстът.
 *
 * Знаци (както в „Теоретична механика – I част“): x надясно, y нагоре;
 * момент обратно на часовниковата стрелка = плюс; прътово усилие S > 0 е
 * опън, S < 0 е натиск. Дължини в m, сили в kN.
 */
export type TrussKind = "parallel" | "roof" | "triangle";

export type TrussInput = {
  kind: TrussKind;
  /** отвор, m */
  span: number;
  /** височина, m */
  height: number;
  /** вертикален товар надолу по име на възел, kN */
  loads: Record<string, number>;
  /** хоризонтална сила в избрания за геометрията възел, надясно = плюс, kN */
  horizontal: number;
};

type KindSpec = {
  id: TrussKind;
  label: string;
  /** кратко име за описанието на фигурата */
  name: string;
  /** възлите в реда, в който се обхождат; координати в части от отвора и височината */
  joints: { id: string; x: number; y: number }[];
  members: string[];
  /** възлите, които могат да носят товар */
  loadJoints: { id: string; where: "горен" | "долен" }[];
  horizontalJoint: string;
  /** Ритеров разрез през среден панел; null – фермата няма такъв */
  ritter: { cut: [string, string, string]; part: string[] } | null;
};

export const trussKinds: KindSpec[] = [
  {
    id: "parallel",
    label: "Успоредни пояси, 4 панела",
    name: "Ферма с успоредни пояси",
    joints: [
      { id: "A", x: 0, y: 0 },
      { id: "C", x: 0.25, y: 0 },
      { id: "D", x: 0.5, y: 0 },
      { id: "E", x: 0.75, y: 0 },
      { id: "B", x: 1, y: 0 },
      { id: "F", x: 0.25, y: 1 },
      { id: "G", x: 0.5, y: 1 },
      { id: "H", x: 0.75, y: 1 },
    ],
    members: [
      ...["AC", "CD", "DE", "EB"],
      ...["FG", "GH"],
      ...["AF", "HB"],
      ...["CF", "DG", "EH"],
      ...["FD", "DH"],
    ],
    loadJoints: [
      { id: "F", where: "горен" },
      { id: "G", where: "горен" },
      { id: "H", where: "горен" },
      { id: "C", where: "долен" },
      { id: "D", where: "долен" },
      { id: "E", where: "долен" },
    ],
    horizontalJoint: "H",
    ritter: { cut: ["FG", "FD", "CD"], part: ["A", "C", "F"] },
  },
  {
    id: "roof",
    label: "Покривна, 4 панела",
    name: "Покривна ферма",
    joints: [
      { id: "A", x: 0, y: 0 },
      { id: "D", x: 0.5, y: 0 },
      { id: "B", x: 1, y: 0 },
      { id: "C", x: 0.25, y: 0.5 },
      { id: "E", x: 0.5, y: 1 },
      { id: "F", x: 0.75, y: 0.5 },
    ],
    members: ["AC", "CE", "EF", "FB", "AD", "DB", "CD", "DE", "FD"],
    loadJoints: [
      { id: "C", where: "горен" },
      { id: "E", where: "горен" },
      { id: "F", where: "горен" },
      { id: "D", where: "долен" },
    ],
    horizontalJoint: "E",
    ritter: { cut: ["CE", "CD", "AD"], part: ["A", "C"] },
  },
  {
    id: "triangle",
    label: "Триъгълна, 3 пръта",
    name: "Триъгълна ферма",
    joints: [
      { id: "A", x: 0, y: 0 },
      { id: "B", x: 1, y: 0 },
      { id: "C", x: 0.5, y: 1 },
    ],
    members: ["AC", "CB", "AB"],
    loadJoints: [{ id: "C", where: "горен" }],
    horizontalJoint: "C",
    ritter: null,
  },
];

export const trussKind = (id: TrussKind): KindSpec =>
  trussKinds.find((kind) => kind.id === id) ?? trussKinds[0]!;

/** Фермата за изчисленията: възли, пръти, опори A (неподвижна) и B (подвижна), товари. */
export function buildTruss(input: TrussInput): Truss {
  const kind = trussKind(input.kind);
  const loads: TrussLoad[] = [];
  for (const joint of kind.loadJoints) {
    const value = input.loads[joint.id] ?? 0;
    if (value !== 0) loads.push({ joint: joint.id, fx: 0, fy: -value });
  }
  if (input.horizontal !== 0) {
    loads.push({ joint: kind.horizontalJoint, fx: input.horizontal, fy: 0 });
  }
  return {
    joints: kind.joints.map((joint) => ({
      id: joint.id,
      x: joint.x * input.span,
      y: joint.y * input.height,
    })),
    members: kind.members.map((id) => ({ id, from: id[0]!, to: id[1]! })),
    supports: [
      { joint: "A", type: "pinned" },
      { joint: "B", type: "roller" },
    ],
    loads,
  };
}

export type TrussMemberState = "опън" | "натиск" | "нулев";

export type TrussRow = {
  id: string;
  /** дължина, m */
  length: number;
  /** усилие, kN; > 0 опън, < 0 натиск */
  force: number;
  state: TrussMemberState;
};

export type TrussSolution =
  | { ok: false; problem: string }
  | {
      ok: true;
      truss: Truss;
      reactions: TrussReaction[];
      /** kN; плюс = надясно / нагоре */
      Ah: number;
      Av: number;
      Bv: number;
      rows: TrussRow[];
      /** най-голям опън и най-голям натиск; null, когато няма такъв прът */
      maxTension: { ids: string[]; force: number } | null;
      maxCompression: { ids: string[]; force: number } | null;
      /** m + C = 2·j */
      determinacy: { members: number; links: number; joints: number };
      results: LabResult[];
      steps: LabStep[];
    };

export function findTrussProblem(input: TrussInput): string | null {
  const kind = trussKind(input.kind);
  const loads = kind.loadJoints.map((joint) => input.loads[joint.id] ?? 0);
  if (!allFinite([input.span, input.height, input.horizontal, ...loads])) {
    return "Въведи числа във всички полета.";
  }
  if (!(input.span > 0)) return "Отворът трябва да е положителен.";
  if (!(input.height > 0)) {
    return "Височината трябва да е положителна. При нулева височина прътите лягат на една права и фермата е геометрично изменяема.";
  }
  if (loads.some((value) => value < 0)) {
    return "Товарите са надолу – въведи положителни числа.";
  }
  return null;
}

/** 17,999999999999996 → 18: остатъкът от плаващата запетая не се показва. */
const tidy = (value: number) => snapZero(Math.round(value * 1e9) / 1e9, 1e-7);

const stateOf = (force: number): TrussMemberState =>
  force > 0 ? "опън" : force < 0 ? "натиск" : "нулев";

const withState = (id: string, force: number) =>
  `S_${id} = ${q(force, "kN")} (${stateOf(force)})`;

const list = (ids: readonly string[]) =>
  ids.length <= 1
    ? ids.join("")
    : `${ids.slice(0, -1).join(", ")} и ${ids.at(-1)}`;

/** Момент на сила (fx; fy) в точка (x; y) спрямо (px; py) – като събираеми с числа. */
function forceMomentTerms(
  force: { x: number; y: number; fx: number; fy: number },
  px: number,
  py: number,
): LabTerm[] {
  const terms: LabTerm[] = [];
  const dx = snapZero(force.x - px);
  const dy = snapZero(force.y - py);
  if (force.fy !== 0 && dx !== 0) {
    terms.push(
      signedTerm(force.fy * dx, `${n(Math.abs(force.fy))}·${n(Math.abs(dx))}`),
    );
  }
  if (force.fx !== 0 && dy !== 0) {
    terms.push(
      signedTerm(-force.fx * dy, `${n(Math.abs(force.fx))}·${n(Math.abs(dy))}`),
    );
  }
  return terms;
}

type Context = {
  truss: Truss;
  joints: Map<string, TrussJoint>;
  reactions: TrussReaction[];
  forces: Record<string, number>;
};

/** Единичен вектор по пръта от възел `at` към другия му край. */
function direction(context: Context, member: TrussMember, at: string) {
  const here = context.joints.get(at)!;
  const there = context.joints.get(
    member.from === at ? member.to : member.from,
  )!;
  const length = Math.hypot(there.x - here.x, there.y - here.y);
  return {
    ux: snapZero((there.x - here.x) / length),
    uy: snapZero((there.y - here.y) / length),
    dx: Math.abs(there.x - here.x),
    dy: Math.abs(there.y - here.y),
    length,
  };
}

const isOne = (value: number) => Math.abs(Math.abs(value) - 1) < 1e-9;

/** Товарът и реакцията във възел, събрани. */
function externalAt(context: Context, joint: string) {
  let fx = 0;
  let fy = 0;
  for (const item of [...context.truss.loads, ...context.reactions]) {
    if (item.joint !== joint) continue;
    fx += item.fx;
    fy += item.fy;
  }
  return { fx: snapZero(fx), fy: snapZero(fy) };
}

/** Редовете за един изрязан възел: геометрия, двете уравнения и намерените усилия. */
function jointLines(
  context: Context,
  joint: string,
  found: string[],
  known: Set<string>,
): string[] {
  const { truss, forces } = context;
  const here = truss.members.filter(
    (member) => member.from === joint || member.to === joint,
  );
  const lines: string[] = [];
  for (const member of here) {
    const d = direction(context, member, joint);
    if (d.ux === 0 || d.uy === 0) continue;
    lines.push(
      `Прът ${member.id}: дължина √(${n(d.dx)}² + ${n(d.dy)}²) = ${q(d.length, "m")}; cos α = ${n(d.dx)} / ${n(d.length)} = ${n(Math.abs(d.ux))}; sin α = ${n(d.dy)} / ${n(d.length)} = ${n(Math.abs(d.uy))}.`,
    );
  }

  const external = externalAt(context, joint);
  /** уравнението по една ос; `solved` са усилията, които вече се заместват с числа */
  const equation = (axis: "x" | "y", solved: Set<string>) => {
    const terms: LabTerm[] = [];
    const value = axis === "x" ? external.fx : external.fy;
    if (value !== 0) terms.push(signedTerm(value, n(Math.abs(value))));
    const unknown: string[] = [];
    for (const member of here) {
      const d = direction(context, member, joint);
      const coef = axis === "x" ? d.ux : d.uy;
      if (coef === 0) continue;
      if (solved.has(member.id)) {
        const force = forces[member.id]!;
        if (force === 0) continue;
        terms.push(
          isOne(coef)
            ? signedTerm(coef * force, n(Math.abs(force)))
            : signedTerm(
                coef,
                `${n(Math.abs(coef))}·${force < 0 ? `(${n(force)})` : n(force)}`,
              ),
        );
      } else {
        unknown.push(member.id);
        terms.push(
          signedTerm(
            coef,
            isOne(coef)
              ? `S_${member.id}`
              : `${n(Math.abs(coef))}·S_${member.id}`,
          ),
        );
      }
    }
    return {
      text: `ΣF_${axis} = ${joinTerms(terms)} = 0`,
      unknown,
      empty: terms.length === 0,
    };
  };

  const x = equation("x", known);
  const y = equation("y", known);
  if (found.length === 1) {
    const id = found[0]!;
    const [first, second] = y.unknown.includes(id)
      ? (["y", "x"] as const)
      : (["x", "y"] as const);
    lines.push(equation(first, known).text, withState(id, forces[id]!));
    const check = equation(second, new Set([...known, id]));
    if (!check.empty) {
      lines.push("Второто уравнение остава за проверка:", check.text);
    }
    return lines;
  }

  const single = [y, x].find((item) => item.unknown.length === 1);
  if (single) {
    const firstId = single.unknown[0]!;
    const secondId = found.find((id) => id !== firstId)!;
    const other = single === y ? "x" : "y";
    lines.push(
      single.text,
      withState(firstId, forces[firstId]!),
      equation(other, new Set([...known, firstId])).text,
      withState(secondId, forces[secondId]!),
    );
    return lines;
  }
  lines.push(
    x.text,
    y.text,
    "Двете уравнения се решават заедно:",
    ...found.map((id) => withState(id, forces[id]!)),
  );
  return lines;
}

/** Редовете за Ритеровия разрез: по едно уравнение за всеки от трите пръта. */
function ritterLines(
  context: Context,
  section: { cut: [string, string, string]; part: string[] },
): string[] {
  const { truss, joints } = context;
  const inside = new Set(section.part);
  const lines: string[] = [
    `Разрезът минава през прътите ${list(section.cut)} и отделя лявата част с възли ${list(section.part)}.`,
    "Върху частта действат нейните товари и реакции и трите усилия, приети за опън – насочени навън от частта.",
  ];
  const external = [...context.reactions, ...truss.loads]
    .filter((item) => inside.has(item.joint))
    .map((item) => {
      const joint = joints.get(item.joint)!;
      return { x: joint.x, y: joint.y, fx: item.fx, fy: item.fy };
    });
  const member = (id: string) => truss.members.find((item) => item.id === id)!;
  const outward = (id: string) => {
    const item = member(id);
    const at = inside.has(item.from) ? item.from : item.to;
    return { origin: joints.get(at)!, ...direction(context, item, at) };
  };

  for (const target of section.cut) {
    const result = ritterSection(truss, { ...section, target });
    const others = section.cut.filter((id) => id !== target);
    const wanted = outward(target);
    if (result.method === "moment" && result.point) {
      const point = result.point;
      const named = truss.joints.find(
        (joint) =>
          Math.abs(joint.x - point.x) < 1e-6 &&
          Math.abs(joint.y - point.y) < 1e-6,
      );
      const name = named ? named.id : "R";
      const lever = snapZero(
        (wanted.origin.x - point.x) * wanted.uy -
          (wanted.origin.y - point.y) * wanted.ux,
      );
      lines.push(
        `S_${target}: моменти спрямо ${named ? `възел ${name}` : `точката R(${n(point.x)}; ${n(point.y)})`} – там се пресичат ${list(others)}. Рамото на S_${target} е ${q(Math.abs(lever), "m")}.`,
        `ΣM_${name} = ${joinTerms([
          ...external.flatMap((force) =>
            forceMomentTerms(force, point.x, point.y),
          ),
          signedTerm(lever, `S_${target}·${n(Math.abs(lever))}`),
        ])} = 0`,
        withState(target, snapZero(result.force)),
      );
    } else {
      const vertical = outward(others[0]!).uy === 0;
      const axis = vertical ? "y" : "x";
      const coef = vertical ? wanted.uy : wanted.ux;
      const terms: LabTerm[] = external
        .map((force) => (vertical ? force.fy : force.fx))
        .filter((value) => value !== 0)
        .map((value) => signedTerm(value, n(Math.abs(value))));
      terms.push(
        signedTerm(
          coef,
          isOne(coef) ? `S_${target}` : `${n(Math.abs(coef))}·S_${target}`,
        ),
      );
      lines.push(
        `S_${target}: прътите ${list(others)} са успоредни и нямат обща точка. Проектира се по оста ${axis}, перпендикулярна на тях.`,
        `ΣF_${axis} = ${joinTerms(terms)} = 0`,
        withState(target, snapZero(result.force)),
      );
    }
  }
  lines.push("Същите стойности дава и методът на възлите – виж таблицата.");
  return lines;
}

export function solveTrussLab(input: TrussInput): TrussSolution {
  const problem = findTrussProblem(input);
  if (problem) return { ok: false, problem };
  const kind = trussKind(input.kind);

  try {
    const truss = buildTruss(input);
    const solved = solveTrussJoints(truss);
    const joints = new Map(truss.joints.map((joint) => [joint.id, joint]));
    const forces: Record<string, number> = {};
    for (const member of truss.members) {
      forces[member.id] = tidy(solved.forces[member.id] ?? NaN);
    }
    const reactions = solved.reactions.map((reaction) => ({
      joint: reaction.joint,
      fx: tidy(reaction.fx),
      fy: tidy(reaction.fy),
    }));
    const A = reactions.find((reaction) => reaction.joint === "A");
    const B = reactions.find((reaction) => reaction.joint === "B");
    const Ah = A?.fx ?? 0;
    const Av = A?.fy ?? 0;
    const Bv = B?.fy ?? 0;

    const rows: TrussRow[] = truss.members.map((member) => {
      const a = joints.get(member.from)!;
      const b = joints.get(member.to)!;
      const force = forces[member.id]!;
      return {
        id: member.id,
        length: Math.hypot(b.x - a.x, b.y - a.y),
        force,
        state: stateOf(force),
      };
    });
    if (
      !allFinite([
        Ah,
        Av,
        Bv,
        ...rows.flatMap((row) => [row.length, row.force]),
      ])
    ) {
      return {
        ok: false,
        problem: "С тези числа сметката не излиза. Провери данните.",
      };
    }

    const extreme = (sign: 1 | -1) => {
      const peak = Math.max(...rows.map((row) => sign * row.force));
      if (!(peak > 0)) return null;
      return {
        ids: rows
          .filter((row) => Math.abs(sign * row.force - peak) < 1e-6 * peak)
          .map((row) => row.id),
        force: sign * peak,
      };
    };
    const maxTension = extreme(1);
    const maxCompression = extreme(-1);
    const determinacy = {
      members: truss.members.length,
      links: supportLinkCount(truss.supports),
      joints: truss.joints.length,
    };

    const where = (item: { ids: string[] }) =>
      `${item.ids.length > 1 ? "пръти" : "прът"} ${list(item.ids)}`;
    const results: LabResult[] = [
      {
        name: "A_h",
        value: q(Ah, "kN"),
        note:
          Ah > 0
            ? "надясно"
            : Ah < 0
              ? "наляво – обратно на приетата посока"
              : "няма хоризонтален товар",
      },
      {
        name: "A_v",
        value: q(Av, "kN"),
        note: Av < 0 ? "надолу – обратно на приетата посока" : "нагоре",
      },
      {
        name: "B_v",
        value: q(Bv, "kN"),
        note: Bv < 0 ? "надолу – обратно на приетата посока" : "нагоре",
      },
      {
        name: "Най-голям опън",
        value: maxTension ? q(maxTension.force, "kN") : "няма",
        note: maxTension ? where(maxTension) : "няма опънат прът",
      },
      {
        name: "Най-голям натиск",
        value: maxCompression ? q(maxCompression.force, "kN") : "няма",
        note: maxCompression ? where(maxCompression) : "няма натиснат прът",
      },
      {
        name: "Определимост m + C = 2·j",
        value: `${determinacy.members} + ${determinacy.links} = 2·${determinacy.joints}`,
        note: "статически определима",
      },
    ];

    // ── сметките ──
    const context: Context = { truss, joints, reactions, forces };
    const xB = joints.get("B")!.x;
    const loadForces = truss.loads.map((load) => {
      const joint = joints.get(load.joint)!;
      return { x: joint.x, y: joint.y, fx: load.fx, fy: load.fy };
    });
    const horizontalTerms: LabTerm[] = [
      { sign: 1, text: "A_h" },
      ...loadForces
        .filter((force) => force.fx !== 0)
        .map((force) => signedTerm(force.fx, n(Math.abs(force.fx)))),
    ];
    const verticalTerms = loadForces
      .filter((force) => force.fy !== 0)
      .map((force) => signedTerm(force.fy, n(Math.abs(force.fy))));
    const momentA = loadForces.flatMap((force) =>
      forceMomentTerms(force, 0, 0),
    );
    const sumA = loadForces.reduce(
      (sum, force) => sum + force.x * force.fy - force.y * force.fx,
      0,
    );

    const steps: LabStep[] = [
      {
        title: "Правило за знаците",
        lines: [
          "Всяко неизвестно усилие се приема за опън: стрелката му излиза от възела.",
          "Положителен резултат е опън, отрицателен – натиск.",
          "Проекции: надясно и нагоре са плюс. Моменти: обратно на часовниковата стрелка е плюс.",
        ],
      },
      {
        title: "Статическа определимост",
        lines: [
          `m + C = ${determinacy.members} + ${determinacy.links} = ${determinacy.members + determinacy.links}`,
          `2·j = 2·${determinacy.joints} = ${2 * determinacy.joints}`,
          "Неизвестните (пръти и опорни връзки) са колкото уравненията (по две на възел) – фермата е статически определима.",
        ],
      },
      {
        title: "Опорни реакции",
        lines: [
          "Цялата ферма се разглежда като едно тяло. Неподвижната опора A дава A_h и A_v, подвижната B – само B_v.",
          `ΣF_x = ${joinTerms(horizontalTerms)} = 0`,
          `A_h = ${q(Ah, "kN")}`,
          `ΣM_A = ${joinTerms([{ sign: 1, text: `B_v·${n(xB)}` }, ...momentA])} = 0`,
          Bv === 0
            ? "B_v = 0 kN"
            : `B_v = ${n(-sumA)} / ${n(xB)} = ${q(Bv, "kN")}`,
          `ΣF_y = ${joinTerms([
            { sign: 1, text: "A_v" },
            ...(Bv === 0 ? [] : [signedTerm(Bv, n(Math.abs(Bv)))]),
            ...verticalTerms,
          ])} = 0`,
          `A_v = ${q(Av, "kN")}`,
          "Проверка с уравнение, което не е ползвано – моменти спрямо B:",
          `ΣM_B = ${joinTerms([
            ...forceMomentTerms({ x: 0, y: 0, fx: Ah, fy: Av }, xB, 0),
            ...loadForces.flatMap((force) => forceMomentTerms(force, xB, 0)),
          ])} = 0`,
        ],
      },
    ];

    const known = new Set<string>();
    for (const [index, step] of solved.steps.entries()) {
      if (index < 2) {
        steps.push({
          title: `Метод на възлите: възел ${step.joint}`,
          lines: [
            `Изрязва се възел ${step.joint}. ${step.found.length > 1 ? "Неизвестни са" : "Неизвестно е"} ${list(step.found.map((id) => `S_${id}`))}.`,
            ...jointLines(context, step.joint, step.found, known),
          ],
        });
      }
      for (const id of step.found) known.add(id);
    }
    const rest = solved.steps.slice(2).map((step) => step.joint);
    if (rest.length > 0) {
      steps
        .at(-1)!
        .lines.push(
          `Останалите възли се решават по същия начин, в реда ${list(rest)}. Всички усилия са в таблицата.`,
        );
    }

    const zero = zeroForceMembers(truss);
    if (zero.length > 0) {
      steps.push({
        title: "Нулеви пръти",
        lines: [
          `${zero.length > 1 ? "Прътите" : "Прътът"} ${list(zero)} ${zero.length > 1 ? "се разпознават" : "се разпознава"} и без сметки – по правилата за нулеви пръти.`,
          "Ненатоварен възел с два пръта, които не са на една права: и двата са нулеви.",
          "Ненатоварен възел с три пръта, два от които са на една права: третият е нулев.",
        ],
      });
    }

    steps.push({
      title: kind.ritter
        ? `Ритеров разрез през ${list(kind.ritter.cut)}`
        : "Ритеров разрез",
      lines: kind.ritter
        ? ritterLines(context, kind.ritter)
        : [
            "Тази ферма има само три пръта. Всеки разрез минава през два от тях и отделя един възел – това е самият метод на възлите.",
            "Ритеровият разрез има смисъл при повече панели. Избери покривната ферма или фермата с успоредни пояси.",
          ],
    });

    return {
      ok: true,
      truss,
      reactions,
      Ah,
      Av,
      Bv,
      rows,
      maxTension,
      maxCompression,
      determinacy,
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

/** Готови примери – решените в главата за ферми. */
export const trussPresets: { label: string; input: TrussInput }[] = [
  {
    label: "Изпитна ферма: 40, 20 и 12 kN",
    input: {
      kind: "parallel",
      span: 12,
      height: 4,
      loads: { F: 40, G: 20, H: 0, C: 0, D: 0, E: 0 },
      horizontal: 12,
    },
  },
  {
    label: "Ферма-мост: 3 × 20 kN",
    input: {
      kind: "parallel",
      span: 12,
      height: 4,
      loads: { F: 0, G: 0, H: 0, C: 20, D: 20, E: 20 },
      horizontal: 0,
    },
  },
  {
    label: "Покривна ферма 8 × 3 m",
    input: {
      kind: "roof",
      span: 8,
      height: 3,
      loads: { C: 12, E: 12, F: 24, D: 0 },
      horizontal: 0,
    },
  },
  {
    label: "Триъгълна ферма 4 × 1,5 m",
    input: {
      kind: "triangle",
      span: 4,
      height: 1.5,
      loads: { C: 12 },
      horizontal: 0,
    },
  },
];

/** Началните данни при смяна на геометрията: първият пример с нея. */
export function defaultTrussInput(kind: TrussKind): TrussInput {
  return (
    trussPresets.find((preset) => preset.input.kind === kind) ??
    trussPresets[0]!
  ).input;
}
