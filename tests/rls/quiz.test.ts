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

let alice: TestUser; // има активен план
let bob: TestUser; // няма достъп
let carol: TestUser; // има активен план; за лимита
let admin: TestUser;
let chapterId: string;
let draftChapterId: string;
let questionIds: string[] = [];
let draftQuestionId: string;
let aliceEnrollmentId: string;

const today = sofiaToday();
const plusDays = (days: number) => {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const key = (n: number) => n.toString(16).padStart(16, "0");

const answer = async (user: string, question: string, knew: boolean) => {
  const { data, error } = await service.rpc("record_quiz_answer", {
    p_user: user,
    p_question: question,
    p_knew: knew,
  });
  if (error) throw error;
  return data![0]!;
};
const review = async (user: string, question: string) =>
  (
    await service
      .from("quiz_reviews")
      .select("box, due_on, attempts, correct, last_knew")
      .eq("user_id", user)
      .eq("question_id", question)
      .maybeSingle()
  ).data;
/** Все едно денят на повторението е дошъл. */
const makeDue = (user: string, question: string) =>
  service
    .from("quiz_reviews")
    .update({ due_on: today })
    .eq("user_id", user)
    .eq("question_id", question);

async function enroll(userId: string): Promise<string> {
  const { data: plan } = await service
    .from("access_plans")
    .select("id")
    .eq("slug", "beta-free")
    .single();
  const { data, error } = await service
    .from("enrollments")
    .insert({
      user_id: userId,
      plan_id: plan!.id,
      source: "beta",
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  alice = await createSignedInUser(status, service, "quiz-alice");
  bob = await createSignedInUser(status, service, "quiz-bob");
  carol = await createSignedInUser(status, service, "quiz-carol");
  admin = await createSignedInUser(status, service, "quiz-admin");
  await service.from("profiles").update({ role: "admin" }).eq("id", admin.id);
  aliceEnrollmentId = await enroll(alice.id);
  await enroll(carol.id);

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
        slug: `quiz-a-${suffix}`,
        number: 7000 + Math.floor(Math.random() * 400),
        title: "Въпроси",
        is_published: true,
      },
      {
        module_id: module!.id,
        slug: `quiz-b-${suffix}`,
        number: 7500 + Math.floor(Math.random() * 400),
        title: "Чернова",
        is_published: false,
      },
    ])
    .select("id");
  if (chapters.error) throw chapters.error;
  chapterId = chapters.data[0]!.id;
  draftChapterId = chapters.data[1]!.id;

  const questions = await service
    .from("quiz_questions")
    .insert(
      Array.from({ length: 34 }, (_, i) => ({
        chapter_id: chapterId,
        mode: "easy" as const,
        key: key(i + 1),
        position: i + 1,
        question: `Въпрос ${i + 1}?`,
        answer: `Отговор ${i + 1}.`,
      })),
    )
    .select("id, position")
    .order("position");
  if (questions.error) throw questions.error;
  questionIds = questions.data.map((row) => row.id);

  const draft = await service
    .from("quiz_questions")
    .insert({
      chapter_id: draftChapterId,
      mode: "easy",
      key: key(999),
      position: 1,
      question: "Скрит въпрос?",
      answer: "Скрит отговор.",
    })
    .select("id")
    .single();
  if (draft.error) throw draft.error;
  draftQuestionId = draft.data.id;
});

afterAll(async () => {
  for (const user of [alice, bob, carol, admin])
    await service.auth.admin.deleteUser(user.id);
  await service.from("chapters").delete().in("id", [chapterId, draftChapterId]);
});

