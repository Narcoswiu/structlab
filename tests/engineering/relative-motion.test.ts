import { describe, expect, it } from "vitest";
import {
  absoluteMotion,
  addVectors,
  coriolisAcceleration,
  coriolisAcceleration3,
  coriolisMagnitude,
  crossRiverHeadingAcross,
  crossRiverStraight,
  magnitude2,
  radialSlot,
  rotateVector,
  transportKinematics,
  type Vec2,
} from "@/lib/engineering/relative-motion";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Единици: m, s, rad. Знаци: x надясно, y нагоре; ω_e и ε_e са положителни
// обратно на часовниковата стрелка. Индекси: r – релативно, e – преносно,
// a – абсолютно, c – Кориолисово.

const vec = (x: number, y: number): Vec2 => ({ x, y });

function expectVec(actual: Vec2, expected: Vec2, digits = 10): void {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
}

/**
 * Независима проверка: числено диференциране (централни разлики) на
 * абсолютния закон r(t) в НЕПОДВИЖНИТЕ оси. Не използва нищо от теоремите
 * за събиране на скорости и ускорения.
 */
function differentiate(
  law: (t: number) => Vec2,
  t: number,
  h = 1e-4,
): { v: Vec2; a: Vec2 } {
  const before = law(t - h);
  const now = law(t);
  const after = law(t + h);
  return {
    v: vec((after.x - before.x) / (2 * h), (after.y - before.y) / (2 * h)),
    a: vec(
      (after.x - 2 * now.x + before.x) / (h * h),
      (after.y - 2 * now.y + before.y) / (h * h),
    ),
  };
}

describe("Кориолисово ускорение – формула, големина и посока", () => {
  it("a_cx = −2·ω·v_ry, a_cy = 2·ω·v_rx", () => {
    // ω = 0,5; v_r = (1,2; 0): a_c = (−2·0,5·0; 2·0,5·1,2) = (0; 1,2)
    expectVec(coriolisAcceleration(0.5, vec(1.2, 0)), vec(0, 1.2));
    // ω = −2; v_r = (0; 3): a_c = (−2·(−2)·3; 0) = (12; 0)
    expectVec(coriolisAcceleration(-2, vec(0, 3)), vec(12, 0));
  });

  it("посока: v_r, завъртян на 90° по посока на въртенето, по 2·|ω|", () => {
    // v_r = (3; 4), |v_r| = 5.
    // ω = +1,5 (обратно на часовниковата): v_r, завъртян на +90°, е (−4; 3);
    // по 2·1,5 = 3 → (−12; 9).
    const ccw = coriolisAcceleration(1.5, vec(3, 4));
    expectVec(ccw, vec(-12, 9));
    const rotatedCcw = rotateVector(vec(3, 4), Math.PI / 2);
    expectVec(ccw, vec(3 * rotatedCcw.x, 3 * rotatedCcw.y));
    // ω = −1,5 (по часовниковата): v_r, завъртян на −90°, е (4; −3) → (12; −9).
    const cw = coriolisAcceleration(-1.5, vec(3, 4));
    expectVec(cw, vec(12, -9));
    const rotatedCw = rotateVector(vec(3, 4), -Math.PI / 2);
    expectVec(cw, vec(3 * rotatedCw.x, 3 * rotatedCw.y));
    // и в двата случая a_c ⊥ v_r, а големината е 2·1,5·5 = 15
    expect(ccw.x * 3 + ccw.y * 4).toBeCloseTo(0, 10);
    expect(magnitude2(ccw)).toBeCloseTo(15, 10);
    expect(magnitude2(cw)).toBeCloseTo(15, 10);
  });

  it("правилото от текста: ω обратно на часовниковата, v_r навън → a_c по въртенето", () => {
    // Точка на оста x (радиусът сочи по +x), v_r = (1; 0) навън, ω = +2.
    // „Напречно, по посока на въртенето“ в тази точка е +y. a_c = (0; 4).
    expectVec(coriolisAcceleration(2, vec(1, 0)), vec(0, 4));
    // При въртене по часовниковата (ω = −2) точките там се движат по −y.
    expectVec(coriolisAcceleration(-2, vec(1, 0)), vec(0, -4));
  });

  it("големина 2·ω·v_r·sin на ъгъла между ω_e и v_r", () => {
    // ω_e = (0; 0; 2), |ω_e| = 2; v_r с големина 3 под 30° спрямо ω_e:
    // v_r = (3·sin30°; 0; 3·cos30°) = (1,5; 0; 2,598).
    // a_c = 2·ω × v_r = 2·(0; 2·1,5; 0) = (0; 6; 0); 2·2·3·sin30° = 6.
    const aC = coriolisAcceleration3(
      { x: 0, y: 0, z: 2 },
      { x: 1.5, y: 0, z: 3 * Math.cos(Math.PI / 6) },
    );
    expect(aC.x).toBeCloseTo(0, 10);
    expect(aC.y).toBeCloseTo(6, 10);
    expect(aC.z).toBeCloseTo(0, 10);
    expect(coriolisMagnitude(2, 3, 30)).toBeCloseTo(6, 10);
    // v_r ∥ ω_e: ъгъл 0° → нула
    const parallel = coriolisAcceleration3(
      { x: 0, y: 0, z: 2 },
      { x: 0, y: 0, z: 3 },
    );
    expect(Math.hypot(parallel.x, parallel.y, parallel.z)).toBe(0);
    expect(coriolisMagnitude(2, 3, 0)).toBe(0);
    // равнинна задача: ъгъл 90° → 2·2·3 = 12 (въпрос 3 от „Леко“)
    expect(coriolisMagnitude(2, 3)).toBeCloseTo(12, 10);
    // пространственият запис съвпада с равнинния при ω по z и v_r в равнината
    const plane = coriolisAcceleration(2, vec(3, 4));
    const space = coriolisAcceleration3(
      { x: 0, y: 0, z: 2 },
      { x: 3, y: 4, z: 0 },
    );
    expectVec(vec(space.x, space.y), plane);
    expect(space.z).toBe(0);
  });

  it("при преносна транслация и при v_r = 0 Кориолисово ускорение няма", () => {
    expectVec(coriolisAcceleration(0, vec(5, -7)), vec(0, 0));
    expectVec(coriolisAcceleration(3, vec(0, 0)), vec(0, 0));
    // транслация с произволни v_A, a_A: a_a = a_r + a_A, без трети член
    const motion = absoluteMotion({
      vR: vec(2, 1),
      aR: vec(-1, 3),
      vPole: vec(4, 0),
      aPole: vec(0.5, -2),
      omegaE: 0,
      epsilonE: 0,
      rho: vec(7, 9),
    });
    expectVec(motion.aC, vec(0, 0));
    expectVec(motion.vE, vec(4, 0));
    expectVec(motion.aE, vec(0.5, -2));
    expectVec(motion.vAbs, vec(6, 1));
    expectVec(motion.aAbs, vec(-0.5, 1));
  });
});

