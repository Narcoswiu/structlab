import { describe, expect, it } from "vitest";
import { navierStress } from "@/lib/engineering/bending";
import { sectionProperties, type Rect } from "@/lib/engineering/section";
import { maxShearStress, shearStressAt } from "@/lib/engineering/shear";
import {
  beamPointState,
  mohrCircle,
  principalStresses,
  rotateStressState,
  stressOnPlane,
  type PlaneStress,
} from "@/lib/engineering/stress-state";

// Всички очаквани стойности са сметнати на ръка; сметката е в коментара над проверката.
// Числата са тези, които се четат в Глава 11 „Напрегнато състояние в точка“.
// Напреженията са в MPa, ъглите – в градуси. Знаци: σ > 0 е опън; τ_xy > 0,
// когато върху стената с нормала +x сочи към +y; α е от оста x, обратно на
// часовниковата стрелка.

const DEG = Math.PI / 180;

/**
 * Независима проверка без формулите с двойния ъгъл: векторът на напрежението
 * върху площадката е p = S·n; σ_α е проекцията му върху n = (cos α, sin α),
 * τ_α – върху t = (−sin α, cos α).
 */
function byProjection(state: PlaneStress, alphaDeg: number) {
  const n = [Math.cos(alphaDeg * DEG), Math.sin(alphaDeg * DEG)] as const;
  const t = [-n[1], n[0]] as const;
  const p = [
    state.sx * n[0] + state.txy * n[1],
    state.txy * n[0] + state.sy * n[1],
  ] as const;
  return {
    sigma: p[0] * n[0] + p[1] * n[1],
    tau: p[0] * t[0] + p[1] * t[1],
  };
}

/** Състоянията, които се срещат в главата – за общите проверки. */
const STATES: PlaneStress[] = [
  { sx: 50, sy: -10, txy: 40 },
  { sx: 80, sy: -40, txy: 30 },
  { sx: 70, sy: 10, txy: 40 },
  { sx: 40, sy: -60, txy: -30 },
  { sx: 106.15, sy: 0, txy: -34.02 },
  { sx: 8, sy: 0, txy: 3 },
  { sx: 0, sy: 0, txy: 25 },
  { sx: 120, sy: 0, txy: 0 },
  { sx: -35, sy: 55, txy: 12 },
];

describe("напрежения върху наклонена площадка", () => {
  it("при α = 0 и α = 90° се получават дадените напрежения", () => {
    const state = { sx: 50, sy: -10, txy: 40 };
    expect(stressOnPlane(state, 0).sigma).toBeCloseTo(50, 12);
    expect(stressOnPlane(state, 0).tau).toBeCloseTo(40, 12);
    // върху стената с нормала +y посоката t сочи към −x, затова τ_90 = −τ_xy
    expect(stressOnPlane(state, 90).sigma).toBeCloseTo(-10, 12);
    expect(stressOnPlane(state, 90).tau).toBeCloseTo(-40, 12);
  });

  it("формулите с двойния ъгъл съвпадат с проекциите на p = S·n", () => {
    for (const state of STATES) {
      for (const alpha of [-75, -30, 0, 13.28, 26.57, 30, 45, 60, 120, 200]) {
        const direct = stressOnPlane(state, alpha);
        const check = byProjection(state, alpha);
        expect(direct.sigma).toBeCloseTo(check.sigma, 9);
        expect(direct.tau).toBeCloseTo(check.tau, 9);
      }
    }
  });

  it("σ_α + σ_(α+90°) = σ_x + σ_y, а τ_(α+90°) = −τ_α (взаимност)", () => {
    for (const state of STATES) {
      for (const alpha of [-40, 0, 17, 30, 45, 88]) {
        const a = stressOnPlane(state, alpha);
        const b = stressOnPlane(state, alpha + 90);
        expect(a.sigma + b.sigma).toBeCloseTo(state.sx + state.sy, 9);
        expect(b.tau).toBeCloseTo(-a.tau, 9);
      }
    }
  });

  it("площадка, завъртяна на 180°, е същата площадка", () => {
    const state = { sx: 80, sy: -40, txy: 30 };
    const a = stressOnPlane(state, 30);
    const b = stressOnPlane(state, 210);
    expect(b.sigma).toBeCloseTo(a.sigma, 9);
    expect(b.tau).toBeCloseTo(a.tau, 9);
  });
});

