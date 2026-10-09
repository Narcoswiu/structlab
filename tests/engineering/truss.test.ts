import { describe, expect, it } from "vitest";
import {
  jointResidual,
  ritterSection,
  solveTrussJoints,
  supportLinkCount,
  trussDeterminacy,
  trussReactions,
  zeroForceMembers,
  type Truss,
  type TrussLoad,
} from "@/lib/engineering/truss";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Знаци: x надясно, y нагоре; момент обратно на часовниковата стрелка = плюс;
// прътово усилие S > 0 е опън, S < 0 е натиск. Сили в kN, дължини в m.

/** Пръти по име: "AF" е прътът между възлите A и F. */
const members = (ids: string[]) =>
  ids.map((id) => ({ id, from: id[0]!, to: id[1]! }));

const down = (joint: string, value: number): TrussLoad => ({
  joint,
  fx: 0,
  fy: -value,
});

const SUPPORTS: Truss["supports"] = [
  { joint: "A", type: "pinned" },
  { joint: "B", type: "roller" },
];

/** Триъгълна ферма: A(0;0), B(span;0), C(span/2; height), сила надолу в C. */
const triangle = (span: number, height: number, force: number): Truss => ({
  joints: [
    { id: "A", x: 0, y: 0 },
    { id: "B", x: span, y: 0 },
    { id: "C", x: span / 2, y: height },
  ],
  members: members(["AC", "CB", "AB"]),
  supports: SUPPORTS,
  loads: [down("C", force)],
});

/**
 * Ферма с успоредни пояси: 4 полета по 3 m, височина h.
 * Долни възли A, C, D, E, B; горни F, G, H. Диагонали при h = 4 m: 3–4–5,
 * cos α = 0,6 и sin α = 0,8.
 */
const PARALLEL_MEMBERS = [
  ...["AC", "CD", "DE", "EB"], // долен пояс
  ...["FG", "GH"], // горен пояс
  ...["AF", "HB"], // крайни диагонали
  ...["CF", "DG", "EH"], // вертикали
  ...["FD", "DH"], // диагонали
];
const parallel = (loads: TrussLoad[], h = 4): Truss => ({
  joints: [
    { id: "A", x: 0, y: 0 },
    { id: "C", x: 3, y: 0 },
    { id: "D", x: 6, y: 0 },
    { id: "E", x: 9, y: 0 },
    { id: "B", x: 12, y: 0 },
    { id: "F", x: 3, y: h },
    { id: "G", x: 6, y: h },
    { id: "H", x: 9, y: h },
  ],
  members: members(PARALLEL_MEMBERS),
  supports: SUPPORTS,
  loads,
});

/** Пример 1 от „Подробно“: 40 kN ↓ във F, 20 kN ↓ в G, 12 kN → в H. */
const exam = parallel([
  down("F", 40),
  down("G", 20),
  { joint: "H", fx: 12, fy: 0 },
]);

/** Фермата-мост: по 20 kN ↓ в долните възли C, D, E. */
const bridge = (h = 4) =>
  parallel([down("C", 20), down("D", 20), down("E", 20)], h);

/** Пример 3 от „Подробно“: покривна ферма, наклон 3–4–5 (cos β = 0,8; sin β = 0,6). */
const roof: Truss = {
  joints: [
    { id: "A", x: 0, y: 0 },
    { id: "D", x: 4, y: 0 },
    { id: "B", x: 8, y: 0 },
    { id: "C", x: 2, y: 1.5 },
    { id: "E", x: 4, y: 3 },
    { id: "F", x: 6, y: 1.5 },
  ],
  members: members(["AC", "CE", "EF", "FB", "AD", "DB", "CD", "DE", "FD"]),
  supports: SUPPORTS,
  loads: [down("C", 12), down("E", 12), down("F", 24)],
};

const LEFT_CUT = {
  cut: ["FG", "FD", "CD"] as [string, string, string],
  part: ["A", "C", "F"],
};

/**
 * Независимо решение: цялата ферма като ЕДНА линейна система.
 * Неизвестни: m прътови усилия + 3 реакции (A_h, A_v, B_v). Уравнения: ΣF_x = 0
 * и ΣF_y = 0 за всеки възел (2·j). Решава се с Гаусово изключване с избор на
 * главен елемент – без да се ползва нищо от truss.ts.
 */
