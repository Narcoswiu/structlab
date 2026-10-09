/**
 * Равновесие на едно тяло (диск) в равнината: опорни реакции.
 *
 * Знаци (както в модула „Теоретична механика – I част“):
 *   оста x сочи надясно, оста y – НАГОРЕ; координати в метри;
 *   сила е положителна по посока на осите;
 *   момент е положителен ОБРАТНО на часовниковата стрелка: M_O = x·F_y − y·F_x.
 * Сили в kN, моменти в kN·m, разпределени товари в kN/m.
 *
 * Внимание: `beam.ts` работи с други знаци (сила надолу = плюс, момент по
 * часовниковата стрелка = плюс). При сравнение знаците се обръщат изрично.
 */

export type Point = { x: number; y: number };

export type PlaneLoad =
  /** съсредоточена сила с проекции fx (надясно) и fy (нагоре) в точка (x; y) */
  | { type: "force"; x: number; y: number; fx: number; fy: number }
  /**
   * съсредоточена сила с големина `magnitude`, насочена под ъгъл `angleDeg`
   * спрямо оста x (обратно на часовниковата стрелка; −90° е право надолу)
   */
  | {
      type: "inclined";
      x: number;
      y: number;
      magnitude: number;
      angleDeg: number;
    }
  /** двоица (съсредоточен момент); value > 0 върти обратно на часовниковата */
  | { type: "couple"; value: number }
  /**
   * равномерно разпределен товар с интензивност q (kN на метър дължина на
   * участъка) върху отсечката from–to; посоката е `angleDeg` (по подразбиране −90°, надолу)
   */
  | { type: "uniform"; from: Point; to: Point; q: number; angleDeg?: number }
  /**
   * триъгълен товар върху отсечката from–to: нула във `from`, интензивност q в `to`;
   * посоката е `angleDeg` (по подразбиране −90°, надолу)
   */
  | {
      type: "triangular";
      from: Point;
      to: Point;
      q: number;
      angleDeg?: number;
    };

/** Опорна връзка: всяка отнема една степен на свобода и дава една неизвестна реакция. */
export type Constraint =
  /** опорен прът в точка (x; y); `angleDeg` е посоката на ПОЛОЖИТЕЛНАТА реакция */
  | { type: "link"; x: number; y: number; angleDeg: number }
  /** моментна връзка (от запъване); реактивният момент е > 0 обратно на часовниковата */
  | { type: "moment" };

export type PlaneBody = {
  constraints: [Constraint, Constraint, Constraint];
  loads: PlaneLoad[];
};

export type PlaneSupports =
  /**
   * неподвижна шарнирна опора в `pin` и подвижна в `roller`;
   * `rollerAngleDeg` е посоката на положителната реакция на подвижната опора
   * (перпендикулярна на търкалянето; по подразбиране 90° – нагоре)
   */
  | { type: "pin-roller"; pin: Point; roller: Point; rollerAngleDeg?: number }
  /** запъване в точка `at` */
  | { type: "fixed"; at: Point };

export type SupportReactions = {
  /** хоризонтална реакция в A, положителна надясно */
  Ah: number;
  /** вертикална реакция в A, положителна нагоре */
  Av: number;
  /** реакция на подвижната опора по нейната посока (null при запъване) */
  B: number | null;
  /** проекции на реакцията в подвижната опора (0 при запъване) */
  Bh: number;
  Bv: number;
  /** реактивен момент в запъването, положителен обратно на часовниковата (null при две опори) */
  MA: number | null;
};

/** Главен вектор и главен момент на система сили спрямо избрана точка. */
export type Reduction = { fx: number; fy: number; moment: number };

const DEG = Math.PI / 180;
const ORIGIN: Point = { x: 0, y: 0 };
/** под тази стойност на детерминантата системата се приема за геометрично изменяема */
const SINGULAR = 1e-9;

function assertFinite(values: number[], what: string) {
  if (!values.every((value) => Number.isFinite(value))) {
    throw new Error(`Невалидно число: ${what}.`);
  }
}

/** Единичен вектор под ъгъл angleDeg спрямо оста x. */
function unit(angleDeg: number): { ux: number; uy: number } {
  return { ux: Math.cos(angleDeg * DEG), uy: Math.sin(angleDeg * DEG) };
}

