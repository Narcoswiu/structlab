/**
 * Герберова греда: статически определима многоотворна греда със стави.
 *
 * Решава се така, както се решава на ръка – „част по част“:
 *   1. гредата се разделя в ставите на части;
 *   2. определя се коя част върху коя лежи (етажна схема);
 *   3. първо се решават второстепенните части, после основните, като ставната
 *      сила се пренася върху долната част с обратна посока.
 * Всяка отделна част е греда на две опори (с конзолни краища) и се решава със
 * `solveReactions` от beam.ts.
 *
 * Знаци на ВХОДА – както в beam.ts: сила и разпределен товар > 0 сочат НАДОЛУ,
 * съсредоточен момент > 0 върти ПО часовниковата стрелка, хоризонтална сила > 0
 * сочи НАДЯСНО. Знаци на ИЗХОДА: вертикални реакции > 0 НАГОРЕ, хоризонтална
 * реакция > 0 НАДЯСНО. Оста x е от левия край надясно, в метри; сили в kN.
 *
 * Внимание: в текста на учебника по Теоретична механика моментите са
 * положителни ОБРАТНО на часовниковата стрелка. Тук се пази конвенцията на
 * beam.ts, за да може частите да се решават със същия решател.
 */
import { solveReactions, type Beam, type BeamLoad } from "./beam.ts";

export type GerberSupport = {
  x: number;
  /** "pinned" – неподвижна шарнирна опора; "roller" – подвижна шарнирна опора */
  type: "pinned" | "roller";
};

export type GerberBeam = {
  /** обща дължина, m */
  length: number;
  /** опорите; точно една е неподвижна */
  supports: GerberSupport[];
  /** положения на ставите, m */
  hinges: number[];
  /** вертикални товари и моменти в конвенцията на beam.ts */
  loads: BeamLoad[];
  /** хоризонтални сили, kN, > 0 надясно (по желание) */
  horizontal?: { x: number; value: number }[];
};

export type GerberPart = {
  /** начало и край на частта, m */
  from: number;
  to: number;
  /** "main" – основна част (не лежи върху друга); "secondary" – второстепенна */
  kind: "main" | "secondary";
  /** ниво в етажната схема: 1 за основните части, нагоре расте */
  level: number;
  /** положения на опорите под тази част */
  supports: number[];
  /** ставите, върху които частта ЛЕЖИ (те са нейни опори) */
  restsOn: number[];
  /** ставите, в които частта НОСИ съседна част */
  carries: number[];
};

export type GerberHingeForce = {
  x: number;
  /**
   * Вертикалната сила, с която ЛЯВАТА част действа върху ДЯСНАТА, > 0 нагоре.
   * Равна е на напречната сила Q в ставата. Върху лявата част действа същата
   * сила с обратна посока.
   */
  vertical: number;
  /** Хоризонталната сила, с която лявата част действа върху дясната, > 0 надясно. */
  horizontal: number;
  /** коя от двете части лежи върху другата в тази става */
  supportedPart: "left" | "right";
};

export type GerberResult = {
  /** вертикални реакции, > 0 нагоре, подредени отляво надясно */
  reactions: { x: number; value: number }[];
  /** хоризонтална реакция в неподвижната опора, > 0 надясно */
  horizontalReaction: number;
  /** ставни сили, подредени отляво надясно */
  hingeForces: GerberHingeForce[];
  /** частите на гредата, подредени отляво надясно */
  parts: GerberPart[];
};

const EPS = 1e-9;
const same = (a: number, b: number) => Math.abs(a - b) < EPS;

/**
 * Колко стави са нужни, за да е гредата статически определима:
 * неизвестните реакции (2 за неподвижна опора, 1 за подвижна) минус трите
 * уравнения за равновесие на цялата греда.
 */
export function requiredHinges(supports: GerberSupport[]): number {
  const unknowns = supports.reduce(
    (sum, support) => sum + (support.type === "pinned" ? 2 : 1),
    0,
  );
  return unknowns - 3;
}

