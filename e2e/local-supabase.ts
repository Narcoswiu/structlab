import { execFileSync } from "node:child_process";

export type LocalSupabase = {
  API_URL: string;
  PUBLISHABLE_KEY: string;
  SECRET_KEY: string;
};

/** Настройките на локалната база (pnpm db:start). Тестовете не пипат истинската. */
export function getLocalSupabase(): LocalSupabase {
  const raw = execFileSync(
    "pnpm",
    ["exec", "supabase", "status", "-o", "json"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  );
  const status = JSON.parse(raw.slice(raw.indexOf("{"))) as LocalSupabase;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL)) {
    throw new Error("E2E тестовете се пускат само срещу локалната база.");
  }
  return status;
}

export const E2E_ADMIN = {
  email: "admin-e2e@structlab.test",
  password: "e2e-admin-password-1",
};

/** Студент с активен план – за тестовете на четеца. */
export const E2E_READER = {
  email: "reader-e2e@structlab.test",
  password: "e2e-reader-password-1",
};
