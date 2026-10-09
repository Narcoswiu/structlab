/**
 * Редукция на равнинна система сили (Теоретична механика – I част, Глава 2).
 *
 * Мерни единици: координати в m, сили в kN, моменти в kN·m,
 * разпределен товар в kN/m.
 *
 * Знаци (както в целия модул): ос x надясно, ос y нагоре;
 * момент спрямо точка е положителен ОБРАТНО на часовниковата стрелка:
 * M_O = x·F_y − y·F_x.
 *
 * Файлът е самостоятелен – не ползва други модули от lib/engineering.
 */

export type Point = { x: number; y: number };

/** Сила с проекции Fx, Fy (kN), приложена в точката (x; y) в метри. */
export type PlaneForce = { x: number; y: number; Fx: number; Fy: number };

export type Reduction = {
  /** редукционният център */
  center: Point;
  /** проекции на главния вектор, kN */
  Rx: number;
  Ry: number;
  /** големина на главния вектор, kN (≥ 0) */
  R: number;
  /** ъгъл на главния вектор спрямо оста x, от −180° до 180°; null при R = 0 */
  angleDeg: number | null;
  /** главен момент спрямо центъра, kN·m, > 0 обратно на часовниковата стрелка */
  M: number;
};

export type ReductionCase = "equilibrium" | "couple" | "resultant";

export type Directrix = {
  /** уравнение на директрисата: a·x + b·y = c, с a = R_y, b = −R_x */
  a: number;
  b: number;
  c: number;
  /** отрез от оста x, m; null, когато директрисата е успоредна на оста x */
  xIntercept: number | null;
  /** отрез от оста y, m; null, когато директрисата е успоредна на оста y */
  yIntercept: number | null;
  /** ъглов коефициент k в y = k·x + n; null при вертикална директриса */
  slope: number | null;
  /** разстояние от редукционния център до директрисата, m (≥ 0) */
  distance: number;
  /** най-близката до редукционния център точка от директрисата */
  foot: Point;
};

export type LoadResultant = {
  /** големина на равнодействащата на товара, kN (със знака на товара) */
  value: number;
  /** абсциса на равнодействащата, m */
  x: number;
};

