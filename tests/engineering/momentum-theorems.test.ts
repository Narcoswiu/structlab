import { describe, expect, it } from "vitest";
import {
  G_ACCELERATION,
  angularAcceleration,
  brakingRotation,
  commonVelocity,
  conserveAngularMomentum,
  constantForceImpulse,
  discInertia,
  forceImpulse,
  jetForce,
  massCentre,
  momentum,
  pointAngularMomentum,
  pointInertia,
  rotationUnderConstantMoment,
  springImpulseDisplacement,
  springImpulseResponse,
  systemMomentum,
  timeToStop,
  velocityAfterImpulse,
  walkOnPlatform,
} from "@/lib/engineering/momentum-theorems";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Единици: m, s, kg, N, rad. Оста x е надясно; ω, ε, моментите и кинетичният
// момент са положителни обратно на часовниковата стрелка. g = 9,81 m/s².

const g = G_ACCELERATION;

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

describe("количество на движение и импулс", () => {
  it("Q = m·v: автомобил 1200 kg с 20 m/s („Леко“, въпрос 1)", () => {
    // 1200 · 20 = 24 000 kg·m/s
    expect(momentum(1200, 20)).toBeCloseTo(24000, 9);
    // обратна посока – отрицателен знак
    expect(momentum(1200, -20)).toBeCloseTo(-24000, 9);
  });

  it("импулс на постоянна сила S = F·t", () => {
    // 300 N за 4 s срещу движението: −300 · 4 = −1200 N·s
    expect(constantForceImpulse(-300, 4)).toBeCloseTo(-1200, 9);
  });

  it("Л1: вагонетка 400 kg с 3 m/s, спирачна сила 300 N", () => {
    // Q₁ = 400 · 3 = 1200 kg·m/s; 0 − 1200 = −300·t ⇒ t = 4 s
    expect(momentum(400, 3)).toBeCloseTo(1200, 9);
    const t = timeToStop({ mass: 400, speed: 3, brakingForce: 300 });
    expect(t).toBeCloseTo(4, 9);
    expect(
      velocityAfterImpulse({
        mass: 400,
        v1: 3,
        impulse: constantForceImpulse(-300, t),
      }),
    ).toBeCloseTo(0, 9);
    // независимо: a = −300/400 = −0,75 m/s²; RK4 до 4 s ⇒ v = 0, път 6 m
    const [path, v] = rk4((_t, y) => [y[1]!, -300 / 400], [0, 3], 0, 4, 400);
    expect(v).toBeCloseTo(0, 9);
    expect(path).toBeCloseTo(6, 9);
  });

  it("топка 0,4 kg: удря с 10 m/s, отскача с 8 m/s („Леко“, въпрос 2)", () => {
    // ос по посоката на отскока: S = 0,4·8 − 0,4·(−10) = 7,2 N·s
    const impulse = momentum(0.4, 8) - momentum(0.4, -10);
    expect(impulse).toBeCloseTo(7.2, 9);
    expect(velocityAfterImpulse({ mass: 0.4, v1: -10, impulse })).toBeCloseTo(
      8,
      9,
    );
  });

  it("числен импулс: лицето под F = 40t за 3 s е триъгълник", () => {
    // ½ · 3 · 120 = 180 N·s
    expect(forceImpulse((t) => 40 * t, 0, 3)).toBeCloseTo(180, 9);
    // Симпсон е точен и за парабола: ∫₀² 3t² dt = 8
    expect(forceImpulse((t) => 3 * t * t, 0, 2, 2)).toBeCloseTo(8, 9);
  });

  it("П2: сандък 20 kg, v₁ = 2 m/s, μ = 0,25, сила F = 40t за 3 s", () => {
    // F_тр = 0,25 · 20 · 9,81 = 49,05 N
    const friction = 0.25 * 20 * g;
    expect(friction).toBeCloseTo(49.05, 9);
    // S_F = 180 N·s; S_тр = −49,05 · 3 = −147,15 N·s; сбор 32,85 N·s
    const sForce = forceImpulse((t) => 40 * t, 0, 3);
    const sFriction = constantForceImpulse(-friction, 3);
    expect(sFriction).toBeCloseTo(-147.15, 9);
    expect(sForce + sFriction).toBeCloseTo(32.85, 9);
    // v₂ = 2 + 32,85/20 = 3,6425 m/s
    const v2 = velocityAfterImpulse({
      mass: 20,
      v1: 2,
      impulse: sForce + sFriction,
    });
    expect(v2).toBeCloseTo(3.6425, 9);
    // независимо: импулсът на силите = изменението на Q (RK4 на същия случай)
    const [, vRk] = rk4(
      (t, y) => [y[1]!, (40 * t - friction) / 20],
      [0, 2],
      0,
      3,
      3000,
    );
    expect(vRk).toBeCloseTo(3.6425, 9);
    expect(20 * vRk! - 20 * 2).toBeCloseTo(sForce + sFriction, 8);
    // скоростта остава положителна: v = 2 + t² − 2,4525t; минимум при
    // t = 1,22625 s: 2 − 1,22625² = 0,4963 m/s > 0
    const tMin = friction / 40;
    expect(tMin).toBeCloseTo(1.22625, 9);
    expect(2 + tMin ** 2 - 2.4525 * tMin).toBeCloseTo(0.4963, 4);
  });

  it("импулсна сила: 2000 N за 0,005 s върху 4 kg („Подробно“, въпрос 2)", () => {
    // S = 2000 · 0,005 = 10 N·s; v = 10/4 = 2,5 m/s
    const impulse = constantForceImpulse(2000, 0.005);
    expect(impulse).toBeCloseTo(10, 9);
    expect(velocityAfterImpulse({ mass: 4, v1: 0, impulse })).toBeCloseTo(
      2.5,
      9,
    );
    // теглото: 4 · 9,81 = 39,24 N; импулсът му 39,24 · 0,005 = 0,1962 N·s ≈ 2 %
    const weightImpulse = constantForceImpulse(4 * g, 0.005);
    expect(weightImpulse).toBeCloseTo(0.1962, 9);
    expect(weightImpulse / impulse).toBeCloseTo(0.0196, 4);
  });
});