describe("Пример Л1 – лодка в река", () => {
  // Река 60 m, течение v_e = 1,5 m/s, лодка v_r = 2 m/s спрямо водата.
  it("курс перпендикулярно на брега", () => {
    // v_a = √(2² + 1,5²) = √6,25 = 2,5 m/s
    // ъгъл спрямо правата през реката: arctg(1,5/2) = 36,87°
    // време: 60/2 = 30 s; отнасяне: 1,5·30 = 45 m
    const result = crossRiverHeadingAcross(60, 2, 1.5);
    expect(result.vAbs).toBeCloseTo(2.5, 10);
    expect(result.driftAngleDeg).toBeCloseTo(36.87, 2);
    expect(result.time).toBeCloseTo(30, 10);
    expect(result.drift).toBeCloseTo(45, 10);
    // същото с векторния сбор v_a = v_r + v_e (y – през реката, x – по течението)
    expectVec(addVectors(vec(0, 2), vec(1.5, 0)), vec(1.5, 2));
  });

  it("курс срещу течението, за да пресече право", () => {
    // sin β = 1,5/2 = 0,75 → β = 48,59°
    // v_a = √(2² − 1,5²) = √1,75 = 1,323 m/s; време: 60/1,323 = 45,4 s
    const result = crossRiverStraight(60, 2, 1.5);
    expect(result.headingDeg).toBeCloseTo(48.59, 2);
    expect(result.vAbs).toBeCloseTo(1.323, 3);
    expect(result.time).toBeCloseTo(45.4, 1);
    expect(60 / 1.323).toBeCloseTo(45.4, 1); // със закръгленото междинно
    expect(result.drift).toBe(0);
    // векторно: v_r = 2·(−sin β; cos β), v_e = (1,5; 0) → сборът няма x
    const beta = (result.headingDeg * Math.PI) / 180;
    const sum = addVectors(
      vec(-2 * Math.sin(beta), 2 * Math.cos(beta)),
      vec(1.5, 0),
    );
    expectVec(sum, vec(0, 1.3229), 4);
  });

  it("право пресичане е невъзможно, ако течението е по-бързо", () => {
    expect(() => crossRiverStraight(60, 1.5, 2)).toThrow();
    expect(() => crossRiverStraight(60, 2, 2)).toThrow();
  });
});

