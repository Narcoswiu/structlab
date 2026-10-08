import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getLocalSupabase } from "./local-supabase";

// Помощникът „Попитай учебника“: без ключ за AI услуга търси само в уроците.
// Режимът с AI услуга е покрит с unit тестове (tests/ai) – тук няма ключ и
// нищо не излиза извън сайта.

const MODULE = "saprotivlenie-na-materialite";
const CHAPTER = `/learn/${MODULE}/razrezni-usiliya`;
const PASSWORD = "e2e-assistant-password-1";

const status = getLocalSupabase();
const service = createClient(status.API_URL, status.SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

test.describe.configure({ mode: "serial" });

type TestUser = { id: string; email: string };
let student: TestUser; // има активен план
let outsider: TestUser; // няма достъп до нито една глава
let hasChapters = false;

async function createUser(label: string, project: string): Promise<TestUser> {
  const email = `assistant-${label}-${project}-${Date.now()}@structlab.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Тест Помощник" },
  });
  if (error || !data.user) throw error ?? new Error("createUser");
  return { id: data.user.id, email };
}

// отделни потребители за всеки проект (десктоп и телефон вървят едновременно)
test.beforeAll(async ({}, testInfo) => {
  student = await createUser("student", testInfo.project.name);
  outsider = await createUser("outsider", testInfo.project.name);
  const { data: plan } = await service
    .from("access_plans")
    .select("id")
    .eq("slug", "beta-free")
    .single();
  await service.from("enrollments").insert({
    user_id: student.id,
    plan_id: plan!.id,
    source: "beta",
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
  // главите не са в публичното репо; без тях тестовете с откъси се пропускат
  const { count } = await service
    .from("chapters")
    .select("id", { count: "exact", head: true })
    .in("slug", ["razrezni-usiliya", "spetsialno-ogavane"])
    .eq("is_published", true);
  hasChapters = count === 2;
});

test.afterAll(async () => {
  await service.auth.admin.deleteUser(student.id);
  await service.auth.admin.deleteUser(outsider.id);
});

async function signIn(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(user.email);
  await page.getByLabel("Парола").fill(PASSWORD);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/dashboard$/);
}

const opener = (page: Page) =>
  page.getByRole("button", { name: "Попитай учебника" });
const panel = (page: Page) =>
  page.getByRole("dialog", { name: "Попитай учебника" });

async function ask(page: Page, question: string) {
  await panel(page).getByLabel("Попитай за нещо от учебника").fill(question);
  const answered = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/assistant") &&
      response.request().method() === "POST",
  );
  await panel(page).getByRole("button", { name: "Изпрати" }).click();
  return answered;
}

test("бутонът е на всяка вътрешна страница и не застъпва „Обратна връзка“", async ({
  page,
}) => {
  await signIn(page, student);
  const paths = ["/dashboard", "/labs", "/account", "/review", "/tasks"];
  if (hasChapters) paths.push(CHAPTER);
  for (const path of paths) {
    await page.goto(path);
    const assistant = opener(page);
    const feedback = page.getByRole("button", { name: "Обратна връзка" });
    await expect(assistant, path).toBeVisible();
    const a = (await assistant.boundingBox())!;
    const f = (await feedback.boundingBox())!;
    // достатъчно големи за пръст и без общи точки
    for (const box of [a, f]) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(a.x + a.width, path).toBeLessThanOrEqual(f.x);
    const viewport = page.viewportSize()!;
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.y + a.height).toBeLessThanOrEqual(viewport.height);
  }
});

test("панелът: фокус, обяснение без външни услуги, Esc затваря", async ({
  page,
}) => {
  await signIn(page, student);
  await expect(panel(page)).toHaveCount(0);
  await opener(page).click();
  const dialog = panel(page);
  await expect(dialog).toBeVisible();
  await expect(opener(page)).toHaveAttribute("aria-expanded", "true");

  // фокусът влиза в полето за въпрос
  await expect(dialog.getByLabel("Попитай за нещо от учебника")).toBeFocused();
  await expect(dialog.getByText("Питаш по целия учебник")).toBeVisible();
  await expect(
    dialog.getByText("Търси само в учебника. Въпросите не се записват."),
  ).toBeVisible();
  // нищо не излиза извън сайта: няма бележка за външна услуга, нито AI режими
  await expect(dialog.getByText(/външна AI услуга|Anthropic/)).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Обясни по-просто" }),
  ).toHaveCount(0);
  await expect(dialog.getByText(/Остават ти/)).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Какво е съпротивителен момент?" }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(opener(page)).toBeFocused();
  await expect(opener(page)).toHaveAttribute("aria-expanded", "false");

  // и бутонът „Затвори“ връща фокуса
  await opener(page).click();
  await panel(page).getByRole("button", { name: "Затвори" }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(opener(page)).toBeFocused();
});

test("въпрос от таблото → откъс от главата за огъване и връзка към секцията", async ({
  page,
}) => {
  test.skip(!hasChapters, "главите на учебника не са в локалната база");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, student);
  await opener(page).click();

  const response = await ask(page, "Какво е съпротивителен момент?");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  // заявката носи само въпроса – без режим и без история
  expect(response.request().postDataJSON()).toEqual({
    question: "Какво е съпротивителен момент?",
  });

  const dialog = panel(page);
  await expect(
    dialog.getByText("Ето какво пише в учебника по въпроса ти:"),
  ).toBeVisible();
  const excerpts = dialog.getByRole("article");
  expect(await excerpts.count()).toBeGreaterThanOrEqual(1);
  expect(await excerpts.count()).toBeLessThanOrEqual(3);

  const bending = excerpts.filter({ hasText: "Глава 4 „Специално огъване" });
  await expect(bending.first()).toContainText("съпротивителен момент");
  // формулите са изписани с KaTeX, а не като суров текст
  await expect(bending.first().locator(".katex").first()).toBeVisible();
  await expect(dialog.getByText("$$")).toHaveCount(0);
  // отговорите от „Провери се“ и суровите означения не се показват
  await expect(dialog.getByText(":::")).toHaveCount(0);

  // достъпност и ширина с отворен панел и резултати
  await expectNoViolations(page);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const box = (await dialog.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);

  // връзката води в главата, на правилната секция
  const link = bending
    .first()
    .getByRole("link", { name: "Отвори в Глава 4 →" });
  await expect(link).toHaveAttribute(
    "href",
    new RegExp(
      `^/learn/${MODULE}/spetsialno-ogavane\\?mode=(easy|detailed)#[a-z]+$`,
    ),
  );
  const href = (await link.getAttribute("href"))!;
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${href.replace("?", "\\?")}$`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Специално огъване",
  );
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator(`h2#${href.split("#")[1]}`)).toBeInViewport();

  // въпросите не се записват и AI броячът не се пипа
  const usage = await service
    .from("ai_usage")
    .select("requests")
    .eq("user_id", student.id);
  expect(usage.data).toEqual([]);
});

