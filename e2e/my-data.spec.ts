import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getLocalSupabase } from "./local-supabase";

// „Изтегли моите данни“: връзката в „Профил“ сваля JSON файл само с данните
// на влезлия потребител.

const PASSWORD = "e2e-mydata-password-1";
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
let otherEmail: string;
let otherId: string;

async function createUser(address: string, fullName: string, note: string) {
  const { data, error } = await service.auth.admin.createUser({
    email: address,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error("createUser");
  const { data: plan } = await service
    .from("access_plans")
    .select("id")
    .eq("slug", "beta-free")
    .single();
  await service.from("enrollments").insert({
    user_id: data.user.id,
    plan_id: plan!.id,
    source: "beta",
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
  await service
    .from("feedback")
    .insert({ user_id: data.user.id, page: "/dashboard", message: note });
  return data.user.id;
}

test.beforeAll(async ({}, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  email = `mydata-${suffix}@structlab.test`;
  otherEmail = `mydata-other-${suffix}@structlab.test`;
  userId = await createUser(email, "Тест Данни", "Моята бележка");
  otherId = await createUser(otherEmail, "Друг Човек", "ЧУЖДА БЕЛЕЖКА");
});

test.afterAll(async () => {
  await service.auth.admin.deleteUser(userId);
  await service.auth.admin.deleteUser(otherId);
});

async function signIn(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(PASSWORD);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/dashboard$/);
}

test("невлязъл посетител не получава файла", async ({ request }) => {
  const response = await request.get("/account/export", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/login");
});

test("„Профил“ има раздел „Моите данни“ с връзка за изтегляне", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/account");
  const section = page.getByRole("region", { name: "Моите данни" });
  await expect(section).toContainText("Файлът съдържа само твои данни.");
  const link = section.getByRole("link", {
    name: "Изтегли моите данни (JSON)",
  });
  await expect(link).toHaveAttribute("href", "/account/export");
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expectNoViolations(page);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test("файлът е JSON с моите данни и без чужди", async ({ page }) => {
  await signIn(page);
  await page.goto("/account");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Изтегли моите данни (JSON)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^structlab-moite-danni-\d{4}-\d{2}-\d{2}\.json$/,
  );

  const text = await readFile(await download.path(), "utf8");
  const data = JSON.parse(text);
  expect(Object.keys(data)).toEqual([
    "обяснение",
    "изготвено_на",
    "какво_липсва",
    "профил",
    "настройки",
    "достъп",
    "напредък",
    "активност_по_дни",
    "събития",
    "повторение",
    "вариант_за_задания",
    "лични_задания",
    "обратна_връзка",
    "изпратени_писма",
  ]);
  expect(data.профил).toMatchObject({
    имейл: email,
    име: "Тест Данни",
    роля: "student",
  });
  expect(data.достъп).toHaveLength(1);
  expect(data.достъп[0]).toMatchObject({ източник: "beta" });
  expect(data.обратна_връзка).toHaveLength(1);
  expect(data.обратна_връзка[0]).toMatchObject({
    съобщение: "Моята бележка",
    страница: "/dashboard",
  });
  expect(data.събития.включени).toBe(data.събития.списък.length);

  // нищо чуждо и нищо вътрешно
  expect(text).not.toContain(otherEmail);
  expect(text).not.toContain(otherId);
  expect(text).not.toContain("ЧУЖДА БЕЛЕЖКА");
  expect(text).not.toContain(userId);
  expect(text).not.toMatch(/user_id|password|token/i);

  // отговорът не се пази никъде по пътя
  const response = await page.request.get("/account/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(response.headers()["content-disposition"]).toMatch(
    /^attachment; filename="structlab-moite-danni-\d{4}-\d{2}-\d{2}\.json"$/,
  );
});