/**
 * Замества един товар с неговата равнодействаща: проекции и приложна точка.
 * Двоицата няма равнодействаща сила – връща се само моментът ѝ.
 */
export function loadResultant(load: PlaneLoad): {
  fx: number;
  fy: number;
  at: Point;
  couple: number;
} {
  if (load.type === "couple") {
    assertFinite([load.value], "двоица");
    return { fx: 0, fy: 0, at: ORIGIN, couple: load.value };
  }
  if (load.type === "force") {
    assertFinite([load.x, load.y, load.fx, load.fy], "сила");
    return {
      fx: load.fx,
      fy: load.fy,
      at: { x: load.x, y: load.y },
      couple: 0,
    };
  }
  if (load.type === "inclined") {
    assertFinite(
      [load.x, load.y, load.magnitude, load.angleDeg],
      "наклонена сила",
    );
    if (load.magnitude < 0) {
      throw new Error("Големината на силата не може да е отрицателна.");
    }
    const { ux, uy } = unit(load.angleDeg);
    return {
      fx: load.magnitude * ux,
      fy: load.magnitude * uy,
      at: { x: load.x, y: load.y },
      couple: 0,
    };
  }

  const angleDeg = load.angleDeg ?? -90;
  assertFinite(
    [load.from.x, load.from.y, load.to.x, load.to.y, load.q, angleDeg],
    "разпределен товар",
  );
  const length = Math.hypot(load.to.x - load.from.x, load.to.y - load.from.y);
  if (!(length > 0)) {
    throw new Error("Разпределеният товар трябва да има дължина.");
  }
  // равномерен: Q = q·l в средата; триъгълен: Q = q·l/2 на 2/3 от нулевия край
  const size =
    load.type === "uniform" ? load.q * length : (load.q * length) / 2;
  const share = load.type === "uniform" ? 1 / 2 : 2 / 3;
  const { ux, uy } = unit(angleDeg);
  return {
    fx: size * ux,
    fy: size * uy,
    at: {
      x: load.from.x + share * (load.to.x - load.from.x),
      y: load.from.y + share * (load.to.y - load.from.y),
    },
    couple: 0,
  };
}

/** Редукция на товарите към точка `about`: ΣF_x, ΣF_y и ΣM (обратно на часовниковата = плюс). */
export function reduceLoads(
  loads: PlaneLoad[],
  about: Point = ORIGIN,
): Reduction {
  let fx = 0;
  let fy = 0;
  let moment = 0;
  for (const load of loads) {
    const resultant = loadResultant(load);
    fx += resultant.fx;
    fy += resultant.fy;
    moment +=
      (resultant.at.x - about.x) * resultant.fy -
      (resultant.at.y - about.y) * resultant.fx +
      resultant.couple;
  }
  return { fx, fy, moment };
}

/** Приносът на единична реакция в трите уравнения: [ΣF_x, ΣF_y, ΣM спрямо about]. */
function constraintColumn(
  constraint: Constraint,
  about: Point,
): [number, number, number] {
  if (constraint.type === "moment") return [0, 0, 1];
  assertFinite(
    [constraint.x, constraint.y, constraint.angleDeg],
    "опорна връзка",
  );
  const { ux, uy } = unit(constraint.angleDeg);
  return [
    ux,
    uy,
    (constraint.x - about.x) * uy - (constraint.y - about.y) * ux,
  ];
}

type Column = [number, number, number];

function det3(a: Column, b: Column, c: Column): number {
  return (
    a[0] * (b[1] * c[2] - b[2] * c[1]) -
    b[0] * (a[1] * c[2] - a[2] * c[1]) +
    c[0] * (a[1] * b[2] - a[2] * b[1])
  );
}

/**
 * Трите опорни реакции (kN или kN·m) в реда на `constraints`.
 *
 * Решава се системата ΣF_x = 0, ΣF_y = 0, ΣM_O = 0 по Крамер. Ако детерминантата
 * е нула (връзките са успоредни или се пресичат в една точка), тялото е
 * геометрично изменяемо и функцията хвърля грешка.
 */