function solveAsLinearSystem(truss: Truss) {
  const j = truss.joints.length;
  const m = truss.members.length;
  const size = 2 * j;
  expect(m + 3).toBe(size);
  const index = new Map(truss.joints.map((joint, i) => [joint.id, i]));
  const a: number[][] = Array.from({ length: size }, () =>
    new Array<number>(size + 1).fill(0),
  );
  truss.members.forEach((member, k) => {
    const p = truss.joints[index.get(member.from)!]!;
    const q = truss.joints[index.get(member.to)!]!;
    const length = Math.hypot(q.x - p.x, q.y - p.y);
    const ux = (q.x - p.x) / length;
    const uy = (q.y - p.y) / length;
    // опънат прът дърпа всеки от двата си възела към другия
    a[2 * index.get(member.from)!]![k]! += ux;
    a[2 * index.get(member.from)! + 1]![k]! += uy;
    a[2 * index.get(member.to)!]![k]! -= ux;
    a[2 * index.get(member.to)! + 1]![k]! -= uy;
  });
  const pin = index.get("A")!;
  const roller = index.get("B")!;
  a[2 * pin]![m] = 1; // A_h
  a[2 * pin + 1]![m + 1] = 1; // A_v
  a[2 * roller + 1]![m + 2] = 1; // B_v
  for (const load of truss.loads) {
    a[2 * index.get(load.joint)!]![size]! -= load.fx;
    a[2 * index.get(load.joint)! + 1]![size]! -= load.fy;
  }
  for (let col = 0; col < size; col++) {
    let pivot = col;
    for (let row = col + 1; row < size; row++) {
      if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
    }
    expect(Math.abs(a[pivot]![col]!)).toBeGreaterThan(1e-9);
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    for (let row = 0; row < size; row++) {
      if (row === col) continue;
      const factor = a[row]![col]! / a[col]![col]!;
      for (let k = col; k <= size; k++) a[row]![k]! -= factor * a[col]![k]!;
    }
  }
  const x = a.map((row, i) => row[size]! / row[i]!);
  const forces: Record<string, number> = {};
  truss.members.forEach((member, k) => (forces[member.id] = x[k]!));
  return { forces, Ah: x[m]!, Av: x[m + 1]!, Bv: x[m + 2]! };
}

/** Общи проверки за всяка ферма от главата. */
function expectConsistent(truss: Truss) {
  const result = solveTrussJoints(truss);
  // всеки възел е в равновесие и по x, и по y
  for (const joint of truss.joints) {
    const residual = jointResidual(truss, result, joint.id);
    expect(residual.fx).toBeCloseTo(0, 9);
    expect(residual.fy).toBeCloseTo(0, 9);
  }
  // цялата ферма като една система дава същото
  const system = solveAsLinearSystem(truss);
  for (const member of truss.members) {
    expect(result.forces[member.id]).toBeCloseTo(system.forces[member.id]!, 9);
  }
  const A = result.reactions.find((r) => r.joint === "A")!;
  const B = result.reactions.find((r) => r.joint === "B")!;
  expect(A.fx).toBeCloseTo(system.Ah, 9);
  expect(A.fy).toBeCloseTo(system.Av, 9);
  expect(B.fy).toBeCloseTo(system.Bv, 9);
  expect(B.fx).toBe(0);
  // нулевите пръти по правилата наистина имат усилие 0
  for (const id of zeroForceMembers(truss)) {
    expect(result.forces[id]).toBeCloseTo(0, 9);
  }
  return result;
}

const reaction = (truss: Truss, joint: string) =>
  trussReactions(truss).find((r) => r.joint === joint)!;

