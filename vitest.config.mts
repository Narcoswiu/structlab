import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // "server-only" хвърля грешка извън Next.js; в тестовете е празен модул
      "server-only": fileURLToPath(
        new URL("./tests/rls/empty-module.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    // измислени стойности: unit тестовете не говорят с база, но модулите за
    // настройки проверяват, че променливите съществуват
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "unit-test-publishable-key-000000",
      SUPABASE_SECRET_KEY: "unit-test-secret-key-0000000000000",
    },
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/rls/**"],
  },
});
