// Една команда, която пуска всички проверки наред и казва ясно какво минава.
//
//   pnpm check          всичко: форматиране, lint, типове, тестове, данни,
//                       достъп до базата (RLS) и тестове в браузър
//   pnpm check:fast     само бързите – без локалната база и без браузър
//
// Пълната проверка иска пусната локална база (pnpm db:start). Тестовете в
// браузър строят сайта и го пускат на порт 3100.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

type Step = {
  name: string;
  command: string[];
  /** нужна е локалната база */
  needsDb?: boolean;
  /** пропуска се, ако условието не е изпълнено (с обяснение) */
  skipUnless?: () => string | null;
};

const fast = process.argv.includes("--fast");

const hasChapters = () =>
  existsSync("content/saprotivlenie-na-materialite/chapters")
    ? null
    : "главите не са на тази машина";

const steps: Step[] = [
  {
    name: "Форматиране",
    command: ["pnpm", "exec", "prettier", "--check", "."],
  },
  { name: "Lint", command: ["pnpm", "lint"] },
  { name: "Типове", command: ["pnpm", "typecheck"] },
  { name: "Тестове (unit)", command: ["pnpm", "test"] },
  { name: "Каталог", command: ["pnpm", "catalog:verify"] },
  { name: "Планове на дисциплините", command: ["pnpm", "outlines:verify"] },
  {
    name: "Глави на учебника",
    command: ["pnpm", "content:verify"],
    skipUnless: hasChapters,
  },
  {
    name: "Достъп до базата (RLS)",
    command: ["pnpm", "test:rls"],
    needsDb: true,
  },
  { name: "Браузър (e2e)", command: ["pnpm", "e2e"], needsDb: true },
];

function localDbRunning(): boolean {
  try {
    const raw = execFileSync(
      "pnpm",
      ["exec", "supabase", "status", "-o", "json"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return raw.includes("API_URL");
  } catch {
    return false;
  }
}

/** Освобождава порта на тестовия сървър, ако е останал зает от предишен опит. */
function freeTestPort() {
  const found = spawnSync("lsof", ["-ti:3100"], { encoding: "utf8" });
  for (const pid of found.stdout.split("\n").filter(Boolean)) {
    spawnSync("kill", [pid]);
  }
}

const dbUp = fast ? false : localDbRunning();
const results: {
  name: string;
  status: "ok" | "fail" | "skip";
  note: string;
}[] = [];

for (const step of steps) {
  const skip =
    step.skipUnless?.() ??
    (step.needsDb && fast
      ? "бърза проверка"
      : step.needsDb && !dbUp
        ? "локалната база не е пусната (pnpm db:start)"
        : null);
  if (skip) {
    results.push({ name: step.name, status: "skip", note: skip });
    continue;
  }
  if (step.name.startsWith("Браузър")) freeTestPort();
  const started = Date.now();
  process.stdout.write(`\n▶ ${step.name}\n`);
  const run = spawnSync(step.command[0]!, step.command.slice(1), {
    stdio: "inherit",
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  results.push({
    name: step.name,
    status: run.status === 0 ? "ok" : "fail",
    note: `${seconds} s`,
  });
}

const mark = { ok: "✓", fail: "✗", skip: "–" };
console.log("\n──────── Обобщение ────────");
for (const result of results) {
  console.log(
    `${mark[result.status]} ${result.name.padEnd(28)} ${result.note}`,
  );
}
const failed = results.filter((result) => result.status === "fail");
const skipped = results.filter((result) => result.status === "skip");
console.log(
  failed.length > 0
    ? `\nНЕ МИНАВА: ${failed.map((result) => result.name).join(", ")}`
    : skipped.length > 0
      ? `\nМинава всичко пуснато. Пропуснати: ${skipped.length} (виж по-горе защо).`
      : "\nВсичко минава.",
);
process.exit(failed.length > 0 ? 1 : 0);
