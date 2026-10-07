import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN } from "./local-supabase";

// Един свързан сценарий: admin кани → студентът приема → вижда само своето.
test.describe.configure({ mode: "serial" });

const student = {
  email: `student-${Date.now()}@structlab.test`,
  name: "Мария Тестова",
  password: "student-password-1",
};
let inviteUrl = "";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(password);
  await page.getByRole("button", { name: "Вход" }).click();
}

/** Вход, който трябва да успее – изчаква таблото, преди тестът да продължи. */
async function signInOk(page: Page, email: string, password: string) {
  await signIn(page, email, password);
  await page.waitForURL(/\/dashboard$/);
}

test("без вход защитените страници водят към /login", async ({ page }) => {
  for (const path of ["/dashboard", "/admin", "/design", "/account"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=/);
  }
});

test("грешна парола не издава дали имейлът съществува", async ({ page }) => {
  await signIn(page, E2E_ADMIN.email, "wrong-password-123");
  await expect(page.getByText("Грешен имейл или парола.")).toBeVisible();
  await signIn(page, "nobody@structlab.test", "wrong-password-123");
  await expect(page.getByText("Грешен имейл или парола.")).toBeVisible();
});

test("невалиден линк за покана показва обяснение, не форма", async ({
  page,
}) => {
  await page.goto("/invite/" + "x".repeat(43));
  await expect(
    page.getByRole("heading", { name: "Поканата не е активна" }),
  ).toBeVisible();
  await expect(page.getByLabel("Парола")).toHaveCount(0);
});

test("admin създава покана и получава линк за копиране", async ({ page }) => {
  await signInOk(page, E2E_ADMIN.email, E2E_ADMIN.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "Админ" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Админ" }),
  ).toBeVisible();

  await page.getByLabel("Имейли").fill(student.email.toUpperCase());
  await page.getByRole("button", { name: "Създай покани" }).click();

  const link = page.locator("code", { hasText: "/invite/" }).first();
  await expect(link).toBeVisible();
  inviteUrl = (await link.textContent()) ?? "";
  expect(inviteUrl).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);
  // адресът се пази с малки букви и поканата чака
  await expect(
    page.getByText(student.email, { exact: true }).last(),
  ).toBeVisible();
  await expect(page.getByText("ЧАКА").first()).toBeVisible();
});

test("студентът приема поканата и вижда своя модул", async ({ page }) => {
  await page.goto(inviteUrl);
  await expect(page.getByLabel("Имейл")).toHaveValue(student.email);

  // първо грешка във формата: различни пароли
  await page.getByLabel("Име и фамилия").fill(student.name);
  await page.getByLabel("Парола", { exact: true }).fill(student.password);
  await page.getByLabel("Повтори паролата").fill("different-password-1");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Създай акаунт и влез" }).click();
  await expect(page.getByText("Двете пароли не съвпадат.")).toBeVisible();
  // името не се губи при грешка
  await expect(page.getByLabel("Име и фамилия")).toHaveValue(student.name);

  await page.getByLabel("Парола", { exact: true }).fill(student.password);
  await page.getByLabel("Повтори паролата").fill(student.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Създай акаунт и влез" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Здравей, Мария!",
  );
  await expect(page.getByText("още 14 дни")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Съпротивление на материалите" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Админ" })).toHaveCount(0);
});

test("използваната покана не работи втори път", async ({ page }) => {
  await page.goto(inviteUrl);
  await expect(page.getByText("Тази покана вече е използвана.")).toBeVisible();
});

test("студентът няма достъп до /admin и /design", async ({ page }) => {
  await signInOk(page, student.email, student.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  for (const path of ["/admin", "/admin/email-preview", "/design"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  }
});

test("„Разбрах“ се помни в акаунта, а обратната връзка се записва", async ({
  page,
}) => {
  await signInOk(page, student.email, student.password);
  const intro = page.getByRole("region", { name: "Въведение към страницата" });
  await expect(intro).toBeVisible();
  // изчакваме записа в базата да приключи, преди да презаредим
  const saved = page.waitForResponse(
    (response) => response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Разбрах" }).click();
  await expect(intro).toBeHidden();
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(intro).toBeHidden();

  await page.getByRole("button", { name: "Обратна връзка" }).click();
  await page.getByLabel(/Какво не е ясно/).fill("Тестово мнение от e2e.");
  await page.getByRole("button", { name: "Изпрати" }).click();
  await expect(
    page.getByText("Благодарим! Получихме съобщението ти."),
  ).toBeVisible();
});

test("admin спира достъпа и студентът вече не вижда модула", async ({
  page,
  browser,
}) => {
  await signInOk(page, E2E_ADMIN.email, E2E_ADMIN.password);
  await page.goto("/admin");
  await expect(page.getByText("Тестово мнение от e2e.")).toBeVisible();
  const row = page
    .getByRole("region", { name: /^Потребители/ })
    .getByRole("listitem")
    .filter({ hasText: student.email });
  await expect(row.getByText("АКТИВЕН")).toBeVisible();
  await row.getByRole("button", { name: "Спри достъпа" }).click();
  await expect(row.getByText("СПРЯН")).toBeVisible();

  const context = await browser.newContext();
  const studentPage = await context.newPage();
  await signInOk(studentPage, student.email, student.password);
  await expect(
    studentPage.getByRole("heading", { name: "Нямаш активен достъп" }),
  ).toBeVisible();
  await expect(
    studentPage.getByRole("heading", { name: "Съпротивление на материалите" }),
  ).toHaveCount(0);
  await context.close();
});

test("изходът прекратява сесията", async ({ page }) => {
  await signInOk(page, student.email, student.password);
  await page.getByRole("button", { name: "Изход" }).click();
  await expect(page).toHaveURL(/\/login\?notice=signed-out/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=/);
});
