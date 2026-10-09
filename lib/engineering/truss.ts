/**
 * Равнинна ферма: прътови усилия по метода на изрязване на възлите и чрез
 * Ритеров разрез, нулеви пръти, статическа определимост.
 *
 * Знаци (както в модула „Теоретична механика – I част“):
 *   оста x сочи надясно, оста y – НАГОРЕ; координати в метри;
 *   товар и реакция са положителни по посока на осите;
 *   момент е положителен ОБРАТНО на часовниковата стрелка: M_O = x·F_y − y·F_x;
 *   прътово усилие S > 0 е ОПЪН (прътът дърпа възела), S < 0 е НАТИСК.
 * Сили и усилия в kN.
 *
 * Фермата е идеална: прави пръти, стави без триене във възлите, товари само
 * във възлите. Опорите са точно три опорни връзки (неподвижна + подвижна опора).
 */
import {
  solvePlaneBody,
  type Constraint,
  type PlaneLoad,
  type Point,
} from "./plane-body.ts";

export type TrussJoint = { id: string; x: number; y: number };

/** Прът между възлите `from` и `to`; `id` е името му (например "AF"). */
export type TrussMember = { id: string; from: string; to: string };

export type TrussSupport = {
  joint: string;
  /** "pinned" – неподвижна шарнирна опора (2 връзки); "roller" – подвижна (1 връзка) */
  type: "pinned" | "roller";
  /** посока на положителната реакция на подвижната опора; по подразбиране 90° (нагоре) */
  angleDeg?: number;
};

/** Товар във възел с проекции fx (надясно) и fy (нагоре), kN. */
export type TrussLoad = { joint: string; fx: number; fy: number };

export type Truss = {
  joints: TrussJoint[];
  members: TrussMember[];
  supports: TrussSupport[];
  loads: TrussLoad[];
};

/** Опорна реакция във възел: проекции, положителни надясно и нагоре, kN. */
export type TrussReaction = { joint: string; fx: number; fy: number };

export type TrussStep = {
  /** възелът, който е изрязан на тази стъпка */
  joint: string;
  /** прътите, чиито усилия са намерени от неговите уравнения */
  found: string[];
};

export type TrussResult = {
  reactions: TrussReaction[];
  /** прътови усилия по име на прът, kN; > 0 опън, < 0 натиск */
  forces: Record<string, number>;
  /** редът, в който са изрязани възлите */
  steps: TrussStep[];
};

const DEG = Math.PI / 180;
const EPS = 1e-9;

function fail(message: string): never {
  throw new Error(message);
}

function validate(truss: Truss): Map<string, TrussJoint> {
  const joints = new Map<string, TrussJoint>();
  for (const joint of truss.joints) {
    if (!Number.isFinite(joint.x) || !Number.isFinite(joint.y)) {
      fail(`Невалидни координати на възел ${joint.id}.`);
    }
    if (joints.has(joint.id)) fail(`Възел ${joint.id} е зададен два пъти.`);
    joints.set(joint.id, joint);
  }
  if (joints.size < 3) fail("Фермата има поне три възела.");

  const memberIds = new Set<string>();
  const pairs = new Set<string>();
  for (const member of truss.members) {
    if (memberIds.has(member.id)) fail(`Прът ${member.id} е зададен два пъти.`);
    memberIds.add(member.id);
    const a = joints.get(member.from);
    const b = joints.get(member.to);
    if (!a || !b) fail(`Прът ${member.id} сочи към несъществуващ възел.`);
    if (Math.hypot(b.x - a.x, b.y - a.y) < EPS) {
      fail(`Прът ${member.id} има нулева дължина.`);
    }
    const pair = [member.from, member.to].sort().join("|");
    if (pairs.has(pair)) fail(`Между два възела има повече от един прът.`);
    pairs.add(pair);
  }
  for (const support of truss.supports) {
    if (!joints.has(support.joint)) fail("Опора в несъществуващ възел.");
    if (support.angleDeg !== undefined && !Number.isFinite(support.angleDeg)) {
      fail("Невалидна посока на подвижната опора.");
    }
  }
  for (const load of truss.loads) {
    if (!joints.has(load.joint)) fail("Товар в несъществуващ възел.");
    if (!Number.isFinite(load.fx) || !Number.isFinite(load.fy)) {
      fail("Невалиден товар.");
    }
  }
  return joints;
}

