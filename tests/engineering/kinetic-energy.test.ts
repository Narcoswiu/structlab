import { describe, expect, it } from "vitest";
import {
  G_ACCELERATION,
  gravityPotential,
  kineticEnergyPlane,
  kineticEnergyPoint,
  kineticEnergyRotation,
  loadAndDrum,
  loadPulleyRoller,
  rodAboutEndInertia,
  rodSwingOmega,
  rollingAcceleration,
  rollingDownIncline,
  rpmToRadPerSec,
  slideOnIncline,
  solidDiscInertia,
  speedFromWork,
  springLaunchSpeed,
  springPotential,
  stoppingDistance,
  thinRingInertia,
} from "@/lib/engineering/kinetic-energy";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Единици: m, s, kg, N, J, rad/s. g = 9,81 m/s².

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
 * Независима проверка: решава линейната система A·x = b по Гаус с избор на
 * главен елемент. С нея уравненията на движението на всяко тяло се решават
 * поотделно, без да се ползва теоремата за кинетичната енергия.
 */
function solve(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  const a = matrix.map((row) => [...row]);
  const b = [...rhs];
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k]![i]!) > Math.abs(a[pivot]![i]!)) pivot = k;
    }
    [a[i], a[pivot]] = [a[pivot]!, a[i]!];
    [b[i], b[pivot]] = [b[pivot]!, b[i]!];
    for (let k = i + 1; k < n; k++) {
      const factor = a[k]![i]! / a[i]![i]!;
      for (let j = i; j < n; j++) a[k]![j]! -= factor * a[i]![j]!;
      b[k]! -= factor * b[i]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i]!;
    for (let j = i + 1; j < n; j++) sum -= a[i]![j]! * x[j]!;
    x[i] = sum / a[i]![i]!;
  }
  return x;
}

describe("кинетична енергия на точка и на тяло", () => {
  it("точка и транслация: T = m·v²/2", () => {
    // „Провери се“ (Леко) 1: 1000 · 20²/2 = 200 000 J = 200 kJ
    expect(kineticEnergyPoint(1000, 20)).toBeCloseTo(200000, 8);
    // „Провери се“ (Леко) 2: двойна скорост – четири пъти повече енергия
    expect(kineticEnergyPoint(1000, 40) / kineticEnergyPoint(1000, 20)).toBe(4);
    // енергията не зависи от посоката на скоростта
    expect(kineticEnergyPoint(3, -4)).toBeCloseTo(24, 12);
  });

  it("таблични масови инерционни моменти", () => {
    // плътен диск: 4 · 0,2²/2 = 0,08; 12 · 0,15²/2 = 0,135; 5 · 0,1²/2 = 0,025
    expect(solidDiscInertia(4, 0.2)).toBeCloseTo(0.08, 12);
    expect(solidDiscInertia(12, 0.15)).toBeCloseTo(0.135, 12);
    expect(solidDiscInertia(5, 0.1)).toBeCloseTo(0.025, 12);
    // лебедката: 80 · 0,25²/2 = 2,5 kg·m²
    expect(solidDiscInertia(80, 0.25)).toBeCloseTo(2.5, 12);
    // пръстен: 2 · 0,05² = 0,005; прът около края: 3 · 1,2²/3 = 1,44
    expect(thinRingInertia(2, 0.05)).toBeCloseTo(0.005, 12);
    expect(rodAboutEndInertia(3, 1.2)).toBeCloseTo(1.44, 12);
  });

  it("„Провери се“ (Подробно) 1 – маховик 50 kg, r = 0,4 m, 300 min⁻¹", () => {
    // J = 50 · 0,16/2 = 4 kg·m²; ω = π·300/30 = 31,416 rad/s
    // T = 4 · 31,416²/2 = 2 · 986,96 = 1973,9 ≈ 1974 J
    const J = solidDiscInertia(50, 0.4);
    const omega = rpmToRadPerSec(300);
    expect(J).toBeCloseTo(4, 12);
    expect(omega).toBeCloseTo(31.416, 3);
    expect(kineticEnergyRotation(J, omega)).toBeCloseTo(1973.9, 1);
    expect(Math.round(kineticEnergyRotation(J, omega))).toBe(1974);
  });

  it("„Провери се“ (Леко) 4 – плътен цилиндър 4 kg се търкаля с 3 m/s", () => {
    // T = 3/4 · 4 · 9 = 27 J: 18 J движение напред + 9 J въртене
    const r = 0.1; // радиусът не влияе на резултата
    const T = kineticEnergyPlane({
      mass: 4,
      centreSpeed: 3,
      centralInertia: solidDiscInertia(4, r),
      omega: 3 / r,
    });
    expect(T.translational).toBeCloseTo(18, 10);
    expect(T.rotational).toBeCloseTo(9, 10);
    expect(T.total).toBeCloseTo(27, 10);
    // друг радиус – същата енергия
    const other = kineticEnergyPlane({
      mass: 4,
      centreSpeed: 3,
      centralInertia: solidDiscInertia(4, 0.37),
      omega: -3 / 0.37,
    });
    expect(other.total).toBeCloseTo(27, 10);
  });

  it("теорема на Кьониг върху числа: търкалящ се диск", () => {
    // m = 5 kg, r = 0,1 m, v_C = 2 m/s, ω = 20 rad/s
    // транслация 5·4/2 = 10 J; въртене 0,025·400/2 = 5 J; общо 15 J = 3/4·m·v²
    const m = 5;
    const r = 0.1;
    const v = 2;
    const omega = v / r;
    const J = solidDiscInertia(m, r);
    const T = kineticEnergyPlane({
      mass: m,
      centreSpeed: v,
      centralInertia: J,
      omega,
    });
    expect(T.translational).toBeCloseTo(10, 10);
    expect(T.rotational).toBeCloseTo(5, 10);
    expect(T.total).toBeCloseTo(0.75 * m * v * v, 10);
    // същото като чиста ротация около МЦС: J_P = J_C + m·r² = 0,075; 0,075·400/2 = 15 J
    expect(kineticEnergyRotation(J + m * r * r, omega)).toBeCloseTo(15, 10);
    // независимо: сбор по 20 000 частици на диска (пръстени × ъгли), скорост
    // на всяка = v_C + ω × ρ за търкаляне надясно (ω по часовниковата стрелка)
    let sum = 0;
    let massSum = 0;
    const rings = 100;
    const sectors = 200;
    for (let i = 0; i < rings; i++) {
      const rho = ((i + 0.5) / rings) * r;
      const dm = (m * (((i + 1) / rings) ** 2 - (i / rings) ** 2)) / sectors;
      for (let k = 0; k < sectors; k++) {
        const angle = (2 * Math.PI * (k + 0.5)) / sectors;
        const vx = v + omega * rho * Math.sin(angle);
        const vy = -omega * rho * Math.cos(angle);
        sum += (dm * (vx * vx + vy * vy)) / 2;
        massSum += dm;
      }
    }
    expect(massSum).toBeCloseTo(m, 10);
    expect(sum).toBeCloseTo(15, 3);
    // пръстен: T = m·v²
    const ring = kineticEnergyPlane({
      mass: m,
      centreSpeed: v,
      centralInertia: thinRingInertia(m, r),
      omega,
    });
    expect(ring.total).toBeCloseTo(m * v * v, 10);
  });
});

