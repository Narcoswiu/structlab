import "server-only";
import { serverEnv } from "@/lib/env.server";

export type AiProvider = "anthropic" | "openai-compatible";

export type AiConfig = {
  provider: AiProvider;
  apiKey: string;
  apiUrl: string;
  model: string;
  /** как се казва услугата в бележката за потребителя */
  providerName: string;
  dailyLimit: number;
};

export type AiEnv = {
  AI_PROVIDER: AiProvider;
  AI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  AI_API_URL?: string;
  AI_MODEL?: string;
  AI_PROVIDER_NAME?: string;
  AI_DAILY_LIMIT: number;
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
export const DEFAULT_PROVIDER_NAME = "външна AI услуга";

/**
 * Настройките на AI услугата или null, когато тя не е включена. Без ключ –
 * а при „openai-compatible“ и без адрес и модел – помощникът работи само
 * с текста на уроците.
 */
export function resolveAiConfig(env: AiEnv): AiConfig | null {
  const providerName = env.AI_PROVIDER_NAME ?? DEFAULT_PROVIDER_NAME;
  if (env.AI_PROVIDER === "anthropic") {
    const apiKey = env.AI_API_KEY ?? env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    return {
      provider: "anthropic",
      apiKey,
      apiUrl: env.AI_API_URL ?? ANTHROPIC_URL,
      model: env.AI_MODEL ?? ANTHROPIC_MODEL,
      providerName,
      dailyLimit: env.AI_DAILY_LIMIT,
    };
  }
  if (!env.AI_API_KEY || !env.AI_API_URL || !env.AI_MODEL) return null;
  return {
    provider: "openai-compatible",
    apiKey: env.AI_API_KEY,
    apiUrl: env.AI_API_URL,
    model: env.AI_MODEL,
    providerName,
    dailyLimit: env.AI_DAILY_LIMIT,
  };
}

export function getAiConfig(): AiConfig | null {
  return resolveAiConfig(serverEnv);
}
