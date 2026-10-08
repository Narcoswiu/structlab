import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { E2E_READER, getLocalSupabase } from "./local-supabase";

const CHAPTER = "/learn/saprotivlenie-na-materialite/razrezni-usiliya";
const PRINT = `${CHAPTER}/print`;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(password);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/dashboard$/);
}

test.describe.configure({ mode: "serial" });

test("без вход версията за печат не се отваря", async ({ page }) => {
  await page.goto(PRINT);
  await expect(page).toHaveURL(/\/login/);
});

test("от главата се стига до версията за печат в същия режим", async ({
  page,
}) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  await page.goto(`${CHAPTER}?mode=detailed`);
  const link = page.getByRole("link", { name: "Изтегли PDF" });
  const box = await link.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${PRINT}\\?mode=detailed$`));
  await expect(
    page.getByRole("heading", { name: "Диференциални зависимости" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "← Обратно към главата" }).click();
  await expect(page).toHaveURL(new RegExp(`${CHAPTER}\\?mode=detailed$`));
});

test("версията за печат: воден знак с имейла, отворени отговори, без оценяване", async ({
  page,
}) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  const response = await page.goto(`${PRINT}?mode=easy`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Разрезни усилия в греди",
  );
  await expect(page.getByText("Вземи пластмасова линийка")).toBeVisible();
  await expect(page.locator(".reader.print-doc")).toHaveAttribute(
    "data-theme",
    "light",
  );

  // личният воден знак: имейл и днешна дата (ДД.ММ.ГГГГ)
  const note = page.locator(".print-note");
  await expect(note).toBeVisible();
  await expect(note).toContainText(`Лично копие за ${E2E_READER.email}`);
  await expect(note).toContainText(/· \d{2}\.\d{2}\.\d{4} · StructLab/);
  await expect(page.locator(".print-watermark")).toHaveCount(2);

  // съдържанието е цяло: секции, формули, фигури
  await expect(page.locator(".reader-prose > h2")).toHaveCount(7);
  expect(await page.locator(".reader-prose .katex").count()).toBeGreaterThan(
    10,
  );
  await expect(page.locator(".figure svg").first()).toBeVisible();
  await expect(page.getByText("[липсва фигура]")).toHaveCount(0);

  // отговорите са отворени, без да се натиска „Покажи отговора“
  expect(await page.locator("details.answer").count()).toBeGreaterThan(0);
  await expect(page.locator("details.answer:not([open])")).toHaveCount(0);
  await expect(page.getByText("Реакциите са по 10 kN.")).toBeVisible();

  // няма лента на четеца, нито бутони за самооценка
  await expect(page.locator(".quiz-grade")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Знаех го" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Не го знаех" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: /Тема:/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Подробно" })).toHaveCount(0);

  // нито един ред не излиза извън екрана
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("при печат рамката на приложението се скрива, а водният знак се появява", async ({
  page,
}) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  await page.goto(`${PRINT}?mode=easy`);
  const nav = page.getByRole("navigation", { name: "Навигация" });
  const printButton = page.getByRole("button", {
    name: "Отпечатай / запази като PDF",
  });
  const footer = page.locator(".print-watermark-footer");
  await expect(nav).toBeVisible();
  await expect(printButton).toBeVisible();
  await expect(footer).toBeHidden();

  await page.emulateMedia({ media: "print" });
  await expect(nav).toBeHidden();
  await expect(printButton).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Обратна връзка" }),
  ).toBeHidden();
  await expect(footer).toBeVisible();
  await expect(footer).toContainText(E2E_READER.email);
  await expect(page.locator(".print-watermark-diagonal")).toBeVisible();
  await expect(page.getByText("Реакциите са по 10 kN.")).toBeVisible();
  // черен текст върху бяло
  const colors = await page.locator(".reader.print-doc").evaluate((el) => {
    const style = getComputedStyle(el);
    return [style.backgroundColor, style.color];
  });
  expect(colors).toEqual(["rgb(255, 255, 255)", "rgb(0, 0, 0)"]);
  await page.emulateMedia({ media: null });
});

test("бутонът за печат отваря прозореца за печат и праща събитие pdf_download", async ({
  page,
}) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  await page.goto(`${PRINT}?mode=easy`);
  // ако известието за проследяване още стои, го приемаме – иначе няма събитие
  const accept = page
    .getByRole("region", { name: "Известие за проследяване на ученето" })
    .getByRole("button")
    .first();
  if (await accept.isVisible()) {
    await accept.click();
    await expect(accept).toBeHidden();
    await page.reload();
  }
  await page.evaluate(() => {
    const state = window as unknown as { printed: number };
    state.printed = 0;
    window.print = () => {
      state.printed += 1;
    };
  });

  const sent = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/events") &&
      request.postDataJSON()?.type === "pdf_download",
  );
  await page
    .getByRole("button", { name: "Отпечатай / запази като PDF" })
    .click();
  expect((await sent).postDataJSON()).toEqual({
    type: "pdf_download",
    module: "saprotivlenie-na-materialite",
    chapter: "razrezni-usiliya",
  });
  expect(
    await page.evaluate(
      () => (window as unknown as { printed: number }).printed,
    ),
  ).toBe(1);
});

test("потребител без активен план не може да отвори версията за печат", async ({
  page,
}) => {
  const supabase = getLocalSupabase();
  const service = createClient(supabase.API_URL, supabase.SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `noplan-print-${Date.now()}@structlab.test`;
  const password = "noplan-password-1";
  const { error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(error).toBeNull();

  await signIn(page, email, password);
  const response = await page.goto(PRINT);
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Вземи пластмасова линийка")).toHaveCount(0);
  await expect(page.locator(".print-note")).toHaveCount(0);
});