describe("Пример Л1 – сандък по рампа, m = 15 kg, α = 30°, l = 5 m, μ = 0,25", () => {
  const result = slideOnIncline({
    mass: 15,
    angleDeg: 30,
    length: 5,
    mu: 0.25,
  });

  it("работи и скорост", () => {
    // G = 15 · 9,81 = 147,15 N; h = 5 · 0,5 = 2,5 m; A_G = 147,15 · 2,5 = 367,875 ≈ 367,9 J
    // N = 147,15 · 0,86603 = 127,44 N; F_тр = 0,25 · 127,44 = 31,86 N
    // A_тр = −31,86 · 5 = −159,3 J; ΣA = 367,9 − 159,3 = 208,6 J
    // v = √(2 · 208,6/15) = √27,81 = 5,274 m/s
    expect(result.height).toBeCloseTo(2.5, 10);
    expect(result.workGravity).toBeCloseTo(367.9, 1);
    expect(result.normal).toBeCloseTo(127.44, 2);
    expect(result.friction).toBeCloseTo(31.86, 2);
    expect(result.workFriction).toBeCloseTo(-159.3, 1);
    expect(result.workTotal).toBeCloseTo(208.6, 1);
    expect(result.speed).toBeCloseTo(5.274, 3);
    // с напечатаните закръглени числа се получава същият резултат
    expect(Math.sqrt((2 * 208.6) / 15)).toBeCloseTo(5.274, 3);
    // без триене: √(2 · 9,81 · 2,5) = 7,004 m/s
    expect(
      slideOnIncline({ mass: 15, angleDeg: 30, length: 5, mu: 0 }).speed,
    ).toBeCloseTo(7.004, 3);
  });

  it("независимо: основният закон и RK4 на уравнението на движението", () => {
    // a = 9,81 · (0,5 − 0,25 · 0,86603) = 2,7811 m/s²; v = √(2 · 2,7811 · 5) = 5,2736 m/s
    const a = g * (Math.sin(30 * RAD) - 0.25 * Math.cos(30 * RAD));
    expect(a).toBeCloseTo(2.7811, 4);
    expect(Math.sqrt(2 * a * 5)).toBeCloseTo(result.speed, 10);
    // силите се смятат от нулата във всяка стъпка: m·s'' = G·sin α − μ·G·cos α
    const m = 15;
    const time = Math.sqrt((2 * 5) / a); // 1,8962 s
    const end = rk4(
      (_t, y) => [
        y[1]!,
        (m * g * Math.sin(30 * RAD) - 0.25 * m * g * Math.cos(30 * RAD)) / m,
      ],
      [0, 0],
      0,
      time,
      1000,
    );
    expect(time).toBeCloseTo(1.8962, 4);
    expect(end[0]).toBeCloseTo(5, 9);
    expect(end[1]).toBeCloseTo(result.speed, 9);
  });
});

