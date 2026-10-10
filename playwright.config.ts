import { defineConfig, devices } from "@playwright/test";
import { getLocalSupabase } from "./e2e/local-supabase";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;
const supabase = getLocalSupabase();

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "phone",
      use: { ...devices["Pixel 7"] },
      // пълният път „покана → вход“ се проверява веднъж, на десктоп
      testIgnore: [
        "**/auth.spec.ts",
        "**/reader.spec.ts",
        "**/catalog.spec.ts",
        "**/public.spec.ts",
        "**/tracking.spec.ts",
      ],
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 600_000,
    // Сайтът под тест говори с ЛОКАЛНАТА база и не праща имейли.
    env: {
      NEXT_PUBLIC_SITE_URL: baseURL,
      NEXT_PUBLIC_SUPABASE_URL: supabase.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.PUBLISHABLE_KEY,
      SUPABASE_SECRET_KEY: supabase.SECRET_KEY,
      CRON_SECRET: "e2e-cron-secret-0123456789",
      SMTP_HOST: "",
      EMAIL_FROM: "",
      // без ключ за AI услуга: помощникът търси само в уроците и нищо не
      // излиза извън сайта
      AI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      AI_PROVIDER: "",
    },
  },
});