/** Броят на опорните връзки: 2 за неподвижна опора, 1 за подвижна. */
export function supportLinkCount(supports: TrussSupport[]): number {
  return supports.reduce(
    (sum, support) => sum + (support.type === "pinned" ? 2 : 1),
    0,
  );
}

/**
 * Степен на статическа определимост на ферма: n = m + C − 2·j
 * (m – пръти, C – опорни връзки, j – възли).
 * n = 0 – неизвестните са колкото уравненията (необходимо условие);
 * n > 0 – статически неопределима; n < 0 – геометрично изменяема.
 */
export function trussDeterminacy(input: {
  joints: number;
  members: number;
  supportLinks: number;
}): number {
  const { joints, members, supportLinks } = input;
  const valid = (value: number) => Number.isInteger(value) && value >= 0;
  if (!valid(joints) || !valid(members) || !valid(supportLinks)) {
    throw new Error("Броят на възлите, прътите и връзките е цяло число ≥ 0.");
  }
  return members + supportLinks - 2 * joints;
}

/** Единичен вектор по пръта, насочен от възел `at` към другия му край. */
function directionFrom(
  member: TrussMember,
  at: string,
  joints: Map<string, TrussJoint>,
): { ux: number; uy: number } {
  const here = joints.get(at)!;
  const there = joints.get(member.from === at ? member.to : member.from)!;
  const length = Math.hypot(there.x - here.x, there.y - here.y);
  return { ux: (there.x - here.x) / length, uy: (there.y - here.y) / length };
}

/** Сборът на товарите във възел. */
function loadAt(truss: Truss, joint: string): { fx: number; fy: number } {
  return truss.loads
    .filter((load) => load.joint === joint)
    .reduce((sum, load) => ({ fx: sum.fx + load.fx, fy: sum.fy + load.fy }), {
      fx: 0,
      fy: 0,
    });
}

/**
 * Опорните реакции: фермата се разглежда като едно тяло (диск) с три опорни
 * връзки и се решава със `solvePlaneBody` – както в Глава 3.
 */
export function trussReactions(truss: Truss): TrussReaction[] {
  const joints = validate(truss);
  if (supportLinkCount(truss.supports) !== 3) {
    fail(
      "Опорите трябва да дават точно три опорни връзки (неподвижна и подвижна опора).",
    );
  }
  const constraints: Constraint[] = [];
  const owners: { joint: string; angleDeg: number }[] = [];
  for (const support of truss.supports) {
    const { x, y } = joints.get(support.joint)!;
    const angles =
      support.type === "pinned" ? [0, 90] : [support.angleDeg ?? 90];
    for (const angleDeg of angles) {
      constraints.push({ type: "link", x, y, angleDeg });
      owners.push({ joint: support.joint, angleDeg });
    }
  }
  const loads: PlaneLoad[] = truss.loads.map((load) => {
    const { x, y } = joints.get(load.joint)!;
    return { type: "force", x, y, fx: load.fx, fy: load.fy };
  });
  const values = solvePlaneBody({
    constraints: constraints as [Constraint, Constraint, Constraint],
    loads,
  });

  const reactions = new Map<string, TrussReaction>();
  owners.forEach(({ joint, angleDeg }, index) => {
    const reaction = reactions.get(joint) ?? { joint, fx: 0, fy: 0 };
    // cos 90° не е точно нула в плаваща запетая – закръгля се на 1e-12
    const ux = Math.round(Math.cos(angleDeg * DEG) * 1e12) / 1e12;
    const uy = Math.round(Math.sin(angleDeg * DEG) * 1e12) / 1e12;
    reaction.fx += values[index]! * ux;
    reaction.fy += values[index]! * uy;
    reactions.set(joint, reaction);
  });
  return [...reactions.values()].map((reaction) => ({
    joint: reaction.joint,
    fx: Math.abs(reaction.fx) < 1e-9 ? 0 : reaction.fx,
    fy: Math.abs(reaction.fy) < 1e-9 ? 0 : reaction.fy,
  }));
}