describe("Пример Л2 – плътен цилиндър и ролка от височина 0,5 m", () => {
  // наклонът не влияе на скоростта; за сметката е взет α = 30°, път 1 m
  const m = 2;
  const r = 0.05;
  const disc = rollingDownIncline({
    mass: m,
    radius: r,
    centralInertia: solidDiscInertia(m, r),
    angleDeg: 30,
    distance: 1,
  });
  const ring = rollingDownIncline({
    mass: m,
    radius: r,
    centralInertia: thinRingInertia(m, r),
    angleDeg: 30,
    distance: 1,
  });

  it("плътен цилиндър", () => {
    // A = 2 · 9,81 · 0,5 = 9,81 J; 3/4 · 2 · v² = 9,81 → v² = 6,54; v = 2,557 m/s
    // движение напред 2 · 6,54/2 = 6,54 J; въртене 3,27 J; ω = 2,557/0,05 = 51,15 rad/s
    expect(disc.height).toBeCloseTo(0.5, 10);
    expect(disc.work).toBeCloseTo(9.81, 10);
    expect(disc.speed ** 2).toBeCloseTo(6.54, 10);
    expect(disc.speed).toBeCloseTo(2.557, 3);
    expect(disc.energy.translational).toBeCloseTo(6.54, 10);
    expect(disc.energy.rotational).toBeCloseTo(3.27, 10);
    expect(disc.energy.total).toBeCloseTo(disc.work, 10);
    expect(disc.omega).toBeCloseTo(51.15, 2);
  });

  it("ролка (пръстен) и плъзгане без триене", () => {
    // пръстен: 2 · v² = 9,81 → v² = 4,905; v = 2,215 m/s; половината енергия е във въртенето
    expect(ring.speed ** 2).toBeCloseTo(4.905, 10);
    expect(ring.speed).toBeCloseTo(2.215, 3);
    expect(ring.energy.translational).toBeCloseTo(ring.energy.rotational, 10);
    // плъзгане без триене: v = √(2 · 9,81 · 0,5) = √9,81 = 3,132 m/s
    expect(
      slideOnIncline({ mass: m, angleDeg: 30, length: 1, mu: 0 }).speed,
    ).toBeCloseTo(3.132, 3);
    // цилиндърът изпреварва ролката
    expect(disc.speed).toBeGreaterThan(ring.speed);
  });

  it("скоростта не зависи от масата, радиуса и наклона – само от височината", () => {
    const other = rollingDownIncline({
      mass: 7,
      radius: 0.3,
      centralInertia: solidDiscInertia(7, 0.3),
      angleDeg: 10,
      distance: 0.5 / Math.sin(10 * RAD),
    });
    expect(other.speed).toBeCloseTo(disc.speed, 10);
  });

  it("фигура „dve-tela“: в един и същи миг ролката е изминала 3/4 от пътя на цилиндъра", () => {
    // ускорения 2/3·g·sin α и 1/2·g·sin α; s = a·t²/2 → отношение (1/2)/(2/3) = 3/4
    expect(ring.acceleration / disc.acceleration).toBeCloseTo(0.75, 12);
  });
});

