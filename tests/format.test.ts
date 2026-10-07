import { describe, expect, it } from "vitest";
import { formatNumber, formatQuantity } from "@/lib/format";

describe("formatNumber", () => {
  it("използва десетична запетая", () => {
    expect(formatNumber(5.4, 1)).toBe("5,4");
    expect(formatNumber(567.39, 2)).toBe("567,39");
  });

  it("закръгля до зададения брой знаци", () => {
    expect(formatNumber(4.7031, 3)).toBe("4,703");
    expect(formatNumber(32)).toBe("32");
  });

  it("пише истински минус пред отрицателните числа", () => {
    expect(formatNumber(-16.88, 2)).toBe("−16,88");
  });
});

describe("formatQuantity", () => {
  it("слага непрекъсваем интервал между числото и единицата", () => {
    expect(formatQuantity(34, "kN")).toBe("34 kN");
    expect(formatQuantity(47.9, "kN·m", 2)).toBe("47,90 kN·m");
  });
});
