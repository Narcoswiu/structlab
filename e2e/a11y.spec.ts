import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN } from "./local-supabase";

// Автоматична проверка за достъпност (WCAG 2.1 A и AA) на всеки екран.
// Хваща контраст, липсващи етикети, грешни роли – не замества ръчния преглед.

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    count: violation.nodes.length,
    example: violation.nodes[0]?.target.join(" "),
    html: violation.nodes[0]?.html.slice(0, 160),
  }));
  expect(summary).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  // без анимации: axe мери контраста на крайното състояние
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const path of [
  "/",
  "/login",
  "/forgot-password",
  "/welcome",
  "/privacy",
  "/invite/abc",
]) {
  test(`публична страница ${path}`, async ({ page }) => {
    await page.goto(path);
    await expectNoViolations(page);
  });
}

test("вътрешни страници: табло, профил, админ, дизайн система", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(E2E_ADMIN.email);
  await page.getByLabel("Парола").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/dashboard$/);
  await expectNoViolations(page);

  for (const path of ["/account", "/admin", "/design"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoViolations(page);
  }

  // четецът – и в трите теми, защото контрастът е различен във всяка
  await page.goto(
    "/learn/saprotivlenie-na-materialite/razrezni-usiliya?mode=detailed",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const theme of ["Тъмна", "Светла", "Сепия", "Тъмна"]) {
    const saved = page.waitForResponse((r) => r.request().method() === "POST");
    await page.getByRole("button", { name: `Тема: ${theme}` }).click();
    await saved;
    await expectNoViolations(page);
  }

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Обратна връзка" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectNoViolations(page);
});
