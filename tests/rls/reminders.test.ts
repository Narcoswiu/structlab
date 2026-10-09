import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createSignedInUser,
  getLocalSupabase,
  serviceClient,
  type Db,
} from "./helpers";

// Достъп до таблиците на напомнянията: главният ключ (app_settings), логът
// на писмата (email_log) и кодът за отписване (user_settings).
// Тук главният ключ НЕ се включва – проверява се само кой може да го пипа.

type TestUser = { id: string; email: string; client: Db };

const status = getLocalSupabase();
const service = serviceClient(status);
const anon = anonClient(status);

let alice: TestUser;
let bob: TestUser;
let admin: TestUser;

const readSwitch = async () =>
  (
    await service
      .from("app_settings")
      .select("value, updated_at, updated_by")
      .eq("key", "reminders")
      .single()
  ).data!;

beforeAll(async () => {
  alice = await createSignedInUser(status, service, "rem-alice");
  bob = await createSignedInUser(status, service, "rem-bob");
  admin = await createSignedInUser(status, service, "rem-admin");
  await service.from("profiles").update({ role: "admin" }).eq("id", admin.id);
  const { error } = await service.from("email_log").insert([
    { user_id: alice.id, kind: "review_due", status: "sent" },
    { user_id: bob.id, kind: "weekly", status: "failed", error: "EAUTH" },
  ]);
  if (error) throw error;
});

afterAll(async () => {
  for (const user of [alice, bob, admin]) {
    if (user) await service.auth.admin.deleteUser(user.id);
  }
});

describe("app_settings (главният ключ)", () => {
  it("има ред „reminders“ с поле enabled", async () => {
    const row = await readSwitch();
    expect(row.value).toHaveProperty("enabled");
  });

  it("без вход няма достъп", async () => {
    const read = await anon.from("app_settings").select("*");
    expect(read.error).not.toBeNull();
    expect(read.data).toBeNull();
    const write = await anon
      .from("app_settings")
      .update({ value: { enabled: true } })
      .eq("key", "reminders");
    expect(write.error).not.toBeNull();
  });

  it("студент не го вижда и не може да го смени", async () => {
    const before = await readSwitch();
    const read = await alice.client.from("app_settings").select("*");
    expect(read.error).toBeNull();
    expect(read.data).toEqual([]);

    const write = await alice.client
      .from("app_settings")
      .update({ value: { enabled: true }, updated_by: alice.id })
      .eq("key", "reminders")
      .select("key");
    expect(write.data ?? []).toEqual([]);
    expect(await readSwitch()).toEqual(before);
  });

  it("студент не може да добави или изтрие настройка", async () => {
    const insert = await alice.client
      .from("app_settings")
      .insert({ key: "reminders-2", value: { enabled: true } });
    expect(insert.error).not.toBeNull();
    const remove = await alice.client
      .from("app_settings")
      .delete()
      .eq("key", "reminders");
    expect(remove.error).not.toBeNull();
    expect(await readSwitch()).toBeTruthy();
  });

  it("администратор го вижда и може да го записва (без да го включваме)", async () => {
    const before = await readSwitch();
    const read = await admin.client
      .from("app_settings")
      .select("key, value")
      .eq("key", "reminders");
    expect(read.data).toEqual([{ key: "reminders", value: before.value }]);

    // записваме същата стойност – проверяваме правото, не сменяме ключа
    const write = await admin.client
      .from("app_settings")
      .update({ value: before.value, updated_by: admin.id })
      .eq("key", "reminders")
      .select("updated_by");
    expect(write.error).toBeNull();
    expect(write.data).toEqual([{ updated_by: admin.id }]);
    await service
      .from("app_settings")
      .update({ updated_by: before.updated_by, updated_at: before.updated_at })
      .eq("key", "reminders");
  });

  it("и администратор не добавя и не трие редове през клиента", async () => {
    const insert = await admin.client
      .from("app_settings")
      .insert({ key: "reminders-2", value: {} });
    expect(insert.error).not.toBeNull();
    const remove = await admin.client
      .from("app_settings")
      .delete()
      .eq("key", "reminders");
    expect(remove.error).not.toBeNull();
  });
});