describe("Пример Л2 – човек на въртележка", () => {
  // ω_e = 0,5 rad/s (обратно на часовниковата), v_r = 1,2 m/s по радиуса навън,
  // r = 3 m; радиусът в момента е по оста x.
  const motion = absoluteMotion({
    vR: vec(1.2, 0),
    aR: vec(0, 0),
    omegaE: 0.5,
    epsilonE: 0,
    rho: vec(3, 0),
  });

  it("скорости", () => {
    // v_e = ω·r = 0,5·3 = 1,5 m/s напречно (+y)
    // v_a = √(1,2² + 1,5²) = √3,69 = 1,921 m/s
    expectVec(motion.vE, vec(0, 1.5));
    expectVec(motion.vAbs, vec(1.2, 1.5));
    expect(magnitude2(motion.vAbs)).toBeCloseTo(1.921, 3);
  });

  it("ускорения", () => {
    // a_e = ω²·r = 0,25·3 = 0,75 m/s² към центъра (−x)
    // a_c = 2·0,5·1,2 = 1,2 m/s² напречно, по посока на въртенето (+y)
    // a_a = √(0,75² + 1,2²) = √2,0025 = 1,415 m/s²
    expectVec(motion.aE, vec(-0.75, 0));
    expectVec(motion.aC, vec(0, 1.2));
    expectVec(motion.aAbs, vec(-0.75, 1.2));
    expect(magnitude2(motion.aAbs)).toBeCloseTo(1.415, 3);
  });

  it("сверка с числено диференциране на абсолютния закон", () => {
    // x = (3 + 1,2t)·cos 0,5t, y = (3 + 1,2t)·sin 0,5t; момент t = 0
    const { v, a } = differentiate(
      (t) =>
        vec(
          (3 + 1.2 * t) * Math.cos(0.5 * t),
          (3 + 1.2 * t) * Math.sin(0.5 * t),
        ),
      0,
    );
    expectVec(v, motion.vAbs, 5);
    expectVec(a, motion.aAbs, 5);
  });

  it("същото с формулите за радиален канал", () => {
    expect(
      radialSlot({ r: 3, rDot: 1.2, rDdot: 0, omega: 0.5, epsilon: 0 }),
    ).toEqual({ vRho: 1.2, vPhi: 1.5, aRho: -0.75, aPhi: 1.2 });
  });
});