describe("масов център и запазване на количеството на движение", () => {
  it("вагонетки: 300 kg с 2 m/s се сцепва със спряла 500 kg („Леко“, въпрос 3)", () => {
    // 300 · 2 = 800 · v ⇒ v = 0,75 m/s
    const result = commonVelocity([
      { mass: 300, velocity: 2 },
      { mass: 500, velocity: 0 },
    ]);
    expect(result.velocity).toBeCloseTo(0.75, 9);
    // енергия: преди ½·300·4 = 600 J; след ½·800·0,5625 = 225 J
    expect(result.kineticBefore).toBeCloseTo(600, 9);
    expect(result.kineticAfter).toBeCloseTo(225, 9);
    expect(result.kineticLoss).toBeCloseTo(375, 9);
  });

  it("чук 500 kg с 4 m/s и пилот 1500 kg („В реалния живот“)", () => {
    // 500 · 4 = 2000 · v ⇒ v = 1 m/s
    const result = commonVelocity([
      { mass: 500, velocity: 4 },
      { mass: 1500, velocity: 0 },
    ]);
    expect(result.velocity).toBeCloseTo(1, 9);
    // количеството на движение се запазва: 2000 kg·m/s
    expect(momentum(2000, result.velocity)).toBeCloseTo(2000, 9);
    // кинетичната енергия НЕ се запазва: 4000 J → 1000 J
    expect(result.kineticBefore).toBeCloseTo(4000, 9);
    expect(result.kineticAfter).toBeCloseTo(1000, 9);
  });

  it("сцепване, симулирано с голяма вътрешна сила на триене между телата", () => {
    // вътрешна сила, пропорционална на разликата в скоростите – изравнява ги
    const [v1, v2] = rk4(
      (_t, y) => {
        const f = 5000 * (y[0]! - y[1]!);
        return [-f / 300, f / 500];
      },
      [2, 0],
      0,
      2,
      20000,
    );
    expect(v1).toBeCloseTo(0.75, 6);
    expect(v2).toBeCloseTo(0.75, 6);
  });

  it("Q = m·v_C за система", () => {
    // 75·0,8 + 150·(−0,4) = 0 ⇒ v_C = 0
    const system = systemMomentum([
      { mass: 75, velocity: 0.8 },
      { mass: 150, velocity: -0.4 },
    ]);
    expect(system.mass).toBeCloseTo(225, 9);
    expect(system.momentum).toBeCloseTo(0, 9);
    expect(system.centreVelocity).toBeCloseTo(0, 9);
  });

  it("Л2: човек 75 kg изминава 3 m по лодка 150 kg", () => {
    // 75·(3 − d) = 150·d ⇒ d = 1 m назад; човекът – 2 m напред
    const result = walkOnPlatform({
      personMass: 75,
      platformMass: 150,
      relativeDistance: 3,
    });
    expect(result.platformShift).toBeCloseTo(-1, 9);
    expect(result.personShift).toBeCloseTo(2, 9);
    // масовият център не се мести: човек от 0 на 2, лодка (център) от 1,5 на 0,5
    // преди: (75·0 + 150·1,5)/225 = 1; след: (75·2 + 150·0,5)/225 = 1
    expect(
      massCentre([
        { mass: 75, x: 0 },
        { mass: 150, x: 1.5 },
      ]),
    ).toBeCloseTo(1, 9);
    expect(
      massCentre([
        { mass: 75, x: 2 },
        { mass: 150, x: 0.5 },
      ]),
    ).toBeCloseTo(1, 9);
  });

  it("П1: релативна скорост 1,2 m/s, път 3 m по платформата", () => {
    // v₂ = −75·1,2/225 = −0,4 m/s; v₁ = 1,2 − 0,4 = 0,8 m/s
    const result = walkOnPlatform({
      personMass: 75,
      platformMass: 150,
      relativeDistance: 3,
      relativeSpeed: 1.2,
    });
    expect(result.platformVelocity).toBeCloseTo(-0.4, 9);
    expect(result.personVelocity).toBeCloseTo(0.8, 9);
    // време 3/1,2 = 2,5 s; −0,4·2,5 = −1 m; 0,8·2,5 = 2 m
    expect(result.platformVelocity * 2.5).toBeCloseTo(result.platformShift, 9);
    expect(result.personVelocity * 2.5).toBeCloseTo(result.personShift, 9);
    // 75·2 + 150·(−1) = 0
    expect(75 * result.personShift + 150 * result.platformShift).toBeCloseTo(
      0,
      9,
    );
  });

  it("човек по платформа: симулация само с вътрешна сила между двамата", () => {
    // човекът се засилва 2 s със сила 60 N от платформата и 2 s спира;
    // върху платформата действа същата сила с обратен знак
    const push = (t: number) => (t < 2 ? 60 : -60);
    const [x1, v1, x2, v2] = rk4(
      (t, y) => [y[1]!, push(t) / 75, y[3]!, -push(t) / 150],
      [0, 0, 0, 0],
      0,
      4,
      4000,
    );
    // накрая и двамата са в покой, масовият център не е мръднал
    expect(v1).toBeCloseTo(0, 3);
    expect(v2).toBeCloseTo(0, 3);
    expect(75 * x1! + 150 * x2!).toBeCloseTo(0, 9);
    // преместванията съвпадат с формулата за същия релативен път
    const expected = walkOnPlatform({
      personMass: 75,
      platformMass: 150,
      relativeDistance: x1! - x2!,
    });
    expect(x2).toBeCloseTo(expected.platformShift, 9);
    expect(x1).toBeCloseTo(expected.personShift, 9);
  });

  it("две тела, свързани с пружина: масовият център се движи равномерно", () => {
    // m₁ = 2 kg с 3 m/s, m₂ = 4 kg в покой, пружина 500 N/m между тях
    // (само вътрешна сила). v_C = 2·3/6 = 1 m/s; x_C(0) = (2·0 + 4·1)/6 = 2/3
    const m1 = 2;
    const m2 = 4;
    const state = rk4(
      (_t, y) => {
        const f = 500 * (y[2]! - y[0]! - 1); // опън на пружината, N
        return [y[1]!, f / m1, y[3]!, -f / m2];
      },
      [0, 3, 1, 0],
      0,
      1.7,
      17000,
    );
    const after = systemMomentum([
      { mass: m1, velocity: state[1]! },
      { mass: m2, velocity: state[3]! },
    ]);
    expect(after.centreVelocity).toBeCloseTo(1, 8);
    expect(after.momentum).toBeCloseTo(6, 8);
    const xC = massCentre([
      { mass: m1, x: state[0]! },
      { mass: m2, x: state[2]! },
    ]);
    expect(xC).toBeCloseTo(2 / 3 + 1 * 1.7, 8);
    // отделните скорости обаче се менят – не са останали 3 и 0
    expect(Math.abs(state[1]! - 3)).toBeGreaterThan(0.1);
  });

  it("струя: 20 kg/s със скорост 15 m/s („В реалния живот“)", () => {
    // F = 20 · 15 = 300 N = 0,3 kN
    expect(jetForce({ massFlow: 20, speed: 15 })).toBeCloseTo(300, 9);
    // същото от теоремата за импулсите за 1 s: 20 kg губят 15 m/s
    expect(Math.abs(momentum(20, 0) - momentum(20, 15)) / 1).toBeCloseTo(
      300,
      9,
    );
  });
});