describe("email_log", () => {
  it("без вход няма достъп", async () => {
    const read = await anon.from("email_log").select("*");
    expect(read.error).not.toBeNull();
    expect(read.data).toBeNull();
  });

  it("всеки вижда само своите писма", async () => {
    const mine = await alice.client
      .from("email_log")
      .select("user_id, kind, status");
    expect(mine.data).toEqual([
      { user_id: alice.id, kind: "review_due", status: "sent" },
    ]);
    const theirs = await alice.client
      .from("email_log")
      .select("id")
      .eq("user_id", bob.id);
    expect(theirs.data).toEqual([]);
  });

  it("администратор вижда писмата на всички", async () => {
    const { data } = await admin.client
      .from("email_log")
      .select("user_id, kind, status, error")
      .in("user_id", [alice.id, bob.id])
      .order("kind");
    expect(data).toEqual([
      { user_id: alice.id, kind: "review_due", status: "sent", error: null },
      { user_id: bob.id, kind: "weekly", status: "failed", error: "EAUTH" },
    ]);
  });

  it.each([
    ["студент", () => alice.client],
    ["администратор", () => admin.client],
  ])("%s не може да пише, променя или трие", async (_who, client) => {
    const insert = await client()
      .from("email_log")
      .insert({ user_id: alice.id, kind: "weekly", status: "sent" });
    expect(insert.error).not.toBeNull();
    const update = await client()
      .from("email_log")
      .update({ status: "failed" })
      .eq("user_id", alice.id);
    expect(update.error).not.toBeNull();
    const remove = await client()
      .from("email_log")
      .delete()
      .eq("user_id", alice.id);
    expect(remove.error).not.toBeNull();

    const { data } = await service
      .from("email_log")
      .select("kind, status")
      .eq("user_id", alice.id);
    expect(data).toEqual([{ kind: "review_due", status: "sent" }]);
  });

  it("приема само познатите видове и статуси", async () => {
    const kind = await service
      .from("email_log")
      .insert({ user_id: alice.id, kind: "promo", status: "sent" });
    expect(kind.error).not.toBeNull();
    const state = await service
      .from("email_log")
      .insert({ user_id: alice.id, kind: "weekly", status: "queued" });
    expect(state.error).not.toBeNull();
  });

  it("няма колона за адрес или за текст на писмото", async () => {
    const { data } = await service
      .from("email_log")
      .select("*")
      .eq("user_id", alice.id)
      .single();
    expect(Object.keys(data!).sort()).toEqual([
      "error",
      "id",
      "kind",
      "sent_at",
      "status",
      "user_id",
    ]);
  });

  it("изтрива се заедно с потребителя", async () => {
    const temp = await createSignedInUser(status, service, "rem-temp");
    await service
      .from("email_log")
      .insert({ user_id: temp.id, kind: "test", status: "sent" });
    await service.auth.admin.deleteUser(temp.id);
    const { data } = await service
      .from("email_log")
      .select("id")
      .eq("user_id", temp.id);
    expect(data).toEqual([]);
  });
});

describe("код за отписване (user_settings.unsubscribe_token)", () => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  it("всеки потребител получава свой случаен код", async () => {
    const { data } = await service
      .from("user_settings")
      .select("user_id, unsubscribe_token")
      .in("user_id", [alice.id, bob.id]);
    const tokens = data!.map((row) => row.unsubscribe_token);
    expect(tokens).toHaveLength(2);
    for (const token of tokens) expect(token).toMatch(uuid);
    expect(new Set(tokens).size).toBe(2);
  });

  it("без вход кодовете не се четат", async () => {
    const { data, error } = await anon
      .from("user_settings")
      .select("unsubscribe_token");
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("чужд код не се вижда – нито по потребител, нито по самия код", async () => {
    const byUser = await alice.client
      .from("user_settings")
      .select("unsubscribe_token")
      .eq("user_id", bob.id);
    expect(byUser.data).toEqual([]);

    const all = await alice.client
      .from("user_settings")
      .select("user_id, unsubscribe_token");
    expect(all.data?.map((row) => row.user_id)).toEqual([alice.id]);

    const bobToken = (
      await service
        .from("user_settings")
        .select("unsubscribe_token")
        .eq("user_id", bob.id)
        .single()
    ).data!.unsubscribe_token;
    const byToken = await alice.client
      .from("user_settings")
      .select("user_id")
      .eq("unsubscribe_token", bobToken);
    expect(byToken.data).toEqual([]);
  });

  it("потребителят не може да смени кода си", async () => {
    const { error } = await alice.client
      .from("user_settings")
      .update({ unsubscribe_token: crypto.randomUUID() })
      .eq("user_id", alice.id);
    expect(error).not.toBeNull();
  });

  it("потребителят сам включва и изключва напомнянията си, но не и чуждите", async () => {
    const off = await alice.client
      .from("user_settings")
      .update({ reminders_enabled: false })
      .eq("user_id", alice.id)
      .select("reminders_enabled");
    expect(off.data).toEqual([{ reminders_enabled: false }]);

    const other = await alice.client
      .from("user_settings")
      .update({ reminders_enabled: false })
      .eq("user_id", bob.id)
      .select("user_id");
    expect(other.data ?? []).toEqual([]);
    const bobSettings = await service
      .from("user_settings")
      .select("reminders_enabled")
      .eq("user_id", bob.id)
      .single();
    expect(bobSettings.data?.reminders_enabled).toBe(true);
  });
});
