/**
 * Сила, момент на сила и двоица сили в равнината (Теоретична механика – I част, глава 1).
 *
 * Мерни единици: сили в kN, разстояния в m, моменти в kN·m, ъгли в градуси.
 *
 * Знаци (за целия модул по Теоретична механика): оста x е надясно, оста y е НАГОРЕ;
 * ъглите се мерят от оста x обратно на часовниковата стрелка; моментът е положителен,
 * когато върти ОБРАТНО на часовниковата стрелка: M_O = x·F_y − y·F_x.
 * Внимание: `beam.ts` работи с друго правило (сила надолу и момент по часовниковата
 * стрелка са положителни) – двете не се смесват.
 */

/** Точка в равнината, координати в m. */
export type Point = { x: number; y: number };

/** Проекции на сила върху осите, kN. */
export type ForceComponents = { Fx: number; Fy: number };

/** Сила в равнината: приложна точка (m) и проекции (kN). */
export type PlaneForce = Point & ForceComponents;

/** Големина (kN) и ъгъл спрямо оста x (градуси, от −180 до 180). */
export type MagnitudeAndAngle = { value: number; angleDeg: number };

/** Посока на въртене: обратно на часовниковата стрелка (плюс) или по нея (минус). */
export type RotationSense = "ccw" | "cw";

const ORIGIN: Point = { x: 0, y: 0 };

function requireFinite(name: string, ...values: number[]): void {
  if (!values.every((value) => Number.isFinite(value))) {
    throw new Error(`${name} трябва да е крайно число.`);
  }
}

function requirePoint(point: Point): void {
  requireFinite("Координатите на точката", point.x, point.y);
}

function requireForce(force: PlaneForce): void {
  requireFinite("Координатите на приложната точка", force.x, force.y);
  requireFinite("Проекциите на силата", force.Fx, force.Fy);
}

/**
 * Проекции на сила с големина `magnitude` и ъгъл `angleDeg` спрямо оста x:
 * F_x = F·cos α, F_y = F·sin α.
 */
export function forceComponents(
  magnitude: number,
  angleDeg: number,
): ForceComponents {
  requireFinite("Ъгълът", angleDeg);
  if (!Number.isFinite(magnitude) || magnitude < 0) {
    throw new Error("Големината на силата трябва да е неотрицателно число.");
  }
  const angle = (angleDeg * Math.PI) / 180;
  return { Fx: magnitude * Math.cos(angle), Fy: magnitude * Math.sin(angle) };
}

/** Сила, зададена с големина и ъгъл, приложена в точката `at` (по подразбиране началото). */
export function forceFromAngle(
  magnitude: number,
  angleDeg: number,
  at: Point = ORIGIN,
): PlaneForce {
  requirePoint(at);
  return { x: at.x, y: at.y, ...forceComponents(magnitude, angleDeg) };
}

/**
 * Големина и ъгъл от проекциите: F = √(F_x² + F_y²), tg α = F_y / F_x.
 * Ъгълът е в правилния квадрант (от −180° до 180°). За нулева сила ъгълът няма
 * смисъл и се връща 0.
 */
export function magnitudeAndAngle(Fx: number, Fy: number): MagnitudeAndAngle {
  requireFinite("Проекциите на силата", Fx, Fy);
  const value = Math.hypot(Fx, Fy);
  if (value === 0) return { value: 0, angleDeg: 0 };
  return { value, angleDeg: (Math.atan2(Fy, Fx) * 180) / Math.PI };
}

/**
 * Равнодействаща на сходящи сили (сили с обща точка на директрисите):
 * R_x = ΣF_ix, R_y = ΣF_iy. Приложните точки не участват – равнодействащата
 * минава през общата точка.
 */
export function resultantOfConcurrent(
  forces: ForceComponents[],
): ForceComponents & MagnitudeAndAngle {
  if (forces.length === 0) {
    throw new Error("Нужна е поне една сила.");
  }
  let Fx = 0;
  let Fy = 0;
  for (const force of forces) {
    requireFinite("Проекциите на силата", force.Fx, force.Fy);
    Fx += force.Fx;
    Fy += force.Fy;
  }
  return { Fx, Fy, ...magnitudeAndAngle(Fx, Fy) };
}

/**
 * Момент на сила спрямо точка, kN·m; положителен обратно на часовниковата стрелка:
 * M_P = (x − x_P)·F_y − (y − y_P)·F_x. Без втори аргумент – спрямо началото O.
 */
export function momentAboutPoint(
  force: PlaneForce,
  point: Point = ORIGIN,
): number {
  requireForce(force);
  requirePoint(point);
  return (force.x - point.x) * force.Fy - (force.y - point.y) * force.Fx;
}

/**
 * Рамо на силата спрямо точка, m: най-късото разстояние от точката до директрисата,
 * d = |M| / F. Нулева сила няма директриса – грешка.
 */
export function leverArm(force: PlaneForce, point: Point = ORIGIN): number {
  const moment = momentAboutPoint(force, point);
  const magnitude = Math.hypot(force.Fx, force.Fy);
  if (magnitude === 0) {
    throw new Error("Нулева сила няма директриса и рамо.");
  }
  return Math.abs(moment) / magnitude;
}

/**
 * Момент на двоица сили, kN·m: M = ±F·d, където F е големината на едната сила,
 * а d е рамото (разстоянието между двете директриси). Плюс при въртене обратно
 * на часовниковата стрелка.
 */
export function coupleMoment(
  magnitude: number,
  arm: number,
  sense: RotationSense = "ccw",
): number {
  if (!Number.isFinite(magnitude) || magnitude < 0) {
    throw new Error("Големината на силата трябва да е неотрицателно число.");
  }
  if (!Number.isFinite(arm) || arm < 0) {
    throw new Error("Рамото трябва да е неотрицателно число.");
  }
  const moment = magnitude * arm;
  return sense === "ccw" ? moment : -moment;
}

/**
 * Момент на двоица, зададена с двете си сили. Проверява, че силите са равни
 * по големина и противоположни (сборът им е нула); иначе не са двоица – грешка.
 * Моментът не зависи от точката, затова се смята спрямо приложната точка
 * на втората сила.
 */
export function coupleMomentOfForces(
  first: PlaneForce,
  second: PlaneForce,
): number {
  requireForce(first);
  requireForce(second);
  const scale = Math.max(Math.hypot(first.Fx, first.Fy), 1);
  const tolerance = 1e-9 * scale;
  if (
    Math.abs(first.Fx + second.Fx) > tolerance ||
    Math.abs(first.Fy + second.Fy) > tolerance
  ) {
    throw new Error(
      "Двете сили не са двоица: трябва да са равни и противоположни.",
    );
  }
  return momentAboutPoint(first, second);
}