describe("Пример П1 – точка в радиален канал на ускорително въртящ се диск", () => {
  // φ_e = 0,5t² (rad), OM = 0,2 + 0,1t² (m), t₁ = 2 s.
  const t1 = 2;
  const phi = 0.5 * t1 * t1; // 2 rad
  const r = 0.2 + 0.1 * t1 * t1; // 0,6 m
  const rDot = 0.2 * t1; // 0,4 m/s
  const rDdot = 0.2; // m/s²
  const omega = t1; // 2 rad/s
  const epsilon = 1; // rad/s²

  it("положение", () => {
    // φ_e = 2 rad = 2·180/π = 114,59°; OM = 0,2 + 0,4 = 0,6 m
    // x = 0,6·cos 2 = 0,6·(−0,4161) = −0,250 m; y = 0,6·0,9093 = 0,546 m
    expect((phi * 180) / Math.PI).toBeCloseTo(114.59, 2);
    expect(r).toBeCloseTo(0.6, 10);
    expect(Math.cos(2)).toBeCloseTo(-0.4161, 4);
    expect(Math.sin(2)).toBeCloseTo(0.9093, 4);
    expect(r * Math.cos(phi)).toBeCloseTo(-0.25, 3);
    expect(r * Math.sin(phi)).toBeCloseTo(0.546, 3);
  });

  it("проекции по радиуса и напречно", () => {
    // v_ρ = v_r = 0,4; v_φ = v_e = ω·OM = 2·0,6 = 1,2; v_a = √1,6 = 1,265 m/s
    // a_ρ = a_r − ω²·OM = 0,2 − 4·0,6 = −2,2
    // a_φ = ε·OM + 2·ω·v_r = 1·0,6 + 2·2·0,4 = 0,6 + 1,6 = 2,2
    // a_a = 2,2·√2 = 3,111 m/s²
    const result = radialSlot({ r, rDot, rDdot, omega, epsilon });
    expect(result.vRho).toBeCloseTo(0.4, 10);
    expect(result.vPhi).toBeCloseTo(1.2, 10);
    expect(result.aRho).toBeCloseTo(-2.2, 10);
    expect(result.aPhi).toBeCloseTo(2.2, 10);
    expect(Math.hypot(result.vRho, result.vPhi)).toBeCloseTo(1.265, 3);
    expect(Math.hypot(result.aRho, result.aPhi)).toBeCloseTo(3.111, 3);
  });

  it("трите съставки поотделно (оси ρ, φ в точката M)", () => {
    // a_e^n = ω²·OM = 2,4 (към O), a_e^τ = ε·OM = 0,6, a_c = 2·2·0,4 = 1,6
    const motion = absoluteMotion({
      vR: vec(rDot, 0),
      aR: vec(rDdot, 0),
      omegaE: omega,
      epsilonE: epsilon,
      rho: vec(r, 0),
    });
    expectVec(motion.vE, vec(0, 1.2));
    expectVec(motion.aE, vec(-2.4, 0.6));
    expectVec(motion.aC, vec(0, 1.6));
    expectVec(motion.vAbs, vec(0.4, 1.2));
    expectVec(motion.aAbs, vec(-2.2, 2.2));
  });

  it("проекции по неподвижните оси", () => {
    // cos 2 = −0,4161; sin 2 = 0,9093
    // v_x = 0,4·(−0,4161) − 1,2·0,9093 = −0,1664 − 1,0912 = −1,258
    // v_y = 0,4·0,9093 + 1,2·(−0,4161) = 0,3637 − 0,4993 = −0,136
    // a_x = −2,2·(−0,4161) − 2,2·0,9093 = 0,9154 − 2,0005 = −1,085
    // a_y = −2,2·0,9093 + 2,2·(−0,4161) = −2,0005 − 0,9154 = −2,916
    const v = rotateVector(vec(0.4, 1.2), phi);
    const a = rotateVector(vec(-2.2, 2.2), phi);
    expectVec(v, vec(-1.258, -0.136), 3);
    expectVec(a, vec(-1.085, -2.916), 3);
    // със закръглените cos и sin, както ще смята читателят
    expect(0.4 * -0.4161 - 1.2 * 0.9093).toBeCloseTo(-1.258, 3);
    expect(0.4 * 0.9093 + 1.2 * -0.4161).toBeCloseTo(-0.136, 3);
    expect(-2.2 * -0.4161 - 2.2 * 0.9093).toBeCloseTo(-1.085, 3);
    expect(-2.2 * 0.9093 + 2.2 * -0.4161).toBeCloseTo(-2.916, 3);
  });

  it("сверка с числено диференциране на абсолютния закон", () => {
    const law = (t: number) => {
      const s = 0.2 + 0.1 * t * t;
      const angle = 0.5 * t * t;
      return vec(s * Math.cos(angle), s * Math.sin(angle));
    };
    const { v, a } = differentiate(law, t1);
    expectVec(v, rotateVector(vec(0.4, 1.2), phi), 5);
    expectVec(a, rotateVector(vec(-2.2, 2.2), phi), 5);
    // проектирани обратно по радиуса и напречно
    expectVec(rotateVector(v, -phi), vec(0.4, 1.2), 5);
    expectVec(rotateVector(a, -phi), vec(-2.2, 2.2), 5);
  });
});

