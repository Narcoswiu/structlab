import { describe, expect, it } from "vitest";
import {
  internalForces,
  maxMoment,
  shearZeros,
  solveReactions,
  type Beam,
} from "@/lib/engineering/beam";

// Всяка стойност тук е пресметната на ръка от уравненията на равновесието
// и е записана в коментара до нея.

describe("проста греда със съсредоточена сила", () => {
  // L = 6 m, F = 30 kN на 2,4 m от A.
  const beam: Beam = {
    length: 6,
    supports: { type: "simple", xA: 0, xB: 6 },
    loads: [{ type: "force", x: 2.4, value: 30 }],
  };

  it("реакции: ΣM_A = 0 → B = 30·2,4/6 = 12; A = 30 − 12 = 18", () => {
    const { forces, moment } = solveReactions(beam);
    expect(forces[0]!.value).toBeCloseTo(18, 10);
    expect(forces[1]!.value).toBeCloseTo(12, 10);
    expect(moment).toBeNull();
  });

  it("Q скача с 30 kN под силата: +18 вляво, −12 вдясно", () => {
    expect(internalForces(beam, 2.4, "left").Q).toBeCloseTo(18, 10);
    expect(internalForces(beam, 2.4, "right").Q).toBeCloseTo(-12, 10);
  });

  it("M_max = 18·2,4 = 43,2 kN·m под силата; в опорите е нула", () => {
    expect(maxMoment(beam)).toMatchObject({ x: 2.4 });
    expect(maxMoment(beam).M).toBeCloseTo(43.2, 10);
    expect(internalForces(beam, 0).M).toBeCloseTo(0, 10);
    expect(internalForces(beam, 6, "left").M).toBeCloseTo(0, 10);
  });

  it("M е непрекъснат под силата и се смята еднакво отляво и отдясно", () => {
    // отдясно: B·(6 − 2,4) = 12·3,6 = 43,2
    expect(internalForces(beam, 2.4, "left").M).toBeCloseTo(
      internalForces(beam, 2.4, "right").M,
      10,
    );
  });
});

describe("проста греда с равномерно разпределен товар", () => {
  // L = 4 m, q = 10 kN/m по цялата дължина.
  const beam: Beam = {
    length: 4,
    supports: { type: "simple", xA: 0, xB: 4 },
    loads: [{ type: "distributed", x1: 0, x2: 4, value: 10 }],
  };

  it("реакции: A = B = qL/2 = 20", () => {
    const { forces } = solveReactions(beam);
    expect(forces[0]!.value).toBeCloseTo(20, 10);
    expect(forces[1]!.value).toBeCloseTo(20, 10);
  });

  it("Q(x) = 20 − 10x: линейна, нула в средата", () => {
    expect(internalForces(beam, 0).Q).toBeCloseTo(20, 10);
    expect(internalForces(beam, 1).Q).toBeCloseTo(10, 10);
    expect(internalForces(beam, 4, "left").Q).toBeCloseTo(-20, 10);
    expect(shearZeros(beam)).toEqual([2]);
  });

  it("M_max = qL²/8 = 10·16/8 = 20 kN·m в средата; M(1) = 20·1 − 10·1²/2 = 15", () => {
    expect(maxMoment(beam).x).toBeCloseTo(2, 10);
    expect(maxMoment(beam).M).toBeCloseTo(20, 10);
    expect(internalForces(beam, 1).M).toBeCloseTo(15, 10);
  });
});

describe("конзола, запъната вляво, с разпределен товар и сила на края", () => {
  // L = 3 m, q = 8 kN/m по цялата дължина, F = 10 kN на свободния край.
  const beam: Beam = {
    length: 3,
    supports: { type: "cantilever", fixedAt: "left" },
    loads: [
      { type: "distributed", x1: 0, x2: 3, value: 8 },
      { type: "force", x: 3, value: 10 },
    ],
  };

  it("реакции: A_v = 8·3 + 10 = 34; M_A = −(24·1,5 + 10·3) = −66 (опън горе)", () => {
    const { forces, moment } = solveReactions(beam);
    expect(forces[0]!.value).toBeCloseTo(34, 10);
    expect(moment!.value).toBeCloseTo(-66, 10);
  });

  it("Q(x) = 34 − 8x: 34 в запъването, 10 точно преди силата, 0 след нея", () => {
    expect(internalForces(beam, 0).Q).toBeCloseTo(34, 10);
    expect(internalForces(beam, 3, "left").Q).toBeCloseTo(10, 10);
    expect(internalForces(beam, 3, "right").Q).toBeCloseTo(0, 10);
  });

  it("M(x) = −66 + 34x − 4x²: −66 в запъването, −36 при x = 1, 0 на края", () => {
    expect(internalForces(beam, 0).M).toBeCloseTo(-66, 10);
    expect(internalForces(beam, 1).M).toBeCloseTo(-36, 10);
    expect(internalForces(beam, 1.5).M).toBeCloseTo(-24, 10);
    expect(internalForces(beam, 3, "left").M).toBeCloseTo(0, 10);
    expect(maxMoment(beam)).toMatchObject({ x: 0 });
  });
});

