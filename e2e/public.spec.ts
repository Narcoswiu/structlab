import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, getLocalSupabase } from "./local-supabase";

function service() {
  const supabase = getLocalSupabase();
  return createClient(supabase.API_URL, supabase.SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const publicPages = [
  "/",
  "/welcome",
  "/demo",
  "/demo/uchebnik",
  "/demo/laboratoriya",
  "/request-invite",
  "/contact",
  "/privacy",
  "/terms",
];

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.beforeAll(async () => {
  // броячите срещу спам се нулират, за да не зависят тестовете от предишни пускания
  await service().from("request_throttle").delete().neq("id", 0);
});

for (const width of [375, 1440]) {
  test(`публичните страници се отварят без вход и без превъртане настрани (${width} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of publicPages) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await noOverflow(page);
    }
  });
}

test("достъпност на публичните страници", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of publicPages) {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        path,
        rule: v.id,
        example: v.nodes[0]?.target.join(" "),
      })),
    ).toEqual([]);
  }
});

test("менюто и футърът водят към новите страници", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Основна навигация" });
  await expect(nav.getByRole("link", { name: "Въведение" })).toHaveAttribute(
    "href",
    "/welcome",
  );
  await expect(nav.getByRole("link", { name: "Демо" })).toHaveAttribute(
    "href",
    "/demo",
  );

  const footer = page.getByRole("contentinfo");
  for (const [name, href] of [
    ["Въведение", "/welcome"],
    ["Демо", "/demo"],
    ["Поверителност", "/privacy"],
    ["Общи условия", "/terms"],
    ["Контакт", "/contact"],
  ] as const) {
    await expect(footer.getByRole("link", { name })).toHaveAttribute(
      "href",
      href,
    );
  }

  // бутоните на началната страница вече не водят към несъществуващи страници
  await expect(
    page.getByRole("link", { name: "Пробвай демото" }),
  ).toHaveAttribute("href", "/demo");
  await expect(
    page.getByRole("link", { name: "Прочети в учебника →" }),
  ).toHaveAttribute("href", "/demo/uchebnik");
  await expect(
    page.getByRole("link", { name: "Към модулите →" }),
  ).toHaveAttribute("href", "/demo");
  for (const link of await page
    .getByRole("link", { name: /^Избери план/ })
    .all()) {
    await expect(link).toHaveAttribute("href", "/request-invite");
  }
  await expect(
    page.getByRole("link", { name: "Поискай покана" }),
  ).toHaveAttribute("href", "/request-invite");
});

test("демо: главата е само в „Леко“, с банер и без настройки; лабораторията работи", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(page.getByRole("complementary", { name: "Демо" })).toContainText(
    "Пълният учебник е достъпен с покана.",
  );
  await page.getByRole("link", { name: "Прочети главата →" }).click();
  await expect(page).toHaveURL(/\/demo\/uchebnik$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Разрезни усилия в греди",
  );
  await expect(page.getByText("Вземи пластмасова линийка")).toBeVisible();
  await expect(page.locator(".reader-prose > h2")).toHaveCount(7);
  expect(await page.locator(".reader-prose .katex").count()).toBeGreaterThan(
    10,
  );
  await expect(page.locator(".figure svg").first()).toBeVisible();
  // няма „Подробно“, теми и PDF – и текстът от „Подробно“ не е в страницата
  await expect(page.getByRole("button", { name: "Подробно" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Тема:/ })).toHaveCount(0);
  await expect(page.getByText("Диференциални зависимости")).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Демо" })).toHaveCount(
    2,
  );

  await page.goto("/demo/laboratoriya");
  const result = page.getByRole("region", { name: "Резултат" });
  await expect(result).toContainText("43,2 kN·m");
  await page.getByLabel("F1 (надолу), kN").fill("60");
  await expect(result).toContainText("86,4 kN·m");
  await page
    .getByRole("button", { name: "Покажи решението стъпка по стъпка" })
    .click();
  await expect(page.getByText("B = 144 / 6 = 24 kN")).toBeVisible();
});

test("останалите глави и вътрешните страници остават затворени", async ({
  page,
}) => {
  for (const path of [
    "/learn/saprotivlenie-na-materialite/inertsionni-momenti",
    "/learn/saprotivlenie-na-materialite/razrezni-usiliya?mode=detailed",
    "/labs/beam",
    "/dashboard",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("обиколката минава през 7 стъпки и отбелязва кое още го няма", async ({
  page,
}) => {
  await page.goto("/welcome");
  const step = page.getByRole("region", { name: /Стъпка \d от 7/ });
  await expect(step.getByRole("heading", { level: 2 })).toHaveText("Табло");
  await expect(step.getByText("НАЛИЧНО", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "← Назад" })).toBeDisabled();

  await page.getByRole("button", { name: "Напред →" }).click();
  await expect(step.getByRole("heading", { level: 2 })).toHaveText("Учебник");
  await expect(
    step.getByRole("link", { name: "Прочети демо глава" }),
  ).toHaveAttribute("href", "/demo/uchebnik");

  await page.getByRole("button", { name: /Помощник по учебника/ }).click();
  await expect(step.getByRole("heading", { level: 2 })).toHaveText(
    "Помощник по учебника",
  );
  await expect(step.getByText("НАЛИЧНО", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Админ/ }).click();
  await expect(page.getByRole("button", { name: "Напред →" })).toBeDisabled();
  await expect(
    page
      .getByRole("list", { name: "Стъпки на обиколката" })
      .getByRole("listitem"),
  ).toHaveCount(7);
});

test("„Поискай покана“: проверка на полетата, запис и потвърждение", async ({
  page,
}) => {
  const email = `wait-${Date.now()}-${Math.floor(Math.random() * 1e6)}@structlab.test`;
  await page.goto("/request-invite");

  await page.getByLabel("Имейл").fill(email.toUpperCase());
  await page
    .getByLabel("Университет и специалност")
    .selectOption({ label: "СИ – Строително инженерство (бакалавър)" });
  await page.getByLabel("Курс").selectOption({ label: "II курс" });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Поискай покана" }).click();
  await expect(page.getByText("Записахме те в списъка.")).toBeVisible();

  const { data } = await service()
    .from("waitlist")
    .select("*")
    .eq("email", email)
    .single();
  expect(data).toMatchObject({
    email,
    university: "Висше строително училище „Любен Каравелов“ – София",
    specialty: "Строително инженерство",
    year: 2,
    invited_at: null,
  });
  expect(data!.consent_at).toBeTruthy();

  // втори път със същия имейл: същият отговор, без втори запис
  await page.goto("/request-invite");
  await page.getByLabel("Имейл").fill(email);
  await page
    .getByLabel("Университет и специалност")
    .selectOption({ label: "Друга – ще я напиша" });
  await page
    .getByLabel("Университет", { exact: true })
    .fill("Друг университет");
  await page
    .getByLabel("Специалност", { exact: true })
    .fill("Друга специалност");
  await page.getByLabel("Курс").selectOption({ label: "I курс" });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Поискай покана" }).click();
  await expect(page.getByText("Записахме те в списъка.")).toBeVisible();
  const again = await service()
    .from("waitlist")
    .select("university")
    .eq("email", email);
  expect(again.data).toHaveLength(1);
  expect(again.data![0]!.university).toContain("Любен Каравелов");
});

test("скритото поле спира роботите, без да им издава това", async ({
  page,
}) => {
  const email = `bot-${Date.now()}@structlab.test`;
  await page.goto("/contact");
  await page.getByLabel("Име", { exact: true }).fill("Робот");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Съобщение").fill("Купете евтини линкове сега!!!");
  await page
    .locator('input[name="website"]')
    .evaluate((el: HTMLInputElement) => {
      el.value = "https://spam.example";
    });
  await page.getByRole("button", { name: "Изпрати" }).click();
  await expect(page.getByText("Получихме съобщението ти.")).toBeVisible();
  const { data } = await service()
    .from("contact_messages")
    .select("id")
    .eq("email", email);
  expect(data).toEqual([]);
});

test("„Контакт“: записва съобщението, пази въведеното при грешка и ограничава броя", async ({
  page,
}) => {
  const email = `msg-${Date.now()}-${Math.floor(Math.random() * 1e6)}@structlab.test`;
  await service().from("request_throttle").delete().eq("kind", "contact");
  await page.goto("/contact");

  await page.getByLabel("Име", { exact: true }).fill("Мария Тестова");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Съобщение").fill("кратко");
  await page.getByRole("button", { name: "Изпрати" }).click();
  await expect(page.getByText("Напиши поне едно изречение.")).toBeVisible();
  await expect(page.getByLabel("Име", { exact: true })).toHaveValue(
    "Мария Тестова",
  );

  await page
    .getByLabel("Съобщение")
    .fill("Здравейте, намерих неточност в Глава 2.");
  await page.getByRole("button", { name: "Изпрати" }).click();
  await expect(page.getByText("Получихме съобщението ти.")).toBeVisible();
  const saved = await service()
    .from("contact_messages")
    .select("name, message")
    .eq("email", email);
  expect(saved.data).toEqual([
    {
      name: "Мария Тестова",
      message: "Здравейте, намерих неточност в Глава 2.",
    },
  ]);

  // лимитът е 3 на час от един посетител: четвъртото се отказва
  for (let i = 2; i <= 4; i++) {
    await page.goto("/contact");
    await page.getByLabel("Име", { exact: true }).fill("Мария Тестова");
    await page.getByLabel("Имейл").fill(email);
    await page
      .getByLabel("Съобщение")
      .fill(`Съобщение номер ${i} за проверка на лимита.`);
    await page.getByRole("button", { name: "Изпрати" }).click();
    if (i < 4) {
      await expect(page.getByText("Получихме съобщението ти.")).toBeVisible();
    } else {
      await expect(
        page.getByText("Твърде много съобщения. Опитай пак след малко."),
      ).toBeVisible();
    }
  }
  const total = await service()
    .from("contact_messages")
    .select("id")
    .eq("email", email);
  expect(total.data).toHaveLength(3);
});

test("admin вижда чакащите и ги кани през съществуващия поток за покани", async ({
  page,
}) => {
  const email = `queue-${Date.now()}-${Math.floor(Math.random() * 1e6)}@structlab.test`;
  await service().from("waitlist").insert({
    email,
    university: "ВСУ",
    specialty: "Строително инженерство",
    year: 2,
  });

  await page.goto("/login");
  await page.getByLabel("Имейл").fill(E2E_ADMIN.email);
  await page.getByLabel("Парола").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/dashboard$/);
  await page.goto("/admin");

  const panel = page.getByRole("region", { name: /^Чакащи за покана/ });
  const row = panel.getByRole("listitem").filter({ hasText: email });
  await expect(row.getByText("ЧАКА", { exact: true })).toBeVisible();
  await expect(row).toContainText("Строително инженерство · 2 курс");
  await row.getByRole("button", { name: /^Покани/ }).click();

  await expect(row.getByText("ПОКАНЕН", { exact: true })).toBeVisible();
  const invite = await service()
    .from("invites")
    .select("email, accepted_at")
    .eq("email", email);
  expect(invite.data).toEqual([{ email, accepted_at: null }]);
  const entry = await service()
    .from("waitlist")
    .select("invited_at")
    .eq("email", email)
    .single();
  expect(entry.data!.invited_at).not.toBeNull();
  // поканата се вижда и в общия списък с покани
  await expect(
    page
      .getByRole("region", { name: /^Покани/ })
      .getByText(email, { exact: true }),
  ).toBeVisible();
});

test("SEO: sitemap, robots, canonical, Open Graph и икони", async ({
  page,
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of publicPages) {
    // началната страница е записана с или без наклонена черта накрая
    expect(sitemap).toMatch(
      new RegExp(
        `<loc>http://localhost:3100${path === "/" ? "/?" : path}</loc>`,
      ),
    );
  }
  for (const hidden of [
    "/dashboard",
    "/admin",
    "/login",
    "/learn",
    "/labs",
    "/invite",
  ]) {
    expect(sitemap).not.toContain(`${hidden}</loc>`);
    expect(sitemap).not.toContain(`localhost:3100${hidden}/`);
  }
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  expect(robots).toContain("Sitemap: http://localhost:3100/sitemap.xml");

  for (const path of ["/", "/demo", "/contact"]) {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`^http://localhost:3100${path === "/" ? "/?" : path}$`),
    );
  }
  await page.goto("/");
  const ogImage = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content");
  expect(ogImage).toContain("/opengraph-image");
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
    "content",
    "1200",
  );
  await expect(
    page.locator('meta[property="og:image:height"]'),
  ).toHaveAttribute("content", "630");
  const image = await request.get(
    new URL(ogImage!).pathname + new URL(ogImage!).search,
  );
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");

  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  expect((await request.get("/apple-icon")).status()).toBe(200);
  expect((await request.get("/icon.svg")).status()).toBe(200);
});
