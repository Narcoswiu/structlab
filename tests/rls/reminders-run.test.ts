import { render } from "@react-email/render";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SendEmailInput } from "@/lib/email/send";
import {
  addDays,
  sofiaLocalToDate,
  sofiaMoment,
} from "@/lib/reminders/helpers";
import { getLocalSupabase, serviceClient } from "./helpers";

// Дневното изпращане срещу ЛОКАЛНАТА база, с фалшива „поща“ (нищо не излиза
// в мрежата). Потребителите са с адреси @reminders.test и се трият накрая.
// Главният ключ се включва само за част от тестовете и накрая е ИЗКЛЮЧЕН.

const status = getLocalSupabase();
const service = serviceClient(status);

// Кодът на сайта чете настройките си от средата: сочим го към локалната база
// и махаме всичко за SMTP, преди да го заредим.
process.env.NEXT_PUBLIC_SUPABASE_URL = status.API_URL;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = status.PUBLISHABLE_KEY;
process.env.SUPABASE_SECRET_KEY = status.SECRET_KEY;
process.env.NEXT_PUBLIC_SITE_URL = "https://structlab.example";
process.env.SMTP_HOST = "";
process.env.EMAIL_FROM = "";
const { runReminders } = await import("@/lib/reminders/run");

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// „Сега“ за тестовете: следващият вторник по обяд българско време (в бъдещето,
// за да са активни записванията, създадени в този момент), и понеделникът след него.
const real = sofiaMoment(new Date());
const tuesdayDay = addDays(real.day, (8 - real.weekday) % 7 || 7);
const TUESDAY = sofiaLocalToDate(`${tuesdayDay}T12:00`)!;
const MONDAY = sofiaLocalToDate(`${addDays(tuesdayDay, 6)}T12:00`)!;
const before = (now: Date, ms: number) =>
  new Date(now.getTime() - ms).toISOString();

type User = { id: string; email: string; token: string };
let review: User; // 3 въпроса за повторение
let resume: User; // недовършена глава, няма го от 6 дни
let unsubscribed: User; // като review, но е спрял напомнянията
let noAccess: User; // като review, но без план
let ids: string[] = [];
let chapterId: string;

