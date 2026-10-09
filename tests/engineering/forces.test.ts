import { describe, expect, it } from "vitest";
import {
  coupleMoment,
  coupleMomentOfForces,
  forceComponents,
  forceFromAngle,
  leverArm,
  magnitudeAndAngle,
  momentAboutPoint,
  resultantOfConcurrent,
  type PlaneForce,
  type Point,
} from "@/lib/engineering/forces";

// Всички очаквани стойности са сметнати на ръка и са записани в коментара над теста.
// Знаци: x надясно, y нагоре, момент > 0 обратно на часовниковата стрелка.

const O: Point = { x: 0, y: 0 };

describe("проекции на сила", () => {
  it("30 kN при 60°: F_x = 30·0,5 = 15; F_y = 30·0,86603 = 25,981", () => {
    const { Fx, Fy } = forceComponents(30, 60);
    expect(Fx).toBeCloseTo(15, 9);
    expect(Fy).toBeCloseTo(25.981, 3);
  });

  it("въпрос в „Леко“: 100 kN при 30° → F_x = 86,6 kN; F_y = 50,0 kN", () => {
    // cos 30° = 0,86603; sin 30° = 0,5
    const { Fx, Fy } = forceComponents(100, 30);
    expect(Fx).toBeCloseTo(86.6, 1);
    expect(Fy).toBeCloseTo(50, 9);
  });

  it("фигура „проекции“: 50 kN с проекции 40 и 30 kN е под ъгъл 36,87°", () => {
    // tg α = 30/40 = 0,75 → α = 36,87°; √(40² + 30²) = √2500 = 50
    const { value, angleDeg } = magnitudeAndAngle(40, 30);
    expect(value).toBeCloseTo(50, 12);
    expect(angleDeg).toBeCloseTo(36.87, 2);
    // обратно, с отпечатания ъгъл: 50·cos 36,87° = 40,00; 50·sin 36,87° = 30,00
    const back = forceComponents(50, 36.87);
    expect(back.Fx).toBeCloseTo(40, 2);
    expect(back.Fy).toBeCloseTo(30, 2);
  });

  it("ъгълът е в правилния квадрант", () => {
    // (−1; 1) → 135°; (−1; −1) → −135°; (0; −5) → −90°
    expect(magnitudeAndAngle(-1, 1).angleDeg).toBeCloseTo(135, 9);
    expect(magnitudeAndAngle(-1, -1).angleDeg).toBeCloseTo(-135, 9);
    expect(magnitudeAndAngle(0, -5).angleDeg).toBeCloseTo(-90, 9);
  });

  it("нулева сила: големина 0, ъгъл 0 по договорка", () => {
    expect(magnitudeAndAngle(0, 0)).toEqual({ value: 0, angleDeg: 0 });
  });

  it("forceFromAngle пази приложната точка", () => {
    const force = forceFromAngle(10, 90, { x: 2, y: 3 });
    expect(force.x).toBe(2);
    expect(force.y).toBe(3);
    expect(force.Fx).toBeCloseTo(0, 12);
    expect(force.Fy).toBeCloseTo(10, 12);
  });

  it("отказва отрицателна големина и безкрайни стойности", () => {
    expect(() => forceComponents(-1, 0)).toThrow();
    expect(() => forceComponents(Number.NaN, 0)).toThrow();
    expect(() => forceComponents(1, Number.POSITIVE_INFINITY)).toThrow();
    expect(() => magnitudeAndAngle(Number.NaN, 1)).toThrow();
  });
});

describe("пример Л1 (= първи пример в „Леко“): две перпендикулярни сили 30 и 40 kN", () => {
  const R = resultantOfConcurrent([
    { Fx: 30, Fy: 0 },
    { Fx: 0, Fy: 40 },
  ]);

  it("R = √(30² + 40²) = √2500 = 50 kN", () => {
    expect(R.value).toBeCloseTo(50, 12);
  });

  it("tg α = 40/30 = 1,3333 → α = 53,13°", () => {
    expect(R.angleDeg).toBeCloseTo(53.13, 2);
  });

  it("проверка с отпечатания ъгъл: 50·cos 53,13° = 30,00; 50·sin 53,13° = 40,00", () => {
    const back = forceComponents(50, 53.13);
    expect(back.Fx).toBeCloseTo(30, 2);
    expect(back.Fy).toBeCloseTo(40, 2);
  });
});

