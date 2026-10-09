/**
 * Редукция на пространствена система сили (Теоретична механика – I част, Глава 8).
 *
 * Мерни единици: координати в m, сили в kN, моменти в kN·m.
 *
 * Знаци (както в целия модул, разширени за пространството): дясна координатна
 * система – оста x е надясно, оста y е НАГОРЕ, оста z е към наблюдателя.
 * Моментът на сила спрямо точка е векторът M = r × F:
 *   M_x = y·F_z − z·F_y,  M_y = z·F_x − x·F_z,  M_z = x·F_y − y·F_x.
 * Момент спрямо ос е положителен, когато, гледано от върха на оста, въртенето
 * е ОБРАТНО на часовниковата стрелка (правило на дясната ръка). За оста z това
 * е точно правилото от равнинните глави: M_z = x·F_y − y·F_x.
 *
 * Файлът е самостоятелен – не ползва други модули от lib/engineering.
 */

/** Вектор или точка в пространството (проекции по трите оси). */
export type Vec3 = { x: number; y: number; z: number };

/** Сила с проекции Fx, Fy, Fz (kN), приложена в точката (x; y; z) в метри. */
export type SpatialForce = {
  x: number;
  y: number;
  z: number;
  Fx: number;
  Fy: number;
  Fz: number;
};

export type SpatialReduction = {
  /** редукционният център */
  center: Vec3;
  /** главен вектор, kN */
  R: Vec3;
  /** големина на главния вектор, kN (≥ 0) */
  Rmag: number;
  /** главен момент спрямо центъра, kN·m */
  M: Vec3;
  /** големина на главния момент, kN·m (≥ 0) */
  Mmag: number;
};

/** Случай на редукция; "wrench" е динамата (силов винт). */
export type SpatialCase = "equilibrium" | "couple" | "resultant" | "wrench";

export type SpatialInvariants = {
  /** първи инвариант – главният вектор, kN */
  R: Vec3;
  /** втори инвариант – скаларното произведение R·M, kN²·m */
  scalar: number;
  /**
   * проекция на главния момент върху главния вектор, M* = (R·M)/R, kN·m;
   * със знак: плюс, когато моментът е по посока на R; null при R = 0
   */
  minMoment: number | null;
};

export type CentralAxis = {
  /** точката от централната ос, която е най-близо до редукционния център */
  point: Vec3;
  /** единичен вектор по главния вектор */
  direction: Vec3;
  /** момент на динамата M* = (R·M)/R, kN·m (със знак; 0 при равнодействаща) */
  moment: number;
  /** векторът на този момент – успореден на R, kN·m */
  momentVector: Vec3;
  /** параметър на динамата p = (R·M)/R², m */
  pitch: number;
  /** разстояние от редукционния център до централната ос, m (≥ 0) */
  distance: number;
};