describe("пружина – маса под единичен импулс", () => {
  const input = { mass: 2, stiffness: 800, impulse: 6 };

  it("П3: m = 2 kg, c = 800 N/m, S = 6 N·s", () => {
    // v₀ = 6/2 = 3 m/s; k = √(800/2) = 20 rad/s; амплитуда 3/20 = 0,15 m
    // T₀ = 2π/20 = 0,31416 s; най-голяма сила 800 · 0,15 = 120 N
    const result = springImpulseResponse(input);
    expect(result.initialVelocity).toBeCloseTo(3, 9);
    expect(result.circularFrequency).toBeCloseTo(20, 9);
    expect(result.amplitude).toBeCloseTo(0.15, 9);
    expect(result.period).toBeCloseTo(0.31416, 5);
    expect(result.maxSpringForce).toBeCloseTo(120, 9);
    // амплитудата е и S/√(c·m) = 6/√1600 = 0,15 m
    expect(6 / Math.sqrt(800 * 2)).toBeCloseTo(result.amplitude, 9);
  });

  it("П3: законът x = 0,15·sin 20t удовлетворява m·ẍ + c·x = 0", () => {
    // четвърт период: x(π/40) = 0,15 m
    expect(springImpulseDisplacement(input, Math.PI / 40)).toBeCloseTo(0.15, 9);
    // RK4 от x = 0, v = 3 m/s до t = 0,05 s: 0,15·sin 1 = 0,12622 m
    const [x] = rk4(
      (_t, y) => [y[1]!, (-800 * y[0]!) / 2],
      [0, 3],
      0,
      0.05,
      500,
    );
    expect(x).toBeCloseTo(0.12622, 5);
    expect(springImpulseDisplacement(input, 0.05)).toBeCloseTo(x!, 9);
  });

  it("П3: удар с крайна продължителност 0,002 s дава почти същото", () => {
    // средна сила 6/0,002 = 3000 N; пружината действа през цялото време
    const tau = 0.002;
    const force = 6 / tau;
    expect(force).toBeCloseTo(3000, 9);
    const afterBlow = rk4(
      (_t, y) => [y[1]!, (force - 800 * y[0]!) / 2],
      [0, 0],
      0,
      tau,
      2000,
    );
    // преместване ≈ ½·3·0,002 = 0,003 m; сила на пружината ≈ 2,4 N
    expect(afterBlow[0]).toBeCloseTo(0.003, 5);
    expect(800 * afterBlow[0]!).toBeCloseTo(2.4, 2);
    expect(afterBlow[1]).toBeCloseTo(3, 2);
    // най-голямото отклонение след удара: √(x² + (v/k)²) ≈ 0,15 m
    const amplitude = Math.hypot(afterBlow[0]!, afterBlow[1]! / 20);
    expect(amplitude).toBeCloseTo(0.15, 4);
  });

  it("„Подробно“, въпрос 3: m = 0,5 kg, c = 200 N/m, S = 2 N·s", () => {
    // v₀ = 2/0,5 = 4 m/s; k = √(200/0,5) = 20 rad/s; амплитуда 4/20 = 0,2 m
    const result = springImpulseResponse({
      mass: 0.5,
      stiffness: 200,
      impulse: 2,
    });
    expect(result.initialVelocity).toBeCloseTo(4, 9);
    expect(result.circularFrequency).toBeCloseTo(20, 9);
    expect(result.amplitude).toBeCloseTo(0.2, 9);
  });
});

