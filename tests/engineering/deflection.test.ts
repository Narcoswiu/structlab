import { describe, expect, it } from "vitest";
import { internalForces, type Beam } from "@/lib/engineering/beam";
import { rectangleModulus } from "@/lib/engineering/bending";
import {
  elasticCurve,
  flexuralRigidity,
  maxDeflection,
  rectangleInertia,
  requiredInertiaForDeflection,
  simpleBeamDistributedAt,
  simpleBeamEndMoment,
  simpleBeamOffCentreForce,
  standardDeflection,
  stiffnessCheck,
  toCm,
  toDegrees,
} from "@/lib/engineering/deflection";

// Всички очаквани стойности са сметнати на ръка и са записани в коментара над теста.
// Провисванията са в метри (надолу положителни), ъглите – в радиани.

/**
 * Независима проверка: грубо двойно интегриране на E·I·w″ = −M(x) по правилото
 * на трапеците от x = 0, написано отделно от `elasticCurve`. Константите се
 * намират от двете гранични условия, подадени като функция.
 */
function integrateByTrapezoids(beam: Beam, EI: number, n = 20000) {
  const h = beam.length / n;
  const xs: number[] = [0];
  const phi: number[] = [0];
  const w: number[] = [0];
  let previous = -internalForces(beam, 0, "right").M / EI;
  for (let i = 1; i <= n; i++) {
    const x = i === n ? beam.length : i * h;
    const current = -internalForces(beam, x, "left").M / EI;
    phi.push(phi[i - 1]! + (h * (previous + current)) / 2);
    w.push(w[i - 1]! + (h * (phi[i - 1]! + phi[i]!)) / 2);
    xs.push(x);
    // след сечението стойността може да скочи (съсредоточен момент)
    previous = i === n ? current : -internalForces(beam, x, "right").M / EI;
  }
  let C: number;
  let D: number;
  if (beam.supports.type === "cantilever") {
    const k = beam.supports.fixedAt === "left" ? 0 : n;
    C = -phi[k]!;
    D = -w[k]! - C * xs[k]!;
  } else {
    // опорите на тестовите греди са в двата края
    C = -(w[n]! - w[0]!) / (xs[n]! - xs[0]!);
    D = -w[0]!;
  }
  return {
    w: (x: number) => {
      const i = Math.round(x / h);
      return w[i]! + C * xs[i]! + D;
    },
    phi: (x: number) => phi[Math.round(x / h)]! + C,
    max: () => {
      let best = { x: 0, w: 0 };
      for (let i = 0; i <= n; i++) {
        const value = w[i]! + C * xs[i]! + D;
        if (Math.abs(value) > Math.abs(best.w)) best = { x: xs[i]!, w: value };
      }
      return best;
    },
  };
}

describe("помощни функции", () => {
  it("I на правоъгълник: 10·20³/12 = 6666,67 cm⁴; 20·10³/12 = 1666,67 cm⁴", () => {
    expect(rectangleInertia(10, 20)).toBeCloseTo(6666.6667, 3);
    expect(rectangleInertia(20, 10)).toBeCloseTo(1666.6667, 3);
  });

  it("E·I: 1100·6666,67 = 7 333 333 kN·cm² = 733,33 kN·m²", () => {
    expect(flexuralRigidity(1100, 20000 / 3)).toBeCloseTo(733.3333, 3);
  });

  it("E·I: 21000·1943 = 40 803 000 kN·cm² = 4080,3 kN·m²", () => {
    expect(flexuralRigidity(21000, 1943)).toBeCloseTo(4080.3, 9);
  });

  it("метри → сантиметри и радиани → градуси", () => {
    expect(toCm(0.0182)).toBeCloseTo(1.82, 12);
    expect(toDegrees(Math.PI / 2)).toBeCloseTo(90, 12);
  });

  it("отказва неположителни E, I, размери", () => {
    expect(() => flexuralRigidity(0, 100)).toThrow();
    expect(() => flexuralRigidity(21000, -1)).toThrow();
    expect(() => rectangleInertia(0, 10)).toThrow();
  });
});

