import { describe, expect, it } from "vitest";
import {
  beamMomentThrust,
  solveDyad,
  solveThreeHinged,
  threeHingedDeterminant,
  threeHingedResiduals,
  uniformLoadThrust,
  type ThreeHingedLoad,
  type ThreeHingedPart,
  type ThreeHingedResult,
  type ThreeHingedSystem,
} from "@/lib/engineering/three-hinged";
import {
  loadResultant,
  solveSupportReactions,
  staticDeterminacy,
  type PlaneLoad,
  type Point,
} from "@/lib/engineering/plane-body";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Знаци: x надясно, y нагоре, момент обратно на часовниковата стрелка = плюс.
// Реакциите A_h, A_v, B_h, B_v са приети надясно и нагоре. Ставните сили
// G_h, G_v са силите, с които лявата част действа върху дясната.

/** Сила право надолу с големина `value` в точка (x; y). */
const down = (
  part: ThreeHingedPart,
  x: number,
  y: number,
  value: number,
): ThreeHingedLoad => ({
  part,
  load: { type: "force", x, y, fx: 0, fy: -value },
});

/** Равномерен товар надолу върху хоризонтален участък x1–x2 на височина y. */
const uniform = (
  part: ThreeHingedPart,
  x1: number,
  x2: number,
  y: number,
  q: number,
): ThreeHingedLoad => ({
  part,
  load: { type: "uniform", from: { x: x1, y }, to: { x: x2, y }, q },
});

type Force = { at: Point; fx: number; fy: number };

/** Товарите като съсредоточени сили (равнодействащи); двоиците – отделно. */
function forcesOf(loads: PlaneLoad[]): { forces: Force[]; couple: number } {
  const forces: Force[] = [];
  let couple = 0;
  for (const load of loads) {
    const r = loadResultant(load);
    if (load.type === "couple") couple += r.couple;
    else forces.push({ at: r.at, fx: r.fx, fy: r.fy });
  }
  return { forces, couple };
}

/** ΣF_x, ΣF_y и ΣM спрямо `about` – смятани тук, независимо от three-hinged.ts. */
function sums(forces: Force[], couple: number, about: Point) {
  let fx = 0;
  let fy = 0;
  let moment = couple;
  for (const f of forces) {
    fx += f.fx;
    fy += f.fy;
    moment += (f.at.x - about.x) * f.fy - (f.at.y - about.y) * f.fx;
  }
  return { fx, fy, moment };
}

/** Всички сили върху цялото или върху една част: товари, реакции, ставна сила. */
function freeBody(
  system: ThreeHingedSystem,
  result: ThreeHingedResult,
  scope: "whole" | ThreeHingedPart,
) {
  const { forces, couple } = forcesOf(
    system.loads
      .filter((entry) => scope === "whole" || entry.part === scope)
      .map((entry) => entry.load),
  );
  if (scope !== "right") {
    forces.push({ at: system.A, fx: result.Ah, fy: result.Av });
  }
  if (scope !== "left") {
    forces.push({ at: system.B, fx: result.Bh, fy: result.Bv });
  }
  if (scope === "right") {
    forces.push({ at: system.G, fx: result.Gh, fy: result.Gv });
  }
  if (scope === "left") {
    forces.push({ at: system.G, fx: -result.Gh, fy: -result.Gv });
  }
  return { forces, couple };
}

/**
 * Момент в ставата G от силите върху едната част БЕЗ ставната сила
 * (тя минава през G и няма момент). Трябва да е нула и отляво, и отдясно.
 */
function hingeMoment(
  system: ThreeHingedSystem,
  result: ThreeHingedResult,
  part: ThreeHingedPart,
) {
  const { forces, couple } = forcesOf(
    system.loads.filter((e) => e.part === part).map((e) => e.load),
  );
  forces.push(
    part === "left"
      ? { at: system.A, fx: result.Ah, fy: result.Av }
      : { at: system.B, fx: result.Bh, fy: result.Bv },
  );
  return sums(forces, couple, system.G).moment;
}

/**
 * Независимо решение: една линейна система 4 × 4 за [A_h, A_v, B_h, B_v].
 * Уравнения: ΣF_x = 0; ΣF_y = 0; ΣM = 0 за цялото спрямо точка P извън
 * системата; ΣM_G = 0 за ЛЯВАТА част (three-hinged.ts ползва дясната и точка A).
 * Гаусово изключване с избор на главен елемент; null при изродена матрица.
 */
