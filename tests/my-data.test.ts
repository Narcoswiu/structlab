import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  EVENTS_LIMIT,
  fetchMyDataRows,
  getMyData,
  myDataFileName,
  shapeMyData,
  type MyDataRows,
  type MyDataUser,
} from "@/lib/my-data";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-10-09T08:30:00.000Z");

const me: MyDataUser = {
  id: ME,
  email: "az@structlab.test",
  fullName: "Аз Самият",
  role: "student",
};

const event = (user_id: string, n: number): MyDataRows["events"][number] => ({
  user_id,
  type: "heartbeat",
  created_at: new Date(NOW.getTime() - n * 15_000).toISOString(),
  section: "razberi",
  mode: "easy",
  lab: null,
  chapters: { title: "Огъване" },
});

function rows(): MyDataRows {
  return {
    profile: {
      id: ME,
      full_name: "Аз Самият",
      role: "student",
      created_at: "2026-10-01T10:00:00.000Z",
      specialties: { name: "Строителство на сгради и съоръжения" },
    },
    settings: {
      user_id: ME,
      theme: "dark",
      font_size: 2,
      reader_mode: "easy",
      intro_dismissed: { dashboard: true },
      reminders_enabled: true,
      marketing_consent: false,
      terms_accepted_at: "2026-10-01T10:00:00.000Z",
      tracking_notice_accepted_at: null,
      updated_at: "2026-10-02T10:00:00.000Z",
    },
    enrollments: [
      {
        user_id: ME,
        source: "beta",
        starts_at: "2026-10-01T10:00:00.000Z",
        expires_at: "2027-01-01T10:00:00.000Z",
        revoked_at: null,
        created_at: "2026-10-01T10:00:00.000Z",
        access_plans: { name: "Безплатен достъп" },
      },
      {
        user_id: OTHER,
        source: "manual",
        starts_at: "2026-10-01T10:00:00.000Z",
        expires_at: "2027-01-01T10:00:00.000Z",
        revoked_at: null,
        created_at: "2026-10-01T10:00:00.000Z",
        access_plans: { name: "ЧУЖД ПЛАН" },
      },
    ],
    progress: [
      {
        user_id: ME,
        sections_seen: ["zagadka", "vizh"],
        last_section: "vizh",
        last_mode: "detailed",
        seconds: 300,
        first_opened_at: "2026-10-03T10:00:00.000Z",
        last_activity_at: "2026-10-04T10:00:00.000Z",
        chapters: { title: "Огъване" },
      },
    ],
    dailyActivity: [
      { user_id: ME, day: "2026-10-03", seconds: 300, events: 21 },
      { user_id: OTHER, day: "2026-10-03", seconds: 9999, events: 999 },
    ],
    events: [event(ME, 0), event(OTHER, 1), event(ME, 2)],
    eventsTotal: 2,
    quizReviews: [
      {
        user_id: ME,
        box: 2,
        attempts: 3,
        correct: 2,
        last_knew: true,
        due_on: "2026-10-12",
        first_answered_at: "2026-10-05T10:00:00.000Z",
        last_answered_at: "2026-10-09T08:00:00.000Z",
        quiz_questions: { question: "Какво е огъващ момент?" },
      },
      {
        // главата вече не е достъпна – RLS не връща въпроса
        user_id: ME,
        box: 1,
        attempts: 1,
        correct: 0,
        last_knew: false,
        due_on: null,
        first_answered_at: "2026-10-06T10:00:00.000Z",
        last_answered_at: "2026-10-06T10:00:00.000Z",
        quiz_questions: null,
      },
    ],
    taskVariant: {
      user_id: ME,
      a: 1,
      b: 4,
      c: 7,
      created_at: "2026-10-07T10:00:00.000Z",
    },
    personalTasks: [
      {
        user_id: ME,
        template: "konzola",
        answers: { A: 52.4 },
        results: { A: true },
        attempts: 1,
        first_checked_at: "2026-10-07T11:00:00.000Z",
        last_checked_at: "2026-10-07T11:00:00.000Z",
        solved_at: null,
      },
      {
        user_id: OTHER,
        template: "konzola",
        answers: { A: 1 },
        results: { A: false },
        attempts: 9,
        first_checked_at: "2026-10-07T11:00:00.000Z",
        last_checked_at: "2026-10-07T11:00:00.000Z",
        solved_at: null,
      },
    ],
    feedback: [
      {
        user_id: ME,
        message: "Фигурата в глава 4 е малка.",
        page: "/learn",
        created_at: "2026-10-08T10:00:00.000Z",
      },
      {
        user_id: OTHER,
        message: "ЧУЖДО СЪОБЩЕНИЕ",
        page: "/dashboard",
        created_at: "2026-10-08T10:00:00.000Z",
      },
    ],
  };
}

