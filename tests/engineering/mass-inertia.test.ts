import { describe, expect, it } from "vitest";
import {
  G_ACCELERATION,
  betweenParallelAxes,
  compositeInertiaZ,
  cylinderInertia,
  cylinderInertiaTransverse,
  discInertia,
  discInertiaDiameter,
  hollowCylinderInertia,
  massCentre,
  parallelAxis,
  plateInertia,
  pointInertia,
  pointsInertiaZ,
  radiusOfGyration,
  ringInertia,
  rodInertiaCentre,
  rodInertiaEnd,
  toCentralAxis,
  weight,
} from "@/lib/engineering/mass-inertia";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Единици: m, kg, kg·m², N. Оста x е надясно, y нагоре, z към наблюдателя.

/**
 * Независима проверка: числено интегриране по правилото на средната точка.
 * Не ползва нищо от проверявания файл.
 */
function integrate(
  f: (x: number) => number,
  a: number,
  b: number,
  steps = 20_000,
): number {
  const h = (b - a) / steps;
  let sum = 0;
  for (let i = 0; i < steps; i++) sum += f(a + (i + 0.5) * h);
  return sum * h;
}

/** Двумерно правило на средната точка върху правоъгълник. */
function integrate2(
  f: (x: number, y: number) => number,
  [ax, bx]: [number, number],
  [ay, by]: [number, number],
  steps = 600,
): number {
  const hx = (bx - ax) / steps;
  const hy = (by - ay) / steps;
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const x = ax + (i + 0.5) * hx;
    for (let j = 0; j < steps; j++) sum += f(x, ay + (j + 0.5) * hy);
  }
  return sum * hx * hy;
}

