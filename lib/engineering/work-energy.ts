/**
 * Работа, мощност и потенциална енергия (Теоретична механика – II част, Глава 6).
 *
 * Мерни единици: дължини в m, време в s, маса в kg, сили в N, моменти в N·m,
 * ъгли в РАДИАНИ, ъглова скорост в rad/s, работа и енергия в J (1 J = 1 N·m),
 * мощност във W (1 W = 1 J/s). ВНИМАНИЕ: останалите файлове в lib/engineering
 * работят в kN; тук силата е в N. 1 kN·m = 1 kJ = 1000 J.
 *
 * Знаци: оста x е надясно, оста y е НАГОРЕ. Ъгълът на завъртане φ, ъгловата
 * скорост ω и моментите са положителни ОБРАТНО на часовниковата стрелка.
 * Работата е положителна, когато силата има съставка по посоката на
 * преместването. Работата на пружината е работата на силата, с която
 * ПРУЖИНАТА действа върху точката (не на силата, която я деформира).
 * Потенциалната енергия Π е определена така, че F = −grad Π и A₁₂ = Π₁ − Π₂;
 * нулата ѝ е при y = 0 (тегло) и при недеформирана пружина.
 *
 * Файлът е самостоятелен – не ползва други модули от lib/engineering.
 */

/** Земно ускорение, m/s². */
export const G_ACCELERATION = 9.81;

/** Вектор или точка в равнината: x надясно, y нагоре. */
export type Vec2 = { x: number; y: number };

