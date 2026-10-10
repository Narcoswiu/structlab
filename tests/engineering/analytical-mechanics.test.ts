import { describe, expect, it } from "vitest";
import {
  G_ACCELERATION,
  beamReactionByVirtualWork,
  blockPulleySystem,
  doublePendulumEquilibrium,
  generalizedForce,
  generalizedForceFromPotential,
  gerberReaction,
  gerberVirtualDisplacement,
  hangingEquilibriumAngle,
  lagrangeAcceleration,
  leverForce,
  motionFromRest,
  pulleyBlockForce,
  rodPendulum,
  rodPendulumAcceleration,
  rodPendulumOmega,
  rollingAcceleration,
  springEquilibrium,
  virtualWork,
  winchMoment,
  type GerberLayout,
  type PointLoad,
} from "@/lib/engineering/analytical-mechanics";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Единици: m, s, kg, N (гредата от Пример 1 в „Подробно“ е в kN). g = 9,81 m/s².
// Оста y е нагоре; ъгли и моменти са положителни обратно на часовниковата стрелка.

const g = G_ACCELERATION;
const RAD = Math.PI / 180;

/**
 * Независима проверка: класически метод на Рунге–Кута от 4-ти ред за
 * системата y' = f(t, y). Не ползва нищо от проверявания файл.
 */
function rk4(
  f: (t: number, y: number[]) => number[],
  y0: number[],
  t0: number,
  t1: number,
  steps: number,
): number[] {
  const h = (t1 - t0) / steps;
  let y = [...y0];
  const add = (a: number[], b: number[], factor: number) =>
    a.map((value, i) => value + factor * b[i]!);
  for (let i = 0; i < steps; i++) {
    const t = t0 + i * h;
    const k1 = f(t, y);
    const k2 = f(t + h / 2, add(y, k1, h / 2));
    const k3 = f(t + h / 2, add(y, k2, h / 2));
    const k4 = f(t + h, add(y, k3, h));
    y = y.map(
      (value, j) =>
        value + (h / 6) * (k1[j]! + 2 * k2[j]! + 2 * k3[j]! + k4[j]!),
    );
  }
  return y;
}

/**
 * Независима проверка със статиката от I част: реакции на греда върху две
 * опори от ΣM_A = 0 и ΣM_B = 0 (товарите са положителни надолу).
 */
function staticsTwoSupports(xA: number, xB: number, loads: PointLoad[]) {
  let momentAboutA = 0;
  let momentAboutB = 0;
  for (const load of loads) {
    momentAboutA += load.force * (load.x - xA);
    momentAboutB += load.force * (xB - load.x);
  }
  return { A: momentAboutB / (xB - xA), B: momentAboutA / (xB - xA) };
}

describe("„Леко“, Пример 1 – лост", () => {
  it("силата на ръката и отношението на пътищата", () => {
    // F·1,5·δφ − 600·0,3·δφ = 0 → F = 180 / 1,5 = 120 N; пътища 1,5 / 0,3 = 5
    const lever = leverForce({ load: 600, loadArm: 0.3, forceArm: 1.5 });
    expect(lever.force).toBeCloseTo(120, 10);
    expect(lever.pathRatio).toBeCloseTo(5, 10);
  });

  it("двете работи при δφ = 0,1 rad са по 18 J и сборът им е нула", () => {
    // ръка: 1,5·0,1 = 0,15 m надолу, 120·0,15 = 18 J
    // камък: 0,3·0,1 = 0,03 m нагоре, 600·0,03 = 18 J (срещу теглото → −18 J)
    expect(120 * 0.15).toBeCloseTo(18, 10);
    expect(600 * 0.03).toBeCloseTo(18, 10);
    expect(
      virtualWork([
        { force: 120, displacement: 0.15 },
        { force: -600, displacement: 0.03 },
      ]),
    ).toBeCloseTo(0, 10);
  });

  it("статиката от I част дава същото: моменти спрямо опората", () => {
    // 120·1,5 = 180 N·m = 600·0,3; реакция на опората 600 + 120 = 720 N
    expect(120 * 1.5).toBeCloseTo(600 * 0.3, 10);
    expect(600 + 120).toBe(720);
  });

  it("камък с тегло 600 N има маса около 61 kg", () => {
    // 600 / 9,81 = 61,16 kg
    expect(600 / g).toBeCloseTo(61.16, 2);
  });
});