const DEFAULT_TOLERANCE = 1e-9;
const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Величината „${name}“ трябва да е крайно число.`);
  }
}

function assertVec(vector: Vec3, name: string): void {
  assertFinite(vector.x, `${name}.x`);
  assertFinite(vector.y, `${name}.y`);
  assertFinite(vector.z, `${name}.z`);
}

function assertForce(force: SpatialForce): void {
  assertVec(force, "приложна точка");
  assertFinite(force.Fx, "Fx");
  assertFinite(force.Fy, "Fy");
  assertFinite(force.Fz, "Fz");
}

function assertTolerance(tolerance: number): void {
  if (!(tolerance >= 0)) {
    throw new Error("Допускът не може да е отрицателен.");
  }
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(a: Vec3, k: number): Vec3 {
  return { x: a.x * k, y: a.y * k, z: a.z * k };
}

/** Скаларно произведение a·b = a_x·b_x + a_y·b_y + a_z·b_z. */
export function dot(a: Vec3, b: Vec3): number {
  assertVec(a, "a");
  assertVec(b, "b");
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Векторно произведение a × b (дясна координатна система):
 * (a_y·b_z − a_z·b_y;  a_z·b_x − a_x·b_z;  a_x·b_y − a_y·b_x).
 */
export function cross(a: Vec3, b: Vec3): Vec3 {
  assertVec(a, "a");
  assertVec(b, "b");
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/** Големина на вектор: √(x² + y² + z²). */
export function magnitude(a: Vec3): number {
  assertVec(a, "вектор");
  return Math.hypot(a.x, a.y, a.z);
}

/**
 * Директорни косинуси на вектор: cos α = x/l, cos β = y/l, cos γ = z/l
 * (ъглите са с осите x, y, z). Сборът от квадратите им е 1.
 * Нулев вектор няма посока – грешка.
 */
export function directionCosines(a: Vec3): Vec3 {
  const length = magnitude(a);
  if (length === 0) {
    throw new Error("Нулевият вектор няма посока.");
  }
  return scale(a, 1 / length);
}

/**
 * Сила с големина `value` (kN), приложена в точката `from` и насочена към
 * точката `to`: F_x = F·(x_to − x_from)/l и аналогично за y и z.
 * Отрицателна големина обръща посоката. Съвпадащи точки – грешка.
 */
export function forceAlongLine(
  value: number,
  from: Vec3,
  to: Vec3,
): SpatialForce {
  assertFinite(value, "големина на силата");
  assertVec(from, "начална точка");
  assertVec(to, "крайна точка");
  const delta = subtract(to, from);
  if (magnitude(delta) === 0) {
    throw new Error(
      "Двете точки съвпадат – посоката на силата не е определена.",
    );
  }
  const cosines = directionCosines(delta);
  return {
    x: from.x,
    y: from.y,
    z: from.z,
    Fx: value * cosines.x,
    Fy: value * cosines.y,
    Fz: value * cosines.z,
  };
}

/**
 * Момент на сила спрямо точка (вектор), kN·m: M_P = (r − r_P) × F.
 * Без втори аргумент – спрямо началото O.
 */
export function momentAboutPoint3(
  force: SpatialForce,
  point: Vec3 = ORIGIN,
): Vec3 {
  assertForce(force);
  assertVec(point, "точка");
  return cross(subtract(force, point), {
    x: force.Fx,
    y: force.Fy,
    z: force.Fz,
  });
}

/**
 * Момент на сила спрямо ос, kN·m: проекцията върху оста на момента спрямо
 * произволна точка от нея. Оста минава през `axisPoint` и има посока
 * `axisDirection` (не е нужно да е единичен вектор). Плюс при въртене обратно
 * на часовниковата стрелка, гледано от върха на оста.
 */
export function momentAboutAxis(
  force: SpatialForce,
  axisPoint: Vec3,
  axisDirection: Vec3,
): number {
  const unit = directionCosines(axisDirection);
  return dot(momentAboutPoint3(force, axisPoint), unit);
}

function buildReduction(center: Vec3, R: Vec3, M: Vec3): SpatialReduction {
  return {
    center: { x: center.x, y: center.y, z: center.z },
    R,
    Rmag: Math.hypot(R.x, R.y, R.z),
    M,
    Mmag: Math.hypot(M.x, M.y, M.z),
  };
}

/**
 * Редукция на пространствена система от сили и двоици за избран център:
 * R = ΣF_i;  M = Σ(r_i − r_C) × F_i + ΣM_k.
 * `couples` са векторите на моментите на двоиците, kN·m (свободни вектори).
 */
export function reduceSpatialSystem(
  forces: SpatialForce[],
  couples: Vec3[] = [],
  center: Vec3 = ORIGIN,
): SpatialReduction {
  assertVec(center, "редукционен център");
  let R: Vec3 = { x: 0, y: 0, z: 0 };
  let M: Vec3 = { x: 0, y: 0, z: 0 };
  for (const force of forces) {
    M = add(M, momentAboutPoint3(force, center));
    R = add(R, { x: force.Fx, y: force.Fy, z: force.Fz });
  }
  for (const couple of couples) {
    assertVec(couple, "момент на двоица");
    M = add(M, couple);
  }
  return buildReduction(center, R, M);
}

/**
 * Смяна на редукционния център от A към B:
 * M_B = M_A + (r_A − r_B) × R. Главният вектор не се променя.
 */
export function moveSpatialCenter(
  reduction: SpatialReduction,
  to: Vec3,
): SpatialReduction {
  assertVec(to, "нов редукционен център");
  const M = add(
    reduction.M,
    cross(subtract(reduction.center, to), reduction.R),
  );
  return buildReduction(to, { ...reduction.R }, M);
}

/**
 * Двата инварианта на системата: главният вектор R и скаларното произведение
 * R·M. Не зависят от редукционния център. Връща и M* = (R·M)/R – проекцията
 * на главния момент върху главния вектор (null при R = 0).
 */
export function spatialInvariants(
  reduction: Pick<SpatialReduction, "R" | "M">,
): SpatialInvariants {
  const scalar = dot(reduction.R, reduction.M);
  const Rmag = magnitude(reduction.R);
  return {
    R: { ...reduction.R },
    scalar,
    minMoment: Rmag === 0 ? null : scalar / Rmag,
  };
}

/**
 * Случай на редукция:
 *   R = 0, M = 0  → равновесие;
 *   R = 0, M ≠ 0  → двоица;
 *   R ≠ 0, R·M = 0 → равнодействаща;
 *   R ≠ 0, R·M ≠ 0 → динама (силов винт).
 * Големини под `tolerance` се приемат за нула (и за R, и за M, и за R·M).
 */
export function classifySpatialReduction(
  reduction: Pick<SpatialReduction, "R" | "M">,
  tolerance: number = DEFAULT_TOLERANCE,
): SpatialCase {
  assertTolerance(tolerance);
  const Rmag = magnitude(reduction.R);
  const Mmag = magnitude(reduction.M);
  if (Rmag <= tolerance) {
    return Mmag > tolerance ? "couple" : "equilibrium";
  }
  return Math.abs(dot(reduction.R, reduction.M)) > tolerance
    ? "wrench"
    : "resultant";
}

/**
 * Централна ос на системата (при R ≠ 0): правата, успоредна на R, спрямо чиито
 * точки главният момент е успореден на R и е най-малък по големина.
 * Най-близката ѝ точка до центъра C е r = r_C + (R × M)/R².
 * При R·M = 0 това е директрисата на равнодействащата (M* = 0).
 */
export function centralAxis(
  reduction: SpatialReduction,
  tolerance: number = DEFAULT_TOLERANCE,
): CentralAxis {
  assertTolerance(tolerance);
  const { R, M, center } = reduction;
  const Rmag = magnitude(R);
  if (Rmag <= tolerance) {
    throw new Error(
      "Главният вектор е нула: системата няма централна ос (равновесие или двоица).",
    );
  }
  const offset = scale(cross(R, M), 1 / (Rmag * Rmag));
  const direction = scale(R, 1 / Rmag);
  const moment = dot(R, M) / Rmag;
  return {
    point: add(center, offset),
    direction,
    moment,
    momentVector: scale(direction, moment),
    pitch: moment / Rmag,
    distance: magnitude(offset),
  };
}