describe("кой вижда въпросите", () => {
  it("потребител с активен план вижда въпросите на публикуваната глава, но не и на черновата", async () => {
    const { data } = await alice.client
      .from("quiz_questions")
      .select("id")
      .in("chapter_id", [chapterId, draftChapterId]);
    expect(data).toHaveLength(34);
    expect(data!.map((row) => row.id)).not.toContain(draftQuestionId);
  });

  it("потребител без план не вижда нито един въпрос", async () => {
    const { data } = await bob.client
      .from("quiz_questions")
      .select("id")
      .in("chapter_id", [chapterId, draftChapterId]);
    expect(data).toEqual([]);
  });

  it("невлязъл посетител няма никакъв достъп", async () => {
    const questions = await anon.from("quiz_questions").select("id").limit(1);
    const reviews = await anon.from("quiz_reviews").select("box").limit(1);
    expect(questions.data ?? []).toEqual([]);
    expect(reviews.data ?? []).toEqual([]);
    expect(questions.error ?? reviews.error).not.toBeNull();
  });

  it("admin вижда и въпросите на черновата", async () => {
    const { data } = await admin.client
      .from("quiz_questions")
      .select("id")
      .eq("chapter_id", draftChapterId);
    expect(data).toHaveLength(1);
  });
});

describe("никой клиент не пише директно", () => {
  it("не може да добавя, променя или трие въпроси", async () => {
    const inserted = await alice.client.from("quiz_questions").insert({
      chapter_id: chapterId,
      mode: "easy",
      key: key(5000),
      position: 99,
      question: "Мой въпрос?",
      answer: "Мой отговор.",
    });
    expect(inserted.error).not.toBeNull();
    const updated = await alice.client
      .from("quiz_questions")
      .update({ answer: "Подменен" })
      .eq("id", questionIds[0]!)
      .select("id");
    expect(updated.error).not.toBeNull();
    const removed = await alice.client
      .from("quiz_questions")
      .delete()
      .eq("id", questionIds[0]!)
      .select("id");
    expect(removed.error).not.toBeNull();
    const { data } = await service
      .from("quiz_questions")
      .select("answer")
      .eq("id", questionIds[0]!)
      .single();
    expect(data!.answer).toBe("Отговор 1.");
  });

  it("не може сам да си запише или промени повторение", async () => {
    const inserted = await alice.client.from("quiz_reviews").insert({
      user_id: alice.id,
      question_id: questionIds[1]!,
      box: 5,
      due_on: null,
      last_knew: true,
    });
    expect(inserted.error).not.toBeNull();
    expect(await review(alice.id, questionIds[1]!)).toBeNull();
  });

  it("не може да извика функцията за записване на отговор", async () => {
    for (const client of [alice.client, admin.client, anon]) {
      const { error } = await client.rpc("record_quiz_answer", {
        p_user: alice.id,
        p_question: questionIds[1]!,
        p_knew: true,
      });
      expect(error).not.toBeNull();
    }
    expect(await review(alice.id, questionIds[1]!)).toBeNull();
  });
});

describe("график на повторението", () => {
  it("първи отговор: кутия 1, повторение утре – независимо дали е знаел", async () => {
    expect(await answer(alice.id, questionIds[0]!, true)).toEqual({
      box: 1,
      due_on: plusDays(1),
      limited: false,
    });
    expect(await answer(alice.id, questionIds[2]!, false)).toEqual({
      box: 1,
      due_on: plusDays(1),
      limited: false,
    });
    expect(await review(alice.id, questionIds[0]!)).toEqual({
      box: 1,
      due_on: plusDays(1),
      attempts: 1,
      correct: 1,
      last_knew: true,
    });
    expect((await review(alice.id, questionIds[2]!))!.correct).toBe(0);
  });

  it("верен отговор преди деня на повторението не мести въпроса напред", async () => {
    for (let i = 0; i < 3; i++) {
      expect(await answer(alice.id, questionIds[0]!, true)).toMatchObject({
        box: 1,
        due_on: plusDays(1),
      });
    }
    expect(await review(alice.id, questionIds[0]!)).toMatchObject({
      attempts: 4,
      correct: 4,
    });
  });

  it("верен отговор в деня на повторението: 3, 7, 14 дни и накрая „научен“", async () => {
    const q = questionIds[0]!;
    const steps: [number, string | null][] = [
      [2, plusDays(3)],
      [3, plusDays(7)],
      [4, plusDays(14)],
      [5, null],
    ];
    for (const [box, due] of steps) {
      await makeDue(alice.id, q);
      expect(await answer(alice.id, q, true)).toEqual({
        box,
        due_on: due,
        limited: false,
      });
    }
  });

  it("закъсняло повторение също се брои", async () => {
    const q = questionIds[2]!;
    await service
      .from("quiz_reviews")
      .update({ due_on: plusDays(-5) })
      .eq("user_id", alice.id)
      .eq("question_id", q);
    expect(await answer(alice.id, q, true)).toMatchObject({
      box: 2,
      due_on: plusDays(3),
    });
  });

  it("научен въпрос остава научен при верен отговор и се връща в кутия 1 при грешен", async () => {
    const q = questionIds[0]!;
    expect(await answer(alice.id, q, true)).toMatchObject({
      box: 5,
      due_on: null,
    });
    expect(await answer(alice.id, q, false)).toEqual({
      box: 1,
      due_on: plusDays(1),
      limited: false,
    });
    const row = await review(alice.id, q);
    expect(row).toMatchObject({ box: 1, last_knew: false });
    expect(row!.attempts - row!.correct).toBe(1);
  });

  it("грешен отговор от по-горна кутия връща въпроса в кутия 1", async () => {
    const q = questionIds[2]!; // в кутия 2
    await makeDue(alice.id, q);
    await answer(alice.id, q, true); // кутия 3
    expect(await answer(alice.id, q, false)).toMatchObject({
      box: 1,
      due_on: plusDays(1),
    });
  });
});