describe("типови случаи – формулите от таблицата", () => {
  it("конзола със сила: F·l³/(3EI), F·l²/(2EI) при F = 3, l = 2, EI = 1000", () => {
    // f = 3·8/3000 = 0,008; φ = 3·4/2000 = 0,006
    const r = standardDeflection("cantilever-force", 3, 2, 1000);
    expect(r.f).toBeCloseTo(0.008, 12);
    expect(r.phi).toBeCloseTo(0.006, 12);
  });

  it("конзола с равномерен товар: q·l⁴/(8EI), q·l³/(6EI) при q = 6, l = 2, EI = 1000", () => {
    // f = 6·16/8000 = 0,012; φ = 6·8/6000 = 0,008
    const r = standardDeflection("cantilever-distributed", 6, 2, 1000);
    expect(r.f).toBeCloseTo(0.012, 12);
    expect(r.phi).toBeCloseTo(0.008, 12);
  });

  it("конзола с момент в края: M·l²/(2EI), M·l/(EI) при M = 10, l = 2, EI = 1000", () => {
    // f = 10·4/2000 = 0,02; φ = 10·2/1000 = 0,02
    const r = standardDeflection("cantilever-moment", 10, 2, 1000);
    expect(r.f).toBeCloseTo(0.02, 12);
    expect(r.phi).toBeCloseTo(0.02, 12);
  });

  it("проста греда със сила в средата: F·l³/(48EI), F·l²/(16EI) при F = 12, l = 4, EI = 1000", () => {
    // f = 12·64/48000 = 0,016; φ = 12·16/16000 = 0,012
    const r = standardDeflection("simple-force-mid", 12, 4, 1000);
    expect(r.f).toBeCloseTo(0.016, 12);
    expect(r.phi).toBeCloseTo(0.012, 12);
  });

  it("проста греда с равномерен товар: 5·q·l⁴/(384EI), q·l³/(24EI) при q = 3, l = 4, EI = 1000", () => {
    // f = 5·3·256/384000 = 0,01; φ = 3·64/24000 = 0,008
    const r = standardDeflection("simple-distributed", 3, 4, 1000);
    expect(r.f).toBeCloseTo(0.01, 12);
    expect(r.phi).toBeCloseTo(0.008, 12);
  });

  it("отказва неположителни l и EI", () => {
    expect(() => standardDeflection("cantilever-force", 1, 0, 1)).toThrow();
    expect(() => standardDeflection("cantilever-force", 1, 1, 0)).toThrow();
    expect(() => standardDeflection("cantilever-force", NaN, 1, 1)).toThrow();
  });

  it("сила в средата е частен случай на сила извън средата", () => {
    const mid = standardDeflection("simple-force-mid", 12, 4, 1000);
    const general = simpleBeamOffCentreForce(12, 2, 4, 1000);
    expect(general.underLoad).toBeCloseTo(mid.f, 12);
    expect(general.max).toBeCloseTo(mid.f, 12);
    expect(general.xMax).toBeCloseTo(2, 12);
    expect(general.phiA).toBeCloseTo(mid.phi, 12);
    expect(general.phiB).toBeCloseTo(-mid.phi, 12);
  });

  it("проста греда с момент в опора B: M = 10, l = 4, EI = 1000", () => {
    // w_max = 10·16/(9·√3·1000) = 160/15588,46 = 0,010264 при x = 4/√3 = 2,3094
    // φ_A = 10·4/6000 = 0,0066667; φ_B = −10·4/3000 = −0,013333
    const r = simpleBeamEndMoment(10, 4, 1000);
    expect(r.max).toBeCloseTo(0.010264, 6);
    expect(r.xMax).toBeCloseTo(2.3094, 4);
    expect(r.phiA).toBeCloseTo(0.0066667, 7);
    expect(r.phiB).toBeCloseTo(-0.013333, 6);
    // същото от численото интегриране (моментът в B е обратен на часовниковата)
    const beam: Beam = {
      length: 4,
      supports: { type: "simple", xA: 0, xB: 4 },
      loads: [{ type: "moment", x: 4, value: -10 }],
    };
    const curve = elasticCurve(beam, 1000, 10);
    expect(curve[0]!.phi).toBeCloseTo(r.phiA, 12);
    expect(curve.at(-1)!.phi).toBeCloseTo(r.phiB, 12);
    expect(maxDeflection(beam, 1000, 1000).w).toBeCloseTo(r.max, 7);
  });
});

