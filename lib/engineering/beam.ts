/**
 * Статически определими греди: проста греда и конзола.
 *
 * Знаци (както в курса, виж CONTENT_GUIDE.md):
 *   Q > 0 – върти отрязаната част по часовниковата стрелка;
 *   M > 0 – опъва долните (пунктираните) нишки.
 * Оста x е от левия край надясно, в метри. Сили в kN, моменти в kN·m.
 */

export type BeamLoad =
  /** съсредоточена сила; value > 0 сочи НАДОЛУ */
  | { type: "force"; x: number; value: number }
  /** равномерно разпределен товар от x1 до x2; value > 0 сочи НАДОЛУ, kN/m */
  | { type: "distributed"; x1: number; x2: number; value: number }
  /** съсредоточен момент; value > 0 върти ПО часовниковата стрелка */
  | { type: "moment"; x: number; value: number };

export type BeamSupports =
  /** неподвижна шарнирна опора в xA и подвижна в xB */
  | { type: "simple"; xA: number; xB: number }
  /** запъване в левия (x = 0) или в десния (x = length) край */
  | { type: "cantilever"; fixedAt: "left" | "right" };

export type Beam = {
  length: number;
  supports: BeamSupports;
  loads: BeamLoad[];
};

export type BeamReactions = {
  /** вертикални реакции, положителни НАГОРЕ */
  forces: { x: number; value: number }[];
  /** реактивен момент в запъването, положителен ПО часовниковата стрелка */
  moment: { x: number; value: number } | null;
};

/** Равнодействаща надолу и нейният момент спрямо точка x0 (по часовниковата). */
function loadResultants(loads: BeamLoad[], x0: number) {
  let down = 0;
  let clockwise = 0;
  for (const load of loads) {
    if (load.type === "force") {
      down += load.value;
      clockwise += load.value * (load.x - x0);
    } else if (load.type === "distributed") {
      const resultant = load.value * (load.x2 - load.x1);
      down += resultant;
      clockwise += resultant * ((load.x1 + load.x2) / 2 - x0);
    } else {
      clockwise += load.value;
    }
  }
  return { down, clockwise };
}

function validate(beam: Beam) {
  if (!(beam.length > 0)) throw new Error("Дължината трябва да е положителна.");
  const inside = (x: number) => x >= 0 && x <= beam.length;
  for (const load of beam.loads) {
    const ok =
      load.type === "distributed"
        ? inside(load.x1) && inside(load.x2) && load.x2 > load.x1
        : inside(load.x);
    if (!ok) throw new Error("Товар извън гредата.");
  }
  if (beam.supports.type === "simple") {
    const { xA, xB } = beam.supports;
    if (!inside(xA) || !inside(xB) || xB <= xA) {
      throw new Error("Невалидно положение на опорите.");
    }
  }
}

export function solveReactions(beam: Beam): BeamReactions {
  validate(beam);

  if (beam.supports.type === "simple") {
    const { xA, xB } = beam.supports;
    const { down, clockwise } = loadResultants(beam.loads, xA);
    // ΣM_A = 0: реакцията в B (нагоре) върти обратно на часовниковата около A.
    const rB = clockwise / (xB - xA);
    const rA = down - rB;
    return {
      forces: [
        { x: xA, value: rA },
        { x: xB, value: rB },
      ],
      moment: null,
    };
  }

  const x0 = beam.supports.fixedAt === "left" ? 0 : beam.length;
  const { down, clockwise } = loadResultants(beam.loads, x0);
  return {
    forces: [{ x: x0, value: down }],
    // ΣM = 0 в запъването: реактивният момент уравновесява товарите.
    moment: { x: x0, value: -clockwise },
  };
}

type Side = "left" | "right";

/** Дали точков товар в xi влиза в лявата част при сечение в x. */
function isLeftOf(xi: number, x: number, side: Side): boolean {
  return side === "right" ? xi <= x : xi < x;
}

/**
 * Разрезни усилия в сечение x чрез равновесие на ЛЯВАТА част.
 * `side` определя от коя страна на съсредоточен товар е сечението:
 * "left" = непосредствено преди него (x⁻), "right" = непосредствено след него (x⁺).
 */
export function internalForces(
  beam: Beam,
  x: number,
  side: Side = "right",
): { Q: number; M: number } {
  if (x < 0 || x > beam.length) throw new Error("Сечение извън гредата.");
  const reactions = solveReactions(beam);
  let Q = 0;
  let M = 0;

  for (const reaction of reactions.forces) {
    if (isLeftOf(reaction.x, x, side)) {
      Q += reaction.value;
      M += reaction.value * (x - reaction.x);
    }
  }
  if (reactions.moment && isLeftOf(reactions.moment.x, x, side)) {
    M += reactions.moment.value;
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

  return { Q, M };
}

/** Точките, в които диаграмите се чупят или скачат (начало, край, опори, товари). */
export function keyPoints(beam: Beam): number[] {
  const points = new Set<number>([0, beam.length]);
  if (beam.supports.type === "simple") {
    points.add(beam.supports.xA);
    points.add(beam.supports.xB);
  }
  for (const load of beam.loads) {
    if (load.type === "distributed") {
      points.add(load.x1);
      points.add(load.x2);
    } else {
      points.add(load.x);
    }
  }
  return [...points].sort((a, b) => a - b);
}

/**
 * Сеченията, в които Q сменя знака вътре в участък с разпределен товар –
 * там M има локален екстремум.
 */
export function shearZeros(beam: Beam): number[] {
  const points = keyPoints(beam);
  const zeros: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const qa = internalForces(beam, a, "right").Q;
    const qb = internalForces(beam, b, "left").Q;
    // В участък Q е линейна функция, затова нулата се намира точно.
    if (qa * qb < 0) zeros.push(a + ((b - a) * qa) / (qa - qb));
  }
  return zeros;
}

/** Най-големият по абсолютна стойност огъващ момент и мястото му. */
export function maxMoment(beam: Beam): { x: number; M: number } {
  const candidates: { x: number; M: number }[] = [];
  for (const x of keyPoints(beam)) {
    candidates.push({ x, M: internalForces(beam, x, "left").M });
    candidates.push({ x, M: internalForces(beam, x, "right").M });
  }
  for (const x of shearZeros(beam)) {
    candidates.push({ x, M: internalForces(beam, x).M });
  }
  return candidates.reduce((best, current) =>
    Math.abs(current.M) > Math.abs(best.M) ? current : best,
  );
}
