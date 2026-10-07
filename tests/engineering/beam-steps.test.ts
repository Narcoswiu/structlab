import { describe, expect, it } from "vitest";
import { explainBeam } from "@/lib/engineering/beam-steps";
import type { Beam } from "@/lib/engineering/beam";
import { formatDecimal, parseDecimal } from "@/lib/number-input";

const text = (beam: Beam) =>
  explainBeam(beam)
    .flatMap((step) => [step.title, ...step.lines])
    .join("\n");

describe("решение стъпка по стъпка – проста греда със сила", () => {
  const beam: Beam = {
    length: 6,
    supports: { type: "simple", xA: 0, xB: 6 },
    loads: [{ type: "force", x: 2.4, value: 30 }],
  };
  const steps = explainBeam(beam);

  it("стъпките са в реда, в който се решава на лист", () => {
    expect(steps.map((step) => step.title)).toEqual([
      "Товари",
      "Опорни реакции",
      "Проверка",
      "Характерни стойности",
      "Най-голям огъващ момент",
    ]);
  });

  it("уравненията носят числата от задачата и верните резултати", () => {
    const all = text(beam);
    expect(all).toContain("B · 6 = 30 · 2,4 = 72");
    expect(all).toContain("B = 72 / 6 = 12 kN");
    expect(all).toContain("A = 30 − 12 = 18 kN");
    expect(all).toContain("реакциите са верни");
    expect(all).toContain("43,2 kN·m при x = 2,4 m");
    expect(all).toContain("опънати са долните нишки");
  });

  it("таблицата показва скока на Q под силата", () => {
    const table = steps[3]!.table!;
    expect(table.head).toEqual(["x, m", "Q, kN", "M, kN·m"]);
    expect(table.rows).toEqual([
      ["0", "18", "0"],
      ["2,4", "18 | −12", "43,2"],
      ["6", "−12", "0"],
    ]);
  });
});

describe("решение стъпка по стъпка – други случаи", () => {
  it("разпределен товар: показва равнодействащата и мястото, където Q = 0", () => {
    const all = text({
      length: 4,
      supports: { type: "simple", xA: 0, xB: 4 },
      loads: [{ type: "distributed", x1: 0, x2: 4, value: 10 }],
    });
    expect(all).toContain("равнодействаща R1 = 10 · 4 = 40 kN при x = 2 m");
    expect(all).toContain("B · 4 = 40 · 2 = 80");
    expect(all).toContain(
      "Q става нула вътре в участък с разпределен товар при x = 2 m",
    );
    expect(all).toContain("20 kN·m при x = 2 m");
  });

  it("конзола: реактивен момент със знак и обяснение за опънатите нишки", () => {
    const all = text({
      length: 3,
      supports: { type: "cantilever", fixedAt: "left" },
      loads: [
        { type: "distributed", x1: 0, x2: 3, value: 8 },
        { type: "force", x: 3, value: 10 },
      ],
    });
    expect(all).toContain("A = 34 kN");
    expect(all).toContain("M_A = −(24 · 1,5 + 10 · 3) = −66 kN·m");
    expect(all).toContain("опънати са горните нишки");
    expect(all).toContain("66 kN·m при x = 0 m");
  });

  it("греда с конзола: отрицателна реакция се обяснява с думи", () => {
    const all = text({
      length: 5,
      supports: { type: "simple", xA: 0, xB: 4 },
      loads: [{ type: "force", x: 5, value: 12 }],
    });
    expect(all).toContain("B = 60 / 4 = 15 kN");
    expect(all).toContain("A = 12 − 15 = −3 kN (насочена надолу)");
    expect(all).toContain("реакциите са верни");
  });

  it("съсредоточен момент влиза в уравнението без рамо", () => {
    const all = text({
      length: 4,
      supports: { type: "simple", xA: 0, xB: 4 },
      loads: [{ type: "moment", x: 2, value: 20 }],
    });
    expect(all).toContain("B · 4 = 20 = 20");
    expect(all).toContain("B = 20 / 4 = 5 kN");
    expect(all).toContain("A = 0 − 5 = −5 kN (насочена надолу)");
    expect(all).toContain("реакциите са верни");
  });

  it("проверката минава за произволна комбинация от товари", () => {
    const all = text({
      length: 7,
      supports: { type: "simple", xA: 1, xB: 6 },
      loads: [
        { type: "force", x: 0, value: 5 },
        { type: "distributed", x1: 2, x2: 5, value: 4 },
        { type: "moment", x: 3, value: -9 },
        { type: "force", x: 7, value: 8 },
      ],
    });
    expect(all).toContain("реакциите са верни");
    expect(all).not.toContain("има грешка");
  });

  it("без товари казва това ясно, вместо да показва нули", () => {
    const all = text({
      length: 4,
      supports: { type: "simple", xA: 0, xB: 4 },
      loads: [],
    });
    expect(all).toContain("Няма товари");
    expect(all).toContain("Огъващият момент е нула по цялата дължина.");
  });
});

describe("числа, въведени от потребител", () => {
  it("приема запетая, точка, интервали и типографски минус", () => {
    expect(parseDecimal("5,4")).toBe(5.4);
    expect(parseDecimal("5.4")).toBe(5.4);
    expect(parseDecimal(" 12 ")).toBe(12);
    expect(parseDecimal("−3,5")).toBe(-3.5);
    expect(parseDecimal("1 250")).toBe(1250);
  });

  it("отхвърля всичко, което не е число", () => {
    for (const bad of [
      "",
      "abc",
      "5,4,3",
      "1e5",
      "5,",
      ",5",
      "--2",
      "Infinity",
    ]) {
      expect(parseDecimal(bad)).toBeNull();
    }
  });

  it("показва числата със запетая и без излишни нули", () => {
    expect(formatDecimal(2.4)).toBe("2,4");
    expect(formatDecimal(6)).toBe("6");
    expect(formatDecimal(0.1 + 0.2)).toBe("0,3");
  });
});
