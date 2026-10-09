import { describe, expect, it } from "vitest";
import { decideReminder, type ReminderFacts } from "@/lib/reminders/decide";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Лятно време: България е UTC+3; зимно: UTC+2.
// 13.10.2026 е вторник, 12.10.2026 – понеделник, 11.10.2026 – неделя.
const TUESDAY_NOON = new Date("2026-10-13T09:00:00Z"); // 12:00 в София
const MONDAY_NOON = new Date("2026-10-12T09:00:00Z");

const ago = (now: Date, ms: number) =>
  new Date(now.getTime() - ms).toISOString();

/** Потребител, на когото нищо не пречи, но и няма повод за писмо. */
function facts(now: Date, over: Partial<ReminderFacts> = {}): ReminderFacts {
  return {
    remindersEnabled: true,
    hasActiveAccess: true,
    emailConfirmed: true,
    lastEmailAt: null,
    lastActivityAt: ago(now, 2 * DAY),
    createdAt: ago(now, 30 * DAY),
    dueCount: 0,
    oldestDueDays: 0,
    activeToday: false,
    resume: null,
    continueEmailsSinceLastActivity: 0,
    weeklyAlreadySentThisWeek: false,
    ...over,
  };
}
const due = { dueCount: 3, oldestDueDays: 0 };
const kindAt = (now: Date, over: Partial<ReminderFacts> = {}) =>
  decideReminder(facts(now, over), now).kind;

describe("кой никога не получава напомняне", () => {
  it("без повод няма писмо, но има причина на български", () => {
    const decision = decideReminder(facts(TUESDAY_NOON), TUESDAY_NOON);
    expect(decision).toEqual({ kind: null, reason: "няма повод за писмо" });
  });

  it.each([
    [{ remindersEnabled: false }, "изключил е напомнянията"],
    [{ hasActiveAccess: false }, "няма активен достъп"],
    [{ emailConfirmed: false }, "имейлът не е потвърден"],
  ] as const)("%o → нищо", (over, reason) => {
    const decision = decideReminder(
      facts(TUESDAY_NOON, { ...due, ...over }),
      TUESDAY_NOON,
    );
    expect(decision).toEqual({ kind: null, reason });
  });

  it("и в понеделник изключилият напомнянията не получава отчет", () => {
    expect(kindAt(MONDAY_NOON, { remindersEnabled: false })).toBeNull();
    expect(kindAt(MONDAY_NOON)).toBe("weekly");
  });

  it("нов акаунт: нищо в първите 2 дни, после – да", () => {
    const fresh = { ...due, createdAt: ago(TUESDAY_NOON, 2 * DAY - 60_000) };
    expect(decideReminder(facts(TUESDAY_NOON, fresh), TUESDAY_NOON)).toEqual({
      kind: null,
      reason: "акаунтът е на по-малко от 2 дни",
    });
    expect(
      kindAt(TUESDAY_NOON, { ...due, createdAt: ago(TUESDAY_NOON, 2 * DAY) }),
    ).toBe("review_due");
  });
});

describe("тихи часове (21:00–08:00 българско време)", () => {
  it.each([
    // лятно време (UTC+3)
    ["2026-07-15T17:59:00Z", "20:59 лятно", "review_due"],
    ["2026-07-15T18:00:00Z", "21:00 лятно", null],
    ["2026-07-15T20:30:00Z", "23:30 лятно", null],
    ["2026-07-15T04:59:00Z", "07:59 лятно", null],
    ["2026-07-15T05:00:00Z", "08:00 лятно", "review_due"],
    // зимно време (UTC+2)
    ["2026-01-15T18:59:00Z", "20:59 зимно", "review_due"],
    ["2026-01-15T19:00:00Z", "21:00 зимно", null],
    ["2026-01-15T05:59:00Z", "07:59 зимно", null],
    ["2026-01-15T06:00:00Z", "08:00 зимно", "review_due"],
    // 18:30 UTC е 21:30 през лятото (тихо), но 20:30 през зимата (може)
    ["2026-07-15T18:30:00Z", "21:30 лятно", null],
    ["2026-01-15T18:30:00Z", "20:30 зимно", "review_due"],
  ])("%s (%s) → %s", (iso, _label, expected) => {
    expect(kindAt(new Date(iso), due)).toBe(expected);
  });

  it("причината казва, че са тихи часове", () => {
    const night = new Date("2026-07-15T19:00:00Z");
    expect(decideReminder(facts(night, due), night).reason).toBe(
      "тихи часове (21:00–08:00)",
    );
  });

  it("часът на дневната задача (07:10 UTC) е извън тихите часове целогодишно", () => {
    expect(kindAt(new Date("2026-07-15T07:10:00Z"), due)).toBe("review_due");
    expect(kindAt(new Date("2026-01-15T07:10:00Z"), due)).toBe("review_due");
  });
});