function validate(beam: GerberBeam) {
  const { length } = beam;
  if (!(length > 0)) throw new Error("Дължината трябва да е положителна.");
  const inside = (x: number) => x >= 0 && x <= length;

  const supports = [...beam.supports].sort((a, b) => a.x - b.x);
  if (supports.length < 2) throw new Error("Нужни са поне две опори.");
  supports.forEach((support, i) => {
    if (!inside(support.x)) throw new Error("Опора извън гредата.");
    if (i > 0 && same(support.x, supports[i - 1]!.x)) {
      throw new Error("Две опори на едно и също място.");
    }
  });
  if (supports.filter((s) => s.type === "pinned").length !== 1) {
    throw new Error("Точно една опора трябва да е неподвижна.");
  }

  const hinges = [...beam.hinges].sort((a, b) => a - b);
  hinges.forEach((hinge, i) => {
    if (!(hinge > 0 && hinge < length)) {
      throw new Error("Ставата трябва да е вътре в гредата.");
    }
    if (i > 0 && same(hinge, hinges[i - 1]!)) {
      throw new Error("Две стави на едно и също място.");
    }
    if (supports.some((support) => same(support.x, hinge))) {
      throw new Error("Ставата не може да съвпада с опора.");
    }
  });
  if (hinges.length !== requiredHinges(supports)) {
    throw new Error(
      `Гредата не е статически определима: за ${supports.length} опори са нужни ${requiredHinges(supports)} стави, а са зададени ${hinges.length}.`,
    );
  }

  const atHinge = (x: number) => hinges.some((hinge) => same(hinge, x));
  for (const load of beam.loads) {
    if (load.type === "distributed") {
      if (!inside(load.x1) || !inside(load.x2) || load.x2 <= load.x1) {
        throw new Error("Товар извън гредата.");
      }
    } else {
      if (!inside(load.x)) throw new Error("Товар извън гредата.");
      // Сила точно в ставата не принадлежи еднозначно на нито една от частите.
      if (atHinge(load.x)) {
        throw new Error("Съсредоточен товар не може да е точно в става.");
      }
    }
  }
  for (const force of beam.horizontal ?? []) {
    if (!inside(force.x)) throw new Error("Товар извън гредата.");
    if (atHinge(force.x)) {
      throw new Error("Съсредоточен товар не може да е точно в става.");
    }
  }
  return { supports, hinges };
}

/**
 * Разделя гредата на части и определя етажната схема.
 *
 * Всяка част трябва да има точно две вертикални подпирания: опори или стави,
 * в които лежи върху съседна част. Върви се отляво надясно: ако на частта не
 * ѝ достига едно подпиране, дава ѝ го дясната става; ако има достатъчно,
 * дясната става подпира следващата част.
 */
function buildParts(
  supports: GerberSupport[],
  hinges: number[],
  length: number,
) {
  const bounds = [0, ...hinges, length];
  const parts: GerberPart[] = [];
  /** за всяка става: коя част лежи в нея */
  const supported: ("left" | "right")[] = [];
  const unstable = (reason: string) =>
    new Error(`Системата е геометрично изменяема: ${reason}`);

  for (let i = 0; i < bounds.length - 1; i++) {
    const from = bounds[i]!;
    const to = bounds[i + 1]!;
    const own = supports
      .filter((support) => support.x > from - EPS && support.x < to + EPS)
      .map((support) => support.x);
    const restsOn: number[] = [];
    const carries: number[] = [];

    if (i > 0) {
      if (supported[i - 1] === "right") restsOn.push(from);
      else carries.push(from);
    }
    const missing = 2 - own.length - restsOn.length;
    const hasRightHinge = i < bounds.length - 2;
    if (missing < 0) {
      throw unstable(
        `частта от ${from} до ${to} m има повече подпирания, отколкото са нужни, а на друга част не достигат.`,
      );
    }
    if (missing > 1 || (missing === 1 && !hasRightHinge)) {
      throw unstable(
        `частта от ${from} до ${to} m няма достатъчно подпирания.`,
      );
    }
    if (hasRightHinge) {
      if (missing === 1) {
        supported.push("left");
        restsOn.push(to);
      } else {
        supported.push("right");
        carries.push(to);
      }
    }
    parts.push({
      from,
      to,
      kind: restsOn.length === 0 ? "main" : "secondary",
      level: 0,
      supports: own,
      restsOn,
      carries,
    });
  }

  // Ниво: основните части са на ниво 1; всяка друга е едно ниво над най-високата
  // част, върху която лежи.
  const levelOf = (i: number): number => {
    const part = parts[i]!;
    if (part.level > 0) return part.level;
    let below = 0;
    if (part.restsOn.some((h) => same(h, part.from))) {
      below = Math.max(below, levelOf(i - 1));
    }
    if (part.restsOn.some((h) => same(h, part.to))) {
      below = Math.max(below, levelOf(i + 1));
    }
    part.level = below + 1;
    return part.level;
  };
  parts.forEach((_, i) => levelOf(i));

  return { parts, supported };
}

/** Товарите, които попадат върху частта, в нейни местни координати. */
function loadsOnPart(loads: BeamLoad[], part: GerberPart): BeamLoad[] {
  const local: BeamLoad[] = [];
  for (const load of loads) {
    if (load.type === "distributed") {
      const x1 = Math.max(load.x1, part.from);
      const x2 = Math.min(load.x2, part.to);
      if (x2 - x1 > EPS) {
        local.push({ ...load, x1: x1 - part.from, x2: x2 - part.from });
      }
    } else if (load.x >= part.from && load.x <= part.to) {
      // Товар в става е отхвърлен при проверката, затова частта е единствена.
      local.push({ ...load, x: load.x - part.from });
    }
  }
  return local;
}