describe("дървена греда 10×20 cm, l = 4 m, q = 4 kN/m, E = 1100 kN/cm² (Леко; Пример 2 в Подробно)", () => {
  const beam: Beam = {
    length: 4,
    supports: { type: "simple", xA: 0, xB: 4 },
    loads: [{ type: "distributed", x1: 0, x2: 4, value: 4 }],
  };
  const EI = flexuralRigidity(1100, rectangleInertia(10, 20));
  const result = standardDeflection("simple-distributed", 4, 4, EI);

  it("f = 5·4·4⁴/(384·733,33) = 5120/281 600 = 0,01818 m = 1,82 cm", () => {
    expect(result.f).toBeCloseTo(5120 / 281600, 12);
    expect(toCm(result.f).toFixed(2)).toBe("1.82");
  });

  it("φ_A = q·l³/(24EI) = 256/17 600 = 0,01455 rad = 0,83°", () => {
    expect(result.phi).toBeCloseTo(256 / 17600, 12);
    expect(result.phi.toFixed(5)).toBe("0.01455");
    expect(toDegrees(result.phi).toFixed(2)).toBe("0.83");
  });

  it("интегриране на ръка: C = 10,667 kN·m²; E·I·w(2) = −10,667 + 2,667 + 21,333 = 13,333", () => {
    // E·I·w = −(4/3)x³ + x⁴/6 + C·x; w(4) = 0 → −85,333 + 42,667 + 4C = 0
    const C = (256 / 3 - 128 / 3) / 4;
    expect(C).toBeCloseTo(10.6667, 4);
    const EIw = (x: number) => -(4 / 3) * x ** 3 + x ** 4 / 6 + C * x;
    expect(EIw(2)).toBeCloseTo(13.3333, 4);
    expect(EIw(2) / EI).toBeCloseTo(result.f, 12);
    expect(C / EI).toBeCloseTo(result.phi, 12);
  });

  it("условие l/250: 400/250 = 1,6 cm < 1,82 cm → не е изпълнено", () => {
    const check = stiffnessCheck(toCm(result.f), 400 / 250);
    expect(check.ok).toBe(false);
    // надвишение: 1,818/1,6 = 1,136 → с около 14 %
    expect((1 / check.ratio).toFixed(2)).toBe("1.14");
  });

  it("модулът на стоманата е около 19 пъти по-голям: 21000/1100 = 19,09", () => {
    expect((21000 / 1100).toFixed(1)).toBe("19.1");
  });

  it("Пример 3: в участък 1 нулата на φ би била при x = √(66,667/10) = 2,58 m > 2 m", () => {
    expect(Math.sqrt(400 / 6 / 10).toFixed(2)).toBe("2.58");
  });

  it("легнала (20×10): I = 1666,67 cm⁴, четири пъти по-малък → f = 7,27 cm", () => {
    const flat = standardDeflection(
      "simple-distributed",
      4,
      4,
      flexuralRigidity(1100, rectangleInertia(20, 10)),
    );
    expect(flat.f / result.f).toBeCloseTo(4, 12);
    expect(toCm(flat.f).toFixed(2)).toBe("7.27");
  });

  it("w(x) = q(x⁴ − 2lx³ + l³x)/(24EI): w(1) = 4·57/17 600 = 0,01295 m; w(2) = f; w(0) = w(4) = 0", () => {
    expect(simpleBeamDistributedAt(4, 4, EI, 1)).toBeCloseTo(228 / 17600, 12);
    expect(simpleBeamDistributedAt(4, 4, EI, 2)).toBeCloseTo(result.f, 12);
    expect(simpleBeamDistributedAt(4, 4, EI, 0)).toBe(0);
    expect(simpleBeamDistributedAt(4, 4, EI, 4)).toBeCloseTo(0, 12);
    expect(() => simpleBeamDistributedAt(4, 4, EI, 5)).toThrow();
  });

  it("независима проверка: интегриране по трапеци дава същото f и φ_A", () => {
    const numeric = integrateByTrapezoids(beam, EI);
    expect(numeric.w(2)).toBeCloseTo(result.f, 8);
    expect(numeric.phi(0)).toBeCloseTo(result.phi, 8);
    expect(numeric.max().x).toBeCloseTo(2, 3);
  });

  it("elasticCurve съвпада със затворената формула във всеки възел", () => {
    for (const point of elasticCurve(beam, EI, 8)) {
      expect(point.w).toBeCloseTo(
        simpleBeamDistributedAt(4, 4, EI, point.x),
        12,
      );
    }
    const peak = maxDeflection(beam, EI);
    expect(peak.x).toBeCloseTo(2, 9);
    expect(peak.w).toBeCloseTo(result.f, 12);
  });
});