describe("Пример П2 – канал по хорда, синусов релативен закон", () => {
  // ω_e = 2 rad/s (постоянна), канал на η = 0,3 m, ξ = 0,4·sin(πt/2), t₁ = 0,5 s.
  // Всички проекции са по подвижните оси ξ, η.
  const t1 = 0.5;
  const xi = 0.4 * Math.sin((Math.PI * t1) / 2);
  const vR = 0.4 * (Math.PI / 2) * Math.cos((Math.PI * t1) / 2);
  const aR = -0.4 * (Math.PI / 2) ** 2 * Math.sin((Math.PI * t1) / 2);
  const motion = absoluteMotion({
    vR: vec(vR, 0),
    aR: vec(aR, 0),
    omegaE: 2,
    epsilonE: 0,
    rho: vec(xi, 0.3),
  });

  it("положение и релативно движение", () => {
    // ξ = 0,4·sin 45° = 0,4·0,70711 = 0,28284 m
    // OM = √(0,28284² + 0,3²) = √0,17 = 0,4123 m
    // v_r = 0,4·1,5708·0,70711 = 0,4443 m/s
    // a_r = −0,4·2,4674·0,70711 = −0,6979 m/s²
    expect(Math.sin(Math.PI / 4)).toBeCloseTo(0.70711, 5);
    expect(xi).toBeCloseTo(0.28284, 5);
    expect(Math.hypot(xi, 0.3)).toBeCloseTo(0.4123, 4);
    expect(vR).toBeCloseTo(0.4443, 4);
    expect(aR).toBeCloseTo(-0.6979, 4);
    expect(Math.PI / 2).toBeCloseTo(1.5708, 4);
    expect((Math.PI / 2) ** 2).toBeCloseTo(2.4674, 4);
    expect(0.4 * 1.5708 * 0.70711).toBeCloseTo(0.4443, 4);
    expect(-0.4 * 2.4674 * 0.70711).toBeCloseTo(-0.6979, 4);
  });

  it("преносно и Кориолисово", () => {
    // v_e = (−ω·η; ω·ξ) = (−2·0,3; 2·0,28284) = (−0,6000; 0,5657)
    // a_e = −ω²·(ξ; η) = −4·(0,28284; 0,3) = (−1,1314; −1,2000)
    // a_c = (−2·ω·v_rη; 2·ω·v_rξ) = (0; 2·2·0,4443) = (0; 1,7772)
    expectVec(motion.vE, vec(-0.6, 0.5657), 4);
    expectVec(motion.aE, vec(-1.1314, -1.2), 4);
    expectVec(motion.aC, vec(0, 1.7772), 4);
    // големини: v_e = ω·OM = 2·0,4123 = 0,825 m/s; a_e = ω²·OM = 4·0,4123 = 1,649 m/s²
    expect(magnitude2(motion.vE)).toBeCloseTo(0.825, 3);
    expect(magnitude2(motion.aE)).toBeCloseTo(1.649, 3);
    expect(2 * 0.4123).toBeCloseTo(0.825, 3);
    expect(4 * 0.4123).toBeCloseTo(1.649, 3);
    // v_e ⊥ OM
    expect(motion.vE.x * xi + motion.vE.y * 0.3).toBeCloseTo(0, 10);
    expect(4 * 0.28284).toBeCloseTo(1.1314, 4);
    expect(2 * 0.28284).toBeCloseTo(0.5657, 4);
    expect(2 * 2 * 0.4443).toBeCloseTo(1.7772, 4);
  });

  it("абсолютна скорост и абсолютно ускорение", () => {
    // v_a = (0,4443 − 0,6000; 0,5657) = (−0,1557; 0,5657); |v_a| = 0,5867
    // a_a = (−0,6979 − 1,1314; −1,2000 + 1,7772) = (−1,8293; 0,5772); |a_a| = 1,918
    expectVec(motion.vAbs, vec(-0.1557, 0.5657), 4);
    expectVec(motion.aAbs, vec(-1.8293, 0.5772), 4);
    expect(magnitude2(motion.vAbs)).toBeCloseTo(0.5867, 4);
    expect(magnitude2(motion.aAbs)).toBeCloseTo(1.918, 3);
    expect(Math.hypot(-0.1557, 0.5657)).toBeCloseTo(0.5867, 4);
    expect(Math.hypot(-1.8293, 0.5772)).toBeCloseTo(1.918, 3);
  });

  it("a_c е перпендикулярно на канала, а не на радиуса OM", () => {
    // a_c·v_r = 0, но a_c·OM = 1,7772·0,3 ≠ 0
    expect(motion.aC.x * vR + motion.aC.y * 0).toBeCloseTo(0, 10);
    expect(motion.aC.x * xi + motion.aC.y * 0.3).toBeGreaterThan(0.5);
  });

  it("сверка с числено диференциране на абсолютния закон", () => {
    // x = ξ·cos 2t − 0,3·sin 2t, y = ξ·sin 2t + 0,3·cos 2t;
    // резултатът се проектира върху подвижните оси (завъртане на −φ_e = −2t₁)
    const law = (t: number) =>
      rotateVector(vec(0.4 * Math.sin((Math.PI * t) / 2), 0.3), 2 * t);
    const { v, a } = differentiate(law, t1);
    expectVec(rotateVector(v, -2 * t1), motion.vAbs, 5);
    expectVec(rotateVector(a, -2 * t1), motion.aAbs, 5);
  });
});

