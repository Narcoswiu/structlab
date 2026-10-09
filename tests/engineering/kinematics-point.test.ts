import { describe, expect, it } from "vitest";
import {
  circularMotion,
  curvatureRadius,
  differentiateLaw,
  harmonicMotion,
  integrateAcceleration,
  kmhToMs,
  magnitude2,
  naturalComponents,
  pathLength,
  stoppingDistance,
  uniformAcceleration,
  type Vec2,
} from "@/lib/engineering/kinematics-point";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над теста.
// Единици: m, s, m/s, m/s². Оста x е надясно, оста y е нагоре.
// a_τ е проекция върху посоката на скоростта (плюс – ускорително движение),
// a_n ≥ 0 сочи към центъра на кривината.

/** Скорост и ускорение от закона x(t), y(t) с числено диференциране. */
function numericState(
  x: (t: number) => number,
  y: (t: number) => number,
  t: number,
): { v: Vec2; a: Vec2 } {
  const dx = differentiateLaw(x, t);
  const dy = differentiateLaw(y, t);
  return {
    v: { x: dx.first, y: dy.first },
    a: { x: dx.second, y: dy.second },
  };
}

describe("Пример Л1 – спиране по права, x = 12t − 1,5t²", () => {
  const x = (t: number) => 12 * t - 1.5 * t * t;
  const v = (t: number) => 12 - 3 * t;

  // v = 12 − 3t; a = −3. При t = 2 s: x = 24 − 6 = 18 m; v = 12 − 6 = 6 m/s.
  it("положение и скорост при t = 2 s", () => {
    expect(x(2)).toBeCloseTo(18, 10);
    expect(v(2)).toBeCloseTo(6, 10);
    const state = uniformAcceleration({ x0: 0, v0: 12, a: -3, t: 2 });
    expect(state.x).toBeCloseTo(18, 10);
    expect(state.v).toBeCloseTo(6, 10);
  });

  // v = 0 при t = 12/3 = 4 s; x = 12·4 − 1,5·16 = 48 − 24 = 24 m.
  it("спира при t = 4 s на 24 m", () => {
    const state = uniformAcceleration({ x0: 0, v0: 12, a: -3, t: 4 });
    expect(state.v).toBeCloseTo(0, 10);
    expect(state.x).toBeCloseTo(24, 10);
    // същото от формулите за спиране: 12²/(2·3) = 24 m; 12/3 = 4 s
    const stop = stoppingDistance(12, 3);
    expect(stop.distance).toBeCloseTo(24, 10);
    expect(stop.time).toBeCloseTo(4, 10);
  });

  // Проверка без времето: v² = v0² + 2·a·x → 144 + 2·(−3)·24 = 0.
  it("формулата без времето", () => {
    expect(12 * 12 + 2 * -3 * 24).toBe(0);
  });

  it("скоростта и ускорението са числените производни на закона", () => {
    for (const t of [0.5, 2, 3.5]) {
      const d = differentiateLaw(x, t);
      expect(d.first).toBeCloseTo(v(t), 6);
      expect(d.second).toBeCloseTo(-3, 5);
    }
  });

  it("изминатият път е интегралът на |v|", () => {
    expect(pathLength(v, 0, 4)).toBeCloseTo(24, 8);
  });

  // „Подробно“, изминат път: ако законът важеше до t = 6 s,
  // x(6) = 72 − 54 = 18 m, а пътят е 24 + (24 − 18) = 30 m.
  it("път срещу координата при смяна на посоката (0–6 s)", () => {
    expect(x(6)).toBeCloseTo(18, 10);
    expect(pathLength(v, 0, 6, 6000)).toBeCloseTo(30, 4);
  });
});

