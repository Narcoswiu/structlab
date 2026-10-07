import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { E2E_READER, getLocalSupabase } from "./local-supabase";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(password);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/dashboard$/);
}

const result = (page: Page) => page.getByRole("region", { name: "Резултат" });

test("без вход лабораторията не се отваря", async ({ page }) => {
  await page.goto("/labs/beam");
  await expect(page).toHaveURL(/\/login/);
});

test("от менюто се стига до лабораторията; примерът по подразбиране е от учебника", async ({
  page,
}) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  await page.getByRole("link", { name: "Лаборатории" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Лаборатории" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Отвори лабораторията →" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/labs\/beam$/);

  await expect(result(page).locator("svg")).toBeVisible();
  await expect(result(page)).toContainText("A = 18 kN");
  await expect(result(page)).toContainText("B = 12 kN");
  await expect(result(page)).toContainText("43,2 kN·m");
  await expect(result(page)).toContainText("при x = 2,4 m");
});

test("промяна на числата преизчислява веднага – и с десетична запетая", async ({
  page,
}) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  await page.goto("/labs/beam");

  // сила 40 kN по средата на 6 m: реакции по 20, M = 20·3 = 60
  await page.getByLabel("F1 (надолу), kN").fill("40");
  await page.getByLabel("при x, m").fill("3");
  await expect(result(page)).toContainText("A = 20 kN");
  await expect(result(page)).toContainText("60 kN·m");

  // дължина 7,5 m: B = 40·3/7,5 = 16; A = 24; M = 24·3 = 72
  await page.getByLabel("Дължина L, m").fill("7,5");
  await expect(result(page)).toContainText("B = 16 kN");
  await expect(result(page)).toContainText("72 kN·m");
});

test("невалидни данни дават ясно съобщение, без да счупят страницата", async ({
  page,
}) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  await page.goto("/labs/beam");

  await page.getByLabel("при x, m").fill("9");
  await expect(result(page).getByRole("alert")).toHaveText(
    "Има товар извън гредата.",
  );
  await expect(result(page).locator("svg")).toHaveCount(0);

  await page.getByLabel("при x, m").fill("абв");
  await expect(page.getByLabel("при x, m")).toHaveAttribute(
    "aria-invalid",
    "true",
  );

  await page.getByLabel("при x, m").fill("2");
  await expect(result(page).locator("svg")).toBeVisible();
  await expect(result(page)).toContainText("A = 20 kN");
});

test("видове греди, добавяне и махане на товари", async ({ page }) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  await page.goto("/labs/beam");

  // готовият пример „Конзола“ е пример 3 от Глава 1
  await page.getByRole("button", { name: "Конзола" }).first().click();
  await expect(result(page)).toContainText("A = 34 kN");
  await expect(result(page)).toContainText("−66 kN·m");
  await expect(result(page).getByText("Момент в запъването")).toBeVisible();

  // махаме силата на края: остава q = 8 на 3 m → M_A = −36
  await page.getByRole("button", { name: "Премахни товар 2" }).click();
  await expect(result(page)).toContainText("−36 kN·m");

  // добавяме съсредоточен момент 10 по часовниковата: M_A = −36 − 10 = −46
  await page.getByRole("button", { name: "Момент" }).click();
  await expect(result(page)).toContainText("−46 kN·m");

  // греда с конзола – пример 4
  await page.getByRole("button", { name: "Греда с конзола" }).first().click();
  await expect(result(page)).toContainText("A = −3 kN");
  await expect(result(page)).toContainText("B = 15 kN");
});

test("решението стъпка по стъпка показва сметките с числата", async ({
  page,
}) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  await page.goto("/labs/beam");

  await expect(page.getByText("B · 6 = 30 · 2,4 = 72")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Покажи решението стъпка по стъпка" })
    .click();
  await expect(page.getByText("B · 6 = 30 · 2,4 = 72")).toBeVisible();
  await expect(page.getByText("B = 72 / 6 = 12 kN")).toBeVisible();
  await expect(page.getByText("A = 30 − 12 = 18 kN")).toBeVisible();
  await expect(
    page.getByText("Резултатът е нула – реакциите са верни."),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "18 | −12" })).toBeVisible();

  // решението следва промените в данните
  await page.getByLabel("F1 (надолу), kN").fill("60");
  await expect(page.getByText("B · 6 = 60 · 2,4 = 144")).toBeVisible();

  await page.getByRole("button", { name: "Скрий решението" }).click();
  await expect(page.getByText("B = 144 / 6 = 24 kN")).toHaveCount(0);
});

test("достъпност и телефон: без нарушения и без хоризонтално превъртане", async ({
  page,
}) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  for (const path of ["/labs", "/labs/beam"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (path === "/labs/beam") {
      await page
        .getByRole("button", { name: "Покажи решението стъпка по стъпка" })
        .click();
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        rule: v.id,
        example: v.nodes[0]?.target.join(" "),
      })),
    ).toEqual([]);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
});