describe("Пример П1 – наклон 35°, 3 m, после под; m = 8 kg, μ = 0,3", () => {
  const incline = slideOnIncline({ mass: 8, angleDeg: 35, length: 3, mu: 0.3 });
  const d = stoppingDistance(incline.speed, 0.3);

  it("скорост в B и път до спиране", () => {
    // G = 78,48 N; h = 3 · 0,57358 = 1,7207 m; A_G = 78,48 · 1,7207 = 135,04 J
    // N = 78,48 · 0,81915 = 64,287 N; F_тр = 19,286 N; A_тр = −19,286 · 3 = −57,86 J
    // ΣA = 77,18 J; v_B = √(2 · 77,18/8) = 4,393 m/s
    expect(incline.height).toBeCloseTo(1.7207, 4);
    expect(incline.workGravity).toBeCloseTo(135.04, 2);
    expect(incline.normal).toBeCloseTo(64.287, 3);
    expect(incline.friction).toBeCloseTo(19.286, 3);
    expect(incline.workFriction).toBeCloseTo(-57.86, 2);
    expect(incline.workTotal).toBeCloseTo(77.18, 2);
    expect(incline.speed).toBeCloseTo(4.393, 3);
    expect(Math.sqrt((2 * 77.18) / 8)).toBeCloseTo(4.393, 3);
    // под: F_тр = 0,3 · 78,48 = 23,544 N; d = 77,18/23,544 = 3,278 m
    expect(0.3 * 8 * g).toBeCloseTo(23.544, 10);
    expect(d).toBeCloseTo(3.278, 3);
    expect(77.18 / 23.544).toBeCloseTo(3.278, 3);
  });

  it("теоремата за целия път A → C: сборът от работите е нула", () => {
    // 135,04 − 57,86 − 23,544 · 3,278 = 0 (до закръглението)
    expect(
      incline.workGravity + incline.workFriction - 0.3 * 8 * g * d,
    ).toBeCloseTo(0, 10);
    expect(135.04 - 57.86 - 23.544 * 3.278).toBeCloseTo(0, 1);
  });

  it("независимо: RK4 на уравненията на движението за двата участъка", () => {
    const m = 8;
    // наклон: m·s'' = m·g·sin α − μ·m·g·cos α → 3,2160 m/s²
    const a1 =
      (m * g * Math.sin(35 * RAD) - 0.3 * m * g * Math.cos(35 * RAD)) / m;
    expect(a1).toBeCloseTo(3.216, 4);
    const t1 = Math.sqrt((2 * 3) / a1); // 1,3659 s
    const atB = rk4((_t, y) => [y[1]!, a1], [0, 0], 0, t1, 2000);
    expect(t1).toBeCloseTo(1.3659, 4);
    expect(atB[0]).toBeCloseTo(3, 9);
    expect(atB[1]).toBeCloseTo(incline.speed, 9);
    // под: m·s'' = −μ·m·g; спира след v_B/(μ·g) = 1,4926 s
    const t2 = atB[1]! / (0.3 * g);
    const atC = rk4((_t, y) => [y[1]!, -0.3 * g], [0, atB[1]!], 0, t2, 2000);
    expect(t2).toBeCloseTo(1.4926, 4);
    expect(atC[0]).toBeCloseTo(d, 9);
    expect(atC[1]).toBeCloseTo(0, 9);
  });
});