describe("общи свойства на главните напрежения", () => {
  it("σ_1 + σ_2 = σ_x + σ_y (първи инвариант)", () => {
    for (const state of STATES) {
      const p = principalStresses(state);
      expect(p.sigma1 + p.sigma2).toBeCloseTo(state.sx + state.sy, 9);
      expect(p.sigma1).toBeGreaterThanOrEqual(p.sigma2);
    }
  });

  it("σ_1·σ_2 = σ_x·σ_y − τ_xy² (втори инвариант)", () => {
    for (const state of STATES) {
      const p = principalStresses(state);
      expect(p.sigma1 * p.sigma2).toBeCloseTo(
        state.sx * state.sy - state.txy ** 2,
        8,
      );
    }
  });

  it("завъртане на главния ъгъл: τ = 0, а върху стените са σ_1 и σ_2", () => {
    for (const state of STATES) {
      const p = principalStresses(state);
      const rotated = rotateStressState(state, p.alpha1);
      expect(rotated.txy).toBeCloseTo(0, 9);
      expect(rotated.sx).toBeCloseTo(p.sigma1, 9);
      expect(rotated.sy).toBeCloseTo(p.sigma2, 9);
    }
  });

  it("центърът и радиусът на окръжността на Мор дават σ_1, σ_2 и τ_max", () => {
    for (const state of STATES) {
      const { center, radius } = mohrCircle(state);
      const p = principalStresses(state);
      expect(center + radius).toBeCloseTo(p.sigma1, 12);
      expect(center - radius).toBeCloseTo(p.sigma2, 12);
      expect(radius).toBeCloseTo(p.tauMax, 12);
      expect((p.sigma1 - p.sigma2) / 2).toBeCloseTo(p.tauMax, 12);
    }
  });

  it("всяка площадка лежи на окръжността: (σ_α − c)² + τ_α² = R²", () => {
    for (const state of STATES) {
      const { center, radius } = mohrCircle(state);
      for (const alpha of [-60, -10, 0, 25, 45, 70, 135]) {
        const { sigma, tau } = stressOnPlane(state, alpha);
        expect(Math.hypot(sigma - center, tau)).toBeCloseTo(radius, 9);
      }
    }
  });

  it("върху площадката α_1 − 45° действат +τ_max и средното нормално напрежение", () => {
    for (const state of STATES) {
      const p = principalStresses(state);
      const plane = stressOnPlane(state, p.alphaTauMax);
      expect(plane.tau).toBeCloseTo(p.tauMax, 9);
      expect(plane.sigma).toBeCloseTo((state.sx + state.sy) / 2, 9);
      // върху α_1 + 45° знакът е обратен
      expect(stressOnPlane(state, p.alpha1 + 45).tau).toBeCloseTo(-p.tauMax, 9);
    }
  });

  it("никоя площадка няма по-голямо σ от σ_1, по-малко от σ_2 или |τ| над τ_max", () => {
    for (const state of STATES) {
      const p = principalStresses(state);
      for (let alpha = 0; alpha < 180; alpha += 0.5) {
        const { sigma, tau } = stressOnPlane(state, alpha);
        expect(sigma).toBeLessThanOrEqual(p.sigma1 + 1e-9);
        expect(sigma).toBeGreaterThanOrEqual(p.sigma2 - 1e-9);
        expect(Math.abs(tau)).toBeLessThanOrEqual(p.tauMax + 1e-9);
      }
    }
  });

  it("tg α_1 = (σ_1 − σ_x) / τ_xy – независима проверка на посоката на σ_1", () => {
    for (const state of STATES.filter((s) => s.txy !== 0)) {
      const p = principalStresses(state);
      expect(Math.tan(p.alpha1 * DEG)).toBeCloseTo(
        (p.sigma1 - state.sx) / state.txy,
        9,
      );
    }
  });

  it("при σ_x > σ_y главната стойност на arctg дава посоката на σ_1, при σ_x < σ_y – на σ_2", () => {
    // σ_x > σ_y
    const a = { sx: 80, sy: -40, txy: 30 };
    const alphaA = (0.5 * Math.atan((2 * a.txy) / (a.sx - a.sy))) / DEG;
    expect(principalStresses(a).alpha1).toBeCloseTo(alphaA, 9);
    // σ_x < σ_y: същата формула дава посоката на σ_2
    const b = { sx: -40, sy: 80, txy: 30 };
    const alphaB = (0.5 * Math.atan((2 * b.txy) / (b.sx - b.sy))) / DEG;
    expect(stressOnPlane(b, alphaB).sigma).toBeCloseTo(
      principalStresses(b).sigma2,
      9,
    );
  });
});