describe("„Леко“, Пример 2 – реакции на проста греда", () => {
  const loads: PointLoad[] = [{ x: 2, force: 800 }];

  it("B_v и A_v чрез възможни премествания", () => {
    // без B: B_v·5·δφ − 800·2·δφ = 0 → B_v = 1600 / 5 = 320 N
    // без A: A_v·5·δφ − 800·3·δφ = 0 → A_v = 2400 / 5 = 480 N
    const B = beamReactionByVirtualWork({
      supportA: 0,
      supportB: 5,
      loads,
      removed: "B",
    });
    const A = beamReactionByVirtualWork({
      supportA: 0,
      supportB: 5,
      loads,
      removed: "A",
    });
    expect(B).toBeCloseTo(320, 10);
    expect(A).toBeCloseTo(480, 10);
    expect(A + B).toBeCloseTo(800, 10);
  });

  it("уравненията за равновесие дават същите реакции", () => {
    // ΣM_A: B_v·5 = 800·2; ΣM_B: A_v·5 = 800·3
    const statics = staticsTwoSupports(0, 5, loads);
    expect(statics.B).toBeCloseTo(320, 10);
    expect(statics.A).toBeCloseTo(480, 10);
  });
});

describe("макари и лебедка", () => {
  it("подвижна макара: 500 N → 250 N, въжето е двойно", () => {
    // F·2·δs − 500·δs = 0 → F = 250 N
    const pulley = pulleyBlockForce({ load: 500, strands: 2 });
    expect(pulley.force).toBeCloseTo(250, 10);
    expect(pulley.ropePerLift).toBe(2);
    expect(
      virtualWork([
        { force: 250, displacement: 2 },
        { force: -500, displacement: 1 },
      ]),
    ).toBeCloseTo(0, 10);
  });

  it("полиспаст с 4 клона: 1200 N → 300 N, 4 m въже за 1 m", () => {
    // 1200 / 4 = 300 N; маса на товара 1200 / 9,81 = 122,3 kg
    const block = pulleyBlockForce({ load: 1200, strands: 4 });
    expect(block.force).toBeCloseTo(300, 10);
    expect(block.ropePerLift * 1).toBe(4);
    expect(1200 / g).toBeCloseTo(122.3, 1);
    // работа за 1 m вдигане: 300·4 = 1200 J = 1200·1
    expect(300 * 4).toBe(1200 * 1);
  });

  it("лебедка: G = 2000 N, r = 0,15 m → M = 300 N·m", () => {
    // M·δφ − G·r·δφ = 0 → M = 2000·0,15 = 300 N·m
    expect(winchMoment({ load: 2000, radius: 0.15 })).toBeCloseTo(300, 10);
  });
});

describe("въпроси от „Леко“", () => {
  it("лост: 900 N на 0,2 m, ръка на 1,2 m → 150 N", () => {
    // 900·0,2 / 1,2 = 150 N
    expect(
      leverForce({ load: 900, loadArm: 0.2, forceArm: 1.2 }).force,
    ).toBeCloseTo(150, 10);
  });

  it("полиспаст с 4 клона, 840 N, вдигане 0,5 m → 210 N и 2 m въже", () => {
    // 840 / 4 = 210 N; 4·0,5 = 2 m
    const block = pulleyBlockForce({ load: 840, strands: 4 });
    expect(block.force).toBeCloseTo(210, 10);
    expect(block.ropePerLift * 0.5).toBeCloseTo(2, 10);
  });

  it("греда 4 m, 600 N на 1 m от A → B_v = 150 N, A_v = 450 N", () => {
    // B_v·4 − 600·1 = 0 → 150 N; A_v = 600 − 150 = 450 N
    const loads: PointLoad[] = [{ x: 1, force: 600 }];
    const B = beamReactionByVirtualWork({
      supportA: 0,
      supportB: 4,
      loads,
      removed: "B",
    });
    expect(B).toBeCloseTo(150, 10);
    expect(staticsTwoSupports(0, 4, loads).B).toBeCloseTo(150, 10);
    expect(staticsTwoSupports(0, 4, loads).A).toBeCloseTo(450, 10);
  });
});