async function createUser(label: string, enrolled: boolean): Promise<User> {
  const email = `${label}-${crypto.randomUUID().slice(0, 8)}@reminders.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: "reminders-test-password-1",
    email_confirm: true,
    user_metadata: { full_name: `${label} Тестов` },
  });
  if (error || !data.user) throw error ?? new Error("createUser");
  const id = data.user.id;
  // акаунтът е „стар“ – иначе важи правилото за първите 2 дни
  await service
    .from("profiles")
    .update({ created_at: before(TUESDAY, 30 * DAY) })
    .eq("id", id);
  if (enrolled) {
    const { data: plan } = await service
      .from("access_plans")
      .select("id")
      .eq("slug", "beta-free")
      .single();
    const enrollment = await service.from("enrollments").insert({
      user_id: id,
      plan_id: plan!.id,
      source: "beta",
      expires_at: new Date(MONDAY.getTime() + 30 * DAY).toISOString(),
    });
    if (enrollment.error) throw enrollment.error;
  }
  const { data: settings } = await service
    .from("user_settings")
    .select("unsubscribe_token")
    .eq("user_id", id)
    .single();
  return { id, email, token: settings!.unsubscribe_token };
}

async function giveDueReviews(userId: string, questionIds: string[]) {
  const { error } = await service.from("quiz_reviews").insert(
    questionIds.map((question_id) => ({
      user_id: userId,
      question_id,
      box: 1,
      due_on: tuesdayDay,
      attempts: 1,
      correct: 0,
      last_knew: false,
      first_answered_at: before(TUESDAY, 10 * DAY),
      last_answered_at: before(TUESDAY, 10 * DAY),
    })),
  );
  if (error) throw error;
}

const setSwitch = async (enabled: boolean) => {
  const { error } = await service
    .from("app_settings")
    .update({ value: { enabled } })
    .eq("key", "reminders");
  if (error) throw error;
};

const logRows = async () =>
  (
    await service
      .from("email_log")
      .select("user_id, kind, status, error")
      .in("user_id", ids)
      // по вид, не по ред на записване: редът на потребителите е случаен
      .order("kind", { ascending: false })
      .order("id")
  ).data ?? [];

/** Фалшива поща: помни писмата; за избрани адреси „гърми“. */
function fakeSender(failFor: string[] = []) {
  const sent: SendEmailInput[] = [];
  const send = async (input: SendEmailInput) => {
    if (failFor.includes(input.to)) {
      throw Object.assign(new Error(`550 mailbox ${input.to} unavailable`), {
        code: "EENVELOPE",
      });
    }
    sent.push(input);
  };
  return { sent, send };
}

const run = (
  now: Date,
  send: (input: SendEmailInput) => Promise<void>,
  dryRun = false,
) => runReminders({ now, send, dryRun, onlyUserIds: ids });

beforeAll(async () => {
  await setSwitch(false);
  review = await createUser("rem-review", true);
  resume = await createUser("rem-resume", true);
  unsubscribed = await createUser("rem-unsub", true);
  noAccess = await createUser("rem-noaccess", false);
  ids = [review.id, resume.id, unsubscribed.id, noAccess.id];
  await service
    .from("user_settings")
    .update({ reminders_enabled: false })
    .eq("user_id", unsubscribed.id);

  const { data: module } = await service
    .from("modules")
    .select("id")
    .eq("slug", "saprotivlenie-na-materialite")
    .single();
  const chapter = await service
    .from("chapters")
    .insert({
      module_id: module!.id,
      slug: `reminders-${crypto.randomUUID().slice(0, 8)}`,
      number: 8000 + Math.floor(Math.random() * 900),
      title: "Глава за напомняния",
      is_published: true,
    })
    .select("id")
    .single();
  if (chapter.error) throw chapter.error;
  chapterId = chapter.data.id;

  const questions = await service
    .from("quiz_questions")
    .insert(
      [
        "Колко е $M_{max}$ за проста греда?",
        "Защо гредата се огъва повече в средата?",
        "Какво показва диаграмата на момента?",
      ].map((question, index) => ({
        chapter_id: chapterId,
        mode: "easy" as const,
        key: (index + 1).toString(16).padStart(16, "0"),
        position: index + 1,
        question,
        answer: "Отговор.",
      })),
    )
    .select("id");
  if (questions.error) throw questions.error;
  const questionIds = questions.data.map((row) => row.id);

  for (const user of [review, unsubscribed, noAccess]) {
    await giveDueReviews(user.id, questionIds);
  }
  const progress = await service.from("progress").insert({
    user_id: resume.id,
    chapter_id: chapterId,
    sections_seen: ["zagadka", "vizh", "razberi"],
    last_section: "razberi",
    last_mode: "easy",
    first_opened_at: before(TUESDAY, 8 * DAY),
    last_activity_at: before(TUESDAY, 6 * DAY),
  });
  if (progress.error) throw progress.error;
});

afterAll(async () => {
  // най-важното: ключът остава ИЗКЛЮЧЕН
  await setSwitch(false);
  for (const id of ids) await service.auth.admin.deleteUser(id);
  if (chapterId) await service.from("chapters").delete().eq("id", chapterId);
});

describe("главният ключ е изключен", () => {
  it("нищо не се изпраща и нищо не се записва", async () => {
    const mail = fakeSender();
    const result = await run(TUESDAY, mail.send);
    expect(result).toMatchObject({ status: "disabled", sent: 0, items: [] });
    expect(mail.sent).toEqual([]);
    expect(await logRows()).toEqual([]);
  });

  it("пробата показва кой какво би получил, с маскирани адреси, без да записва", async () => {
    const mail = fakeSender();
    const result = await run(TUESDAY, mail.send, true);
    expect(result.status).toBe("dry-run");
    const byUser = new Map(result.items.map((item) => [item.userId, item]));
    expect(byUser.get(review.id)).toMatchObject({
      kind: "review_due",
      reason: "3 въпроса чакат повторение",
      maskedEmail: "r***@reminders.test",
    });
    expect(byUser.get(resume.id)?.kind).toBe("continue");
    expect(byUser.get(unsubscribed.id)).toMatchObject({
      kind: null,
      reason: "изключил е напомнянията",
    });
    expect(byUser.get(noAccess.id)).toMatchObject({
      kind: null,
      reason: "няма активен достъп",
    });
    // пълен адрес не излиза от функцията
    expect(JSON.stringify(result)).not.toContain(review.email);
    expect(mail.sent).toEqual([]);
    expect(await logRows()).toEqual([]);
  });
});

describe("главният ключ е включен", () => {
  beforeAll(() => setSwitch(true));
  afterAll(() => setSwitch(false));

  it("без настроена поща и без подадена „поща“ не прави нищо", async () => {
    const result = await runReminders({ now: TUESDAY, onlyUserIds: ids });
    expect(result).toMatchObject({ status: "not-configured", sent: 0 });
    expect(await logRows()).toEqual([]);
  });

  it("правилните хора получават правилните писма; грешка при един не спира другите", async () => {
    const mail = fakeSender([resume.email]);
    const result = await run(TUESDAY, mail.send);
    expect(result).toMatchObject({
      status: "done",
      considered: 4,
      sent: 1,
      failed: 1,
      deferred: 0,
    });

    expect(mail.sent).toHaveLength(1);
    const letter = mail.sent[0]!;
    expect(letter.to).toBe(review.email);
    expect(letter.subject).toBe("3 въпроса за днес – около 2 мин");
    expect(letter.headers).toEqual({
      "List-Unsubscribe": `<https://structlab.example/api/unsubscribe/${review.token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    const html = await render(letter.template);
    expect(html).toContain(
      `href="https://structlab.example/unsubscribe/${review.token}"`,
    );
    expect(html).toContain('href="https://structlab.example/review"');
    expect(html).toContain("Глава за напомняния");
    expect(html).toContain("Здравей, rem-review!");

    // в лога: вид и статус; при грешка – само класът ѝ, без адреса
    expect(await logRows()).toEqual([
      { user_id: review.id, kind: "review_due", status: "sent", error: null },
      {
        user_id: resume.id,
        kind: "continue",
        status: "failed",
        error: "EENVELOPE",
      },
    ]);
  });

  it("второ пускане в същия ден: никой не получава второ писмо (правилото за 3 дни)", async () => {
    const mail = fakeSender();
    const result = await run(TUESDAY, mail.send);
    // неуспешното писмо не се брои за изпратено – този път тръгва
    expect(result).toMatchObject({ sent: 1, failed: 0 });
    expect(mail.sent.map((letter) => letter.to)).toEqual([resume.email]);
    const letter = mail.sent[0]!;
    expect(letter.subject).toBe(
      "Остават ти няколко секции от „Глава за напомняния“",
    );
    const html = await render(letter.template);
    expect(html).toContain("Стигна до „Разбери“");
    // закачката е първият въпрос БЕЗ формули
    expect(html).toContain("Защо гредата се огъва повече в средата?");
    expect(html).not.toContain("M_{max}");
    expect(html).toContain(`/unsubscribe/${resume.token}`);

    const third = fakeSender();
    const again = await run(TUESDAY, third.send);
    expect(again).toMatchObject({ status: "done", sent: 0, failed: 0 });
    expect(third.sent).toEqual([]);
    expect(again.items.find((item) => item.userId === review.id)?.reason).toBe(
      "получил е писмо през последните 3 дни",
    );
    expect(await logRows()).toHaveLength(3);
  });

  it("71 часа по-късно още не; след 72 часа – пак може", async () => {
    const mail = fakeSender();
    const at71 = await run(
      new Date(TUESDAY.getTime() + 71 * HOUR),
      mail.send,
      true,
    );
    expect(
      at71.items.find((item) => item.userId === review.id)?.kind,
    ).toBeNull();
    const at72 = await run(
      new Date(TUESDAY.getTime() + 72 * HOUR),
      mail.send,
      true,
    );
    expect(at72.items.find((item) => item.userId === review.id)?.kind).toBe(
      "review_due",
    );
  });

  it("в понеделник тръгва седмичният отчет – веднъж", async () => {
    const mail = fakeSender();
    const result = await run(MONDAY, mail.send);
    expect(result).toMatchObject({ sent: 2, failed: 0 });
    expect(mail.sent.map((letter) => letter.to).sort()).toEqual(
      [review.email, resume.email].sort(),
    );
    const letter = mail.sent.find((item) => item.to === review.email)!;
    expect(letter.subject).toBe("Твоята седмица в StructLab");
    const html = await render(letter.template);
    // следващата стъпка за човек с въпроси за повторение
    expect(html).toContain("Повторение: 3 въпроса");
    expect(html).toContain(`/unsubscribe/${review.token}`);

    // по-късно същия понеделник и на следващия ден – нищо
    for (const later of [2 * HOUR, 24 * HOUR]) {
      const next = fakeSender();
      const rerun = await run(new Date(MONDAY.getTime() + later), next.send);
      expect(rerun).toMatchObject({ sent: 0, failed: 0 });
      expect(next.sent).toEqual([]);
    }
    const weekly = (await logRows()).filter((row) => row.kind === "weekly");
    expect(weekly).toHaveLength(2);
  });

  it("таванът на едно пускане оставя останалите за следващия ден", async () => {
    // три дни след отчета двамата пак имат повод за писмо
    const later = new Date(MONDAY.getTime() + 3 * DAY);
    const mail = fakeSender();
    const result = await runReminders({
      now: later,
      send: mail.send,
      cap: 1,
      onlyUserIds: ids,
    });
    expect(result).toMatchObject({ sent: 1, deferred: 1 });
    expect(mail.sent).toHaveLength(1);
  });
  it("изключване на ключа по средата спира изпращането веднага", async () => {
    // следващият понеделник: и двамата чакат седмичен отчет
    const later = new Date(MONDAY.getTime() + 7 * DAY);
    const sent: string[] = [];
    const result = await run(later, async (input) => {
      sent.push(input.to);
      await setSwitch(false);
    });
    expect(sent).toHaveLength(1);
    expect(result).toMatchObject({ sent: 1, deferred: 1 });
    await setSwitch(true);
  });

  it("спрелият напомнянията и човекът без достъп не получават нищо – никога", async () => {
    const rows = await logRows();
    expect(
      rows.filter(
        (row) => row.user_id === unsubscribed.id || row.user_id === noAccess.id,
      ),
    ).toEqual([]);
  });
});

describe("след тестовете", () => {
  it("главният ключ е изключен", async () => {
    const { data } = await service
      .from("app_settings")
      .select("value")
      .eq("key", "reminders")
      .single();
    expect(data?.value).toEqual({ enabled: false });
  });
});
