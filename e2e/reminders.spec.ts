import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { E2E_ADMIN, getLocalSupabase } from "./local-supabase";

// Напомняния по имейл: ключът в профила, страницата за отписване, разделът в
// админ панела и дневната задача. Сайтът под тест няма настроена поща –
// нито едно писмо не тръгва.

const PASSWORD = "e2e-reminders-password-1";
const CRON_SECRET = "e2e-cron-secret-0123456789";
const DAY = 24 * 60 * 60 * 1000;

const status = getLocalSupabase();
const service = createClient(status.API_URL, status.SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sofiaToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia" }).format(
    new Date(),
  );

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((violation) => ({
      rule: violation.id,
      example: violation.nodes[0]?.target.join(" "),
      html: violation.nodes[0]?.html.slice(0, 160),
      why: violation.nodes[0]?.failureSummary?.slice(0, 200),
    })),
  ).toEqual([]);
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

const remindersEnabled = async (userId: string) =>
  (
    await service
      .from("user_settings")
      .select("reminders_enabled")
      .eq("user_id", userId)
      .single()
  ).data?.reminders_enabled;

const switchEnabled = async () =>
  (
    await service
      .from("app_settings")
      .select("value")
      .eq("key", "reminders")
      .single()
  ).data?.value?.enabled;

test.describe.configure({ mode: "serial" });

// отделни потребители за всеки проект (десктоп и телефон вървят едновременно)
let student: { id: string; email: string; token: string };
let prepared: { id: string; name: string };

async function createUser(email: string, fullName: string) {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error("createUser");
  const { data: plan } = await service
    .from("access_plans")
    .select("id")
    .eq("slug", "beta-free")
    .single();
  await service.from("enrollments").insert({
    user_id: data.user.id,
    plan_id: plan!.id,
    source: "beta",
    starts_at: new Date(Date.now() - 60 * DAY).toISOString(),
    expires_at: new Date(Date.now() + 30 * DAY).toISOString(),
  });
  return data.user.id;
}

test.beforeAll(async ({}, testInfo) => {
  const tag = `${testInfo.project.name}-${Date.now()}`;
  const email = `reminders-${tag}@structlab.test`;
  const id = await createUser(email, "Тест Напомняния");
  const { data: settings } = await service
    .from("user_settings")
    .select("unsubscribe_token")
    .eq("user_id", id)
    .single();
  student = { id, email, token: settings!.unsubscribe_token };

  // „Подготвен“ потребител: стар акаунт с три въпроса за повторение от днес
  // и без скорошна активност → правилата трябва да му отредят „Повторение“.
  const name = `Подготвен ${tag}`;
  const preparedId = await createUser(`prepared-${tag}@structlab.test`, name);
  prepared = { id: preparedId, name };
  await service
    .from("profiles")
    .update({ created_at: new Date(Date.now() - 60 * DAY).toISOString() })
    .eq("id", preparedId);
  const { data: questions } = await service
    .from("quiz_questions")
    .select("id, chapters!inner(is_published)")
    .eq("chapters.is_published", true)
    .limit(3);
  expect(questions).toHaveLength(3);
  const answeredAt = new Date(Date.now() - 40 * DAY).toISOString();
  const reviews = await service.from("quiz_reviews").insert(
    questions!.map((question) => ({
      user_id: preparedId,
      question_id: question.id,
      box: 1,
      due_on: sofiaToday(),
      attempts: 1,
      correct: 0,
      last_knew: false,
      first_answered_at: answeredAt,
      last_answered_at: answeredAt,
    })),
  );
  if (reviews.error) throw reviews.error;
});

test.afterAll(async ({}, testInfo) => {
  if (student) await service.auth.admin.deleteUser(student.id);
  if (prepared) await service.auth.admin.deleteUser(prepared.id);
  // ключът се пипа само в проекта „desktop“ – там се и връща на ИЗКЛЮЧЕНО
  if (testInfo.project.name === "desktop") {
    await service
      .from("app_settings")
      .update({ value: { enabled: false } })
      .eq("key", "reminders");
  }
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(password);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/dashboard$/);
}