describe("„Подробно“, Пример 1 – герберова греда (kN)", () => {
  const layout: GerberLayout = {
    supportA: 0,
    supportB: 6,
    hinge: 8,
    supportD: 12,
  };
  const loads: PointLoad[] = [
    { x: 3, force: 24 },
    { x: 10, force: 12 },
  ];

  it("възможни премествания без B: 3, 6, 8 и 4 пъти δφ", () => {
    // ABC около A: δy = x·δφ; опората B се качва с 6·δφ = 1 → δφ = 1/6
    // под F1: 3/6; в C: 8/6; CD около D: под F2 (на 2 m от D) (8/6)·(2/4) = 4/6
    expect(gerberVirtualDisplacement(layout, "B", 3)).toBeCloseTo(3 / 6, 12);
    expect(gerberVirtualDisplacement(layout, "B", 6)).toBeCloseTo(1, 12);
    expect(gerberVirtualDisplacement(layout, "B", 8)).toBeCloseTo(8 / 6, 12);
    expect(gerberVirtualDisplacement(layout, "B", 10)).toBeCloseTo(4 / 6, 12);
    expect(gerberVirtualDisplacement(layout, "B", 12)).toBeCloseTo(0, 12);
  });

  it("реакциите чрез възможни премествания: 10, 20 и 6 kN", () => {
    // B_v·6 − 24·3 − 12·4 = 0 → B_v = 120 / 6 = 20 kN
    // D_v·4 − 12·2 = 0 → D_v = 6 kN
    // A_v·δ − 24·δ/2 + 12·δ/6 = 0 → A_v = 12 − 2 = 10 kN
    expect(gerberReaction(layout, loads, "B")).toBeCloseTo(20, 10);
    expect(gerberReaction(layout, loads, "D")).toBeCloseTo(6, 10);
    expect(gerberReaction(layout, loads, "A")).toBeCloseTo(10, 10);
  });

  it("възможни премествания без A: +1/2 под F1, −1/3 в C, −1/6 под F2", () => {
    expect(gerberVirtualDisplacement(layout, "A", 3)).toBeCloseTo(1 / 2, 12);
    expect(gerberVirtualDisplacement(layout, "A", 8)).toBeCloseTo(-1 / 3, 12);
    expect(gerberVirtualDisplacement(layout, "A", 10)).toBeCloseTo(-1 / 6, 12);
  });

  it("без D основната част не се мести", () => {
    expect(gerberVirtualDisplacement(layout, "D", 3)).toBe(0);
    expect(gerberVirtualDisplacement(layout, "D", 10)).toBeCloseTo(0.5, 12);
  });

  it("уравненията за равновесие (I част, герберова греда) дават същото", () => {
    // второстепенна част CD (4 m, F2 в средата): D_v = 12·2/4 = 6, C_v = 6
    const secondary = staticsTwoSupports(8, 12, [{ x: 10, force: 12 }]);
    expect(secondary.B).toBeCloseTo(6, 10);
    expect(secondary.A).toBeCloseTo(6, 10);
    // основна част ABC: F1 и ставната сила 6 kN надолу в C (x = 8)
    // ΣM_A: 6·B_v = 24·3 + 6·8 = 120 → B_v = 20; A_v = 24 + 6 − 20 = 10
    const main = staticsTwoSupports(0, 6, [
      { x: 3, force: 24 },
      { x: 8, force: secondary.A },
    ]);
    expect(main.B).toBeCloseTo(20, 10);
    expect(main.A).toBeCloseTo(10, 10);
    // сбор: 10 + 20 + 6 = 36 = 24 + 12
    expect(main.A + main.B + secondary.B).toBeCloseTo(36, 10);
  });

  it("сборът от възможните работи е нула за намерените реакции", () => {
    // без B, δφ = 1: 20·6 − 24·3 − 12·4 = 0
    expect(
      virtualWork([
        { force: 20, displacement: 6 },
        { force: -24, displacement: 3 },
        { force: -12, displacement: 4 },
      ]),
    ).toBeCloseTo(0, 10);
  });
});

