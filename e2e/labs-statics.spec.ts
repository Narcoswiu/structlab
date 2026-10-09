import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { E2E_READER, getLocalSupabase } from "./local-supabase";

// Лабораториите „Опорни реакции“ и „Ферма“. Числата са проверените на ръка
// в tests/engineering/plane-body.test.ts и tests/engineering/truss.test.ts.

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
const card = (page: Page, name: string | RegExp) =>
  result(page).locator("dl > div").filter({ hasText: name });
const load = (page: Page, name: string) =>
  page.getByRole("group", { name, exact: true });

const labs = [
  { path: "/labs/reactions", title: "Опорни реакции" },
  { path: "/labs/truss", title: "Ферма" },
] as const;

test("без вход лабораториите по статика не се отварят", async ({ page }) => {
  for (const lab of labs) {
    await page.goto(lab.path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("списъкът с лаборатории води до двете нови", async ({ page }) => {
  await signIn(page, E2E_READER.email, E2E_READER.password);
  for (const lab of labs) {
    await page.goto("/labs");
    const tile = page
      .locator("div")
      .filter({
        has: page.getByRole("heading", {
          level: 2,
          name: lab.title,
          exact: true,
        }),
      })
      .last();
    await tile.getByRole("link", { name: "Отвори лабораторията →" }).click();
    await expect(page).toHaveURL(new RegExp(`${lab.path}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: lab.title }),
    ).toBeVisible();
    await expect(result(page).locator("svg").first()).toBeVisible();
  }
});

test.describe("опорни реакции", () => {
  test("гредата с конзолен край: A_h = 10; A_v = 8,23; B_v = 33,09 kN", async ({
    page,
  }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/reactions");

    await expect(card(page, "A_h")).toContainText("10 kN");
    await expect(card(page, "A_h")).toContainText("надясно");
    await expect(card(page, "A_v")).toContainText("8,23 kN");
    await expect(card(page, "B_v")).toContainText("33,09 kN");
    await expect(card(page, "Проверка ΣM_B")).toContainText("0 kN·m");
    await expect(result(page)).toContainText(
      "Проверката излиза: ΣM_B = 0 – гредата е в равновесие.",
    );
    await expect(result(page).locator("svg")).toHaveAttribute(
      "aria-label",
      /A_v = 8,23 kN, B_v = 33,09 kN\. Стрелките на реакциите показват действителните им посоки\./,
    );

    // сметките с числата на потребителя
    await expect(page.getByText("B_v = 198,56 / 6 = 33,09 kN")).toHaveCount(0);
    await page.getByRole("button", { name: "Покажи как се смята" }).click();
    await expect(page.getByText("R_q = q·a = 6·4 = 24 kN")).toBeVisible();
    await expect(
      page.getByText("ΣM_A = B_v·6 − 24·2 − 12 − 17,32·8 = 0"),
    ).toBeVisible();
    await expect(page.getByText("B_v = 198,56 / 6 = 33,09 kN")).toBeVisible();
    await expect(
      page.getByText("ΣM_B = −8,23·6 + 24·4 − 12 − 17,32·2 = 0"),
    ).toBeVisible();

    // смяна на число – и с десетична запетая: q = 7,5 → B_v = (60 + 12 + 138,56)/6
    await load(page, "Товар 1: Равномерен товар")
      .getByLabel("q (надолу), kN/m")
      .fill("7,5");
    await expect(card(page, "B_v")).toContainText("35,09 kN");
    await expect(page.getByText("R_q = q·a = 7,5·4 = 30 kN")).toBeVisible();
  });

  test("конзола, наклонена сила и триъгълен товар от учебника", async ({
    page,
  }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/reactions");

    await presets(page)
      .getByRole("button", { name: "Конзола: q и сила" })
      .click();
    await expect(card(page, "A_v")).toContainText("23 kN");
    await expect(card(page, "M_A")).toContainText("46,5 kN·m");
    await expect(card(page, "M_A")).toContainText(
      "обратно на часовниковата стрелка",
    );
    await expect(card(page, "B_v")).toHaveCount(0);
    await expect(page.getByLabel("Опора B при x, m")).toHaveCount(0);

    await presets(page)
      .getByRole("button", { name: "Сила 30 kN под 45°" })
      .click();
    await expect(card(page, "A_h")).toContainText("−21,21 kN");
    await expect(card(page, "A_h")).toContainText("наляво");
    await expect(card(page, "A_v")).toContainText("14,14 kN");
    await expect(card(page, "B_v")).toContainText("7,07 kN");
    // обърната посока: силата сочи наляво → A_h става положителна
    await load(page, "Товар 1: Наклонена сила")
      .getByLabel("Посока на силата")
      .selectOption("down-left");
    await expect(card(page, "A_h")).toContainText("21,21 kN");
    await expect(card(page, "A_h")).toContainText("надясно");

    await presets(page)
      .getByRole("button", { name: "Триъгълен товар 0 → 9 kN/m" })
      .click();
    await expect(card(page, "A_v")).toContainText("9 kN");
    await expect(card(page, "B_v")).toContainText("18 kN");

    await presets(page)
      .getByRole("button", { name: "Проста греда, сила 20 kN" })
      .click();
    await expect(card(page, "A_v")).toContainText("12 kN");
    await expect(card(page, "B_v")).toContainText("8 kN");
  });

  test("добавяне и махане на товари; най-много пет", async ({ page }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/reactions");
    await presets(page)
      .getByRole("button", { name: "Проста греда, сила 20 kN" })
      .click();

    // втора сила 10 kN в средата (2,5 m) → B_v = 8 + 5 = 13; A_v = 12 + 5 = 17
    await page.getByRole("button", { name: "+ Вертикална сила" }).click();
    await expect(load(page, "Товар 2: Вертикална сила")).toBeVisible();
    await expect(card(page, "B_v")).toContainText("13 kN");
    await expect(card(page, "A_v")).toContainText("17 kN");

    for (const name of [
      "+ Наклонена сила",
      "+ Момент (двоица)",
      "+ Триъгълен товар",
    ]) {
      await page.getByRole("button", { name }).click();
    }
    await expect(page.getByText("Товари (5 от 5)")).toBeVisible();
    await expect(page.getByText(/Най-много 5 товара/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "+ Вертикална сила" }),
    ).toHaveCount(0);

    for (const index of [5, 4, 3, 2]) {
      await page
        .getByRole("button", { name: `Премахни товар ${index}` })
        .click();
    }
    await expect(card(page, "B_v")).toContainText("8 kN");
    await page.getByRole("button", { name: "Премахни товар 1" }).click();
    await expect(page.getByText(/Няма товари/)).toBeVisible();
    await expect(card(page, "A_v")).toContainText("0 kN");
    await expect(result(page)).not.toContainText(/NaN|Infinity/);
  });

  test("невалидни и неустойчиви схеми: ясно съобщение и нищо не се чупи", async ({
    page,
  }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/reactions");
    await presets(page)
      .getByRole("button", { name: "Проста греда, сила 20 kN" })
      .click();

    // грешно поле: съобщение под него, резултатът остава от последната валидна стойност
    const length = page.getByLabel("Дължина l, m");
    for (const bad of ["абв", "0", "-3", "1e999", ""]) {
      await length.fill(bad);
      await expect(length).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText("Въведи число от 0,5 до 100.")).toBeVisible();
      await expect(card(page, "B_v")).toContainText("8 kN");
      await expect(result(page)).not.toContainText(/NaN|Infinity/);
    }
    await length.fill("5");
    await expect(page.getByText("Въведи число от 0,5 до 100.")).toHaveCount(0);

    // двете опори в една точка
    await page.getByLabel("Опора B при x, m").fill("0");
    await expect(result(page).getByRole("alert")).toHaveText(
      "Двете опори са в една точка – гредата може да се завърти около нея. Раздалечи опорите A и B.",
    );
    await expect(result(page).locator("svg")).toHaveCount(0);
    await page.getByLabel("Опора B при x, m").fill("5");
    await expect(card(page, "B_v")).toContainText("8 kN");

    // гредата се скъсява и товарът остава извън нея
    await length.fill("1,5");
    await expect(result(page).getByRole("alert")).toHaveText(
      "Опората B е извън гредата (от 0 до 1,5 m).",
    );
    await page.getByLabel("Опора B при x, m").fill("1,5");
    await expect(result(page).getByRole("alert")).toHaveText(
      "Товар 1: мястото е извън гредата (от 0 до 1,5 m).",
    );
    await load(page, "Товар 1: Вертикална сила")
      .getByLabel("Място x, m")
      .fill("0,5");
    // B_v = 20·0,5/1,5 = 6,67
    await expect(card(page, "B_v")).toContainText("6,67 kN");

    // разпределен товар без дължина
    await page.getByRole("button", { name: "+ Равномерен товар" }).click();
    await load(page, "Товар 2: Равномерен товар")
      .getByLabel("до x, m")
      .fill("0");
    await expect(result(page).getByRole("alert")).toContainText(
      "Товар 2: разпределеният товар трябва да има дължина",
    );
    await expect(result(page)).not.toContainText(/NaN|Infinity/);
  });
});

test.describe("ферма", () => {
  test("изпитната ферма: реакции, 13 усилия, определимост и сметки", async ({
    page,
  }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/truss");

    await expect(card(page, "A_h")).toContainText("−12 kN");
    await expect(card(page, "A_v")).toContainText("36 kN");
    await expect(card(page, "B_v")).toContainText("24 kN");
    await expect(card(page, "Най-голям опън")).toContainText("39 kN");
    await expect(card(page, "Най-голям опън")).toContainText("пръти AC и CD");
    await expect(card(page, "Най-голям натиск")).toContainText("−45 kN");
    await expect(card(page, "Най-голям натиск")).toContainText("прът AF");
    await expect(card(page, /Определимост/)).toContainText("13 + 3 = 2·8");

    const table = page.getByRole("region", {
      name: "Таблица с усилията в прътите",
    });
    await expect(table).toHaveAttribute("tabindex", "0");
    const row = (id: string) =>
      table.getByRole("row").filter({
        has: page.getByRole("rowheader", { name: id, exact: true }),
      });
    await expect(table.getByRole("row")).toHaveCount(14);
    for (const [id, length, force, state] of [
      ["AC", "3", "39", "опън"],
      ["DE", "3", "18", "опън"],
      ["FG", "3", "−24", "натиск"],
      ["AF", "5", "−45", "натиск"],
      ["HB", "5", "−30", "натиск"],
      ["CF", "4", "0", "нулев"],
      ["DG", "4", "−20", "натиск"],
      ["FD", "5", "−5", "натиск"],
      ["DH", "5", "30", "опън"],
    ] as const) {
      await expect(row(id).getByRole("cell")).toHaveText([
        length,
        force,
        state,
      ]);
    }
    await expect(result(page).locator("svg")).toHaveAttribute(
      "aria-label",
      /Най-голям опън 39 kN в пръти AC, CD\. Най-голям натиск 45 kN в прът AF\. Опънатите пръти са с плътна линия, натиснатите – с пунктир/,
    );

    await page.getByRole("button", { name: "Покажи как се смята" }).click();
    await expect(
      page.getByText("Положителен резултат е опън, отрицателен – натиск."),
    ).toBeVisible();
    await expect(
      page.getByText("ΣM_A = B_v·12 − 40·3 − 20·6 − 12·4 = 0"),
    ).toBeVisible();
    await expect(page.getByText("ΣF_y = 36 + 0,8·S_AF = 0")).toBeVisible();
    await expect(page.getByText("S_AF = −45 kN (натиск)")).toBeVisible();
    await expect(
      page.getByText("ΣM_D = −36·6 + 40·3 − S_FG·4 = 0"),
    ).toBeVisible();
    await expect(page.getByText("S_FG = −24 kN (натиск)")).toBeVisible();

    // смяна на число: без хоризонталната сила реакциите са само от 40 и 20 kN
    await page
      .getByLabel("Хоризонтална сила във възел H (надясно +), kN")
      .fill("0");
    await expect(card(page, "A_h")).toContainText("0 kN");
    // B_v = (40·3 + 20·6)/12 = 20; A_v = 40
    await expect(card(page, "B_v")).toContainText("20 kN");
    await expect(card(page, "A_v")).toContainText("40 kN");
  });

  test("фермата-мост, покривната и триъгълната ферма от учебника", async ({
    page,
  }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/truss");
    const table = page.getByRole("region", {
      name: "Таблица с усилията в прътите",
    });
    const force = (id: string) =>
      table
        .getByRole("row")
        .filter({ has: page.getByRole("rowheader", { name: id, exact: true }) })
        .getByRole("cell")
        .nth(1);

    await presets(page)
      .getByRole("button", { name: "Ферма-мост: 3 × 20 kN" })
      .click();
    await expect(card(page, "A_v")).toContainText("30 kN");
    await expect(card(page, "B_v")).toContainText("30 kN");
    await expect(force("FG")).toHaveText("−30");
    await expect(force("CD")).toHaveText("22,5");
    await expect(force("FD")).toHaveText("12,5");
    await expect(force("AF")).toHaveText("−37,5");
    await expect(force("DG")).toHaveText("0");
    // по-ниска ферма – по-големи усилия в поясите: S_FG = −120/h
    await page.getByLabel("Височина h, m").fill("2");
    await expect(force("FG")).toHaveText("−60");
    await expect(card(page, "A_v")).toContainText("30 kN");

    await presets(page)
      .getByRole("button", { name: "Покривна ферма 8 × 3 m" })
      .click();
    await expect(card(page, "A_v")).toContainText("21 kN");
    await expect(card(page, "B_v")).toContainText("27 kN");
    await expect(table.getByRole("row")).toHaveCount(10);
    await expect(force("AC")).toHaveText("−35");
    await expect(force("CE")).toHaveText("−25");
    await expect(force("AD")).toHaveText("28");
    await expect(force("DB")).toHaveText("36");
    await expect(force("CD")).toHaveText("−10");
    await expect(force("FD")).toHaveText("−20");
    await expect(force("DE")).toHaveText("18");
    await expect(card(page, /Определимост/)).toContainText("9 + 3 = 2·6");
    await page.getByRole("button", { name: "Покажи как се смята" }).click();
    await expect(
      page.getByText("ΣM_D = −21·4 + 12·2 − S_CE·2,4 = 0"),
    ).toBeVisible();

    await presets(page)
      .getByRole("button", { name: "Триъгълна ферма 4 × 1,5 m" })
      .click();
    await expect(card(page, "A_v")).toContainText("6 kN");
    await expect(force("AC")).toHaveText("−10");
    await expect(force("CB")).toHaveText("−10");
    await expect(force("AB")).toHaveText("8");
    // изборът на геометрия връща нейния пример
    await page
      .getByRole("button", { name: "Успоредни пояси, 4 панела" })
      .click();
    await expect(table.getByRole("row")).toHaveCount(14);
    await expect(force("AF")).toHaveText("−45");
  });

  test("невалидни данни: ясно съобщение и нищо не се чупи", async ({
    page,
  }) => {
    await signIn(page, E2E_READER.email, E2E_READER.password);
    await page.goto("/labs/truss");

    // нулева височина = геометрично изменяема ферма: полето не я приема
    const height = page.getByLabel("Височина h, m");
    for (const bad of ["0", "абв", "-2", "1e999", ""]) {
      await height.fill(bad);
      await expect(height).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText("Въведи число от 0,1 до 50.")).toBeVisible();
      await expect(card(page, "A_v")).toContainText("36 kN");
      await expect(result(page)).not.toContainText(/NaN|Infinity/);
    }
    await height.fill("4");
    await expect(page.getByText("Въведи число от 0,1 до 50.")).toHaveCount(0);

    const loadF = page.getByLabel("Възел F (горен), надолу, kN");
    await loadF.fill("-5");
    await expect(loadF).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Въведи число от 0 до 10000.")).toBeVisible();
    await loadF.fill("40");

    // без товари: всички пръти са нулеви, нищо не се чупи
    await loadF.fill("0");
    await page.getByLabel("Възел G (горен), надолу, kN").fill("0");
    await page
      .getByLabel("Хоризонтална сила във възел H (надясно +), kN")
      .fill("0");
    await expect(card(page, "Най-голям опън")).toContainText("няма");
    await expect(card(page, "A_v")).toContainText("0 kN");
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
    if (path === "/labs/reactions") {
      // пълен списък с товари – най-тясното място на телефон
      for (const name of ["+ Наклонена сила", "+ Триъгълен товар"]) {
        await page.getByRole("button", { name }).click();
      }
      await expect(page.getByText("Товари (5 от 5)")).toBeVisible();
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
      .locator(".lab button, .lab input[type=text], .lab select")
      .evaluateAll((nodes) =>
        nodes
          .map((node) => Math.round(node.getBoundingClientRect().height))
          .filter((height) => height < 44),
      );
    expect(small).toEqual([]);
  }
});

test("неустойчива схема: съобщението също минава проверката за достъпност", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, E2E_READER.email, E2E_READER.password);
  await page.goto("/labs/reactions");
  await page.getByLabel("Опора B при x, m").fill("0");
  await expect(result(page).getByRole("alert")).toContainText(
    "Двете опори са в една точка",
  );
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
  const email = `nolab-statics-${Date.now()}-${Math.round(Math.random() * 1e6)}@structlab.test`;
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
