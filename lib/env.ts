import { z } from "zod";

// Публични настройки (видими и в браузъра). Тайните ключове идват в Етап 4
// и ще се четат само на сървъра.
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