describe("таблични тела – формулата срещу числено интегриране на r² dm", () => {
  it("тънък прът, ос през средата: m·l²/12", () => {
    // m = 3 kg, l = 2 m: 3·4/12 = 1 kg·m²
    expect(rodInertiaCentre(3, 2)).toBeCloseTo(1, 12);
    // dm = (m/l)·dx, x от −1 до 1
    const numeric = integrate((x) => x * x * (3 / 2), -1, 1);
    expect(numeric).toBeCloseTo(1, 7);
  });

  it("тънък прът, ос през края: m·l²/3", () => {
    // 3·4/3 = 4 kg·m²
    expect(rodInertiaEnd(3, 2)).toBeCloseTo(4, 12);
    const numeric = integrate((x) => x * x * (3 / 2), 0, 2);
    expect(numeric).toBeCloseTo(4, 7);
  });

  it("тънък пръстен: m·R²", () => {
    // m = 10 kg, R = 0,4 m: 10·0,16 = 1,6 kg·m²
    expect(ringInertia(10, 0.4)).toBeCloseTo(1.6, 12);
    // сбор по 10 000 еднакви точки върху окръжността
    const n = 10_000;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n;
      const x = 0.4 * Math.cos(angle);
      const y = 0.4 * Math.sin(angle);
      sum += (10 / n) * (x * x + y * y);
    }
    expect(sum).toBeCloseTo(1.6, 9);
  });

  it("диск: m·R²/2 (по пръстени и по декартова мрежа)", () => {
    // 10·0,16/2 = 0,8 kg·m²
    expect(discInertia(10, 0.4)).toBeCloseTo(0.8, 12);
    const sigma = 10 / (Math.PI * 0.16); // kg/m²
    // пръстени: dm = σ·2π·r·dr
    const rings = integrate((r) => r * r * sigma * 2 * Math.PI * r, 0, 0.4);
    expect(rings).toBeCloseTo(0.8, 7);
    // независимо от пръстените: мрежа x–y
    const grid = integrate2(
      (x, y) => (x * x + y * y <= 0.16 ? sigma * (x * x + y * y) : 0),
      [-0.4, 0.4],
      [-0.4, 0.4],
    );
    expect(grid).toBeCloseTo(0.8, 3);
  });

  it("диск спрямо диаметър: m·R²/4 = половината от J_z", () => {
    // 10·0,16/4 = 0,4 kg·m²
    expect(discInertiaDiameter(10, 0.4)).toBeCloseTo(0.4, 12);
    const sigma = 10 / (Math.PI * 0.16);
    const grid = integrate2(
      (x, y) => (x * x + y * y <= 0.16 ? sigma * y * y : 0),
      [-0.4, 0.4],
      [-0.4, 0.4],
    );
    expect(grid).toBeCloseTo(0.4, 3);
  });

  it("правоъгълна плоча (Пример 2): J_x, J_y, J_z", () => {
    // m = 12 kg, a = 0,6 m (по x), b = 0,4 m (по y)
    // J_x = 12·0,16/12 = 0,16; J_y = 12·0,36/12 = 0,36; J_z = 0,52 kg·m²
    const plate = plateInertia(12, 0.6, 0.4);
    expect(plate.jx).toBeCloseTo(0.16, 12);
    expect(plate.jy).toBeCloseTo(0.36, 12);
    expect(plate.jz).toBeCloseTo(0.52, 12);
    const sigma = 12 / (0.6 * 0.4);
    const x: [number, number] = [-0.3, 0.3];
    const y: [number, number] = [-0.2, 0.2];
    expect(integrate2((_, yy) => sigma * yy * yy, x, y)).toBeCloseTo(0.16, 5);
    expect(integrate2((xx) => sigma * xx * xx, x, y)).toBeCloseTo(0.36, 5);
    expect(
      integrate2((xx, yy) => sigma * (xx * xx + yy * yy), x, y),
    ).toBeCloseTo(0.52, 5);
  });

  it("плътен цилиндър спрямо оста си: m·R²/2, без височината", () => {
    // m = 30 kg, R = 0,2 m: 30·0,04/2 = 0,6 kg·m²
    expect(cylinderInertia(30, 0.2)).toBeCloseTo(0.6, 12);
    // обемно интегриране: височина h = 0,5 m, ρ = m/(π·R²·h);
    // слоеве по z (всеки е диск) × пръстени по r
    const h = 0.5;
    const rho = 30 / (Math.PI * 0.04 * h);
    const perLayer = integrate((r) => r * r * rho * 2 * Math.PI * r, 0, 0.2);
    const numeric = integrate(() => perLayer, 0, h, 50);
    expect(numeric).toBeCloseTo(0.6, 7);
  });

  it("кух цилиндър: m·(R² + r²)/2 (въпрос 5 от „Подробно“)", () => {
    // m = 30 kg, R = 0,2 m, r = 0,1 m: 30·(0,04 + 0,01)/2 = 0,75 kg·m²
    expect(hollowCylinderInertia(30, 0.2, 0.1)).toBeCloseTo(0.75, 12);
    const sigma = 30 / (Math.PI * (0.04 - 0.01));
    const numeric = integrate((r) => r * r * sigma * 2 * Math.PI * r, 0.1, 0.2);
    expect(numeric).toBeCloseTo(0.75, 7);
    // частни случаи: r = 0 е плътен цилиндър; r → R е пръстен
    expect(hollowCylinderInertia(30, 0.2, 0)).toBeCloseTo(0.6, 12);
    expect(hollowCylinderInertia(30, 0.2, 0.2 - 1e-9)).toBeCloseTo(
      ringInertia(30, 0.2),
      6,
    );
  });

  it("цилиндричен прът спрямо напречна ос: m·(l²/12 + R²/4)", () => {
    // m = 2 kg, l = 0,9 m, R = 0,01 m:
    // 2·(0,0675 + 0,000025) = 0,13505 kg·m²; тънък прът: 0,135
    expect(cylinderInertiaTransverse(2, 0.01, 0.9)).toBeCloseTo(0.13505, 10);
    // резени-дискове: dJ = dm·(R²/4 + x²)
    const numeric = integrate(
      (x) => (2 / 0.9) * (0.01 ** 2 / 4 + x * x),
      -0.45,
      0.45,
    );
    expect(numeric).toBeCloseTo(0.13505, 8);
    // поправката спрямо тънкия прът: 0,000025/0,0675 = 0,037 % ≈ 0,04 %
    const thin = rodInertiaCentre(2, 0.9);
    const percent =
      ((cylinderInertiaTransverse(2, 0.01, 0.9) - thin) / thin) * 100;
    expect(percent).toBeCloseTo(0.037, 3);
  });
});