describe("статическа определимост", () => {
  it("n = m + C − 2j", () => {
    // фермата от „Виж“: 13 + 3 − 2·8 = 0; триъгълник: 3 + 3 − 6 = 0
    expect(trussDeterminacy({ joints: 8, members: 13, supportLinks: 3 })).toBe(
      0,
    );
    expect(trussDeterminacy({ joints: 3, members: 3, supportLinks: 3 })).toBe(
      0,
    );
    // покривната ферма: 9 + 3 − 12 = 0
    expect(trussDeterminacy({ joints: 6, members: 9, supportLinks: 3 })).toBe(
      0,
    );
    // квадратът от загадката: 4 пръта, 4 възела → липсва един прът
    expect(trussDeterminacy({ joints: 4, members: 4, supportLinks: 3 })).toBe(
      -1,
    );
    // „Леко“, въпрос 2: 7 възела → 2·7 − 3 = 11 пръта
    expect(trussDeterminacy({ joints: 7, members: 11, supportLinks: 3 })).toBe(
      0,
    );
    // „Подробно“, въпрос 1: 16 + 3 − 20 = −1; нужни са 17 пръта
    expect(trussDeterminacy({ joints: 10, members: 16, supportLinks: 3 })).toBe(
      -1,
    );
    expect(trussDeterminacy({ joints: 10, members: 17, supportLinks: 3 })).toBe(
      0,
    );
    // един прът в повече → веднъж статически неопределима
    expect(trussDeterminacy({ joints: 8, members: 14, supportLinks: 3 })).toBe(
      1,
    );
  });

  it("броят на опорните връзки и на прътите в примерите", () => {
    expect(supportLinkCount(SUPPORTS)).toBe(3);
    expect(exam.members).toHaveLength(13);
    expect(roof.members).toHaveLength(9);
  });

  it("отхвърля невалиден вход", () => {
    expect(() =>
      trussDeterminacy({ joints: 2.5, members: 3, supportLinks: 3 }),
    ).toThrow();
    expect(() =>
      trussDeterminacy({ joints: 3, members: -1, supportLinks: 3 }),
    ).toThrow();
  });
});

describe("„Леко“, Пример 1 – триъгълна ферма 4 × 1,5 m, 12 kN", () => {
  const truss = triangle(4, 1.5, 12);

  it("реакции и усилия", () => {
    // B_v·4 − 12·2 = 0 → B_v = 6; A_v = 12 − 6 = 6; A_h = 0
    // AC: √(2² + 1,5²) = 2,5 m → sin = 0,6; cos = 0,8
    // възел A: 6 + 0,6·S_AC = 0 → S_AC = −10; S_AB + 0,8·(−10) = 0 → S_AB = 8
    const result = expectConsistent(truss);
    expect(reaction(truss, "A")).toEqual({ joint: "A", fx: 0, fy: 6 });
    expect(reaction(truss, "B")).toEqual({ joint: "B", fx: 0, fy: 6 });
    expect(result.forces.AC).toBeCloseTo(-10, 9);
    expect(result.forces.AB).toBeCloseTo(8, 9);
    expect(result.forces.CB).toBeCloseTo(-10, 9);
  });

  it("проверката във възел C от текста: −12 + 0,6·10 + 0,6·10 = 0", () => {
    expect(-12 + 0.6 * 10 + 0.6 * 10).toBeCloseTo(0, 12);
    const residual = jointResidual(truss, solveTrussJoints(truss), "C");
    expect(residual.fy).toBeCloseTo(0, 9);
  });

  it("няма нулеви пръти", () => {
    expect(zeroForceMembers(truss)).toEqual([]);
  });
});

describe("„Леко“, въпрос 3 – триъгълна ферма 6 × 4 m, 16 kN", () => {
  it("S_AC = −10 kN, S_AB = 6 kN", () => {
    // реакции по 8; AC = 5 m → sin = 0,8; cos = 0,6
    // 8 + 0,8·S_AC = 0 → S_AC = −10; S_AB + 0,6·(−10) = 0 → S_AB = 6
    const truss = triangle(6, 4, 16);
    const result = expectConsistent(truss);
    expect(reaction(truss, "A").fy).toBeCloseTo(8, 9);
    expect(result.forces.AC).toBeCloseTo(-10, 9);
    expect(result.forces.AB).toBeCloseTo(6, 9);
  });
});