describe("Пример П1 – координатен начин, x = 2t, y = 3 − t², t1 = 1,5 s", () => {
  const x = (t: number) => 2 * t;
  const y = (t: number) => 3 - t * t;
  const v: Vec2 = { x: 2, y: -3 }; // v_x = 2; v_y = −2·1,5 = −3
  const a: Vec2 = { x: 0, y: -2 };

  // x = 2·1,5 = 3 m; y = 3 − 2,25 = 0,75 m.
  it("положение", () => {
    expect(x(1.5)).toBeCloseTo(3, 10);
    expect(y(1.5)).toBeCloseTo(0.75, 10);
  });

  // Точките от фигурата: t = 0; 0,5; 1; 1,5 s → (0; 3), (1; 2,75), (2; 2), (3; 0,75).
  // Траектория y = 3 − x²/4.
  it("траекторията y = 3 − x²/4 се удовлетворява от закона", () => {
    const expected = [
      [0, 0, 3],
      [0.5, 1, 2.75],
      [1, 2, 2],
      [1.5, 3, 0.75],
    ] as const;
    for (const [t, px, py] of expected) {
      expect(x(t)).toBeCloseTo(px, 10);
      expect(y(t)).toBeCloseTo(py, 10);
    }
    for (const t of [0, 0.3, 0.9, 1.5, 1.7]) {
      expect(y(t)).toBeCloseTo(3 - x(t) ** 2 / 4, 10);
    }
    // краят на клона: y = 0 при x = √12 = 3,46 m
    expect(Math.sqrt(12)).toBeCloseTo(3.46, 2);
  });

  // v = √(4 + 9) = √13 = 3,606 m/s; a = 2 m/s².
  // a_τ = (2·0 + (−3)(−2))/3,606 = 6/3,606 = 1,664 m/s².
  // a_n = |2·(−2) − (−3)·0|/3,606 = 4/3,606 = 1,109 m/s².
  // ρ = 13/1,109 = 11,72 m.
  it("естествени съставки", () => {
    const n = naturalComponents(v, a);
    expect(n.speed).toBeCloseTo(3.606, 3);
    expect(n.acceleration).toBeCloseTo(2, 10);
    expect(n.aTau).toBeCloseTo(1.664, 3);
    expect(n.aN).toBeCloseTo(1.109, 3);
    expect(n.rho).toBeCloseTo(11.72, 2);
    // по-точните стойности от плана
    expect(n.speed).toBeCloseTo(3.6056, 4);
    expect(n.aTau).toBeCloseTo(1.6641, 4);
    expect(n.aN).toBeCloseTo(1.1094, 4);
    expect(n.rho).toBeCloseTo(11.718, 3);
  });

  // Закръгляне: с отпечатаните междинни числа читателят получава същото.
  it("отпечатаните междинни стойности дават отпечатаните резултати", () => {
    expect(6 / 3.606).toBeCloseTo(1.664, 3);
    expect(4 / 3.606).toBeCloseTo(1.109, 3);
    expect(13 / 1.109).toBeCloseTo(11.72, 2);
    expect(Math.hypot(1.664, 1.109)).toBeCloseTo(2.0, 3);
  });

  it("a² = a_τ² + a_n² и a_n = v²/ρ", () => {
    const n = naturalComponents(v, a);
    expect(n.aTau ** 2 + n.aN ** 2).toBeCloseTo(4, 10);
    expect(n.speed ** 2 / n.rho).toBeCloseTo(n.aN, 10);
  });

  // Геометрично: y' = −x/2 = −1,5; y'' = −0,5;
  // ρ = (1 + 2,25)^1,5 / 0,5 = 5,859/0,5 = 11,718 m.
  it("радиусът на кривината от формата на кривата", () => {
    expect(Math.pow(3.25, 1.5)).toBeCloseTo(5.859, 3);
    expect(curvatureRadius(-1.5, -0.5)).toBeCloseTo(11.718, 3);
    expect(curvatureRadius(-1.5, -0.5)).toBeCloseTo(
      naturalComponents(v, a).rho,
      10,
    );
  });

  // Загадката от „Подробно“: във върха y' = 0, ρ = 1/|y''| = 1/0,5 = 2 m –
  // най-малкият радиус. От закона при t = 0: v = (2; 0), a = (0; −2),
  // a_n = 4/2 = 2, ρ = 4/2 = 2 m. Отношение 11,72/2 = 5,86.
  it("върхът на параболата има най-малък радиус на кривината, 2 m", () => {
    expect(curvatureRadius(0, -0.5)).toBeCloseTo(2, 10);
    const top = naturalComponents({ x: 2, y: 0 }, { x: 0, y: -2 });
    expect(top.aTau).toBeCloseTo(0, 10);
    expect(top.aN).toBeCloseTo(2, 10);
    expect(top.rho).toBeCloseTo(2, 10);
    for (const px of [0.5, 1, 2, 3]) {
      expect(curvatureRadius(-px / 2, -0.5)).toBeGreaterThan(2);
    }
    expect(11.72 / 2).toBeCloseTo(5.86, 2);
  });

  it("скоростта и ускорението са числените производни на закона", () => {
    for (const t of [0.4, 1, 1.5]) {
      const s = numericState(x, y, t);
      expect(s.v.x).toBeCloseTo(2, 6);
      expect(s.v.y).toBeCloseTo(-2 * t, 6);
      expect(s.a.x).toBeCloseTo(0, 5);
      expect(s.a.y).toBeCloseTo(-2, 5);
    }
    const n = naturalComponents(
      numericState(x, y, 1.5).v,
      numericState(x, y, 1.5).a,
    );
    expect(n.aTau).toBeCloseTo(1.6641, 4);
    expect(n.aN).toBeCloseTo(1.1094, 4);
  });

  // a_τ е и производната на големината на скоростта v(t) = 2√(1 + t²).
  it("a_τ = dv/dt", () => {
    const speed = (t: number) => 2 * Math.sqrt(1 + t * t);
    expect(differentiateLaw(speed, 1.5).first).toBeCloseTo(1.6641, 4);
  });

  // Изминат път 0–1,5 s: ∫2√(1 + t²)dt = [t√(1 + t²) + arsinh t]
  //   = 1,5·1,8028 + 1,1948 = 2,7042 + 1,1948 = 3,899 m.
  it("изминат път от 0 до 1,5 s", () => {
    const speed = (t: number) => Math.hypot(2, -2 * t);
    const closed = 1.5 * Math.sqrt(3.25) + Math.asinh(1.5);
    expect(closed).toBeCloseTo(3.899, 3);
    expect(pathLength(speed, 0, 1.5)).toBeCloseTo(closed, 8);
  });
});

