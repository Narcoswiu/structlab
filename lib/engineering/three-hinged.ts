/**
 * Триставни системи (Теоретична механика – I част, Глава 5): триставна рамка,
 * триставна дъга и диада.
 *
 * Системата се състои от две части (диска). Лявата е свързана със земята с
 * неподвижна шарнирна опора A, дясната – с неподвижна шарнирна опора B, а
 * двете части са свързани помежду си със става G. Неизвестните опорни реакции
 * са четири: A_h, A_v, B_h, B_v. Уравненията са трите условия за равновесие на
 * цялата система и условието „моментът в ставата е нула“ за едната част.
 *
 * Знаци (както в целия модул): оста x сочи надясно, оста y – НАГОРЕ; координати
 * в метри; сила е положителна по посока на осите; момент е положителен ОБРАТНО
 * на часовниковата стрелка: M_O = x·F_y − y·F_x. Сили в kN, моменти в kN·m,
 * разпределени товари в kN/m. Отрицателна реакция означава посока, обратна на
 * приетата (надясно и нагоре).
 *
 * Формата на частите (прави, начупени или криви) не влиза в сметките –
 * реакциите зависят само от положението на трите стави и от товарите.
 */
import {
  loadResultant,
  reduceLoads,
  type PlaneLoad,
  type Point,
  type Reduction,
} from "./plane-body.ts";

export type ThreeHingedPart = "left" | "right";

export type ThreeHingedLoad = {
  /**
   * частта, върху която действа товарът: "left" – частта A–G, "right" – G–B.
   * Товар точно в ставата G се приписва на една от двете части; реакциите не
   * зависят от избора, ставните сили – зависят.
   */
  part: ThreeHingedPart;
  load: PlaneLoad;
};

export type ThreeHingedSystem = {
  /** лявата неподвижна шарнирна опора, m */
  A: Point;
  /** дясната неподвижна шарнирна опора, m */
  B: Point;
  /** средната става, m */
  G: Point;
  loads: ThreeHingedLoad[];
};

export type ThreeHingedResult = {
  /** хоризонтална реакция в A, kN, > 0 надясно */
  Ah: number;
  /** вертикална реакция в A, kN, > 0 нагоре */
  Av: number;
  /** хоризонтална реакция в B, kN, > 0 надясно */
  Bh: number;
  /** вертикална реакция в B, kN, > 0 нагоре */
  Bv: number;
  /**
   * Ставни сили: проекциите на силата, с която ЛЯВАТА част действа върху
   * ДЯСНАТА в ставата G; kN, > 0 надясно и нагоре. Върху лявата част действат
   * същите сили с обратна посока.
   */
  Gh: number;
  Gv: number;
};

/** под тази стойност на детерминантата трите стави се приемат за колинеарни */
const SINGULAR = 1e-9;

function assertPoint(point: Point, name: string) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
    throw new Error(`Невалидни координати на точка ${name}.`);
  }
}

function loadsOf(system: ThreeHingedSystem, part?: ThreeHingedPart) {
  return system.loads
    .filter((entry) => part === undefined || entry.part === part)
    .map((entry) => entry.load);
}

function validate(system: ThreeHingedSystem) {
  assertPoint(system.A, "A");
  assertPoint(system.B, "B");
  assertPoint(system.G, "G");
  if (!Array.isArray(system.loads)) {
    throw new Error("Товарите трябва да са списък.");
  }
  for (const entry of system.loads) {
    if (entry.part !== "left" && entry.part !== "right") {
      throw new Error('Всеки товар трябва да е върху част "left" или "right".');
    }
    // loadResultant проверява числата на самия товар
    loadResultant(entry.load);
  }
}

/**
 * Детерминантата на двете моментови уравнения (ΣM_A за цялото и ΣM_G за
 * дясната част) спрямо неизвестните B_v и B_h:
 *   Δ = (x_B − x_A)(y_G − y_B) + (y_B − y_A)(x_B − x_G).
 * Δ е двойното ориентирано лице на триъгълника A–G–B; Δ = 0 точно когато трите
 * стави лежат на една права. За опори на едно ниво Δ = l·f.
 */
export function threeHingedDeterminant(A: Point, B: Point, G: Point): number {
  return (B.x - A.x) * (G.y - B.y) + (B.y - A.y) * (B.x - G.x);
}

/**
 * Опорни реакции и ставни сили на триставна система.
 *
 * Уравнения (моментите са положителни обратно на часовниковата стрелка):
 *   ΣM_A = 0 за цялото:     (x_B − x_A)·B_v − (y_B − y_A)·B_h + M_A(товари) = 0
 *   ΣM_G = 0 за дясната част: (x_B − x_G)·B_v − (y_B − y_G)·B_h + M_G(товари вдясно) = 0
 *   ΣF_x = 0, ΣF_y = 0 за цялото → A_h, A_v
 *   ΣF_x = 0, ΣF_y = 0 за дясната част → G_h, G_v
 * Ако трите стави са на една права, системата е мигновено изменяема и
 * функцията хвърля грешка.
 */
