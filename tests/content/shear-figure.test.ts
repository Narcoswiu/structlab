import { describe, expect, it } from "vitest";
import { renderShearStressFigure } from "@/lib/content/shear-figure";
import { findSvgProblem } from "@/lib/content/svg";

describe("фигура с диаграма на тангенциалните напрежения", () => {
  it("правоъгълник: една парабола с връх 0,6 MPa", () => {
    const svg = renderShearStressFigure({
      title: "П",
      section: [{ b: 10, h: 20, x: 0, y: 0 }],
      Q: 8,
    });
    expect(svg).toContain(">0,6 MPa<");
    expect(svg).toContain("Q = 8 kN");
    expect(svg.match(/<polygon/g)).toHaveLength(1);
    expect(findSvgProblem(svg)).toBeNull();
  });

  it("сечение „Т“: две части и скокът 0,96 / 5,77 MPa", () => {
    const svg = renderShearStressFigure({
      title: "Т",
      section: [
        { b: 2, h: 10, x: 5, y: 0 },
        { b: 12, h: 2, x: 0, y: 10 },
      ],
      Q: 10,
    });
    expect(svg).toContain(">6,03 MPa<");
    expect(svg).toContain(">0,96 / 5,77 MPa<");
    expect(svg.match(/<polygon/g)).toHaveLength(2);
  });

  it("сечение „I“: 43,4 MPa в средата; на долния скок стеблото е отгоре", () => {
    const svg = renderShearStressFigure({
      title: 'I"<>',
      section: [
        { b: 10, h: 1.2, x: 0, y: 0 },
        { b: 0.8, h: 17.6, x: 4.6, y: 1.2 },
        { b: 10, h: 1.2, x: 0, y: 18.8 },
      ],
      Q: 60,
    });
    expect(svg).toContain(">43,4 MPa<");
    expect(svg).toContain(">34 / 2,72 MPa<"); // долната граница: над нея е стеблото
    expect(svg).toContain(">2,72 / 34 MPa<"); // горната граница: над нея е поясът
    expect(svg).toContain('aria-label="I"');
    expect(findSvgProblem(svg)).toBeNull();
  });
});
