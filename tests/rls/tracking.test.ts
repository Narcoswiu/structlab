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
let chapterId: string;
let otherChapterId: string;

const record = (
  user: string,
  type:
    | "login"
    | "chapter_open"
    | "section_view"
    | "heartbeat"
    | "mode_toggle"
    | "lab_open",
  extra: {
    chapter?: string;
    section?: string;
    mode?: "easy" | "detailed";
    lab?: string;
  } = {},
) =>
  service.rpc("record_event", {
    p_user: user,
    p_type: type,
    p_chapter: extra.chapter,
    p_section: extra.section,
    p_mode: extra.mode,
    p_lab: extra.lab,
  });

/** Мести всички събития на потребителя назад във времето. */
async function age(user: string, interval: string) {
  const { data } = await service
    .from("events")
    .select("id, created_at")
    .eq("user_id", user);
  const ms = { "2 minutes": 120_000, "13 months": 396 * 86_400_000 }[interval]!;
  for (const row of data ?? []) {
    await service
      .from("events")
      .update({
        created_at: new Date(
          new Date(row.created_at).getTime() - ms,
        ).toISOString(),
      })
      .eq("id", row.id);
  }
}

beforeAll(async () => {
  alice = await createSignedInUser(status, service, "alice");
  bob = await createSignedInUser(status, service, "bob");
  admin = await createSignedInUser(status, service, "tracking-admin");
  await service.from("profiles").update({ role: "admin" }).eq("id", admin.id);

  const { data: module } = await service
    .from("modules")
    .select("id")
    .eq("slug", "saprotivlenie-na-materialite")
    .single();
  const suffix = crypto.randomUUID().slice(0, 8);
  const chapters = await service
    .from("chapters")
    .insert([
      {
        module_id: module!.id,
        slug: `track-a-${suffix}`,
        number: 8000 + Math.floor(Math.random() * 400),
        title: "А",
      },
      {
        module_id: module!.id,
        slug: `track-b-${suffix}`,
        number: 8500 + Math.floor(Math.random() * 400),
        title: "Б",
      },
    ])
    .select("id");
  if (chapters.error) throw chapters.error;
  chapterId = chapters.data[0]!.id;
  otherChapterId = chapters.data[1]!.id;
});

afterAll(async () => {
  for (const user of [alice, bob, admin])
    await service.auth.admin.deleteUser(user.id);
  await service.from("chapters").delete().in("id", [chapterId, otherChapterId]);
});

describe("записване на събития", () => {
  it("четенето на глава обновява прогреса веднага", async () => {
    expect(
      (
        await record(alice.id, "chapter_open", {
          chapter: chapterId,
          mode: "easy",
        })
      ).data,
    ).toBe(true);
    await record(alice.id, "section_view", {
      chapter: chapterId,
      section: "zagadka",
      mode: "easy",
    });
    await record(alice.id, "section_view", {
      chapter: chapterId,
      section: "vizh",
      mode: "easy",
    });
    // същата секция втори път не се брои два пъти
    await record(alice.id, "section_view", {
      chapter: chapterId,
      section: "zagadka",
      mode: "easy",
    });
    await record(alice.id, "heartbeat", { chapter: chapterId });
    await record(alice.id, "heartbeat", { chapter: chapterId });
    await record(alice.id, "mode_toggle", {
      chapter: chapterId,
      mode: "detailed",
    });

    const { data } = await service
      .from("progress")
      .select("sections_seen, last_section, last_mode, seconds")
      .eq("user_id", alice.id)
      .eq("chapter_id", chapterId)
      .single();
    expect(data).toEqual({
      sections_seen: ["zagadka", "vizh"],
      last_section: "zagadka",
      last_mode: "detailed",
      seconds: 30,
    });
  });

  it("активността за деня брои събитията и времето (2 пулса = 30 секунди)", async () => {
    await record(alice.id, "lab_open", { lab: "beam" });
    await record(alice.id, "login");
    const { data } = await service
      .from("daily_activity")
      .select("seconds, events")
      .eq("user_id", alice.id);
    expect(data).toEqual([{ seconds: 30, events: 9 }]);
  });

  it("събитие без глава не създава ред в прогреса", async () => {
    const { data } = await service
      .from("progress")
      .select("chapter_id")
      .eq("user_id", alice.id);
    expect(data).toEqual([{ chapter_id: chapterId }]);
  });

  it("базата отхвърля секция или лаборатория с непозволени знаци", async () => {
    const bad = await record(alice.id, "section_view", {
      chapter: chapterId,
      section: "<script>alert(1)</script>",
    });
    expect(bad.error).not.toBeNull();
    const badLab = await record(alice.id, "lab_open", { lab: "../../etc" });
    expect(badLab.error).not.toBeNull();
  });
});