describe("Пример П2 – елипса, x = 4cos(0,5t), y = 3sin(0,5t), t1 = 1 s", () => {
  const x = (t: number) => 4 * Math.cos(0.5 * t);
  const y = (t: number) => 3 * Math.sin(0.5 * t);
  const C = Math.cos(0.5);
  const S = Math.sin(0.5);
  const v: Vec2 = { x: -2 * S, y: 1.5 * C };
  const a: Vec2 = { x: -C, y: -0.75 * S };

  // cos 0,5 = 0,8776; sin 0,5 = 0,4794 (аргументът е в rad).
  // x = 4·0,8776 = 3,510 m; y = 3·0,4794 = 1,438 m.
  it("положение", () => {
    expect(C).toBeCloseTo(0.8776, 4);
    expect(S).toBeCloseTo(0.4794, 4);
    expect(x(1)).toBeCloseTo(3.51, 3);
    expect(y(1)).toBeCloseTo(1.438, 3);
    expect(4 * 0.8776).toBeCloseTo(3.51, 3);
    expect(3 * 0.4794).toBeCloseTo(1.438, 3);
  });

  it("траекторията x²/16 + y²/9 = 1 се удовлетворява от закона", () => {
    for (const t of [0, 1, 2.5, 4, 9]) {
      expect(x(t) ** 2 / 16 + y(t) ** 2 / 9).toBeCloseTo(1, 10);
    }
  });

  // v_x = −2·0,4794 = −0,9589; v_y = 1,5·0,8776 = 1,3164;
  // v = √(0,9195 + 1,7329) = √2,6524 = 1,6286 m/s.
  // a_x = −0,8776; a_y = −0,75·0,4794 = −0,3596;
  // a = √(0,7702 + 0,1293) = √0,8995 = 0,9484 m/s².
  it("скорост и ускорение", () => {
    expect(v.x).toBeCloseTo(-0.9589, 4);
    expect(v.y).toBeCloseTo(1.3164, 4);
    expect(magnitude2(v)).toBeCloseTo(1.6286, 4);
    expect(a.x).toBeCloseTo(-0.8776, 4);
    expect(a.y).toBeCloseTo(-0.3596, 4);
    expect(magnitude2(a)).toBeCloseTo(0.9484, 4);
    // с отпечатаните проекции
    expect(Math.hypot(0.9589, 1.3164)).toBeCloseTo(1.6286, 4);
    expect(0.9589 ** 2).toBeCloseTo(0.9195, 4);
    expect(1.3164 ** 2).toBeCloseTo(1.7329, 4);
    expect(Math.hypot(0.8776, 0.3596)).toBeCloseTo(0.9484, 4);
    expect(0.8776 ** 2).toBeCloseTo(0.7702, 4);
    expect(0.3596 ** 2).toBeCloseTo(0.1293, 4);
  });

  // a = −0,25·r: ускорението сочи към центъра на елипсата.
  it("ускорението е −0,25 пъти радиус-вектора", () => {
    for (const t of [0.3, 1, 2.2]) {
      const s = numericState(x, y, t);
      expect(s.a.x).toBeCloseTo(-0.25 * x(t), 5);
      expect(s.a.y).toBeCloseTo(-0.25 * y(t), 5);
    }
    // a = 0,25·r: r = √(3,510² + 1,438²) = 3,793 m; 0,25·3,793 = 0,948 m/s²
    expect(Math.hypot(3.51, 1.438)).toBeCloseTo(3.793, 3);
    expect(0.25 * 3.793).toBeCloseTo(0.948, 3);
  });

  // v_x·a_x + v_y·a_y = 0,8415 − 0,4734 = 0,3681 → a_τ = 0,3681/1,6286 = 0,226.
  // (0,4734 = 1,3164·0,3596 с отпечатаните проекции; точната стойност е 0,47333.)
  // v_x·a_y − v_y·a_x = 0,3448 + 1,1552 = 1,500 → a_n = 1,5/1,6286 = 0,921.
  // ρ = 1,6286²/0,921 = 2,880 m.
  it("естествени съставки", () => {
    const n = naturalComponents(v, a);
    expect(v.x * a.x).toBeCloseTo(0.8415, 4);
    expect(v.y * a.y).toBeCloseTo(-0.4733, 4);
    expect(v.x * a.x + v.y * a.y).toBeCloseTo(0.3681, 4);
    expect(0.9589 * 0.8776).toBeCloseTo(0.8415, 4);
    expect(1.3164 * 0.3596).toBeCloseTo(0.4734, 4);
    expect(0.8415 - 0.4734).toBeCloseTo(0.3681, 10);
    expect(v.x * a.y).toBeCloseTo(0.3448, 4);
    expect(-v.y * a.x).toBeCloseTo(1.1552, 4);
    expect(v.x * a.y - v.y * a.x).toBeCloseTo(1.5, 10);
    expect(n.aTau).toBeCloseTo(0.226, 3);
    expect(n.aN).toBeCloseTo(0.921, 3);
    expect(n.aN).toBeCloseTo(0.9211, 4);
    expect(n.rho).toBeCloseTo(2.88, 3);
    // стойностите от плана
    expect(n.aTau).toBeCloseTo(0.2261, 4);
    expect(n.rho).toBeCloseTo(2.8796, 4);
    // с отпечатаните междинни числа
    expect(0.3681 / 1.6286).toBeCloseTo(0.226, 3);
    expect(1.5 / 1.6286).toBeCloseTo(0.921, 3);
    expect(1.6286 ** 2 / 0.921).toBeCloseTo(2.88, 3);
    // проверката в текста: √(0,226² + 0,921²) = 0,948
    expect(Math.hypot(0.226, 0.921)).toBeCloseTo(0.948, 3);
  });

  it("a² = a_τ² + a_n² и a_n = v²/ρ", () => {
    const n = naturalComponents(v, a);
    expect(n.aTau ** 2 + n.aN ** 2).toBeCloseTo(n.acceleration ** 2, 12);
    expect(n.speed ** 2 / n.rho).toBeCloseTo(n.aN, 12);
  });

  // v_x·a_y − v_y·a_x = 1,5 за всяко t (sin² + cos² = 1).
  it("v_x·a_y − v_y·a_x е постоянно", () => {
    for (const t of [0, 0.7, 1, 3, 5.5]) {
      const s = numericState(x, y, t);
      expect(s.v.x * s.a.y - s.v.y * s.a.x).toBeCloseTo(1.5, 5);
    }
  });

  it("скоростта и ускорението са числените производни на закона", () => {
    const s = numericState(x, y, 1);
    expect(s.v.x).toBeCloseTo(v.x, 6);
    expect(s.v.y).toBeCloseTo(v.y, 6);
    expect(s.a.x).toBeCloseTo(a.x, 5);
    expect(s.a.y).toBeCloseTo(a.y, 5);
  });

  // Върхове на елипсата (известни стойности):
  // t = 0, точка (4; 0): v = (0; 1,5), a = (−1; 0): ρ = 1,5³/1,5 = 2,25 = b²/a = 9/4.
  // t = π, точка (0; 3): v = (−2; 0), a = (0; −0,75): ρ = 2³/1,5 = 5,333 = a²/b = 16/3.
  it("радиус на кривината във върховете", () => {
    const vertex = naturalComponents({ x: 0, y: 1.5 }, { x: -1, y: 0 });
    // в текста: v = 1,5 m/s, a_n = 1,5/1,5 = 1 m/s², ρ = 2,25/1 = 2,25 m
    expect(vertex.speed).toBeCloseTo(1.5, 10);
    expect(vertex.aN).toBeCloseTo(1, 10);
    expect(vertex.rho).toBeCloseTo(2.25, 10);
    expect(
      naturalComponents({ x: -2, y: 0 }, { x: 0, y: -0.75 }).rho,
    ).toBeCloseTo(5.333, 3);
    expect(9 / 4).toBe(2.25);
    expect(16 / 3).toBeCloseTo(5.333, 3);
  });

  it("изминатият път е интегралът на |v| (сверка с дължината на хордите)", () => {
    const speed = (t: number) =>
      Math.hypot(-2 * Math.sin(0.5 * t), 1.5 * Math.cos(0.5 * t));
    // независимо: дължина на начупена линия от 20 000 хорди по траекторията
    let chord = 0;
    const n = 20000;
    for (let i = 0; i < n; i += 1) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      chord += Math.hypot(x(t1) - x(t0), y(t1) - y(t0));
    }
    expect(pathLength(speed, 0, 1)).toBeCloseTo(chord, 7);
  });
});