describe("частни случаи", () => {
  it("чисто срязване: σ_1 = τ, σ_2 = −τ, под 45°", () => {
    const p = principalStresses({ sx: 0, sy: 0, txy: 25 });
    // c = 0; R = 25 → σ_1 = 25, σ_2 = −25
    expect(p.sigma1).toBeCloseTo(25, 12);
    expect(p.sigma2).toBeCloseTo(-25, 12);
    expect(p.alpha1).toBeCloseTo(45, 12);
    expect(p.tauMax).toBeCloseTo(25, 12);
    // σ_α = τ·sin 2α: при 45° → +25 (опън), при 135° → −25 (натиск)
    expect(stressOnPlane({ sx: 0, sy: 0, txy: 25 }, 45).sigma).toBeCloseTo(
      25,
      12,
    );
    expect(stressOnPlane({ sx: 0, sy: 0, txy: 25 }, 135).sigma).toBeCloseTo(
      -25,
      12,
    );
    // при τ_xy < 0 опънът е по −45°
    expect(principalStresses({ sx: 0, sy: 0, txy: -25 }).alpha1).toBeCloseTo(
      -45,
      12,
    );
  });

  it("едноосен опън: σ_1 = σ, σ_2 = 0, τ_max = σ/2 под 45°", () => {
    const state = { sx: 120, sy: 0, txy: 0 };
    const p = principalStresses(state);
    expect(p.sigma1).toBeCloseTo(120, 12);
    expect(p.sigma2).toBeCloseTo(0, 12);
    expect(p.alpha1).toBeCloseTo(0, 12);
    // „Леко“, въпрос 3: τ_max = 120/2 = 60 MPa
    expect(p.tauMax).toBeCloseTo(60, 12);
    expect(Math.abs(stressOnPlane(state, 45).tau)).toBeCloseTo(60, 12);
    expect(stressOnPlane(state, 45).sigma).toBeCloseTo(60, 12);
    // σ_α = σ·cos²α и τ_α = −(σ/2)·sin 2α за произволен ъгъл
    for (const alpha of [10, 30, 45, 70]) {
      const plane = stressOnPlane(state, alpha);
      expect(plane.sigma).toBeCloseTo(120 * Math.cos(alpha * DEG) ** 2, 9);
      expect(plane.tau).toBeCloseTo(-60 * Math.sin(2 * alpha * DEG), 9);
    }
  });

  it("σ_x = σ_y и τ_xy = 0: окръжността е точка, всяка площадка е главна", () => {
    const state = { sx: 30, sy: 30, txy: 0 };
    expect(mohrCircle(state)).toEqual({ center: 30, radius: 0 });
    expect(principalStresses(state).alpha1).toBe(0);
    for (const alpha of [0, 20, 45, 100]) {
      expect(stressOnPlane(state, alpha).sigma).toBeCloseTo(30, 12);
      expect(stressOnPlane(state, alpha).tau).toBeCloseTo(0, 12);
    }
  });
});