function solveAsLinearSystem(system: ThreeHingedSystem): number[] | null {
  const { A, B, G } = system;
  const P = { x: -3.7, y: 11.3 };
  const all = forcesOf(system.loads.map((e) => e.load));
  const left = forcesOf(
    system.loads.filter((e) => e.part === "left").map((e) => e.load),
  );
  const sAll = sums(all.forces, all.couple, P);
  const sLeft = sums(left.forces, left.couple, G);
  const rows: number[][] = [
    [1, 0, 1, 0, -sAll.fx],
    [0, 1, 0, 1, -sAll.fy],
    [-(A.y - P.y), A.x - P.x, -(B.y - P.y), B.x - P.x, -sAll.moment],
    [-(A.y - G.y), A.x - G.x, 0, 0, -sLeft.moment],
  ];
  const n = 4;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(rows[r]![col]!) > Math.abs(rows[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(rows[pivot]![col]!) < 1e-9) return null;
    [rows[col], rows[pivot]] = [rows[pivot]!, rows[col]!];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = rows[r]![col]! / rows[col]![col]!;
      for (let c = col; c <= n; c++) rows[r]![c]! -= factor * rows[col]![c]!;
    }
  }
  return rows.map((row, i) => row[n]! / row[i]!);
}

/** Общите проверки, които важат за всяка правилно решена триставна система. */
function expectConsistent(system: ThreeHingedSystem): ThreeHingedResult {
  const result = solveThreeHinged(system);
  const points = [system.A, system.B, system.G, { x: 7.3, y: -2.6 }];
  // 1) цялото и всяка от двете части удовлетворяват и трите уравнения
  for (const scope of ["whole", "left", "right"] as const) {
    const body = freeBody(system, result, scope);
    for (const about of points) {
      const s = sums(body.forces, body.couple, about);
      expect(s.fx).toBeCloseTo(0, 9);
      expect(s.fy).toBeCloseTo(0, 9);
      expect(s.moment).toBeCloseTo(0, 9);
      // същото през функцията от библиотеката
      const r = threeHingedResiduals(system, result, scope, about);
      expect(r.fx).toBeCloseTo(0, 9);
      expect(r.fy).toBeCloseTo(0, 9);
      expect(r.moment).toBeCloseTo(0, 9);
    }
  }
  // 2) моментът в средната става е нула – смятан отляво и отдясно
  expect(hingeMoment(system, result, "left")).toBeCloseTo(0, 9);
  expect(hingeMoment(system, result, "right")).toBeCloseTo(0, 9);
  // 3) независимото решение на системата 4 × 4 дава същите реакции
  const independent = solveAsLinearSystem(system);
  expect(independent).not.toBeNull();
  [result.Ah, result.Av, result.Bh, result.Bv].forEach((value, i) => {
    expect(value).toBeCloseTo(independent![i]!, 9);
  });
  return result;
}

describe("статическа определимост на триставната система", () => {
  it("n = C + 2S − 3D = 4 + 2·1 − 3·2 = 0", () => {
    expect(staticDeterminacy({ disks: 2, hinges: 1, supportLinks: 4 })).toBe(0);
  });

  it("без средната става: един диск с 4 връзки, n = 4 − 3 = 1", () => {
    expect(staticDeterminacy({ disks: 1, hinges: 0, supportLinks: 4 })).toBe(1);
  });
});