describe("Пример П3 (= Л2) – естествен начин, R = 8 m, s = 2t + 0,5t³, t1 = 2 s", () => {
  const R = 8;
  const s = (t: number) => 2 * t + 0.5 * t ** 3;

  // s = 4 + 4 = 8 m; ъгъл s/R = 1 rad = 57,3°.
  it("дъгова координата и централен ъгъл", () => {
    expect(s(2)).toBeCloseTo(8, 10);
    expect(s(2) / R).toBeCloseTo(1, 10);
    expect((180 / Math.PI) * 1).toBeCloseTo(57.3, 1);
  });

  // v = 2 + 1,5t² = 2 + 6 = 8 m/s; a_τ = 3t = 6 m/s²;
  // a_n = 8²/8 = 8 m/s²; a = √(36 + 64) = 10 m/s².
  it("скорост и ускорение", () => {
    const d = differentiateLaw(s, 2);
    expect(d.first).toBeCloseTo(8, 6);
    expect(d.second).toBeCloseTo(6, 5);
    const c = circularMotion({ R, v: 8, aTau: 6 });
    expect(c.aN).toBeCloseTo(8, 10);
    expect(c.a).toBeCloseTo(10, 10);
  });

  // Ъгъл между ускорението и скоростта: tg = a_n/a_τ = 8/6 → 53,1°.
  it("ъгъл между ускорението и допирателната", () => {
    expect((Math.atan2(8, 6) * 180) / Math.PI).toBeCloseTo(53.1, 1);
  });

  // Независимо: същото движение в декартови координати
  // x = 8cos(s/8), y = 8sin(s/8) – обратно на часовниковата стрелка от (8; 0).
  it("сверка с декартовия запис на същото движение", () => {
    const x = (t: number) => R * Math.cos(s(t) / R);
    const y = (t: number) => R * Math.sin(s(t) / R);
    const state = numericState(x, y, 2);
    const n = naturalComponents(state.v, state.a);
    expect(n.speed).toBeCloseTo(8, 5);
    expect(n.acceleration).toBeCloseTo(10, 4);
    expect(n.aTau).toBeCloseTo(6, 4);
    expect(n.aN).toBeCloseTo(8, 4);
    expect(n.rho).toBeCloseTo(8, 4);
    // положението на фигурата: (8cos 1; 8sin 1) = (4,32; 6,73) m
    expect(x(2)).toBeCloseTo(4.32, 2);
    expect(y(2)).toBeCloseTo(6.73, 2);
    // скоростта е перпендикулярна на радиуса и сочи обратно на часовниковата стрелка
    expect(state.v.x * x(2) + state.v.y * y(2)).toBeCloseTo(0, 4);
    expect(x(2) * state.v.y - y(2) * state.v.x).toBeGreaterThan(0);
  });

  it("изминатият път е интегралът на |v| и е равен на s(2) − s(0)", () => {
    expect(pathLength((t) => 2 + 1.5 * t * t, 0, 2)).toBeCloseTo(8, 8);
  });
});