test("потребител без активен план вижда обяснение вместо лабораторията", async ({
  page,
}) => {
  const supabase = getLocalSupabase();
  const service = createClient(supabase.API_URL, supabase.SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `nolab-${Date.now()}@structlab.test`;
  const password = "nolab-password-1";
  await service.auth.admin.createUser({ email, password, email_confirm: true });

  await signIn(page, email, password);
  await page.goto("/labs/beam");
  await expect(
    page.getByRole("heading", { name: "Нямаш активен достъп" }),
  ).toBeVisible();
  await expect(page.getByLabel("Дължина L, m")).toHaveCount(0);
});

test.describe("лаборатория за сечения", () => {
  test("примерът по подразбиране е контролният от учебника: сечение „Т“", async ({
    page,
  }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs");
    await page
      .getByRole("link", { name: "Отвори лабораторията →" })
      .nth(1)
      .click();
    await expect(page).toHaveURL(/\/labs\/section$/);

    await expect(result(page).locator("svg")).toBeVisible();
    await expect(result(page)).toContainText("44 cm²");
    await expect(result(page)).toContainText("y = 8,27 cm");
    await expect(result(page)).toContainText("567,39 cm⁴");
    await expect(result(page)).toContainText("294,67 cm⁴");
    await expect(result(page)).toContainText(
      "I_xy = 0: осите x и y са главни.",
    );
  });

  test("сечение „Г“: главни оси и ъгъл; таблицата на Щайнер показва преносните членове", async ({
    page,
  }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/section");
    await page.getByRole("button", { name: "Сечение „Г“" }).click();
    await expect(result(page)).toContainText("290,67 cm⁴");
    await expect(result(page)).toContainText("162,67 cm⁴");
    await expect(result(page)).toContainText("−120 cm⁴");
    await expect(result(page)).toContainText("362,67 cm⁴");
    await expect(result(page)).toContainText("90,67 cm⁴");
    await expect(result(page)).toContainText("30,96°");
    await expect(result(page)).toContainText("главните оси 1 и 2 са завъртени");

    await page
      .getByRole("button", { name: "Покажи таблицата на Щайнер" })
      .click();
    const table = page.getByRole("region", { name: "Таблица на Щайнер" });
    await expect(table.getByRole("row")).toHaveCount(3);
    // вертикалното рамо: A = 20, d_x = −1,5, d_y = 1,5, A·d_x·d_y = −45
    await expect(table.getByRole("row").nth(1)).toContainText("166,67");
    await expect(table.getByRole("row").nth(1)).toContainText("−45");
    await expect(table.getByRole("row").nth(2)).toContainText("−75");
  });

  test("промяна на размерите преизчислява; отвор се изважда", async ({
    page,
  }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/section");

    // само един правоъгълник 6×12: I_x = 864, I_y = 216
    await page.getByRole("button", { name: "Премахни правоъгълник 2" }).click();
    await page.getByLabel("b1 (ширина), cm").fill("6");
    await page.getByLabel("h1 (височина), cm").fill("12");
    await expect(result(page)).toContainText("72 cm²");
    await expect(result(page)).toContainText("864 cm⁴");
    await expect(result(page)).toContainText("216 cm⁴");
    await expect(result(page)).toContainText("144 cm³");

    // кухото сечение от учебника: I_x = 2549,33
    await page.getByRole("button", { name: "Кухо сечение" }).click();
    await expect(result(page)).toContainText("88 cm²");
    await expect(result(page)).toContainText("2549,33 cm⁴");
    // махаме отметката „отвор“ → двата правоъгълника вече се застъпват
    await page.getByRole("checkbox").nth(1).uncheck();
    await expect(result(page).getByRole("alert")).toContainText("се застъпват");
  });

  test("невалидни данни дават ясно съобщение", async ({ page }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/section");
    await page.getByRole("button", { name: "Премахни правоъгълник 2" }).click();
    await page.getByRole("button", { name: "Премахни правоъгълник 1" }).click();
    await expect(result(page).getByRole("alert")).toHaveText(
      "Добави поне един правоъгълник.",
    );

    await page.getByRole("button", { name: "Правоъгълник" }).click();
    await expect(result(page).locator("svg")).toBeVisible();
    await page.getByRole("checkbox").check();
    await expect(result(page).getByRole("alert")).toContainText(
      "Плътната площ трябва да е по-голяма",
    );
    await page.getByLabel("b1 (ширина), cm").fill("0");
    await expect(page.getByLabel("b1 (ширина), cm")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("достъпност и телефон", async ({ page }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/section");
    await page.getByRole("button", { name: "Сечение „Г“" }).click();
    await page
      .getByRole("button", { name: "Покажи таблицата на Щайнер" })
      .click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        rule: v.id,
        example: v.nodes[0]?.target.join(" "),
      })),
    ).toEqual([]);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
