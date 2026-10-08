import { describe, expect, it } from "vitest";
import { renderBendingStressFigure } from "@/lib/content/bending-figure";
import { findSvgProblem } from "@/lib/content/svg";

const tee = [
  { b: 2, h: 10, x: 5, y: 0 },
  { b: 12, h: 2, x: 0, y: 10 },
];

describe("фигура с диаграма на нормалните напрежения", () => {
  const svg = renderBendingStressFigure({ title: "Т", section: tee, M: 4 });

  it("показва числата от изчислението: 26,3 MPa натиск горе, 58,3 MPa опън долу", () => {
    expect(svg).toContain(">−26,3 MPa<");
    expect(svg).toContain(">58,3 MPa<");
    expect(svg).toContain(">3,73 cm<");
    expect(svg).toContain(">8,27 cm<");
    expect(svg).toContain("M = 4 kN·m");
  });

  it("опънът е начертан вдясно от нулевата линия, натискът – вляво", () => {
    const points = /<polygon points="([^"]+)"/.exec(svg)![1]!.split(" ");
    const xs = points.map((point) => Number(point.split(",")[0]));
    // нула горе, връх горе (натиск), връх долу (опън), нула долу
    expect(xs[1]!).toBeLessThan(xs[0]!);
    expect(xs[2]!).toBeGreaterThan(xs[0]!);
  });

  it("надписите следват знака на момента", () => {
    const order = (s: string) => [s.indexOf(">натиск<"), s.indexOf(">опън<")];
    const [pressure, tension] = order(svg);
    expect(pressure!).toBeLessThan(tension!); // горният надпис е „натиск“
    const reversed = renderBendingStressFigure({ title: "Т", section: tee, M: -4 });
    const [pressure2, tension2] = order(reversed);
    expect(tension2!).toBeLessThan(pressure2!);
    expect(reversed).toContain(">26,3 MPa<");
    expect(reversed).toContain(">−58,3 MPa<");
  });

  it("минава проверката за безопасност и не слага опасни знаци от заглавието", () => {
    expect(findSvgProblem(svg)).toBeNull();
    const odd = renderBendingStressFigure({ title: 'a"<b>&', section: tee, M: 4 });
    expect(odd).toContain('aria-label="ab"');
  });
});