describe("пример Л1 = П1: триставна рамка 8 × 4 m със сила 40 kN", () => {
  // A(0; 0), B(8; 0), G(4; 4). Сила 40 kN надолу при x = 2 m върху ригела.
  const system: ThreeHingedSystem = {
    A: { x: 0, y: 0 },
    B: { x: 8, y: 0 },
    G: { x: 4, y: 4 },
    loads: [down("left", 2, 4, 40)],
  };

  it("реакции: A_h = 10, A_v = 30, B_h = −10, B_v = 10 kN", () => {
    // ΣM_A = 0: B_v·8 − 40·2 = 0 → B_v = 10.   ΣF_y = 0: A_v = 40 − 10 = 30.
    // Дясна част, ΣM_G = 0: B_v·4 + B_h·4 = 0 → B_h = −10 (наляво).
    // ΣF_x = 0: A_h = −B_h = 10.
    const r = expectConsistent(system);
    expect(r.Ah).toBeCloseTo(10, 12);
    expect(r.Av).toBeCloseTo(30, 12);
    expect(r.Bh).toBeCloseTo(-10, 12);
    expect(r.Bv).toBeCloseTo(10, 12);
  });

  it("ставни сили върху дясната част: G_h = 10, G_v = −10 kN", () => {
    // Дясна част: G_h + B_h = 0 → G_h = 10;  G_v + B_v = 0 → G_v = −10.
    const r = solveThreeHinged(system);
    expect(r.Gh).toBeCloseTo(10, 12);
    expect(r.Gv).toBeCloseTo(-10, 12);
  });

  it("проверките от текста, сметнати на ръка", () => {
    // Лява част спрямо G: −30·4 + 10·4 + 40·2 = −120 + 40 + 80 = 0.
    expect(-30 * 4 + 10 * 4 + 40 * 2).toBe(0);
    // Цялото спрямо B: −30·8 + 40·6 = 0.
    expect(-30 * 8 + 40 * 6).toBe(0);
    // Лява част: ΣF_x = 10 − 10 = 0;  ΣF_y = 30 − 40 + 10 = 0.
    const r = solveThreeHinged(system);
    expect(r.Ah - r.Gh).toBeCloseTo(0, 12);
    expect(r.Av - 40 - r.Gv).toBeCloseTo(0, 12);
  });

  it("разпор: H = M_G⁰ / f = (30·4 − 40·2) / 4 = 10 kN", () => {
    expect(beamMomentThrust(30 * 4 - 40 * 2, 4)).toBeCloseTo(10, 12);
  });

  it("вертикалните реакции са като на проста греда със същия отвор", () => {
    const beam = solveSupportReactions(
      { type: "pin-roller", pin: system.A, roller: system.B },
      system.loads.map((e) => e.load),
    );
    expect(beam.Av).toBeCloseTo(30, 12);
    expect(beam.Bv).toBeCloseTo(10, 12);
  });

  it("реакцията в B е по правата B–G (дясната част е ненатоварена)", () => {
    // Векторно произведение на (B_h; B_v) и (G − B) = (−4; 4): −10·4 − 10·(−4) = 0.
    const r = solveThreeHinged(system);
    expect(r.Bh * 4 - r.Bv * -4).toBeCloseTo(0, 12);
  });

  it("трите сили се пресичат в K(2; 6): реакцията в A минава през K", () => {
    // Правата B–G: от B(8; 0) с наклон −1 → при x = 2 е y = 6. Директрисата на
    // силата е x = 2. Реакцията в A сочи към K: A_v / A_h = 30 / 10 = 6 / 2.
    const r = solveThreeHinged(system);
    const K = { x: 2, y: (8 - 2) * 1 };
    expect(K.y).toBe(6);
    expect(r.Ah * K.y - r.Av * K.x).toBeCloseTo(0, 12);
    expect(r.Av / r.Ah).toBeCloseTo(6 / 2, 12);
    // и реакцията в B минава през K: (K − B) × (B_h; B_v) = 0
    expect((K.x - 8) * r.Bv - K.y * r.Bh).toBeCloseTo(0, 12);
  });

  it("формата на частите не влияе: същата сила на друга височина", () => {
    const other = solveThreeHinged({
      ...system,
      loads: [down("left", 2, 1.3, 40)],
    });
    expect(other.Bh).toBeCloseTo(-10, 12);
    expect(other.Av).toBeCloseTo(30, 12);
  });
});