export function solveThreeHinged(system: ThreeHingedSystem): ThreeHingedResult {
  validate(system);
  const { A, B, G } = system;
  const det = threeHingedDeterminant(A, B, G);
  if (Math.abs(det) < SINGULAR) {
    throw new Error(
      "Системата е геометрично изменяема: трите стави лежат на една права.",
    );
  }

  const all = reduceLoads(loadsOf(system), A);
  const right = reduceLoads(loadsOf(system, "right"), G);

  // a1·B_v + b1·B_h = c1;  a2·B_v + b2·B_h = c2
  const a1 = B.x - A.x;
  const b1 = -(B.y - A.y);
  const c1 = -all.moment;
  const a2 = B.x - G.x;
  const b2 = -(B.y - G.y);
  const c2 = -right.moment;
  const d = a1 * b2 - a2 * b1; // = det
  const Bv = (c1 * b2 - c2 * b1) / d;
  const Bh = (a1 * c2 - a2 * c1) / d;

  // „+ 0“ превръща −0 в 0
  return {
    Ah: -all.fx - Bh + 0,
    Av: -all.fy - Bv + 0,
    Bh: Bh + 0,
    Bv: Bv + 0,
    Gh: -right.fx - Bh + 0,
    Gv: -right.fy - Bv + 0,
  };
}

/**
 * Проверка на равновесието: ΣF_x, ΣF_y и ΣM спрямо точка `about` за цялата
 * система ("whole") или за една от частите заедно с нейната опорна реакция и
 * ставната сила. При вярно решение и трите сбора са нула.
 */
export function threeHingedResiduals(
  system: ThreeHingedSystem,
  result: ThreeHingedResult,
  scope: "whole" | ThreeHingedPart,
  about: Point = { x: 0, y: 0 },
): Reduction {
  validate(system);
  assertPoint(about, "about");
  const { A, B, G } = system;
  const total = reduceLoads(
    loadsOf(system, scope === "whole" ? undefined : scope),
    about,
  );
  const add = (at: Point, fx: number, fy: number) => {
    total.fx += fx;
    total.fy += fy;
    total.moment += (at.x - about.x) * fy - (at.y - about.y) * fx;
  };
  if (scope !== "right") add(A, result.Ah, result.Av);
  if (scope !== "left") add(B, result.Bh, result.Bv);
  if (scope === "right") add(G, result.Gh, result.Gv);
  if (scope === "left") add(G, -result.Gh, -result.Gv);
  return total;
}

/**
 * Разпор при вертикални товари и опори на едно ниво: H = M_G⁰ / f.
 * `beamMoment` е гредовият момент M_G⁰ (kN·m) – сборът от моментите спрямо G
 * на вертикалните сили от едната страна на ставата, същият като при проста
 * греда със същия отвор; `rise` е височината f на ставата над опорите (m).
 * Резултатът е в kN; при H > 0 опорите бутат конструкцията навътре.
 */
export function beamMomentThrust(beamMoment: number, rise: number): number {
  if (!Number.isFinite(beamMoment)) {
    throw new Error("Невалиден гредов момент.");
  }
  if (!Number.isFinite(rise) || rise <= 0) {
    throw new Error("Височината на ставата трябва да е положителна.");
  }
  return beamMoment / rise;
}

/**
 * Разпор на симетрична триставна дъга (или рамка) със става в средата на
 * отвора при равномерен вертикален товар q (kN/m хоризонтална дължина) по
 * целия отвор: H = q·l² / (8·f). `span` е отворът l, `rise` – височината f; m.
 */
export function uniformLoadThrust(
  q: number,
  span: number,
  rise: number,
): number {
  if (!Number.isFinite(q)) throw new Error("Невалиден товар.");
  if (!Number.isFinite(span) || span <= 0) {
    throw new Error("Отворът трябва да е положителен.");
  }
  return beamMomentThrust((q * span * span) / 8, rise);
}

export type DyadResult = {
  /** усилие в пръта A–G, kN; > 0 – опън, < 0 – натиск */
  SA: number;
  /** усилие в пръта B–G, kN; > 0 – опън, < 0 – натиск */
  SB: number;
};

/**
 * Диада: два пръта A–G и B–G, свързани със става G, натоварени само със сила
 * (fx; fy) във възела G. Прътите са ненатоварени по дължината си, затова
 * усилията им са по осите. Решава се равновесието на възела G (сходящи сили):
 *   S_A·u_A + S_B·u_B + F = 0,
 * където u_A и u_B са единичните вектори от G към A и от G към B.
 * Опън е положителен. Ако прътите са на една права, функцията хвърля грешка.
 */
export function solveDyad(dyad: {
  A: Point;
  B: Point;
  G: Point;
  fx: number;
  fy: number;
}): DyadResult {
  const { A, B, G, fx, fy } = dyad;
  assertPoint(A, "A");
  assertPoint(B, "B");
  assertPoint(G, "G");
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) {
    throw new Error("Невалидна сила във възела.");
  }
  const lengthA = Math.hypot(A.x - G.x, A.y - G.y);
  const lengthB = Math.hypot(B.x - G.x, B.y - G.y);
  if (!(lengthA > 0) || !(lengthB > 0)) {
    throw new Error("Прътите трябва да имат дължина.");
  }
  const uA = { x: (A.x - G.x) / lengthA, y: (A.y - G.y) / lengthA };
  const uB = { x: (B.x - G.x) / lengthB, y: (B.y - G.y) / lengthB };
  const det = uA.x * uB.y - uA.y * uB.x;
  if (Math.abs(det) < SINGULAR) {
    throw new Error(
      "Системата е геометрично изменяема: двата пръта лежат на една права.",
    );
  }
  // S_A·uA + S_B·uB = −F
  return {
    SA: (-fx * uB.y + fy * uB.x) / det + 0,
    SB: (-uA.x * fy + uA.y * fx) / det + 0,
  };
}