describe("теорема на Щайнер", () => {
  it("прът: от средата към края, срещу пряко интегриране", () => {
    // 1 + 3·1² = 4 kg·m²
    expect(parallelAxis(rodInertiaCentre(3, 2), 3, 1)).toBeCloseTo(4, 12);
    expect(parallelAxis(1, 3, 1)).toBeCloseTo(rodInertiaEnd(3, 2), 12);
  });

  it("плоча: ос през връх (Пример 2), срещу пряко интегриране", () => {
    // d² = 0,3² + 0,2² = 0,13; J = 0,52 + 12·0,13 = 0,52 + 1,56 = 2,08 kg·m²
    const corner = parallelAxis(0.52, 12, Math.hypot(0.3, 0.2));
    expect(corner).toBeCloseTo(2.08, 12);
    // формулата m·(a² + b²)/3 = 12·0,52/3 = 2,08
    expect((12 * (0.36 + 0.16)) / 3).toBeCloseTo(2.08, 12);
    // пряко: началото е във върха
    const sigma = 12 / (0.6 * 0.4);
    const direct = integrate2(
      (x, y) => sigma * (x * x + y * y),
      [0, 0.6],
      [0, 0.4],
    );
    expect(direct).toBeCloseTo(2.08, 4);
  });

  it("диск спрямо изместена ос, срещу двумерно интегриране", () => {
    // диск 4 kg, R = 0,3 m; ос на 1,2 m от центъра:
    // 4·0,09/2 = 0,18; 0,18 + 4·1,44 = 0,18 + 5,76 = 5,94 kg·m²
    expect(parallelAxis(discInertia(4, 0.3), 4, 1.2)).toBeCloseTo(5.94, 12);
    const sigma = 4 / (Math.PI * 0.09);
    const direct = integrate2(
      (x, y) => (x * x + (y + 1.2) ** 2 <= 0.09 ? sigma * (x * x + y * y) : 0),
      [-0.3, 0.3],
      [-1.5, -0.9],
    );
    expect(direct).toBeCloseTo(5.94, 2);
  });

  it("между две нецентрални оси се минава през масовия център (въпрос 3)", () => {
    // m = 8 kg; J₁ = 3,2 на 0,5 m от C: J_C = 3,2 − 8·0,25 = 1,2
    expect(toCentralAxis(3.2, 8, 0.5)).toBeCloseTo(1.2, 12);
    // J₂ на 0,2 m от C: 1,2 + 8·0,04 = 1,52 kg·m²
    expect(betweenParallelAxes(3.2, 8, 0.5, 0.2)).toBeCloseTo(1.52, 12);
  });

  it("плоча спрямо страна (въпрос 4)", () => {
    // 20 kg, 1,2 × 0,6 m, ос по дългата страна: J_x = 20·0,36/12 = 0,6;
    // d = 0,3: 0,6 + 20·0,09 = 0,6 + 1,8 = 2,4 kg·m² (= m·b²/3)
    const plate = plateInertia(20, 1.2, 0.6);
    expect(plate.jx).toBeCloseTo(0.6, 12);
    expect(parallelAxis(plate.jx, 20, 0.3)).toBeCloseTo(2.4, 12);
    expect((20 * 0.36) / 3).toBeCloseTo(2.4, 12);
  });

  it("несъвместими данни дават грешка", () => {
    expect(() => toCentralAxis(1, 8, 0.5)).toThrow(/отрицателен/);
  });
});

describe("радиус на инерция", () => {
  it("прът спрямо края: i = l/√3", () => {
    // летвата: √(4/3) = 1,1547 m = 0,5774·2
    expect(radiusOfGyration(4, 3)).toBeCloseTo(1.1547, 4);
    expect(radiusOfGyration(4, 3) / 2).toBeCloseTo(0.577, 3);
    // точка с цялата маса в масовия център: 3·1² = 3 kg·m² – липсва J_C = 1
    expect(pointInertia(3, 1)).toBeCloseTo(3, 12);
    expect(4 - pointInertia(3, 1)).toBeCloseTo(rodInertiaCentre(3, 2), 12);
    // точка на разстояние i дава същия J
    expect(pointInertia(3, radiusOfGyration(4, 3))).toBeCloseTo(4, 12);
  });

  it("въпрос 2 от „Подробно“: l = 1,5 m", () => {
    // 1,5/√3 = 0,866 m; масата се съкращава
    const mass = 7;
    const radius = radiusOfGyration(rodInertiaEnd(mass, 1.5), mass);
    expect(radius).toBeCloseTo(0.866, 3);
  });
});