describe("„Подробно“, Пример 1 – ферма с успоредни пояси (изпитен тип)", () => {
  it("реакции", () => {
    // ΣF_x: A_h + 12 = 0 → A_h = −12
    // ΣM_A: B_v·12 − 40·3 − 20·6 − 12·4 = 0 → B_v = 288/12 = 24
    // ΣF_y: A_v = 40 + 20 − 24 = 36
    const A = reaction(exam, "A");
    const B = reaction(exam, "B");
    expect(A.fx).toBeCloseTo(-12, 9);
    expect(A.fy).toBeCloseTo(36, 9);
    expect(B.fy).toBeCloseTo(24, 9);
    // проверката от текста, ΣM_B: −36·12 + 40·9 + 20·6 − 12·4 = 0
    expect(-36 * 12 + 40 * 9 + 20 * 6 - 12 * 4).toBe(0);
  });

  it("всички 13 усилия по метода на възлите", () => {
    // A: 36 + 0,8·S_AF = 0 → −45;  −12 + S_AC + 0,6·(−45) = 0 → 39
    // C: S_CD = S_AC = 39; S_CF = 0
    // F: −40 − 0,8·(−45) − 0,8·S_FD = 0 → −5;  27 − 3 + S_FG = 0 → −24
    // G: S_GH = −24;  −20 − S_DG = 0 → −20
    // D: −4 − 20 + 0,8·S_DH = 0 → 30;  −39 + 3 + 18 + S_DE = 0 → 18
    // E: S_EB = 18; S_EH = 0
    // H: −0,8·30 − 0,8·S_HB = 0 → −30
    const { forces } = expectConsistent(exam);
    const expected: Record<string, number> = {
      AC: 39,
      CD: 39,
      DE: 18,
      EB: 18,
      FG: -24,
      GH: -24,
      AF: -45,
      HB: -30,
      CF: 0,
      DG: -20,
      EH: 0,
      FD: -5,
      DH: 30,
    };
    for (const [id, value] of Object.entries(expected)) {
      expect(forces[id], id).toBeCloseTo(value, 9);
    }
  });

  it("трите проверки от текста (неизползваните уравнения)", () => {
    // H, ΣF_x: 12 − (−24) − 0,6·30 + 0,6·(−30) = 0
    expect(12 - -24 - 0.6 * 30 + 0.6 * -30).toBeCloseTo(0, 12);
    // B, ΣF_y: 24 + 0,8·(−30) = 0;  B, ΣF_x: −18 − 0,6·(−30) = 0
    expect(24 + 0.8 * -30).toBeCloseTo(0, 12);
    expect(-18 - 0.6 * -30).toBeCloseTo(0, 12);
  });

  it("нулевите пръти по правило 2 са CF и EH", () => {
    expect(zeroForceMembers(exam)).toEqual(["CF", "EH"]);
  });

  it("решава възел с най-много две неизвестни на всяка стъпка", () => {
    const { steps } = solveTrussJoints(exam);
    expect(steps[0]).toEqual({ joint: "A", found: ["AC", "AF"] });
    expect(steps.every((step) => step.found.length <= 2)).toBe(true);
    expect(steps.flatMap((step) => step.found)).toHaveLength(13);
  });
});