describe("ограничение на честотата", () => {
  it("след 30 събития за минута следващите се отказват и не се записват", async () => {
    const results: (boolean | null)[] = [];
    for (let i = 0; i < 34; i++) {
      results.push(
        (await record(bob.id, "heartbeat", { chapter: chapterId })).data,
      );
    }
    expect(results.filter((ok) => ok === true)).toHaveLength(30);
    expect(results.slice(30)).toEqual([false, false, false, false]);

    const { count } = await service
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", bob.id);
    expect(count).toBe(30);
    const { data } = await service
      .from("progress")
      .select("seconds")
      .eq("user_id", bob.id)
      .single();
    expect(data?.seconds).toBe(30 * 15);
  });

  it("лимитът е за всеки потребител поотделно и се освобождава след минута", async () => {
    expect(
      (await record(alice.id, "heartbeat", { chapter: chapterId })).data,
    ).toBe(true);
    await age(bob.id, "2 minutes");
    expect(
      (await record(bob.id, "heartbeat", { chapter: chapterId })).data,
    ).toBe(true);
  });
});

describe("достъп до данните за проследяване", () => {
  const tables = ["events", "progress", "daily_activity"] as const;

  it("без вход няма достъп", async () => {
    for (const table of tables) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    }
  });

  it("студентът вижда само своите събития, прогрес и активност", async () => {
    for (const table of tables) {
      const { data } = await alice.client.from(table).select("user_id");
      expect(data!.length).toBeGreaterThan(0);
      expect(new Set(data!.map((row) => row.user_id))).toEqual(
        new Set([alice.id]),
      );
    }
  });

  it("admin вижда данните на всички", async () => {
    const { data } = await admin.client
      .from("progress")
      .select("user_id")
      .in("user_id", [alice.id, bob.id]);
    expect(new Set(data!.map((row) => row.user_id))).toEqual(
      new Set([alice.id, bob.id]),
    );
  });

  it("никой клиент не може да пише директно – нито студент, нито admin", async () => {
    for (const client of [alice.client, admin.client]) {
      const event = await client
        .from("events")
        .insert({ user_id: alice.id, type: "heartbeat" });
      expect(event.error).not.toBeNull();
      const fake = await client
        .from("progress")
        .update({ seconds: 999_999 })
        .eq("user_id", alice.id);
      expect(fake.error).not.toBeNull();
      const wipe = await client.from("events").delete().eq("user_id", alice.id);
      expect(wipe.error).not.toBeNull();
    }
  });

  it("клиент не може да извика record_event или rebuild_aggregates", async () => {
    const direct = await alice.client.rpc("record_event", {
      p_user: bob.id,
      p_type: "heartbeat",
    });
    expect(direct.error).not.toBeNull();
    expect((await alice.client.rpc("rebuild_aggregates")).error).not.toBeNull();
    expect((await anon.rpc("rebuild_aggregates")).error).not.toBeNull();
  });

  it("студентът не може сам да отбележи известието като прието от чуждо име", async () => {
    const { data } = await alice.client
      .from("user_settings")
      .update({ theme: "light" })
      .eq("user_id", bob.id)
      .select("user_id");
    expect(data).toEqual([]);
  });
});

describe("нощна агрегация", () => {
  const snapshot = async (user: string) => {
    const [progress, activity] = await Promise.all([
      service
        .from("progress")
        .select("chapter_id, sections_seen, last_section, last_mode, seconds")
        .eq("user_id", user)
        .order("chapter_id"),
      service
        .from("daily_activity")
        .select("day, seconds, events")
        .eq("user_id", user)
        .order("day"),
    ]);
    return { progress: progress.data, activity: activity.data };
  };

  it("преизчислява от суровите събития същото, което бързото обновяване е натрупало", async () => {
    await record(alice.id, "chapter_open", {
      chapter: otherChapterId,
      mode: "detailed",
    });
    await record(alice.id, "section_view", {
      chapter: otherChapterId,
      section: "razberi",
      mode: "detailed",
    });
    const before = await snapshot(alice.id);

    const rebuilt = await service.rpc("rebuild_aggregates");
    expect(rebuilt.error).toBeNull();
    expect(await snapshot(alice.id)).toEqual(before);
    expect(before.progress).toHaveLength(2);
  });

  it("поправя обобщените данни, ако са били повредени", async () => {
    const before = await snapshot(alice.id);
    await service
      .from("progress")
      .update({ seconds: 5, sections_seen: [] })
      .eq("user_id", alice.id);
    await service
      .from("daily_activity")
      .update({ seconds: 0, events: 0 })
      .eq("user_id", alice.id);
    await service.rpc("rebuild_aggregates");
    expect(await snapshot(alice.id)).toEqual(before);
  });

  it("изтрива събитията, по-стари от 12 месеца, заедно с обобщенията им", async () => {
    await age(bob.id, "13 months");
    const { data } = await service.rpc("rebuild_aggregates");
    expect(Number(data![0]!.purged)).toBeGreaterThanOrEqual(31);

    const left = await service
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", bob.id);
    expect(left.count).toBe(0);
    expect((await snapshot(bob.id)).progress).toEqual([]);
    expect((await snapshot(bob.id)).activity).toEqual([]);
    // данните на другите остават
    expect((await snapshot(alice.id)).progress).toHaveLength(2);
  });

  it("изтриването на акаунт изтрива и следите му", async () => {
    const temp = await createSignedInUser(status, service, "temp");
    await record(temp.id, "chapter_open", { chapter: chapterId });
    await service.auth.admin.deleteUser(temp.id);
    for (const table of ["events", "progress", "daily_activity"] as const) {
      const { count } = await service
        .from(table)
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", temp.id);
      expect(count).toBe(0);
    }
  });
});