describe("чии повторения се виждат", () => {
  it("всеки вижда само своите; admin вижда всички", async () => {
    await answer(carol.id, questionIds[0]!, true);
    const mine = await alice.client.from("quiz_reviews").select("user_id");
    expect(mine.data!.length).toBeGreaterThan(0);
    expect(new Set(mine.data!.map((row) => row.user_id))).toEqual(
      new Set([alice.id]),
    );

    const bobs = await bob.client.from("quiz_reviews").select("user_id");
    expect(bobs.data).toEqual([]);

    const all = await admin.client
      .from("quiz_reviews")
      .select("user_id")
      .in("user_id", [alice.id, carol.id]);
    expect(new Set(all.data!.map((row) => row.user_id))).toEqual(
      new Set([alice.id, carol.id]),
    );
  });

  it("без активен план въпросите за повторение изчезват от списъка", async () => {
    const due = () =>
      alice.client
        .from("quiz_reviews")
        .select("question_id, quiz_questions!inner(id)")
        .eq("user_id", alice.id);
    expect((await due()).data!.length).toBeGreaterThan(0);
    await service
      .from("enrollments")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", aliceEnrollmentId);
    expect((await due()).data).toEqual([]);
    await service
      .from("enrollments")
      .update({ revoked_at: null })
      .eq("id", aliceEnrollmentId);
    expect((await due()).data!.length).toBeGreaterThan(0);
  });
});

describe("лимит и изтриване", () => {
  it("след 30 отговора в рамките на минута следващият не се записва", async () => {
    // carol вече има 1 отговор (въпрос 1); още 29 различни въпроса правят 30
    for (let i = 1; i < 30; i++) {
      expect((await answer(carol.id, questionIds[i]!, true)).limited).toBe(
        false,
      );
    }
    const blocked = await answer(carol.id, questionIds[31]!, true);
    expect(blocked).toEqual({ box: null, due_on: null, limited: true });
    expect(await review(carol.id, questionIds[31]!)).toBeNull();
  });

  it("изтрит въпрос отнася повторенията си; изтрит потребител – също", async () => {
    await answer(alice.id, questionIds[33]!, true);
    await service.from("quiz_questions").delete().eq("id", questionIds[33]!);
    expect(await review(alice.id, questionIds[33]!)).toBeNull();

    const temp = await createSignedInUser(status, service, "quiz-temp");
    await enroll(temp.id);
    await answer(temp.id, questionIds[5]!, true);
    await service.auth.admin.deleteUser(temp.id);
    expect(await review(temp.id, questionIds[5]!)).toBeNull();
  });
});