describe("„Подробно“, Пример 2 – Ритеров разрез FG–FD–CD", () => {
  const joints = solveTrussJoints(exam).forces;

  it("S_FG от ΣM_D = 0", () => {
    // −36·6 + 40·3 − S_FG·4 = 0 → S_FG = −96/4 = −24
    const result = ritterSection(exam, { ...LEFT_CUT, target: "FG" });
    expect(result.method).toBe("moment");
    expect(result.point).toEqual({ x: 6, y: 0 });
    expect(result.arm).toBeCloseTo(4, 9);
    expect(result.force).toBeCloseTo(-24, 9);
    expect(result.force).toBeCloseTo(joints.FG!, 9);
  });

  it("S_CD от ΣM_F = 0", () => {
    // −36·3 − 12·4 + S_CD·4 = 0 → S_CD = 156/4 = 39
    const result = ritterSection(exam, { ...LEFT_CUT, target: "CD" });
    expect(result.point).toEqual({ x: 3, y: 4 });
    expect(result.arm).toBeCloseTo(4, 9);
    expect(result.force).toBeCloseTo(39, 9);
    expect(result.force).toBeCloseTo(joints.CD!, 9);
  });

  it("S_FD от ΣF_y = 0 (успоредни пояси)", () => {
    // 36 − 40 − 0,8·S_FD = 0 → S_FD = −5
    const result = ritterSection(exam, { ...LEFT_CUT, target: "FD" });
    expect(result.method).toBe("projection");
    expect(result.point).toBeNull();
    expect(result.force).toBeCloseTo(-5, 9);
    expect(result.force).toBeCloseTo(joints.FD!, 9);
  });

  it("проверката от текста, ΣF_x на лявата част: −12 − 24 + 39 + 0,6·(−5) = 0", () => {
    expect(-12 - 24 + 39 + 0.6 * -5).toBeCloseTo(0, 12);
  });

  it("дясната част дава същите усилия като метода на възлите", () => {
    // разрез GH–DH–DE, част B, E, H:
    // ΣM_D: 24·6 − 12·4 + S_GH·4 = 0 → −24;  ΣM_H: 24·3 − S_DE·4 = 0 → 18
    // ΣF_y: 24 − 0,8·S_DH = 0 → 30
    const cut = {
      cut: ["GH", "DH", "DE"] as [string, string, string],
      part: ["B", "E", "H"],
    };
    expect(ritterSection(exam, { ...cut, target: "GH" }).force).toBeCloseTo(
      -24,
      9,
    );
    expect(ritterSection(exam, { ...cut, target: "DE" }).force).toBeCloseTo(
      18,
      9,
    );
    expect(ritterSection(exam, { ...cut, target: "DH" }).force).toBeCloseTo(
      30,
      9,
    );
    for (const id of cut.cut) {
      expect(ritterSection(exam, { ...cut, target: id }).force).toBeCloseTo(
        joints[id]!,
        9,
      );
    }
  });

  it("същият разрез, гледан отдясно (възли D, G, E, H, B), дава същото", () => {
    const part = ["D", "G", "E", "H", "B"];
    for (const id of LEFT_CUT.cut) {
      const right = ritterSection(exam, {
        cut: LEFT_CUT.cut,
        part,
        target: id,
      });
      expect(right.force).toBeCloseTo(joints[id]!, 9);
    }
  });
});

