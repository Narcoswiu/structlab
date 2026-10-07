import { describe, expect, it } from "vitest";
import {
  LIFETIME_EXPIRY,
  computeAccessExpiry,
  computePlanExpiry,
  describePlanDuration,
  generateInviteToken,
  getInviteStatus,
  hashInviteToken,
  isValidInviteTokenFormat,
  parseEmailList,
} from "@/lib/invites";

describe("кодове за покана", () => {
  it("всеки код е различен и във валиден формат", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).not.toBe(b);
    expect(isValidInviteTokenFormat(a)).toBe(true);
  });

  it("хешът е постоянен за един код и не съдържа самия код", () => {
    const token = generateInviteToken();
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken(token)).not.toContain(token);
  });

  it("отхвърля кодове с грешна дължина или знаци", () => {
    expect(isValidInviteTokenFormat("")).toBe(false);
    expect(isValidInviteTokenFormat("abc")).toBe(false);
    expect(isValidInviteTokenFormat("a".repeat(42) + "/")).toBe(false);
    expect(isValidInviteTokenFormat("a".repeat(44))).toBe(false);
  });
});

describe("getInviteStatus", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  const base = {
    accepted_at: null,
    revoked_at: null,
    expires_at: "2026-10-21T12:00:00Z",
  };

  it("чака, докато не е приета, отменена или изтекла", () => {
    expect(getInviteStatus(base, now)).toBe("pending");
  });

  it("изтича точно в крайния момент", () => {
    expect(
      getInviteStatus({ ...base, expires_at: now.toISOString() }, now),
    ).toBe("expired");
  });

  it("приетата покана остава приета, дори да е изтекла или отменена", () => {
    expect(
      getInviteStatus(
        {
          accepted_at: "2026-10-08T00:00:00Z",
          revoked_at: "2026-10-09T00:00:00Z",
          expires_at: "2026-10-01T00:00:00Z",
        },
        now,
      ),
    ).toBe("accepted");
  });

  it("отменената покана не е активна", () => {
    expect(
      getInviteStatus({ ...base, revoked_at: "2026-10-07T00:00:00Z" }, now),
    ).toBe("revoked");
  });
});

describe("computeAccessExpiry", () => {
  it("добавя точно броя дни на плана", () => {
    const start = new Date("2026-10-07T09:30:00Z");
    expect(computeAccessExpiry(start, 14).toISOString()).toBe(
      "2026-10-21T09:30:00.000Z",
    );
  });
});

describe("планове без срок", () => {
  const start = new Date("2026-10-07T09:30:00Z");

  it("обикновен план изтича след броя си дни", () => {
    expect(
      computePlanExpiry(start, { duration_days: 14, is_lifetime: false }),
    ).toEqual(new Date("2026-10-21T09:30:00Z"));
  });

  it("план без срок пренебрегва дните и не изтича", () => {
    const expiry = computePlanExpiry(start, {
      duration_days: 14,
      is_lifetime: true,
    });
    expect(expiry).toEqual(LIFETIME_EXPIRY);
    expect(expiry.getUTCFullYear()).toBe(2999);
  });

  it("описва срока с думи", () => {
    expect(
      describePlanDuration({ duration_days: 14, is_lifetime: false }),
    ).toBe("14 дни");
    expect(
      describePlanDuration({ duration_days: 3660, is_lifetime: true }),
    ).toBe("без срок");
  });
});

describe("parseEmailList", () => {
  it("приема редове, запетаи и интервали; прави адресите с малки букви", () => {
    expect(parseEmailList("A@x.bg\n b@y.com, c@z.org;d@w.net")).toEqual({
      valid: ["a@x.bg", "b@y.com", "c@z.org", "d@w.net"],
      invalid: [],
    });
  });

  it("маха повторенията и отделя невалидните", () => {
    expect(parseEmailList("a@x.bg a@X.bg няма-кльомба @x.bg")).toEqual({
      valid: ["a@x.bg"],
      invalid: ["няма-кльомба", "@x.bg"],
    });
  });

  it("празен вход дава празни списъци", () => {
    expect(parseEmailList("  \n ")).toEqual({ valid: [], invalid: [] });
  });
});