test("профил: ключът „Напомняния по имейл“ сменя настройката", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, student.email, PASSWORD);
  await page.goto("/account");

  const section = page.getByRole("region", { name: "Напомняния по имейл" });
  await expect(section).toContainText("Най-много едно писмо на три дни");
  const toggle = section.getByRole("switch", { name: "Напомняния по имейл" });
  await expect(toggle).toBeChecked();
  await expect(toggle).toContainText("Включени");
  await expectNoViolations(page);
  await expectNoOverflow(page);

  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect(toggle).toContainText("Изключени");
  expect(await remindersEnabled(student.id)).toBe(false);
  await expectNoViolations(page);

  // настройката се помни след презареждане и се включва обратно
  await page.reload();
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();
  expect(await remindersEnabled(student.id)).toBe(true);
});

test("отписване: отварянето на линка не спира нищо, бутонът спира", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await remindersEnabled(student.id)).toBe(true);

  // без вход; само GET – както го отваря скенерът на пощата
  await page.goto(`/unsubscribe/${student.token}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Спиране на напомнянията",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  // адресът от заглавката на писмото, отворен в браузър, също не спира нищо
  const viaHeader = await request.get(`/api/unsubscribe/${student.token}`);
  expect(viaHeader.status()).toBe(200);
  expect(viaHeader.url()).toContain(`/unsubscribe/${student.token}`);
  expect(await remindersEnabled(student.id)).toBe(true);
  // заглавието на страницата пристига след съдържанието – изчакваме го
  await expect(page).toHaveTitle(/Спиране на напомнянията/);
  await expectNoViolations(page);
  await expectNoOverflow(page);

  await page.getByRole("button", { name: "Спри напомнянията" }).click();
  await expect(page).toHaveURL(/\?done=1$/);
  const confirmation =
    "Готово. Ако линкът е от наше писмо, напомнянията по имейл за този акаунт са спрени.";
  await expect(page.getByText(confirmation)).toBeVisible();
  expect(await remindersEnabled(student.id)).toBe(false);
  await expect(page).toHaveTitle(/Спиране на напомнянията/);
  await expectNoViolations(page);
  await expectNoOverflow(page);

  // второ натискане не променя нищо и не дава грешка
  await page.goto(`/unsubscribe/${student.token}`);
  await page.getByRole("button", { name: "Спри напомнянията" }).click();
  await expect(page.getByText(confirmation)).toBeVisible();
  expect(await remindersEnabled(student.id)).toBe(false);

  // несъществуващ и счупен код: същата страница и същото потвърждение
  for (const token of [crypto.randomUUID(), "ne-e-kod"]) {
    await page.goto(`/unsubscribe/${token}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Спиране на напомнянията",
    );
    await page.getByRole("button", { name: "Спри напомнянията" }).click();
    await expect(page.getByText(confirmation)).toBeVisible();
  }
});

test("отписване с едно натискане от пощенския клиент (POST без вход)", async ({
  request,
}) => {
  await service
    .from("user_settings")
    .update({ reminders_enabled: true })
    .eq("user_id", student.id);

  const response = await request.post(`/api/unsubscribe/${student.token}`, {
    form: { "List-Unsubscribe": "One-Click" },
  });
  expect(response.status()).toBe(200);
  expect(await remindersEnabled(student.id)).toBe(false);

  // непознат код: същият отговор
  const unknown = await request.post(`/api/unsubscribe/${crypto.randomUUID()}`);
  expect(unknown.status()).toBe(200);
  expect(await unknown.json()).toEqual(await response.json());
});

test("дневната задача е затворена без тайната", async ({ request }) => {
  expect((await request.get("/api/cron/reminders")).status()).toBe(401);
  const wrong = await request.get("/api/cron/reminders", {
    headers: { authorization: "Bearer greshna-taina" },
  });
  expect(wrong.status()).toBe(401);
});