describe("масов център", () => {
  it("Пример 1 от „Подробно“: три материални точки", () => {
    // m = 2 + 3 + 5 = 10 kg
    // x_C = (2·0 + 3·4 + 5·1)/10 = 17/10 = 1,7 m
    // y_C = (2·0 + 3·0 + 5·3)/10 = 15/10 = 1,5 m
    const points = [
      { mass: 2, x: 0, y: 0 },
      { mass: 3, x: 4, y: 0 },
      { mass: 5, x: 1, y: 3 },
    ];
    const centre = massCentre(points);
    expect(centre.mass).toBe(10);
    expect(centre.x).toBeCloseTo(1.7, 12);
    expect(centre.y).toBeCloseTo(1.5, 12);
    expect(centre.z).toBe(0);
    // J_O = 2·0 + 3·16 + 5·(1 + 9) = 48 + 50 = 98 kg·m²
    expect(pointsInertiaZ(points, { x: 0, y: 0 })).toBeCloseTo(98, 12);
    // Щайнер: OC² = 2,89 + 2,25 = 5,14; J_C = 98 − 51,4 = 46,6 kg·m²
    expect(toCentralAxis(98, 10, Math.hypot(1.7, 1.5))).toBeCloseTo(46.6, 10);
    // пряко: 2·5,14 + 3·(5,29 + 2,25) + 5·(0,49 + 2,25)
    //      = 10,28 + 22,62 + 13,70 = 46,6
    expect(pointInertia(2, Math.hypot(1.7, 1.5))).toBeCloseTo(10.28, 10);
    expect(pointInertia(3, Math.hypot(2.3, 1.5))).toBeCloseTo(22.62, 10);
    expect(pointInertia(5, Math.hypot(0.7, 1.5))).toBeCloseTo(13.7, 10);
    expect(pointsInertiaZ(points, centre)).toBeCloseTo(46.6, 10);
    // свойство на масовия център: Σ m_i·(r_i − r_C) = 0
    const sx = points.reduce((s, p) => s + p.mass * (p.x - centre.x), 0);
    const sy = points.reduce((s, p) => s + p.mass * (p.y - centre.y), 0);
    expect(sx).toBeCloseTo(0, 12);
    expect(sy).toBeCloseTo(0, 12);
  });

  it("система от тела: всяко тяло влиза с масовия си център (въпрос 1)", () => {
    // 4 kg в x = 0 и 6 kg в x = 2,5 m: x_C = 15/10 = 1,5 m
    const centre = massCentre([
      { mass: 4, x: 0, y: 0 },
      { mass: 6, x: 2.5, y: 0 },
    ]);
    expect(centre.x).toBeCloseTo(1.5, 12);
    // същото чрез непрекъснато разпределение: два еднородни пръта с дължина
    // 1 m, центрирани в 0 и в 2,5 m (числено интегриране на x·dm)
    const moment =
      integrate((x) => x * 4, -0.5, 0.5) + integrate((x) => x * 6, 2, 3);
    expect(moment / 10).toBeCloseTo(1.5, 9);
  });

  it("пространствена система – и координатата z", () => {
    // (1·0 + 3·4)/4 = 3
    const centre = massCentre([
      { mass: 1, x: 0, y: 0, z: 0 },
      { mass: 3, x: 0, y: 0, z: 4 },
    ]);
    expect(centre.z).toBeCloseTo(3, 12);
  });
});