describe("shapeMyData: какво влиза във файла", () => {
  it("има обяснение, дата и всички раздели с ясни имена", () => {
    const data = shapeMyData(rows(), me, NOW);
    expect(Object.keys(data)).toEqual([
      "обяснение",
      "изготвено_на",
      "какво_липсва",
      "профил",
      "настройки",
      "достъп",
      "напредък",
      "активност_по_дни",
      "събития",
      "повторение",
      "вариант_за_задания",
      "лични_задания",
      "обратна_връзка",
    ]);
    expect(data.обяснение).toContain("само твои данни");
    expect(data.изготвено_на).toBe("2026-10-09T08:30:00.000Z");
    expect(data.какво_липсва).toContain("Паролата не е тук");
    expect(data.профил).toEqual({
      имейл: "az@structlab.test",
      име: "Аз Самият",
      роля: "student",
      специалност: "Строителство на сгради и съоръжения",
      регистриран_на: "2026-10-01T10:00:00.000Z",
    });
    expect(data.настройки).toMatchObject({
      тема: "dark",
      размер_на_шрифта: 2,
      скрити_обяснителни_карета: { dashboard: true },
      съгласие_за_новини: false,
      прието_известие_за_проследяване_на: null,
    });
    expect(data.достъп).toEqual([
      {
        план: "Безплатен достъп",
        източник: "beta",
        начало: "2026-10-01T10:00:00.000Z",
        край: "2027-01-01T10:00:00.000Z",
        отнет_на: null,
        записан_на: "2026-10-01T10:00:00.000Z",
      },
    ]);
    expect(data.напредък[0]).toMatchObject({
      глава: "Огъване",
      видени_секции: ["zagadka", "vizh"],
      секунди: 300,
    });
    expect(data.активност_по_дни).toEqual([
      { ден: "2026-10-03", секунди: 300, събития: 21 },
    ]);
    expect(data.повторение.map((row) => row.въпрос)).toEqual([
      "Какво е огъващ момент?",
      "(вече не е достъпно)",
    ]);
    expect(data.вариант_за_задания).toEqual({
      a: 1,
      b: 4,
      c: 7,
      създаден_на: "2026-10-07T10:00:00.000Z",
    });
    expect(data.лични_задания).toEqual([
      {
        задание: "konzola",
        отговори: { A: 52.4 },
        резултати: { A: true },
        опити: 1,
        първа_проверка: "2026-10-07T11:00:00.000Z",
        последна_проверка: "2026-10-07T11:00:00.000Z",
        решено_на: null,
      },
    ]);
    expect(data.обратна_връзка).toEqual([
      {
        съобщение: "Фигурата в глава 4 е малка.",
        страница: "/learn",
        изпратено_на: "2026-10-08T10:00:00.000Z",
      },
    ]);
  });

  it("изхвърля чуждите редове и не издава ничий идентификатор", () => {
    const text = JSON.stringify(shapeMyData(rows(), me, NOW));
    expect(text).not.toContain(OTHER);
    expect(text).not.toContain("ЧУЖД");
    expect(text).not.toContain("9999");
    // вътрешните идентификатори не са нужни на никого извън базата
    expect(text).not.toContain(ME);
    expect(text).not.toMatch(/user_id|plan_id|question_id|chapter_id/);
    expect(text).not.toMatch(/password|token|hash/i);
  });

  it("чужд профил, настройки и вариант не се показват", () => {
    const foreign = rows();
    foreign.profile = { ...foreign.profile!, id: OTHER, full_name: "Друг" };
    foreign.settings = { ...foreign.settings!, user_id: OTHER };
    foreign.taskVariant = { ...foreign.taskVariant!, user_id: OTHER };
    const data = shapeMyData(foreign, me, NOW);
    expect(data.профил).toEqual({
      имейл: "az@structlab.test",
      име: "Аз Самият",
      роля: "student",
      специалност: null,
      регистриран_на: null,
    });
    expect(data.настройки).toBeNull();
    expect(data.вариант_за_задания).toBeNull();
  });

  it("нов потребител без никакви данни получава празни раздели", () => {
    const data = shapeMyData(
      {
        profile: null,
        settings: null,
        enrollments: [],
        progress: [],
        dailyActivity: [],
        events: [],
        eventsTotal: 0,
        quizReviews: [],
        taskVariant: null,
        personalTasks: [],
        feedback: [],
      },
      me,
      NOW,
    );
    expect(data.достъп).toEqual([]);
    expect(data.събития).toMatchObject({ общо: 0, включени: 0, списък: [] });
    expect(data.събития.бележка).toContain("Включени са всички събития");
    expect(data.настройки).toBeNull();
  });

  it("казва, когато събитията са повече от побраните във файла", () => {
    const many = rows();
    many.events = Array.from({ length: EVENTS_LIMIT + 10 }, (_, n) =>
      event(ME, n),
    );
    many.eventsTotal = 7321;
    const { събития } = shapeMyData(many, me, NOW);
    expect(събития.общо).toBe(7321);
    expect(събития.включени).toBe(EVENTS_LIMIT);
    expect(събития.списък).toHaveLength(EVENTS_LIMIT);
    // най-новото е първо
    expect(събития.списък[0]!.кога).toBe(NOW.toISOString());
    expect(събития.бележка).toBe(
      "Включени са само последните 5000 събития от общо 7321. Ако искаш всички, пиши ни.",
    );
  });
});

