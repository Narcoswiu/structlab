import { describe, expect, it } from "vitest";
import { derivePersonalTask } from "@/lib/personal-task";

describe("derivePersonalTask", () => {
  it("смята параметрите от 2-рата, 3-тата и 4-тата цифра (пример от прототипа)", () => {
    const task = derivePersonalTask("3147");
    expect(task).toMatchObject({ k2: 1, k3: 4, k4: 7, F: 34, M: 52, q: 12 });
    expect(task?.a).toBeCloseTo(6.2);
  });

  it("пренебрегва всичко, което не е цифра", () => {
    expect(derivePersonalTask(" 31-47 ")).toEqual(derivePersonalTask("3147"));
  });

  it("използва само първите 4 цифри", () => {
    expect(derivePersonalTask("314799")).toEqual(derivePersonalTask("3147"));
  });

  it("връща null при по-малко от 4 цифри", () => {
    expect(derivePersonalTask("")).toBeNull();
    expect(derivePersonalTask("314")).toBeNull();
    expect(derivePersonalTask("абв")).toBeNull();
  });
});
