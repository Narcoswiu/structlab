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

test("бутоните в героя са поне 44 px високи", async ({ page }) => {
  await page.goto("/");
  for (const name of ["Вход", "Вход с покана", "Виж възможностите"]) {
    const box = await page.getByRole("link", { name }).first().boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test("страницата не нарушава Content-Security-Policy и има защитни заглавия", async ({
  page,
}) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));

  const response = await page.goto("/");
  await page.getByLabel("Факултетен номер").fill("2059");
  await expect(page.getByText("35\u00A0kN", { exact: true })).toBeVisible();

  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
  expect(problems).toEqual([]);
});