describe("пример П1: три сходящи сили 20 kN (0°), 30 kN (60°), 25 kN (150°)", () => {
  const F1 = forceComponents(20, 0);
  const F2 = forceComponents(30, 60);
  const F3 = forceComponents(25, 150);
  const R = resultantOfConcurrent([F1, F2, F3]);

  it("проекции на трите сили (таблицата в примера)", () => {
    // F1: 20; 0
    // F2: 30·0,5 = 15,000; 30·0,86603 = 25,981
    // F3: 25·(−0,86603) = −21,651; 25·0,5 = 12,500
    expect(F1.Fx).toBeCloseTo(20, 9);
    expect(F1.Fy).toBeCloseTo(0, 9);
    expect(F2.Fx).toBeCloseTo(15, 3);
    expect(F2.Fy).toBeCloseTo(25.981, 3);
    expect(F3.Fx).toBeCloseTo(-21.651, 3);
    expect(F3.Fy).toBeCloseTo(12.5, 3);
  });

  it("R_x = 20 + 15 − 21,651 = 13,349; R_y = 0 + 25,981 + 12,5 = 38,481", () => {
    expect(R.Fx).toBeCloseTo(13.349, 3);
    expect(R.Fy).toBeCloseTo(38.481, 3);
  });

  it("R = √(178,196 + 1480,787) = √1658,983 = 40,73 kN; α_R = 70,87°", () => {
    expect(R.value).toBeCloseTo(40.73, 2);
    expect(R.angleDeg).toBeCloseTo(70.87, 2);
  });

  it("от отпечатаните закръглени проекции излиза същият отпечатан резултат", () => {
    const printed = magnitudeAndAngle(13.349, 38.481);
    expect(printed.value).toBeCloseTo(40.73, 2);
    expect(printed.angleDeg).toBeCloseTo(70.87, 2);
  });

  it("проверката в примера: 40,73·cos 70,87° = 13,35; 40,73·sin 70,87° = 38,48", () => {
    const back = forceComponents(40.73, 70.87);
    expect(back.Fx).toBeCloseTo(13.35, 2);
    expect(back.Fy).toBeCloseTo(38.48, 2);
  });

  it("теорема на Вариньон: моментът на R е сборът от моментите на трите сили", () => {
    // общата точка е C(2; 1) m, моментът е спрямо P(−1; 4) m – произволни числа
    const C: Point = { x: 2, y: 1 };
    const P: Point = { x: -1, y: 4 };
    const sum = [F1, F2, F3]
      .map((force) => momentAboutPoint({ ...C, ...force }, P))
      .reduce((a, b) => a + b, 0);
    const ofResultant = momentAboutPoint({ ...C, Fx: R.Fx, Fy: R.Fy }, P);
    expect(ofResultant).toBeCloseTo(sum, 9);
    // на ръка: (2+1)·38,481 − (1−4)·13,349 = 115,443 + 40,047 = 155,49
    expect(ofResultant).toBeCloseTo(155.49, 2);
  });

  it("уравновесени сходящи сили: R = 0", () => {
    const balanced = resultantOfConcurrent([
      F1,
      F2,
      F3,
      { Fx: -R.Fx, Fy: -R.Fy },
    ]);
    expect(balanced.value).toBeCloseTo(0, 9);
  });

  it("отказва празен списък", () => {
    expect(() => resultantOfConcurrent([])).toThrow();
  });
});