describe("кинетичен момент", () => {
  it("точка 2 kg по правата y = 0,4 m с 3 m/s по +x („Подробно“, въпрос 4)", () => {
    // K_O = m·(x·v_y − y·v_x) = 2·(0 − 0,4·3) = −2,4 kg·m²/s (по часовниковата)
    expect(
      pointAngularMomentum({ mass: 2, x: 1.7, y: 0.4, vx: 3, vy: 0 }),
    ).toBeCloseTo(-2.4, 9);
    // не зависи от x – рамото е все 0,4 m
    expect(
      pointAngularMomentum({ mass: 2, x: -5, y: 0.4, vx: 3, vy: 0 }),
    ).toBeCloseTo(-2.4, 9);
    // обратно на часовниковата стрелка – положителен
    expect(
      pointAngularMomentum({ mass: 2, x: 0.4, y: 0, vx: 0, vy: 3 }),
    ).toBeCloseTo(2.4, 9);
  });

  it("П4: масови инерционни моменти на платформата с човека", () => {
    // диск: ½·200·2² = 400 kg·m²; човек на ръба: 80·2² = 320; на 0,5 m: 80·0,25 = 20
    expect(discInertia(200, 2)).toBeCloseTo(400, 9);
    expect(pointInertia(80, 2)).toBeCloseTo(320, 9);
    expect(pointInertia(80, 0.5)).toBeCloseTo(20, 9);
  });

  it("П4: запазване – J₁·ω₁ = J₂·ω₂ и изменение на кинетичната енергия", () => {
    // J₁ = 720, J₂ = 420 kg·m²; K = 720·0,5 = 360 kg·m²/s; ω₂ = 360/420 = 0,8571
    const result = conserveAngularMomentum({
      inertia1: discInertia(200, 2) + pointInertia(80, 2),
      omega1: 0.5,
      inertia2: discInertia(200, 2) + pointInertia(80, 0.5),
    });
    expect(result.angularMomentum).toBeCloseTo(360, 9);
    expect(result.omega2).toBeCloseTo(0.8571, 4);
    // T₁ = 360²/(2·720) = 90 J; T₂ = 360²/(2·420) = 154,29 J; ΔT = +64,29 J
    expect(result.kineticBefore).toBeCloseTo(90, 9);
    expect(result.kineticAfter).toBeCloseTo(154.29, 2);
    expect(result.kineticChange).toBeCloseTo(64.29, 2);
    // T₂/T₁ = J₁/J₂ = 720/420 = 1,714
    expect(result.kineticAfter / result.kineticBefore).toBeCloseTo(1.714, 3);
    // числата от фигурата в „Леко“: 720·0,5 = 420·ω₂ ⇒ ω₂ = 0,857 rad/s
    expect(result.omega2).toBeCloseTo(0.857, 3);
  });

  it("П4: симулация на преместването на човека – ω расте до 0,8571 rad/s", () => {
    // d/dt[(400 + 80r²)·ω] = 0 при r = 2 − 0,3t за 5 s (r: 2 → 0,5 m)
    const [omega] = rk4(
      (t, y) => {
        const r = 2 - 0.3 * t;
        return [(-2 * 80 * r * -0.3 * y[0]!) / (400 + 80 * r * r)];
      },
      [0.5],
      0,
      5,
      5000,
    );
    expect(omega).toBeCloseTo(360 / 420, 9);
  });

  it("П4: нарастването на енергията е работата на човека", () => {
    // за да върви към оста, човекът упражнява сила m₁·ω²·r към центъра;
    // работата ѝ е ∫ m₁·ω(r)²·r dr от 0,5 до 2 m, ω(r) = 360/(400 + 80r²)
    const n = 20000;
    let work = 0;
    for (let i = 0; i < n; i++) {
      const r = 0.5 + ((i + 0.5) * 1.5) / n;
      const omega = 360 / (400 + 80 * r * r);
      work += (80 * omega * omega * r * 1.5) / n;
    }
    const { kineticChange } = conserveAngularMomentum({
      inertia1: 720,
      omega1: 0.5,
      inertia2: 420,
    });
    expect(work).toBeCloseTo(kineticChange, 6);
    expect(work).toBeCloseTo(64.2857, 4);
  });

  it("П4: спиране с момент 60 N·m – J·ε = M, потвърдено с интегриране", () => {
    // ε = −60/420 = −0,1429 rad/s²
    expect(angularAcceleration(420, -60)).toBeCloseTo(-0.1429, 4);
    // 0 − 360 = −60·t ⇒ t = 6 s; φ = ½·0,8571·6 = 2,571 rad = 0,409 оборота
    const stop = brakingRotation({
      inertia: 420,
      omega0: 360 / 420,
      brakingMoment: 60,
    });
    expect(stop.time).toBeCloseTo(6, 9);
    expect(stop.angle).toBeCloseTo(2.571, 3);
    expect(stop.turns).toBeCloseTo(0.409, 3);
    expect((stop.angle * 180) / Math.PI).toBeCloseTo(147.3, 1);
    // RK4 на φ' = ω, ω' = M/J за 6 s
    const [phi, omega] = rk4(
      (_t, y) => [y[1]!, -60 / 420],
      [0, 360 / 420],
      0,
      6,
      600,
    );
    expect(omega).toBeCloseTo(0, 9);
    expect(phi).toBeCloseTo(stop.angle, 9);
    // същото през функцията за постоянен момент
    const state = rotationUnderConstantMoment({
      inertia: 420,
      omega0: 360 / 420,
      moment: -60,
      t: 6,
    });
    expect(state.omega).toBeCloseTo(0, 9);
    expect(state.phi).toBeCloseTo(phi!, 9);
    // изменение на кинетичния момент = импулс на момента: 420·(0 − 0,8571) = −60·6
    expect(420 * (state.omega - 360 / 420)).toBeCloseTo(-60 * 6, 9);
  });

  it("фигуристка: J от 4 на 1,6 kg·m², ω₁ = 2 rad/s („Леко“, въпрос 4)", () => {
    // 4·2 = 1,6·ω₂ ⇒ ω₂ = 5 rad/s
    const result = conserveAngularMomentum({
      inertia1: 4,
      omega1: 2,
      inertia2: 1.6,
    });
    expect(result.omega2).toBeCloseTo(5, 9);
    // енергията расте: 8 J → 20 J
    expect(result.kineticBefore).toBeCloseTo(8, 9);
    expect(result.kineticAfter).toBeCloseTo(20, 9);
  });

  it("маховик J = 12 kg·m², ω = 30 rad/s, спирачен момент 40 N·m („Подробно“, въпрос 5)", () => {
    // t = 12·30/40 = 9 s; φ = 30·9/2 = 135 rad = 21,5 оборота
    const stop = brakingRotation({
      inertia: 12,
      omega0: 30,
      brakingMoment: 40,
    });
    expect(stop.time).toBeCloseTo(9, 9);
    expect(stop.angle).toBeCloseTo(135, 9);
    expect(stop.turns).toBeCloseTo(21.5, 1);
    // посоката на въртене не променя времето
    expect(
      brakingRotation({ inertia: 12, omega0: -30, brakingMoment: 40 }).time,
    ).toBeCloseTo(9, 9);
  });
});

