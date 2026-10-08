import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getLocalSupabase } from "./local-supabase";

// Лични задания: факултетен номер → вариант → задача с лични числа →
// проверка на отговорите → решено задание.

const PASSWORD = "e2e-tasks-password-1";
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
      why: violation.nodes[0]?.failureSummary?.slice(0, 200),
    })),
  ).toEqual([]);
}
const overflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

test.describe.configure({ mode: "serial" });

let email: string;
let userId: string;

test.beforeAll(async ({}, testInfo) => {
  email = `tasks-${testInfo.project.name}-${Date.now()}@structlab.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Тест Задания" },
  });
  if (error || !data.user) throw error ?? new Error("createUser");
  userId = data.user.id;
  const { data: plan } = await service
    .from("access_plans")
    .select("id")
    .eq("slug", "beta-free")
    .single();
  await service.from("enrollments").insert({
    user_id: userId,
    plan_id: plan!.id,
    source: "beta",
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
});

test.afterAll(async () => {
  await service.auth.admin.deleteUser(userId);
});

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(PASSWORD);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/dashboard$/);
});

const answer = (page: Page, name: RegExp) =>
  page.getByRole("textbox", { name });

test("факултетният номер дава вариант; самият номер не се пази", async ({
  page,
}) => {
  await expect(
    page.getByRole("region", { name: "Лични задания" }),
  ).toContainText("5 задачи с твоите числа");
  await page.getByRole("link", { name: "Задания", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Лични задания",
  );
  await expectNoViolations(page);

  // задание без вариант връща към формата
  await page.goto("/tasks/konzola");
  await expect(page).toHaveURL(/\/tasks$/);

  const form = page.getByRole("region", { name: "Въведи факултетен номер" });
  await form.getByLabel("Факултетен номер").fill("12");
  await form.getByRole("button", { name: "Покажи заданията" }).click();
  await expect(form.getByText("поне 4 цифри")).toBeVisible();

  await form.getByLabel("Факултетен номер").fill("2023 147");
  await form.getByRole("button", { name: "Покажи заданията" }).click();
  await expect(page.getByText("Вариант 1-4-7")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Задания" }).getByRole("listitem"),
  ).toHaveCount(5);
  await expect(page.getByText("решени 0 от 5")).toBeVisible();
  await expectNoViolations(page);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  const { data } = await service
    .from("task_variants")
    .select("*")
    .eq("user_id", userId)
    .single();
  expect(data).toMatchObject({ a: 1, b: 4, c: 7 });
  // в реда няма нищо друго освен трите цифри и датата
  expect(Object.keys(data!).sort()).toEqual([
    "a",
    "b",
    "c",
    "created_at",
    "user_id",
  ]);
  expect(JSON.stringify(data)).not.toContain("2023");
});

test("задачата е с моите числа и не издава отговорите", async ({ page }) => {
  await page.goto("/tasks");
  await page
    .getByRole("link", { name: /Конзола: реакции и разрезни усилия/ })
    .click();
  await expect(page).toHaveURL(/\/tasks\/konzola$/);
  await expect(page.getByText("Задание 2 · вариант 1-4-7")).toBeVisible();

  // вариант 1-4-7: l = 3,2 m; q = 12 kN/m; F = 14 kN
  const given = page.getByRole("region", { name: "Условие" });
  await expect(given).toContainText("3,2 m");
  await expect(given).toContainText("12 kN/m");
  await expect(given).toContainText("14 kN");
  await expect(given.locator("svg")).toBeVisible();

  // верните отговори (52,4; 106,24; 33,2; 37,76) ги няма никъде в страницата
  const html = await page.content();
  for (const secret of [
    "52,4",
    "52.4",
    "106,24",
    "106.24",
    "33,2",
    "33.2",
    "37,76",
    "37.76",
  ]) {
    expect(html, secret).not.toContain(secret);
  }
  await expectNoViolations(page);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test("проверката казва кои отговори са верни и дава насока за грешните", async ({
  page,
}) => {
  await page.goto("/tasks/konzola");
  const check = page.getByRole("button", { name: "Провери" });

  // нищо въведено
  await check.click();
  await expect(page.getByText("Въведи поне един отговор.")).toBeVisible();

  // текст вместо число не се брои за опит
  await answer(page, /Вертикална реакция/).fill("52,4");
  await answer(page, /Момент в запъването/).fill("сто");
  await check.click();
  await expect(page.getByText("Въведи число, например 12,5.")).toBeVisible();
  await expect(answer(page, /Вертикална реакция/)).toHaveValue("52,4");
  expect(
    (
      await service
        .from("personal_tasks")
        .select("attempts")
        .eq("user_id", userId)
    ).data,
  ).toEqual([]);

  // един верен, един грешен, един с точка вместо запетая
  await answer(page, /Момент в запъването/).fill("100");
  await answer(page, /Напречна сила в средата/).fill("33.2");
  await check.click();
  await expect(page.getByText("Верни: 2 от 4.")).toBeVisible();
  const items = page
    .getByRole("region", { name: "Отговори" })
    .getByRole("listitem");
  await expect(items.nth(0)).toContainText("вярно");
  await expect(items.nth(1)).toContainText("не е вярно");
  await expect(items.nth(1)).toContainText("Насока: Моменти спрямо запъването");
  await expect(items.nth(2)).toContainText("вярно");
  // празното поле не е отбелязано като грешно
  await expect(items.nth(3)).not.toContainText("не е вярно");
  await expectNoViolations(page);

  // втора проверка веднага след първата – спира се
  await service
    .from("personal_tasks")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("user_id", userId);
  await check.click();
  await expect(page.getByText("Изчакай няколко секунди")).toBeVisible();

  const { data } = await service
    .from("personal_tasks")
    .select("template, answers, results, attempts, solved_at")
    .eq("user_id", userId);
  expect(data).toEqual([
    {
      template: "konzola",
      answers: { A: 52.4, MA: 100, Qmid: 33.2 },
      results: { A: true, MA: false, Qmid: true, Mmid: false },
      attempts: 1,
      solved_at: null,
    },
  ]);
});

test("след презареждане отговорите са запазени; с верни числа заданието е решено", async ({
  page,
}) => {
  await page.goto("/tasks");
  await expect(page.getByRole("link", { name: /Конзола/ })).toContainText(
    "2 от 4 верни · 1 проверка",
  );
  await expect(page.getByRole("link", { name: /Конзола/ })).toContainText(
    "ЗАПОЧНАТО",
  );

  await page.goto("/tasks/konzola");
  await expect(answer(page, /Вертикална реакция/)).toHaveValue("52,4");
  await expect(answer(page, /Момент в запъването/)).toHaveValue("100");
  const items = page
    .getByRole("region", { name: "Отговори" })
    .getByRole("listitem");
  await expect(items.nth(1)).toContainText("не е вярно");

  // (предишната проверка е била преди малко – местим я назад, за да не чакаме)
  await service
    .from("personal_tasks")
    .update({ last_checked_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("user_id", userId);
  await answer(page, /Момент в запъването/).fill("106,2"); // в допуска от 0,5 %
  await answer(page, /Огъващ момент в средата/).fill("37,76");
  await page.getByRole("button", { name: "Провери" }).click();
  await expect(
    page.getByText("Всички отговори са верни – заданието е решено."),
  ).toBeVisible();
  for (let i = 0; i < 4; i++) await expect(items.nth(i)).toContainText("вярно");

  await page.goto("/tasks");
  await expect(page.getByText("решени 1 от 5")).toBeVisible();
  await expect(page.getByRole("link", { name: /Конзола/ })).toContainText(
    "РЕШЕНО",
  );
  await page.goto("/dashboard");
  await expect(
    page.getByRole("region", { name: "Лични задания" }),
  ).toContainText("Решени 1 от 5");
});

test("същият вариант не променя нищо; друг вариант изчиства отговорите", async ({
  page,
}) => {
  await page.goto("/tasks");
  await page.getByText("Сбъркал си номера? Смени го").click();
  await page.getByLabel("Факултетен номер").fill("9999147");
  await page.getByRole("button", { name: "Смени номера" }).click();
  await expect(page.getByText("Вариантът е същият")).toBeVisible();
  await expect(page.getByText("решени 1 от 5")).toBeVisible();

  await page.getByLabel("Факултетен номер").fill("2023902");
  await page.getByRole("button", { name: "Смени номера" }).click();
  await expect(page.getByText("Вариант 9-0-2")).toBeVisible();
  await expect(page.getByText("решени 0 от 5")).toBeVisible();
  expect(
    (
      await service
        .from("personal_tasks")
        .select("template")
        .eq("user_id", userId)
    ).data,
  ).toEqual([]);

  // числата в задачата вече са други: l = 3 + 0,2·9 = 4,8 m; q = 7; F = 10
  await page.goto("/tasks/konzola");
  await expect(page.getByRole("region", { name: "Условие" })).toContainText(
    "4,8 m",
  );
  await expect(answer(page, /Вертикална реакция/)).toHaveValue("");
});

test("всяко задание се отваря с фигура и четири полета", async ({ page }) => {
  for (const slug of [
    "prosta-greda",
    "konzola",
    "t-sechenie",
    "stapalovidan-prat",
    "ogavane",
  ]) {
    await page.goto(`/tasks/${slug}`);
    await expect(
      page.getByRole("region", { name: "Условие" }).locator("svg"),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Отговори" }).getByRole("textbox"),
    ).toHaveCount(4);
    expect(await overflow(page), slug).toBeLessThanOrEqual(0);
  }
  const missing = await page.goto("/tasks/nyama-takova");
  expect(missing?.status()).toBe(404);
});

test("без вход страниците не се отварят", async ({ page }) => {
  await page.request.post("/auth/signout");
  await page.goto("/tasks");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/tasks/konzola");
  await expect(page).toHaveURL(/\/login/);
});