test("админ: раздел „Напомняния“, проба и преглед на писмата", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, E2E_ADMIN.email, E2E_ADMIN.password);
  await page.goto("/admin");
  const panel = page.getByRole("region", { name: "Напомняния", exact: true });
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText(
    "Напомняния",
  );

  // без настроена поща пробните писма са изключени, с обяснение
  await expect(panel).toContainText("Пощата не е настроена");
  const testButtons = panel.getByRole("button", {
    name: /Изпрати ми пробно писмо/,
  });
  await expect(testButtons).toHaveCount(4);
  for (const button of await testButtons.all()) {
    await expect(button).toBeDisabled();
  }

  // „Какво би се изпратило“ към днес по обяд (извън тихите часове)
  await panel
    .getByLabel("Към друг момент (по избор)")
    .fill(`${sofiaToday()}T12:00`);
  await panel.getByRole("button", { name: "Провери" }).click();
  const result = panel.getByRole("status", { name: "Резултат от пробата" });
  await expect(result).toContainText("ще получат писмо");
  const row = result.getByRole("listitem").filter({ hasText: prepared.name });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Повторение");
  await expect(row).toContainText("3 въпроса чакат повторение");
  // адресът е маскиран
  await expect(row).toContainText("p***@structlab.test");
  await expect(result).not.toContainText("prepared-");
  await expectNoViolations(page);
  await expectNoOverflow(page);

  // пробата не изпраща и не записва нищо
  const { data: log } = await service
    .from("email_log")
    .select("id")
    .eq("user_id", prepared.id);
  expect(log).toEqual([]);

  // четирите писма се виждат в браузъра с примерни данни
  for (const [template, text] of [
    ["review", "Днес за повторение"],
    ["continue", "Продължи откъдето спря"],
    ["weekly", "Твоята седмица"],
    ["new-chapter", "Изкълчване на пръти"],
  ] as const) {
    const preview = await page.request.get(
      `/admin/email-preview?template=${template}`,
    );
    expect(preview.status()).toBe(200);
    const html = await preview.text();
    expect(html).toContain(text);
    expect(html).toContain("Спри напомнянията");
  }
  // без параметър остава поканата
  const invite = await page.request.get("/admin/email-preview");
  expect(await invite.text()).toContain("Покана");
});

test("админ: главният ключ е изключен и се включва само с отметка", async ({
  page,
  request,
}, testInfo) => {
  // ключът е един за цялата база – пипа го само един проект
  test.skip(testInfo.project.name !== "desktop", "само на десктоп");

  expect(await switchEnabled()).toBe(false);
  // с тайната, при изключен ключ: задачата не прави нищо и го казва
  const cron = await request.get("/api/cron/reminders", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(cron.status()).toBe(200);
  expect(await cron.json()).toEqual({ ok: true, status: "изключено", sent: 0 });

  await signIn(page, E2E_ADMIN.email, E2E_ADMIN.password);
  await page.goto("/admin");
  const panel = page.getByRole("region", { name: "Напомняния", exact: true });
  await expect(panel.getByText("ИЗКЛЮЧЕНИ", { exact: true })).toBeVisible();

  // без отметката ключът не се включва
  await panel.getByRole("button", { name: "Включи напомнянията" }).click();
  await expect(panel.getByRole("alert")).toContainText(
    "Отметни „Разбирам, че студентите ще започнат да получават писма“",
  );
  expect(await switchEnabled()).toBe(false);

  try {
    await panel
      .getByLabel("Разбирам, че студентите ще започнат да получават писма")
      .check();
    await panel.getByRole("button", { name: "Включи напомнянията" }).click();
    await expect(panel.getByText("ВКЛЮЧЕНИ", { exact: true })).toBeVisible();
    expect(await switchEnabled()).toBe(true);
    await expect(panel).toContainText("от Тест Админ");

    // и при включен ключ тук не тръгва нищо: пощата не е настроена
    const cronOn = await request.get("/api/cron/reminders", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(await cronOn.json()).toEqual({
      ok: true,
      status: "пощата не е настроена",
      sent: 0,
    });

    await panel.getByRole("button", { name: "Изключи напомнянията" }).click();
    await expect(panel.getByText("ИЗКЛЮЧЕНИ", { exact: true })).toBeVisible();
    expect(await switchEnabled()).toBe(false);
  } finally {
    await service
      .from("app_settings")
      .update({ value: { enabled: false } })
      .eq("key", "reminders");
  }
});
