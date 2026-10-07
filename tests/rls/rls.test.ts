import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createSignedInUser,
  getLocalSupabase,
  serviceClient,
  type Db,
} from "./helpers";

// Проверяват правилата в самата база: какво вижда и какво може да промени
// всеки вид потребител, когато говори с базата директно (без нашия сайт).

type TestUser = { id: string; email: string; client: Db };

const status = getLocalSupabase();
const service = serviceClient(status);
const anon = anonClient(status);

let admin: TestUser;
let active: TestUser; // студент с активен достъп
let expired: TestUser; // студент с изтекъл достъп
let revoked: TestUser; // студент със спрян достъп
let betaPlanId: string;
let moduleId: string;
const createdIds: string[] = [];

const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * DAY).toISOString();

beforeAll(async () => {
  admin = await createSignedInUser(status, service, "admin");
  active = await createSignedInUser(status, service, "active");
  expired = await createSignedInUser(status, service, "expired");
  revoked = await createSignedInUser(status, service, "revoked");
  createdIds.push(admin.id, active.id, expired.id, revoked.id);

  await service.from("profiles").update({ role: "admin" }).eq("id", admin.id);

  const plan = await service
    .from("access_plans")
    .select("id")
    .eq("slug", "beta-free")
    .single();
  betaPlanId = plan.data!.id;
  const sm = await service
    .from("modules")
    .select("id")
    .eq("slug", "saprotivlenie-na-materialite")
    .single();
  moduleId = sm.data!.id;

  const { error } = await service.from("enrollments").insert([
    {
      user_id: active.id,
      plan_id: betaPlanId,
      source: "beta",
      starts_at: iso(-1),
      expires_at: iso(13),
    },
    {
      user_id: expired.id,
      plan_id: betaPlanId,
      source: "beta",
      starts_at: iso(-20),
      expires_at: iso(-6),
    },
    {
      user_id: revoked.id,
      plan_id: betaPlanId,
      source: "beta",
      starts_at: iso(-1),
      expires_at: iso(13),
      revoked_at: iso(0),
    },
  ]);
  if (error) throw error;
});

afterAll(async () => {
  for (const id of createdIds) await service.auth.admin.deleteUser(id);
});

