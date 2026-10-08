import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sofiaToday } from "@/lib/review-format";
import {
  anonClient,
  createSignedInUser,
  getLocalSupabase,
  serviceClient,
  type Db,
} from "./helpers";

type TestUser = { id: string; email: string; client: Db };

const status = getLocalSupabase();
const service = serviceClient(status);
const anon = anonClient(status);

let alice: TestUser;
let bob: TestUser;
let admin: TestUser;

const today = sofiaToday();
const yesterday = (() => {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
})();

const consume = async (user: string, limit: number) => {
  const { data, error } = await service.rpc("consume_ai_request", {
    p_user: user,
    p_limit: limit,
  });
  if (error) throw error;
  return data![0]!;
};
const rows = async (user: string) =>
  (
    await service
      .from("ai_usage")
      .select("day, requests")
      .eq("user_id", user)
      .order("day")
  ).data;

beforeAll(async () => {
  alice = await createSignedInUser(status, service, "ai-alice");
  bob = await createSignedInUser(status, service, "ai-bob");
  admin = await createSignedInUser(status, service, "ai-admin");
  await service.from("profiles").update({ role: "admin" }).eq("id", admin.id);
});

afterAll(async () => {
  for (const user of [alice, bob, admin])
    await service.auth.admin.deleteUser(user.id);
});

describe("дневен брояч на AI въпросите", () => {
  it("всеки въпрос увеличава брояча за днес (по българско време)", async () => {
    expect(await consume(alice.id, 3)).toEqual({ allowed: true, used: 1 });
    expect(await consume(alice.id, 3)).toEqual({ allowed: true, used: 2 });
    expect(await rows(alice.id)).toEqual([{ day: today, requests: 2 }]);
  });

  it("спира точно на лимита и повече не брои", async () => {
    expect(await consume(alice.id, 3)).toEqual({ allowed: true, used: 3 });
    for (let i = 0; i < 3; i++) {
      expect(await consume(alice.id, 3)).toEqual({ allowed: false, used: 3 });
    }
    expect(await rows(alice.id)).toEqual([{ day: today, requests: 3 }]);
  });

  it("по-висок лимит пуска отново", async () => {
    expect(await consume(alice.id, 5)).toEqual({ allowed: true, used: 4 });
  });

  it("броячът е отделен за всеки потребител", async () => {
    expect(await consume(bob.id, 3)).toEqual({ allowed: true, used: 1 });
    expect(await rows(bob.id)).toEqual([{ day: today, requests: 1 }]);
    expect((await rows(alice.id))![0]!.requests).toBe(4);
  });

  it("броячът е отделен за всеки ден", async () => {
    const seeded = await service
      .from("ai_usage")
      .insert({ user_id: bob.id, day: yesterday, requests: 3 });
    expect(seeded.error).toBeNull();
    // вчерашният изчерпан лимит не пречи днес
    expect(await consume(bob.id, 3)).toEqual({ allowed: true, used: 2 });
    expect(await rows(bob.id)).toEqual([
      { day: yesterday, requests: 3 },
      { day: today, requests: 2 },
    ]);
  });

  it("едновременни въпроси не минават над лимита", async () => {
    const carol = await createSignedInUser(status, service, "ai-carol");
    const results = await Promise.all(
      Array.from({ length: 12 }, () => consume(carol.id, 5)),
    );
    expect(results.filter((row) => row.allowed)).toHaveLength(5);
    expect(await rows(carol.id)).toEqual([{ day: today, requests: 5 }]);
    await service.auth.admin.deleteUser(carol.id);
    // изтрит потребител отнася брояча си
    expect(await rows(carol.id)).toEqual([]);
  });

  it("нулев или липсващ лимит не пуска нищо и не записва", async () => {
    const dave = await createSignedInUser(status, service, "ai-dave");
    expect(await consume(dave.id, 0)).toEqual({ allowed: false, used: 0 });
    expect(await consume(dave.id, -1)).toEqual({ allowed: false, used: 0 });
    expect(await rows(dave.id)).toEqual([]);
    await service.auth.admin.deleteUser(dave.id);
  });
});

describe("кой може да вика функцията", () => {
  it("нито влязъл потребител, нито admin, нито невлязъл посетител", async () => {
    const before = await rows(alice.id);
    for (const client of [alice.client, admin.client, anon]) {
      const { data, error } = await client.rpc("consume_ai_request", {
        p_user: alice.id,
        p_limit: 1000,
      });
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    }
    expect(await rows(alice.id)).toEqual(before);
  });
});

describe("кой вижда брояча", () => {
  it("всеки вижда само своя", async () => {
    const mine = await alice.client
      .from("ai_usage")
      .select("user_id, requests");
    expect(mine.error).toBeNull();
    expect(mine.data).toEqual([{ user_id: alice.id, requests: 4 }]);

    const others = await alice.client
      .from("ai_usage")
      .select("requests")
      .eq("user_id", bob.id);
    expect(others.data).toEqual([]);
  });

  it("admin вижда всички", async () => {
    const all = await admin.client
      .from("ai_usage")
      .select("user_id")
      .in("user_id", [alice.id, bob.id]);
    expect(new Set(all.data!.map((row) => row.user_id))).toEqual(
      new Set([alice.id, bob.id]),
    );
  });

  it("невлязъл посетител няма никакъв достъп", async () => {
    const result = await anon.from("ai_usage").select("requests").limit(1);
    expect(result.data ?? []).toEqual([]);
    expect(result.error).not.toBeNull();
  });
});

describe("никой клиент не пише директно", () => {
  it("не може да добави, промени или изтрие брояч – нито своя, нито чужд", async () => {
    for (const client of [alice.client, admin.client]) {
      const inserted = await client
        .from("ai_usage")
        .insert({ user_id: alice.id, day: "2020-01-01", requests: 0 });
      expect(inserted.error).not.toBeNull();

      const updated = await client
        .from("ai_usage")
        .update({ requests: 0 })
        .eq("user_id", alice.id)
        .select("requests");
      expect(updated.error).not.toBeNull();

      const removed = await client
        .from("ai_usage")
        .delete()
        .eq("user_id", alice.id)
        .select("requests");
      expect(removed.error).not.toBeNull();
    }
    expect(await rows(alice.id)).toEqual([{ day: today, requests: 4 }]);
  });

  it("базата не приема отрицателен брой", async () => {
    const { error } = await service
      .from("ai_usage")
      .insert({ user_id: bob.id, day: "2020-01-01", requests: -1 });
    expect(error).not.toBeNull();
  });
});