describe("зависимости, цитирани в текста", () => {
  it("двоен отвор: провисването от q расте 16 пъти, от сила – 8 пъти; напрежението от q – 4 пъти", () => {
    const q1 = standardDeflection("simple-distributed", 4, 4, 1000).f;
    const q2 = standardDeflection("simple-distributed", 4, 8, 1000).f;
    expect(q2 / q1).toBeCloseTo(16, 12);
    const F1 = standardDeflection("simple-force-mid", 4, 4, 1000).f;
    const F2 = standardDeflection("simple-force-mid", 4, 8, 1000).f;
    expect(F2 / F1).toBeCloseTo(8, 12);
    // M = q·l²/8: 4·8²/8 = 32 срещу 4·4²/8 = 8
    expect((4 * 8 ** 2) / 8 / ((4 * 4 ** 2) / 8)).toBe(4);
  });

  it("двойна височина → I расте 8 пъти; двойна ширина → 2 пъти", () => {
    expect(rectangleInertia(10, 40) / rectangleInertia(10, 20)).toBeCloseTo(
      8,
      12,
    );
    expect(rectangleInertia(20, 20) / rectangleInertia(10, 20)).toBeCloseTo(
      2,
      12,
    );
  });

  it("загадката в „Подробно“: 6×20 и 24×10 cm имат W = 400 cm³, но I = 4000 и 2000 cm⁴", () => {
    // W = 6·20²/6 = 400; 24·10²/6 = 400; I = 6·20³/12 = 4000; 24·10³/12 = 2000
    expect(rectangleModulus(6, 20)).toBeCloseTo(400, 9);
    expect(rectangleModulus(24, 10)).toBeCloseTo(400, 9);
    expect(rectangleInertia(6, 20)).toBeCloseTo(4000, 9);
    expect(rectangleInertia(24, 10)).toBeCloseTo(2000, 9);
  });

  it("сравнение сила/равномерен товар при еднаква равнодействаща: 8/5 = 1,6 пъти", () => {
    // F = q·l: (F·l³/48) / (5·F·l³/384) = 384/240 = 1,6
    const asForce = standardDeflection("simple-force-mid", 16, 4, 1000).f;
    const asLoad = standardDeflection("simple-distributed", 4, 4, 1000).f;
    expect(asForce / asLoad).toBeCloseTo(1.6, 12);
  });
});