describe("„Леко“, решен пример (и Пример 2 в „Подробно“): σ_x = 50, σ_y = −10, τ_xy = 40 MPa", () => {
  const state = { sx: 50, sy: -10, txy: 40 };
  const p = principalStresses(state);

  it("център 20, радиус 50", () => {
    // c = (50 − 10)/2 = 20; полуразлика (50 + 10)/2 = 30; R = √(30² + 40²) = √2500 = 50
    expect(mohrCircle(state).center).toBeCloseTo(20, 12);
    expect(mohrCircle(state).radius).toBeCloseTo(50, 12);
  });

  it("σ_1 = 70, σ_2 = −30, τ_max = 50 MPa", () => {
    // 20 + 50 = 70; 20 − 50 = −30; (70 + 30)/2 = 50
    expect(p.sigma1).toBeCloseTo(70, 12);
    expect(p.sigma2).toBeCloseTo(-30, 12);
    expect(p.tauMax).toBeCloseTo(50, 12);
    // проверки от текста: 70 − 30 = 50 − 10; 70·(−30) = 50·(−10) − 40² = −2100
    expect(p.sigma1 + p.sigma2).toBeCloseTo(40, 12);
    expect(p.sigma1 * p.sigma2).toBeCloseTo(-2100, 9);
  });

  it("tg 2α_0 = 80/60 = 1,333 → 2α_0 = 53,13°, α_0 = 26,57°", () => {
    expect(((2 * 40) / (50 + 10)).toFixed(3)).toBe("1.333");
    expect((2 * p.alpha1).toFixed(2)).toBe("53.13");
    expect(p.alpha1.toFixed(2)).toBe("26.57");
    // tg α_1 = (70 − 50)/40 = 0,5
    expect(Math.tan(p.alpha1 * DEG)).toBeCloseTo(0.5, 12);
    // втората главна площадка: 26,57 + 90 = 116,57°
    expect(stressOnPlane(state, p.alpha1 + 90).sigma).toBeCloseTo(-30, 9);
  });

  it("с печатания ъгъл 26,57° площадката е главна до стотните", () => {
    const plane = stressOnPlane(state, 26.57);
    expect(plane.sigma.toFixed(2)).toBe("70.00");
    expect(Math.abs(plane.tau)).toBeLessThan(0.01);
  });

  it("елементът, завъртян на 26,57° − 45° = −18,43°: τ = 50, σ = 20 върху всички стени", () => {
    expect(p.alphaTauMax.toFixed(2)).toBe("-18.43");
    const rotated = rotateStressState(state, p.alphaTauMax);
    expect(rotated.txy).toBeCloseTo(50, 9);
    expect(rotated.sx).toBeCloseTo(20, 9);
    expect(rotated.sy).toBeCloseTo(20, 9);
  });

  it("точките X(50; 40) и Y(−10; −40) са краища на диаметър", () => {
    const X = stressOnPlane(state, 0);
    const Y = stressOnPlane(state, 90);
    expect([X.sigma, X.tau].map((v) => Math.round(v))).toEqual([50, 40]);
    expect([Y.sigma, Y.tau].map((v) => Math.round(v))).toEqual([-10, -40]);
    expect((X.sigma + Y.sigma) / 2).toBeCloseTo(20, 12);
    expect(Math.hypot(X.sigma - Y.sigma, X.tau - Y.tau)).toBeCloseTo(100, 9);
  });
});

