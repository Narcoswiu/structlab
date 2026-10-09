/**
 * Равновесие на тяло в пространството: шестте условия и опорните реакции
 * (Теоретична механика – I част, глава 9).
 *
 * Координатна система (дясна, както в целия модул): оста x сочи надясно,
 * оста y – НАГОРЕ, оста z – към наблюдателя. Координати в метри.
 * Сили в kN, положителни по посока на осите; моменти в kN·m.
 *
 * Момент на сила спрямо координатните оси (сила F в точка (x; y; z)):
 *   M_x = y·F_z − z·F_y,   M_y = z·F_x − x·F_z,   M_z = x·F_y − y·F_x.
 * Моментът спрямо ос е положителен, когато гледано ОТ положителния край на
 * оста силата върти обратно на часовниковата стрелка. M_z съвпада с формулата
 * за равнината xy от главите 1–4.
 *
 * Файлът не зависи от другите пространствени файлове – векторните действия
 * са описани тук.
 */

/** Вектор или точка в пространството. */
export type Vec3 = { x: number; y: number; z: number };

export type SpatialLoad =
  /** съсредоточена сила с проекции `force` (kN) в точка `at` (m) */
  | { type: "force"; at: Vec3; force: Vec3 }
  /** двоица: векторът на момента ѝ (kN·m), един и същ спрямо всяка точка */
  | { type: "couple"; moment: Vec3 };

/** Опорна връзка: отнема една степен на свобода и дава една неизвестна. */
export type SpatialConstraint =
  /**
   * опорен прът (или една съставка на става) в точка `at`; `direction` е
   * посоката на ПОЛОЖИТЕЛНАТА реакция върху тялото (не е нужно да е единична)
   */
  | { type: "link"; at: Vec3; direction: Vec3 }
  /**
   * моментна връзка от пространствено запъване; реактивният момент е
   * положителен по правилото на дясната ръка около `axis`
   */
  | { type: "moment"; axis: Vec3 };

export type SpatialBody = {
  constraints: SpatialConstraint[];
  loads: SpatialLoad[];
};

/** Главен вектор (kN) и главен момент (kN·m) спрямо избрана точка. */
export type SpatialReduction = { force: Vec3; moment: Vec3 };

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
/** под тази стойност на водещия елемент системата се приема за изменяема */
const SINGULAR = 1e-9;