describe("„Подробно“, Пример 2 – две степени на свобода", () => {
  const G1 = 30;
  const G2 = 20;
  const F = 15;

  it("ъглите на двойното махало: 16,7° и 36,9°", () => {
    // tg φ1 = 15 / (30 + 20) = 0,3 → 16,70°; tg φ2 = 15 / 20 = 0,75 → 36,87°
    const angles = doublePendulumEquilibrium({
      weight1: G1,
      weight2: G2,
      force: F,
    });
    expect(angles.phi1Deg).toBeCloseTo(16.7, 1);
    expect(angles.phi2Deg).toBeCloseTo(36.87, 2);
    expect(15 / 50).toBeCloseTo(0.3, 10);
    expect(15 / 20).toBeCloseTo(0.75, 10);
  });

  it("двете обобщени сили са нула в намереното положение (числено)", () => {
    const l1 = 0.5;
    const l2 = 0.4;
    const angles = doublePendulumEquilibrium({
      weight1: G1,
      weight2: G2,
      force: F,
    });
    const phi1 = angles.phi1Deg * RAD;
    const phi2 = angles.phi2Deg * RAD;
    const p1 = (a: number): [number, number] => [
      l1 * Math.sin(a),
      -l1 * Math.cos(a),
    ];
    const p2 = (a: number, b: number): [number, number] => [
      l1 * Math.sin(a) + l2 * Math.sin(b),
      -l1 * Math.cos(a) - l2 * Math.cos(b),
    ];
    // Q1: мени се само φ1
    const Q1 = generalizedForce(
      [
        { force: [0, -G1], position: (q) => p1(q) },
        { force: [0, -G2], position: (q) => p2(q, phi2) },
        { force: [F, 0], position: (q) => p2(q, phi2) },
      ],
      phi1,
    );
    // Q2: мени се само φ2
    const Q2 = generalizedForce(
      [
        { force: [0, -G2], position: (q) => p2(phi1, q) },
        { force: [F, 0], position: (q) => p2(phi1, q) },
      ],
      phi2,
    );
    expect(Q1).toBeCloseTo(0, 6);
    expect(Q2).toBeCloseTo(0, 6);
    // същото по формулите Q1 = l1·[F·cos φ1 − (G1 + G2)·sin φ1] и т.н.
    expect(l1 * (F * Math.cos(phi1) - (G1 + G2) * Math.sin(phi1))).toBeCloseTo(
      0,
      10,
    );
    expect(l2 * (F * Math.cos(phi2) - G2 * Math.sin(phi2))).toBeCloseTo(0, 10);
  });

  it("статиката дава същото: нишките са по равнодействащите", () => {
    // долната точка: нишка 2 уравновесява (F; −G2) → tg φ2 = F / G2
    // двете точки заедно: нишка 1 уравновесява (F; −(G1 + G2))
    expect(Math.atan(F / G2) / RAD).toBeCloseTo(36.87, 2);
    expect(Math.atan(F / (G1 + G2)) / RAD).toBeCloseTo(16.7, 2);
  });
});

