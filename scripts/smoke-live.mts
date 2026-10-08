// Проверка на ЖИВИЯ сайт отвън, без вход и без ключове – само чете.
//
//   pnpm smoke:live                      проверява structlab-ivory.vercel.app
//   pnpm smoke:live https://друг.адрес   проверява друг адрес
//
// Хваща: паднала страница, изчезнали защитни заглавки, вътрешна страница,
// отворена без вход, отворен служебен адрес, изтекъл ключ в HTML-а.
const SITE = (process.argv[2] ?? "https://structlab-ivory.vercel.app").replace(
  /\/$/,
  "",
);

const PUBLIC_PAGES = [
  "/",
  "/welcome",
  "/demo",
  "/demo/uchebnik",
  "/demo/laboratoriya",
  "/request-invite",
  "/contact",
  "/privacy",
  "/terms",
  "/login",
  "/forgot-password",
];
const PRIVATE_PAGES = [
  "/dashboard",
  "/account",
  "/labs",
  "/review",
  "/tasks",
  "/admin",
];
const REQUIRED_HEADERS = [
  "content-security-policy",
  "x-frame-options",
  "referrer-policy",
  "x-content-type-options",
];
/** Низове, които никога не бива да стигат до браузъра. */
const FORBIDDEN = [
  /sb_secret_/,
  /service_role/,
  /SUPABASE_SECRET_KEY/,
  /SMTP_PASS/,
  /CRON_SECRET/,
];

let failed = 0;
const check = (ok: boolean, name: string, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` – ${detail}` : ""}`);
};

async function get(path: string, init: RequestInit = {}) {
  const started = Date.now();
  const response = await fetch(SITE + path, { redirect: "manual", ...init });
  return { response, ms: Date.now() - started };
}

console.log(`Проверка на ${SITE}\n`);

for (const path of PUBLIC_PAGES) {
  try {
    const { response, ms } = await get(path);
    const html = await response.text();
    check(
      response.status === 200,
      `${path} се отваря`,
      `${response.status}, ${ms} ms`,
    );
    check(html.includes('lang="bg"'), `${path} е на български`);
    const leak = FORBIDDEN.find((pattern) => pattern.test(html));
    check(
      !leak,
      `${path} не съдържа служебни ключове`,
      leak ? String(leak) : "",
    );
    if (path === "/") {
      for (const header of REQUIRED_HEADERS) {
        check(response.headers.has(header), `заглавка ${header}`);
      }
    }
  } catch (error) {
    check(false, `${path} се отваря`, String(error));
  }
}

for (const path of PRIVATE_PAGES) {
  const { response } = await get(path);
  const location = response.headers.get("location") ?? "";
  check(
    [302, 303, 307, 308].includes(response.status) &&
      location.includes("/login"),
    `${path} иска вход`,
    `${response.status} → ${location || "няма пренасочване"}`,
  );
}

{
  const events = await get("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "lab_open", lab: "beam" }),
  });
  check(
    events.response.status === 401,
    "/api/events отказва без вход",
    String(events.response.status),
  );
  const cron = await get("/api/cron/aggregate");
  check(
    [401, 403].includes(cron.response.status),
    "служебният адрес за нощната задача е затворен",
    String(cron.response.status),
  );
  const chapter = await get(
    "/learn/saprotivlenie-na-materialite/razrezni-usiliya",
  );
  check(
    [302, 303, 307, 308].includes(chapter.response.status),
    "платена глава не се отваря без вход",
    String(chapter.response.status),
  );
  const robots = await get("/robots.txt");
  check(robots.response.status === 200, "robots.txt");
  const sitemap = await get("/sitemap.xml");
  const xml = await sitemap.response.text();
  check(
    sitemap.response.status === 200 &&
      !xml.includes("/learn/") &&
      !xml.includes("/admin"),
    "sitemap.xml съдържа само публични страници",
  );
}

console.log(
  failed === 0
    ? "\nЖивият сайт минава всички проверки."
    : `\nНЕ МИНАВАТ: ${failed}`,
);
process.exit(failed === 0 ? 0 : 1);