describe("съставно тяло: прът + диск (Пример 2 в „Леко“, Пример 3 в „Подробно“)", () => {
  // Прът OA: 2 kg, 0,9 m, виси от O надолу. Диск: 4 kg, R = 0,3 m, центърът
  // му е на 0,9 + 0,3 = 1,2 m под O. Начало в O, y нагоре.
  const rod = {
    mass: 2,
    centralInertia: rodInertiaCentre(2, 0.9),
    x: 0,
    y: -0.45,
  };
  const disc = { mass: 4, centralInertia: discInertia(4, 0.3), x: 0, y: -1.2 };
  const body = compositeInertiaZ([rod, disc], { x: 0, y: 0 });

  it("частите спрямо O", () => {
    // прът: 2·0,81/3 = 0,54 kg·m²
    expect(rodInertiaEnd(2, 0.9)).toBeCloseTo(0.54, 12);
    // същото с Щайнер: 2·0,81/12 + 2·0,45² = 0,135 + 0,405 = 0,54
    expect(parallelAxis(rod.centralInertia, 2, 0.45)).toBeCloseTo(0.54, 12);
    // диск: 4·0,09/2 = 0,18; 0,18 + 4·1,44 = 5,94 kg·m²
    expect(disc.centralInertia).toBeCloseTo(0.18, 12);
    expect(parallelAxis(0.18, 4, 1.2)).toBeCloseTo(5.94, 12);
  });

  it("J_O = 0,54 + 5,94 = 6,48 kg·m²", () => {
    expect(body.inertia).toBeCloseTo(6.48, 12);
  });

  it("масов център: y_C = (2·(−0,45) + 4·(−1,2))/6 = −5,7/6 = −0,95 m", () => {
    expect(body.mass).toBe(6);
    expect(body.centre.x).toBeCloseTo(0, 12);
    expect(body.centre.y).toBeCloseTo(-0.95, 12);
  });

  it("J_C по два пътя: 6,48 − 6·0,9025 = 1,065 и 0,635 + 0,43 = 1,065", () => {
    // Щайнер наобратно: 6·0,95² = 5,415
    expect(toCentralAxis(6.48, 6, 0.95)).toBeCloseTo(1.065, 10);
    // по части: прът 0,135 + 2·0,5² = 0,635; диск 0,18 + 4·0,25² = 0,43
    expect(parallelAxis(rod.centralInertia, 2, 0.5)).toBeCloseTo(0.635, 12);
    expect(parallelAxis(disc.centralInertia, 4, 0.25)).toBeCloseTo(0.43, 12);
    expect(body.centralInertia).toBeCloseTo(1.065, 10);
  });

  it("радиус на инерция спрямо O: √(6,48/6) = √1,08 = 1,039 m", () => {
    expect(body.radius).toBeCloseTo(1.039, 3);
    expect(radiusOfGyration(6.48, 6)).toBeCloseTo(body.radius, 12);
  });

  it("независимо: пряко числено интегриране на r² dm по цялото тяло", () => {
    const rodNumeric = (y0: number) =>
      integrate((y) => (2 / 0.9) * (y - y0) ** 2, -0.9, 0);
    const sigma = 4 / (Math.PI * 0.09);
    const discNumeric = (y0: number) =>
      integrate2(
        (x, y) =>
          x * x + (y + 1.2) ** 2 <= 0.09 ? sigma * (x * x + (y - y0) ** 2) : 0,
        [-0.3, 0.3],
        [-1.5, -0.9],
      );
    expect(rodNumeric(0) + discNumeric(0)).toBeCloseTo(6.48, 2);
    expect(rodNumeric(-0.95) + discNumeric(-0.95)).toBeCloseTo(1.065, 2);
  });
});

