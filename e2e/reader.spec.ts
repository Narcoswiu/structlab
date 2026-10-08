import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { E2E_READER, getLocalSupabase } from "./local-supabase";

const CHAPTER = "/learn/saprotivlenie-na-materialite/razrezni-usiliya";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(password);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/dashboard$/);
}

test.describe.configure({ mode: "serial" });

test("без вход главата не се отваря", async ({ page }) => {
  await page.goto(CHAPTER);
  await expect(page).toHaveURL(/\/login/);
});

test("от таблото се стига до главата; виждат се секциите, формулите и фигурите", async ({
  page,
}) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  await page.getByRole("link", { name: /Разрезни усилия в греди/ }).click();
  await expect(page).toHaveURL(new RegExp(`${CHAPTER}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Разрезни усилия в греди",
  );

  for (const title of [
    "Загадка",
    "Виж",
    "Разбери",
    "Решен пример",
    "В реалния живот",
    "Провери се",
    "Запомни",
  ]) {
    await expect(
      page.getByRole("heading", { level: 2, name: title, exact: true }),
    ).toBeVisible();
  }

  // формулите са изрисувани от KaTeX, а не останали като суров текст
  expect(await page.locator(".reader-prose .katex").count()).toBeGreaterThan(
    10,
  );
  await expect(page.locator(".reader-prose")).not.toContainText("$$");
  await expect(page.locator(".reader-prose")).not.toContainText(":::");

  // фигурата носи числата от изчислението
  const figure = page.locator(".figure").first();
  await expect(figure.locator("svg")).toBeVisible();
  await expect(figure).toContainText("43,2");
  await expect(page.getByText("[липсва фигура]")).toHaveCount(0);

  // редът не е по-широк от ~70 знака
  const width = await page
    .locator(".reader-prose")
    .evaluate(
      (el) =>
        el.getBoundingClientRect().width /
        parseFloat(getComputedStyle(el).fontSize),
    );
  expect(width).toBeLessThan(40);
});

test("отговорите са скрити до натискане на „Покажи отговора“", async ({
  page,
}) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  await page.goto(CHAPTER);
  const answer = page.getByText("Реакциите са по 10 kN.");
  await expect(answer).toBeHidden();
  await page.getByText("Покажи отговора").nth(1).click();
  await expect(answer).toBeVisible();
});

test("Леко ⇄ Подробно сменя текста и пази секцията", async ({ page }) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  await page.goto(`${CHAPTER}?mode=easy`);
  await expect(page.getByRole("button", { name: "Леко" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("Вземи пластмасова линийка")).toBeVisible();

  await page
    .getByRole("heading", { level: 2, name: "Решен пример" })
    .scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Подробно" }).click();

  await expect(page).toHaveURL(/mode=detailed#primer$/);
  await expect(page.getByRole("button", { name: "Подробно" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "Диференциални зависимости" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Решен пример" }),
  ).toBeInViewport();

  // изборът е запомнен: без параметър в адреса пак се отваря „Подробно“
  await page.goto(CHAPTER);
  await expect(page.getByRole("button", { name: "Подробно" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Леко" }).click();
  await expect(page).toHaveURL(/mode=easy/);
});

test("темата и размерът на шрифта се сменят и се помнят", async ({ page }) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  await page.goto(CHAPTER);
  const reader = page.locator(".reader");
  const fontSize = () =>
    page
      .locator(".reader-prose")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const background = () =>
    reader.evaluate((el) => getComputedStyle(el).backgroundColor);

  await page.getByRole("button", { name: "Тема: Тъмна" }).click();
  await expect(reader).toHaveAttribute("data-theme", "dark");
  const dark = await background();

  let saved = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByRole("button", { name: "Тема: Сепия" }).click();
  await saved;
  await expect(reader).toHaveAttribute("data-theme", "sepia");
  expect(await background()).not.toBe(dark);

  const before = await fontSize();
  saved = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByRole("button", { name: "По-голям шрифт" }).click();
  await saved;
  expect(await fontSize()).toBeGreaterThan(before);

  await page.reload();
  await expect(reader).toHaveAttribute("data-theme", "sepia");
  expect(await fontSize()).toBeGreaterThan(before);

  // връщаме настройките, за да не влияят на другите тестове
  saved = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByRole("button", { name: "По-малък шрифт" }).click();
  await saved;
  saved = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByRole("button", { name: "Тема: Тъмна" }).click();
  await saved;
});

test("потребител без активен план не може да отвори главата", async ({
  page,
}) => {
  const supabase = getLocalSupabase();
  const service = createClient(supabase.API_URL, supabase.SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `noplan-${Date.now()}@structlab.test`;
  const password = "noplan-password-1";
  const { error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(error).toBeNull();

  await signIn(page, email, password);
  await expect(page.getByRole("link", { name: /Разрезни усилия/ })).toHaveCount(
    0,
  );
  const response = await page.goto(CHAPTER);
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Вземи пластмасова линийка")).toHaveCount(0);
});

test("всяка глава от таблото се отваря цяла – и в двата режима", async ({
  page,
}) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  // таблото се зарежда на части – изчакваме списъка с главите
  await expect(
    page.getByRole("link", { name: /Разрезни усилия в греди/ }).first(),
  ).toBeVisible();
  const links = await page.locator('a[href^="/learn/"]').evaluateAll((items) =>
    items
      .map((item) => item.getAttribute("href")!)
      // само връзките към глави: /learn/<модул>/<глава>
      .filter((href) => href.split("/").length === 4),
  );
  expect(links.length).toBeGreaterThanOrEqual(4);

  for (const href of links) {
    for (const mode of ["easy", "detailed"]) {
      await page.goto(`${href}?mode=${mode}`);
      const prose = page.locator(".reader-prose");
      await expect(page.locator(".reader-prose > h2")).toHaveCount(7);
      await expect(page.getByText("[липсва фигура]")).toHaveCount(0);
      expect(await page.locator(".figure svg").count()).toBeGreaterThanOrEqual(
        2,
      );
      expect(await prose.locator(".katex").count()).toBeGreaterThan(10);
      // няма останали сурови означения и неизрисувани формули
      await expect(prose).not.toContainText("$$");
      await expect(prose).not.toContainText(":::");
      await expect(prose.locator(".katex-error")).toHaveCount(0);
      // нито един ред не излиза извън екрана
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    }
  }
});