describe("пример Л2 / П2: сила (40; 30) kN в A(2; 1) m", () => {
  const F: PlaneForce = { x: 2, y: 1, Fx: 40, Fy: 30 };
  const B: Point = { x: 5, y: 2 };

  it("M_O = 2·30 − 1·40 = 60 − 40 = +20 kN·m (обратно на часовниковата)", () => {
    expect(momentAboutPoint(F)).toBeCloseTo(20, 12);
    expect(momentAboutPoint(F, O)).toBeCloseTo(20, 12);
  });

  it("рамо спрямо O: d = 20 / 50 = 0,4 m; обратно 50·0,4 = 20", () => {
    expect(leverArm(F)).toBeCloseTo(0.4, 12);
    expect(coupleMoment(50, 0.4)).toBeCloseTo(20, 12);
  });

  it("M_B = (2−5)·30 − (1−2)·40 = −90 + 40 = −50 kN·m (по часовниковата); рамо 1,0 m", () => {
    expect(momentAboutPoint(F, B)).toBeCloseTo(-50, 12);
    expect(leverArm(F, B)).toBeCloseTo(1, 12);
  });

  it("независима геометрична проверка: разстояние от точка до правата 3x − 4y − 2 = 0", () => {
    // директрисата минава през (2; 1) с посока (0,8; 0,6): 3·2 − 4·1 − 2 = 0 ✓
    const distance = (p: Point) => Math.abs(3 * p.x - 4 * p.y - 2) / 5;
    expect(distance(O)).toBeCloseTo(0.4, 12); // |−2| / 5
    expect(distance(B)).toBeCloseTo(1, 12); // |15 − 8 − 2| / 5
    expect(leverArm(F, O)).toBeCloseTo(distance(O), 12);
    expect(leverArm(F, B)).toBeCloseTo(distance(B), 12);
  });

  it("плъзгане по директрисата не променя момента", () => {
    // 2,5 m напред по посоката (0,8; 0,6): A′ = (2 + 2; 1 + 1,5) = (4; 2,5)
    // M_O = 4·30 − 2,5·40 = 120 − 100 = 20
    const moved: PlaneForce = { ...F, x: 4, y: 2.5 };
    expect(momentAboutPoint(moved)).toBeCloseTo(20, 12);
    expect(momentAboutPoint(moved, B)).toBeCloseTo(-50, 12);
  });

  it("загадката в „Подробно“: същата сила, приложена в O, няма момент спрямо O", () => {
    expect(momentAboutPoint({ x: 0, y: 0, Fx: 40, Fy: 30 })).toBe(0);
  });

  it("точка върху директрисата: моментът е нула", () => {
    // (2/3; 0) лежи на 3x − 4y − 2 = 0
    expect(momentAboutPoint(F, { x: 2 / 3, y: 0 })).toBeCloseTo(0, 12);
  });

  it("нулева сила няма рамо", () => {
    expect(() => leverArm({ x: 1, y: 1, Fx: 0, Fy: 0 })).toThrow();
  });
});

describe("пример П3 и фигура „двоица“: 12 kN нагоре в (1; 0), 12 kN надолу в (0,5; 0)", () => {
  const up: PlaneForce = { x: 1, y: 0, Fx: 0, Fy: 12 };
  const down: PlaneForce = { x: 0.5, y: 0, Fx: 0, Fy: -12 };
  const about = (p: Point) =>
    momentAboutPoint(up, p) + momentAboutPoint(down, p);

  it("спрямо O: 1·12 + 0,5·(−12) = 12 − 6 = 6 kN·m", () => {
    expect(about(O)).toBeCloseTo(6, 12);
  });

  it("спрямо P(3; 2): (1−3)·12 + (0,5−3)·(−12) = −24 + 30 = 6 kN·m", () => {
    expect(about({ x: 3, y: 2 })).toBeCloseTo(6, 12);
  });

  it("по определение: 12·0,5 = 6 kN·m, обратно на часовниковата", () => {
    expect(coupleMoment(12, 0.5)).toBeCloseTo(6, 12);
    expect(coupleMomentOfForces(up, down)).toBeCloseTo(6, 12);
    // редът на двете сили не променя момента
    expect(coupleMomentOfForces(down, up)).toBeCloseTo(6, 12);
  });

  it("моментът на двоицата е един и същ спрямо всяка точка", () => {
    const points: Point[] = [
      { x: -7, y: 3 },
      { x: 0.75, y: 0 },
      { x: 100, y: -250 },
      { x: 5, y: 0 },
    ];
    for (const point of points) {
      expect(about(point)).toBeCloseTo(6, 9);
    }
  });

  it("сборът на двете сили е нула", () => {
    expect(resultantOfConcurrent([up, down]).value).toBe(0);
  });

  it("сили, които не са равни и противоположни, не са двоица", () => {
    expect(() =>
      coupleMomentOfForces(up, { x: 0.5, y: 0, Fx: 0, Fy: -10 }),
    ).toThrow();
    expect(() => coupleMomentOfForces(up, up)).toThrow();
  });

  it("наклонена двоица: (40; 30) в (2; 1) и (−40; −30) в (0; 0) → 2·30 − 1·40 = 20", () => {
    expect(
      coupleMomentOfForces(
        { x: 2, y: 1, Fx: 40, Fy: 30 },
        { x: 0, y: 0, Fx: -40, Fy: -30 },
      ),
    ).toBeCloseTo(20, 12);
  });

  it("coupleMoment: посока по часовниковата дава минус; отказва отрицателни входове", () => {
    expect(coupleMoment(12, 0.5, "cw")).toBeCloseTo(-6, 12);
    expect(() => coupleMoment(-1, 1)).toThrow();
    expect(() => coupleMoment(1, -1)).toThrow();
  });
});