describe("Пример П2 – товар 10 kg, макара 4 kg / 0,2 m, цилиндър 12 kg / 0,15 m, M_тр = 2 N·m, s = 1,5 m", () => {
  const input = {
    loadMass: 10,
    pulleyMass: 4,
    pulleyRadius: 0.2,
    rollerMass: 12,
    rollerRadius: 0.15,
    distance: 1.5,
    frictionMoment: 2,
  };
  const result = loadPulleyRoller(input);

  it("кинетична енергия, работа и скорост", () => {
    // J2 = 0,08; J3 = 0,135 kg·m²
    // T = v²/2 · (10 + 0,08/0,04 + 12 + 0,135/0,0225) = v²/2 · (10 + 2 + 12 + 6) = 15·v²
    expect(result.pulleyInertia).toBeCloseTo(0.08, 12);
    expect(result.rollerInertia).toBeCloseTo(0.135, 12);
    expect(result.reducedMass).toBeCloseTo(30, 10);
    // A_G = 98,1 · 1,5 = 147,15 J; φ2 = 1,5/0,2 = 7,5 rad; A_тр = −2 · 7,5 = −15 J; ΣA = 132,15 J
    expect(result.workGravity).toBeCloseTo(147.15, 10);
    expect(result.pulleyAngle).toBeCloseTo(7.5, 10);
    expect(result.workFriction).toBeCloseTo(-15, 10);
    expect(result.workTotal).toBeCloseTo(132.15, 10);
    // 15·v² = 132,15 → v² = 8,81; v = 2,968 m/s; ω2 = 14,84; ω3 = 19,79 rad/s
    expect(result.speed ** 2).toBeCloseTo(8.81, 10);
    expect(result.speed).toBeCloseTo(2.968, 3);
    expect(result.pulleyOmega).toBeCloseTo(14.84, 2);
    expect(result.rollerOmega).toBeCloseTo(19.79, 2);
    // дялове: 10·8,81/2 = 44,05; 0,08·14,84²/2 = 8,81; 3/4·12·8,81 = 79,29; сбор 132,15 J
    expect(result.energies.load).toBeCloseTo(44.05, 10);
    expect(result.energies.pulley).toBeCloseTo(8.81, 10);
    expect(result.energies.roller).toBeCloseTo(79.29, 10);
    expect(
      result.energies.load + result.energies.pulley + result.energies.roller,
    ).toBeCloseTo(result.workTotal, 10);
  });

  it("ускорение и сили в нишката", () => {
    // 30·a = 98,1 − 2/0,2 = 88,1 → a = 2,9367 m/s²; проверка v² = 2·a·s = 8,81
    expect(result.acceleration).toBeCloseTo(2.9367, 4);
    expect(2 * result.acceleration * 1.5).toBeCloseTo(8.81, 10);
    // S1 = 10 · (9,81 − 2,9367) = 68,73 N
    // цилиндър: F_тр = m3·a/2 = 17,62 N; S3 = 3/2 · 12 · 2,9367 = 52,86 N
    expect(result.tensionLoad).toBeCloseTo(68.73, 2);
    expect(10 * (9.81 - 2.9367)).toBeCloseTo(68.73, 2);
    expect(result.rollerFriction).toBeCloseTo(17.62, 2);
    expect(result.tensionRoller).toBeCloseTo(52.86, 2);
    expect(1.5 * 12 * 2.9367).toBeCloseTo(52.86, 2);
    // нужен коефициент на триене: 17,62/(12 · 9,81) = 17,62/117,72 = 0,150
    expect(result.muRequired).toBeCloseTo(0.15, 3);
    // макарата: J2·ε2 = 0,08 · 2,9367/0,2 = 1,17 N·m = (68,73 − 52,86)·0,2 − 2
    expect((0.08 * result.acceleration) / 0.2).toBeCloseTo(1.17, 2);
    expect((68.73 - 52.86) * 0.2 - 2).toBeCloseTo(1.17, 2);
    expect((result.tensionLoad - result.tensionRoller) * 0.2 - 2).toBeCloseTo(
      (0.08 * result.acceleration) / 0.2,
      10,
    );
  });

  it("независимо: уравненията на движението на трите тела + RK4", () => {
    // неизвестни: a, S1, S3, F (триене под цилиндъра)
    //   товар:     m1·a = m1·g − S1
    //   макара:    J2·a/r2 = (S1 − S3)·r2 − M_тр
    //   цилиндър:  m3·a = S3 − F
    //              J3·a/r3 = F·r3
    const m1 = 10;
    const m3 = 12;
    const r2 = 0.2;
    const r3 = 0.15;
    const J2 = 0.08;
    const J3 = 0.135;
    const unknowns = () =>
      solve(
        [
          [m1, 1, 0, 0],
          [J2 / r2, -r2, r2, 0],
          [m3, 0, -1, 1],
          [J3 / r3, 0, 0, -r3],
        ],
        [m1 * g, -2, 0, 0],
      );
    const [a, S1, S3, F] = unknowns();
    expect(a).toBeCloseTo(result.acceleration, 10);
    expect(S1).toBeCloseTo(result.tensionLoad, 10);
    expect(S3).toBeCloseTo(result.tensionRoller, 10);
    expect(F).toBeCloseTo(result.rollerFriction, 10);
    const time = Math.sqrt((2 * 1.5) / a!); // 1,0107 s
    const end = rk4((_t, y) => [y[1]!, unknowns()[0]!], [0, 0], 0, time, 500);
    expect(time).toBeCloseTo(1.0107, 4);
    expect(end[0]).toBeCloseTo(1.5, 9);
    expect(end[1]).toBeCloseTo(result.speed, 9);
  });

  it("без момент на триене системата е консервативна: T + Π = const", () => {
    // v = √(2 · 147,15/30) = √9,81 = 3,132 m/s
    const free = loadPulleyRoller({ ...input, frictionMoment: 0 });
    expect(free.speed).toBeCloseTo(3.132, 3);
    // по пътя: T(s) − m1·g·s = 0 за всяко s (нулево ниво на Π в началото)
    for (const s of [0.3, 0.75, 1.2, 1.5]) {
      const state = loadPulleyRoller({
        ...input,
        frictionMoment: 0,
        distance: s,
      });
      const T =
        state.energies.load + state.energies.pulley + state.energies.roller;
      expect(T + gravityPotential(10, -s)).toBeCloseTo(0, 10);
    }
    // с триене механичната енергия намалява точно с работата на момента
    const T =
      result.energies.load + result.energies.pulley + result.energies.roller;
    expect(T + gravityPotential(10, -1.5)).toBeCloseTo(-15, 10);
  });
});