/**
 * Проверка на един възел: сборът по x и по y на товара, реакцията и усилията на
 * всички пръти във възела. При вярно решение и двете числа са нула.
 * Опънат прът (S > 0) дърпа възела по посока на другия си край.
 */
export function jointResidual(
  truss: Truss,
  result: Pick<TrussResult, "reactions" | "forces">,
  joint: string,
): { fx: number; fy: number } {
  const joints = validate(truss);
  if (!joints.has(joint)) fail(`Няма възел ${joint}.`);
  const total = loadAt(truss, joint);
  for (const reaction of result.reactions) {
    if (reaction.joint === joint) {
      total.fx += reaction.fx;
      total.fy += reaction.fy;
    }
  }
  for (const member of truss.members) {
    if (member.from !== joint && member.to !== joint) continue;
    const force = result.forces[member.id];
    if (force === undefined) fail(`Липсва усилието в прът ${member.id}.`);
    const { ux, uy } = directionFrom(member, joint, joints);
    total.fx += force * ux;
    total.fy += force * uy;
  }
  return total;
}

/**
 * Метод на изрязване на възлите – така, както се смята на ръка:
 *   1. опорните реакции от равновесието на цялата ферма;
 *   2. търси се възел с най-много две неизвестни усилия;
 *   3. от ΣF_x = 0 и ΣF_y = 0 за възела се намират те;
 *   4. повтаря се, докато свършат прътите.
 * Възлите се обхождат в реда, в който са зададени. Накрая се проверяват
 * всички възли; ако някой не е в равновесие, функцията хвърля грешка.
 */
export function solveTrussJoints(truss: Truss): TrussResult {
  const joints = validate(truss);
  const n = trussDeterminacy({
    joints: truss.joints.length,
    members: truss.members.length,
    supportLinks: supportLinkCount(truss.supports),
  });
  if (n !== 0) {
    fail(
      n > 0
        ? `Фермата е ${n} пъти статически неопределима: прътите и връзките са повече от 2 × възлите.`
        : "Фермата е геометрично изменяема: прътите и връзките са по-малко от 2 × възлите.",
    );
  }
  const reactions = trussReactions(truss);
  const forces: Record<string, number> = {};
  const steps: TrussStep[] = [];
  const clean = (value: number) => (Math.abs(value) < 1e-9 ? 0 : value);

  let remaining = truss.members.length;
  while (remaining > 0) {
    let progressed = false;
    for (const joint of truss.joints) {
      const here = truss.members.filter(
        (member) => member.from === joint.id || member.to === joint.id,
      );
      const unknown = here.filter((member) => forces[member.id] === undefined);
      if (unknown.length === 0 || unknown.length > 2) continue;

      // известната част: товар, реакция и вече намерените усилия
      const known = loadAt(truss, joint.id);
      for (const reaction of reactions) {
        if (reaction.joint === joint.id) {
          known.fx += reaction.fx;
          known.fy += reaction.fy;
        }
      }
      for (const member of here) {
        const force = forces[member.id];
        if (force === undefined) continue;
        const { ux, uy } = directionFrom(member, joint.id, joints);
        known.fx += force * ux;
        known.fy += force * uy;
      }

      if (unknown.length === 1) {
        // едно неизвестно: проекция по оста на пръта; другото уравнение е проверка
        const member = unknown[0]!;
        const { ux, uy } = directionFrom(member, joint.id, joints);
        forces[member.id] = clean(-(known.fx * ux + known.fy * uy));
      } else {
        const [first, second] = unknown as [TrussMember, TrussMember];
        const a = directionFrom(first, joint.id, joints);
        const b = directionFrom(second, joint.id, joints);
        const det = a.ux * b.uy - a.uy * b.ux;
        // два неизвестни пръта на една права не се разделят от този възел
        if (Math.abs(det) < EPS) continue;
        forces[first.id] = clean((-known.fx * b.uy + known.fy * b.ux) / det);
        forces[second.id] = clean((-a.ux * known.fy + a.uy * known.fx) / det);
      }
      steps.push({
        joint: joint.id,
        found: unknown.map((member) => member.id),
      });
      remaining -= unknown.length;
      progressed = true;
      break;
    }
    if (!progressed) {
      fail(
        "Няма възел с най-много две неизвестни усилия – фермата не се решава възел по възел.",
      );
    }
  }

  for (const joint of truss.joints) {
    const residual = jointResidual(truss, { reactions, forces }, joint.id);
    if (Math.hypot(residual.fx, residual.fy) > 1e-6) {
      fail(
        `Възел ${joint.id} не е в равновесие – фермата е геометрично изменяема.`,
      );
    }
  }
  return { reactions, forces, steps };
}

