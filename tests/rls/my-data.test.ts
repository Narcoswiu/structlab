import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getMyData, type MyDataUser } from "@/lib/my-data";
import {
  anonClient,
  createSignedInUser,
  getLocalSupabase,
  serviceClient,
  type Db,
} from "./helpers";

// „Изтегли моите данни“ срещу истинските RLS политики: във файла на всеки
// влизат само неговите редове – и когато го тегли администратор.

type TestUser = { id: string; email: string; client: Db };

const status = getLocalSupabase();
const service = serviceClient(status);
const anon = anonClient(status);

let alice: TestUser;
let bob: TestUser;
let admin: TestUser;

const as = (user: TestUser, role: "admin" | "student"): MyDataUser => ({
  id: user.id,
  email: user.email,
  fullName: "",
  role,
});

async function seed(user: TestUser, label: string, digit: number) {
  const { data: plan } = await service
    .from("access_plans")
    .select("id")
    .eq("slug", "beta-free")
    .single();
  const results = await Promise.all([
    service.from("enrollments").insert({
      user_id: user.id,
      plan_id: plan!.id,
      source: "beta",
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    }),
    service
      .from("feedback")
      .insert({ user_id: user.id, page: "/dashboard", message: label }),
    service.from("events").insert({ user_id: user.id, type: "login" }),
    service.from("daily_activity").insert({
      user_id: user.id,
      day: "2026-10-01",
      seconds: 100 + digit,
      events: 1,
    }),
    service
      .from("task_variants")
      .insert({ user_id: user.id, a: digit, b: digit, c: digit }),
    service.from("personal_tasks").insert({
      user_id: user.id,
      template: "konzola",
      answers: { A: digit },
      results: { A: false },
      attempts: digit,
    }),
  ]);
  for (const result of results) if (result.error) throw result.error;
}

beforeAll(async () => {
  alice = await createSignedInUser(status, service, "mydata-alice");
  bob = await createSignedInUser(status, service, "mydata-bob");
  admin = await createSignedInUser(status, service, "mydata-admin");
  await service.from("profiles").update({ role: "admin" }).eq("id", admin.id);
  await seed(alice, "СЪОБЩЕНИЕ-НА-АЛИС", 3);
  await seed(bob, "СЪОБЩЕНИЕ-НА-БОБ", 8);
});

afterAll(async () => {
  for (const user of [alice, bob, admin])
    await service.auth.admin.deleteUser(user.id);
});

describe("моите данни: само моите редове", () => {
  it("студент получава своите данни от всички раздели", async () => {
    const data = await getMyData(alice.client, as(alice, "student"));
    expect(data.профил).toMatchObject({
      имейл: alice.email,
      име: "mydata-alice",
      роля: "student",
    });
    expect(data.настройки).not.toBeNull();
    expect(data.достъп).toHaveLength(1);
    expect(data.достъп[0]).toMatchObject({ източник: "beta" });
    expect(data.достъп[0]!.план).not.toBe("(вече не е достъпно)");
    expect(data.активност_по_дни).toEqual([
      { ден: "2026-10-01", секунди: 103, събития: 1 },
    ]);
    expect(data.събития).toMatchObject({ общо: 1, включени: 1 });
    expect(data.събития.списък[0]).toMatchObject({ вид: "login" });
    expect(data.вариант_за_задания).toMatchObject({ a: 3, b: 3, c: 3 });
    expect(data.лични_задания).toHaveLength(1);
    expect(data.лични_задания[0]).toMatchObject({
      задание: "konzola",
      опити: 3,
    });
    expect(data.обратна_връзка.map((row) => row.съобщение)).toEqual([
      "СЪОБЩЕНИЕ-НА-АЛИС",
    ]);

    const text = JSON.stringify(data);
    expect(text).not.toContain("СЪОБЩЕНИЕ-НА-БОБ");
    expect(text).not.toContain(bob.email);
    expect(text).not.toContain(bob.id);
  });

  it("администратор вижда чуждите редове в базата, но не и във файла си", async () => {
    // политиките пускат администратор до всичко…
    const visible = await admin.client
      .from("feedback")
      .select("user_id")
      .in("user_id", [alice.id, bob.id]);
    expect(visible.data).toHaveLength(2);

    // …а във файла му са само неговите данни
    const data = await getMyData(admin.client, as(admin, "admin"));
    expect(data.профил).toMatchObject({ имейл: admin.email, роля: "admin" });
    expect(data.достъп).toEqual([]);
    expect(data.активност_по_дни).toEqual([]);
    expect(data.събития).toMatchObject({ общо: 0, включени: 0, списък: [] });
    expect(data.вариант_за_задания).toBeNull();
    expect(data.лични_задания).toEqual([]);
    expect(data.обратна_връзка).toEqual([]);

    const text = JSON.stringify(data);
    for (const other of [alice, bob]) {
      expect(text).not.toContain(other.email);
      expect(text).not.toContain(other.id);
    }
    expect(text).not.toContain("СЪОБЩЕНИЕ-НА");
  });

  it("с чужд идентификатор студент не получава чужди редове", async () => {
    const data = await getMyData(alice.client, as(bob, "student"));
    expect(data.достъп).toEqual([]);
    expect(data.настройки).toBeNull();
    expect(data.вариант_за_задания).toBeNull();
    expect(data.лични_задания).toEqual([]);
    expect(data.обратна_връзка).toEqual([]);
    expect(data.събития.списък).toEqual([]);
    expect(JSON.stringify(data)).not.toContain("СЪОБЩЕНИЕ-НА-БОБ");
  });

  it("невлязъл посетител не получава файл", async () => {
    await expect(getMyData(anon, as(alice, "student"))).rejects.toThrow(
      "Данните не можаха да се прочетат",
    );
  });
});
