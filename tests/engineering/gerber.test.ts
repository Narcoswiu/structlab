import { describe, expect, it } from "vitest";
import { solveReactions, type Beam } from "@/lib/engineering/beam";
import {
  gerberInternalForces,
  requiredHinges,
  solveGerberBeam,
  type GerberBeam,
  type GerberResult,
} from "@/lib/engineering/gerber";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
//
// Знаци. В текста на главата: y нагоре, моменти положителни ОБРАТНО на
// часовниковата стрелка. Във входа на gerber.ts (както в beam.ts): сила > 0
// сочи НАДОЛУ, момент > 0 върти ПО часовниковата стрелка. Помощните функции
// по-долу превръщат всичко към конвенцията на текста.

/** Сборът на вертикалните товари, надолу, kN. */
function totalLoad(beam: GerberBeam): number {
  return beam.loads.reduce((sum, load) => {
    if (load.type === "force") return sum + load.value;
    if (load.type === "distributed") {
      return sum + load.value * (load.x2 - load.x1);
    }
    return sum;
  }, 0);
}

/**
 * Момент на товарите спрямо точка x0, положителен ОБРАТНО на часовниковата.
 * Взимат се само товарите в интервала [from, to]. Сила надолу вдясно от x0
 * върти по часовниковата → минус.
 */
function loadMoment(beam: GerberBeam, x0: number, from: number, to: number) {
  let moment = 0;
  for (const load of beam.loads) {
    if (load.type === "force") {
      if (load.x >= from && load.x <= to) moment -= load.value * (load.x - x0);
    } else if (load.type === "distributed") {
      const x1 = Math.max(load.x1, from);
      const x2 = Math.min(load.x2, to);
      if (x2 > x1) moment -= load.value * (x2 - x1) * ((x1 + x2) / 2 - x0);
    } else if (load.x >= from && load.x <= to) {
      moment -= load.value; // по часовниковата → минус
    }
  }
  return moment;
}

/** ΣM на ВСИЧКИ сили (товари и реакции) спрямо x0, обратно на часовниковата. */
function momentAbout(beam: GerberBeam, result: GerberResult, x0: number) {
  const reactions = result.reactions.reduce(
    (sum, r) => sum + r.value * (r.x - x0),
    0,
  );
  return reactions + loadMoment(beam, x0, 0, beam.length);
}

/** Момент спрямо ставата на всичко ВДЯСНО от нея (обратно на часовниковата). */
function hingeMomentFromRight(
  beam: GerberBeam,
  result: GerberResult,
  hinge: number,
) {
  const reactions = result.reactions
    .filter((r) => r.x > hinge)
    .reduce((sum, r) => sum + r.value * (r.x - hinge), 0);
  return reactions + loadMoment(beam, hinge, hinge, beam.length);
}

/**
 * Независимо решение: цялата греда като една линейна система.
 * Неизвестни са вертикалните реакции R_i (нагоре). Уравнения:
 *   ΣF_y = 0;  ΣM = 0 спрямо x = 0;  за всяка става – моментът на всичко
 *   вляво от нея спрямо нея е нула.
 * Решава се с Гаусово изключване с избор на главен елемент.
 * Връща null, ако матрицата е изродена (геометрично изменяема система).
 */