describe("Пример П4 – обратна задача, a = 3 − 0,5t, от покой", () => {
  const a = (t: number) => 3 - 0.5 * t;
  const v = (t: number) => 3 * t - 0.25 * t * t;
  const x = (t: number) => 1.5 * t * t - t ** 3 / 12;

  // t = 6 s: v = 18 − 9 = 9 m/s; x = 54 − 216/12 = 54 − 18 = 36 m; a(6) = 0.
  it("скорост и координата при t = 6 s", () => {
    expect(v(6)).toBeCloseTo(9, 10);
    expect(x(6)).toBeCloseTo(36, 10);
    expect(a(6)).toBeCloseTo(0, 10);
    const r = integrateAcceleration(a, { x0: 0, v0: 0, t: 6 });
    expect(r.v).toBeCloseTo(9, 6);
    expect(r.x).toBeCloseTo(36, 6);
  });

  // t = 3 s: v = 9 − 2,25 = 6,75 m/s; x = 13,5 − 27/12 = 13,5 − 2,25 = 11,25 m.
  it("скорост и координата при t = 3 s", () => {
    expect(v(3)).toBeCloseTo(6.75, 10);
    expect(x(3)).toBeCloseTo(11.25, 10);
    const r = integrateAcceleration(a, { x0: 0, v0: 0, t: 3 });
    expect(r.v).toBeCloseTo(6.75, 6);
    expect(r.x).toBeCloseTo(11.25, 6);
  });

  it("производните на получения закон връщат даденото ускорение", () => {
    for (const t of [1, 3, 5]) {
      const d = differentiateLaw(x, t);
      expect(d.first).toBeCloseTo(v(t), 6);
      expect(d.second).toBeCloseTo(a(t), 5);
    }
  });

  it("изминатият път е интегралът на |v|", () => {
    expect(pathLength(v, 0, 6)).toBeCloseTo(36, 8);
  });

  it("началните условия влизат като константи", () => {
    // същото ускорение, но x0 = 5 m, v0 = 2 m/s: v(6) = 2 + 9 = 11; x(6) = 5 + 12 + 36 = 53
    const r = integrateAcceleration(a, { x0: 5, v0: 2, t: 6 });
    expect(r.v).toBeCloseTo(11, 6);
    expect(r.x).toBeCloseTo(53, 6);
  });
});

