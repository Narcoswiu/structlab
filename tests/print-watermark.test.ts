import { describe, expect, it } from "vitest";
import { buildWatermarkText } from "@/lib/print-watermark";

describe("buildWatermarkText", () => {
  it("съдържа имейла, датата и името на платформата", () => {
    expect(
      buildWatermarkText("ivan@example.com", new Date("2026-10-09T09:00:00Z")),
    ).toBe("Лично копие за ivan@example.com · 09.10.2026 · StructLab");
  });

  it("смята датата по българско време, не по UTC", () => {
    // 22:30 UTC на 9-и е вече 01:30 на 10-и в София (лятно време, UTC+3)
    expect(
      buildWatermarkText("ivan@example.com", new Date("2026-10-09T22:30:00Z")),
    ).toContain("· 10.10.2026 ·");
  });

  it("без имейл остава само „Лично копие“", () => {
    expect(buildWatermarkText("  ", new Date("2026-10-09T09:00:00Z"))).toBe(
      "Лично копие · 09.10.2026 · StructLab",
    );
  });
});