export type RitterResult = {
  /** усилието в търсения прът, kN; > 0 опън, < 0 натиск */
  force: number;
  /** "moment" – моментово уравнение спрямо Ритеровата точка; "projection" – проекционно */
  method: "moment" | "projection";
  /** Ритеровата точка – пресечната точка на другите два пръта (при "moment") */
  point: Point | null;
  /** рамото на търсеното усилие спрямо Ритеровата точка, m (при "moment") */
  arm: number | null;
};

/**
 * Ритеров разрез. Разрезът минава през трите пръта `cut` и отделя частта с
 * възли `part`. Усилието в `target` се намира от едно уравнение:
 *   – ΣM = 0 спрямо пресечната точка на другите два пръта (Ритерова точка);
 *   – ако другите два са успоредни: проекции върху ос, перпендикулярна на тях.
 * Върху частта действат нейните товари и опорни реакции и трите усилия,
 * насочени НАВЪН от частта (приет опън).
 */
export function ritterSection(
  truss: Truss,
  section: { cut: [string, string, string]; target: string; part: string[] },
): RitterResult {
  const joints = validate(truss);
  const { cut, target, part } = section;
  if (new Set(cut).size !== 3) fail("Разрезът минава през три различни пръта.");
  if (!cut.includes(target)) fail("Търсеният прът трябва да е от разрязаните.");
  const inside = new Set(part);
  if (inside.size === 0) fail("Частта няма възли.");
  for (const id of inside) {
    if (!joints.has(id)) fail(`Няма възел ${id}.`);
  }

  // Разрезът трябва да отделя частта: всеки прът между частта и останалото е разрязан.
  for (const member of truss.members) {
    const crosses = inside.has(member.from) !== inside.has(member.to);
    if (crosses !== cut.includes(member.id)) {
      fail(
        crosses
          ? `Прът ${member.id} свързва двете части, но не е в разреза.`
          : `Прът ${member.id} не е между двете части.`,
      );
    }
  }
  const members = cut.map(
    (id) =>
      truss.members.find((member) => member.id === id) ??
      fail(`Няма прът ${id}.`),
  );

  /** за разрязан прът: възелът му в частта и посоката навън от нея */
  const outward = (member: TrussMember) => {
    const at = inside.has(member.from) ? member.from : member.to;
    return { origin: joints.get(at)!, ...directionFrom(member, at, joints) };
  };
  const wanted = outward(members[cut.indexOf(target)]!);
  const [first, second] = members
    .filter((member) => member.id !== target)
    .map(outward) as [ReturnType<typeof outward>, ReturnType<typeof outward>];

  // външните сили върху частта: товари и опорни реакции
  const external: { x: number; y: number; fx: number; fy: number }[] = [];
  for (const load of truss.loads) {
    if (!inside.has(load.joint)) continue;
    const { x, y } = joints.get(load.joint)!;
    external.push({ x, y, fx: load.fx, fy: load.fy });
  }
  for (const reaction of trussReactions(truss)) {
    if (!inside.has(reaction.joint)) continue;
    const { x, y } = joints.get(reaction.joint)!;
    external.push({ x, y, fx: reaction.fx, fy: reaction.fy });
  }

  const cross = first.ux * second.uy - first.uy * second.ux;
  if (Math.abs(cross) < EPS) {
    // успоредни пръти: Ритеровата точка е в безкрайността → проекционно уравнение
    const nx = -first.uy;
    const ny = first.ux;
    const along = wanted.ux * nx + wanted.uy * ny;
    if (Math.abs(along) < EPS) {
      fail("Трите разрязани пръта са успоредни – разрезът не е Ритеров.");
    }
    const sum = external.reduce(
      (total, force) => total + force.fx * nx + force.fy * ny,
      0,
    );
    return {
      force: -sum / along + 0,
      method: "projection",
      point: null,
      arm: null,
    };
  }

  // пресечна точка на двата други пръта: first.origin + t·first.u
  const dx = second.origin.x - first.origin.x;
  const dy = second.origin.y - first.origin.y;
  const t = (dx * second.uy - dy * second.ux) / cross;
  const point = {
    x: first.origin.x + t * first.ux + 0,
    y: first.origin.y + t * first.uy + 0,
  };
  // моментът на единично усилие по търсения прът спрямо Ритеровата точка
  const lever =
    (wanted.origin.x - point.x) * wanted.uy -
    (wanted.origin.y - point.y) * wanted.ux;
  if (Math.abs(lever) < EPS) {
    fail(
      "Трите разрязани пръта минават през една точка – разрезът не е Ритеров.",
    );
  }
  const moment = external.reduce(
    (total, force) =>
      total + (force.x - point.x) * force.fy - (force.y - point.y) * force.fx,
    0,
  );
  return {
    force: -moment / lever + 0,
    method: "moment",
    point,
    arm: Math.abs(lever),
  };
}