describe("въпроси „Провери се“", () => {
  it("Леко, въпрос 2: греда 8×16 cm, l = 3 m, F = 6 kN в средата, E = 1100 → 1,12 cm", () => {
    // I = 8·16³/12 = 2730,67 cm⁴; E·I = 1100·2730,67/10⁴ = 300,37 kN·m²
    // f = 6·27/(48·300,37) = 162/14 417,9 = 0,01124 m
    const I = rectangleInertia(8, 16);
    expect(I.toFixed(2)).toBe("2730.67");
    const EI = flexuralRigidity(1100, I);
    expect(EI.toFixed(2)).toBe("300.37");
    const f = standardDeflection("simple-force-mid", 6, 3, EI).f;
    expect(toCm(f).toFixed(2)).toBe("1.12");
  });

  it("Подробно, въпрос 2: стоманена конзола 4×10 cm, l = 1,5 m, q = 8 kN/m → 0,72 cm и 0,00643 rad", () => {
    // I = 4·10³/12 = 333,33 cm⁴; E·I = 21000·333,33/10⁴ = 700 kN·m²
    // f = 8·1,5⁴/(8·700) = 40,5/5600 = 0,00723 m; φ = 8·1,5³/(6·700) = 27/4200 = 0,00643
    const EI = flexuralRigidity(21000, rectangleInertia(4, 10));
    expect(EI).toBeCloseTo(700, 9);
    const r = standardDeflection("cantilever-distributed", 8, 1.5, EI);
    expect(r.f).toBeCloseTo(40.5 / 5600, 12);
    expect(toCm(r.f).toFixed(2)).toBe("0.72");
    expect(r.phi.toFixed(5)).toBe("0.00643");
    // числено, със запъване вляво
    const beam: Beam = {
      length: 1.5,
      supports: { type: "cantilever", fixedAt: "left" },
      loads: [{ type: "distributed", x1: 0, x2: 1.5, value: 8 }],
    };
    const end = elasticCurve(beam, EI).at(-1)!;
    expect(end.w).toBeCloseTo(r.f, 12);
    expect(end.phi).toBeCloseTo(r.phi, 12);
  });

  it("Подробно, въпрос 5: l = 5 m, q = 12,8 kN/m, f ≤ l/250 → I ≥ 2480,2 cm⁴", () => {
    // 5·0,128·500³·250/(384·21000) = 20 000 000 000/8 064 000 = 2480,16
    expect(requiredInertiaForDeflection(12.8, 5, 21000, 250)).toBeCloseTo(
      2480.16,
      2,
    );
  });
});