describe("Пример П3 – преносна транслация", () => {
  // Платформа с a_e = 1,5 m/s² надясно; наклон 30°, слизащ надясно; a_r = 2 m/s².
  it("ускоренията се събират без Кориолисов член", () => {
    // a_r = (2·cos30°; −2·sin30°) = (1,7321; −1,0000)
    // a_ax = 1,5 + 1,7321 = 3,232; a_ay = −1,000
    // a_a = √(3,232² + 1) = √11,446 = 3,383 m/s²; arctg(1/3,232) = 17,19°
    const angle = Math.PI / 6;
    const motion = absoluteMotion({
      vR: vec(0.7 * Math.cos(angle), -0.7 * Math.sin(angle)), // произволна v_r
      aR: vec(2 * Math.cos(angle), -2 * Math.sin(angle)),
      aPole: vec(1.5, 0),
      omegaE: 0,
      epsilonE: 0,
      rho: vec(0, 0),
    });
    expectVec(motion.aC, vec(0, 0));
    expectVec(motion.aAbs, vec(3.232, -1), 3);
    expect(magnitude2(motion.aAbs)).toBeCloseTo(3.383, 3);
    expect(
      (Math.atan2(-motion.aAbs.y, motion.aAbs.x) * 180) / Math.PI,
    ).toBeCloseTo(17.19, 2);
    expect(Math.hypot(3.232, 1)).toBeCloseTo(3.383, 3);
    expect((Math.atan(1 / 3.232) * 180) / Math.PI).toBeCloseTo(17.19, 2);
    // независимо – косинусова теорема с 30° между двата вектора:
    // a² = 1,5² + 2² + 2·1,5·2·cos30° = 2,25 + 4 + 5,196 = 11,446
    expect(
      Math.sqrt(1.5 ** 2 + 2 ** 2 + 2 * 1.5 * 2 * Math.cos(angle)),
    ).toBeCloseTo(3.383, 3);
  });
});

describe("В реалния живот – количка на кулокран", () => {
  // ω_e = 0,06 rad/s, v_r = 0,8 m/s навън по стрелата, r = 25 m.
  it("скорости и ускорения", () => {
    // v_e = 0,06·25 = 1,5 m/s; v_a = √(0,8² + 1,5²) = √2,89 = 1,70 m/s
    // a_e = 0,06²·25 = 0,0036·25 = 0,090 m/s² към оста
    // a_c = 2·0,06·0,8 = 0,096 m/s² напречно, по посока на въртенето
    const result = radialSlot({
      r: 25,
      rDot: 0.8,
      rDdot: 0,
      omega: 0.06,
      epsilon: 0,
    });
    expect(result.vPhi).toBeCloseTo(1.5, 10);
    expect(Math.hypot(result.vRho, result.vPhi)).toBeCloseTo(1.7, 10);
    expect(result.aRho).toBeCloseTo(-0.09, 10);
    expect(result.aPhi).toBeCloseTo(0.096, 10);
    expect(coriolisMagnitude(0.06, 0.8)).toBeCloseTo(0.096, 10);
    // a_a = √(0,09² + 0,096²) = √0,017316 = 0,132 m/s²
    expect(Math.hypot(result.aRho, result.aPhi)).toBeCloseTo(0.132, 3);
  });
});

describe("Въпроси от „Провери се“ – Леко", () => {
  it("1: ескалатор 0,5 m/s, човек 1 m/s спрямо него", () => {
    // по посоката: 1 + 0,5 = 1,5 m/s; срещу нея: 1 − 0,5 = 0,5 m/s (накъдето върви)
    expect(addVectors(vec(1, 0), vec(0.5, 0)).x).toBeCloseTo(1.5, 10);
    expect(addVectors(vec(-1, 0), vec(0.5, 0)).x).toBeCloseTo(-0.5, 10);
  });

  it("2: дъжд 8 m/s отвесно, кола 6 m/s", () => {
    // v_r = v_a − v_e = (0; −8) − (6; 0) = (−6; −8); |v_r| = 10 m/s
    // ъгъл към вертикалата: arctg(6/8) = 36,87°
    const vR = addVectors(vec(0, -8), vec(-6, 0));
    expectVec(vR, vec(-6, -8));
    expect(magnitude2(vR)).toBeCloseTo(10, 10);
    expect((Math.atan2(6, 8) * 180) / Math.PI).toBeCloseTo(36.87, 2);
  });

  it("3: ω = 2 rad/s, v_r = 3 m/s в равнината на диска", () => {
    // a_c = 2·2·3 = 12 m/s²
    expect(magnitude2(coriolisAcceleration(2, vec(3, 0)))).toBeCloseTo(12, 10);
    expect(magnitude2(coriolisAcceleration(2, vec(0, -3)))).toBeCloseTo(12, 10);
  });

  it("4: нула при транслация или при покой спрямо тялото", () => {
    expect(coriolisMagnitude(0, 3)).toBe(0);
    expect(coriolisMagnitude(2, 0)).toBe(0);
  });
});