describe("Пример П3 – плътен цилиндър 5 kg, r = 0,1 m, наклон 20°, път 2 m", () => {
  const m = 5;
  const r = 0.1;
  const JC = solidDiscInertia(m, r);
  const result = rollingDownIncline({
    mass: m,
    radius: r,
    centralInertia: JC,
    angleDeg: 20,
    distance: 2,
  });

  it("скорост от теоремата", () => {
    // h = 2 · 0,34202 = 0,68404 m; 1 + J_C/(m·r²) = 1,5
    // v² = 2 · 9,81 · 0,68404/1,5 = 8,947; v = 2,991 m/s; ω = 29,91 rad/s
    expect(result.height).toBeCloseTo(0.68404, 5);
    expect(result.speed ** 2).toBeCloseTo(8.947, 3);
    expect((2 * 9.81 * 0.68404) / 1.5).toBeCloseTo(8.947, 3);
    expect(result.speed).toBeCloseTo(2.991, 3);
    expect(result.omega).toBeCloseTo(29.91, 2);
    // m·g·h = 5 · 9,81 · 0,68404 = 33,55 J = 22,37 + 11,18
    expect(result.work).toBeCloseTo(33.55, 2);
    expect(result.energy.translational).toBeCloseTo(22.37, 2);
    expect(result.energy.rotational).toBeCloseTo(11.18, 2);
    expect(result.energy.total).toBeCloseTo(result.work, 10);
  });

  it("ускорението a = g·sin α/(1 + J_C/(m·r²)) срещу енергийния резултат", () => {
    // a = 9,81 · 0,34202/1,5 = 2,2368 m/s²; v² = 2·a·s = 2 · 2,2368 · 2 = 8,947
    expect(result.acceleration).toBeCloseTo(2.2368, 4);
    expect(rollingAcceleration(20, 0.5)).toBeCloseTo(result.acceleration, 12);
    expect(2 * result.acceleration * 2).toBeCloseTo(result.speed ** 2, 10);
    expect(2 * 2.2368 * 2).toBeCloseTo(8.947, 3);
    // числена производна на v²(s)/2 по s (от теоремата) дава същото ускорение
    const v2 = (s: number) =>
      rollingDownIncline({
        mass: m,
        radius: r,
        centralInertia: JC,
        angleDeg: 20,
        distance: s,
      }).speed ** 2;
    expect((v2(2.001) - v2(1.999)) / (2 * 0.002)).toBeCloseTo(
      result.acceleration,
      8,
    );
    // диск 2/3, пръстен 1/2, плъзгане без триене 1 – от g·sin α
    const gs = g * Math.sin(20 * RAD);
    expect(rollingAcceleration(20, 0.5) / gs).toBeCloseTo(2 / 3, 12);
    expect(rollingAcceleration(20, 1) / gs).toBeCloseTo(0.5, 12);
    expect(rollingAcceleration(20, 0) / gs).toBeCloseTo(1, 12);
  });

  it("сила на триене и условие за търкаляне без плъзгане", () => {
    // m·g·sin α = 49,05 · 0,34202 = 16,776 N; m·a = 5 · 2,2368 = 11,184 N
    // F_тр = 16,776 − 11,184 = 5,592 N; N = 49,05 · 0,93969 = 46,09 N; μ ≥ 0,121 = tg 20°/3
    expect(m * g * Math.sin(20 * RAD)).toBeCloseTo(16.776, 3);
    expect(m * result.acceleration).toBeCloseTo(11.184, 3);
    expect(result.friction).toBeCloseTo(5.592, 3);
    expect(result.normal).toBeCloseTo(46.09, 2);
    expect(result.muRequired).toBeCloseTo(0.121, 3);
    expect(result.muRequired).toBeCloseTo(Math.tan(20 * RAD) / 3, 12);
  });

  it("пръстен и плъзгане без триене за сравнение", () => {
    // пръстен: v = √(g·h) = √6,7104 = 2,590 m/s; a = 9,81 · 0,34202/2 = 1,678 m/s²
    const ring = rollingDownIncline({
      mass: m,
      radius: r,
      centralInertia: thinRingInertia(m, r),
      angleDeg: 20,
      distance: 2,
    });
    expect(ring.speed).toBeCloseTo(2.59, 3);
    expect(ring.acceleration).toBeCloseTo(1.678, 3);
    // без триене: √(2 · 9,81 · 0,68404) = 3,663 m/s
    expect(
      slideOnIncline({ mass: m, angleDeg: 20, length: 2, mu: 0 }).speed,
    ).toBeCloseTo(3.663, 3);
  });

  it("независимо: уравненията на движението + RK4; механичната енергия се запазва", () => {
    // неизвестни a, ε, F:  m·a = m·g·sin α − F;  J_C·ε = F·r;  a − ε·r = 0
    const unknowns = () =>
      solve(
        [
          [m, 0, 1],
          [0, JC, -r],
          [1, -r, 0],
        ],
        [m * g * Math.sin(20 * RAD), 0, 0],
      );
    const [a, eps, F] = unknowns();
    expect(a).toBeCloseTo(result.acceleration, 10);
    expect(F).toBeCloseTo(result.friction, 10);
    const time = result.speed / result.acceleration; // 1,3373 s
    expect(time).toBeCloseTo(1.3373, 4);
    // състояние: [s, v, φ, ω]
    const f = (_t: number, y: number[]) => [y[1]!, a!, y[3]!, eps!];
    const end = rk4(f, [0, 0, 0, 0], 0, time, 1000);
    expect(end[0]).toBeCloseTo(2, 9);
    expect(end[1]).toBeCloseTo(result.speed, 9);
    expect(end[2]).toBeCloseTo(20, 8); // φ = s/r = 20 rad
    expect(end[3]).toBeCloseTo(result.omega, 8);
    // T + Π по пътя (Π = 0 в началото, y нагоре): стойността остава нула
    for (const fraction of [0.25, 0.5, 0.75, 1]) {
      const y = rk4(f, [0, 0, 0, 0], 0, time * fraction, 500);
      const T = kineticEnergyPlane({
        mass: m,
        centreSpeed: y[1]!,
        centralInertia: JC,
        omega: y[3]!,
      }).total;
      const Pi = gravityPotential(m, -y[0]! * Math.sin(20 * RAD));
      expect(T + Pi).toBeCloseTo(0, 8);
    }
  });
});