describe("Пример 1 (Подробно): конзола IPE 200, l = 2 m, F = 10 kN", () => {
  const EI = flexuralRigidity(21000, 1943);
  const beam: Beam = {
    length: 2,
    supports: { type: "cantilever", fixedAt: "left" },
    loads: [{ type: "force", x: 2, value: 10 }],
  };
  const r = standardDeflection("cantilever-force", 10, 2, EI);

  it("E·I·w = 10x² − (5/3)x³: E·I·w(2) = 40 − 13,333 = 26,667; f = 26,667/4080,3 = 0,65 cm", () => {
    const EIw = 10 * 2 ** 2 - (5 / 3) * 2 ** 3;
    expect(EIw).toBeCloseTo(26.6667, 4);
    expect(EIw / EI).toBeCloseTo(r.f, 12);
    expect(r.f.toFixed(6)).toBe("0.006535");
    expect(toCm(r.f).toFixed(2)).toBe("0.65");
  });

  it("E·I·φ = 20x − 5x²: E·I·φ(2) = 40 − 20 = 20; φ = 20/4080,3 = 0,00490 rad = 0,28°", () => {
    expect(20 / EI).toBeCloseTo(r.phi, 12);
    expect(r.phi.toFixed(5)).toBe("0.00490");
    expect(toDegrees(r.phi).toFixed(2)).toBe("0.28");
  });

  it("M(x) = −10·(2 − x): в запъването −20 kN·m (опънати горни влакна)", () => {
    expect(internalForces(beam, 0, "right").M).toBeCloseTo(-20, 12);
    expect(internalForces(beam, 1, "right").M).toBeCloseTo(-10, 12);
  });

  it("независима проверка: интегриране по трапеци", () => {
    const numeric = integrateByTrapezoids(beam, EI);
    expect(numeric.w(2)).toBeCloseTo(r.f, 8);
    expect(numeric.phi(2)).toBeCloseTo(r.phi, 8);
  });

  it("elasticCurve: същото и при запъване в десния край (огледална схема)", () => {
    const end = elasticCurve(beam, EI).at(-1)!;
    expect(end.w).toBeCloseTo(r.f, 12);
    expect(end.phi).toBeCloseTo(r.phi, 12);
    const mirrored = elasticCurve(
      {
        length: 2,
        supports: { type: "cantilever", fixedAt: "right" },
        loads: [{ type: "force", x: 0, value: 10 }],
      },
      EI,
    )[0]!;
    expect(mirrored.w).toBeCloseTo(r.f, 12);
    expect(mirrored.phi).toBeCloseTo(-r.phi, 12);
  });
});