describe("Въпроси от „Провери се“ – Подробно", () => {
  it("1: ω = 3 rad/s, v_r = 0,5 m/s по радиуса, r = 0,4 m", () => {
    // a_ρ = −ω²·r = −9·0,4 = −3,6; a_φ = 2·ω·v_r = 2·3·0,5 = 3,0
    // a_a = √(3,6² + 3,0²) = √21,96 = 4,69 m/s²
    const result = radialSlot({
      r: 0.4,
      rDot: 0.5,
      rDdot: 0,
      omega: 3,
      epsilon: 0,
    });
    expect(result.aRho).toBeCloseTo(-3.6, 10);
    expect(result.aPhi).toBeCloseTo(3, 10);
    expect(Math.hypot(result.aRho, result.aPhi)).toBeCloseTo(4.69, 2);
  });

  it("2: река 1 m/s, лодка 2,6 m/s, право през 120 m", () => {
    // v_a = √(2,6² − 1²) = √5,76 = 2,4 m/s; време 120/2,4 = 50 s
    // курс: arcsin(1/2,6) = 22,62° срещу течението
    const result = crossRiverStraight(120, 2.6, 1);
    expect(result.vAbs).toBeCloseTo(2.4, 10);
    expect(result.time).toBeCloseTo(50, 10);
    expect(result.headingDeg).toBeCloseTo(22.62, 2);
  });

  it("3: ω обратно на часовниковата, v_r по радиуса навън", () => {
    // радиусът е под произволен ъгъл θ; „напречно, по въртенето“ е (−sin θ; cos θ)
    const theta = 2.3;
    const aC = coriolisAcceleration(
      1.7,
      vec(0.9 * Math.cos(theta), 0.9 * Math.sin(theta)),
    );
    const k = 2 * 1.7 * 0.9;
    expectVec(aC, vec(-k * Math.sin(theta), k * Math.cos(theta)));
  });

  it("4: ω = 0,4t, точка в покой спрямо тялото на r = 1,5 m, t = 5 s", () => {
    // ω = 0,4·5 = 2 rad/s; ε = 0,4 rad/s²; v_r = 0 → a_c = 0
    // a_e^τ = ε·r = 0,4·1,5 = 0,6; a_e^n = ω²·r = 4·1,5 = 6
    // a = √(0,6² + 6²) = √36,36 = 6,03 m/s²
    const motion = absoluteMotion({
      vR: vec(0, 0),
      aR: vec(0, 0),
      omegaE: 0.4 * 5,
      epsilonE: 0.4,
      rho: vec(1.5, 0),
    });
    expectVec(motion.aC, vec(0, 0));
    expectVec(motion.aAbs, vec(-6, 0.6));
    expect(magnitude2(motion.aAbs)).toBeCloseTo(6.03, 2);
  });

  it("5: точка по ръба на диск – трите съставки дават v²/R на абсолютното движение", () => {
    // R = 0,5 m; v_r = 1 m/s по въртенето; ω = 2 rad/s. Точката е в (0,5; 0).
    // a_r = v_r²/R = 1/0,5 = 2; a_e = ω²·R = 4·0,5 = 2; a_c = 2·2·1 = 4 – всички към центъра
    // сбор 8 m/s². Пряко: v_a = 1 + 2·0,5 = 2 m/s; a = 2²/0,5 = 8 m/s².
    const motion = absoluteMotion({
      vR: vec(0, 1),
      aR: vec(-2, 0),
      omegaE: 2,
      epsilonE: 0,
      rho: vec(0.5, 0),
    });
    expectVec(motion.aE, vec(-2, 0));
    expectVec(motion.aC, vec(-4, 0));
    expectVec(motion.aAbs, vec(-8, 0));
    expectVec(motion.vAbs, vec(0, 2));
    expect(magnitude2(motion.vAbs) ** 2 / 0.5).toBeCloseTo(8, 10);
    // числено: абсолютният ъгъл расте с ω + v_r/R = 2 + 2 = 4 rad/s
    const { v, a } = differentiate(
      (t) => vec(0.5 * Math.cos(4 * t), 0.5 * Math.sin(4 * t)),
      0,
    );
    expectVec(v, motion.vAbs, 5);
    expectVec(a, motion.aAbs, 5);
  });
});

