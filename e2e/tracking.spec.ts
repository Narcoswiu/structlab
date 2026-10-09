import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, getLocalSupabase } from "./local-supabase";

const CHAPTER = "/learn/saprotivlenie-na-materialite/razrezni-usiliya";
const student = {
  email: `track-${Date.now()}-${Math.floor(Math.random() * 1e6)}@structlab.test`,
  password: "track-password-1",
  id: "",
};

function service() {
  const supabase = getLocalSupabase();
  return createClient(supabase.API_URL, supabase.SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const eventsOf = async (userId: string) =>
  (
    await service()
      .from("events")
      .select("type, section, mode, lab")
      .eq("user_id", userId)
  ).data ?? [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const db = service();
  const created = await db.auth.admin.createUser({
    email: student.email,
    password: student.password,
    email_confirm: true,
    user_metadata: { full_name: "Следа Тестова" },
  });
  student.id = created.data.user!.id;
  const { data: plan } = await db
    .from("access_plans")
    .select("id")
    .eq("slug", "founders-free")
    .single();
  await db.from("enrollments").insert({
    user_id: student.id,
    plan_id: plan!.id,
    source: "beta",
    expires_at: "2999-12-31T00:00:00Z",
  });
});

async function signIn(
  page: Page,
  email = student.email,
  password = student.password,
) {
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(password);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/dashboard$/);
}

const notice = (page: Page) =>
  page.getByRole("region", { name: "Известие за проследяване на ученето" });

test("преди известието да е потвърдено, нищо не се записва", async ({
  page,
}) => {
  await signIn(page);
  await expect(notice(page)).toBeVisible();
  await expect(
    notice(page).getByRole("link", { name: /Политиката за поверителност/ }),
  ).toHaveAttribute("href", "/privacy");

  await page.goto(CHAPTER);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/labs/beam");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(1500);

  expect(await eventsOf(student.id)).toEqual([]);
  const settings = await service()
    .from("user_settings")
    .select("tracking_notice_accepted_at")
    .eq("user_id", student.id)
    .single();
  expect(settings.data!.tracking_notice_accepted_at).toBeNull();
});

test("потвърждението се записва с дата и известието не се показва повече", async ({
  page,
}) => {
  await signIn(page);
  await notice(page).getByRole("button", { name: "Разбрах, продължи" }).click();
  await expect(notice(page)).toHaveCount(0);

  const settings = await service()
    .from("user_settings")
    .select("tracking_notice_accepted_at")
    .eq("user_id", student.id)
    .single();
  const acceptedAt = new Date(
    settings.data!.tracking_notice_accepted_at!,
  ).getTime();
  expect(Date.now() - acceptedAt).toBeLessThan(60_000);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(notice(page)).toHaveCount(0);
  await page.goto("/account");
  await expect(notice(page)).toHaveCount(0);
});