describe("„Подробно“, Пример 3 – товар, макара и тяло с триене", () => {
  const m1 = 8;
  const m2 = 4;
  const m3 = 10;
  const r = 0.15;
  const mu = 0.25;
  const system = blockPulleySystem({
    hangingMass: m1,
    pulleyMass: m2,
    blockMass: m3,
    mu,
  });

  it("числата от решението", () => {
    // J = ½·4·0,15² = 0,045 kg·m²; приведена маса 8 + 2 + 10 = 20 kg
    // G1 = 8·9,81 = 78,48 N; N3 = 98,1 N; F_тр = 0,25·98,1 = 24,525 N
    // Q_s = 78,48 − 24,525 = 53,955 N; a = 53,955 / 20 = 2,69775 m/s²
    expect((m2 * r * r) / 2).toBeCloseTo(0.045, 12);
    expect(system.reducedMass).toBeCloseTo(20, 12);
    expect(m1 * g).toBeCloseTo(78.48, 10);
    expect(m3 * g).toBeCloseTo(98.1, 10);
    expect(system.friction).toBeCloseTo(24.525, 10);
    expect(system.generalizedForce).toBeCloseTo(53.955, 10);
    expect(system.acceleration).toBeCloseTo(2.69775, 10);
    expect(system.acceleration).toBeCloseTo(2.698, 3);
    expect(system.moves).toBe(true);
    // S1 = 8·(9,81 − 2,698) = 56,9 N; S3 = 10·2,698 + 24,525 = 51,5 N
    expect(system.tensionHanging).toBeCloseTo(56.9, 1);
    expect(system.tensionBlock).toBeCloseTo(51.5, 1);
  });

  it("закръглените междинни числа водят до отпечатаните резултати", () => {
    expect(53.955 / 20).toBeCloseTo(2.698, 3);
    expect(Math.sqrt(2 * 2.698 * 1.5)).toBeCloseTo(2.845, 3);
    expect(8 * (9.81 - 2.698)).toBeCloseTo(56.9, 1);
    expect(10 * 2.698 + 24.525).toBeCloseTo(51.5, 1);
  });

  it("скорост след 1,5 m от покой: 2,845 m/s", () => {
    // v = √(2·2,69775·1,5) = √8,09325 = 2,8449 m/s; t = v / a = 1,0545 s
    const motion = motionFromRest({
      acceleration: system.acceleration,
      path: 1.5,
    });
    expect(motion.speed).toBeCloseTo(2.8449, 4);
    expect(motion.speed).toBeCloseTo(2.845, 3);
    expect(motion.time).toBeCloseTo(1.0545, 4);
  });

  it("Нютон–Ойлер: трите уравнения на телата дават същото ускорение", () => {
    // m1·a = m1·g − S1;  m3·a = S3 − F_тр;  J·a/r = (S1 − S3)·r
    // събиране: (m1 + J/r² + m3)·a = m1·g − F_тр
    const J = (m2 * r * r) / 2;
    const Ftr = mu * m3 * g;
    const a = (m1 * g - Ftr) / (m1 + J / (r * r) + m3);
    const S1 = m1 * (g - a);
    const S3 = m3 * a + Ftr;
    expect(system.acceleration).toBeCloseTo(a, 12);
    expect(system.tensionHanging).toBeCloseTo(S1, 12);
    expect(system.tensionBlock).toBeCloseTo(S3, 12);
    // уравнението на макарата: (S1 − S3)·r = J·ε, ε = a / r
    expect((S1 - S3) * r).toBeCloseTo((J * a) / r, 12);
    // S1 − S3 = ½·m2·a = 2·2,69775 = 5,3955 N
    expect(S1 - S3).toBeCloseTo(5.3955, 4);
  });

  it("обобщената сила по два начина", () => {
    // (1) от възможната работа за δs = 1: G1·1 − F_тр·1
    const fromWork = virtualWork([
      { force: m1 * g, displacement: 1 },
      { force: -mu * m3 * g, displacement: 1 },
    ]);
    // (2) Q = Σ F·∂r/∂s: товарът е в (0; −s), тялото в (2 − s; 0) – движи се
    // наляво; триенето върху него е надясно
    const fromDefinition = generalizedForce(
      [
        { force: [0, -m1 * g], position: (s) => [0, -s] },
        { force: [mu * m3 * g, -m3 * g], position: (s) => [2 - s, 0] },
        { force: [0, m3 * g], position: (s) => [2 - s, 0] },
      ],
      0.3,
    );
    // (3) потенциалната част от Π = −m1·g·s плюс триенето
    const fromPotential =
      generalizedForceFromPotential((s) => -m1 * g * s, 0.3) - mu * m3 * g;
    expect(fromWork).toBeCloseTo(53.955, 10);
    expect(fromDefinition).toBeCloseTo(53.955, 6);
    expect(fromPotential).toBeCloseTo(53.955, 6);
    expect(system.generalizedForce).toBeCloseTo(fromWork, 10);
  });

  it("уравнението на Лагранж (числено от T и Q) дава същото ускорение", () => {
    const J = (m2 * r * r) / 2;
    const kinetic = (_s: number, v: number) =>
      0.5 * m1 * v * v + 0.5 * J * (v / r) ** 2 + 0.5 * m3 * v * v;
    // T = 10·ṡ²: при ṡ = 1 m/s е 10 J
    expect(kinetic(0, 1)).toBeCloseTo(10, 12);
    const a = lagrangeAcceleration(
      { kinetic, force: () => m1 * g - mu * m3 * g },
      0.4,
      1.3,
    );
    expect(a).toBeCloseTo(2.69775, 6);
  });

  it("РК4 и теоремата за кинетичната енергия: T = Q_s·s = 80,93 J", () => {
    const a = system.acceleration;
    const t = motionFromRest({ acceleration: a, path: 1.5 }).time;
    const [s, v] = rk4((_t, y) => [y[1]!, a], [0, 0], 0, t, 1000);
    expect(s).toBeCloseTo(1.5, 9);
    expect(v).toBeCloseTo(2.8449, 4);
    // T = ½·20·v² = 10·8,09325 = 80,9325 J; работа 53,955·1,5 = 80,9325 J
    expect(0.5 * system.reducedMass * v! * v!).toBeCloseTo(80.9325, 6);
    expect(system.generalizedForce * 1.5).toBeCloseTo(80.9325, 10);
  });

  it("общото уравнение на динамиката е изпълнено", () => {
    // (m1·g − m1·a)·δs − J·ε·δφ − (m3·a + F_тр)·δs = 0, δφ = δs / r
    const a = system.acceleration;
    const J = (m2 * r * r) / 2;
    const ds = 1;
    expect(
      virtualWork([
        { force: m1 * g - m1 * a, displacement: ds },
        { force: -J * (a / r), displacement: ds / r },
        { force: -(m3 * a + mu * m3 * g), displacement: ds },
      ]),
    ).toBeCloseTo(0, 10);
  });

  it("при голямо триене системата не тръгва", () => {
    // m1 = 2 kg < μ·m3 = 2,5 kg
    const rest = blockPulleySystem({
      hangingMass: 2,
      pulleyMass: 4,
      blockMass: 10,
      mu: 0.25,
    });
    expect(rest.moves).toBe(false);
    expect(rest.acceleration).toBe(0);
    expect(rest.friction).toBeCloseTo(2 * g, 12);
  });
});