describe("В реалния живот", () => {
  // Влак: 90 km/h = 90/3,6 = 25 m/s; R = 500 m: a_n = 625/500 = 1,25 m/s²;
  // 1,25/9,81 = 0,127 ≈ 0,13 от g. При R = 250 m: 625/250 = 2,5 m/s².
  it("влак в крива", () => {
    expect(kmhToMs(90)).toBeCloseTo(25, 10);
    expect(circularMotion({ R: 500, v: 25, aTau: 0 }).aN).toBeCloseTo(1.25, 10);
    expect(circularMotion({ R: 500, v: 25, aTau: 0 }).a).toBeCloseTo(1.25, 10);
    expect(1.25 / 9.81).toBeCloseTo(0.13, 2);
    expect(circularMotion({ R: 250, v: 25, aTau: 0 }).aN).toBeCloseTo(2.5, 10);
  });

  // Спиране със закъснение 6 m/s² (дадено):
  // 50 km/h = 13,889 m/s: 13,889²/12 = 192,90/12 = 16,08 m; 13,889/6 = 2,31 s.
  // 100 km/h = 27,778 m/s: 27,778²/12 = 771,62/12 = 64,30 m; 27,778/6 = 4,63 s.
  it("спирачен път от 50 и от 100 km/h", () => {
    expect(kmhToMs(50)).toBeCloseTo(13.889, 3);
    expect(kmhToMs(100)).toBeCloseTo(27.778, 3);
    const slow = stoppingDistance(kmhToMs(50), 6);
    expect(slow.distance).toBeCloseTo(16.08, 2);
    expect(slow.time).toBeCloseTo(2.31, 2);
    const fast = stoppingDistance(kmhToMs(100), 6);
    expect(fast.distance).toBeCloseTo(64.3, 2);
    expect(fast.time).toBeCloseTo(4.63, 2);
    expect(fast.distance / slow.distance).toBeCloseTo(4, 10);
    // с отпечатаните междинни числа
    expect(13.889 ** 2).toBeCloseTo(192.9, 1);
    expect(192.9 / 12).toBeCloseTo(16.08, 2);
    expect(13.889 / 6).toBeCloseTo(2.31, 2);
    expect(27.778 ** 2).toBeCloseTo(771.62, 2);
    expect(771.62 / 12).toBeCloseTo(64.3, 2);
    expect(27.778 / 6).toBeCloseTo(4.63, 2);
  });
});