test("четенето записва отваряне и видени секции; таблото показва прогрес и „Продължи“", async ({
  page,
}) => {
  await signIn(page);
  await expect(
    page.getByRole("region", { name: "Продължи откъдето спря" }),
  ).toHaveCount(0);

  await page.goto(`${CHAPTER}?mode=easy`);
  // минаваме през първите три секции, като всяка стига до горния край на екрана
  for (const title of ["Загадка", "Виж", "Разбери"]) {
    await page
      .getByRole("heading", { level: 2, name: title, exact: true })
      .evaluate((heading) => heading.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(400);
  }
  await expect
    .poll(
      async () =>
        (await eventsOf(student.id)).filter((e) => e.type === "section_view")
          .length,
      {
        timeout: 10_000,
      },
    )
    .toBeGreaterThanOrEqual(2);

  const events = await eventsOf(student.id);
  expect(events).toContainEqual({
    type: "login",
    section: null,
    mode: null,
    lab: null,
  });
  expect(events).toContainEqual({
    type: "chapter_open",
    section: null,
    mode: "easy",
    lab: null,
  });
  expect(events).toContainEqual({
    type: "section_view",
    section: "zagadka",
    mode: "easy",
    lab: null,
  });

  await page.goto("/dashboard");
  const resume = page.getByRole("region", { name: "Продължи откъдето спря" });
  await expect(resume).toContainText("Разрезни усилия в греди");
  await expect(resume.getByRole("progressbar")).toHaveAttribute(
    "aria-valuemax",
    "7",
  );
  expect(
    Number(await resume.getByRole("progressbar").getAttribute("aria-valuenow")),
  ).toBeGreaterThanOrEqual(2);

  await resume.getByRole("link", { name: "Продължи" }).click();
  await expect(page).toHaveURL(/razrezni-usiliya\?mode=easy#[a-z]+$/);
});

test("смяната на режима и отварянето на лаборатория се записват; числата в лабораторията – не", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${CHAPTER}?mode=easy`);
  await page.getByRole("button", { name: "Подробно" }).click();
  await expect(page).toHaveURL(/mode=detailed/);
  await page.goto("/labs/beam");
  await page.getByLabel("F1 (надолу), kN").fill("77");
  await page.goto("/labs/section");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await expect
    .poll(
      async () =>
        (await eventsOf(student.id)).filter((e) => e.type === "lab_open")
          .length,
    )
    .toBe(2);
  const events = await eventsOf(student.id);
  expect(events).toContainEqual({
    type: "mode_toggle",
    section: null,
    mode: "detailed",
    lab: null,
  });
  expect(events).toContainEqual({
    type: "lab_open",
    section: null,
    mode: null,
    lab: "beam",
  });
  expect(events).toContainEqual({
    type: "lab_open",
    section: null,
    mode: null,
    lab: "section",
  });
  expect(JSON.stringify(events)).not.toContain("77");
});

test("/api/events приема само валидни събития", async ({ page, request }) => {
  // без вход
  const anonymous = await request.post("/api/events", {
    data: { type: "lab_open", lab: "beam" },
  });
  expect(anonymous.status()).toBe(401);

  await signIn(page);
  const post = (data: unknown) => page.request.post("/api/events", { data });

  expect((await post({ type: "lab_open", lab: "beam" })).status()).toBe(204);
  // всяка лаборатория има свой идентификатор
  for (const lab of ["section", "stresses", "deflection", "buckling"]) {
    expect((await post({ type: "lab_open", lab })).status()).toBe(204);
  }
  // непознат вид, „login“ отвън, излишно поле, непозната секция, непозната лаборатория
  for (const bad of [
    { type: "something" },
    { type: "login" },
    { type: "lab_open", lab: "beam", userId: "x" },
    { type: "lab_open", lab: "../etc" },
    { type: "lab_open", lab: "torsion" },
    {
      type: "section_view",
      module: "saprotivlenie-na-materialite",
      chapter: "razrezni-usiliya",
      mode: "easy",
      section: "hack",
    },
    { type: "heartbeat", module: "UPPER", chapter: "razrezni-usiliya" },
    "not-an-object",
  ]) {
    expect((await post(bad)).status(), JSON.stringify(bad)).toBe(400);
  }
  const broken = await page.request.post("/api/events", {
    headers: { "content-type": "application/json" },
    data: "{not json",
  });
  expect(broken.status()).toBe(400);

  // несъществуваща глава
  expect(
    (
      await post({
        type: "heartbeat",
        module: "saprotivlenie-na-materialite",
        chapter: "nyama-takava",
      })
    ).status(),
  ).toBe(404);
});

test("лимит: над 30 събития в минута се отказват с 429", async ({ page }) => {
  // отделен потребител, за да не се смесва с историята на другите тестове
  const db = service();
  const email = `limit-${Date.now()}@structlab.test`;
  const created = await db.auth.admin.createUser({
    email,
    password: "limit-password-1",
    email_confirm: true,
  });
  const userId = created.data.user!.id;
  const { data: plan } = await db
    .from("access_plans")
    .select("id")
    .eq("slug", "founders-free")
    .single();
  await db.from("enrollments").insert({
    user_id: userId,
    plan_id: plan!.id,
    source: "beta",
    expires_at: "2999-12-31T00:00:00Z",
  });
  await db
    .from("user_settings")
    .update({ tracking_notice_accepted_at: new Date().toISOString() })
    .eq("user_id", userId);

  await signIn(page, email, "limit-password-1");
  const statuses: number[] = [];
  for (let i = 0; i < 34; i++) {
    const response = await page.request.post("/api/events", {
      data: {
        type: "heartbeat",
        module: "saprotivlenie-na-materialite",
        chapter: "razrezni-usiliya",
      },
    });
    statuses.push(response.status());
  }
  // входът в началото вече е едно събитие за тази минута → 29 пулса минават
  expect(statuses.filter((code) => code === 204)).toHaveLength(29);
  expect(statuses.slice(29)).toEqual([429, 429, 429, 429, 429]);
  expect(await eventsOf(userId)).toHaveLength(30);
});

test("потребител без достъп до главата не може да записва събития за нея", async ({
  page,
}) => {
  const db = service();
  const email = `noaccess-${Date.now()}@structlab.test`;
  const created = await db.auth.admin.createUser({
    email,
    password: "noaccess-password-1",
    email_confirm: true,
  });
  await db
    .from("user_settings")
    .update({ tracking_notice_accepted_at: new Date().toISOString() })
    .eq("user_id", created.data.user!.id);

  await signIn(page, email, "noaccess-password-1");
  const response = await page.request.post("/api/events", {
    data: {
      type: "chapter_open",
      module: "saprotivlenie-na-materialite",
      chapter: "razrezni-usiliya",
      mode: "easy",
    },
  });
  expect(response.status()).toBe(404);
  expect(
    (await eventsOf(created.data.user!.id)).filter((e) => e.type !== "login"),
  ).toEqual([]);
});

test("нощната задача е защитена и преизчислява обобщенията", async ({
  request,
}) => {
  expect((await request.get("/api/cron/aggregate")).status()).toBe(401);
  expect(
    (
      await request.get("/api/cron/aggregate", {
        headers: { authorization: "Bearer wrong" },
      })
    ).status(),
  ).toBe(401);

  const run = () =>
    request.get("/api/cron/aggregate", {
      headers: { authorization: "Bearer e2e-cron-secret-0123456789" },
    });
  const snapshot = async () =>
    (
      await service()
        .from("progress")
        .select("chapter_id, sections_seen, seconds")
        .eq("user_id", student.id)
        .order("chapter_id")
    ).data;

  // Първото пускане преизчислява всичко от суровите събития.
  const first = await run();
  expect(first.status()).toBe(200);
  expect(await first.json()).toMatchObject({ ok: true, purged: 0 });
  const rebuilt = await snapshot();
  expect(rebuilt!.length).toBeGreaterThan(0);

  // Второто пускане не променя нищо: задачата може да се повтаря безопасно.
  expect((await run()).status()).toBe(200);
  expect(await snapshot()).toEqual(rebuilt);
});

test("admin вижда активността, времевата линия и сваля CSV", async ({
  page,
}) => {
  await signIn(page, E2E_ADMIN.email, E2E_ADMIN.password);
  await page.goto("/admin");
  await page
    .getByRole("link", { name: "Активност на потребителите →" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Активност" }),
  ).toBeVisible();

  await expect(page.getByText("Активни за 7 дни")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Графика по дни" }).getByRole("listitem"),
  ).toHaveCount(14);

  const row = page.getByRole("row").filter({ hasText: student.email });
  await expect(row.getByText("АКТИВЕН", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Докъде стигат в четенето" }),
  ).toContainText("Разрезни усилия в греди");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Изтегли CSV" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^structlab-aktivnost-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const csv = await (
    await download.createReadStream()
  )
    .toArray()
    .then((chunks) => Buffer.concat(chunks).toString("utf8"));
  expect(csv).toContain('"Имейл","Име","Специалност"');
  expect(csv).toContain(`"${student.email}"`);

  await row.getByRole("link", { name: /Времева линия на/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    student.email,
  );
  const timeline = page.getByRole("list", { name: "Времева линия" });
  await expect(timeline).toContainText("Отвори глава");
  await expect(timeline).toContainText("Разрезни усилия в греди");
  await expect(timeline).toContainText("Отвори лаборатория");
  await expect(timeline).not.toContainText("Чете");
});

test("студент няма достъп до админ страниците за активност", async ({
  page,
}) => {
  await signIn(page);
  for (const path of [
    "/admin/activity",
    `/admin/activity/${student.id}`,
    "/admin/activity/export",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
});