describe("пример П2 (изпитен тип): опори на различни нива", () => {
  // A(0; 0), C(0; 6), G(4; 6), D(8; 6), B(8; 2).
  // 4 kN/m надясно върху стойката AC; 6 kN/m надолу от C до G; 20 kN при x = 6.
  const system: ThreeHingedSystem = {
    A: { x: 0, y: 0 },
    B: { x: 8, y: 2 },
    G: { x: 4, y: 6 },
    loads: [
      {
        part: "left",
        load: {
          type: "uniform",
          from: { x: 0, y: 0 },
          to: { x: 0, y: 6 },
          q: 4,
          angleDeg: 0,
        },
      },
      uniform("left", 0, 4, 6, 6),
      down("right", 6, 6, 20),
    ],
  };

  it("равнодействащи: R_q1 = 24 kN при y = 3 m; R_q2 = 24 kN при x = 2 m", () => {
    const wind = loadResultant(system.loads[0]!.load);
    expect(wind.fx).toBeCloseTo(24, 12);
    expect(wind.fy).toBeCloseTo(0, 12);
    expect(wind.at).toEqual({ x: 0, y: 3 });
    const q = loadResultant(system.loads[1]!.load);
    expect(q.fy).toBeCloseTo(-24, 12);
    expect(q.at).toEqual({ x: 2, y: 6 });
  });

  it("реакции: A_h = −8, A_v = 18, B_h = −16, B_v = 26 kN", () => {
    // ΣM_A = 0: B_v·8 − B_h·2 − 24·3 − 24·2 − 20·6 = 0 → 8·B_v − 2·B_h = 240.
    // Дясна част, ΣM_G = 0: B_v·4 + B_h·4 − 20·2 = 0 → B_v + B_h = 10.
    // B_h = 10 − B_v → 10·B_v = 260 → B_v = 26;  B_h = −16.
    // ΣF_y: A_v = 24 + 20 − 26 = 18.  ΣF_x: A_h + 24 − 16 = 0 → A_h = −8.
    const r = expectConsistent(system);
    expect(r.Ah).toBeCloseTo(-8, 12);
    expect(r.Av).toBeCloseTo(18, 12);
    expect(r.Bh).toBeCloseTo(-16, 12);
    expect(r.Bv).toBeCloseTo(26, 12);
    // двете уравнения от текста
    expect(8 * r.Bv - 2 * r.Bh).toBeCloseTo(240, 12);
    expect(r.Bv + r.Bh).toBeCloseTo(10, 12);
  });

  it("ставни сили върху дясната част: G_h = 16, G_v = −6 kN", () => {
    // G_h + B_h = 0 → 16;  G_v + B_v − 20 = 0 → G_v = −6.
    const r = solveThreeHinged(system);
    expect(r.Gh).toBeCloseTo(16, 12);
    expect(r.Gv).toBeCloseTo(-6, 12);
  });

  it("проверките от текста, сметнати на ръка", () => {
    // Лява част спрямо G(4; 6): −18·4 − 8·6 + 24·3 + 24·2 = −72 − 48 + 72 + 48 = 0.
    expect(-18 * 4 - 8 * 6 + 24 * 3 + 24 * 2).toBe(0);
    // Цялото спрямо B(8; 2): −18·8 − 8·2 − 24·1 + 24·6 + 20·2
    //   = −144 − 16 − 24 + 144 + 40 = 0.
    expect(-18 * 8 - 8 * 2 - 24 * 1 + 24 * 6 + 20 * 2).toBe(0);
    // Лява част: ΣF_x = −8 + 24 − 16 = 0;  ΣF_y = 18 − 24 + 6 = 0.
    expect(-8 + 24 - 16).toBe(0);
    expect(18 - 24 + 6).toBe(0);
  });

  it("детерминантата: Δ = l·f₂ + c·l₂ = 8·4 + 2·4 = 40", () => {
    expect(threeHingedDeterminant(system.A, system.B, system.G)).toBe(40);
  });
});

