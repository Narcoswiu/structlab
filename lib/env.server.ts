import "server-only";
import { z } from "zod";

// Тайни настройки – само на сървъра. `server-only` спира build-а, ако някой
// компонент за браузъра се опита да внесе този файл.
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optional = z.preprocess(emptyToUndefined, z.string().optional());

const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20),
  // Поща (по избор). Без тях поканите работят само с „Копирай линка“.
  SMTP_HOST: optional,
  SMTP_PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
  SMTP_USER: optional,
  SMTP_PASS: optional,
  EMAIL_FROM: optional,
  // защитава нощната задача /api/cron/aggregate
  CRON_SECRET: optional,
});

export const serverEnv = serverEnvSchema.parse({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM,
  CRON_SECRET: process.env.CRON_SECRET,
});