function solveAsLinearSystem(beam: GerberBeam): number[] | null {
  const supports = [...beam.supports].sort((a, b) => a.x - b.x);
  const rows: number[][] = [];
  rows.push([...supports.map(() => 1), totalLoad(beam)]);
  rows.push([
    ...supports.map((s) => s.x),
    -loadMoment(beam, 0, 0, beam.length),
  ]);
  for (const hinge of beam.hinges) {
    rows.push([
      ...supports.map((s) => (s.x < hinge ? s.x - hinge : 0)),
      -loadMoment(beam, hinge, 0, hinge),
    ]);
  }
  const n = supports.length;
  if (rows.length !== n) return null;
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

/** Общите проверки, които важат за всяка правилно решена герберова греда. */
function expectConsistent(beam: GerberBeam) {
  const result = solveGerberBeam(beam);
  // 1) сборът на реакциите е равен на сбора на товарите
  const sum = result.reactions.reduce((s, r) => s + r.value, 0);
  expect(sum).toBeCloseTo(totalLoad(beam), 9);
  // 2) моментът на всички сили е нула спрямо която и да е точка
  for (const x0 of [0, beam.length / 3, beam.length, -2.5, 100]) {
    expect(momentAbout(beam, result, x0)).toBeCloseTo(0, 8);
  }
  // 3) огъващият момент във всяка става е нула – смятан отляво и отдясно
  for (const hinge of beam.hinges) {
    expect(gerberInternalForces(beam, hinge).M).toBeCloseTo(0, 9);
    expect(hingeMomentFromRight(beam, result, hinge)).toBeCloseTo(0, 9);
  }
  // 4) независимото решение на общата система дава същите реакции
  const independent = solveAsLinearSystem(beam);
  expect(independent).not.toBeNull();
  result.reactions.forEach((reaction, i) => {
    expect(reaction.value).toBeCloseTo(independent![i]!, 9);
  });
  // 5) ставната сила е напречната сила в ставата
  for (const hinge of result.hingeForces) {
    expect(hinge.vertical).toBeCloseTo(
      gerberInternalForces(beam, hinge.x).Q,
      9,
    );
  }
  return result;
}

const values = (result: GerberResult) => result.reactions.map((r) => r.value);

describe("пример Л1 = П1: двуотворна греда с една става", () => {
  // A (неподвижна) при 0, B при 6, C при 12 m; става G при 8 m.
  // Сила 30 kN надолу при x = 2 m; товар 9 kN/m от 8 до 12 m.
  const beam: GerberBeam = {
    length: 12,
    supports: [
      { x: 0, type: "pinned" },
      { x: 6, type: "roller" },
      { x: 12, type: "roller" },
    ],
    hinges: [8],
    loads: [
      { type: "force", x: 2, value: 30 },
      { type: "distributed", x1: 8, x2: 12, value: 9 },
    ],
  };

  it("брой на ставите: 4 неизвестни реакции − 3 уравнения = 1", () => {
    expect(requiredHinges(beam.supports)).toBe(1);
  });

  it("етажна схема: основна част 0–8 m, второстепенна 8–12 m върху нея", () => {
    const { parts, hingeForces } = solveGerberBeam(beam);
    expect(parts.map((p) => [p.from, p.to, p.kind, p.level])).toEqual([
      [0, 8, "main", 1],
      [8, 12, "secondary", 2],
    ]);
    expect(parts[1]!.restsOn).toEqual([8]);
    expect(parts[0]!.carries).toEqual([8]);
    expect(hingeForces[0]!.supportedPart).toBe("right");
  });

  it("второстепенна част G–C: C_v = 18 kN, G_v = 18 kN", () => {
    // Равнодействаща 9·4 = 36 kN в средата на частта (2 m от G).
    // ΣM_G = 0: C_v·4 − 36·2 = 0 → C_v = 18;  ΣF_y = 0: G_v = 36 − 18 = 18.
    const result = solveGerberBeam(beam);
    expect(result.reactions[2]!.value).toBeCloseTo(18, 12);
    // лявата (основната) част бута дясната нагоре с 18 kN
    expect(result.hingeForces[0]!.vertical).toBeCloseTo(18, 12);
    expect(result.hingeForces[0]!.horizontal).toBe(0);

    // Същата част, решена отделно с beam.ts (проста греда 4 m, товар надолу).
    const part: Beam = {
      length: 4,
      supports: { type: "simple", xA: 0, xB: 4 },
      loads: [{ type: "distributed", x1: 0, x2: 4, value: 9 }],
    };
    expect(solveReactions(part).forces.map((f) => f.value)).toEqual([18, 18]);
  });

  it("основна част A–B–G: B_v = 34 kN, A_v = 14 kN, A_h = 0", () => {
    // Ставната сила 18 kN действа НАДОЛУ върху основната част при x = 8 m.
    // ΣM_A = 0: B_v·6 − 30·2 − 18·8 = 0 → B_v = 204/6 = 34.
    // ΣF_y = 0: A_v = 30 + 18 − 34 = 14.
    const result = solveGerberBeam(beam);
    expect(values(result)).toEqual([14, 34, 18]);
    expect(result.horizontalReaction).toBe(0);

    // Основната част отделно с beam.ts: греда 8 m с опори при 0 и 6 m,
    // сила 30 при 2 m и ставната сила 18 (надолу → плюс) на конзолния край.
    const part: Beam = {
      length: 8,
      supports: { type: "simple", xA: 0, xB: 6 },
      loads: [
        { type: "force", x: 2, value: 30 },
        { type: "force", x: 8, value: 18 },
      ],
    };
    expect(solveReactions(part).forces.map((f) => f.value)).toEqual([14, 34]);
  });

  it("проверки за цялата греда", () => {
    const result = expectConsistent(beam);
    // ΣF_y: 14 + 34 + 18 = 66;  товари 30 + 36 = 66.
    expect(values(result).reduce((a, b) => a + b, 0)).toBeCloseTo(66, 12);
    expect(totalLoad(beam)).toBe(66);
    // ΣM_C (x = 12), обратно на часовниковата положително:
    // −14·12 − 34·6 + 30·10 + 36·2 = −168 − 204 + 300 + 72 = 0.
    expect(-14 * 12 - 34 * 6 + 30 * 10 + 36 * 2).toBe(0);
    expect(momentAbout(beam, result, 12)).toBeCloseTo(0, 12);
    // Момент в ставата от силите вляво, обратно на часовниковата:
    // −14·8 + 30·6 − 34·2 = −112 + 180 − 68 = 0.
    expect(-14 * 8 + 30 * 6 - 34 * 2).toBe(0);
    // Отдясно: 18·4 − 36·2 = 72 − 72 = 0.
    expect(hingeMomentFromRight(beam, result, 8)).toBeCloseTo(0, 12);
  });

  it("товар само върху основната част не натоварва второстепенната", () => {
    // Без разпределения товар: G_v = 0, C_v = 0;
    // B_v = 30·2/6 = 10, A_v = 30 − 10 = 20.
    const only: GerberBeam = { ...beam, loads: [beam.loads[0]!] };
    const result = expectConsistent(only);
    expect(values(result)[0]).toBeCloseTo(20, 12);
    expect(values(result)[1]).toBeCloseTo(10, 12);
    expect(values(result)[2]).toBeCloseTo(0, 12);
    expect(result.hingeForces[0]!.vertical).toBeCloseTo(0, 12);
  });
});

describe("пример П2: триотворна греда на три нива с наклонена сила и момент", () => {
  // A (неподвижна) при 0, B при 5, C при 11, D при 16 m; стави G1 = 7, G2 = 13.
  // q1 = 6 kN/m от 0 до 5; момент 15 kN·m по часовниковата при x = 2;
  // F = 20 kN при x = 9 под 60° спрямо оста, надолу и надясно:
  //   F_x = 20·cos 60° = 10 (надясно), F_y = 20·sin 60° = 17,3205 (надолу);
  // q2 = 8 kN/m от 13 до 16.
  const Fy = 20 * Math.sin(Math.PI / 3);
  const Fx = 20 * Math.cos(Math.PI / 3);
  const beam: GerberBeam = {
    length: 16,
    supports: [
      { x: 0, type: "pinned" },
      { x: 5, type: "roller" },
      { x: 11, type: "roller" },
      { x: 16, type: "roller" },
    ],
    hinges: [7, 13],
    loads: [
      { type: "distributed", x1: 0, x2: 5, value: 6 },
      { type: "moment", x: 2, value: 15 },
      { type: "force", x: 9, value: Fy },
      { type: "distributed", x1: 13, x2: 16, value: 8 },
    ],
    horizontal: [{ x: 9, value: Fx }],
  };

  it("проекции на наклонената сила: големини 10,00 и 17,32 kN", () => {
    expect(Fx).toBeCloseTo(10, 10);
    expect(Fy).toBeCloseTo(17.32, 2);
    expect(Fy).toBeCloseTo(17.3205, 4);
  });

  it("брой на ставите 5 − 3 = 2 и три нива", () => {
    expect(requiredHinges(beam.supports)).toBe(2);
    const { parts } = solveGerberBeam(beam);
    expect(parts.map((p) => [p.from, p.to, p.level])).toEqual([
      [0, 7, 1],
      [7, 13, 2],
      [13, 16, 3],
    ]);
  });

  it("ниво 3, част G2–D: D_v = 12 kN, G2_v = 12 kN", () => {
    // Равнодействаща 8·3 = 24 kN на 1,5 m от G2.
    // ΣM_G2 = 0: D_v·3 − 24·1,5 = 0 → D_v = 12;  G2_v = 24 − 12 = 12.
    const result = solveGerberBeam(beam);
    expect(result.reactions[3]!.value).toBeCloseTo(12, 12);
    expect(result.hingeForces[1]!.vertical).toBeCloseTo(12, 12);
    expect(result.hingeForces[1]!.horizontal).toBeCloseTo(0, 12);
  });

  it("ниво 2, част G1–C–G2: C_v = 26,66 kN, G1_v = 2,66 kN, G1_h = 10 kN", () => {
    // ΣM_G1 = 0: C_v·4 − 17,32·2 − 12·6 = 0 → C_v = (34,64 + 72)/4 = 26,66.
    // ΣF_y = 0: G1_v = 17,32 + 12 − 26,66 = 2,66 (нагоре върху тази част).
    // ΣF_x = 0: G1_h + 10 = 0 → G1_h = −10 (наляво върху тази част).
    expect((34.64 + 72) / 4).toBeCloseTo(26.66, 10);
    expect(17.32 + 12 - 26.66).toBeCloseTo(2.66, 10);
    const result = solveGerberBeam(beam);
    expect(result.reactions[2]!.value).toBeCloseTo(26.66, 2);
    expect(result.reactions[2]!.value).toBeCloseTo(26.6603, 4);
    expect(result.hingeForces[0]!.vertical).toBeCloseTo(2.66, 2);
    expect(result.hingeForces[0]!.vertical).toBeCloseTo(2.6603, 4);
    // лявата част действа върху дясната с 10 kN наляво
    expect(result.hingeForces[0]!.horizontal).toBeCloseTo(-10, 10);

    // Отделно с beam.ts: греда 6 m (от G1 до G2), опори при 0 и 4 m.
    const part: Beam = {
      length: 6,
      supports: { type: "simple", xA: 0, xB: 4 },
      loads: [
        { type: "force", x: 2, value: Fy },
        { type: "force", x: 6, value: 12 },
      ],
    };
    const [g1, c] = solveReactions(part).forces.map((f) => f.value);
    expect(g1).toBeCloseTo(2.6603, 4);
    expect(c).toBeCloseTo(26.6603, 4);
  });

  it("ниво 1, част A–B–G1: B_v = 21,724 kN, A_v = 10,936 kN, A_h = −10 kN", () => {
    // Равнодействаща 6·5 = 30 kN при x = 2,5; момент 15 по часовниковата;
    // от ставата 2,66 kN надолу при x = 7.
    // ΣM_A = 0 (обратно на часовниковата +):
    //   B_v·5 − 30·2,5 − 15 − 2,66·7 = 0 → B_v = (75 + 15 + 18,62)/5 = 21,724.
    // ΣF_y = 0: A_v = 30 + 2,66 − 21,724 = 10,936.
    // ΣF_x = 0: A_h + 10 = 0 → A_h = −10 (наляво).
    expect((75 + 15 + 18.62) / 5).toBeCloseTo(21.724, 10);
    expect(30 + 2.66 - 21.724).toBeCloseTo(10.936, 10);
    const result = solveGerberBeam(beam);
    expect(result.reactions[1]!.value).toBeCloseTo(21.724, 3);
    expect(result.reactions[1]!.value).toBeCloseTo(21.7244, 4);
    expect(result.reactions[0]!.value).toBeCloseTo(10.936, 3);
    expect(result.reactions[0]!.value).toBeCloseTo(10.9359, 4);
    expect(result.horizontalReaction).toBeCloseTo(-10, 10);
  });

  it("проверките в текста излизат и с окръглените стойности", () => {
    // ΣF_y: 10,936 + 21,724 + 26,66 + 12 = 71,32;  товари 30 + 17,32 + 24 = 71,32.
    expect(10.936 + 21.724 + 26.66 + 12).toBeCloseTo(71.32, 10);
    expect(30 + 17.32 + 24).toBeCloseTo(71.32, 10);
    // ΣM_A за цялата греда (обратно на часовниковата +):
    //   21,724·5 + 26,66·11 + 12·16 − 30·2,5 − 15 − 17,32·9 − 24·14,5
    //   = 108,62 + 293,26 + 192 − 75 − 15 − 155,88 − 348 = 0.
    expect(21.724 * 5).toBeCloseTo(108.62, 10);
    expect(26.66 * 11).toBeCloseTo(293.26, 10);
    expect(17.32 * 9).toBeCloseTo(155.88, 10);
    expect(108.62 + 293.26 + 192 - 75 - 15 - 155.88 - 348).toBeCloseTo(0, 10);
    // Момент в G1 от силите вляво (обратно на часовниковата +):
    //   −10,936·7 − 21,724·2 + 30·4,5 − 15 = −76,552 − 43,448 + 135 − 15 = 0.
    expect(10.936 * 7).toBeCloseTo(76.552, 10);
    expect(21.724 * 2).toBeCloseTo(43.448, 10);
    expect(-76.552 - 43.448 + 135 - 15).toBeCloseTo(0, 10);
    // Момент в G2 от силите вдясно: 12·3 − 24·1,5 = 36 − 36 = 0.
    expect(12 * 3 - 24 * 1.5).toBe(0);
  });

  it("проверки за цялата греда с неокръглени стойности", () => {
    const result = expectConsistent(beam);
    expect(totalLoad(beam)).toBeCloseTo(71.3205, 4);
    // ΣF_x: A_h + F_x = −10 + 10 = 0
    expect(result.horizontalReaction + Fx).toBeCloseTo(0, 12);
  });

  it("нормалната сила е 10 kN опън между A и силата, после нула", () => {
    // Вляво от сечението действа само A_h = −10 (наляво) → N = +10.
    expect(gerberInternalForces(beam, 4).N).toBeCloseTo(10, 10);
    expect(gerberInternalForces(beam, 8).N).toBeCloseTo(10, 10);
    expect(gerberInternalForces(beam, 10).N).toBeCloseTo(0, 10);
  });
});

describe("пример П3: окачена греда между две основни части", () => {
  // A (неподвижна) при 0, B при 4, C при 11, D при 15 m; стави 5,5 и 9,5 m.
  // q = 10 kN/m от 0 до 4; сила 40 kN при 7,5; сила 16 kN при 13.
  const beam: GerberBeam = {
    length: 15,
    supports: [
      { x: 0, type: "pinned" },
      { x: 4, type: "roller" },
      { x: 11, type: "roller" },
      { x: 15, type: "roller" },
    ],
    hinges: [5.5, 9.5],
    loads: [
      { type: "distributed", x1: 0, x2: 4, value: 10 },
      { type: "force", x: 7.5, value: 40 },
      { type: "force", x: 13, value: 16 },
    ],
  };

  it("етажна схема: две основни части и окачена греда над тях", () => {
    const { parts, hingeForces } = solveGerberBeam(beam);
    expect(parts.map((p) => [p.from, p.to, p.kind, p.level])).toEqual([
      [0, 5.5, "main", 1],
      [5.5, 9.5, "secondary", 2],
      [9.5, 15, "main", 1],
    ]);
    expect(parts[1]!.restsOn).toEqual([5.5, 9.5]);
    expect(hingeForces.map((h) => h.supportedPart)).toEqual(["right", "left"]);
  });

  it("окачена греда: силата е в средата → по 20 kN във всяка става", () => {
    // Отвор 4 m, сила 40 kN на 2 m от G1: G2_v·4 − 40·2 = 0 → G2_v = 20; G1_v = 20.
    const { hingeForces } = solveGerberBeam(beam);
    // G1: лявата част бута окачената нагоре (+20);
    // G2: окачената натиска дясната част надолу (−20). Големината е 20 kN.
    expect(hingeForces[0]!.vertical).toBeCloseTo(20, 12);
    expect(hingeForces[1]!.vertical).toBeCloseTo(-20, 12);
  });

  it("лява част: B_v = 47,5 kN, A_v = 12,5 kN", () => {
    // Равнодействаща 10·4 = 40 kN при x = 2; 20 kN надолу при x = 5,5.
    // ΣM_A = 0: B_v·4 − 40·2 − 20·5,5 = 0 → B_v = 190/4 = 47,5.
    // A_v = 40 + 20 − 47,5 = 12,5.
    const result = solveGerberBeam(beam);
    expect(result.reactions[1]!.value).toBeCloseTo(47.5, 12);
    expect(result.reactions[0]!.value).toBeCloseTo(12.5, 12);
  });

  it("дясна част: C_v = 35,5 kN, D_v = 0,5 kN", () => {
    // 20 kN надолу при x = 9,5 (на 5,5 m от D); 16 kN при x = 13 (на 2 m от D).
    // ΣM_D = 0 (обратно на часовниковата +): −C_v·4 + 20·5,5 + 16·2 = 0
    //   → C_v = 142/4 = 35,5;  D_v = 20 + 16 − 35,5 = 0,5.
    const result = solveGerberBeam(beam);
    expect(result.reactions[2]!.value).toBeCloseTo(35.5, 12);
    expect(result.reactions[3]!.value).toBeCloseTo(0.5, 12);
  });

  it("проверки за цялата греда: 12,5 + 47,5 + 35,5 + 0,5 = 96 = 40 + 40 + 16", () => {
    const result = expectConsistent(beam);
    expect(values(result).reduce((a, b) => a + b, 0)).toBeCloseTo(96, 12);
    expect(totalLoad(beam)).toBe(96);
    // ΣM_A за цялата греда (обратно на часовниковата +):
    //   47,5·4 + 35,5·11 + 0,5·15 − 40·2 − 40·7,5 − 16·13
    //   = 190 + 390,5 + 7,5 − 80 − 300 − 208 = 0.
    expect(190 + 390.5 + 7.5 - 80 - 300 - 208).toBe(0);
  });

  it("при сила 48 kN върху окачената греда D_v става −1 kN", () => {
    // Ставните сили са по 24 kN. C_v = (24·5,5 + 16·2)/4 = 164/4 = 41;
    // D_v = 24 + 16 − 41 = −1 (опората трябва да държи гредата надолу).
    const heavier: GerberBeam = {
      ...beam,
      loads: [
        beam.loads[0]!,
        { type: "force", x: 7.5, value: 48 },
        beam.loads[2]!,
      ],
    };
    const result = expectConsistent(heavier);
    expect(result.reactions[2]!.value).toBeCloseTo(41, 12);
    expect(result.reactions[3]!.value).toBeCloseTo(-1, 12);
  });
});

describe("„В реалния живот“: мост с окачено поле", () => {
  // Странични отвори 15 m, конзоли 3 m, окачено поле 12 m; товар 20 kN/m навсякъде.
  // Опори при 0, 15, 33, 48 m; стави при 18 и 30 m.
  const beam: GerberBeam = {
    length: 48,
    supports: [
      { x: 0, type: "pinned" },
      { x: 15, type: "roller" },
      { x: 33, type: "roller" },
      { x: 48, type: "roller" },
    ],
    hinges: [18, 30],
    loads: [{ type: "distributed", x1: 0, x2: 48, value: 20 }],
  };

  it("всяка става поема 20·12/2 = 120 kN", () => {
    const { hingeForces } = solveGerberBeam(beam);
    expect(hingeForces[0]!.vertical).toBeCloseTo(120, 10);
    expect(hingeForces[1]!.vertical).toBeCloseTo(-120, 10);
  });

  it("момент над стълба: 120·3 = 360, с товара върху конзолата 450 kN·m", () => {
    // Само от ставната сила: 120·3 = 360.
    // Товарът върху конзолата: 20·3 = 60 kN на рамо 1,5 m → 90.  360 + 90 = 450.
    expect(120 * 3 + 20 * 3 * 1.5).toBe(450);
    // Моментът опъва горните нишки → отрицателен по правилото на beam.ts.
    expect(gerberInternalForces(beam, 15).M).toBeCloseTo(-450, 9);
    expect(gerberInternalForces(beam, 33).M).toBeCloseTo(-450, 9);
  });

  it("реакции на основната част: стълбът носи 360 kN, устоят 120 kN", () => {
    // Основна част 0–18 m: товар 20·18 = 360 kN при x = 9; 120 kN при x = 18.
    // ΣM_A = 0: B_v·15 − 360·9 − 120·18 = 0 → B_v = 5400/15 = 360.
    // A_v = 360 + 120 − 360 = 120.
    const result = expectConsistent(beam);
    expect(values(result)[0]).toBeCloseTo(120, 9);
    expect(values(result)[1]).toBeCloseTo(360, 9);
    expect(values(result)[2]).toBeCloseTo(360, 9);
    expect(values(result)[3]).toBeCloseTo(120, 9);
  });
});

describe("въпросите от „Провери се“", () => {
  it("„Леко“ 3: окачена греда 3 m със сила 12 kN в средата → по 6 kN", () => {
    // Симетрия: 12/2 = 6 kN във всяка става.
    const beam: GerberBeam = {
      length: 13,
      supports: [
        { x: 0, type: "pinned" },
        { x: 4, type: "roller" },
        { x: 9, type: "roller" },
        { x: 13, type: "roller" },
      ],
      hinges: [5, 8],
      loads: [{ type: "force", x: 6.5, value: 12 }],
    };
    const result = expectConsistent(beam);
    expect(result.hingeForces.map((h) => Math.abs(h.vertical))).toEqual([6, 6]);
  });

  it("„Леко“ 4 и „Подробно“ 3: брой на ставите", () => {
    const supports = (rollers: number) => [
      { x: 0, type: "pinned" as const },
      ...Array.from({ length: rollers }, (_, i) => ({
        x: 4 * (i + 1),
        type: "roller" as const,
      })),
    ];
    // една неподвижна и три подвижни: 2 + 3 = 5 реакции → 5 − 3 = 2 стави
    expect(requiredHinges(supports(3))).toBe(2);
    // една неподвижна и четири подвижни: 2 + 4 = 6 реакции → 6 − 3 = 3 стави
    expect(requiredHinges(supports(4))).toBe(3);
    // проста греда: 3 реакции → 0 стави
    expect(requiredHinges(supports(1))).toBe(0);
  });

  const beam = (loads: GerberBeam["loads"]): GerberBeam => ({
    length: 9,
    supports: [
      { x: 0, type: "pinned" },
      { x: 4, type: "roller" },
      { x: 9, type: "roller" },
    ],
    hinges: [6],
    loads,
  });

  it("„Подробно“ 1: товар 6 kN/m от 6 до 9 m → C_v = G_v = 9; B_v = 13,5; A_v = −4,5", () => {
    // Второстепенна част 6–9 m: равнодействаща 18 kN в средата → C_v = G_v = 9.
    // Основна част: ΣM_A = 0: B_v·4 − 9·6 = 0 → B_v = 13,5;  A_v = 9 − 13,5 = −4,5.
    const result = expectConsistent(
      beam([{ type: "distributed", x1: 6, x2: 9, value: 6 }]),
    );
    expect(values(result)).toEqual([-4.5, 13.5, 9]);
    expect(result.hingeForces[0]!.vertical).toBeCloseTo(9, 12);
  });

  it("„Подробно“ 2: сила 20 kN при x = 2 m → A_v = B_v = 10; C_v = 0; G_v = 0", () => {
    // Товарът е върху основната част, в средата между A и B.
    const result = expectConsistent(beam([{ type: "force", x: 2, value: 20 }]));
    expect(values(result)[0]).toBeCloseTo(10, 12);
    expect(values(result)[1]).toBeCloseTo(10, 12);
    expect(values(result)[2]).toBeCloseTo(0, 12);
    expect(result.hingeForces[0]!.vertical).toBeCloseTo(0, 12);
  });

  it("„Подробно“ 4: хоризонталната проекция стига до неподвижната опора", () => {
    // 10 kN надясно върху второстепенната част → A_h = −10 (наляво);
    // през ставата минава 10 kN.
    const loaded: GerberBeam = {
      ...beam([{ type: "force", x: 8, value: 5 }]),
      horizontal: [{ x: 8, value: 10 }],
    };
    const result = solveGerberBeam(loaded);
    expect(result.horizontalReaction).toBeCloseTo(-10, 12);
    expect(Math.abs(result.hingeForces[0]!.horizontal)).toBeCloseTo(10, 12);
  });
});

describe("проверка на входа: статическа определимост и неизменяемост", () => {
  const rollers = (...xs: number[]) =>
    xs.map((x) => ({ x, type: "roller" as const }));
  const load: GerberBeam["loads"] = [{ type: "force", x: 2, value: 10 }];

  it("греда на три опори без става е статически неопределима", () => {
    expect(() =>
      solveGerberBeam({
        length: 12,
        supports: [{ x: 0, type: "pinned" }, ...rollers(6, 12)],
        hinges: [],
        loads: load,
      }),
    ).toThrow(/не е статически определима/);
  });

  it("две стави при три опори – ставите са повече от нужното", () => {
    expect(() =>
      solveGerberBeam({
        length: 12,
        supports: [{ x: 0, type: "pinned" }, ...rollers(6, 12)],
        hinges: [7, 9],
        loads: load,
      }),
    ).toThrow(/не е статически определима/);
  });

  it("верен брой, но двете стави са в краен отвор → геометрично изменяема", () => {
    const beam: GerberBeam = {
      length: 12,
      supports: [{ x: 0, type: "pinned" }, ...rollers(4, 8, 12)],
      hinges: [9, 11],
      loads: load,
    };
    expect(() => solveGerberBeam(beam)).toThrow(/геометрично изменяема/);
    // независимо потвърждение: матрицата на общата система е изродена
    expect(solveAsLinearSystem(beam)).toBeNull();
  });

  it("три стави в един междинен отвор → геометрично изменяема", () => {
    const beam: GerberBeam = {
      length: 20,
      supports: [{ x: 0, type: "pinned" }, ...rollers(4, 12, 16, 20)],
      hinges: [6, 8, 10],
      loads: load,
    };
    expect(() => solveGerberBeam(beam)).toThrow(/геометрично изменяема/);
    expect(solveAsLinearSystem(beam)).toBeNull();
  });

  it("две стави в отвор и става в съседния отвор: решава се, щом всяка част има две подпирания", () => {
    // Опори 0, 5, 10, 15, 20; стави 6, 9, 12. Части:
    //   0–6 (опори 0 и 5) – основна;  12–20 (опори 15 и 20) – основна;
    //   9–12 (опора 10 + става 12) – лежи върху дясната основна част;
    //   6–9 (без опори) – лежи в ставите 6 и 9.
    // Простото правило „две стави в отвор → в съседните няма“ е достатъчно,
    // но не е необходимо; решава броят на подпиранията на всяка част.
    const beam: GerberBeam = {
      length: 20,
      supports: [{ x: 0, type: "pinned" }, ...rollers(5, 10, 15, 20)],
      hinges: [6, 9, 12],
      loads: [{ type: "distributed", x1: 0, x2: 20, value: 4 }],
    };
    const result = expectConsistent(beam);
    expect(result.parts.map((p) => p.level)).toEqual([1, 3, 2, 1]);
  });

  it("точно една неподвижна опора", () => {
    expect(() =>
      solveGerberBeam({
        length: 6,
        supports: rollers(0, 6),
        hinges: [],
        loads: load,
      }),
    ).toThrow(/неподвижна/);
  });

  it("става върху опора или сила точно в става се отхвърлят", () => {
    const base = {
      length: 12,
      supports: [{ x: 0, type: "pinned" as const }, ...rollers(6, 12)],
    };
    expect(() =>
      solveGerberBeam({ ...base, hinges: [6], loads: load }),
    ).toThrow(/съвпада с опора/);
    expect(() =>
      solveGerberBeam({
        ...base,
        hinges: [8],
        loads: [{ type: "force", x: 8, value: 10 }],
      }),
    ).toThrow(/точно в става/);
  });

  it("проста греда без стави се решава като в beam.ts", () => {
    // сила 20 kN на 2 m от A, отвор 5 m: B = 20·2/5 = 8, A = 12
    const result = solveGerberBeam({
      length: 5,
      supports: [{ x: 0, type: "pinned" }, ...rollers(5)],
      hinges: [],
      loads: [{ type: "force", x: 2, value: 20 }],
    });
    expect(values(result)[0]).toBeCloseTo(12, 12);
    expect(values(result)[1]).toBeCloseTo(8, 12);
  });
});
