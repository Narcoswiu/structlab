import { describe, expect, it } from "vitest";
import { renderBiaxialFigure } from "@/lib/content/biaxial-figure";
import { findSvgProblem } from "@/lib/content/svg";

describe("фигура за общо огъване", () => {
  const svg = renderBiaxialFigure({ title: 'К"<', b: 12, h: 20, Mx: 6, My: 2 });

  it("показва напреженията в четирите ъгъла и ъгъла на неутралната ос", () => {
    for (const value of ["11,67 MPa", "3,33 MPa", "−3,33 MPa", "−11,67 MPa"]) {
      expect(svg).toContain(`>${value}<`);
    }
    expect(svg).toContain("β = 42,8° от оста x");
    expect(svg).toContain("</tspan> = 6 kN·m");
  });

  it("неутралната ос минава от долу вляво към горе вдясно (опънът е долу вдясно)", () => {
    const line = /<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)" stroke="var\(--fig-load\)"/.exec(svg)!;
    const [x1, y1, x2, y2] = line.slice(1).map(Number);
    expect(x2!).toBeGreaterThan(x1!);
    expect(y2!).toBeLessThan(y1!); // на екрана y расте надолу
  });

  it("при специално огъване неутралната ос е хоризонтална", () => {
    const plain = renderBiaxialFigure({ title: "П", b: 10, h: 20, Mx: 8, My: 0 });
    const line = /<line x1="[\d.]+" y1="([\d.]+)" x2="[\d.]+" y2="([\d.]+)" stroke="var\(--fig-load\)"/.exec(plain)!;
    expect(Number(line[1])).toBeCloseTo(Number(line[2]), 6);
    expect(plain).toContain(">12 MPa<");
    expect(plain).toContain("β = 0° от оста x");
  });

  it("минава проверката за безопасност", () => {
    expect(findSvgProblem(svg)).toBeNull();
    expect(svg).toContain('aria-label="К"');
  });
});