const DEFAULT_TOLERANCE = 1e-9;
const ORIGIN: Point = { x: 0, y: 0 };

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Величината „${name}“ трябва да е крайно число.`);
  }
}

function assertPoint(point: Point, name: string): void {
  assertFinite(point.x, `${name}.x`);
  assertFinite(point.y, `${name}.y`);
}

function assertInterval(x1: number, x2: number): void {
  assertFinite(x1, "x1");
  assertFinite(x2, "x2");
  if (!(x2 > x1)) {
    throw new Error("Краят на товара трябва да е надясно от началото му.");
  }
}

/** Момент на една сила спрямо точка: M_P = (x − x_P)·F_y − (y − y_P)·F_x. */
export function momentAboutPoint(
  force: PlaneForce,
  point: Point = ORIGIN,
): number {
  assertPoint(force, "приложна точка");
  assertFinite(force.Fx, "Fx");
  assertFinite(force.Fy, "Fy");
  assertPoint(point, "точка");
  return (force.x - point.x) * force.Fy - (force.y - point.y) * force.Fx;
}

function buildReduction(
  center: Point,
  Rx: number,
  Ry: number,
  M: number,
): Reduction {
  const R = Math.hypot(Rx, Ry);
  return {
    center: { x: center.x, y: center.y },
    Rx,
    Ry,
    R,
    angleDeg: R === 0 ? null : (Math.atan2(Ry, Rx) * 180) / Math.PI,
    M,
  };
}

/**
 * Редукция на равнинна система от сили и двоици за избран център.
 *
 * R_x = ΣF_x; R_y = ΣF_y; M = Σ[(x − x_C)·F_y − (y − y_C)·F_x] + ΣM_k.
 * `couples` са моментите на двоиците в kN·m, > 0 обратно на часовниковата стрелка.
 */
export function reducePlaneSystem(
  forces: PlaneForce[],
  couples: number[] = [],
  center: Point = ORIGIN,
): Reduction {
  assertPoint(center, "редукционен център");
  let Rx = 0;
  let Ry = 0;
  let M = 0;
  for (const force of forces) {
    M += momentAboutPoint(force, center);
    Rx += force.Fx;
    Ry += force.Fy;
  }
  for (const couple of couples) {
    assertFinite(couple, "момент на двоица");
    M += couple;
  }
  return buildReduction(center, Rx, Ry, M);
}

/**
 * Смяна на редукционния център от A към B:
 * M_B = M_A − (x_B − x_A)·R_y + (y_B − y_A)·R_x.
 * Главният вектор не се променя.
 */
export function moveReductionCenter(
  reduction: Reduction,
  to: Point,
): Reduction {
  assertPoint(to, "нов редукционен център");
  const dx = to.x - reduction.center.x;
  const dy = to.y - reduction.center.y;
  const M = reduction.M - dx * reduction.Ry + dy * reduction.Rx;
  return buildReduction(to, reduction.Rx, reduction.Ry, M);
}

/**
 * Случай на редукция: равновесие (R = 0, M = 0), двоица (R = 0, M ≠ 0)
 * или равнодействаща (R ≠ 0). Стойности под `tolerance` се приемат за нула.
 */
export function classifyReduction(
  reduction: Pick<Reduction, "R" | "M">,
  tolerance: number = DEFAULT_TOLERANCE,
): ReductionCase {
  if (!(tolerance >= 0)) {
    throw new Error("Допускът не може да е отрицателен.");
  }
  if (Math.abs(reduction.R) > tolerance) return "resultant";
  return Math.abs(reduction.M) > tolerance ? "couple" : "equilibrium";
}

/**
 * Директриса на равнодействащата – точките, спрямо които главният момент е нула:
 * x·R_y − y·R_x = M_A + x_A·R_y − y_A·R_x  (при център в началото: = M_O).
 *
 * Отрези: x₀ = c / R_y и y₀ = −c / R_x. Разстояние от центъра: d = |M| / R.
 */
export function directrix(
  reduction: Reduction,
  tolerance: number = DEFAULT_TOLERANCE,
): Directrix {
  if (classifyReduction(reduction, tolerance) !== "resultant") {
    throw new Error(
      "Системата няма равнодействаща: главният вектор е нула и директриса не съществува.",
    );
  }
  const { Rx, Ry, R, M, center } = reduction;
  const a = Ry;
  const b = -Rx;
  const c = M + center.x * Ry - center.y * Rx;
  const hasRx = Math.abs(Rx) > tolerance;
  const hasRy = Math.abs(Ry) > tolerance;
  return {
    a,
    b,
    c,
    xIntercept: hasRy ? c / Ry : null,
    yIntercept: hasRx ? -c / Rx : null,
    slope: hasRx ? Ry / Rx : null,
    distance: Math.abs(M) / R,
    // радиус-векторът от центъра до директрисата е перпендикулярен на R
    foot: {
      x: center.x + (M * Ry) / (R * R),
      y: center.y - (M * Rx) / (R * R),
    },
  };
}

/**
 * Равнодействаща на успоредни сили по оста y: R = ΣF_i, x_R = ΣF_i·x_i / ΣF_i.
 * Сила нагоре е положителна. При ΣF_i = 0 няма равнодействаща – грешка.
 */
export function parallelResultant(
  forces: { x: number; F: number }[],
): LoadResultant {
  let sum = 0;
  let moment = 0;
  for (const force of forces) {
    assertFinite(force.x, "x");
    assertFinite(force.F, "F");
    sum += force.F;
    moment += force.F * force.x;
  }
  if (Math.abs(sum) <= DEFAULT_TOLERANCE) {
    throw new Error(
      "Сборът на силите е нула – системата е в равновесие или е двоица.",
    );
  }
  return { value: sum, x: moment / sum };
}

/** Равномерен товар q от x1 до x2: Q = q·l в средата на участъка. */
export function uniformLoadResultant(
  q: number,
  x1: number,
  x2: number,
): LoadResultant {
  assertFinite(q, "q");
  assertInterval(x1, x2);
  return { value: q * (x2 - x1), x: (x1 + x2) / 2 };
}

/**
 * Триъгълен товар с най-голяма стойност q от x1 до x2: Q = q·l/2,
 * на l/3 от по-големия край. `peak` казва къде е той: "end" (при x2) или "start" (при x1).
 */
export function triangularLoadResultant(
  q: number,
  x1: number,
  x2: number,
  peak: "start" | "end" = "end",
): LoadResultant {
  assertFinite(q, "q");
  assertInterval(x1, x2);
  const length = x2 - x1;
  return {
    value: (q * length) / 2,
    x: peak === "end" ? x2 - length / 3 : x1 + length / 3,
  };
}

/**
 * Линейно разпределен товар от q1 (при x1) до q2 (при x2) – равномерен,
 * триъгълен или трапецовиден:
 * Q = (q1 + q2)·l/2;  x_Q = x1 + l·(q1 + 2·q2) / (3·(q1 + q2)).
 * Двете стойности трябва да са с еднакъв знак и да не са едновременно нула.
 */
export function distributedResultant(load: {
  x1: number;
  x2: number;
  q1: number;
  q2: number;
}): LoadResultant {
  const { x1, x2, q1, q2 } = load;
  assertFinite(q1, "q1");
  assertFinite(q2, "q2");
  assertInterval(x1, x2);
  if (q1 * q2 < 0) {
    throw new Error(
      "Товарът сменя знака си – раздели го на два участъка с еднакъв знак.",
    );
  }
  if (q1 + q2 === 0) {
    throw new Error("Товарът е нула – няма равнодействаща.");
  }
  const length = x2 - x1;
  return {
    value: ((q1 + q2) * length) / 2,
    x: x1 + (length * (q1 + 2 * q2)) / (3 * (q1 + q2)),
  };
}