describe("„Леко“, въпроси", () => {
  it("въпрос 1: чисто срязване τ = 25 MPa → 25 и −25 MPa под 45°", () => {
    const p = principalStresses({ sx: 0, sy: 0, txy: 25 });
    expect([p.sigma1, p.sigma2, p.alpha1]).toEqual([25, -25, 45]);
  });

  it("въпрос 2: σ_x = 70, σ_y = 10, τ_xy = 40 → 90, −10 и τ_max = 50 MPa", () => {
    // c = (70 + 10)/2 = 40; полуразлика 30; R = √(30² + 40²) = 50
    const p = principalStresses({ sx: 70, sy: 10, txy: 40 });
    expect(p.sigma1).toBeCloseTo(90, 12);
    expect(p.sigma2).toBeCloseTo(-10, 12);
    expect(p.tauMax).toBeCloseTo(50, 12);
  });

  it("въпрос 4: σ_1 = 95 и σ_2 = 15 са невъзможни при σ_x = 80, σ_y = 20", () => {
    // 95 + 15 = 110, а σ_x + σ_y = 100
    for (const txy of [0, 10, 37.5, 80]) {
      const p = principalStresses({ sx: 80, sy: 20, txy });
      expect(p.sigma1 + p.sigma2).toBeCloseTo(100, 9);
    }
    expect(95 + 15).not.toBe(80 + 20);
  });
});

describe("„Подробно“, Пример 1: σ_x = 80, σ_y = −40, τ_xy = 30 MPa", () => {
  const state = { sx: 80, sy: -40, txy: 30 };
  const p = principalStresses(state);

  it("c = 20; R = √(60² + 30²) = √4500 = 67,08", () => {
    expect(mohrCircle(state).center).toBeCloseTo(20, 12);
    expect(60 ** 2 + 30 ** 2).toBe(4500);
    expect(mohrCircle(state).radius.toFixed(2)).toBe("67.08");
  });

  it("σ_1 = 87,08; σ_2 = −47,08; τ_max = 67,08 MPa", () => {
    expect(p.sigma1.toFixed(2)).toBe("87.08");
    expect(p.sigma2.toFixed(2)).toBe("-47.08");
    expect(p.tauMax.toFixed(2)).toBe("67.08");
  });

  it("tg 2α_0 = 60/120 = 0,5 → 2α_0 = 26,57°; α_0 = 13,28°; втората площадка 103,28°", () => {
    expect((2 * 30) / (80 + 40)).toBe(0.5);
    expect((2 * p.alpha1).toFixed(2)).toBe("26.57");
    expect(p.alpha1.toFixed(2)).toBe("13.28");
    expect((p.alpha1 + 90).toFixed(2)).toBe("103.28");
    expect(stressOnPlane(state, 13.28).sigma.toFixed(2)).toBe("87.08");
    expect(stressOnPlane(state, 103.28).sigma.toFixed(2)).toBe("-47.08");
  });

  it("проверки с печатаните стойности", () => {
    // сбор: 87,08 − 47,08 = 40 = 80 − 40
    expect(87.08 - 47.08).toBeCloseTo(40, 9);
    // произведение: 87,08·(−47,08) = −4099,7 ≈ −4100 = 80·(−40) − 30²
    expect((87.08 * -47.08).toFixed(1)).toBe("-4099.7");
    expect(80 * -40 - 30 ** 2).toBe(-4100);
    // tg α_1 = (87,08 − 80)/30 = 0,236 → 13,28°
    expect(((87.08 - 80) / 30).toFixed(3)).toBe("0.236");
    expect((Math.atan(0.236) / DEG).toFixed(2)).toBe("13.28");
    // площадките на τ_max: 13,28 − 45 = −31,72°; там σ = 20
    expect(p.alphaTauMax.toFixed(2)).toBe("-31.72");
    expect(stressOnPlane(state, p.alphaTauMax).sigma).toBeCloseTo(20, 9);
    expect(stressOnPlane(state, p.alphaTauMax).tau.toFixed(2)).toBe("67.08");
  });

  it("площадка α = 30°: σ = 75,98; τ = −36,96 MPa", () => {
    // σ = 20 + 60·cos 60° + 30·sin 60° = 20 + 30 + 25,98 = 75,98
    // τ = −60·sin 60° + 30·cos 60° = −51,96 + 15 = −36,96
    expect((30 * Math.sin(60 * DEG)).toFixed(2)).toBe("25.98");
    expect((60 * Math.sin(60 * DEG)).toFixed(2)).toBe("51.96");
    const plane = stressOnPlane(state, 30);
    expect(plane.sigma.toFixed(2)).toBe("75.98");
    expect(plane.tau.toFixed(2)).toBe("-36.96");
  });

  it("площадка α = 120°: σ = −35,98; τ = +36,96 MPa; сборът на σ е 40", () => {
    // σ = 20 + 60·cos 240° + 30·sin 240° = 20 − 30 − 25,98 = −35,98
    // τ = −60·sin 240° + 30·cos 240° = 51,96 − 15 = 36,96
    const plane = stressOnPlane(state, 120);
    expect(plane.sigma.toFixed(2)).toBe("-35.98");
    expect(plane.tau.toFixed(2)).toBe("36.96");
    expect(75.98 - 35.98).toBeCloseTo(40, 9);
  });
});