describe("„Подробно“, Пример 4 – прът-махало", () => {
  const m = 3;
  const l = 1.2;
  const rod = rodPendulum({ mass: m, length: l });

  it("числата от решението", () => {
    // J_O = 3·1,2²/3 = 1,44 kg·m²; 3g/(2l) = 29,43 / 2,4 = 12,2625 s⁻²
    // k = √12,2625 = 3,502 rad/s; T0 = 2π / 3,502 = 1,794 s
    expect(rod.inertia).toBeCloseTo(1.44, 12);
    expect(rod.kSquared).toBeCloseTo(12.2625, 10);
    expect(rod.k).toBeCloseTo(3.502, 3);
    expect(rod.smallPeriod).toBeCloseTo(1.794, 3);
    expect((2 * Math.PI) / 3.502).toBeCloseTo(1.794, 3);
  });

  it("пускане от 60°: ω = 3,502 rad/s и v = 4,202 m/s в най-ниското положение", () => {
    // ½·J_O·ω² = m·g·(l/2)·(1 − cos 60°) = 3·9,81·0,6·0,5 = 8,829 J
    // ω² = 2·8,829 / 1,44 = 12,2625 → ω = 3,502 rad/s; v = 3,502·1,2 = 4,202 m/s
    const energy = m * g * (l / 2) * (1 - Math.cos(60 * RAD));
    expect(energy).toBeCloseTo(8.829, 10);
    expect((2 * 8.829) / 1.44).toBeCloseTo(12.2625, 10);
    const omega = rodPendulumOmega({ length: l, phi0Deg: 60, phiDeg: 0 });
    expect(omega).toBeCloseTo(3.502, 3);
    expect(omega * l).toBeCloseTo(4.202, 3);
    expect(3.502 * 1.2).toBeCloseTo(4.202, 3);
  });

  it("Лагранж (числено от T и Π) = Ойлер (J_O·ε = M_O)", () => {
    const kinetic = (_phi: number, omega: number) =>
      0.5 * rod.inertia * omega * omega;
    const potential = (phi: number) => -m * g * (l / 2) * Math.cos(phi);
    for (const phiDeg of [-50, 10, 35, 60, 120]) {
      const phi = phiDeg * RAD;
      const lagrange = lagrangeAcceleration(
        {
          kinetic,
          force: (q) => generalizedForceFromPotential(potential, q),
        },
        phi,
        0.7,
      );
      // Ойлер: момент на теглото спрямо O, M = x·F_y − y·F_x с точка C
      const xC = (l / 2) * Math.sin(phi);
      const moment = xC * (-m * g);
      const euler = moment / rod.inertia;
      expect(lagrange).toBeCloseTo(euler, 5);
      expect(rodPendulumAcceleration(l, phi)).toBeCloseTo(euler, 10);
    }
  });

  it("обобщената сила по два начина: от потенциала и от Σ F·∂r/∂φ", () => {
    const phi = 35 * RAD;
    const fromPotential = generalizedForceFromPotential(
      (q) => -m * g * (l / 2) * Math.cos(q),
      phi,
    );
    const fromDefinition = generalizedForce(
      [
        {
          force: [0, -m * g],
          position: (q) => [(l / 2) * Math.sin(q), -(l / 2) * Math.cos(q)],
        },
      ],
      phi,
    );
    // Q_φ = −m·g·(l/2)·sin φ = −17,658·sin 35° = −10,128 N·m
    expect(fromPotential).toBeCloseTo(-10.128, 3);
    expect(fromDefinition).toBeCloseTo(fromPotential, 6);
  });

  it("РК4: енергията се запазва и ω в дъното е 3,5018 rad/s", () => {
    const f = (_t: number, y: number[]) => [
      y[1]!,
      rodPendulumAcceleration(l, y[0]!),
    ];
    const energy = (y: number[]) =>
      0.5 * rod.inertia * y[1]! ** 2 - m * g * (l / 2) * Math.cos(y[0]!);
    const start = [60 * RAD, 0];
    // E = −m·g·(l/2)·cos 60° = −8,829 J
    expect(energy(start)).toBeCloseTo(-8.829, 10);
    const after = rk4(f, start, 0, 5, 50_000);
    expect(energy(after)).toBeCloseTo(-8.829, 8);
    // интегриране до първото минаване през отвеса
    let y = start;
    let previous = start;
    const h = 1e-4;
    let t = 0;
    while (y[0]! > 0) {
      previous = y;
      y = rk4(f, y, t, t + h, 1);
      t += h;
    }
    const fraction = previous[0]! / (previous[0]! - y[0]!);
    const omegaBottom = previous[1]! + (y[1]! - previous[1]!) * fraction;
    expect(Math.abs(omegaBottom)).toBeCloseTo(3.5018, 4);
  });

  it("същият период като математично махало с дължина 2l/3 = 0,8 m", () => {
    // 2π·√(0,8 / 9,81) = 1,794 s
    expect(2 * Math.PI * Math.sqrt(0.8 / g)).toBeCloseTo(rod.smallPeriod, 12);
    expect((2 * l) / 3).toBeCloseTo(0.8, 12);
  });
});