describe("конзола, запъната вдясно (балконна плоча)", () => {
  // Ивица 1 m от плоча с дължина 1,5 m и товар q = 7 kN/m.
  const beam: Beam = {
    length: 1.5,
    supports: { type: "cantilever", fixedAt: "right" },
    loads: [{ type: "distributed", x1: 0, x2: 1.5, value: 7 }],
  };

  it("в стената: Q = −qL = −10,5 kN; M = −qL²/2 = −7,875 kN·m (опън горе)", () => {
    expect(internalForces(beam, 1.5, "left").Q).toBeCloseTo(-10.5, 10);
    expect(internalForces(beam, 1.5, "left").M).toBeCloseTo(-7.875, 10);
    expect(internalForces(beam, 0).M).toBeCloseTo(0, 10);
  });
});

describe("съсредоточен момент и греда с конзола", () => {
  it("момент по часовниковата в средата на проста греда: скок в M, Q постоянна", () => {
    // L = 4 m, M0 = 20 kN·m в x = 2. ΣM_A: B·4 = 20 → B = 5 (нагоре), A = −5.
    const beam: Beam = {
      length: 4,
      supports: { type: "simple", xA: 0, xB: 4 },
      loads: [{ type: "moment", x: 2, value: 20 }],
    };
    const { forces } = solveReactions(beam);
    expect(forces[0]!.value).toBeCloseTo(-5, 10);
    expect(forces[1]!.value).toBeCloseTo(5, 10);
    expect(internalForces(beam, 2, "left").M).toBeCloseTo(-10, 10);
    expect(internalForces(beam, 2, "right").M).toBeCloseTo(10, 10);
    expect(internalForces(beam, 1).Q).toBeCloseTo(-5, 10);
    expect(internalForces(beam, 3).Q).toBeCloseTo(-5, 10);
  });

  it("греда с конзола: сила на края създава опън горе над опората", () => {
    // Опори в 0 и 4 m, дължина 5 m, F = 12 kN на края (x = 5).
    // ΣM_A: B·4 = 12·5 → B = 15; A = 12 − 15 = −3 (надолу).
    const beam: Beam = {
      length: 5,
      supports: { type: "simple", xA: 0, xB: 4 },
      loads: [{ type: "force", x: 5, value: 12 }],
    };
    const { forces } = solveReactions(beam);
    expect(forces[0]!.value).toBeCloseTo(-3, 10);
    expect(forces[1]!.value).toBeCloseTo(15, 10);
    expect(internalForces(beam, 4, "left").M).toBeCloseTo(-12, 10);
    expect(internalForces(beam, 4, "right").Q).toBeCloseTo(12, 10);
    expect(internalForces(beam, 5, "left").M).toBeCloseTo(0, 10);
  });
});

describe("независима проверка: dM/dx = Q и dQ/dx = −q", () => {
  const beam: Beam = {
    length: 6,
    supports: { type: "simple", xA: 0, xB: 6 },
    loads: [
      { type: "distributed", x1: 1, x2: 5, value: 6 },
      { type: "force", x: 2, value: 9 },
      { type: "moment", x: 4, value: -7 },
    ],
  };
  const h = 1e-5;

  it.each([0.5, 1.5, 2.7, 3.3, 4.6, 5.5])(
    "числената производна на M съвпада с Q в x = %s",
    (x) => {
      const slope =
        (internalForces(beam, x + h).M - internalForces(beam, x - h).M) /
        (2 * h);
      expect(slope).toBeCloseTo(internalForces(beam, x).Q, 5);
    },
  );

  it("в участъка с товар Q намалява с q на метър", () => {
    const drop = internalForces(beam, 3).Q - internalForces(beam, 3.5).Q;
    expect(drop).toBeCloseTo(6 * 0.5, 10);
  });

  it("гредата е в равновесие: M се връща на нула в двата края", () => {
    expect(internalForces(beam, 0).M).toBeCloseTo(0, 10);
    expect(internalForces(beam, 6, "left").M).toBeCloseTo(0, 10);
  });
});

describe("невалидни данни", () => {
  it("отхвърля товар извън гредата и сечение извън гредата", () => {
    const beam: Beam = {
      length: 3,
      supports: { type: "cantilever", fixedAt: "left" },
      loads: [{ type: "force", x: 4, value: 1 }],
    };
    expect(() => solveReactions(beam)).toThrow();
    expect(() =>
      internalForces({ ...beam, loads: [] }, 3.5),
    ).toThrow();
  });
});