/** Силово поле в равнината: сила в N като функция на положението в m. */
export type ForceField = (point: Vec2) => Vec2;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Величината „${name}“ трябва да е крайно число.`);
  }
}

function assertPositive(value: number, name: string): void {
  assertFinite(value, name);
  if (value <= 0) {
    throw new Error(`Величината „${name}“ трябва да е положителна.`);
  }
}

function assertNonNegative(value: number, name: string): void {
  assertFinite(value, name);
  if (value < 0) {
    throw new Error(`Величината „${name}“ не може да е отрицателна.`);
  }
}

function assertVec(value: Vec2, name: string): void {
  assertFinite(value.x, `${name}, x`);
  assertFinite(value.y, `${name}, y`);
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/**
 * Работа на постоянна сила при преместване от from до to:
 * A = F·Δr = F_x·Δx + F_y·Δy, J. Не зависи от формата на пътя.
 */
export function workOfConstantForce(force: Vec2, from: Vec2, to: Vec2): number {
  assertVec(force, "сила");
  assertVec(from, "начална точка");
  assertVec(to, "крайна точка");
  return dot(force, { x: to.x - from.x, y: to.y - from.y });
}

/**
 * Работа на постоянна сила с големина force (N) по прав път с дължина
 * distance (m), когато ъгълът между силата и преместването е angleRad:
 * A = F·s·cos α, J.
 */
export function workAlongStraightPath(
  force: number,
  distance: number,
  angleRad = 0,
): number {
  assertNonNegative(force, "сила");
  assertNonNegative(distance, "път");
  assertFinite(angleRad, "ъгъл");
  return force * distance * Math.cos(angleRad);
}

/**
 * Работа на теглото при преместване от височина y1 до височина y2 (m, оста y
 * е нагоре): A = −m·g·(y2 − y1), J. Положителна при слизане.
 */
export function gravityWork(massKg: number, y1: number, y2: number): number {
  assertPositive(massKg, "маса");
  assertFinite(y1, "начална височина");
  assertFinite(y2, "крайна височина");
  return -massKg * G_ACCELERATION * (y2 - y1);
}

/**
 * Работа на силата на линейна пружина с коравина c (N/m), когато
 * деформацията ѝ се мени от d1 до d2 (m; удължение или скъсяване – знакът
 * няма значение): A = −(c/2)·(d2² − d1²), J. Отрицателна, когато деформацията
 * расте.
 */
export function springWork(stiffness: number, d1: number, d2: number): number {
  assertPositive(stiffness, "коравина на пружината");
  assertFinite(d1, "начална деформация");
  assertFinite(d2, "крайна деформация");
  return -(stiffness / 2) * (d2 * d2 - d1 * d1);
}

/**
 * Деформация λ = l − l₀ на пружина, закрепена в anchor, с другия край в point
 * и свободна дължина naturalLength (m). Положителна при удължение.
 */
export function springDeformation(
  anchor: Vec2,
  point: Vec2,
  naturalLength: number,
): number {
  assertVec(anchor, "закрепване на пружината");
  assertVec(point, "точка");
  assertNonNegative(naturalLength, "свободна дължина");
  return Math.hypot(point.x - anchor.x, point.y - anchor.y) - naturalLength;
}

/**
 * Силово поле на линейна пружина, закрепена в anchor: силата върху точката е
 * по пружината, с големина c·|λ|, насочена към закрепването при удължение и
 * от него при скъсяване. Точката не бива да съвпада със закрепването.
 */
export function springForceField(
  stiffness: number,
  anchor: Vec2,
  naturalLength: number,
): ForceField {
  assertPositive(stiffness, "коравина на пружината");
  assertVec(anchor, "закрепване на пружината");
  assertNonNegative(naturalLength, "свободна дължина");
  return (point) => {
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
      throw new Error("Точката съвпада със закрепването на пружината.");
    }
    const factor = (-stiffness * (length - naturalLength)) / length;
    return { x: factor * dx, y: factor * dy };
  };
}

/**
 * Работа на силата на триене при плъзгане с постоянна нормална реакция
 * normal (N) по път с дължина pathLength (m): A = −μ·N·s, J. Винаги ≤ 0;
 * pathLength е изминатият път, не разстоянието между крайните точки.
 */
export function frictionWork(
  mu: number,
  normal: number,
  pathLength: number,
): number {
  assertNonNegative(mu, "коефициент на триене");
  assertNonNegative(normal, "нормална реакция");
  assertNonNegative(pathLength, "път");
  return -mu * normal * pathLength;
}

/**
 * Работа на постоянен момент (или двоица) M (N·m) при завъртане на тялото на
 * ъгъл deltaPhi (rad): A = M·Δφ, J. И двете са положителни обратно на
 * часовниковата стрелка.
 */
export function momentWork(moment: number, deltaPhi: number): number {
  assertFinite(moment, "момент");
  assertFinite(deltaPhi, "ъгъл на завъртане");
  return moment * deltaPhi;
}

/** Мощност на сила: P = F·v = F_x·v_x + F_y·v_y, W. */
export function power(force: Vec2, velocity: Vec2): number {
  assertVec(force, "сила");
  assertVec(velocity, "скорост");
  return dot(force, velocity);
}

/** Средна мощност P = A/t, W; работата е в J, времето в s. */
export function averagePower(work: number, time: number): number {
  assertFinite(work, "работа");
  assertPositive(time, "време");
  return work / time;
}

/** Мощност на момент върху въртящо се тяло: P = M·ω, W. */
export function rotationalPower(moment: number, omega: number): number {
  assertFinite(moment, "момент");
  assertFinite(omega, "ъглова скорост");
  return moment * omega;
}

/** Обороти в минута → ъглова скорост в rad/s: ω = π·n/30. */
export function rpmToRadPerSec(rpm: number): number {
  assertFinite(rpm, "обороти в минута");
  return (Math.PI * rpm) / 30;
}

/** Сила, приложена в точка на твърдо тяло. */
export type AppliedForce = {
  /** сила, N */
  force: Vec2;
  /** приложна точка, m */
  point: Vec2;
};

/**
 * Главен вектор R (N) и главен момент M_O (N·m, + обратно на часовниковата
 * стрелка) на група сили и двоици спрямо полюс pole.
 */
export function reduceToPole(
  forces: AppliedForce[],
  pole: Vec2,
  couples: number[] = [],
): { R: Vec2; MO: number } {
  assertVec(pole, "полюс");
  let Rx = 0;
  let Ry = 0;
  let MO = 0;
  for (const { force, point } of forces) {
    assertVec(force, "сила");
    assertVec(point, "приложна точка");
    Rx += force.x;
    Ry += force.y;
    MO += (point.x - pole.x) * force.y - (point.y - pole.y) * force.x;
  }
  for (const couple of couples) {
    assertFinite(couple, "момент на двоица");
    MO += couple;
  }
  return { R: { x: Rx, y: Ry }, MO };
}

/**
 * Мощност на група сили върху твърдо тяло при равнинно движение:
 * P = R·v_O + M_O·ω, W. v_O е скоростта на полюса (m/s), ω е ъгловата
 * скорост (rad/s, + обратно на часовниковата стрелка).
 */
export function rigidBodyPower(input: {
  R: Vec2;
  MO: number;
  poleVelocity: Vec2;
  omega: number;
}): number {
  const { R, MO, poleVelocity, omega } = input;
  assertVec(R, "главен вектор");
  assertFinite(MO, "главен момент");
  assertVec(poleVelocity, "скорост на полюса");
  assertFinite(omega, "ъглова скорост");
  return dot(R, poleVelocity) + MO * omega;
}

/**
 * Работа на група ПОСТОЯННИ сили върху твърдо тяло, когато главният вектор и
 * главният момент спрямо полюса не се менят по време на движението:
 * A = R·Δr_O + M_O·Δφ, J.
 */
export function rigidBodyWork(input: {
  R: Vec2;
  MO: number;
  poleDisplacement: Vec2;
  deltaPhi: number;
}): number {
  const { R, MO, poleDisplacement, deltaPhi } = input;
  assertVec(R, "главен вектор");
  assertFinite(MO, "главен момент");
  assertVec(poleDisplacement, "преместване на полюса");
  assertFinite(deltaPhi, "ъгъл на завъртане");
  return dot(R, poleDisplacement) + MO * deltaPhi;
}

/** Потенциална енергия на теглото: Π = m·g·y, J (нула при y = 0). */
export function gravityPotential(massKg: number, y: number): number {
  assertPositive(massKg, "маса");
  assertFinite(y, "височина");
  return massKg * G_ACCELERATION * y;
}

/** Потенциална енергия на линейна пружина: Π = c·λ²/2, J. */
export function springPotential(
  stiffness: number,
  deformation: number,
): number {
  assertPositive(stiffness, "коравина на пружината");
  assertFinite(deformation, "деформация");
  return (stiffness * deformation * deformation) / 2;
}

/** Работа на силите на потенциално поле от положение 1 до 2: A₁₂ = Π₁ − Π₂. */
export function workFromPotential(pi1: number, pi2: number): number {
  assertFinite(pi1, "потенциална енергия в началото");
  assertFinite(pi2, "потенциална енергия в края");
  return pi1 - pi2;
}

/**
 * Числен криволинеен интеграл A = ∫(F_x dx + F_y dy) по начупена линия през
 * точките points (поне две). Всяка отсечка се интегрира по правилото на
 * Симпсън с stepsPerSegment (четно, ≥ 2) подинтервала. Резултат в J.
 */
export function workAlongPolyline(
  field: ForceField,
  points: Vec2[],
  stepsPerSegment = 200,
): number {
  if (points.length < 2) {
    throw new Error("Пътят трябва да има поне две точки.");
  }
  if (
    !Number.isInteger(stepsPerSegment) ||
    stepsPerSegment < 2 ||
    stepsPerSegment % 2 !== 0
  ) {
    throw new Error("Броят на стъпките трябва да е четно число, поне 2.");
  }
  let total = 0;
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1]!;
    const b = points[k]!;
    assertVec(a, "точка от пътя");
    assertVec(b, "точка от пътя");
    const delta = { x: b.x - a.x, y: b.y - a.y };
    let sum = 0;
    for (let i = 0; i <= stepsPerSegment; i++) {
      const u = i / stepsPerSegment;
      const weight = i === 0 || i === stepsPerSegment ? 1 : i % 2 === 1 ? 4 : 2;
      sum +=
        weight *
        dot(field({ x: a.x + delta.x * u, y: a.y + delta.y * u }), delta);
    }
    total += sum / (3 * stepsPerSegment);
  }
  return total;
}

/**
 * Числена стойност на ∂F_y/∂x − ∂F_x/∂y в точка (централни разлики със
 * стъпка h, m). За потенциално поле е нула във всяка точка.
 */
export function curlZ(field: ForceField, point: Vec2, h = 1e-4): number {
  assertVec(point, "точка");
  assertPositive(h, "стъпка");
  const dFyDx =
    (field({ x: point.x + h, y: point.y }).y -
      field({ x: point.x - h, y: point.y }).y) /
    (2 * h);
  const dFxDy =
    (field({ x: point.x, y: point.y + h }).x -
      field({ x: point.x, y: point.y - h }).x) /
    (2 * h);
  return dFyDx - dFxDy;
}

/**
 * Признак за потенциалност в равнината: ∂F_x/∂y = ∂F_y/∂x във всички
 * зададени точки (с допуск tolerance, N/m). Проверката е числена и важи само
 * за подадените точки.
 */
export function isPotentialField(
  field: ForceField,
  samplePoints: Vec2[],
  tolerance = 1e-6,
): boolean {
  if (samplePoints.length === 0) {
    throw new Error("Трябва поне една точка за проверка.");
  }
  assertPositive(tolerance, "допуск");
  return samplePoints.every(
    (point) => Math.abs(curlZ(field, point)) <= tolerance,
  );
}