describe("В реалния живот", () => {
  it("автомобил 1200 kg при 54 и 108 km/h; спирачен път при μ = 0,7", () => {
    // 54/3,6 = 15 m/s; T = 1200 · 225/2 = 135 000 J = 135 kJ
    // 108/3,6 = 30 m/s; T = 1200 · 900/2 = 540 000 J = 540 kJ
    expect(54 / 3.6).toBeCloseTo(15, 12);
    expect(108 / 3.6).toBeCloseTo(30, 12);
    expect(kineticEnergyPoint(1200, 15)).toBeCloseTo(135000, 8);
    expect(kineticEnergyPoint(1200, 30)).toBeCloseTo(540000, 8);
    // d = v²/(2·μ·g) = 225/13,734 = 16,38 m; 900/13,734 = 65,53 m
    expect(2 * 0.7 * g).toBeCloseTo(13.734, 10);
    expect(stoppingDistance(15, 0.7)).toBeCloseTo(16.38, 2);
    expect(stoppingDistance(30, 0.7)).toBeCloseTo(65.53, 2);
    expect(stoppingDistance(30, 0.7) / stoppingDistance(15, 0.7)).toBeCloseTo(
      4,
      12,
    );
  });

  it("чук на сваебойна машина: 800 kg от 1,5 m", () => {
    // работа на теглото 800 · 9,81 · 1,5 = 11 772 J = 11,77 kJ = 11,77 kN·m
    // v = √(2 · 9,81 · 1,5) = √29,43 = 5,425 m/s
    const v = speedFromWork({ reducedMass: 800, work: 800 * g * 1.5 });
    expect(800 * g * 1.5).toBeCloseTo(11772, 8);
    expect(11772 / 1000).toBeCloseTo(11.77, 2);
    expect(v).toBeCloseTo(5.425, 3);
    expect(kineticEnergyPoint(800, v)).toBeCloseTo(11772, 8);
  });

  it("лебедка: товар 200 kg, барабан – плътен диск 80 kg, r = 0,25 m, 3 m", () => {
    // J = 2,5 kg·m²; T = v²/2 · (200 + 2,5/0,0625) = 120·v²; A = 200 · 9,81 · 3 = 5886 J
    // v² = 49,05; v = 7,004 m/s; свободно падане √(2 · 9,81 · 3) = 7,672 m/s
    const result = loadAndDrum({
      loadMass: 200,
      drumInertia: solidDiscInertia(80, 0.25),
      drumRadius: 0.25,
      drop: 3,
    });
    expect(result.reducedMass).toBeCloseTo(240, 10);
    expect(result.work).toBeCloseTo(5886, 8);
    expect(result.speed ** 2).toBeCloseTo(49.05, 10);
    expect(result.speed).toBeCloseTo(7.004, 3);
    expect(Math.sqrt(2 * g * 3)).toBeCloseTo(7.672, 3);
    // a = 200 · 9,81/240 = 8,175 m/s²; S = 200 · (9,81 − 8,175) = 327 N
    expect(result.acceleration).toBeCloseTo(8.175, 10);
    expect(result.tension).toBeCloseTo(327, 8);
    // независимо: m·a = m·g − S; J·ε = S·r; a = ε·r → RK4
    const [a, eps, S] = solve(
      [
        [200, 0, 1],
        [0, 2.5, -0.25],
        [1, -0.25, 0],
      ],
      [200 * g, 0, 0],
    );
    expect(a).toBeCloseTo(result.acceleration, 10);
    expect(S).toBeCloseTo(result.tension, 8);
    const time = result.speed / a!;
    const end = rk4(
      (_t, y) => [y[1]!, a!, y[3]!, eps!],
      [0, 0, 0, 0],
      0,
      time,
      1000,
    );
    expect(end[0]).toBeCloseTo(3, 9);
    expect(end[1]).toBeCloseTo(result.speed, 9);
    expect(end[3]).toBeCloseTo(result.omega, 8);
    // T на товара + T на барабана = работата на теглото
    expect(
      kineticEnergyPoint(200, end[1]!) + kineticEnergyRotation(2.5, end[3]!),
    ).toBeCloseTo(5886, 6);
  });
});