// Мним клиент: помни кои таблици са четени и с какъв филтър, и връща редовете
// на страници по най-много 1000 – както PostgREST.
type Row = Record<string, unknown>;
type Call = { table: string; filters: [string, unknown][] };

function fakeClient(tables: Record<string, Row[]>, failing?: string) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, filters: [] };
      calls.push(call);
      let result = tables[table] ?? [];
      let head = false;
      const error = table === failing ? { message: "boom" } : null;
      const query = {
        select(_columns: string, options?: { head?: boolean }) {
          head = Boolean(options?.head);
          return query;
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          result = result.filter((row) => row[column] === value);
          return query;
        },
        order: () => query,
        range(from: number, to: number) {
          result = result.slice(from, Math.min(to + 1, from + 1000));
          return query;
        },
        maybeSingle: () =>
          Promise.resolve({ data: error ? null : (result[0] ?? null), error }),
        then<T>(resolve: (value: unknown) => T) {
          const value = error
            ? { data: null, count: null, error }
            : head
              ? { data: null, count: result.length, error: null }
              : { data: result, error: null };
          return Promise.resolve(value).then(resolve);
        },
      };
      return query;
    },
  };
  return { calls, client: client as unknown as SupabaseClient<Database> };
}

function tables(eventCount: number): Record<string, Row[]> {
  const source = rows();
  return {
    profiles: [source.profile!, { ...source.profile!, id: OTHER }],
    user_settings: [source.settings!, { ...source.settings!, user_id: OTHER }],
    enrollments: source.enrollments,
    progress: source.progress,
    daily_activity: source.dailyActivity,
    events: [
      ...Array.from({ length: eventCount }, (_, n) => event(ME, n)),
      ...Array.from({ length: 50 }, (_, n) => event(OTHER, n)),
    ],
    quiz_reviews: source.quizReviews,
    task_variants: [
      { ...source.taskVariant!, user_id: OTHER },
      source.taskVariant!,
    ],
    personal_tasks: source.personalTasks,
    feedback: source.feedback,
  };
}

describe("fetchMyDataRows: какво се чете от базата", () => {
  it("всяка заявка е ограничена до този потребител – и за администратор", async () => {
    // RLS пуска администратор да вижда всички редове, затова филтърът е изричен
    const admin: MyDataUser = { ...me, role: "admin" };
    const { calls, client } = fakeClient(tables(3));
    const data = await getMyData(client, admin, NOW);

    expect(new Set(calls.map((call) => call.table))).toEqual(
      new Set([
        "profiles",
        "user_settings",
        "enrollments",
        "progress",
        "daily_activity",
        "events",
        "quiz_reviews",
        "task_variants",
        "personal_tasks",
        "feedback",
      ]),
    );
    for (const call of calls) {
      const column = call.table === "profiles" ? "id" : "user_id";
      expect(call.filters, call.table).toEqual([[column, ME]]);
    }
    expect(JSON.stringify(data)).not.toContain("ЧУЖД");
    expect(data.достъп).toHaveLength(1);
    expect(data.събития).toMatchObject({ общо: 3, включени: 3 });
    expect(data.вариант_за_задания).toMatchObject({ a: 1, b: 4, c: 7 });
  });

  it("събитията се четат на страници и спират на ограничението", async () => {
    const { calls, client } = fakeClient(tables(EVENTS_LIMIT + 200));
    const fetched = await fetchMyDataRows(client, me);
    expect(fetched.events).toHaveLength(EVENTS_LIMIT);
    expect(fetched.eventsTotal).toBe(EVENTS_LIMIT + 200);
    // 5 страници по 1000 + една заявка за общия брой
    expect(calls.filter((call) => call.table === "events")).toHaveLength(6);
    expect(fetched.events.every((row) => row.user_id === ME)).toBe(true);
  });

  it("над 1000 реда в друга таблица също се прочитат докрай", async () => {
    const source = tables(0);
    source.daily_activity = Array.from({ length: 1200 }, (_, n) => ({
      user_id: ME,
      day: `day-${n}`,
      seconds: 1,
      events: 1,
    }));
    const fetched = await fetchMyDataRows(fakeClient(source).client, me);
    expect(fetched.dailyActivity).toHaveLength(1200);
  });

  it("при грешка от базата не се изготвя непълен файл", async () => {
    for (const table of ["feedback", "profiles", "task_variants"]) {
      await expect(
        fetchMyDataRows(fakeClient(tables(1), table).client, me),
      ).rejects.toThrow("Данните не можаха да се прочетат");
    }
  });
});

describe("име на файла", () => {
  it("носи датата на изготвяне", () => {
    expect(myDataFileName(NOW)).toBe("structlab-moite-danni-2026-10-09.json");
  });
});