describe("най-много едно писмо на 3 дни (72 часа)", () => {
  it("71 ч след последното писмо – не; точно 72 ч – да", () => {
    const at71 = { ...due, lastEmailAt: ago(TUESDAY_NOON, 71 * HOUR) };
    expect(decideReminder(facts(TUESDAY_NOON, at71), TUESDAY_NOON)).toEqual({
      kind: null,
      reason: "получил е писмо през последните 3 дни",
    });
    expect(
      kindAt(TUESDAY_NOON, {
        ...due,
        lastEmailAt: ago(TUESDAY_NOON, 72 * HOUR - 1000),
      }),
    ).toBeNull();
    expect(
      kindAt(TUESDAY_NOON, {
        ...due,
        lastEmailAt: ago(TUESDAY_NOON, 72 * HOUR),
      }),
    ).toBe("review_due");
  });

  it("седмичният отчет също се брои и също се спира от правилото", () => {
    // получил е писмо в събота → в понеделник няма отчет
    expect(
      kindAt(MONDAY_NOON, { lastEmailAt: ago(MONDAY_NOON, 48 * HOUR) }),
    ).toBeNull();
    // отчетът от понеделник спира напомнянето за повторение във вторник
    expect(
      kindAt(TUESDAY_NOON, { ...due, lastEmailAt: ago(TUESDAY_NOON, DAY) }),
    ).toBeNull();
  });
});

describe("седмичен отчет – в понеделник", () => {
  it("понеделникът се определя по българско време", () => {
    // неделя 20:59 в София
    expect(kindAt(new Date("2026-10-11T17:59:00Z"))).toBeNull();
    // понеделник 08:00 в София (05:00 UTC)
    expect(kindAt(new Date("2026-10-12T05:00:00Z"))).toBe("weekly");
    // понеделник 20:59 в София
    expect(kindAt(new Date("2026-10-12T17:59:00Z"))).toBe("weekly");
    // вторник 08:00 в София
    expect(kindAt(new Date("2026-10-13T05:00:00Z"))).toBeNull();
    // зимно време: понеделник 08:00 в София е 06:00 UTC
    expect(kindAt(new Date("2026-01-12T06:00:00Z"))).toBe("weekly");
  });

  it("само за хора с активност в последните 28 дни", () => {
    expect(
      kindAt(MONDAY_NOON, { lastActivityAt: ago(MONDAY_NOON, 28 * DAY) }),
    ).toBe("weekly");
    expect(
      kindAt(MONDAY_NOON, {
        lastActivityAt: ago(MONDAY_NOON, 28 * DAY + 1000),
      }),
    ).toBeNull();
    expect(kindAt(MONDAY_NOON, { lastActivityAt: null })).toBeNull();
  });

  it("не се праща втори път в същата седмица", () => {
    expect(kindAt(MONDAY_NOON, { weeklyAlreadySentThisWeek: true })).toBeNull();
  });

  it("има предимство пред повторението и пред „Продължи“", () => {
    const busy = {
      ...due,
      lastActivityAt: ago(MONDAY_NOON, 6 * DAY),
      resume: { sectionsSeen: 2, sectionsTotal: 7 },
    };
    expect(kindAt(MONDAY_NOON, busy)).toBe("weekly");
    // ако отчетът вече е пратен, идва ред на повторението
    expect(
      kindAt(MONDAY_NOON, { ...busy, weeklyAlreadySentThisWeek: true }),
    ).toBe("review_due");
    // неактивен от над 28 дни: без отчет, но „Продължи“ остава
    expect(
      kindAt(MONDAY_NOON, {
        lastActivityAt: ago(MONDAY_NOON, 40 * DAY),
        resume: { sectionsSeen: 2, sectionsTotal: 7 },
      }),
    ).toBe("continue");
  });
});