describe("пример П4: сила 20 kN на 3 m от A, наклонена на 60° надолу и надясно", () => {
  // ъгъл спрямо оста x: −60°
  const F = forceFromAngle(20, -60, { x: 3, y: 0 });

  it("F_x = 20·cos 60° = 10,00 kN; F_y = −20·sin 60° = −17,32 kN", () => {
    expect(F.Fx).toBeCloseTo(10, 9);
    expect(F.Fy).toBeCloseTo(-17.32, 2);
  });

  it("M_A = 3·(−17,32) − 0·10 = −51,96 kN·m (по часовниковата)", () => {
    expect(momentAboutPoint(F)).toBeCloseTo(-51.96, 2);
    // с отпечатаната закръглена проекция: 3·17,32 = 51,96
    expect(3 * 17.32).toBeCloseTo(51.96, 9);
  });

  it("чрез рамото: d = 3·sin 60° = 2,598 m; 20·2,598 = 51,96 kN·m", () => {
    expect(leverArm(F)).toBeCloseTo(2.598, 3);
    expect(coupleMoment(20, 2.598, "cw")).toBeCloseTo(-51.96, 2);
  });

  it("хоризонталната съставка минава през A и няма момент", () => {
    expect(momentAboutPoint({ x: 3, y: 0, Fx: F.Fx, Fy: 0 })).toBeCloseTo(
      0,
      12,
    );
  });
});

describe("„В реалния живот“: кулокран и гаечен ключ", () => {
  // кулата е в началото; товарът е надясно, противотежестта – наляво
  const load = (x: number, value: number): PlaneForce => ({
    x,
    y: 0,
    Fx: 0,
    Fy: -value,
  });

  it("товар 20 kN на 30 m: 20·30 = 600 kN·m по часовниковата", () => {
    expect(momentAboutPoint(load(30, 20))).toBeCloseTo(-600, 12);
  });

  it("противотежест 100 kN на 6 m от другата страна: 100·6 = 600 kN·m обратно", () => {
    expect(momentAboutPoint(load(-6, 100))).toBeCloseTo(600, 12);
  });

  it("двата момента се уравновесяват: −600 + 600 = 0", () => {
    expect(
      momentAboutPoint(load(30, 20)) + momentAboutPoint(load(-6, 100)),
    ).toBeCloseTo(0, 12);
  });

  it("товарът на 40 m: 20·40 = 800 kN·m; остават 800 − 600 = 200 kN·m за кулата", () => {
    const moment = momentAboutPoint(load(40, 20));
    expect(moment).toBeCloseTo(-800, 12);
    expect(moment + momentAboutPoint(load(-6, 100))).toBeCloseTo(-200, 12);
  });

  it("„Подробно“: при допустим момент 600 kN·m на рамо 40 m товарът е 600/40 = 15 kN", () => {
    expect(600 / 40).toBe(15);
    expect(coupleMoment(15, 40)).toBeCloseTo(600, 12);
  });

  it("„Подробно“: ключ 0,2 kN на рамо 0,4 m → 0,08 kN·m = 80 N·m", () => {
    const moment = coupleMoment(0.2, 0.4);
    expect(moment).toBeCloseTo(0.08, 12);
    expect(moment * 1000).toBeCloseTo(80, 9);
  });
});