describe("без вход (anon)", () => {
  const tables = [
    "profiles",
    "user_settings",
    "modules",
    "access_plans",
    "plan_courses",
    "enrollments",
    "invites",
    "feedback",
  ] as const;

  it.each(tables)("няма достъп до %s", async (table) => {
    const { data, error } = await anon.from(table).select("*").limit(1);
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("не може да извика has_module_access", async () => {
    const { error } = await anon.rpc("has_module_access", {
      target_module: moduleId,
    });
    expect(error).not.toBeNull();
  });
});

describe("нов потребител", () => {
  it("получава автоматично профил „student“ и настройки", async () => {
    const profile = await active.client.from("profiles").select("*").single();
    expect(profile.data).toMatchObject({ id: active.id, role: "student" });
    const settings = await active.client
      .from("user_settings")
      .select("*")
      .single();
    expect(settings.data).toMatchObject({
      user_id: active.id,
      intro_dismissed: {},
    });
  });

  it("не става admin, дори да го поиска при създаването", async () => {
    const { data } = await service.auth.admin.createUser({
      email: `sneaky-${crypto.randomUUID().slice(0, 8)}@rls.test`,
      password: "test-password-123456",
      email_confirm: true,
      user_metadata: { full_name: "x", role: "admin" },
    });
    createdIds.push(data.user!.id);
    const profile = await service
      .from("profiles")
      .select("role")
      .eq("id", data.user!.id)
      .single();
    expect(profile.data?.role).toBe("student");
  });
});

describe("profiles", () => {
  it("студентът вижда само своя профил", async () => {
    const { data } = await active.client.from("profiles").select("id");
    expect(data).toEqual([{ id: active.id }]);
  });

  it("студентът може да смени името си", async () => {
    const { error } = await active.client
      .from("profiles")
      .update({ full_name: "Ново Име" })
      .eq("id", active.id);
    expect(error).toBeNull();
  });

  it("студентът НЕ може да си даде роля admin", async () => {
    const { error } = await active.client
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", active.id);
    expect(error).not.toBeNull();
    const check = await service
      .from("profiles")
      .select("role")
      .eq("id", active.id)
      .single();
    expect(check.data?.role).toBe("student");
    const isAdmin = await active.client.rpc("is_admin");
    expect(isAdmin.data).toBe(false);
  });

  it("студентът не може да промени чужд профил", async () => {
    const { data } = await active.client
      .from("profiles")
      .update({ full_name: "хакнат" })
      .eq("id", expired.id)
      .select("id");
    expect(data).toEqual([]);
  });

  it("admin вижда всички профили", async () => {
    const { data } = await admin.client
      .from("profiles")
      .select("id")
      .in("id", [active.id, expired.id, revoked.id]);
    expect(data).toHaveLength(3);
  });
});

describe("user_settings", () => {
  it("студентът вижда само своите настройки", async () => {
    const { data } = await active.client
      .from("user_settings")
      .select("user_id");
    expect(data).toEqual([{ user_id: active.id }]);
  });

  it("студентът може да скрие каре „Разбрах“", async () => {
    const { error } = await active.client
      .from("user_settings")
      .update({ intro_dismissed: { dashboard: true } })
      .eq("user_id", active.id);
    expect(error).toBeNull();
  });

  it("студентът не може да фалшифицира датата на съгласието", async () => {
    const { error } = await active.client
      .from("user_settings")
      .update({ terms_accepted_at: iso(-365) })
      .eq("user_id", active.id);
    expect(error).not.toBeNull();
  });

  it("студентът не може да променя чужди настройки", async () => {
    const { data } = await active.client
      .from("user_settings")
      .update({ theme: "light" })
      .eq("user_id", expired.id)
      .select("user_id");
    expect(data).toEqual([]);
  });
});

describe("modules – достъп само с активен план", () => {
  it("активният студент вижда модула", async () => {
    const { data } = await active.client.from("modules").select("id");
    expect(data).toEqual([{ id: moduleId }]);
  });

  it("студент с изтекъл план не вижда нищо", async () => {
    const { data } = await expired.client.from("modules").select("id");
    expect(data).toEqual([]);
  });

  it("студент със спрян достъп не вижда нищо", async () => {
    const { data } = await revoked.client.from("modules").select("id");
    expect(data).toEqual([]);
  });

  it("admin вижда модулите и без план", async () => {
    const { data } = await admin.client.from("modules").select("id");
    expect(data).toContainEqual({ id: moduleId });
  });

  it("студентът не може да добавя или променя модули", async () => {
    const insert = await active.client
      .from("modules")
      .insert({ slug: "hack", title: "Hack" });
    expect(insert.error).not.toBeNull();
    const update = await active.client
      .from("modules")
      .update({ title: "Hack" })
      .eq("id", moduleId)
      .select("id");
    expect(update.data).toEqual([]);
  });
});

describe("enrollments", () => {
  it("студентът вижда само своите записвания", async () => {
    const { data } = await active.client.from("enrollments").select("user_id");
    expect(data).toEqual([{ user_id: active.id }]);
  });

  it("студентът не може сам да си даде достъп", async () => {
    const { error } = await expired.client.from("enrollments").insert({
      user_id: expired.id,
      plan_id: betaPlanId,
      source: "manual",
      expires_at: iso(365),
    });
    expect(error).not.toBeNull();
  });

  it("студентът не може да си удължи срока или да върне спрян достъп", async () => {
    const extend = await expired.client
      .from("enrollments")
      .update({ expires_at: iso(365) })
      .eq("user_id", expired.id)
      .select("id");
    expect(extend.data).toEqual([]);
    const restore = await revoked.client
      .from("enrollments")
      .update({ revoked_at: null })
      .eq("user_id", revoked.id)
      .select("id");
    expect(restore.data).toEqual([]);
    const stillNone = await revoked.client.from("modules").select("id");
    expect(stillNone.data).toEqual([]);
  });

  it("admin може да спре и да върне достъп", async () => {
    const stop = await admin.client
      .from("enrollments")
      .update({ revoked_at: iso(0) })
      .eq("user_id", active.id)
      .select("id");
    expect(stop.data).toHaveLength(1);
    expect((await active.client.from("modules").select("id")).data).toEqual([]);

    await admin.client
      .from("enrollments")
      .update({ revoked_at: null })
      .eq("user_id", active.id);
    expect((await active.client.from("modules").select("id")).data).toEqual([
      { id: moduleId },
    ]);
  });
});

describe("access_plans и plan_courses", () => {
  it("студентът вижда активните планове, но не може да ги променя", async () => {
    const read = await active.client
      .from("access_plans")
      .select("slug")
      .eq("id", betaPlanId);
    expect(read.data).toEqual([{ slug: "beta-free" }]);
    const update = await active.client
      .from("access_plans")
      .update({ duration_days: 3650 })
      .eq("id", betaPlanId)
      .select("id");
    expect(update.data).toEqual([]);
  });

  it("студентът не вижда връзките план–модул и не може да добавя", async () => {
    const insert = await active.client
      .from("plan_courses")
      .insert({ plan_id: betaPlanId, module_id: moduleId });
    expect(insert.error).not.toBeNull();
    const read = await active.client.from("plan_courses").select("*");
    expect(read.data).toEqual([]);
  });
});

describe("invites – само за admin", () => {
  it("студентът не вижда и не може да създава покани", async () => {
    await service.from("invites").insert({
      email: "someone@rls.test",
      plan_id: betaPlanId,
      token_hash: crypto.randomUUID(),
    });
    const read = await active.client.from("invites").select("id");
    expect(read.data).toEqual([]);
    const insert = await active.client.from("invites").insert({
      email: "friend@rls.test",
      plan_id: betaPlanId,
      token_hash: crypto.randomUUID(),
    });
    expect(insert.error).not.toBeNull();
  });

  it("admin създава, вижда и отменя покани", async () => {
    const insert = await admin.client
      .from("invites")
      .insert({
        email: "invited@rls.test",
        plan_id: betaPlanId,
        token_hash: crypto.randomUUID(),
        invited_by: admin.id,
      })
      .select("id")
      .single();
    expect(insert.error).toBeNull();
    const revoke = await admin.client
      .from("invites")
      .update({ revoked_at: iso(0) })
      .eq("id", insert.data!.id)
      .select("id");
    expect(revoke.data).toHaveLength(1);
  });

  it("базата отхвърля имейл с главни букви или грешен формат", async () => {
    for (const email of ["Mixed@Case.bg", "not-an-email"]) {
      const { error } = await admin.client.from("invites").insert({
        email,
        plan_id: betaPlanId,
        token_hash: crypto.randomUUID(),
      });
      expect(error).not.toBeNull();
    }
  });
});

describe("feedback", () => {
  it("студентът пише от свое име и вижда само своето", async () => {
    const own = await active.client
      .from("feedback")
      .insert({ page: "/dashboard", message: "Харесва ми." });
    expect(own.error).toBeNull();
    await expired.client
      .from("feedback")
      .insert({ page: "/dashboard", message: "Друго мнение." });

    const { data } = await active.client.from("feedback").select("user_id");
    expect(data).toEqual([{ user_id: active.id }]);
  });

  it("студентът не може да пише от чуждо име", async () => {
    const { error } = await active.client.from("feedback").insert({
      user_id: expired.id,
      page: "/dashboard",
      message: "Подправено.",
    });
    expect(error).not.toBeNull();
  });

  it("admin вижда всички съобщения", async () => {
    const { data } = await admin.client
      .from("feedback")
      .select("user_id")
      .in("user_id", [active.id, expired.id]);
    expect(new Set(data?.map((row) => row.user_id))).toEqual(
      new Set([active.id, expired.id]),
    );
  });
});