describe("невалиден вход", () => {
  it("хвърля грешка на български", () => {
    expect(() => momentum(0, 1)).toThrow("маса");
    expect(() => momentum(1, Number.NaN)).toThrow("скорост");
    expect(() => systemMomentum([])).toThrow("поне едно тяло");
    expect(() => massCentre([])).toThrow("поне едно тяло");
    expect(() => constantForceImpulse(10, -1)).toThrow("време");
    expect(() => forceImpulse((t) => t, 0, 1, 3)).toThrow("четно");
    expect(() => forceImpulse((t) => t, 1, 0)).toThrow("Крайното време");
    expect(() => timeToStop({ mass: 1, speed: 1, brakingForce: 0 })).toThrow(
      "спирачна сила",
    );
    expect(() =>
      walkOnPlatform({ personMass: -1, platformMass: 1, relativeDistance: 1 }),
    ).toThrow("маса на човека");
    expect(() =>
      springImpulseResponse({ mass: 1, stiffness: 0, impulse: 1 }),
    ).toThrow("коравина");
    expect(() => jetForce({ massFlow: -1, speed: 1 })).toThrow("масов разход");
    expect(() => discInertia(1, 0)).toThrow("радиус");
    expect(() => pointInertia(1, -1)).toThrow("разстояние");
    expect(() => angularAcceleration(0, 1)).toThrow("инерционен момент");
    expect(() =>
      brakingRotation({ inertia: 1, omega0: 1, brakingMoment: -1 }),
    ).toThrow("спирачен момент");
    expect(() =>
      conserveAngularMomentum({ inertia1: 1, omega1: 1, inertia2: 0 }),
    ).toThrow("J₂");
  });
});