describe("въпроси от „Подробно“", () => {
  it("греда с конзола: A_v = −4,5 kN (надолу)", () => {
    // без A, завъртане около B: A_v·δ + 9·δ·(2/4) = 0 → A_v = −4,5 kN
    const loads: PointLoad[] = [{ x: 6, force: 9 }];
    const A = beamReactionByVirtualWork({
      supportA: 0,
      supportB: 4,
      loads,
      removed: "A",
    });
    expect(A).toBeCloseTo(-4.5, 10);
    // ΣM_B: A_v·4 + 9·2 = 0
    expect(staticsTwoSupports(0, 4, loads).A).toBeCloseTo(-4.5, 10);
    // B_v = 9 + 4,5 = 13,5 kN
    expect(
      beamReactionByVirtualWork({
        supportA: 0,
        supportB: 4,
        loads,
        removed: "B",
      }),
    ).toBeCloseTo(13.5, 10);
  });

  it("махало под хоризонтална сила: tg φ = 10 / 19,62 → 27,0°", () => {
    // G = 2·9,81 = 19,62 N; 10 / 19,62 = 0,5097; arctg = 27,0°
    expect(2 * g).toBeCloseTo(19.62, 10);
    expect(10 / 19.62).toBeCloseTo(0.5097, 4);
    const phiDeg = hangingEquilibriumAngle({ weight: 2 * g, force: 10 });
    expect(phiDeg).toBeCloseTo(27.0, 1);
    // обобщената сила Q_φ = l·(F·cos φ − m·g·sin φ) е нула там (l = 0,9 m)
    const l = 0.9;
    const Q = generalizedForce(
      [
        {
          force: [10, -2 * g],
          position: (q) => [l * Math.sin(q), -l * Math.cos(q)],
        },
      ],
      phiDeg * RAD,
    );
    expect(Q).toBeCloseTo(0, 6);
  });

  it("цилиндър по наклон 30°: a = (2/3)·g·sin α = 3,27 m/s²", () => {
    // (2/3)·9,81·0,5 = 3,27 m/s²
    const rolling = rollingAcceleration({ angleDeg: 30 });
    expect(rolling.acceleration).toBeCloseTo(3.27, 10);
    expect(rolling.frictionShare).toBeCloseTo(1 / 3, 12);
    // Лагранж числено: T = ¾·m·ẋ², Q_x = m·g·sin α (m = 7 kg – съкращава се)
    const mass = 7;
    const a = lagrangeAcceleration(
      {
        kinetic: (_x, v) => 0.75 * mass * v * v,
        force: () => mass * g * Math.sin(30 * RAD),
      },
      0,
      2,
    );
    expect(a).toBeCloseTo(3.27, 6);
    // Нютон–Ойлер: m·a = m·g·sin α − F;  ½·m·r²·(a/r) = F·r → F = ½·m·a
    // → a = (2/3)·g·sin α и F = (1/3)·m·g·sin α
    const aNewton = (g * Math.sin(30 * RAD)) / 1.5;
    const friction = 0.5 * mass * aNewton;
    expect(aNewton).toBeCloseTo(rolling.acceleration, 12);
    expect(mass * aNewton).toBeCloseTo(
      mass * g * Math.sin(30 * RAD) - friction,
      12,
    );
    expect(friction / (mass * g * Math.sin(30 * RAD))).toBeCloseTo(1 / 3, 12);
  });

  it("товар 5 kg на пружина 981 N/m: x = 0,05 m", () => {
    // x = 5·9,81 / 981 = 0,05 m; там dΠ/dx = 0
    const x = springEquilibrium({ mass: 5, c: 981 });
    expect(x).toBeCloseTo(0.05, 12);
    const Q = generalizedForceFromPotential(
      (q) => 0.5 * 981 * q * q - 5 * g * q,
      x,
    );
    expect(Q).toBeCloseTo(0, 6);
  });
});

