import { expect, test } from "@playwright/test";

test("началната страница показва основните секции", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Инженерството, обяснено ясно.",
    }),
  ).toBeVisible();
  for (const id of ["features", "spec", "ai", "prices"]) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
});

test("няма хоризонтално превъртане", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("личното задание се преизчислява от факултетния номер", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByLabel("Факултетен номер");
  await input.fill("2059");
  await expect(page.getByText("35 kN", { exact: true })).toBeVisible();
  await input.fill("12");
  await expect(page.getByText("Въведи поне 4 цифри.")).toBeVisible();
});

test("анимациите спират при prefers-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const selector of [".float3d", ".spin3d"]) {
    const animation = await page
      .locator(selector)
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe("none");
  }
});

test("„Разбрах“ скрива карето и след презареждане", async ({ page }) => {
  await page.goto("/design");
  const intro = page.getByRole("region", { name: "Въведение към страницата" });
  await expect(intro).toBeVisible();
  await page.getByRole("button", { name: "Разбрах" }).click();
  await expect(intro).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "Дизайн система" }),
  ).toBeVisible();
  await expect(intro).toBeHidden();
});

test("бутоните в героя са поне 44 px високи", async ({ page }) => {
  await page.goto("/");
  for (const name of ["Вход", "Пробвай демото", "Отвори лабораторията"]) {
    const box = await page.getByRole("link", { name }).first().boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});