describe("„Подробно“, Пример 3: точка K от стоманена греда със сечение „I“", () => {
  // сечението от Глава 5: пояси 10×1,2 cm, стебло 0,8×17,6 cm
  const section: Rect[] = [
    { b: 10, h: 1.2, x: 0, y: 0 },
    { b: 0.8, h: 17.6, x: 4.6, y: 1.2 },
    { b: 10, h: 1.2, x: 0, y: 18.8 },
  ];
  const { Ix } = sectionProperties(section);
  const M = 30; // kN·m
  const Q = 60; // kN

  it("I_x = 2486,97 cm⁴", () => {
    // 2·(10·1,2³/12 + 12·9,4²) + 0,8·17,6³/12 = 2·(1,44 + 1060,32) + 363,45 = 2486,97
    expect(Ix.toFixed(2)).toBe("2486.97");
  });

  // точка K: в стеблото до долния пояс, 8,8 cm под неутралната ос
  const sigmaK = navierStress(M, Ix, 8.8); // kN/cm²
  const tauK = shearStressAt(section, Q, 1.2, "above"); // kN/cm²

  it("σ = 3000·8,8/2486,97 = 10,615 kN/cm² = 106,15 MPa", () => {
    expect(sigmaK.toFixed(3)).toBe("10.615");
    expect((sigmaK * 10).toFixed(2)).toBe("106.15");
    expect(((3000 * 8.8) / 2486.97).toFixed(3)).toBe("10.615");
  });

  it("τ = 60·112,8/(2486,97·0,8) = 3,402 kN/cm² = 34,02 MPa", () => {
    // S* = 12·9,4 = 112,8 cm³
    expect(tauK.toFixed(3)).toBe("3.402");
    expect((tauK * 10).toFixed(2)).toBe("34.02");
    expect(((60 * 112.8) / (2486.97 * 0.8)).toFixed(3)).toBe("3.402");
  });

  it("Q > 0 → τ_xy = −34,02 MPa; σ_y = 0", () => {
    const state = beamPointState(106.15, 34.02, Q);
    expect(state).toEqual({ sx: 106.15, sy: 0, txy: -34.02 });
    expect(beamPointState(106.15, 34.02, -Q).txy).toBe(34.02);
  });

  it("с печатаните стойности: 53,08 ± 63,04 → σ_1 = 116,1; σ_2 = −10,0 MPa", () => {
    // σ/2 = 53,075; R = √(53,075² + 34,02²) = √(2816,96 + 1157,36) = √3974,32 = 63,04
    expect((53.075 ** 2).toFixed(2)).toBe("2816.96");
    expect((34.02 ** 2).toFixed(2)).toBe("1157.36");
    expect(Math.sqrt(3974.32).toFixed(2)).toBe("63.04");
    expect((53.08 + 63.04).toFixed(1)).toBe("116.1");
    expect((53.08 - 63.04).toFixed(1)).toBe("-10.0");
    const p = principalStresses(beamPointState(106.15, 34.02, Q));
    expect(p.sigma1.toFixed(1)).toBe("116.1");
    expect(p.sigma2.toFixed(1)).toBe("-10.0");
    expect(p.tauMax.toFixed(1)).toBe("63.0");
    // винаги един опън и един натиск
    expect(p.sigma1).toBeGreaterThan(0);
    expect(p.sigma2).toBeLessThan(0);
  });

  it("същото и от неокръглените σ и τ", () => {
    const p = principalStresses(beamPointState(sigmaK * 10, tauK * 10, Q));
    expect(p.sigma1.toFixed(1)).toBe("116.1");
    expect(p.sigma2.toFixed(1)).toBe("-10.0");
    expect(p.alpha1.toFixed(1)).toBe("-16.3");
  });

  it("tg 2α_0 = −68,04/106,15 = −0,6410 → 2α_0 = −32,66°; α_0 = −16,3°", () => {
    expect(2 * 34.02).toBeCloseTo(68.04, 9);
    expect((-68.04 / 106.15).toFixed(4)).toBe("-0.6410");
    expect((Math.atan(-0.641) / DEG).toFixed(2)).toBe("-32.66");
    const p = principalStresses(beamPointState(106.15, 34.02, Q));
    expect(p.alpha1.toFixed(1)).toBe("-16.3");
    // σ_x > σ_y, значи това е посоката на σ_1
    expect(
      stressOnPlane(beamPointState(106.15, 34.02, Q), -16.33).sigma.toFixed(1),
    ).toBe("116.1");
  });

  it("крайно влакно: σ = 3000·10/2486,97 = 12,06 kN/cm² = 120,6 MPa, τ = 0", () => {
    const sigmaEdge = navierStress(M, Ix, 10);
    expect(sigmaEdge.toFixed(2)).toBe("12.06");
    expect((sigmaEdge * 10).toFixed(1)).toBe("120.6");
    const p = principalStresses(beamPointState(120.6, 0, Q));
    expect([p.sigma1, p.sigma2, p.alpha1]).toEqual([120.6, 0, 0]);
    expect(p.tauMax).toBeCloseTo(60.3, 12);
    // главният опън в K е по-малък от напрежението в крайното влакно
    expect(116.1).toBeLessThan(120.6);
  });

  it("неутрална ос: τ = 43,4 MPa, σ = 0 → σ_1 = 43,4; σ_2 = −43,4 MPa; α_1 = −45°", () => {
    expect((maxShearStress(section, Q).tau * 10).toFixed(1)).toBe("43.4");
    const p = principalStresses(beamPointState(0, 43.4, Q));
    expect(p.sigma1).toBeCloseTo(43.4, 12);
    expect(p.sigma2).toBeCloseTo(-43.4, 12);
    expect(p.alpha1).toBeCloseTo(-45, 12);
  });
});