export function solveGerberBeam(beam: GerberBeam): GerberResult {
  const { supports, hinges } = validate(beam);
  const { parts, supported } = buildParts(supports, hinges, beam.length);

  /** за всяка част: силите нагоре в двете ѝ подпирания (опори или стави) */
  const solved = new Map<number, { x: number; value: number }[]>();

  const solvePart = (i: number): { x: number; value: number }[] => {
    const cached = solved.get(i);
    if (cached) return cached;
    const part = parts[i]!;
    const loads = loadsOnPart(beam.loads, part);

    // Частите, които лежат върху тази, се решават преди нея. Ставната сила,
    // която ги държи нагоре, действа върху тази част с обратна посока – надолу.
    for (const hinge of part.carries) {
      const neighbour = same(hinge, part.from) ? i - 1 : i + 1;
      const hingeForce = solvePart(neighbour).find((r) => same(r.x, hinge))!;
      loads.push({
        type: "force",
        x: hinge - part.from,
        value: hingeForce.value,
      });
    }

    const [xA, xB] = [...part.supports, ...part.restsOn].sort((a, b) => a - b);
    const single: Beam = {
      length: part.to - part.from,
      supports: { type: "simple", xA: xA! - part.from, xB: xB! - part.from },
      loads,
    };
    const result = solveReactions(single).forces.map((force) => ({
      x: force.x + part.from,
      value: force.value,
    }));
    solved.set(i, result);
    return result;
  };
  parts.forEach((_, i) => solvePart(i));

  const reactions = supports.map((support) => {
    const i = parts.findIndex((part) =>
      part.supports.some((x) => same(x, support.x)),
    );
    const found = solved.get(i)!.find((r) => same(r.x, support.x))!;
    return { x: support.x, value: found.value };
  });

  // Хоризонталните сили стигат през ставите до единствената неподвижна опора.
  const horizontal = beam.horizontal ?? [];
  const horizontalReaction =
    horizontal.reduce((sum, force) => sum - force.value, 0) + 0;
  const pinned = supports.find((support) => support.type === "pinned")!;

  const hingeForces = hinges.map((hinge, k): GerberHingeForce => {
    // Частта, която лежи в ставата, получава от нея сила `up` (нагоре).
    const resting = supported[k] === "right" ? k + 1 : k;
    const up = solved.get(resting)!.find((r) => same(r.x, hinge))!.value;
    const leftSum = horizontal.reduce(
      (sum, force) => sum + (force.x < hinge ? force.value : 0),
      pinned.x < hinge ? horizontalReaction : 0,
    );
    return {
      x: hinge,
      vertical: supported[k] === "right" ? up : -up + 0,
      horizontal: leftSum + 0,
      supportedPart: supported[k]!,
    };
  });

  return { reactions, horizontalReaction, hingeForces, parts };
}

type Side = "left" | "right";

/** Дали точков товар в xi влиза в лявата част при сечение в x. */
function isLeftOf(xi: number, x: number, side: Side): boolean {
  return side === "right" ? xi <= x : xi < x;
}

/**
 * Разрезни усилия в сечение x чрез равновесие на всичко ВЛЯВО от сечението.
 * Знаци както в beam.ts: Q > 0 върти по часовниковата стрелка, M > 0 опъва
 * долните нишки, N > 0 при опън. Във всяка става трябва да се получи M = 0.
 */
export function gerberInternalForces(
  beam: GerberBeam,
  x: number,
  side: Side = "right",
): { Q: number; M: number; N: number } {
  if (x < 0 || x > beam.length) throw new Error("Сечение извън гредата.");
  const result = solveGerberBeam(beam);
  let Q = 0;
  let M = 0;
  let N = 0;

  for (const reaction of result.reactions) {
    if (isLeftOf(reaction.x, x, side)) {
      Q += reaction.value;
      M += reaction.value * (x - reaction.x);
    }
  }
  for (const load of beam.loads) {
    if (load.type === "force") {
      if (isLeftOf(load.x, x, side)) {
        Q -= load.value;
        M -= load.value * (x - load.x);
      }
    } else if (load.type === "distributed") {
      const end = Math.min(x, load.x2);
      if (end > load.x1) {
        const resultant = load.value * (end - load.x1);
        Q -= resultant;
        M -= resultant * (x - (load.x1 + end) / 2);
      }
    } else if (isLeftOf(load.x, x, side)) {
      M += load.value;
    }
  }

  // Нормална сила: сборът на хоризонталните сили вляво, с обратен знак.
  const pinned = beam.supports.find((support) => support.type === "pinned")!;
  if (isLeftOf(pinned.x, x, side)) N -= result.horizontalReaction;
  for (const force of beam.horizontal ?? []) {
    if (isLeftOf(force.x, x, side)) N -= force.value;
  }

  return { Q, M, N: N + 0 };
}