describe("въпроси за повторение", () => {
  it.each([
    [{ dueCount: 3, oldestDueDays: 0 }, "review_due"],
    [{ dueCount: 2, oldestDueDays: 1 }, null],
    [{ dueCount: 1, oldestDueDays: 2 }, "review_due"],
    [{ dueCount: 1, oldestDueDays: 1 }, null],
    [{ dueCount: 0, oldestDueDays: 5 }, null],
  ] as const)("%o → %s", (over, expected) => {
    expect(kindAt(TUESDAY_NOON, over)).toBe(expected);
  });

  it("не прекъсва човек, който днес вече е учил", () => {
    const decision = decideReminder(
      facts(TUESDAY_NOON, { ...due, activeToday: true }),
      TUESDAY_NOON,
    );
    expect(decision.kind).toBeNull();
    expect(decision.reason).toContain("днес вече е учил");
  });

  it("причината казва колко въпроса или от колко дни", () => {
    expect(decideReminder(facts(TUESDAY_NOON, due), TUESDAY_NOON).reason).toBe(
      "3 въпроса чакат повторение",
    );
    expect(
      decideReminder(
        facts(TUESDAY_NOON, { dueCount: 1, oldestDueDays: 4 }),
        TUESDAY_NOON,
      ).reason,
    ).toBe("въпрос чака повторение от 4 дни");
  });

  it("има предимство пред „Продължи“", () => {
    expect(
      kindAt(TUESDAY_NOON, {
        ...due,
        lastActivityAt: ago(TUESDAY_NOON, 9 * DAY),
        resume: { sectionsSeen: 2, sectionsTotal: 7 },
      }),
    ).toBe("review_due");
  });
});

describe("„Продължи откъдето спря“", () => {
  const away = (days: number, over: Partial<ReminderFacts> = {}) => ({
    lastActivityAt: ago(TUESDAY_NOON, days * DAY),
    resume: { sectionsSeen: 3, sectionsTotal: 7 },
    ...over,
  });

  it("след 5 дни без активност и с недовършена глава", () => {
    expect(
      kindAt(TUESDAY_NOON, {
        ...away(5),
        lastActivityAt: ago(TUESDAY_NOON, 5 * DAY - 1000),
      }),
    ).toBeNull();
    expect(kindAt(TUESDAY_NOON, away(5))).toBe("continue");
    expect(
      decideReminder(facts(TUESDAY_NOON, away(9)), TUESDAY_NOON).reason,
    ).toBe("няма го от 9 дни и има недовършена глава");
  });

  it("без недовършена глава няма писмо", () => {
    expect(kindAt(TUESDAY_NOON, away(8, { resume: null }))).toBeNull();
    expect(
      kindAt(
        TUESDAY_NOON,
        away(8, { resume: { sectionsSeen: 7, sectionsTotal: 7 } }),
      ),
    ).toBeNull();
  });

  it("човек без никаква активност не получава „Продължи“", () => {
    expect(kindAt(TUESDAY_NOON, away(8, { lastActivityAt: null }))).toBeNull();
  });

  it("най-много 2 писма без активност между тях, после го оставяме", () => {
    expect(
      kindAt(TUESDAY_NOON, away(8, { continueEmailsSinceLastActivity: 0 })),
    ).toBe("continue");
    expect(
      kindAt(TUESDAY_NOON, away(11, { continueEmailsSinceLastActivity: 1 })),
    ).toBe("continue");
    const third = decideReminder(
      facts(TUESDAY_NOON, away(14, { continueEmailsSinceLastActivity: 2 })),
      TUESDAY_NOON,
    );
    expect(third.kind).toBeNull();
    expect(third.reason).toContain("оставяме го");
    // след нова активност броячът е 0 и правилото важи отначало
    expect(
      kindAt(TUESDAY_NOON, away(6, { continueEmailsSinceLastActivity: 0 })),
    ).toBe("continue");
  });
});