describe("Провери се – „Леко“", () => {
  // 1. x = 5t²: v = 10t = 20 m/s при t = 2 s; a = 10 m/s².
  it("въпрос 1", () => {
    const d = differentiateLaw((t) => 5 * t * t, 2);
    expect(d.first).toBeCloseTo(20, 6);
    expect(d.second).toBeCloseTo(10, 5);
  });

  // 2. R = 20 m, v = 10 m/s постоянна: a_τ = 0; a_n = 100/20 = 5 m/s².
  it("въпрос 2", () => {
    const c = circularMotion({ R: 20, v: 10, aTau: 0 });
    expect(c.aN).toBeCloseTo(5, 10);
    expect(c.a).toBeCloseTo(5, 10);
  });

  // 3. От покой с a = 2 m/s², t = 5 s: v = 2·5 = 10 m/s; x = ½·2·25 = 25 m.
  it("въпрос 3", () => {
    const r = uniformAcceleration({ x0: 0, v0: 0, a: 2, t: 5 });
    expect(r.v).toBeCloseTo(10, 10);
    expect(r.x).toBeCloseTo(25, 10);
  });
});

describe("Провери се – „Подробно“", () => {
  // 1. x = 3t, y = 4t − 5t², t = 0,4 s: v = (3; 4 − 4) = (3; 0); a = (0; −10).
  //    a_τ = 0; a_n = |3·(−10) − 0|/3 = 10 m/s²; ρ = 9/10 = 0,9 m.
  it("въпрос 1", () => {
    const state = numericState(
      (t) => 3 * t,
      (t) => 4 * t - 5 * t * t,
      0.4,
    );
    expect(state.v.x).toBeCloseTo(3, 6);
    expect(state.v.y).toBeCloseTo(0, 6);
    expect(state.a.y).toBeCloseTo(-10, 5);
    const n = naturalComponents({ x: 3, y: 0 }, { x: 0, y: -10 });
    expect(n.aTau).toBeCloseTo(0, 10);
    expect(n.aN).toBeCloseTo(10, 10);
    expect(n.rho).toBeCloseTo(0.9, 10);
  });

  // 2. s = 3t², R = 6 m, t = 1 s: v = 6t = 6; a_τ = 6; a_n = 36/6 = 6;
  //    a = √(36 + 36) = √72 = 8,49 m/s².
  it("въпрос 2", () => {
    const d = differentiateLaw((t) => 3 * t * t, 1);
    expect(d.first).toBeCloseTo(6, 6);
    expect(d.second).toBeCloseTo(6, 5);
    const c = circularMotion({ R: 6, v: 6, aTau: 6 });
    expect(c.aN).toBeCloseTo(6, 10);
    expect(c.a).toBeCloseTo(8.49, 2);
  });

  // 3. x = 0,2sin(5t): v_max = 0,2·5 = 1 m/s; a_max = 0,2·25 = 5 m/s².
  it("въпрос 3", () => {
    const h = harmonicMotion({ A: 0.2, k: 5 });
    expect(h.vMax).toBeCloseTo(1, 10);
    expect(h.aMax).toBeCloseTo(5, 10);
    // сверка с числените производни: v(0) = v_max, a при 5t = π/2 е −a_max
    const law = (t: number) => 0.2 * Math.sin(5 * t);
    expect(differentiateLaw(law, 0).first).toBeCloseTo(1, 5);
    expect(differentiateLaw(law, Math.PI / 10).second).toBeCloseTo(-5, 4);
    // a = −k²·x във всеки момент
    for (const t of [0.1, 0.37, 1.2]) {
      expect(differentiateLaw(law, t).second).toBeCloseTo(-25 * law(t), 4);
    }
    // T0 = 2π/5 = 6,2832/5 = 1,257 s
    expect(h.period).toBeCloseTo(1.257, 3);
  });

  // 4. a = 4 − 2t, v0 = 3: v = 3 + 4t − t² → v(3) = 3 + 12 − 9 = 6 m/s;
  //    Δx = 3t + 2t² − t³/3 → 9 + 18 − 9 = 18 m. Скоростта не сменя знака си
  //    в [0; 3] (нулата ѝ е при t = 2 + √7 = 4,65 s), затова пътят е също 18 m.
  it("въпрос 4", () => {
    const r = integrateAcceleration((t) => 4 - 2 * t, { x0: 0, v0: 3, t: 3 });
    expect(r.v).toBeCloseTo(6, 6);
    expect(r.x).toBeCloseTo(18, 6);
    expect(2 + Math.sqrt(7)).toBeGreaterThan(3);
    expect(pathLength((t) => 3 + 4 * t - t * t, 0, 3)).toBeCloseTo(18, 8);
  });

  // 5. v_x·a_x + v_y·a_y < 0 → a_τ < 0: големината на скоростта намалява.
  //    Пример: v = (2; 3), a = (0; −2): a_τ = −6/3,606 = −1,664.
  it("въпрос 5", () => {
    const n = naturalComponents({ x: 2, y: 3 }, { x: 0, y: -2 });
    expect(n.aTau).toBeCloseTo(-1.664, 3);
    expect(n.aN).toBeCloseTo(1.109, 3);
    // числено: големината на скоростта при x = 2t, y = 3t − t² в t = 0 намалява
    const speed = (t: number) => Math.hypot(2, 3 - 2 * t);
    expect(differentiateLaw(speed, 0).first).toBeLessThan(0);
  });
});