/**
 * Нулеви пръти, разпознати само по правилата – без да се смятат усилия.
 *
 * Общо правило за възел без неподвижна опора: ако всички сили във възела освен
 * усилието в един прът лежат на една права (или други сили няма), а този прът
 * не е на правата, усилието му е нула. От него следват трите познати правила:
 *   1. ненатоварен възел с два пръта, които не са на една права – и двата са нулеви;
 *   2. ненатоварен възел с три пръта, два от които са на една права – третият е нулев;
 *   3. възел с два пръта и товар по оста на единия – другият е нулев.
 * Намерен нулев прът се „маха“ и правилата се прилагат отново.
 * Реакцията на подвижна опора се брои за сила с известна посока.
 */
export function zeroForceMembers(truss: Truss): string[] {
  const joints = validate(truss);
  const zero = new Set<string>();
  const parallel = (
    a: { ux: number; uy: number },
    b: { ux: number; uy: number },
  ) => Math.abs(a.ux * b.uy - a.uy * b.ux) < EPS;

  let changed = true;
  while (changed) {
    changed = false;
    for (const joint of truss.joints) {
      const support = truss.supports.filter((s) => s.joint === joint.id);
      if (support.some((s) => s.type === "pinned") || support.length > 1) {
        continue; // реакцията е с неизвестна посока – правилата не важат
      }
      const active = truss.members.filter(
        (member) =>
          (member.from === joint.id || member.to === joint.id) &&
          !zero.has(member.id),
      );
      /** посоките на товара и на реакцията на подвижната опора */
      const others: { ux: number; uy: number }[] = [];
      const load = loadAt(truss, joint.id);
      const size = Math.hypot(load.fx, load.fy);
      if (size > EPS) others.push({ ux: load.fx / size, uy: load.fy / size });
      if (support.length === 1) {
        const angle = (support[0]!.angleDeg ?? 90) * DEG;
        others.push({ ux: Math.cos(angle), uy: Math.sin(angle) });
      }

      for (const member of active) {
        const own = directionFrom(member, joint.id, joints);
        const rest = [
          ...others,
          ...active
            .filter((other) => other.id !== member.id)
            .map((other) => directionFrom(other, joint.id, joints)),
        ];
        const line = rest[0];
        const onOneLine = rest.every((direction) => parallel(direction, line!));
        if (onOneLine && (line === undefined || !parallel(own, line))) {
          zero.add(member.id);
          changed = true;
          break;
        }
      }
    }
  }
  return truss.members
    .filter((member) => zero.has(member.id))
    .map((member) => member.id);
}