test("на страница на глава пита по нея; готовите въпроси работят", async ({
  page,
}) => {
  test.skip(!hasChapters, "главите на учебника не са в локалната база");
  await signIn(page, student);
  await page.goto(`${CHAPTER}?mode=easy`);
  await opener(page).click();
  const dialog = panel(page);
  await expect(
    dialog.getByText("Питаш по: Глава 1 „Разрезни усилия в греди“"),
  ).toBeVisible();

  const answered = page.waitForResponse((response) =>
    response.url().endsWith("/api/assistant"),
  );
  await dialog
    .getByRole("button", { name: "Какво е метод на сечението?" })
    .click();
  const response = await answered;
  expect(response.request().postDataJSON()).toEqual({
    question: "Какво е метод на сечението?",
    context: { module: MODULE, chapter: "razrezni-usiliya", mode: "easy" },
  });

  const first = dialog.getByRole("article").first();
  await expect(first).toContainText("Глава 1 „Разрезни усилия в греди“");
  await expect(first).toContainText("Метод на сечението");
  await expect(first).toContainText("метод на сечението");
  await expect(
    first.getByRole("link", { name: "Отвори в Глава 1 →" }),
  ).toHaveAttribute("href", `${CHAPTER}?mode=easy#razberi`);

  // достъпност на панела върху страницата на четеца
  await expectNoViolations(page);
});

test("въпрос извън учебника: ясно съобщение и връзка към главите", async ({
  page,
}) => {
  test.skip(!hasChapters, "главите на учебника не са в локалната база");
  await signIn(page, student);
  await opener(page).click();
  const response = await ask(page, "Колко е часът в Токио?");
  expect(await response.json()).toEqual({
    kind: "lessons",
    excerpts: [],
    related: [],
    noAccess: false,
  });
  const dialog = panel(page);
  await expect(
    dialog.getByText(
      "Не намерих това в учебника. Опитай с други думи или виж списъка с главите.",
    ),
  ).toBeVisible();
  await expect(dialog.getByRole("article")).toHaveCount(0);
  await expect(
    dialog.getByRole("link", { name: "Списък с главите →" }),
  ).toHaveAttribute("href", "/dashboard");

  // „близки глави“ при непознат термин се проверяват с unit тестове върху
  // примерни глави – тук зависят от това кои глави вече са написани.
});

test("потребител без достъп вижда бутона, но не получава съдържание", async ({
  page,
}) => {
  await signIn(page, outsider);
  await opener(page).click();
  const response = await ask(page, "Какво е съпротивителен момент?");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    kind: "lessons",
    excerpts: [],
    related: [],
    noAccess: true,
  });
  const dialog = panel(page);
  await expect(
    dialog.getByText(
      "В момента нямаш достъп до учебника, затова няма в какво да търся.",
    ),
  ).toBeVisible();
  await expect(dialog.getByRole("article")).toHaveCount(0);
  await expect(dialog.getByText("съпротивителен момент")).toHaveCount(1); // само въпросът му
});

test("невалидна заявка се отхвърля; без вход – 401", async ({
  page,
  playwright,
  baseURL,
}) => {
  await signIn(page, student);
  // от името на влезлия потребител
  for (const data of [
    {},
    { question: "" },
    { question: "а".repeat(1501) },
    { question: "ок", mode: "hack" },
    { question: "ок", extra: true },
  ]) {
    const response = await page.request.post("/api/assistant", { data });
    expect(response.status()).toBe(400);
  }
  const huge = await page.request.post("/api/assistant", {
    data: { question: "ок", junk: "x".repeat(40_000) },
  });
  expect(huge.status()).toBe(413);

  // без бисквитки
  const anonymous = await playwright.request.newContext({ baseURL });
  const response = await anonymous.post("/api/assistant", {
    data: { question: "Какво е съпротивителен момент?" },
  });
  expect(response.status()).toBe(401);
  expect(await response.text()).toBe("");
  await anonymous.dispose();
});