describe("„Подробно“, Пример 3 – покривна ферма", () => {
  const cut = {
    cut: ["CE", "CD", "AD"] as [string, string, string],
    part: ["A", "C"],
  };

  it("реакции", () => {
    // B_v·8 − 12·2 − 12·4 − 24·6 = 0 → B_v = 216/8 = 27; A_v = 48 − 27 = 21
    expect(reaction(roof, "A")).toEqual({ joint: "A", fx: 0, fy: 21 });
    expect(reaction(roof, "B").fy).toBeCloseTo(27, 9);
  });

  it("S_CD от ΣM_A = 0, рамо 2,4 m", () => {
    // r = 2·0,6 + 1,5·0,8 = 2,4;  −12·2 − S_CD·2,4 = 0 → S_CD = −10
    expect(2 * 0.6 + 1.5 * 0.8).toBeCloseTo(2.4, 12);
    const result = ritterSection(roof, { ...cut, target: "CD" });
    expect(result.point!.x).toBeCloseTo(0, 9);
    expect(result.point!.y).toBeCloseTo(0, 9);
    expect(result.arm).toBeCloseTo(2.4, 9);
    expect(result.force).toBeCloseTo(-10, 9);
  });

  it("S_AD от ΣM_C = 0, рамо 1,5 m", () => {
    // −21·2 + S_AD·1,5 = 0 → S_AD = 28
    const result = ritterSection(roof, { ...cut, target: "AD" });
    expect(result.point!.x).toBeCloseTo(2, 9);
    expect(result.point!.y).toBeCloseTo(1.5, 9);
    expect(result.arm).toBeCloseTo(1.5, 9);
    expect(result.force).toBeCloseTo(28, 9);
  });

  it("S_CE от ΣM_D = 0, рамо 2,4 m", () => {
    // −21·4 + 12·2 − S_CE·2,4 = 0 → S_CE = −60/2,4 = −25
    const result = ritterSection(roof, { ...cut, target: "CE" });
    expect(result.point!.x).toBeCloseTo(4, 9);
    expect(result.point!.y).toBeCloseTo(0, 9);
    expect(result.arm).toBeCloseTo(2.4, 9);
    expect(result.force).toBeCloseTo(-25, 9);
  });

  it("проверките от текста: ΣF_x и ΣF_y на лявата част", () => {
    expect(28 + 0.8 * -25 + 0.8 * -10).toBeCloseTo(0, 12);
    expect(21 - 12 + 0.6 * -25 - 0.6 * -10).toBeCloseTo(0, 12);
  });

  it("методът на възлите дава същото за всички 9 пръта", () => {
    // A: 21 + 0,6·S_AC = 0 → −35; S_AD = 0,8·35 = 28
    // C: S_CE + S_CD = −35 и S_CE − S_CD = −15 → S_CE = −25, S_CD = −10
    // B: 27 + 0,6·S_FB = 0 → −45; S_DB = 0,8·45 = 36
    // F: S_EF + S_FD = −45 и S_EF − S_FD = −5 → S_EF = −25, S_FD = −20
    // E: 0,6·25 + 0,6·25 − 12 − S_DE = 0 → S_DE = 18
    const { forces } = expectConsistent(roof);
    const expected: Record<string, number> = {
      AC: -35,
      CE: -25,
      EF: -25,
      FB: -45,
      AD: 28,
      DB: 36,
      CD: -10,
      FD: -20,
      DE: 18,
    };
    for (const [id, value] of Object.entries(expected)) {
      expect(forces[id], id).toBeCloseTo(value, 9);
    }
    for (const id of cut.cut) {
      expect(ritterSection(roof, { ...cut, target: id }).force).toBeCloseTo(
        forces[id]!,
        9,
      );
    }
    expect(zeroForceMembers(roof)).toEqual([]);
  });
});

describe("фермата-мост („Леко“, Пример 2 и „В реалния живот“)", () => {
  it("реакции по 30 kN и нулев прът DG", () => {
    // товарите са 3·20 = 60 kN, симетрични → по 30 kN
    const truss = bridge();
    expect(reaction(truss, "A")).toEqual({ joint: "A", fx: 0, fy: 30 });
    expect(reaction(truss, "B").fy).toBeCloseTo(30, 9);
    // възел G е ненатоварен, FG и GH са на една права → DG е нулев
    expect(zeroForceMembers(truss)).toEqual(["DG"]);
  });

  it("Ритеров разрез: S_FG = −30, S_CD = 22,5, S_FD = 12,5 kN", () => {
    // ΣM_D: −30·6 + 20·3 − S_FG·4 = 0 → S_FG = −120/4 = −30
    // ΣM_F: −30·3 + S_CD·4 = 0 → S_CD = 22,5
    // ΣF_y: 30 − 20 − 0,8·S_FD = 0 → S_FD = 12,5
    const truss = bridge();
    expect(
      ritterSection(truss, { ...LEFT_CUT, target: "FG" }).force,
    ).toBeCloseTo(-30, 9);
    expect(
      ritterSection(truss, { ...LEFT_CUT, target: "CD" }).force,
    ).toBeCloseTo(22.5, 9);
    expect(
      ritterSection(truss, { ...LEFT_CUT, target: "FD" }).force,
    ).toBeCloseTo(12.5, 9);
    // проверката от текста, ΣF_x на лявата част: −30 + 22,5 + 0,6·12,5 = 0
    expect(-30 + 22.5 + 0.6 * 12.5).toBeCloseTo(0, 12);
  });

  it("всички усилия по метода на възлите", () => {
    // A: 30 + 0,8·S_AF = 0 → −37,5; S_AC = 0,6·37,5 = 22,5
    // C: S_CF = 20 (носи товара); F: 30 − 20 − 0,8·S_FD = 0 → 12,5
    const { forces } = expectConsistent(bridge());
    const expected: Record<string, number> = {
      AC: 22.5,
      CD: 22.5,
      DE: 22.5,
      EB: 22.5,
      FG: -30,
      GH: -30,
      AF: -37.5,
      HB: -37.5,
      CF: 20,
      EH: 20,
      FD: 12.5,
      DH: 12.5,
      DG: 0,
    };
    for (const [id, value] of Object.entries(expected)) {
      expect(forces[id], id).toBeCloseTo(value, 9);
    }
  });

  it("усилията в поясите са обратно пропорционални на височината", () => {
    // S_FG = −120/h: 4 m → −30; 3 m → −40; 2 m → −60
    // S_CD = 90/h: 4 m → 22,5; 3 m → 30; 2 m → 45
    for (const [h, top, bottom] of [
      [4, -30, 22.5],
      [3, -40, 30],
      [2, -60, 45],
    ] as const) {
      const truss = bridge(h);
      expect(
        ritterSection(truss, { ...LEFT_CUT, target: "FG" }).force,
      ).toBeCloseTo(top, 9);
      expect(
        ritterSection(truss, { ...LEFT_CUT, target: "CD" }).force,
      ).toBeCloseTo(bottom, 9);
      expect(-120 / h).toBeCloseTo(top, 12);
      expect(90 / h).toBeCloseTo(bottom, 12);
      const { forces } = expectConsistent(truss);
      expect(forces.FG).toBeCloseTo(top, 9);
      expect(forces.CD).toBeCloseTo(bottom, 9);
    }
  });
});

