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
  // Помощникът по учебника. Без ключ търси само в уроците (безплатно);
  // с ключ въпросите се пращат към избраната AI услуга.
  AI_PROVIDER: z.preprocess(
    emptyToUndefined,
    z.enum(["anthropic", "openai-compatible"]).default("openai-compatible"),
  ),
  AI_API_KEY: optional,
  // приема се вместо AI_API_KEY, когато AI_PROVIDER=anthropic
  ANTHROPIC_API_KEY: optional,
  AI_API_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  AI_MODEL: optional,
  // името, което потребителят вижда в бележката под полето за въпрос
  AI_PROVIDER_NAME: optional,
  AI_DAILY_LIMIT: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(10_000).default(20),
  ),
});

export const serverEnv = serverEnvSchema.parse({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM,
  CRON_SECRET: process.env.CRON_SECRET,
  AI_PROVIDER: process.env.AI_PROVIDER,
  AI_API_KEY: process.env.AI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  AI_API_URL: process.env.AI_API_URL,
  AI_MODEL: process.env.AI_MODEL,
  AI_PROVIDER_NAME: process.env.AI_PROVIDER_NAME,
  AI_DAILY_LIMIT: process.env.AI_DAILY_LIMIT,
});