function assertVec(vector: Vec3, what: string): void {
  if (
    ![vector.x, vector.y, vector.z].every((value) => Number.isFinite(value))
  ) {
    throw new Error(`Невалидно число: ${what}.`);
  }
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Векторно произведение r × F: [y·F_z − z·F_y; z·F_x − x·F_z; x·F_y − y·F_x]. */
function cross(r: Vec3, f: Vec3): Vec3 {
  return {
    x: r.y * f.z - r.z * f.y,
    y: r.z * f.x - r.x * f.z,
    z: r.x * f.y - r.y * f.x,
  };
}

/** Единичен вектор по посоката на `vector`; грешка при нулев вектор. */
export function unitVector(vector: Vec3): Vec3 {
  assertVec(vector, "посока");
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!(length > 0)) {
    throw new Error("Посоката не може да е нулев вектор.");
  }
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

/**
 * Единичният вектор по оста на прът от точка `from` (върху тялото) към точка
 * `to` (в основата). Това е посоката, в която ОПЪНАТ прът дърпа тялото.
 */
export function rodDirection(from: Vec3, to: Vec3): Vec3 {
  assertVec(from, "начало на прът");
  assertVec(to, "край на прът");
  const axis = subtract(to, from);
  if (!(Math.hypot(axis.x, axis.y, axis.z) > 0)) {
    throw new Error("Прътът трябва да има дължина.");
  }
  return unitVector(axis);
}

/**
 * Момент на сила спрямо точка `about` – вектор с проекции (M_x; M_y; M_z),
 * които са моментите спрямо трите оси през `about`, успоредни на x, y и z.
 */
export function momentAboutPoint(
  at: Vec3,
  force: Vec3,
  about: Vec3 = ORIGIN,
): Vec3 {
  assertVec(at, "приложна точка");
  assertVec(force, "сила");
  assertVec(about, "моментова точка");
  return cross(subtract(at, about), force);
}

/**
 * Момент на сила спрямо произволна ос през точка `axisPoint` с посока
 * `axisDirection`: проекцията на момента спрямо точката върху оста.
 * Нула е, когато силата е успоредна на оста или директрисата ѝ я пресича.
 */
export function momentAboutAxis(
  at: Vec3,
  force: Vec3,
  axisPoint: Vec3,
  axisDirection: Vec3,
): number {
  return dot(momentAboutPoint(at, force, axisPoint), unitVector(axisDirection));
}

/** Редукция на товарите към точка `about`: трите суми на проекции и трите суми на моменти. */
export function reduceSpatialLoads(
  loads: SpatialLoad[],
  about: Vec3 = ORIGIN,
): SpatialReduction {
  assertVec(about, "редукционен център");
  const force = { x: 0, y: 0, z: 0 };
  const moment = { x: 0, y: 0, z: 0 };
  for (const load of loads) {
    if (load.type === "couple") {
      assertVec(load.moment, "двоица");
      moment.x += load.moment.x;
      moment.y += load.moment.y;
      moment.z += load.moment.z;
      continue;
    }
    const m = momentAboutPoint(load.at, load.force, about);
    force.x += load.force.x;
    force.y += load.force.y;
    force.z += load.force.z;
    moment.x += m.x;
    moment.y += m.y;
    moment.z += m.z;
  }
  return { force, moment };
}

type Column = [number, number, number, number, number, number];

/**
 * Приносът на единична реакция в шестте уравнения:
 * [ΣF_x, ΣF_y, ΣF_z, ΣM_x, ΣM_y, ΣM_z] с моменти спрямо `about`.
 */
function constraintColumn(constraint: SpatialConstraint, about: Vec3): Column {
  if (constraint.type === "moment") {
    const axis = unitVector(constraint.axis);
    return [0, 0, 0, axis.x, axis.y, axis.z];
  }
  assertVec(constraint.at, "опорна връзка");
  const u = unitVector(constraint.direction);
  const m = cross(subtract(constraint.at, about), u);
  return [u.x, u.y, u.z, m.x, m.y, m.z];
}

/** Решава A·x = b по Гаус с избор на водещ елемент; null при изродена матрица. */
function solveLinear(matrix: number[][], rhs: number[]): number[] | null {
  const n = rhs.length;
  const rows = matrix.map((row, index) => [...row, rhs[index]!]);
  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) {
      if (Math.abs(rows[row]![column]!) > Math.abs(rows[pivot]![column]!)) {
        pivot = row;
      }
    }
    if (Math.abs(rows[pivot]![column]!) < SINGULAR) return null;
    [rows[column], rows[pivot]] = [rows[pivot]!, rows[column]!];
    const lead = rows[column]!;
    for (let row = 0; row < n; row += 1) {
      if (row === column) continue;
      const current = rows[row]!;
      const factor = current[column]! / lead[column]!;
      for (let k = column; k <= n; k += 1) {
        current[k] = current[k]! - factor * lead[k]!;
      }
    }
  }
  return rows.map((row, index) => row[n]! / row[index]!);
}

/**
 * Шестте неизвестни (kN или kN·m) в реда на `constraints`.
 *
 * Решава се системата ΣF_x = ΣF_y = ΣF_z = 0, ΣM_x = ΣM_y = ΣM_z = 0 спрямо
 * началото. Положителна стойност означава реакция по зададената посока; за
 * опорен прът, зададен с `rodDirection`, плюс е опън, минус е натиск.
 * Ако връзките не са шест или са разположени така, че тялото е геометрично
 * изменяемо (матрицата е изродена), функцията хвърля грешка.
 */
export function solveSpatialBody(body: SpatialBody): number[] {
  if (body.constraints.length !== 6) {
    throw new Error(
      "Статически определимо тяло в пространството има точно шест опорни връзки.",
    );
  }
  const columns = body.constraints.map((constraint) =>
    constraintColumn(constraint, ORIGIN),
  );
  const matrix = Array.from({ length: 6 }, (_, row) =>
    columns.map((column) => column[row]!),
  );
  const loads = reduceSpatialLoads(body.loads, ORIGIN);
  const rhs = [
    -loads.force.x,
    -loads.force.y,
    -loads.force.z,
    -loads.moment.x,
    -loads.moment.y,
    -loads.moment.z,
  ];
  const solution = solveLinear(matrix, rhs);
  if (!solution) {
    throw new Error(
      "Тялото е геометрично изменяемо: шестте връзки не могат да поемат произволен товар.",
    );
  }
  return solution;
}

/**
 * Проверка на равновесието: шестте суми от товарите и от намерените реакции,
 * с моменти спрямо произволна точка `about`. При вярно решение всички са нула.
 */
