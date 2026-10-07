import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Тестовете за RLS говорят с локалната база (pnpm db:start), затова са отделно
// от бързите unit тестове.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/rls/empty-module.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/rls/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