describe("пример П3: триставна дъга с товар върху половината отвор", () => {
  // A(0; 0), B(16; 0), G(8; 4). 10 kN/m върху хоризонталната проекция, 0–8 m.
  // Товарът е зададен на височината на опорите – височината не влияе на
  // момента на вертикална сила.
  const system: ThreeHingedSystem = {
    A: { x: 0, y: 0 },
    B: { x: 16, y: 0 },
    G: { x: 8, y: 4 },
    loads: [uniform("left", 0, 8, 0, 10)],
  };

  it("реакции: A_v = 60, B_v = 20, A_h = 40, B_h = −40 kN", () => {
    // R_q = 80 kN при x = 4.  B_v = 80·4/16 = 20;  A_v = 60.
    // Дясна част: 20·8 + B_h·4 = 0 → B_h = −40;  A_h = 40.
    const r = expectConsistent(system);
    expect(r.Av).toBeCloseTo(60, 12);
    expect(r.Bv).toBeCloseTo(20, 12);
    expect(r.Ah).toBeCloseTo(40, 12);
    expect(r.Bh).toBeCloseTo(-40, 12);
    expect(r.Gh).toBeCloseTo(40, 12);
    expect(r.Gv).toBeCloseTo(-20, 12);
  });

  it("H = M_G⁰ / f = (60·8 − 80·4) / 4 = 160 / 4 = 40 kN", () => {
    expect(60 * 8 - 80 * 4).toBe(160);
    expect(beamMomentThrust(160, 4)).toBeCloseTo(40, 12);
    // проверката от текста: лява част спрямо G: −60·8 + 40·4 + 80·4 = 0
    expect(-60 * 8 + 40 * 4 + 80 * 4).toBe(0);
  });

  it("реакцията в B сочи към G: B_v / |B_h| = 20 / 40 = 4 / 8", () => {
    const r = solveThreeHinged(system);
    expect(r.Bv / Math.abs(r.Bh)).toBeCloseTo(4 / 8, 12);
  });

  it("товар по целия отвор: симетрични реакции и H = q·l²/(8·f) = 80 kN", () => {
    // A_v = B_v = 10·16/2 = 80;  H = 10·256/(8·4) = 80.
    const r = expectConsistent({
      ...system,
      loads: [uniform("left", 0, 8, 0, 10), uniform("right", 8, 16, 0, 10)],
    });
    expect(r.Av).toBeCloseTo(80, 12);
    expect(r.Bv).toBeCloseTo(80, 12);
    expect(r.Ah).toBeCloseTo(80, 12);
    expect(r.Bh).toBeCloseTo(-80, 12);
    expect(uniformLoadThrust(10, 16, 4)).toBeCloseTo(80, 12);
  });
});

describe("пример П4: диада", () => {
  // A(0; 0), B(7; 0), G(3; 4); сила 70 kN надолу във възела G.
  const A = { x: 0, y: 0 };
  const B = { x: 7, y: 0 };
  const G = { x: 3, y: 4 };
  const system: ThreeHingedSystem = {
    A,
    B,
    G,
    loads: [down("left", 3, 4, 70)],
  };

  it("реакции: A_h = 30, A_v = 40, B_h = −30, B_v = 30 kN", () => {
    // B_v = 70·3/7 = 30;  A_v = 40.  Дясна част: 30·4 + B_h·4 = 0 → B_h = −30.
    const r = expectConsistent(system);
    expect(r.Ah).toBeCloseTo(30, 12);
    expect(r.Av).toBeCloseTo(40, 12);
    expect(r.Bh).toBeCloseTo(-30, 12);
    expect(r.Bv).toBeCloseTo(30, 12);
  });

  it("реакциите не зависят от това на коя част е приписана силата в G", () => {
    const r = expectConsistent({ ...system, loads: [down("right", 3, 4, 70)] });
    expect(
      [r.Ah, r.Av, r.Bh, r.Bv].map((v) => Math.round(v * 1e9) / 1e9),
    ).toEqual([30, 40, -30, 30]);
  });

  it("прътови усилия: S_A = −50 kN, S_B = −42,43 kN – и двете натиск", () => {
    // |S_A| = √(30² + 40²) = 50;  |S_B| = √(30² + 30²) = 42,426.
    const r = solveThreeHinged(system);
    expect(Math.hypot(r.Ah, r.Av)).toBeCloseTo(50, 12);
    expect(Math.hypot(r.Bh, r.Bv)).toBeCloseTo(42.43, 2);
    // независимо: равновесие на възела G (опън > 0)
    const bars = solveDyad({ A, B, G, fx: 0, fy: -70 });
    expect(bars.SA).toBeCloseTo(-50, 12);
    expect(bars.SB).toBeCloseTo(-42.43, 2);
    expect(bars.SB).toBeCloseTo(-30 * Math.SQRT2, 12);
  });

  it("дължини на прътите: AG = 5 m, BG = 5,657 m", () => {
    expect(Math.hypot(3, 4)).toBe(5);
    expect(Math.hypot(4, 4)).toBeCloseTo(5.657, 3);
  });

  it("реакцията в A е по оста на пръта: A_v / A_h = 40 / 30 = 4 / 3", () => {
    const r = solveThreeHinged(system);
    expect(r.Av / r.Ah).toBeCloseTo(4 / 3, 12);
  });

  it("проверката на възела със закръглените числа от текста", () => {
    // хоризонтално: −0,6·(−50) + 0,7071·(−42,43) = 30 − 30,00 = 0,00
    expect(-0.6 * -50 + 0.7071 * -42.43).toBeCloseTo(0, 2);
    // вертикално: −0,8·(−50) − 0,7071·(−42,43) − 70 = 40 + 30,00 − 70 = 0,00
    expect(-0.8 * -50 - 0.7071 * -42.43 - 70).toBeCloseTo(0, 2);
    expect(42.43 * 0.7071).toBeCloseTo(30.0, 2);
  });

  it("сила, която дърпа възела нагоре, опъва прътите", () => {
    const bars = solveDyad({ A, B, G, fx: 0, fy: 70 });
    expect(bars.SA).toBeCloseTo(50, 12);
    expect(bars.SB).toBeGreaterThan(0);
  });
});

