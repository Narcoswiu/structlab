import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getLocalSupabase } from "./local-supabase";

// Пълният път на повторението: отговор в четеца → карта на таблото →
// сесия в „Повторение“ → нов график в базата.

const CHAPTER = "/learn/saprotivlenie-na-materialite/razrezni-usiliya";
const PASSWORD = "e2e-review-password-1";

const status = getLocalSupabase();
const service = createClient(status.API_URL, status.SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sofiaDay = (offset: number) => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
  }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((violation) => ({
      rule: violation.id,
      example: violation.nodes[0]?.target.join(" "),
      html: violation.nodes[0]?.html.slice(0, 160),
      why: violation.nodes[0]?.failureSummary?.slice(0, 200),
    })),
  ).toEqual([]);
}

test.describe.configure({ mode: "serial" });

let email: string;
let userId: string;

// отделен потребител за всеки проект (десктоп и телефон вървят едновременно)
test.beforeAll(async ({}, testInfo) => {
  email = `review-${testInfo.project.name}-${Date.now()}@structlab.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Тест Повторение" },
  });
  if (error || !data.user) throw error ?? new Error("createUser");
  userId = data.user.id;
  const { data: plan } = await service
    .from("access_plans")
    .select("id")
    .eq("slug", "beta-free")
    .single();
  await service.from("enrollments").insert({
    user_id: userId,
    plan_id: plan!.id,
    source: "beta",
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
});

test.afterAll(async () => {
  await service.auth.admin.deleteUser(userId);
});

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(PASSWORD);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/dashboard$/);
}

test("преди първия отговор няма нищо за повторение", async ({ page }) => {
  await signIn(page);
  await expect(
    page.getByRole("region", { name: "Днес за повторение" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Повторение", exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Повторение",
  );
  await expect(
    page.getByText("Още нямаш въпроси за повторение."),
  ).toBeVisible();
  await expect(
    page.getByText("Отвори глава, стигни до „Провери се“"),
  ).toBeVisible();
});

test("в четеца отбелязвам два въпроса и те се насрочват за утре", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${CHAPTER}?mode=easy#proveri`);
  const quizzes = page.locator(".callout-quiz");
  expect(await quizzes.count()).toBeGreaterThanOrEqual(3);

  // бутоните са скрити заедно с отговора
  const first = quizzes.nth(0);
  await expect(first.getByRole("button", { name: "Знаех го" })).toBeHidden();
  await first.getByText("Покажи отговора").click();
  await expect(first.getByText("Знаеше ли отговора?")).toBeVisible();
  await first.getByRole("button", { name: "Знаех го" }).click();
  await expect(first.getByRole("status")).toHaveText(
    "Отбелязано. Ще ти го покажем пак утре.",
  );

  const second = quizzes.nth(1);
  await second.getByText("Покажи отговора").click();
  await second.getByRole("button", { name: "Не го знаех" }).click();
  await expect(second.getByRole("status")).toHaveText(
    "Няма проблем. Ще ти го покажем пак утре.",
  );

  const { data } = await service
    .from("quiz_reviews")
    .select("box, due_on, last_knew")
    .eq("user_id", userId)
    .order("last_knew");
  expect(data).toEqual([
    { box: 1, due_on: sofiaDay(1), last_knew: false },
    { box: 1, due_on: sofiaDay(1), last_knew: true },
  ]);

  // след презареждане въпросът помни кога е следващото повторение
  await page.reload();
  await page
    .locator(".callout-quiz")
    .nth(0)
    .getByText("Покажи отговора")
    .click();
  await expect(
    page.locator(".callout-quiz").nth(0).getByRole("status"),
  ).toHaveText("Следващо повторение: утре.");
  // третият въпрос още не е отговарян
  await page
    .locator(".callout-quiz")
    .nth(2)
    .getByText("Покажи отговора")
    .click();
  await expect(
    page.locator(".callout-quiz").nth(2).getByRole("status"),
  ).toContainText("Отговорът ти се записва");
});

test("таблото казва, че за днес няма въпроси, а следващите са утре", async ({
  page,
}) => {
  await signIn(page);
  const card = page.getByRole("region", { name: "Днес за повторение" });
  await expect(card).toContainText("Няма въпроси за днес");
  await expect(card).toContainText("Следващото повторение е утре.");
  await expect(card.getByRole("link", { name: "Започни" })).toHaveCount(0);

  await page.goto("/review");
  await expect(page.getByText("За днес няма въпроси.")).toBeVisible();
  await expect(page.getByText("Следващото повторение е утре.")).toBeVisible();
});

test("в деня на повторението минавам въпросите един по един", async ({
  page,
}) => {
  // без анимации: axe мери контраста на крайното състояние
  await page.emulateMedia({ reducedMotion: "reduce" });
  // все едно е минал един ден
  await service
    .from("quiz_reviews")
    .update({ due_on: sofiaDay(0) })
    .eq("user_id", userId);

  await signIn(page);
  const card = page.getByRole("region", { name: "Днес за повторение" });
  await expect(card).toContainText("2 въпроса");
  await card.getByRole("link", { name: "Започни" }).click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(
    page.getByText("Днес имаш 2 въпроса за повторение."),
  ).toBeVisible();

  const session = page.getByRole("region", { name: "Въпрос за повторение" });
  await expect(session.getByText("Въпрос 1 от 2")).toBeVisible();
  await expect(
    session.getByRole("link", { name: /Глава 1 · Разрезни усилия/ }),
  ).toBeVisible();
  // отговорът не е на страницата, преди да го поискам
  await expect(session.getByText("Отговор", { exact: true })).toHaveCount(0);
  await expect(session.getByRole("button", { name: "Знаех го" })).toHaveCount(
    0,
  );

  // без нарушения на достъпността и без хоризонтално превъртане
  await expectNoViolations(page);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await session.getByRole("button", { name: "Покажи отговора" }).click();
  await expect(session.getByText("Отговор", { exact: true })).toBeVisible();
  await expectNoViolations(page);
  await session.getByRole("button", { name: "Знаех го" }).click();

  await expect(session.getByText("Въпрос 2 от 2")).toBeVisible();
  await expect(page.getByText("Ще ти го покажем пак след 3 дни")).toBeVisible();
  await session.getByRole("button", { name: "Покажи отговора" }).click();
  await session.getByRole("button", { name: "Не го знаех" }).click();

  const done = page.getByRole("region", { name: "Край на повторението" });
  await expect(done.getByRole("heading", { name: "Готово!" })).toBeVisible();
  await expect(done).toContainText("Знаеше 1 от 2.");
  await expect(done).toContainText("За днес няма повече въпроси.");

  const { data } = await service
    .from("quiz_reviews")
    .select("box, due_on, attempts")
    .eq("user_id", userId)
    .order("box");
  expect(data).toEqual([
    { box: 1, due_on: sofiaDay(1), attempts: 2 },
    { box: 2, due_on: sofiaDay(3), attempts: 2 },
  ]);

  await done.getByRole("link", { name: "Към таблото" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("region", { name: "Днес за повторение" }),
  ).toContainText("Няма въпроси за днес");
});

test("без вход страницата не се отваря", async ({ page }) => {
  await page.goto("/review");
  await expect(page).toHaveURL(/\/login/);
});
