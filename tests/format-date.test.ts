import { describe, expect, it } from "vitest";
import { daysUntil, formatDate } from "@/lib/format-date";

describe("formatDate", () => {
  it("форматира като ДД.ММ.ГГГГ", () => {
    expect(formatDate("2026-10-21T09:00:00Z")).toBe("21.10.2026");
  });

  it("смята деня по българско време, не по UTC", () => {
    // 22:30 UTC на 21-ви е вече 01:30 на 22-ри в София (лятно време, UTC+3)
    expect(formatDate("2026-10-21T22:30:00Z")).toBe("22.10.2026");
  });
});

describe("daysUntil", () => {
  const now = new Date("2026-10-07T12:00:00Z");

  it("закръгля нагоре: остатък от час пак е „още 1 ден“", () => {
    expect(daysUntil("2026-10-07T13:00:00Z", now)).toBe(1);
    expect(daysUntil("2026-10-21T12:00:00Z", now)).toBe(14);
  });

  it("минала дата дава 0", () => {
    expect(daysUntil("2026-10-07T12:00:00Z", now)).toBe(0);
    expect(daysUntil("2026-10-01T00:00:00Z", now)).toBe(0);
  });
});