describe("в реалния живот: дъга на хале 24 m", () => {
  // l = 24 m, q = 10 kN/m по целия отвор, става в средата.
  const arch = (rise: number): ThreeHingedSystem => ({
    A: { x: 0, y: 0 },
    B: { x: 24, y: 0 },
    G: { x: 12, y: rise },
    loads: [uniform("left", 0, 12, 0, 10), uniform("right", 12, 24, 0, 10)],
  });

  it("f = 4 m: A_v = B_v = 120 kN, H = 5760/32 = 180 kN", () => {
    const r = expectConsistent(arch(4));
    expect(r.Av).toBeCloseTo(120, 12);
    expect(r.Bv).toBeCloseTo(120, 12);
    expect(r.Ah).toBeCloseTo(180, 12);
    expect(r.Bh).toBeCloseTo(-180, 12);
    expect(10 * 24 * 24).toBe(5760);
    expect(uniformLoadThrust(10, 24, 4)).toBeCloseTo(180, 12);
    // в ключа ставната сила е само хоризонтална
    expect(r.Gh).toBeCloseTo(180, 12);
    expect(r.Gv).toBeCloseTo(0, 12);
  });

  it("f = 2 m: разпорът се удвоява, H = 5760/16 = 360 kN", () => {
    const r = expectConsistent(arch(2));
    expect(r.Ah).toBeCloseTo(360, 12);
    expect(r.Av).toBeCloseTo(120, 12);
    expect(uniformLoadThrust(10, 24, 2)).toBeCloseTo(360, 12);
  });

  it("с обтегач и подвижна опора: само вертикални реакции по 120 kN", () => {
    const beam = solveSupportReactions(
      { type: "pin-roller", pin: { x: 0, y: 0 }, roller: { x: 24, y: 0 } },
      arch(4).loads.map((e) => e.load),
    );
    expect(beam.Ah).toBeCloseTo(0, 12);
    expect(beam.Av).toBeCloseTo(120, 12);
    expect(beam.Bv).toBeCloseTo(120, 12);
  });
});

