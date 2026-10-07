import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getLocalSupabase, serviceClient } from "./helpers";

// Проверява истинската функция срещу локалната база.
const status = getLocalSupabase();
const service = serviceClient(status);
const email = `throttle-${crypto.randomUUID().slice(0, 8)}@rls.test`;
const emailHash = createHash("sha256").update(email).digest("hex");

let allowLoginLink: (email: string) => Promise<boolean>;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = status.API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = status.PUBLISHABLE_KEY;
  process.env.SUPABASE_SECRET_KEY = status.SECRET_KEY;
  ({ allowLoginLink } = await import("@/lib/login-link-throttle"));
  await service.from("login_link_requests").delete().neq("id", 0);
});

afterAll(async () => {
  await service.from("login_link_requests").delete().neq("id", 0);
});

/** Премества записите за адреса назад във времето, все едно е минало време. */
async function ageRequests(minutes: number) {
  const { data } = await service
    .from("login_link_requests")
    .select("id, created_at")
    .eq("email_hash", emailHash);
  for (const row of data ?? []) {
    await service
      .from("login_link_requests")
      .update({
        created_at: new Date(
          new Date(row.created_at).getTime() - minutes * 60_000,
        ).toISOString(),
      })
      .eq("id", row.id);
  }
}

describe("ограничение на линковете за вход", () => {
  it("първото искане минава, второто веднага след него – не", async () => {
    expect(await allowLoginLink(email)).toBe(true);
    expect(await allowLoginLink(email)).toBe(false);
  });

  it("след минута минава пак, но най-много 3 на час", async () => {
    await ageRequests(2);
    expect(await allowLoginLink(email)).toBe(true);
    await ageRequests(2);
    expect(await allowLoginLink(email)).toBe(true);
    await ageRequests(2);
    expect(await allowLoginLink(email)).toBe(false);
  });

  it("след като мине час, броячът се освобождава", async () => {
    await ageRequests(61);
    expect(await allowLoginLink(email)).toBe(true);
  });

  it("лимитът е отделен за всеки адрес", async () => {
    expect(await allowLoginLink(`other-${email}`)).toBe(true);
  });
});
