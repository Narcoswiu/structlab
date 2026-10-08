import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

beforeAll(async () => {
  alice = await createSignedInUser(status, service, "tasks-alice");
  bob = await createSignedInUser(status, service, "tasks-bob");
  admin = await createSignedInUser(status, service, "tasks-admin");
  await service.from("profiles").update({ role: "admin" }).eq("id", admin.id);

  const variants = await service.from("task_variants").insert([
    { user_id: alice.id, a: 1, b: 4, c: 7 },
    { user_id: bob.id, a: 9, b: 0, c: 2 },
  ]);
  if (variants.error) throw variants.error;
  const tasks = await service.from("personal_tasks").insert([
    {
      user_id: alice.id,
      template: "konzola",
      answers: { A: 52.4 },
      results: { A: true },
      attempts: 1,
    },
    {
      user_id: bob.id,
      template: "konzola",
      answers: { A: 1 },
      results: { A: false },
      attempts: 3,
    },
  ]);
  if (tasks.error) throw tasks.error;
});

afterAll(async () => {
  for (const user of [alice, bob, admin])
    await service.auth.admin.deleteUser(user.id);
});

describe("лични задания: кой какво вижда", () => {
  it("всеки вижда само своя вариант и своите задания", async () => {
    const variant = await alice.client
      .from("task_variants")
      .select("user_id, a, b, c");
    expect(variant.data).toEqual([{ user_id: alice.id, a: 1, b: 4, c: 7 }]);
    const tasks = await alice.client
      .from("personal_tasks")
      .select("user_id, attempts");
    expect(tasks.data).toEqual([{ user_id: alice.id, attempts: 1 }]);
  });

  it("admin вижда всички", async () => {
    const tasks = await admin.client
      .from("personal_tasks")
      .select("user_id")
      .in("user_id", [alice.id, bob.id]);
    expect(new Set(tasks.data!.map((row) => row.user_id))).toEqual(
      new Set([alice.id, bob.id]),
    );
    const variants = await admin.client
      .from("task_variants")
      .select("user_id")
      .in("user_id", [alice.id, bob.id]);
    expect(variants.data).toHaveLength(2);
  });

  it("невлязъл посетител няма достъп", async () => {
    const variants = await anon.from("task_variants").select("a").limit(1);
    const tasks = await anon.from("personal_tasks").select("template").limit(1);
    expect(variants.data ?? []).toEqual([]);
    expect(tasks.data ?? []).toEqual([]);
    expect(variants.error ?? tasks.error).not.toBeNull();
  });
});

describe("лични задания: никой клиент не пише директно", () => {
  it("не може сам да си смени варианта", async () => {
    const updated = await alice.client
      .from("task_variants")
      .update({ a: 0 })
      .eq("user_id", alice.id)
      .select("a");
    expect(updated.error).not.toBeNull();
    const removed = await alice.client
      .from("task_variants")
      .delete()
      .eq("user_id", alice.id)
      .select("a");
    expect(removed.error).not.toBeNull();
    const { data } = await service
      .from("task_variants")
      .select("a")
      .eq("user_id", alice.id)
      .single();
    expect(data!.a).toBe(1);
  });

  it("не може сам да си отбележи задание като решено", async () => {
    const inserted = await alice.client.from("personal_tasks").insert({
      user_id: alice.id,
      template: "prosta-greda",
      results: { A: true, B: true, MF: true, Mmax: true },
      solved_at: new Date().toISOString(),
    });
    expect(inserted.error).not.toBeNull();
    const updated = await alice.client
      .from("personal_tasks")
      .update({ solved_at: new Date().toISOString() })
      .eq("user_id", alice.id)
      .select("template");
    expect(updated.error).not.toBeNull();
    const { data } = await service
      .from("personal_tasks")
      .select("template, solved_at")
      .eq("user_id", alice.id);
    expect(data).toEqual([{ template: "konzola", solved_at: null }]);
  });
});

describe("лични задания: ограничения и изтриване", () => {
  it("базата отказва невалиден вариант и невалидно име на задание", async () => {
    const temp = await createSignedInUser(status, service, "tasks-temp");
    const badDigit = await service
      .from("task_variants")
      .insert({ user_id: temp.id, a: 10, b: 0, c: 0 });
    expect(badDigit.error).not.toBeNull();
    const badName = await service
      .from("personal_tasks")
      .insert({ user_id: temp.id, template: "Лошо име" });
    expect(badName.error).not.toBeNull();
    const badJson = await service
      .from("personal_tasks")
      .insert({ user_id: temp.id, template: "konzola", answers: [1, 2] });
    expect(badJson.error).not.toBeNull();
    await service.auth.admin.deleteUser(temp.id);
  });

  it("изтрит потребител отнася варианта и заданията си", async () => {
    const temp = await createSignedInUser(status, service, "tasks-gone");
    await service
      .from("task_variants")
      .insert({ user_id: temp.id, a: 1, b: 2, c: 3 });
    await service
      .from("personal_tasks")
      .insert({ user_id: temp.id, template: "konzola" });
    await service.auth.admin.deleteUser(temp.id);
    const variants = await service
      .from("task_variants")
      .select("a")
      .eq("user_id", temp.id);
    const tasks = await service
      .from("personal_tasks")
      .select("template")
      .eq("user_id", temp.id);
    expect(variants.data).toEqual([]);
    expect(tasks.data).toEqual([]);
  });
});