describe("числата от „В реалния живот“ и от „Провери се“", () => {
  it("крило на врата: около пантите и около средата", () => {
    // 60 kg, широко 0,9 m: 60·0,81/3 = 16,2; 60·0,81/12 = 4,05 kg·m²
    const leaf = plateInertia(60, 0.9, 2);
    expect(leaf.jy).toBeCloseTo(4.05, 12);
    expect(parallelAxis(leaf.jy, 60, 0.45)).toBeCloseTo(16.2, 12);
    expect(16.2 / 4.05).toBeCloseTo(4, 12);
    // в „Подробно“ със Щайнер: 60·0,45² = 12,15; 4,05 + 12,15 = 16,2
    expect(60 * 0.45 ** 2).toBeCloseTo(12.15, 12);
    expect(4.05 + 12.15).toBeCloseTo(16.2, 12);
  });

  it("маховик: венец срещу плътен диск; тегло в N и в kN", () => {
    // 200 kg, R = 0,5 m: 200·0,25 = 50; 200·0,25/2 = 25 kg·m²
    expect(ringInertia(200, 0.5)).toBeCloseTo(50, 12);
    expect(discInertia(200, 0.5)).toBeCloseTo(25, 12);
    // G = 200·9,81 = 1962 N = 1,962 kN
    expect(G_ACCELERATION).toBe(9.81);
    expect(weight(200)).toBeCloseTo(1962, 9);
    expect(weight(200) / 1000).toBeCloseTo(1.962, 9);
  });

  it("„Леко“, въпрос 1: точка 2 kg на 3 m – 18 kg·m²", () => {
    expect(pointInertia(2, 3)).toBe(18);
  });

  it("„Леко“, въпрос 2: диск 0,8 и пръстен 1,6 kg·m²", () => {
    expect(discInertia(10, 0.4)).toBeCloseTo(0.8, 12);
    expect(ringInertia(10, 0.4) / discInertia(10, 0.4)).toBeCloseTo(2, 12);
  });

  it("„Леко“, въпрос 3: прът 6 kg, 1 m – 0,5 и 2 kg·m²", () => {
    // 6·1/12 = 0,5; 0,5 + 6·0,5² = 0,5 + 1,5 = 2 = 6·1/3
    expect(rodInertiaCentre(6, 1)).toBeCloseTo(0.5, 12);
    expect(parallelAxis(0.5, 6, 0.5)).toBeCloseTo(2, 12);
    expect(rodInertiaEnd(6, 1)).toBeCloseTo(2, 12);
  });

  it("„Леко“, въпрос 4: двойна маса, половин дължина – наполовина", () => {
    // 2·(1/2)² = 1/2
    expect(
      rodInertiaCentre(2 * 5, 0.5 * 3) / rodInertiaCentre(5, 3),
    ).toBeCloseTo(0.5, 12);
  });

  it("„Подробно“, въпрос 5: плътният цилиндър има по-малък J от тръбата", () => {
    expect(cylinderInertia(30, 0.2)).toBeCloseTo(0.6, 12);
    expect(hollowCylinderInertia(30, 0.2, 0.1)).toBeGreaterThan(
      cylinderInertia(30, 0.2),
    );
  });
});

describe("връзки между осовите моменти", () => {
  it("плоска фигура в равнината xy: J_z = J_x + J_y", () => {
    const plate = plateInertia(12, 0.6, 0.4);
    expect(plate.jz).toBeCloseTo(plate.jx + plate.jy, 12);
    expect(discInertia(10, 0.4)).toBeCloseTo(
      2 * discInertiaDiameter(10, 0.4),
      12,
    );
  });

  it("плоча с b → 0 е прът", () => {
    expect(plateInertia(3, 2, 1e-9).jz).toBeCloseTo(rodInertiaCentre(3, 2), 9);
  });
});

describe("проверка на входа", () => {
  it("отказва невалидни стойности", () => {
    expect(() => rodInertiaCentre(0, 2)).toThrow(/положителна/);
    expect(() => rodInertiaEnd(3, -2)).toThrow(/положителна/);
    expect(() => discInertia(Number.NaN, 1)).toThrow(/крайно число/);
    expect(() => pointInertia(2, -1)).toThrow(/отрицателна/);
    expect(() => hollowCylinderInertia(30, 0.1, 0.2)).toThrow(/по-малък/);
    expect(() => massCentre([])).toThrow(/поне една маса/);
    expect(() => massCentre([{ mass: -1, x: 0, y: 0 }])).toThrow(/положителна/);
    expect(() => compositeInertiaZ([], { x: 0, y: 0 })).toThrow(
      /поне една част/,
    );
    expect(() => pointsInertiaZ([], { x: 0, y: 0 })).toThrow(/поне една маса/);
    expect(() => parallelAxis(1, 2, -0.1)).toThrow(/отрицателна/);
    expect(() => weight(0)).toThrow(/положителна/);
  });
});