describe("„Подробно“, въпроси", () => {
  it("въпрос 1: σ_x = 40, σ_y = −60, τ_xy = −30 → 48,31 и −68,31 MPa; α_0 = −15,48°", () => {
    // c = (40 − 60)/2 = −10; полуразлика 50; R = √(50² + 30²) = √3400 = 58,31
    const state = { sx: 40, sy: -60, txy: -30 };
    const p = principalStresses(state);
    expect(mohrCircle(state).center).toBeCloseTo(-10, 12);
    expect(p.tauMax.toFixed(2)).toBe("58.31");
    expect(p.sigma1.toFixed(2)).toBe("48.31");
    expect(p.sigma2.toFixed(2)).toBe("-68.31");
    // tg 2α_0 = 2·(−30)/(40 + 60) = −0,6 → 2α_0 = −30,96°; α_0 = −15,48°
    expect((Math.atan(-0.6) / DEG).toFixed(2)).toBe("-30.96");
    expect(p.alpha1.toFixed(2)).toBe("-15.48");
  });

  it("въпрос 2: едноосен опън 100 MPa, α = 30° → σ = 75; τ = −43,3 MPa", () => {
    // σ = 100·cos²30° = 100·0,75 = 75; τ = −50·sin 60° = −50·0,8660 = −43,3
    const plane = stressOnPlane({ sx: 100, sy: 0, txy: 0 }, 30);
    expect(plane.sigma).toBeCloseTo(75, 9);
    expect(plane.tau.toFixed(1)).toBe("-43.3");
  });

  it("въпрос 3: dσ_α/dα = 2·τ_α (числено диференциране)", () => {
    const step = 1e-4; // градуси
    for (const state of STATES) {
      for (const alpha of [-20, 5, 33, 80]) {
        const slope =
          (stressOnPlane(state, alpha + step).sigma -
            stressOnPlane(state, alpha - step).sigma) /
          (2 * step * DEG);
        expect(slope).toBeCloseTo(2 * stressOnPlane(state, alpha).tau, 4);
      }
    }
  });

  it("въпрос 4: център −10 и радиус 40 MPa → σ_1 = 30; σ_2 = −50; τ_max = 40; σ = −10 MPa", () => {
    // едно от състоянията с такава окръжност: σ_x = 22, σ_y = −42, τ_xy = 24 (32² + 24² = 40²)
    const state = { sx: 22, sy: -42, txy: 24 };
    expect(mohrCircle(state).center).toBeCloseTo(-10, 12);
    expect(mohrCircle(state).radius).toBeCloseTo(40, 12);
    const p = principalStresses(state);
    expect(p.sigma1).toBeCloseTo(30, 12);
    expect(p.sigma2).toBeCloseTo(-50, 12);
    expect(p.tauMax).toBeCloseTo(40, 12);
    expect(stressOnPlane(state, p.alphaTauMax).sigma).toBeCloseTo(-10, 9);
  });

  it("въпрос 5: точка от греда със σ = 8 и τ = 3 MPa → 9 и −1 MPa", () => {
    // σ/2 = 4; R = √(4² + 3²) = 5; 4 + 5 = 9; 4 − 5 = −1
    for (const Q of [15, -15]) {
      const p = principalStresses(beamPointState(8, 3, Q));
      expect(p.sigma1).toBeCloseTo(9, 12);
      expect(p.sigma2).toBeCloseTo(-1, 12);
    }
  });
});

describe("невалидни данни", () => {
  it("отказва безкрайни и нечислови стойности", () => {
    expect(() => stressOnPlane({ sx: Number.NaN, sy: 0, txy: 0 }, 0)).toThrow();
    expect(() => stressOnPlane({ sx: 1, sy: 2, txy: 3 }, Infinity)).toThrow();
    expect(() => mohrCircle({ sx: 0, sy: Infinity, txy: 0 })).toThrow();
    expect(() =>
      principalStresses({ sx: 0, sy: 0, txy: Number.NaN }),
    ).toThrow();
    expect(() => rotateStressState({ sx: 0, sy: 0, txy: 1 }, NaN)).toThrow();
    expect(() => beamPointState(10, -1, 5)).toThrow();
    expect(() => beamPointState(10, 2, 0)).toThrow();
    expect(() => beamPointState(Number.NaN, 2, 5)).toThrow();
    expect(() => beamPointState(10, 2, Infinity)).toThrow();
  });

  it("при Q = 0 и τ = 0 състоянието е едноосно", () => {
    expect(beamPointState(12, 0, 0)).toEqual({ sx: 12, sy: 0, txy: 0 });
  });
});