describe("„Провери се“", () => {
  it("Леко 3 – гладка пързалка с височина 3 m", () => {
    // v = √(2 · 9,81 · 3) = √58,86 = 7,67 m/s – наклонът не е важен
    for (const angle of [15, 40, 75]) {
      const slide = slideOnIncline({
        mass: 30,
        angleDeg: angle,
        length: 3 / Math.sin(angle * RAD),
        mu: 0,
      });
      expect(slide.speed).toBeCloseTo(7.67, 2);
    }
  });

  it("Подробно 2 – спиране от 6 m/s при μ = 0,4", () => {
    // d = 36/(2 · 0,4 · 9,81) = 36/7,848 = 4,587 m
    expect(2 * 0.4 * g).toBeCloseTo(7.848, 10);
    expect(stoppingDistance(6, 0.4)).toBeCloseTo(4.587, 3);
  });

  it("Подробно 3 – пружина 800 N/m, свита с 0,1 m, точка 0,5 kg", () => {
    // Π = 800 · 0,01/2 = 4 J; 0,5·v²/2 = 4 → v² = 16; v = 4 m/s
    expect(springPotential(800, 0.1)).toBeCloseTo(4, 12);
    expect(
      springLaunchSpeed({ mass: 0.5, stiffness: 800, compression: 0.1 }),
    ).toBeCloseTo(4, 12);
    // независимо: RK4 на m·x'' = −c·x от x = −0,1 до x = 0 (четвърт период π/(2k), k = 40)
    const end = rk4(
      (_t, y) => [y[1]!, (-800 * y[0]!) / 0.5],
      [-0.1, 0],
      0,
      Math.PI / 80,
      2000,
    );
    expect(end[0]).toBeCloseTo(0, 9);
    expect(end[1]).toBeCloseTo(4, 9);
  });

  it("Подробно 4 – прът 1,2 m пада от хоризонтално до отвесно положение", () => {
    // (m·l²/3)·ω²/2 = m·g·l/2 → ω = √(3·g/l) = √24,525 = 4,952 rad/s; край: 4,952 · 1,2 = 5,94 m/s
    const omega = rodSwingOmega(1.2);
    expect((3 * g) / 1.2).toBeCloseTo(24.525, 10);
    expect(omega).toBeCloseTo(4.952, 3);
    expect(omega * 1.2).toBeCloseTo(5.94, 2);
    // енергиите при маса 3 kg: T = 1,44 · 24,525/2 = 17,658 J = 3 · 9,81 · 0,6
    expect(
      kineticEnergyRotation(rodAboutEndInertia(3, 1.2), omega),
    ).toBeCloseTo(3 * g * 0.6, 10);
    // независимо: RK4 на J·θ'' = m·g·(l/2)·cos θ, θ – ъгъл под хоризонталата
    const f = (_t: number, y: number[]) => [
      y[1]!,
      ((3 * g) / (2 * 1.2)) * Math.cos(y[0]!),
    ];
    let y = [0, 0];
    const h = 1e-4;
    while (y[0]! + y[1]! * h < Math.PI / 2) y = rk4(f, y, 0, h, 1);
    // последна частична стъпка до θ = 90°
    y = rk4(f, y, 0, (Math.PI / 2 - y[0]!) / y[1]!, 1);
    expect(y[0]).toBeCloseTo(Math.PI / 2, 6);
    expect(y[1]).toBeCloseTo(omega, 5);
    // по пътя T + Π = const: при θ = 30° ω² = 3·g·sin 30°/l
    expect(rodSwingOmega(1.2, 30) ** 2).toBeCloseTo((3 * g * 0.5) / 1.2, 10);
  });

  it("Подробно 5 – товар 6 kg на барабан – плътен диск 4 kg", () => {
    // (6 + 4/2)·a = 6 · 9,81 → a = 58,86/8 = 7,36 m/s²; радиусът не участва
    for (const r of [0.1, 0.3]) {
      const result = loadAndDrum({
        loadMass: 6,
        drumInertia: solidDiscInertia(4, r),
        drumRadius: r,
        drop: 1,
      });
      expect(result.acceleration).toBeCloseTo(7.3575, 10);
      expect(result.acceleration).toBeCloseTo(7.36, 2);
    }
  });
});

describe("невалиден вход", () => {
  it("хвърля грешка на български", () => {
    expect(() => kineticEnergyPoint(0, 1)).toThrow("маса");
    expect(() => kineticEnergyRotation(-1, 1)).toThrow("инерционен момент");
    expect(() => solidDiscInertia(1, 0)).toThrow("радиус");
    expect(() =>
      slideOnIncline({ mass: 1, angleDeg: 90, length: 1, mu: 0.1 }),
    ).toThrow("наклона");
    expect(() =>
      slideOnIncline({ mass: 1, angleDeg: 30, length: 1, mu: -0.1 }),
    ).toThrow("триене");
    // tg 10° < μ = 0,5: тялото не тръгва от покой – работата е отрицателна
    expect(() =>
      slideOnIncline({ mass: 1, angleDeg: 10, length: 1, mu: 0.5 }),
    ).toThrow("спира");
    expect(() => stoppingDistance(5, 0)).toThrow("триене");
    expect(() =>
      loadAndDrum({
        loadMass: 1,
        drumInertia: 1,
        drumRadius: 0.1,
        drop: 1,
        frictionMoment: 5,
      }),
    ).toThrow("задържа");
    expect(() => rollingAcceleration(20, -1)).toThrow("отношение");
    expect(() => rodSwingOmega(1, 200)).toThrow("Ъгълът");
    expect(() => speedFromWork({ reducedMass: 1, work: Number.NaN })).toThrow(
      "работа",
    );
  });
});