describe("въпроси от „Провери се“", () => {
  it("„Леко“ 1: 10 kN на рамо 0,3 m → 10·0,3 = 3 kN·m", () => {
    expect(coupleMoment(10, 0.3)).toBeCloseTo(3, 12);
  });

  it("„Леко“ 2: директрисата минава през O → момент нула", () => {
    // сила (6; 8) kN в (3; 4) m: 3·8 − 4·6 = 0
    expect(momentAboutPoint({ x: 3, y: 4, Fx: 6, Fy: 8 })).toBe(0);
  });

  it("„Леко“ 4: двоица 8 kN с рамо 0,25 m → 2 kN·m, и спрямо точка на 5 m встрани", () => {
    expect(coupleMoment(8, 0.25)).toBeCloseTo(2, 12);
    const up: PlaneForce = { x: 0.25, y: 0, Fx: 0, Fy: 8 };
    const down: PlaneForce = { x: 0, y: 0, Fx: 0, Fy: -8 };
    const far: Point = { x: 5, y: 0 };
    // (0,25−5)·8 + (0−5)·(−8) = −38 + 40 = 2
    expect(momentAboutPoint(up, far) + momentAboutPoint(down, far)).toBeCloseTo(
      2,
      12,
    );
  });

  it("„Подробно“ 1: (−12; 5) kN в A(3; 4) → M_O = 3·5 − 4·(−12) = 63; F = 13; d = 4,85 m", () => {
    const F: PlaneForce = { x: 3, y: 4, Fx: -12, Fy: 5 };
    expect(momentAboutPoint(F)).toBeCloseTo(63, 12);
    // √(144 + 25) = √169 = 13
    expect(magnitudeAndAngle(F.Fx, F.Fy).value).toBeCloseTo(13, 12);
    // 63/13 = 4,846
    expect(leverArm(F)).toBeCloseTo(4.85, 2);
  });

  it("„Подробно“ 2: сходящи (15; 0) и (0; −8) kN → R = √289 = 17 kN; α = −28,07°", () => {
    const R = resultantOfConcurrent([
      { Fx: 15, Fy: 0 },
      { Fx: 0, Fy: -8 },
    ]);
    expect(R.value).toBeCloseTo(17, 12);
    // tg α = −8/15 = −0,5333
    expect(R.angleDeg).toBeCloseTo(-28.07, 2);
  });

  it("„Подробно“ 4: двоица 20·0,4 = 8 kN·m обратно и 5 kN·m по часовниковата → +3 kN·m", () => {
    expect(coupleMoment(20, 0.4) + coupleMoment(5, 1, "cw")).toBeCloseTo(3, 12);
  });

  it("„Подробно“ 5: 25 kN надолу в (2; 0), спрямо B(6; 0): (2−6)·(−25) = +100 kN·m", () => {
    expect(
      momentAboutPoint({ x: 2, y: 0, Fx: 0, Fy: -25 }, { x: 6, y: 0 }),
    ).toBeCloseTo(100, 12);
  });
});

describe("проверка на входа", () => {
  it("моментът отказва безкрайни координати и проекции", () => {
    expect(() =>
      momentAboutPoint({ x: Number.NaN, y: 0, Fx: 1, Fy: 1 }),
    ).toThrow();
    expect(() =>
      momentAboutPoint({ x: 0, y: 0, Fx: 1, Fy: 1 }, { x: 0, y: Infinity }),
    ).toThrow();
    expect(() => resultantOfConcurrent([{ Fx: Number.NaN, Fy: 0 }])).toThrow();
  });
});
