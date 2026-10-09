import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { E2E_READER, getLocalSupabase } from "./local-supabase";

// Лабораториите „Напрежения в сечение“, „Провисване на греда“ и „Изкълчване
// на прът“. Числата са отпечатаните в учебника (виж tests/labs/*.test.ts).

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(password);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/dashboard$/);
}

const result = (page: Page) => page.getByRole("region", { name: "Резултат" });
const presets = (page: Page) =>
  page.getByRole("region", { name: "Готови примери" });

const labs = [
  { path: "/labs/stresses", title: "Напрежения в сечение" },
  { path: "/labs/deflection", title: "Провисване на греда" },
  { path: "/labs/buckling", title: "Изкълчване на прът" },
] as const;

test("без вход новите лаборатории не се отварят", async ({ page }) => {
  for (const lab of labs) {
    await page.goto(lab.path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("списъкът с лаборатории води до трите нови", async ({ page }) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  for (const [index, lab] of labs.entries()) {
    await page.goto("/labs");
    await expect(
      page.getByRole("heading", { level: 2, name: lab.title }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Отвори лабораторията →" })
      .nth(2 + index)
      .click();
    await expect(page).toHaveURL(new RegExp(`${lab.path}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: lab.title }),
    ).toBeVisible();
    await expect(result(page).locator("svg").first()).toBeVisible();
  }
});

test.describe("напрежения в сечение", () => {
  test("правоъгълник 10×20: M = 8 kN·m → 12 MPa; Q = 8 kN → 0,6 MPa", async ({
    page,
  }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/stresses");

    await expect(result(page).locator("svg")).toHaveCount(2);
    await expect(result(page)).toContainText("6666,67 cm⁴");
    await expect(result(page)).toContainText("666,67 cm³");
    const tension = result(page)
      .locator("dl > div")
      .filter({ hasText: "σ_max опън" });
    await expect(tension).toContainText("12 MPa");
    await expect(tension).toContainText("в долното влакно");
    const shear = result(page).locator("dl > div").filter({ hasText: "τ_max" });
    await expect(shear).toContainText("0,6 MPa");
    await expect(shear).toContainText("на неутралната ос");

    // числата се сменят веднага – и с десетична запетая: W = 10·24,5²/6
    await page.getByLabel("Височина h, cm").fill("24,5");
    await expect(result(page)).toContainText("1000,42 cm³");

    // обърнат момент: опънът минава горе
    await page.getByLabel("Височина h, cm").fill("20");
    await page.getByLabel("Огъващ момент M, kN·m").fill("-8");
    await expect(tension).toContainText("12 MPa");
    await expect(tension).toContainText("в горното влакно");
  });

  test("сечения „Т“ и „I“ от учебника; сметките с числата", async ({
    page,
  }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/stresses");

    await presets(page).getByRole("button", { name: "Сечение „Т“" }).click();
    await expect(result(page)).toContainText("567,39 cm⁴");
    await expect(result(page)).toContainText("8,27 cm");
    await expect(result(page)).toContainText("58,32 MPa");
    await expect(result(page)).toContainText("26,28 MPa");
    await expect(result(page)).toContainText("6,03 MPa");
    await expect(result(page)).toContainText("87 %");

    await expect(page.getByText("400·8,27 / 567,39")).toHaveCount(0);
    await page.getByRole("button", { name: "Покажи как се смята" }).click();
    await expect(
      page.getByText(
        "σ_долу = M·y_долу / I_x = 400·8,27 / 567,39 = 5,832 kN/cm² = 58,32 MPa (опън)",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "τ_max = Q·S / (I_x·b) = 10·68,44 / (567,39·2) = 0,603 kN/cm² = 6,03 MPa",
      ),
    ).toBeVisible();

    await presets(page).getByRole("button", { name: "Сечение „I“" }).click();
    await expect(result(page)).toContainText("2486,97 cm⁴");
    await expect(result(page)).toContainText("43,36 MPa");
    await expect(result(page)).toContainText("94 %");
    await page.getByRole("button", { name: "Скрий сметките" }).click();
    await expect(page.getByText("σ_долу = M·y_долу")).toHaveCount(0);
  });

  test("невалидни данни: ясно съобщение и нищо не се чупи", async ({
    page,
  }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/stresses");

    // грешно поле: съобщение под него, резултатът остава от последната валидна стойност
    const width = page.getByLabel("Ширина b, cm");
    for (const bad of ["абв", "0", "-3", "1e999", ""]) {
      await width.fill(bad);
      await expect(width).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText("Въведи число от 0,1 до 500.")).toBeVisible();
      await expect(result(page)).toContainText("12 MPa");
      await expect(result(page)).not.toContainText(/NaN|Infinity/);
    }
    await width.fill("12");
    await expect(page.getByText("Въведи число от 0,1 до 500.")).toHaveCount(0);
    await expect(result(page)).toContainText("10 MPa");

    // без усилия: няма диаграми, но няма и грешка
    await page.getByLabel("Огъващ момент M, kN·m").fill("0");
    await page.getByLabel("Напречна сила Q, kN").fill("0");
    await expect(result(page).locator("svg")).toHaveCount(0);
    await expect(result(page)).toContainText(
      "M = 0 – няма нормални напрежения",
    );
    await expect(result(page)).toContainText("Q = 0 – няма тангенциални");
    await expect(result(page)).not.toContainText(/NaN|Infinity/);

    // стебло, по-широко от пояса
    await page
      .getByRole("group", { name: "Вид на сечението" })
      .getByRole("button", { name: "Сечение „Т“" })
      .click();
    await page.getByLabel("Дебелина на стеблото, cm").fill("12");
    await expect(result(page).getByRole("alert")).toHaveText(
      "Стеблото трябва да е по-тясно от пояса.",
    );
    await page.getByLabel("Дебелина на стеблото, cm").fill("2");
    await expect(result(page)).toContainText("567,39 cm⁴");
  });
});

test.describe("провисване на греда", () => {
  test("дървената греда 10×20 от учебника: f = 18,18 mm (1,82 cm), l/220", async ({
    page,
  }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/deflection");

    await expect(result(page).locator("svg")).toBeVisible();
    await expect(result(page).locator("svg")).toContainText("f = 18,18 mm");
    await expect(result(page)).toContainText("1,82 cm – в средата");
    await expect(result(page)).toContainText("0,01455 rad");
    await expect(result(page)).toContainText("0,83°");
    await expect(result(page)).toContainText("l/220");
    await expect(result(page)).toContainText("733,33 kN·m²");
    await expect(result(page)).toContainText(
      "Условието не е изпълнено: f = 18,18 mm > l/250 = 16 mm.",
    );

    // допустимото провисване е на потребителя: с l/200 условието минава
    await page.getByLabel(/Допустимо провисване по условието/).fill("200");
    await expect(result(page)).toContainText(
      "Условието е изпълнено: f = 18,18 mm ≤ l/200 = 20 mm.",
    );

    // стомана вместо дърво: 18,18·1100/21000 = 0,95 mm
    await page.getByRole("button", { name: "Стомана – 21 000" }).click();
    await expect(page.getByLabel("Модул на еластичност E, kN/cm²")).toHaveValue(
      "21000",
    );
    await expect(result(page)).toContainText("0,95 mm");
    await page
      .getByRole("button", { name: "Дърво – 1 100 (примерна стойност)" })
      .click();
    await expect(result(page)).toContainText("18,18 mm");

    await page.getByRole("button", { name: "Покажи как се смята" }).click();
    await expect(
      page.getByText("f = 5·4·4⁴ / (384·733,33) = 0,01818 m"),
    ).toBeVisible();
    await expect(
      page.getByText("f = 0,01818·1000 = 18,18 mm (1,82 cm)"),
    ).toBeVisible();
  });

  test("конзоли и сила в средата – числата от учебника", async ({ page }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/deflection");

    await presets(page)
      .getByRole("button", { name: "Стоманена конзола" })
      .click();
    await expect(result(page)).toContainText("6,54 mm");
    await expect(result(page)).toContainText("0,65 cm – в свободния край");
    await expect(result(page)).toContainText("0,0049 rad");
    await expect(page.getByLabel("Инерционен момент I_x, cm⁴")).toHaveValue(
      "1943",
    );

    await presets(page).getByRole("button", { name: "Сила в средата" }).click();
    await expect(result(page)).toContainText("1,12 cm – в средата");

    await presets(page)
      .getByRole("button", { name: "Конзола с товар" })
      .click();
    await expect(result(page)).toContainText("0,72 cm – в свободния край");
    await expect(result(page)).toContainText("0,00643 rad");

    // смяна на схемата на ръка: същата греда като проста с равномерен товар
    // f = 5·8·1,5⁴/(384·700) = 0,75 mm
    await page
      .getByRole("button", { name: "Проста греда с равномерен товар" })
      .click();
    await expect(result(page)).toContainText("0,75 mm");
  });

  test("невалидни данни: ясно съобщение и нищо не се чупи", async ({
    page,
  }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/deflection");

    const span = page.getByLabel("Отвор l, m");
    for (const bad of ["0", "абв", "999", ""]) {
      await span.fill(bad);
      await expect(span).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText("Въведи число от 0,1 до 50.")).toBeVisible();
      await expect(result(page)).toContainText("18,18 mm");
    }
    await span.fill("4");

    // без товар: няма провисване, няма NaN
    await page.getByLabel("q (надолу), kN/m").fill("0");
    await expect(result(page)).toContainText("няма провисване");
    await expect(result(page).locator("svg")).toContainText("f = 0 mm");
    await expect(result(page)).not.toContainText(/NaN|Infinity/);
  });
});

test.describe("изкълчване на прът", () => {
  test("прът d = 4 cm, l = 1,5 m: F_cr = 115,76 kN; при две запъвания Ойлер не важи", async ({
    page,
  }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/buckling");

    await expect(result(page).locator("svg")).toBeVisible();
    await expect(result(page)).toContainText(
      "Формулата на Ойлер е приложима: λ = 150 ≥ λ_гр = 101,8.",
    );
    await expect(result(page)).toContainText("12,57 cm⁴");
    await expect(result(page)).toContainText("115,76 kN");
    await expect(result(page)).toContainText("92,12 MPa");
    await expect(result(page)).toContainText("38,59 kN");

    // четирите подпирания от пример 2
    await page.getByRole("radio", { name: /Запъване – свободен край/ }).check();
    await expect(result(page)).toContainText("28,94 kN");
    await page.getByRole("radio", { name: /Запъване – шарнир/ }).check();
    await expect(result(page)).toContainText("236,24 kN");

    // къс и дебел прът: ясна присъда и никаква „критична сила“
    await page.getByRole("radio", { name: /Запъване – запъване/ }).check();
    await expect(result(page)).toContainText(
      "Формулата на Ойлер НЕ е приложима: λ = 75 < λ_гр = 101,8.",
    );
    const force = result(page)
      .locator("dl > div")
      .filter({ hasText: "Критична сила F_cr" });
    await expect(force).toContainText("не се определя по Ойлер");
    await expect(result(page).locator("dl")).not.toContainText("463");
    await expect(result(page)).not.toContainText("Допустима сила");
    await expect(result(page).locator("svg")).toContainText("Ойлер не важи");

    await page.getByRole("button", { name: "Покажи как се смята" }).click();
    await expect(
      page.getByText("Защо формулата на Ойлер не важи тук"),
    ).toBeVisible();

    // по-висока граница на пропорционалност по условието → пак важи
    await page.getByLabel(/граница на пропорционалност/).fill("400");
    await expect(result(page)).toContainText("Формулата на Ойлер е приложима");
    await expect(result(page)).toContainText("463,03 kN");
  });

  test("тръба и шина от учебника; сметките с числата", async ({ page }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/buckling");

    await page.getByRole("button", { name: "Тръба 10/8 cm" }).click();
    await expect(result(page)).toContainText("289,81 cm⁴");
    await expect(result(page)).toContainText("124,9");
    await expect(result(page)).toContainText("375,42 kN");
    await expect(result(page)).toContainText("132,78 MPa");

    await page.getByRole("button", { name: "Шина 3×6 cm" }).click();
    await expect(result(page)).toContainText("13,5 cm⁴");
    await expect(result(page)).toContainText("около оста y");
    await expect(result(page)).toContainText("161,7");
    await expect(result(page)).toContainText("142,76 kN");

    await page.getByRole("button", { name: "Покажи как се смята" }).click();
    await expect(page.getByText("I_min = 6·3³ / 12 = 13,5 cm⁴")).toBeVisible();
    await expect(
      page.getByText("λ = μ·l / i_min = 140 / 0,87 = 161,7"),
    ).toBeVisible();
  });

  test("невалидни данни: ясно съобщение и нищо не се чупи", async ({
    page,
  }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/buckling");

    const length = page.getByLabel("Дължина l, m");
    for (const bad of ["0", "абв", "-2", ""]) {
      await length.fill(bad);
      await expect(length).toHaveAttribute("aria-invalid", "true");
      await expect(
        page.getByText("Въведи число от 0,01 до 100."),
      ).toBeVisible();
      await expect(result(page)).toContainText("115,76 kN");
    }
    await length.fill("1,5");

    const safety = page.getByLabel(/Коефициент на сигурност n/);
    await safety.fill("0,5");
    await expect(safety).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Въведи число от 1 до 100.")).toBeVisible();
    await safety.fill("3");

    // тръба с вътрешен диаметър, по-голям от външния
    await page.getByRole("button", { name: "Тръба", exact: true }).click();
    await expect(result(page).locator("svg")).toBeVisible();
    await page.getByLabel("Вътрешен диаметър d, cm").fill("5");
    await expect(result(page).getByRole("alert")).toHaveText(
      "Вътрешният диаметър трябва да е по-малък от външния.",
    );
    await expect(result(page).locator("svg")).toHaveCount(0);
    await page.getByLabel("Вътрешен диаметър d, cm").fill("3");
    await expect(result(page).locator("svg")).toBeVisible();
    await expect(result(page)).not.toContainText(/NaN|Infinity/);
  });
});

test("достъпност и телефон: без нарушения и без хоризонтално превъртане", async ({
  page,
}) => {
  // без анимации: axe мери контраста на крайното състояние
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, E2E_READER.email, E2E_READER.password);
  for (const path of ["/labs", ...labs.map((lab) => lab.path)]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (path !== "/labs") {
      await page.getByRole("button", { name: "Покажи как се смята" }).click();
      // и грешно поле – съобщението също се проверява
      await page.locator(".lab input[type=text]").first().fill("абв");
      await expect(page.getByText(/^Въведи число от/)).toBeVisible();
    }
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        rule: v.id,
        example: v.nodes[0]?.target.join(" "),
      })),
    ).toEqual([]);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    // всичко, което се натиска в лабораторията, е поне 44 px високо
    const small = await page
      .locator(".lab button, .lab input[type=text]")
      .evaluateAll((nodes) =>
        nodes
          .map((node) => Math.round(node.getBoundingClientRect().height))
          .filter((height) => height < 44),
      );
    expect(small).toEqual([]);
  }
});

test("изкълчване: присъдата „не важи“ също минава проверката за достъпност", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, E2E_READER.email, E2E_READER.password);
  await page.goto("/labs/buckling");
  await page.getByRole("radio", { name: /Запъване – запъване/ }).check();
  await expect(result(page)).toContainText("НЕ е приложима");
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("потребител без активен план вижда обяснение вместо лабораториите", async ({
  page,
}) => {
  const supabase = getLocalSupabase();
  const service = createClient(supabase.API_URL, supabase.SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `nolab-more-${Date.now()}-${Math.round(Math.random() * 1e6)}@structlab.test`;
  const password = "nolab-password-1";
  await service.auth.admin.createUser({ email, password, email_confirm: true });

  await signIn(page, email, password);
  for (const lab of labs) {
    await page.goto(lab.path);
    await expect(
      page.getByRole("heading", { name: "Нямаш активен достъп" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Резултат" })).toHaveCount(0);
    await expect(page.getByRole("textbox")).toHaveCount(0);
  }
});