export function solvePlaneBody(body: PlaneBody): [number, number, number] {
  if (body.constraints.length !== 3) {
    throw new Error("Статически определимо тяло има точно три опорни връзки.");
  }
  const [c1, c2, c3] = body.constraints.map((constraint) =>
    constraintColumn(constraint, ORIGIN),
  ) as [Column, Column, Column];
  const det = det3(c1, c2, c3);
  if (Math.abs(det) < SINGULAR) {
    throw new Error(
      "Системата е геометрично изменяема: опорните връзки са успоредни или се пресичат в една точка.",
    );
  }
  const loads = reduceLoads(body.loads, ORIGIN);
  const rhs: Column = [-loads.fx, -loads.fy, -loads.moment];
  return [
    det3(rhs, c2, c3) / det,
    det3(c1, rhs, c3) / det,
    det3(c1, c2, rhs) / det,
  ];
}

/** Превръща опорите в три опорни връзки: [A_h, A_v, B] или [A_h, A_v, M_A]. */
export function supportConstraints(
  supports: PlaneSupports,
): [Constraint, Constraint, Constraint] {
  if (supports.type === "fixed") {
    const { x, y } = supports.at;
    return [
      { type: "link", x, y, angleDeg: 0 },
      { type: "link", x, y, angleDeg: 90 },
      { type: "moment" },
    ];
  }
  const { pin, roller } = supports;
  return [
    { type: "link", x: pin.x, y: pin.y, angleDeg: 0 },
    { type: "link", x: pin.x, y: pin.y, angleDeg: 90 },
    {
      type: "link",
      x: roller.x,
      y: roller.y,
      angleDeg: supports.rollerAngleDeg ?? 90,
    },
  ];
}

/**
 * Опорни реакции на тяло с неподвижна и подвижна шарнирна опора или със запъване.
 * Приети посоки: A_h надясно, A_v нагоре, B по `rollerAngleDeg`, M_A обратно на
 * часовниковата стрелка. Отрицателен резултат означава обратна посока.
 */
export function solveSupportReactions(
  supports: PlaneSupports,
  loads: PlaneLoad[],
): SupportReactions {
  const [Ah, Av, third] = solvePlaneBody({
    constraints: supportConstraints(supports),
    loads,
  });
  if (supports.type === "fixed") {
    return { Ah, Av, B: null, Bh: 0, Bv: 0, MA: third };
  }
  const { ux, uy } = unit(supports.rollerAngleDeg ?? 90);
  return { Ah, Av, B: third, Bh: third * ux, Bv: third * uy, MA: null };
}

/**
 * Проверка на равновесието: сборовете ΣF_x, ΣF_y и ΣM спрямо произволна точка
 * `about` от товарите и от намерените реакции. При вярно решение и трите са нула.
 */
export function equilibriumResiduals(
  body: PlaneBody,
  reactions: [number, number, number],
  about: Point = ORIGIN,
): Reduction {
  assertFinite([about.x, about.y, ...reactions], "проверка на равновесието");
  const total = reduceLoads(body.loads, about);
  body.constraints.forEach((constraint, index) => {
    const column = constraintColumn(constraint, about);
    const value = reactions[index]!;
    total.fx += column[0] * value;
    total.fy += column[1] * value;
    total.moment += column[2] * value;
  });
  return total;
}

/**
 * Степен на статическа определимост: n = C + 2·S − 3·D
 * (C – опорни връзки, S – прости стави, D – дискове).
 * n = 0 – статически определима; n > 0 – статически неопределима; n < 0 – механизъм.
 * За едно тяло (D = 1, S = 0) формулата става n = C − 3.
 */
export function staticDeterminacy(input: {
  disks: number;
  hinges: number;
  supportLinks: number;
}): number {
  const { disks, hinges, supportLinks } = input;
  const valid = (value: number) => Number.isInteger(value) && value >= 0;
  if (!valid(disks) || disks < 1 || !valid(hinges) || !valid(supportLinks)) {
    throw new Error("Броят на дисковете, ставите и връзките е цяло число ≥ 0.");
  }
  return supportLinks + 2 * hinges - 3 * disks;
}