describe("Пример 3 (Подробно): проста греда IPE 240, l = 6 m, F = 30 kN на 2 m от A", () => {
  const EI = flexuralRigidity(21000, 3891);
  const beam: Beam = {
    length: 6,
    supports: { type: "simple", xA: 0, xB: 6 },
    loads: [{ type: "force", x: 2, value: 30 }],
  };
  const r = simpleBeamOffCentreForce(30, 2, 6, EI);
  // решението на ръка: C = 66,667 kN·m², D = 0
  const C = 400 / 6;
  const EIw = (x: number) =>
    -(10 / 3) * x ** 3 + (x > 2 ? 5 * (x - 2) ** 3 : 0) + C * x;
  const EIphi = (x: number) =>
    -10 * x ** 2 + (x > 2 ? 15 * (x - 2) ** 2 : 0) + C;

  it("E·I = 21000·3891 = 81 711 000 kN·cm² = 8171,1 kN·m²; M_max = 20·2 = 40 kN·m", () => {
    expect(EI).toBeCloseTo(8171.1, 9);
    expect(internalForces(beam, 2).M).toBeCloseTo(40, 12);
  });

  it("w₂(6) = 0: −720 + 320 + 6C = 0 → C = 66,667", () => {
    expect(-(10 / 3) * 216).toBeCloseTo(-720, 9);
    expect(5 * 4 ** 3).toBe(320);
    expect(EIw(6)).toBeCloseTo(0, 9);
  });

  it("под силата: (−26,667 + 133,333)/8171,1 = 106,667/8171,1 = 0,01305 m = 1,31 cm", () => {
    expect(EIw(2)).toBeCloseTo(106.6667, 4);
    expect(EIw(2) / EI).toBeCloseTo(r.underLoad, 12);
    // затворена формула: 30·4·16/(3·8171,1·6) = 1920/147 079,8
    expect(r.underLoad).toBeCloseTo(1920 / 147079.8, 12);
    expect(toCm(r.underLoad).toFixed(2)).toBe("1.31");
  });

  it("най-голямо: 5x² − 60x + 126,667 = 0 → x = 2,734 m; 116,12/8171,1 = 0,01421 m = 1,42 cm", () => {
    // x = (60 − √(3600 − 2533,33))/10 = (60 − 32,66)/10
    const x = (60 - Math.sqrt(3600 - 20 * (380 / 3))) / 10;
    expect(x.toFixed(3)).toBe("2.734");
    expect(EIphi(x)).toBeCloseTo(0, 9);
    expect(r.xMax).toBeCloseTo(x, 12);
    // −68,12 + 1,98 + 182,27 = 116,12 (сборът на закръглените е 116,13)
    expect((-(10 / 3) * x ** 3).toFixed(2)).toBe("-68.12");
    expect((5 * (x - 2) ** 3).toFixed(2)).toBe("1.98");
    expect((C * x).toFixed(2)).toBe("182.27");
    expect(EIw(x).toFixed(2)).toBe("116.12");
    expect(EIw(x) / EI).toBeCloseTo(r.max, 12);
    expect(toCm(r.max).toFixed(2)).toBe("1.42");
  });

  it("в средата: (−90 + 5 + 200)/8171,1 = 115/8171,1 = 0,01407 m = 1,41 cm (под 1 % от най-голямото)", () => {
    expect(EIw(3)).toBeCloseTo(115, 9);
    expect(toCm(EIw(3) / EI).toFixed(2)).toBe("1.41");
    expect(1 - EIw(3) / EI / r.max).toBeLessThan(0.01);
  });

  it("ъгли: φ_A = 66,667/8171,1 = 0,00816; φ_B = (−360 + 240 + 66,667)/8171,1 = −0,00653 rad", () => {
    expect(EIphi(0) / EI).toBeCloseTo(r.phiA, 12);
    expect(EIphi(6)).toBeCloseTo(-53.3333, 4);
    expect(EIphi(6) / EI).toBeCloseTo(r.phiB, 12);
    expect(r.phiA.toFixed(5)).toBe("0.00816");
    expect(r.phiB.toFixed(5)).toBe("-0.00653");
  });

  it("независима проверка: интегриране по трапеци", () => {
    const numeric = integrateByTrapezoids(beam, EI, 24000);
    expect(numeric.w(2)).toBeCloseTo(r.underLoad, 8);
    expect(numeric.w(3)).toBeCloseTo(EIw(3) / EI, 8);
    expect(numeric.phi(0)).toBeCloseTo(r.phiA, 8);
    expect(numeric.phi(6)).toBeCloseTo(r.phiB, 8);
    const peak = numeric.max();
    expect(peak.w).toBeCloseTo(r.max, 8);
    expect(peak.x).toBeCloseTo(r.xMax, 2);
  });

  it("elasticCurve съвпада с решението на ръка; огледалната схема дава същото", () => {
    for (const point of elasticCurve(beam, EI, 5)) {
      expect(point.w).toBeCloseTo(EIw(point.x) / EI, 12);
      expect(point.phi).toBeCloseTo(EIphi(point.x) / EI, 12);
    }
    const mirrored = simpleBeamOffCentreForce(30, 4, 6, EI);
    expect(mirrored.underLoad).toBeCloseTo(r.underLoad, 12);
    expect(mirrored.max).toBeCloseTo(r.max, 12);
    expect(mirrored.xMax).toBeCloseTo(6 - r.xMax, 12);
    expect(mirrored.phiA).toBeCloseTo(-r.phiB, 12);
    expect(() => simpleBeamOffCentreForce(30, 6, 6, EI)).toThrow();
  });
});