export function spatialResiduals(
  body: SpatialBody,
  reactions: number[],
  about: Vec3 = ORIGIN,
): SpatialReduction {
  if (reactions.length !== body.constraints.length) {
    throw new Error(
      "Броят на реакциите трябва да е равен на броя на връзките.",
    );
  }
  if (!reactions.every((value) => Number.isFinite(value))) {
    throw new Error("Невалидно число: реакция.");
  }
  const total = reduceSpatialLoads(body.loads, about);
  body.constraints.forEach((constraint, index) => {
    const column = constraintColumn(constraint, about);
    const value = reactions[index]!;
    total.force.x += column[0] * value;
    total.force.y += column[1] * value;
    total.force.z += column[2] * value;
    total.moment.x += column[3] * value;
    total.moment.y += column[4] * value;
    total.moment.z += column[5] * value;
  });
  return total;
}

/** Трите връзки на сферична става в точка `at`: реакции по x, y и z. */
export function sphericalJoint(at: Vec3): SpatialConstraint[] {
  return [
    { type: "link", at, direction: { x: 1, y: 0, z: 0 } },
    { type: "link", at, direction: { x: 0, y: 1, z: 0 } },
    { type: "link", at, direction: { x: 0, y: 0, z: 1 } },
  ];
}

/**
 * Шестте връзки на пространствено запъване в точка `at`:
 * три сили (по x, y, z) и три момента (около x, y, z).
 */
export function spatialFixedSupport(at: Vec3): SpatialConstraint[] {
  return [
    ...sphericalJoint(at),
    { type: "moment", axis: { x: 1, y: 0, z: 0 } },
    { type: "moment", axis: { x: 0, y: 1, z: 0 } },
    { type: "moment", axis: { x: 0, y: 0, z: 1 } },
  ];
}

/**
 * Степен на статическа определимост на едно тяло в пространството: n = C − 6
 * (C – брой на опорните връзки). n = 0 – статически определимо (ако връзките
 * са разположени правилно); n > 0 – статически неопределимо; n < 0 – механизъм.
 */
export function spatialDeterminacy(supportLinks: number): number {
  if (!Number.isInteger(supportLinks) || supportLinks < 0) {
    throw new Error("Броят на връзките е цяло число ≥ 0.");
  }
  return supportLinks - 6;
}

/** Точка от хоризонталната равнина xz (поглед отгоре), m. */
export type PlanPoint = { x: number; z: number };

/** Вертикална сила върху плоча: `value` > 0 действа НАДОЛУ (kN). */
export type VerticalLoad = PlanPoint & { value: number };

/**
 * Хоризонтална плоча на три вертикални опори под вертикални товари – частният
 * случай на успоредни сили. Остават три уравнения:
 *   ΣF_y = 0:  R_1 + R_2 + R_3 = ΣF;
 *   ΣM_x = 0:  z_1·R_1 + z_2·R_2 + z_3·R_3 = Σ z·F;
 *   ΣM_z = 0:  x_1·R_1 + x_2·R_2 + x_3·R_3 = Σ x·F.
 * Връща реакциите в реда на `supports`, положителни НАГОРЕ. Отрицателна
 * реакция означава, че опората трябва да дърпа надолу (плочата се обръща,
 * ако не е закотвена). Трите опори не бива да лежат на една права.
 */
export function solvePlateOnThreeSupports(
  supports: [PlanPoint, PlanPoint, PlanPoint],
  loads: VerticalLoad[],
): [number, number, number] {
  if (supports.length !== 3) {
    throw new Error("Плочата трябва да има точно три опори.");
  }
  for (const support of supports) {
    assertVec({ x: support.x, y: 0, z: support.z }, "опора");
  }
  let sum = 0;
  let sumZ = 0;
  let sumX = 0;
  for (const load of loads) {
    assertVec({ x: load.x, y: load.value, z: load.z }, "товар");
    sum += load.value;
    sumZ += load.z * load.value;
    sumX += load.x * load.value;
  }
  const [a, b, c] = supports;
  // Крамер за системата [1 1 1; z_1 z_2 z_3; x_1 x_2 x_3]·R = [ΣF; ΣzF; ΣxF]
  const det3 = (
    m: [number, number, number],
    n: [number, number, number],
    p: [number, number, number],
  ) =>
    m[0] * (n[1] * p[2] - n[2] * p[1]) -
    n[0] * (m[1] * p[2] - m[2] * p[1]) +
    p[0] * (m[1] * n[2] - m[2] * n[1]);
  const col = (s: PlanPoint): [number, number, number] => [1, s.z, s.x];
  const rhs: [number, number, number] = [sum, sumZ, sumX];
  // по големина детерминантата е два пъти лицето на триъгълника с върхове в опорите
  const d = det3(col(a), col(b), col(c));
  if (Math.abs(d) < SINGULAR) {
    throw new Error(
      "Трите опори лежат на една права – плочата се обръща около нея.",
    );
  }
  return [
    det3(rhs, col(b), col(c)) / d,
    det3(col(a), rhs, col(c)) / d,
    det3(col(a), col(b), rhs) / d,
  ];
}