describe("въпросите от „Провери се“", () => {
  const frame = (loads: ThreeHingedLoad[]): ThreeHingedSystem => ({
    A: { x: 0, y: 0 },
    B: { x: 6, y: 0 },
    G: { x: 3, y: 3 },
    loads,
  });

  it("рамка 6 × 3 m, 24 kN на 1,5 m: B_v = 6, A_v = 18, B_h = −6, A_h = 6", () => {
    // B_v = 24·1,5/6 = 6;  A_v = 18.  Дясна част: 6·3 + B_h·3 = 0 → B_h = −6.
    const r = expectConsistent(frame([down("left", 1.5, 3, 24)]));
    expect(r.Bv).toBeCloseTo(6, 12);
    expect(r.Av).toBeCloseTo(18, 12);
    expect(r.Bh).toBeCloseTo(-6, 12);
    expect(r.Ah).toBeCloseTo(6, 12);
    // сборът на хоризонталните реакции при вертикален товар е нула
    expect(r.Ah + r.Bh).toBeCloseTo(0, 12);
  });

  it("същата рамка, 12 kN надясно във възел C(0; 3): всички по 6 kN", () => {
    // ΣM_A: B_v·6 − 12·3 = 0 → B_v = 6;  A_v = −6.
    // Дясна част: 6·3 + B_h·3 = 0 → B_h = −6;  A_h = −12 + 6 = −6.
    const r = expectConsistent(
      frame([
        { part: "left", load: { type: "force", x: 0, y: 3, fx: 12, fy: 0 } },
      ]),
    );
    expect(r.Bv).toBeCloseTo(6, 12);
    expect(r.Av).toBeCloseTo(-6, 12);
    expect(r.Bh).toBeCloseTo(-6, 12);
    expect(r.Ah).toBeCloseTo(-6, 12);
    // проверката от отговора: лява част спрямо G(3; 3): −(−6)·3 + (−6)·3 = 0
    expect(-(-6) * 3 + -6 * 3).toBe(0);
  });

  it("дъга l = 12 m, f = 3 m, q = 8 kN/m: A_v = B_v = 48, H = 48 kN", () => {
    // A_v = 8·12/2 = 48;  H = 8·144/(8·3) = 1152/24 = 48.
    const r = expectConsistent({
      A: { x: 0, y: 0 },
      B: { x: 12, y: 0 },
      G: { x: 6, y: 3 },
      loads: [uniform("left", 0, 6, 0, 8), uniform("right", 6, 12, 0, 8)],
    });
    expect(r.Av).toBeCloseTo(48, 12);
    expect(r.Bv).toBeCloseTo(48, 12);
    expect(r.Ah).toBeCloseTo(48, 12);
    expect(8 * 144).toBe(1152);
    expect(uniformLoadThrust(8, 12, 3)).toBeCloseTo(48, 12);
    // двойно по-ниска дъга (f = 1,5 m): 96 kN
    expect(uniformLoadThrust(8, 12, 1.5)).toBeCloseTo(96, 12);
  });

  it("диада A(0;0), B(6;0), G(3;4), 80 kN: A_v = B_v = 40, H = 30, усилие −50 kN", () => {
    // Симетрия: A_v = B_v = 40.  Дясна част: 40·3 + B_h·4 = 0 → B_h = −30.
    // Усилие: √(30² + 40²) = 50 kN по големина – натиск, S = −50 kN.
    const A = { x: 0, y: 0 };
    const B = { x: 6, y: 0 };
    const G = { x: 3, y: 4 };
    const r = expectConsistent({ A, B, G, loads: [down("left", 3, 4, 80)] });
    expect(r.Av).toBeCloseTo(40, 12);
    expect(r.Bv).toBeCloseTo(40, 12);
    expect(r.Ah).toBeCloseTo(30, 12);
    expect(r.Bh).toBeCloseTo(-30, 12);
    expect(beamMomentThrust(40 * 3, 4)).toBeCloseTo(30, 12);
    const bars = solveDyad({ A, B, G, fx: 0, fy: -80 });
    expect(bars.SA).toBeCloseTo(-50, 12);
    expect(bars.SB).toBeCloseTo(-50, 12);
  });
});

describe("симетрия и общи свойства", () => {
  it("симетрична рамка със симетричен товар: симетрични реакции", () => {
    // Рамка 8 × 4 m, 5 kN/m по целия ригел и по 12 kN на 1 m от всяка стойка.
    // A_v = B_v = (40 + 24)/2 = 32.
    // Лява част спрямо G: −32·4 + H·4 + 20·2 + 12·3 = 0 → H = 52/4 = 13.
    const r = expectConsistent({
      A: { x: 0, y: 0 },
      B: { x: 8, y: 0 },
      G: { x: 4, y: 4 },
      loads: [
        uniform("left", 0, 4, 4, 5),
        uniform("right", 4, 8, 4, 5),
        down("left", 1, 4, 12),
        down("right", 7, 4, 12),
      ],
    });
    expect(r.Av).toBeCloseTo(32, 12);
    expect(r.Bv).toBeCloseTo(r.Av, 12);
    expect(r.Ah).toBeCloseTo(13, 12);
    expect(r.Bh).toBeCloseTo(-r.Ah, 12);
    // при симетрия ставната сила е само хоризонтална
    expect(r.Gv).toBeCloseTo(0, 12);
    expect(r.Gh).toBeCloseTo(13, 12);
  });

  it("огледална задача дава огледални реакции", () => {
    const base = solveThreeHinged({
      A: { x: 0, y: 0 },
      B: { x: 8, y: 0 },
      G: { x: 4, y: 4 },
      loads: [down("left", 2, 4, 40)],
    });
    const mirrored = expectConsistent({
      A: { x: 0, y: 0 },
      B: { x: 8, y: 0 },
      G: { x: 4, y: 4 },
      loads: [down("right", 6, 4, 40)],
    });
    expect(mirrored.Av).toBeCloseTo(base.Bv, 12);
    expect(mirrored.Bv).toBeCloseTo(base.Av, 12);
    expect(mirrored.Ah).toBeCloseTo(-base.Bh, 12);
    expect(mirrored.Bh).toBeCloseTo(-base.Ah, 12);
  });

  it("двоица върху едната част и наклонена сила върху другата", () => {
    // Няма ръчна сметка – проверяват се само равновесието и системата 4 × 4.
    expectConsistent({
      A: { x: 0, y: 1 },
      B: { x: 9, y: -1 },
      G: { x: 5, y: 5 },
      loads: [
        { part: "left", load: { type: "couple", value: -15 } },
        {
          part: "right",
          load: { type: "inclined", x: 7, y: 3, magnitude: 20, angleDeg: -60 },
        },
        {
          part: "left",
          load: {
            type: "triangular",
            from: { x: 0, y: 1 },
            to: { x: 0, y: 5 },
            q: 6,
            angleDeg: 0,
          },
        },
      ],
    });
  });

  it("само двоица 24 kN·m върху лявата част на рамка 8 × 4 m", () => {
    // ΣM_A: B_v·8 + 24 = 0 → B_v = −3;  A_v = 3.
    // Дясна част: −3·4 + B_h·4 = 0 → B_h = 3;  A_h = −3.
    const r = expectConsistent({
      A: { x: 0, y: 0 },
      B: { x: 8, y: 0 },
      G: { x: 4, y: 4 },
      loads: [{ part: "left", load: { type: "couple", value: 24 } }],
    });
    expect(r.Bv).toBeCloseTo(-3, 12);
    expect(r.Av).toBeCloseTo(3, 12);
    expect(r.Bh).toBeCloseTo(3, 12);
    expect(r.Ah).toBeCloseTo(-3, 12);
  });
});

