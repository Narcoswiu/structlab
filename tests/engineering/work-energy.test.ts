import { describe, expect, it } from "vitest";
import {
  G_ACCELERATION,
  averagePower,
  curlZ,
  frictionWork,
  gravityPotential,
  gravityWork,
  isPotentialField,
  momentWork,
  power,
  reduceToPole,
  rigidBodyPower,
  rigidBodyWork,
  rotationalPower,
  rpmToRadPerSec,
  springDeformation,
  springForceField,
  springPotential,
  springWork,
  workAlongPolyline,
  workAlongStraightPath,
  workFromPotential,
  workOfConstantForce,
  type ForceField,
  type Vec2,
} from "@/lib/engineering/work-energy";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Единици: m, s, kg, N, J, W, rad. Оста y е нагоре, g = 9,81 m/s².
// Ъгли, ω и моменти са положителни обратно на часовниковата стрелка.

const g = G_ACCELERATION;

/**
 * Независима проверка: криволинеен интеграл по ПРОИЗВОЛНА гладка крива
 * r(u), u ∈ [0; 1], по правилото на средните точки. Не ползва нищо от
 * проверявания файл (там интегрирането е по Симпсън и само по отсечки).
 */
function lineIntegral(
  field: (p: Vec2) => Vec2,
  curve: (u: number) => Vec2,
  steps = 20000,
): number {
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const a = curve(i / steps);
    const b = curve((i + 1) / steps);
    const F = field({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    sum += F.x * (b.x - a.x) + F.y * (b.y - a.y);
  }
  return sum;
}

describe("работа на постоянна сила", () => {
  it("A = F·s·cos α и знакът на работата", () => {
    // 100 N по посока на преместването 3 m: 300 J; срещу него: −300 J; перпендикулярно: 0
    expect(workAlongStraightPath(100, 3)).toBeCloseTo(300, 10);
    expect(workAlongStraightPath(100, 3, Math.PI)).toBeCloseTo(-300, 10);
    expect(workAlongStraightPath(100, 3, Math.PI / 2)).toBeCloseTo(0, 10);
    // под 60°: 100 · 3 · 0,5 = 150 J
    expect(workAlongStraightPath(100, 3, Math.PI / 3)).toBeCloseTo(150, 10);
  });

  it("„Провери се“ (Подробно) 1: F = (30; −40) N от (1; 2) до (4; 1) m", () => {
    // Δr = (3; −1); A = 30·3 + (−40)·(−1) = 90 + 40 = 130 J
    expect(
      workOfConstantForce({ x: 30, y: -40 }, { x: 1, y: 2 }, { x: 4, y: 1 }),
    ).toBeCloseTo(130, 10);
  });

  it("„Провери се“ (Леко) 1: раница по равен коридор – работата на теглото е нула", () => {
    // тегло (0; −98,1) N, преместване (50; 0) m: A = 0
    expect(
      workOfConstantForce(
        { x: 0, y: -10 * g },
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ),
    ).toBeCloseTo(0, 10);
    expect(gravityWork(10, 1.2, 1.2)).toBeCloseTo(0, 10);
  });
});

describe("Леко, пример 1: сандък на платформа 1,5 m", () => {
  const m = 40;
  const G = m * g; // 392,4 N
  const sin = 0.6; // рампа 2,5 m, височина 1,5 m, основа 2 m
  const cos = 0.8;

  it("тегло и работа на теглото", () => {
    // G = 40 · 9,81 = 392,4 N; A = −392,4 · 1,5 = −588,6 J
    expect(G).toBeCloseTo(392.4, 10);
    expect(gravityWork(m, 0, 1.5)).toBeCloseTo(-588.6, 10);
  });

  it("(а) право нагоре и (б) по гладката рампа – една и съща работа", () => {
    // (а) 392,4 · 1,5 = 588,6 J
    expect(workAlongStraightPath(G, 1.5)).toBeCloseTo(588.6, 10);
    // (б) сила G·sin α = 392,4 · 0,6 = 235,44 N; 235,44 · 2,5 = 588,6 J
    expect(G * sin).toBeCloseTo(235.44, 10);
    expect(workAlongStraightPath(G * sin, 2.5)).toBeCloseTo(588.6, 10);
    // геометрия: 2² + 1,5² = 2,5²
    expect(Math.hypot(2, 1.5)).toBeCloseTo(2.5, 12);
  });

  it("(в) рампа с триене μ = 0,2", () => {
    // N = 392,4 · 0,8 = 313,92 N; F_тр = 0,2 · 313,92 = 62,784 N
    const N = G * cos;
    expect(N).toBeCloseTo(313.92, 10);
    expect(0.2 * N).toBeCloseTo(62.784, 10);
    // A_тр = −62,784 · 2,5 = −156,96 J
    expect(frictionWork(0.2, N, 2.5)).toBeCloseTo(-156.96, 10);
    // сила на бутане 235,44 + 62,784 = 298,224 N; работа 298,224 · 2,5 = 745,56 J
    const push = G * sin + 0.2 * N;
    expect(push).toBeCloseTo(298.224, 10);
    expect(workAlongStraightPath(push, 2.5)).toBeCloseTo(745.56, 10);
    // 588,6 + 156,96 = 745,56
    expect(588.6 + 156.96).toBeCloseTo(745.56, 10);
  });

  it("независимо: числен интеграл на теглото по три различни пътя", () => {
    const weight: ForceField = () => ({ x: 0, y: -G });
    const A: Vec2 = { x: 0, y: 0 };
    const B: Vec2 = { x: 2, y: 1.5 };
    // по рампата; по пода и право нагоре; по парабола y = 1,5·(x/2)²
    expect(workAlongPolyline(weight, [A, B])).toBeCloseTo(-588.6, 9);
    expect(workAlongPolyline(weight, [A, { x: 2, y: 0 }, B])).toBeCloseTo(
      -588.6,
      9,
    );
    expect(
      lineIntegral(weight, (u) => ({ x: 2 * u, y: 1.5 * u * u })),
    ).toBeCloseTo(-588.6, 8);
    // и потенциалната енергия: Π_A − Π_B = 0 − 588,6
    expect(
      workFromPotential(gravityPotential(m, 0), gravityPotential(m, 1.5)),
    ).toBeCloseTo(-588.6, 10);
  });
});

describe("Леко, пример 2: пружина c = 2000 N/m", () => {
  const c = 2000;

  it("от 0 до 0,05 m", () => {
    // сила в края 2000 · 0,05 = 100 N; средна 50 N; 50 · 0,05 = 2,5 J
    expect(c * 0.05).toBeCloseTo(100, 10);
    expect((100 / 2) * 0.05).toBeCloseTo(2.5, 10);
    // работа на пружината −½ · 2000 · 0,05² = −2,5 J; Π = 2,5 J
    expect(springWork(c, 0, 0.05)).toBeCloseTo(-2.5, 10);
    expect(springPotential(c, 0.05)).toBeCloseTo(2.5, 10);
  });

  it("от 0,05 до 0,10 m – три пъти повече", () => {
    // ½ · 2000 · (0,01 − 0,0025) = 1000 · 0,0075 = 7,5 J
    expect(springWork(c, 0.05, 0.1)).toBeCloseTo(-7.5, 10);
    // сила 200 N в края; средна (100 + 200)/2 = 150 N; 150 · 0,05 = 7,5 J
    expect(c * 0.1).toBeCloseTo(200, 10);
    expect(150 * 0.05).toBeCloseTo(7.5, 10);
    // Π(0,10) = ½ · 2000 · 0,01 = 10 J = 2,5 + 7,5
    expect(springPotential(c, 0.1)).toBeCloseTo(10, 10);
    expect(springWork(c, 0.05, 0.1) / springWork(c, 0, 0.05)).toBeCloseTo(
      3,
      10,
    );
  });

  it("независимо: числен интеграл на −c·x", () => {
    const spring: ForceField = (p) => ({ x: -c * p.x, y: 0 });
    expect(lineIntegral(spring, (u) => ({ x: 0.05 * u, y: 0 }))).toBeCloseTo(
      -2.5,
      8,
    );
    expect(
      lineIntegral(spring, (u) => ({ x: 0.05 + 0.05 * u, y: 0 })),
    ).toBeCloseTo(-7.5, 8);
  });

  it("знакът на деформацията няма значение", () => {
    expect(springWork(c, 0, -0.05)).toBeCloseTo(-2.5, 10);
    expect(springPotential(c, -0.05)).toBeCloseTo(2.5, 10);
  });
});

describe("Подробно, пример 1: тегло и пружина по два пътя", () => {
  const m = 2;
  const c = 200;
  const l0 = 0.4;
  const O: Vec2 = { x: 0, y: 0 };
  const A: Vec2 = { x: 0.3, y: 0.4 };
  const B: Vec2 = { x: 0.6, y: 0.8 };
  const D: Vec2 = { x: 0.6, y: 0.4 };
  const spring = springForceField(c, O, l0);
  const weight: ForceField = () => ({ x: 0, y: -m * g });

  it("дължини и деформации", () => {
    // OA = √(0,09 + 0,16) = 0,5 m; OB = √(0,36 + 0,64) = 1,0 m
    // λ_A = 0,5 − 0,4 = 0,1 m; λ_B = 1,0 − 0,4 = 0,6 m
    expect(springDeformation(O, A, l0)).toBeCloseTo(0.1, 12);
    expect(springDeformation(O, B, l0)).toBeCloseTo(0.6, 12);
    // r_D = √(0,36 + 0,16) = √0,52 = 0,721110 m
    expect(Math.hypot(D.x, D.y)).toBeCloseTo(0.72111, 6);
    // силата на пружината в A: 200 · 0,1 = 20 N, към O
    const FA = spring(A);
    expect(Math.hypot(FA.x, FA.y)).toBeCloseTo(20, 10);
    expect(FA.x).toBeCloseTo(-12, 10); // 20 · 0,3/0,5
    expect(FA.y).toBeCloseTo(-16, 10); // 20 · 0,4/0,5
    // тегло 2 · 9,81 = 19,62 N
    expect(m * g).toBeCloseTo(19.62, 10);
  });

  it("работа на теглото: −7,848 J по двата пътя", () => {
    // −2 · 9,81 · (0,8 − 0,4) = −7,848 J
    expect(gravityWork(m, A.y, B.y)).toBeCloseTo(-7.848, 10);
    expect(workAlongPolyline(weight, [A, B])).toBeCloseTo(-7.848, 9);
    expect(workAlongPolyline(weight, [A, D, B])).toBeCloseTo(-7.848, 9);
  });

  it("работа на пружината: −35 J по формулата", () => {
    // −(200/2) · (0,6² − 0,1²) = −100 · 0,35 = −35 J
    expect(springWork(c, 0.1, 0.6)).toBeCloseTo(-35, 10);
  });

  it("път II на ръка: A_AD = −9,3112 J, A_DB = −25,6888 J", () => {
    // A_AD = −200·[(0,36 − 0,09)/2 − 0,4·(0,721110 − 0,5)]
    //      = −200·(0,135 − 0,088444) = −200 · 0,046556 = −9,3112 J
    const rD = Math.hypot(0.6, 0.4);
    const AAD = -c * ((0.36 - 0.09) / 2 - l0 * (rD - 0.5));
    expect(AAD).toBeCloseTo(-9.3112, 4);
    // със закръглените междинни числа от текста
    expect(-200 * (0.135 - 0.088444)).toBeCloseTo(-9.3112, 4);
    expect(0.4 * (0.72111 - 0.5)).toBeCloseTo(0.088444, 6);
    // A_DB = −200·[(0,64 − 0,16)/2 − 0,4·(1 − 0,721110)]
    //      = −200·(0,24 − 0,111556) = −200 · 0,128444 = −25,6888 J
    const ADB = -c * ((0.64 - 0.16) / 2 - l0 * (1 - rD));
    expect(ADB).toBeCloseTo(-25.6888, 4);
    expect(-200 * (0.24 - 0.111556)).toBeCloseTo(-25.6888, 4);
    expect(0.4 * (1 - 0.72111)).toBeCloseTo(0.111556, 6);
    // сбор: −9,3112 − 25,6888 = −35,0000 J
    expect(AAD + ADB).toBeCloseTo(-35, 10);
    expect(-9.3112 - 25.6888).toBeCloseTo(-35, 10);
  });

  it("числен интеграл на пружинната сила по четири пътя", () => {
    expect(workAlongPolyline(spring, [A, B])).toBeCloseTo(-35, 8);
    expect(workAlongPolyline(spring, [A, D])).toBeCloseTo(-9.3112, 4);
    expect(workAlongPolyline(spring, [D, B])).toBeCloseTo(-25.6888, 4);
    expect(workAlongPolyline(spring, [A, D, B])).toBeCloseTo(-35, 8);
    expect(workAlongPolyline(spring, [A, { x: 0.3, y: 0.8 }, B])).toBeCloseTo(
      -35,
      8,
    );
    // независим интегратор, крива линия от A до B
    expect(
      lineIntegral(spring, (u) => ({
        x: 0.3 + 0.3 * u,
        y: 0.4 + 0.4 * u * u * u,
      })),
    ).toBeCloseTo(-35, 6);
    // по затворен път работата е нула
    expect(workAlongPolyline(spring, [A, D, B, A])).toBeCloseTo(0, 8);
  });

  it("потенциална енергия: Π_A − Π_B = сборът от работите", () => {
    // Π_A = 2·9,81·0,4 + ½·200·0,1² = 7,848 + 1 = 8,848 J
    const piA = gravityPotential(m, A.y) + springPotential(c, 0.1);
    expect(gravityPotential(m, A.y)).toBeCloseTo(7.848, 10);
    expect(springPotential(c, 0.1)).toBeCloseTo(1, 10);
    expect(piA).toBeCloseTo(8.848, 10);
    // Π_B = 2·9,81·0,8 + ½·200·0,6² = 15,696 + 36 = 51,696 J
    const piB = gravityPotential(m, B.y) + springPotential(c, 0.6);
    expect(gravityPotential(m, B.y)).toBeCloseTo(15.696, 10);
    expect(springPotential(c, 0.6)).toBeCloseTo(36, 10);
    expect(piB).toBeCloseTo(51.696, 10);
    // Π_A − Π_B = −42,848 J = −7,848 − 35
    expect(workFromPotential(piA, piB)).toBeCloseTo(-42.848, 10);
    expect(gravityWork(m, A.y, B.y) + springWork(c, 0.1, 0.6)).toBeCloseTo(
      -42.848,
      10,
    );
    // и числено, с двете сили заедно, по път II
    const both: ForceField = (p) => ({
      x: spring(p).x,
      y: spring(p).y - m * g,
    });
    expect(workAlongPolyline(both, [A, D, B])).toBeCloseTo(-42.848, 8);
  });

  it("числено: F = −grad Π за пружината", () => {
    const pi = (p: Vec2) => springPotential(c, springDeformation(O, p, l0));
    const h = 1e-6;
    const F = spring(D);
    expect(
      -(pi({ x: D.x + h, y: D.y }) - pi({ x: D.x - h, y: D.y })) / (2 * h),
    ).toBeCloseTo(F.x, 5);
    expect(
      -(pi({ x: D.x, y: D.y + h }) - pi({ x: D.x, y: D.y - h })) / (2 * h),
    ).toBeCloseTo(F.y, 5);
  });
});

describe("Подробно, пример 2: потенциално и непотенциално поле", () => {
  const k = 3; // N/m
  const F1: ForceField = (p) => ({ x: k * p.y, y: k * p.x });
  const F2: ForceField = (p) => ({ x: -k * p.y, y: k * p.x });
  const O: Vec2 = { x: 0, y: 0 };
  const B: Vec2 = { x: 2, y: 1 };
  const C: Vec2 = { x: 2, y: 0 };
  const D: Vec2 = { x: 0, y: 1 };
  const samples: Vec2[] = [O, B, C, D, { x: 0.7, y: -1.3 }];

  it("признакът ∂F_x/∂y = ∂F_y/∂x", () => {
    // F1: k − k = 0; F2: k − (−k) = 2k = 6 N/m
    expect(isPotentialField(F1, samples)).toBe(true);
    expect(isPotentialField(F2, samples)).toBe(false);
    expect(curlZ(F1, B)).toBeCloseTo(0, 6);
    expect(curlZ(F2, B)).toBeCloseTo(6, 6);
  });

  it("F1: 6 J по трите пътя и от Π = −k·x·y", () => {
    // път I (през C): 0 + F_y(x = 2)·1 = 3·2·1 = 6 J
    expect(workAlongPolyline(F1, [O, C, B])).toBeCloseTo(6, 10);
    // път II (през D): 0 + F_x(y = 1)·2 = 3·1·2 = 6 J
    expect(workAlongPolyline(F1, [O, D, B])).toBeCloseTo(6, 10);
    // път III (x = 2u, y = u): ∫(3u·2 + 6u·1)du = ∫12u du = 6 J
    expect(workAlongPolyline(F1, [O, B])).toBeCloseTo(6, 10);
    // Π_O − Π_B = 0 − (−3·2·1) = 6 J
    const pi = (p: Vec2) => -k * p.x * p.y;
    expect(pi(B)).toBeCloseTo(-6, 10);
    expect(workFromPotential(pi(O), pi(B))).toBeCloseTo(6, 10);
    // независим интегратор, парабола y = (x/2)²
    expect(lineIntegral(F1, (u) => ({ x: 2 * u, y: u * u }))).toBeCloseTo(6, 6);
  });

  it("F2: 6 J, −6 J и 0 – работата зависи от пътя", () => {
    // път I: 0 + 3·2·1 = 6 J
    expect(workAlongPolyline(F2, [O, C, B])).toBeCloseTo(6, 10);
    // път II: 0 + (−3·1)·2 = −6 J
    expect(workAlongPolyline(F2, [O, D, B])).toBeCloseTo(-6, 10);
    // път III: ∫(−3u·2 + 6u·1)du = 0
    expect(workAlongPolyline(F2, [O, B])).toBeCloseTo(0, 10);
    // по затворения път O → C → B → D → O работата не е нула: 6 + 6 = 12 J
    expect(workAlongPolyline(F2, [O, C, B, D, O])).toBeCloseTo(12, 10);
  });
});

describe("Подробно, пример 3: търкалящ се цилиндър със спирачна двоица", () => {
  const m = 10;
  const r = 0.2;
  const s = 3;
  const G = m * g; // 98,1 N
  const alpha = Math.PI / 6; // наклонът слиза надясно
  const brake = 4; // N·m, обратно на часовниковата стрелка

  it("работите една по една", () => {
    // слизане h = 3 · 0,5 = 1,5 m: A_G = 98,1 · 1,5 = 147,15 J
    expect(G).toBeCloseTo(98.1, 10);
    expect(gravityWork(m, 1.5, 0)).toBeCloseTo(147.15, 10);
    // Δφ = −s/r = −3/0,2 = −15 rad (по часовниковата стрелка)
    const dphi = -s / r;
    expect(dphi).toBeCloseTo(-15, 10);
    // A_M = 4 · (−15) = −60 J
    expect(momentWork(brake, dphi)).toBeCloseTo(-60, 10);
    // сбор 147,15 − 60 = 87,15 J
    expect(gravityWork(m, 1.5, 0) + momentWork(brake, dphi)).toBeCloseTo(
      87.15,
      10,
    );
  });

  it("общата формула A = R·Δr_C + M_C·Δφ дава 87,15 J при всяка сила на триене", () => {
    const t: Vec2 = { x: Math.cos(alpha), y: -Math.sin(alpha) }; // надолу по наклона
    const n: Vec2 = { x: Math.sin(alpha), y: Math.cos(alpha) }; // от наклона навън
    const centre: Vec2 = { x: 0, y: 0 };
    const contact: Vec2 = { x: -r * n.x, y: -r * n.y };
    const N = G * Math.cos(alpha);
    for (const friction of [0, 20, 33]) {
      const { R, MO } = reduceToPole(
        [
          { force: { x: 0, y: -G }, point: centre },
          { force: { x: N * n.x, y: N * n.y }, point: contact },
          // триенето е нагоре по наклона
          { force: { x: -friction * t.x, y: -friction * t.y }, point: contact },
        ],
        centre,
        [brake],
      );
      // M_C = 4 − F_тр · r: триенето (нагоре по наклона, приложено под
      // центъра) върти по часовниковата стрелка – то завърта цилиндъра
      expect(MO).toBeCloseTo(brake - friction * r, 10);
      expect(
        rigidBodyWork({
          R,
          MO,
          poleDisplacement: { x: s * t.x, y: s * t.y },
          deltaPhi: -s / r,
        }),
      ).toBeCloseTo(87.15, 10);
    }
  });

  it("мощности при v_C = 2 m/s", () => {
    // ω = −2/0,2 = −10 rad/s
    const omega = -2 / r;
    const v: Vec2 = { x: 2 * Math.cos(alpha), y: -2 * Math.sin(alpha) };
    // P_G = 98,1 · 0,5 · 2 = 49,05 · 2 = 98,1 W
    expect(G * 0.5).toBeCloseTo(49.05, 10);
    expect(power({ x: 0, y: -G }, v)).toBeCloseTo(98.1, 10);
    // P_M = 4 · (−10) = −40 W; общо 58,1 W
    expect(rotationalPower(brake, omega)).toBeCloseTo(-40, 10);
    expect(
      rigidBodyPower({
        R: { x: 0, y: -G },
        MO: brake,
        poleVelocity: v,
        omega,
      }),
    ).toBeCloseTo(58.1, 10);
  });

  it("точката на допиране е МЦС: скоростта ѝ е нула, значи P на триенето и на N е нула", () => {
    // v_K = v_C + ω × r_CK; ω × (x; y) = (−ω·y; ω·x)
    const omega = -2 / r;
    const n: Vec2 = { x: Math.sin(alpha), y: Math.cos(alpha) };
    const rCK: Vec2 = { x: -r * n.x, y: -r * n.y };
    const vK: Vec2 = {
      x: 2 * Math.cos(alpha) - omega * rCK.y,
      y: -2 * Math.sin(alpha) + omega * rCK.x,
    };
    expect(vK.x).toBeCloseTo(0, 12);
    expect(vK.y).toBeCloseTo(0, 12);
    expect(power({ x: -25, y: 14 }, vK)).toBeCloseTo(0, 10);
  });
});

describe("В реалния живот: лебедка", () => {
  const m = 500;
  const G = m * g;

  it("работа и мощност при равномерно вдигане", () => {
    // G = 500 · 9,81 = 4905 N = 4,905 kN
    expect(G).toBeCloseTo(4905, 10);
    expect(G / 1000).toBeCloseTo(4.905, 10);
    // A = 4905 · 10 = 49 050 J = 49,05 kJ
    expect(workAlongStraightPath(G, 10)).toBeCloseTo(49050, 8);
    expect(-gravityWork(m, 0, 10)).toBeCloseTo(49050, 8);
    // t = 10/0,4 = 25 s; P = 49 050/25 = 1962 W
    expect(10 / 0.4).toBeCloseTo(25, 10);
    expect(averagePower(49050, 25)).toBeCloseTo(1962, 10);
    // P = F·v = 4905 · 0,4 = 1962 W
    expect(power({ x: 0, y: G }, { x: 0, y: 0.4 })).toBeCloseTo(1962, 10);
    expect(1962 / 1000).toBeCloseTo(1.962, 10);
  });

  it("P = F·v = M·ω и A = M·φ за барабана", () => {
    const r = 0.25;
    // M = 4905 · 0,25 = 1226,25 N·m; ω = 0,4/0,25 = 1,6 rad/s
    const M = G * r;
    const omega = 0.4 / r;
    expect(M).toBeCloseTo(1226.25, 10);
    expect(omega).toBeCloseTo(1.6, 10);
    // P = 1226,25 · 1,6 = 1962 W
    expect(rotationalPower(M, omega)).toBeCloseTo(1962, 10);
    expect(rotationalPower(M, omega)).toBeCloseTo(
      power({ x: 0, y: G }, { x: 0, y: 0.4 }),
      10,
    );
    // φ = 10/0,25 = 40 rad; A = 1226,25 · 40 = 49 050 J
    expect(momentWork(M, 10 / r)).toBeCloseTo(49050, 8);
    // въжето слиза от дясната страна на барабана: сила (0; −G) в точка (r; 0);
    // моментът ѝ спрямо оста е −G·r, двигателят дава +G·r
    const { MO } = reduceToPole(
      [{ force: { x: 0, y: -G }, point: { x: r, y: 0 } }],
      { x: 0, y: 0 },
    );
    expect(MO).toBeCloseTo(-1226.25, 10);
    // точката (r; 0) при ω > 0 има скорост (0; ω·r) – нагоре
    expect(omega * r).toBeCloseTo(0.4, 10);
  });
});

describe("работа на триенето – зависи от пътя", () => {
  it("сандък 40 kg по хоризонтален под, μ = 0,2", () => {
    // N = 392,4 N; F_тр = 0,2 · 392,4 = 78,48 N
    const N = 40 * g;
    expect(0.2 * N).toBeCloseTo(78.48, 10);
    // направо 2,5 m: −78,48 · 2,5 = −196,2 J
    expect(frictionWork(0.2, N, 2.5)).toBeCloseTo(-196.2, 10);
    // по катетите 2 + 1,5 = 3,5 m: −78,48 · 3,5 = −274,68 J
    expect(frictionWork(0.2, N, 3.5)).toBeCloseTo(-274.68, 10);
    // по затворения триъгълник 6 m: −470,88 J ≠ 0
    expect(frictionWork(0.2, N, 6)).toBeCloseTo(-470.88, 10);
    expect(frictionWork(0.2, N, 2.5)).not.toBeCloseTo(
      frictionWork(0.2, N, 3.5),
      1,
    );
  });

  it("независимо: интеграл на сила с големина μ·N срещу скоростта", () => {
    const F = 78.48;
    // силата е винаги срещу преместването: −F·|dr|
    const along = (points: Vec2[]) => {
      let sum = 0;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]!;
        const b = points[i]!;
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        const opposing: ForceField = () => ({
          x: (-F * (b.x - a.x)) / length,
          y: (-F * (b.y - a.y)) / length,
        });
        sum += workAlongPolyline(opposing, [a, b]);
      }
      return sum;
    };
    const A: Vec2 = { x: 0, y: 0 };
    const B: Vec2 = { x: 2, y: 1.5 };
    expect(along([A, B])).toBeCloseTo(-196.2, 9);
    expect(along([A, { x: 2, y: 0 }, B])).toBeCloseTo(-274.68, 9);
  });
});