describe("Общ случай – преносно равнинно движение (полюсът също се движи)", () => {
  // Тялото: полюс A с x_A = 0,3t², y_A = 0,2t; ъгъл φ_e = 0,5t + 0,1t².
  // Точката спрямо тялото: ξ = 0,2 + 0,1t², η = 0,05t³. Момент t = 1,5 s.
  // Очакваното идва САМО от численото диференциране на абсолютния закон
  //   r = r_A + R(φ_e)·(ξ; η)
  // в неподвижните оси – независимо от формулите в модула.
  const t1 = 1.5;
  const phiOf = (t: number) => 0.5 * t + 0.1 * t * t;
  const relOf = (t: number) => vec(0.2 + 0.1 * t * t, 0.05 * t ** 3);
  const poleOf = (t: number) => vec(0.3 * t * t, 0.2 * t);
  const law = (t: number) =>
    addVectors(poleOf(t), rotateVector(relOf(t), phiOf(t)));

  const phi = phiOf(t1);
  const input = {
    // релативни величини – производни на ξ, η, завъртени в неподвижните оси
    vR: rotateVector(vec(0.2 * t1, 0.15 * t1 * t1), phi),
    aR: rotateVector(vec(0.2, 0.3 * t1), phi),
    vPole: vec(0.6 * t1, 0.2),
    aPole: vec(0.6, 0),
    omegaE: 0.5 + 0.2 * t1,
    epsilonE: 0.2,
    rho: rotateVector(relOf(t1), phi),
  };
  const motion = absoluteMotion(input);
  const numeric = differentiate(law, t1);

  it("v_a = v_r + v_e", () => {
    expectVec(motion.vAbs, numeric.v, 5);
    expectVec(motion.vAbs, addVectors(input.vR, motion.vE));
  });

  it("a_a = a_r + a_e + a_c", () => {
    expectVec(motion.aAbs, numeric.a, 5);
    expectVec(motion.aAbs, addVectors(input.aR, motion.aE, motion.aC));
  });

  it("без Кориолисовия член сборът НЕ дава абсолютното ускорение", () => {
    const without = addVectors(input.aR, motion.aE);
    const miss = magnitude2(
      vec(without.x - numeric.a.x, without.y - numeric.a.y),
    );
    // липсва точно |a_c| = 2·ω_e·v_r
    expect(miss).toBeCloseTo(2 * input.omegaE * magnitude2(input.vR), 5);
    expect(miss).toBeGreaterThan(0.5);
  });

  it("преносните величини са тези на „замразената“ точка от тялото", () => {
    // точка, закована за тялото в положението ρ(t₁): ξ, η = const
    const frozen = relOf(t1);
    const frozenLaw = (t: number) =>
      addVectors(poleOf(t), rotateVector(frozen, phiOf(t)));
    const { v, a } = differentiate(frozenLaw, t1);
    const transport = transportKinematics(input);
    expectVec(transport.vE, v, 5);
    expectVec(transport.aE, a, 5);
  });
});

describe("Проверка на входа", () => {
  it("отхвърля невалидни данни", () => {
    expect(() => coriolisAcceleration(Number.NaN, vec(1, 0))).toThrow();
    expect(() => coriolisAcceleration(1, vec(Infinity, 0))).toThrow();
    expect(() => coriolisMagnitude(1, 1, 200)).toThrow();
    expect(() =>
      radialSlot({ r: -1, rDot: 0, rDdot: 0, omega: 1, epsilon: 0 }),
    ).toThrow();
    expect(() => crossRiverHeadingAcross(0, 2, 1)).toThrow();
    expect(() => crossRiverHeadingAcross(60, 2, -1)).toThrow();
    expect(() =>
      transportKinematics({
        omegaE: 1,
        epsilonE: Number.NaN,
        rho: vec(1, 0),
      }),
    ).toThrow();
  });
});