describe("Пример 4 (Подробно): IPE 220, l = 5 m, q = 12,8 kN/m – коравина и суперпозиция", () => {
  const EI = flexuralRigidity(21000, 2771);
  const fq = standardDeflection("simple-distributed", 12.8, 5, EI).f;

  it("E·I = 21000·2771 = 58 191 000 kN·cm² = 5819,1 kN·m²", () => {
    expect(EI).toBeCloseTo(5819.1, 9);
  });

  it("f = 5·12,8·5⁴/(384·5819,1) = 40 000/2 234 534,4 = 0,01790 m = 1,79 cm", () => {
    expect(fq).toBeCloseTo(40000 / 2234534.4, 12);
    expect(toCm(fq).toFixed(2)).toBe("1.79");
  });

  it("l/250 = 2,00 cm → изпълнено; l/300 = 1,67 cm → не е изпълнено", () => {
    expect(stiffnessCheck(toCm(fq), 500 / 250).ok).toBe(true);
    expect((500 / 300).toFixed(2)).toBe("1.67");
    expect(stiffnessCheck(toCm(fq), 500 / 300).ok).toBe(false);
  });

  it("оразмеряване за l/300: I ≥ 5·0,128·500³·300/(384·21000) = 2976,2 cm⁴ → IPE 240 (3891 cm⁴)", () => {
    const needed = requiredInertiaForDeflection(12.8, 5, 21000, 300);
    expect(needed.toFixed(1)).toBe("2976.2");
    expect(2771).toBeLessThan(needed);
    expect(3891).toBeGreaterThan(needed);
    expect(() => requiredInertiaForDeflection(12.8, 5, 21000, 0)).toThrow();
  });

  it("с IPE 240: f = 1,79·2771/3891 = 1,27 cm ≤ 1,67 cm", () => {
    const f240 = standardDeflection(
      "simple-distributed",
      12.8,
      5,
      flexuralRigidity(21000, 3891),
    ).f;
    expect(f240).toBeCloseTo((fq * 2771) / 3891, 12);
    expect(toCm(f240).toFixed(2)).toBe("1.27");
    expect(stiffnessCheck(toCm(f240), 500 / 300).ok).toBe(true);
  });

  it("суперпозиция с F = 10 kN в средата: 1250/279 316,8 = 0,45 cm; общо 2,24 cm > 2,00 cm", () => {
    const fF = standardDeflection("simple-force-mid", 10, 5, EI).f;
    expect(fF).toBeCloseTo(1250 / 279316.8, 12);
    expect(toCm(fF).toFixed(2)).toBe("0.45");
    expect(toCm(fq + fF).toFixed(2)).toBe("2.24");
    expect(stiffnessCheck(toCm(fq + fF), 2).ok).toBe(false);

    // двата товара заедно, числено
    const beam: Beam = {
      length: 5,
      supports: { type: "simple", xA: 0, xB: 5 },
      loads: [
        { type: "distributed", x1: 0, x2: 5, value: 12.8 },
        { type: "force", x: 2.5, value: 10 },
      ],
    };
    const peak = maxDeflection(beam, EI);
    expect(peak.x).toBeCloseTo(2.5, 9);
    expect(peak.w).toBeCloseTo(fq + fF, 12);
    expect(integrateByTrapezoids(beam, EI).w(2.5)).toBeCloseTo(fq + fF, 8);
  });
});

describe("stiffnessCheck и elasticCurve – вход", () => {
  it("връща запаса f_доп/f и отказва неположителна граница", () => {
    expect(stiffnessCheck(1, 2)).toEqual({ ok: true, ratio: 2 });
    expect(stiffnessCheck(0, 2).ratio).toBe(Infinity);
    expect(() => stiffnessCheck(1, 0)).toThrow();
  });

  it("отказва неположителна коравина и невалиден брой деления", () => {
    const beam: Beam = {
      length: 2,
      supports: { type: "simple", xA: 0, xB: 2 },
      loads: [{ type: "force", x: 1, value: 1 }],
    };
    expect(() => elasticCurve(beam, 0)).toThrow();
    expect(() => elasticCurve(beam, 100, 0)).toThrow();
    expect(() => elasticCurve(beam, 100, 2.5)).toThrow();
  });

  it("товар нагоре дава отрицателно провисване; maxDeflection връща най-голямото по големина", () => {
    const beam: Beam = {
      length: 4,
      supports: { type: "simple", xA: 0, xB: 4 },
      loads: [{ type: "force", x: 2, value: -12 }],
    };
    // −12·64/(48·1000) = −0,016
    expect(maxDeflection(beam, 1000).w).toBeCloseTo(-0.016, 12);
  });
});