describe("проверка на входа", () => {
  it("невалидни стойности дават грешка", () => {
    expect(() => leverForce({ load: 600, loadArm: 0, forceArm: 1 })).toThrow();
    expect(() => pulleyBlockForce({ load: 500, strands: 2.5 })).toThrow();
    expect(() => winchMoment({ load: 100, radius: -1 })).toThrow();
    expect(() =>
      beamReactionByVirtualWork({
        supportA: 3,
        supportB: 3,
        loads: [],
        removed: "A",
      }),
    ).toThrow();
    expect(() =>
      gerberVirtualDisplacement(
        { supportA: 0, supportB: 6, hinge: 5, supportD: 12 },
        "B",
        1,
      ),
    ).toThrow();
    expect(() =>
      blockPulleySystem({
        hangingMass: 8,
        pulleyMass: 4,
        blockMass: 10,
        mu: -0.1,
      }),
    ).toThrow();
    expect(() => rodPendulum({ mass: 3, length: 0 })).toThrow();
    expect(() =>
      rodPendulumOmega({ length: 1.2, phi0Deg: 30, phiDeg: 60 }),
    ).toThrow();
    expect(() => rollingAcceleration({ angleDeg: 90 })).toThrow();
    expect(() => springEquilibrium({ mass: 5, c: 0 })).toThrow();
    expect(() => virtualWork([{ force: NaN, displacement: 1 }])).toThrow();
  });
});