describe("„Подробно“, въпроси 2–4", () => {
  it("въпроси 2 и 3: само 48 kN надолу в G", () => {
    // реакции по 24; G: S_DG = −48; C: S_CF = 0; A: 24 + 0,8·S_AF = 0 → −30
    // ΣM_D: −24·6 − S_FG·4 = 0 → −36;  ΣM_F: −24·3 + S_CD·4 = 0 → 18
    // ΣF_y: 24 − 0,8·S_FD = 0 → 30
    const truss = parallel([down("G", 48)]);
    const { forces } = expectConsistent(truss);
    expect(reaction(truss, "A").fy).toBeCloseTo(24, 9);
    expect(reaction(truss, "B").fy).toBeCloseTo(24, 9);
    expect(forces.DG).toBeCloseTo(-48, 9);
    expect(forces.CF).toBeCloseTo(0, 9);
    expect(forces.AF).toBeCloseTo(-30, 9);
    expect(
      ritterSection(truss, { ...LEFT_CUT, target: "FG" }).force,
    ).toBeCloseTo(-36, 9);
    expect(
      ritterSection(truss, { ...LEFT_CUT, target: "CD" }).force,
    ).toBeCloseTo(18, 9);
    expect(
      ritterSection(truss, { ...LEFT_CUT, target: "FD" }).force,
    ).toBeCloseTo(30, 9);
    expect(forces.FG).toBeCloseTo(-36, 9);
    expect(forces.CD).toBeCloseTo(18, 9);
    expect(forces.FD).toBeCloseTo(30, 9);
    expect(zeroForceMembers(truss)).toEqual(["CF", "EH"]);
  });

  it("въпрос 4: само 12 kN надясно в H", () => {
    // A_h = −12;  B_v·12 − 12·4 = 0 → B_v = 4;  A_v = −4
    // A: −4 + 0,8·S_AF = 0 → S_AF = 5 (опън)
    const truss = parallel([{ joint: "H", fx: 12, fy: 0 }]);
    const { forces } = expectConsistent(truss);
    expect(reaction(truss, "A").fx).toBeCloseTo(-12, 9);
    expect(reaction(truss, "A").fy).toBeCloseTo(-4, 9);
    expect(reaction(truss, "B").fy).toBeCloseTo(4, 9);
    expect(forces.AF).toBeCloseTo(5, 9);
    // трите вертикала са нулеви: C и E по правило 2, G – също
    expect(zeroForceMembers(truss)).toEqual(["CF", "DG", "EH"]);
  });
});