describe("невалиден вход", () => {
  const A = { x: 0, y: 0 };
  const B = { x: 8, y: 0 };

  it("трите стави на една права – геометрично изменяема система", () => {
    expect(() =>
      solveThreeHinged({ A, B, G: { x: 4, y: 0 }, loads: [] }),
    ).toThrow(/една права/);
    expect(threeHingedDeterminant(A, B, { x: 4, y: 0 })).toBe(0);
    // наклонена права
    expect(() =>
      solveThreeHinged({
        A,
        B: { x: 8, y: 4 },
        G: { x: 4, y: 2 },
        loads: [down("left", 1, 0, 5)],
      }),
    ).toThrow(/една права/);
    // независимото решение също се изражда
    expect(
      solveAsLinearSystem({
        A,
        B,
        G: { x: 4, y: 0 },
        loads: [down("left", 1, 0, 5)],
      }),
    ).toBeNull();
  });

  it("невалидни координати и товари", () => {
    expect(() =>
      solveThreeHinged({ A, B, G: { x: Number.NaN, y: 4 }, loads: [] }),
    ).toThrow(/координати/);
    expect(() =>
      solveThreeHinged({
        A,
        B,
        G: { x: 4, y: 4 },
        loads: [
          {
            part: "middle" as ThreeHingedPart,
            load: { type: "force", x: 1, y: 4, fx: 0, fy: -1 },
          },
        ],
      }),
    ).toThrow(/част/);
    expect(() =>
      solveThreeHinged({
        A,
        B,
        G: { x: 4, y: 4 },
        loads: [
          {
            part: "left",
            load: { type: "force", x: 1, y: 4, fx: 0, fy: Infinity },
          },
        ],
      }),
    ).toThrow();
  });

  it("разпор: височината трябва да е положителна", () => {
    expect(() => beamMomentThrust(100, 0)).toThrow(/Височината/);
    expect(() => uniformLoadThrust(10, 24, -1)).toThrow(/Височината/);
    expect(() => uniformLoadThrust(10, 0, 4)).toThrow(/Отворът/);
    expect(() => beamMomentThrust(Number.NaN, 4)).toThrow();
  });

  it("диада с пръти на една права", () => {
    expect(() =>
      solveDyad({ A, B, G: { x: 4, y: 0 }, fx: 0, fy: -10 }),
    ).toThrow(/една права/);
    expect(() => solveDyad({ A, B, G: A, fx: 0, fy: -10 })).toThrow(/дължина/);
  });

  it("без товари всички реакции са нула", () => {
    const r = solveThreeHinged({ A, B, G: { x: 4, y: 4 }, loads: [] });
    expect(r).toEqual({ Ah: 0, Av: 0, Bh: 0, Bv: 0, Gh: 0, Gv: 0 });
  });
});