describe("„Провери се“", () => {
  it("Леко 2: тяло 5 kg слиза 4 m", () => {
    // 5 · 9,81 · 4 = 196,2 J
    expect(gravityWork(5, 4, 0)).toBeCloseTo(196.2, 10);
  });

  it("Леко 3: пружина 500 N/m, разтегната 0,2 m", () => {
    // ½ · 500 · 0,04 = 10 J
    expect(springPotential(500, 0.2)).toBeCloseTo(10, 10);
  });

  it("Леко 4: 300 N при 2 m/s", () => {
    // 300 · 2 = 600 W
    expect(power({ x: 300, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(600, 10);
  });

  it("Подробно 2: пружина 800 N/m от 0,05 до 0,15 m", () => {
    // −400 · (0,0225 − 0,0025) = −400 · 0,02 = −8 J
    expect(springWork(800, 0.05, 0.15)).toBeCloseTo(-8, 10);
  });

  it("Подробно 3: поле (4x; −6y)", () => {
    const F: ForceField = (p) => ({ x: 4 * p.x, y: -6 * p.y });
    const pi = (p: Vec2) => -2 * p.x * p.x + 3 * p.y * p.y;
    const O: Vec2 = { x: 0, y: 0 };
    const B: Vec2 = { x: 1, y: 2 };
    expect(isPotentialField(F, [O, B, { x: -1, y: 0.5 }])).toBe(true);
    // Π(1; 2) = −2 + 12 = 10 J; A = 0 − 10 = −10 J
    expect(pi(B)).toBeCloseTo(10, 10);
    expect(workFromPotential(pi(O), pi(B))).toBeCloseTo(-10, 10);
    // пряко: ∫4x dx от 0 до 1 = 2; ∫−6y dy от 0 до 2 = −12; сбор −10
    expect(workAlongPolyline(F, [O, { x: 1, y: 0 }, B])).toBeCloseTo(-10, 10);
    expect(workAlongPolyline(F, [O, B])).toBeCloseTo(-10, 10);
  });

  it("Подробно 4: вал 200 N·m при 300 min⁻¹", () => {
    // ω = π · 300/30 = 31,416 rad/s; P = 200 · 31,416 = 6283,2 ≈ 6283 W
    expect(rpmToRadPerSec(300)).toBeCloseTo(31.416, 3);
    expect(rotationalPower(200, rpmToRadPerSec(300))).toBeCloseTo(6283, 0);
    expect(Math.round(200 * 31.416)).toBe(6283);
    expect(6283 / 1000).toBeCloseTo(6.28, 2);
  });
});

describe("невалиден вход", () => {
  it("хвърля грешка на български", () => {
    expect(() => gravityWork(0, 0, 1)).toThrow("маса");
    expect(() => springWork(-5, 0, 1)).toThrow("коравина");
    expect(() => frictionWork(-0.1, 10, 1)).toThrow("триене");
    expect(() => frictionWork(0.1, 10, -1)).toThrow("път");
    expect(() => averagePower(10, 0)).toThrow("време");
    expect(() => workAlongStraightPath(Number.NaN, 1)).toThrow("сила");
    expect(() => workAlongPolyline(() => ({ x: 0, y: 0 }), [])).toThrow(
      "две точки",
    );
    expect(() =>
      workAlongPolyline(
        () => ({ x: 0, y: 0 }),
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        3,
      ),
    ).toThrow("четно");
    expect(() =>
      springForceField(100, { x: 0, y: 0 }, 0.2)({ x: 0, y: 0 }),
    ).toThrow("закрепването");
    expect(() => isPotentialField(() => ({ x: 0, y: 0 }), [])).toThrow(
      "една точка",
    );
  });
});