describe("Гранични случаи и проверка на входа", () => {
  it("при v = 0 естествените съставки не са определени", () => {
    expect(() => naturalComponents({ x: 0, y: 0 }, { x: 1, y: 2 })).toThrow();
  });

  // Праволинейно: v = (2; 0), a = (1; 0) → a_τ = 1, a_n = 0, ρ = ∞.
  it("праволинейно движение: a_n = 0, ρ = Infinity", () => {
    const n = naturalComponents({ x: 2, y: 0 }, { x: 1, y: 0 });
    expect(n.aTau).toBeCloseTo(1, 10);
    expect(n.aN).toBe(0);
    expect(n.rho).toBe(Infinity);
    expect(curvatureRadius(0.7, 0)).toBe(Infinity);
  });

  // Окръжност y = √(R² − x²) с R = 5 в x = 3: y = 4; y' = −3/4; y'' = −25/64;
  // ρ = (1 + 9/16)^1,5 / (25/64) = (125/64)/(25/64) = 5.
  it("радиусът на кривината на окръжност е радиусът ѝ", () => {
    expect(curvatureRadius(-3 / 4, -25 / 64)).toBeCloseTo(5, 10);
  });

  it("невалиден вход хвърля грешка", () => {
    expect(() => naturalComponents({ x: NaN, y: 0 }, { x: 0, y: 0 })).toThrow();
    expect(() => uniformAcceleration({ x0: 0, v0: 1, a: 1, t: -1 })).toThrow();
    expect(() => stoppingDistance(10, 0)).toThrow();
    expect(() => stoppingDistance(-1, 6)).toThrow();
    expect(() => circularMotion({ R: 0, v: 1, aTau: 0 })).toThrow();
    expect(() => harmonicMotion({ A: 1, k: 0 })).toThrow();
    expect(() =>
      integrateAcceleration(() => 1, { x0: 0, v0: 0, t: 1, steps: 0 }),
    ).toThrow();
    expect(() => pathLength(() => 1, 2, 1)).toThrow();
    expect(() => differentiateLaw((t) => t, 0, 0)).toThrow();
    expect(() => kmhToMs(Infinity)).toThrow();
  });
});