describe("правила за нулеви пръти", () => {
  it("правило 1: ненатоварен възел с два пръта, които не са на една права", () => {
    // към триъгълника A–B–C е добавен възел K с пръти CK и BK, без товар
    const truss: Truss = {
      joints: [...triangle(4, 1.5, 12).joints, { id: "K", x: 4, y: 1.5 }],
      members: members(["AC", "CB", "AB", "CK", "BK"]),
      supports: SUPPORTS,
      loads: [down("C", 12)],
    };
    expect(zeroForceMembers(truss)).toEqual(["CK", "BK"]);
    const { forces } = expectConsistent(truss);
    expect(forces.CK).toBe(0);
    expect(forces.BK).toBe(0);
    expect(forces.AC).toBeCloseTo(-10, 9);
  });

  it("правило 3: товар по оста на единия от два пръта", () => {
    // същата ферма, но във възел K действа 9 kN надолу – по оста на пръта BK
    // (K е точно над B). CK е нулев, а BK е натиснат с 9 kN.
    const truss: Truss = {
      joints: [...triangle(4, 1.5, 12).joints, { id: "K", x: 4, y: 1.5 }],
      members: members(["AC", "CB", "AB", "CK", "BK"]),
      supports: SUPPORTS,
      loads: [down("C", 12), down("K", 9)],
    };
    expect(zeroForceMembers(truss)).toEqual(["CK"]);
    const { forces } = expectConsistent(truss);
    expect(forces.CK).toBe(0);
    expect(forces.BK).toBeCloseTo(-9, 9);
    // товарът слиза направо в опората B: B_v = 6 + 9 = 15
    expect(reaction(truss, "B").fy).toBeCloseTo(15, 9);
  });

  it("натоварен възел не попада под правило 2", () => {
    // при товари в горните възли вертикалът DG носи товара от G
    expect(zeroForceMembers(exam)).not.toContain("DG");
  });
});

describe("проверка на входа", () => {
  it("статически неопределима и изменяема ферма", () => {
    const extra: Truss = {
      ...exam,
      members: [...exam.members, { id: "CG", from: "C", to: "G" }],
    };
    expect(() => solveTrussJoints(extra)).toThrow(/неопределима/);
    const missing: Truss = {
      ...exam,
      members: exam.members.filter((member) => member.id !== "FD"),
    };
    expect(() => solveTrussJoints(missing)).toThrow(/изменяема/);
  });

  it("верен брой пръти, но грешно разположени", () => {
    // диагоналът FD е махнат, а в полето D–E–H–G е добавен втори диагонал EG:
    // броят е верен (13), но полето C–D–G–F остава без диагонал и се сгъва
    const truss: Truss = {
      ...exam,
      members: [
        ...exam.members.filter((member) => member.id !== "FD"),
        { id: "EG", from: "E", to: "G" },
      ],
    };
    expect(() => solveTrussJoints(truss)).toThrow();
  });

  it("невалидни данни", () => {
    expect(() => solveTrussJoints({ ...exam, loads: [down("X", 5)] })).toThrow(
      /несъществуващ/,
    );
    expect(() =>
      solveTrussJoints({
        ...exam,
        members: [...exam.members, { id: "AQ", from: "A", to: "Q" }],
      }),
    ).toThrow(/несъществуващ/);
    expect(() =>
      trussReactions({ ...exam, supports: [{ joint: "A", type: "pinned" }] }),
    ).toThrow(/три опорни връзки/);
    expect(() =>
      solveTrussJoints({ ...exam, loads: [{ joint: "F", fx: NaN, fy: 0 }] }),
    ).toThrow();
  });

  it("невалиден Ритеров разрез", () => {
    // търсеният прът не е от разрязаните
    expect(() => ritterSection(exam, { ...LEFT_CUT, target: "AF" })).toThrow();
    // разрезът не отделя частта: прът CD свързва C с D, а не е посочен
    expect(() =>
      ritterSection(exam, {
        cut: ["FG", "FD", "DG"],
        part: ["A", "C", "F"],
        target: "FG",
      }),
    ).toThrow();
    // изрязан възел E на покривната ферма: трите пръта минават през една точка
    expect(() =>
      ritterSection(roof, {
        cut: ["CE", "EF", "DE"],
        part: ["E"],
        target: "DE",
      }),
    ).toThrow(/една точка/);
  });
});
