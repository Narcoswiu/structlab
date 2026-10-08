import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { getLocalSupabase } from "./local-supabase";

// Собствен потребител, за да не влияе на другите тестове с избора си.
const user = {
  email: `plan-${Date.now()}-${Math.floor(Math.random() * 1e6)}@structlab.test`,
  password: "plan-password-1",
};

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const supabase = getLocalSupabase();
  const service = createClient(supabase.API_URL, supabase.SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const created = await service.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { full_name: "План Тестов" },
  });
  const { data: plan } = await service
    .from("access_plans")
    .select("id")
    .eq("slug", "founders-free")
    .single();
  await service.from("enrollments").insert({
    user_id: created.data.user!.id,
    plan_id: plan!.id,
    source: "beta",
    expires_at: "2999-12-31T00:00:00Z",
  });
});

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(user.email);
  await page.getByLabel("Парола").fill(user.password);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/dashboard$/);
}

const plan = (page: Page) => page.getByRole("region", { name: "Учебен план" });

test("нов потребител избира специалност и таблото се подрежда по учебния ѝ план", async ({
  page,
}) => {
  await signIn(page);
  const picker = page.getByRole("region", { name: "Избор на специалност" });
  await expect(picker).toBeVisible();
  await expect(plan(page)).toHaveCount(0);

  // списъкът е групиран по университет
  const select = page.getByLabel("Университет и специалност");
  await expect(select.locator("optgroup")).toHaveCount(2);
  await expect(select.locator("option")).toHaveCount(7); // 6 специалности + „Избери…“

  await select.selectOption({
    label: "СИ – Строително инженерство (бакалавър)",
  });
  await page.getByRole("button", { name: "Запази специалността" }).click();

  await expect(plan(page)).toBeVisible();
  await expect(plan(page).getByRole("heading", { level: 2 })).toHaveText(
    "ВСУ · Строително инженерство",
  );
  for (const year of ["I курс", "II курс", "III курс", "IV курс"]) {
    await expect(
      plan(page).getByRole("heading", { name: year, exact: true }),
    ).toBeVisible();
  }
  // точно съвпадение – „V курс“ иначе съвпада и с „IV курс“
  await expect(
    plan(page).getByRole("heading", { name: "V курс", exact: true }),
  ).toHaveCount(0);
  await expect(plan(page).getByText("Откъде са данните:")).toBeVisible();
});

test("дисциплина с готови глави води към модула, а оттам – към главата", async ({
  page,
}) => {
  await signIn(page);
  const link = plan(page).getByRole("link", {
    name: /Съпротивление на материалите/,
  });
  // броят расте с всяка нова глава – проверяваме само че е показан
  await expect(link).toContainText(/\d+ ГЛАВИ/);
  // дисциплина с модул, но още без глави, води към плана си
  const machines = plan(page).getByRole("link", { name: /Строителни машини/ });
  await expect(machines).toContainText("ПОДГОТВЯ СЕ");
  await expect(machines).toHaveAttribute("href", "/plan/stroitelni-mashini");
  // дисциплина без модул също има план
  const bridges = plan(page).getByRole("link", { name: /^Мостове/ });
  await expect(bridges).toContainText("ПЛАН");
  // дисциплина без план остава обикновен текст
  await expect(plan(page).getByText("Чужд език")).toBeVisible();
  await expect(plan(page).getByRole("link", { name: /Чужд език/ })).toHaveCount(
    0,
  );

  // страницата с плана: какво ще има и откъде е
  await bridges.click();
  await expect(page).toHaveURL(/\/plan\/mostove$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Мостове");
  await expect(page.getByText("ПЛАН · УРОЦИТЕ СЕ ПОДГОТВЯТ")).toBeVisible();
  const chapters = page
    .getByRole("region", { name: "Какво ще има" })
    .getByRole("listitem");
  expect(await chapters.count()).toBeGreaterThanOrEqual(5);
  await expect(
    page.getByText("StructLab не е свързана с университета"),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect((await page.goto("/plan/nyama-takava"))?.status()).toBe(404);
  await page.goto("/dashboard");

  await link.click();
  await expect(page).toHaveURL(/\/learn\/saprotivlenie-na-materialite$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Съпротивление на материалите",
  );
  expect(await page.getByRole("listitem").count()).toBeGreaterThanOrEqual(3);
  await page
    .getByRole("link", { name: /Инерционни моменти на сечения/ })
    .click();
  await expect(page).toHaveURL(
    /\/learn\/saprotivlenie-na-materialite\/inertsionni-momenti$/,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Инерционни моменти на сечения",
  );
});

test("специалността се сменя от профила и планът се обновява", async ({
  page,
}) => {
  await signIn(page);
  await plan(page).getByRole("link", { name: "смени специалността" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByLabel("Университет и специалност")).toHaveValue(/.+/);

  await page.getByLabel("Университет и специалност").selectOption({
    label:
      "ССС – Строителство на сгради и съоръжения (магистър след средно образование)",
  });
  await page.getByRole("button", { name: "Запази специалността" }).click();
  await expect(page.getByText("Специалността е записана.")).toBeVisible();

  await page.goto("/dashboard");
  await expect(plan(page).getByRole("heading", { level: 2 })).toHaveText(
    "УАСГ · Строителство на сгради и съоръжения",
  );
  // УАСГ ССС е 5 години и има дисциплината в два семестъра
  await expect(
    plan(page).getByRole("heading", { name: "V курс", exact: true }),
  ).toBeVisible();
  await expect(
    plan(page).getByRole("link", { name: /Съпротивление на материалите/ }),
  ).toHaveCount(2);
  await expect(
    plan(page).getByText("Метални конструкции").first(),
  ).toBeVisible();
});

test("модул без глави и непознат модул", async ({ page }) => {
  await signIn(page);
  await page.goto("/learn/stroitelni-mashini");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Строителни машини",
  );
  await expect(
    page.getByText("Главите по тази дисциплина се подготвят."),
  ).toBeVisible();

  const response = await page.goto("/learn/nyama-takav-modul");
  expect(response?.status()).toBe(404);
});
