import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { CHAPTER_SECTIONS } from "@/lib/content/sections";
import { LAB_IDS } from "@/lib/lab-ids";
import { createClient } from "@/lib/supabase/server";
import { getTrackingAcceptedAt, recordEvent } from "@/lib/tracking";

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);
const sectionIds = CHAPTER_SECTIONS.map((section) => section.id) as [
  string,
  ...string[],
];
const chapterRef = { module: slug, chapter: slug };
const mode = z.enum(["easy", "detailed"]);

// Всеки вид събитие има точно определени полета; всичко друго се отхвърля.
const eventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("chapter_open"), ...chapterRef, mode }),
  z.strictObject({
    type: z.literal("section_view"),
    ...chapterRef,
    mode,
    section: z.enum(sectionIds),
  }),
  z.strictObject({ type: z.literal("heartbeat"), ...chapterRef }),
  z.strictObject({ type: z.literal("mode_toggle"), ...chapterRef, mode }),
  z.strictObject({ type: z.literal("pdf_download"), ...chapterRef }),
  z.strictObject({
    type: z.literal("lab_open"),
    lab: z.enum(LAB_IDS),
  }),
]);

// „login“ не се приема оттук – записва го сървърът при самия вход.

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Невалидни данни." }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Невалидни данни." }, { status: 400 });
  }

  // Нищо не се записва, преди потребителят да е видял известието.
  if (!(await getTrackingAcceptedAt(user.id))) {
    return new NextResponse(null, { status: 204 });
  }

  const event = parsed.data;
  if (event.type === "lab_open") {
    const outcome = await recordEvent(user.id, "lab_open", { lab: event.lab });
    return respond(outcome);
  }

  // Главата се търси от името на потребителя: RLS я връща само ако има достъп.
  const supabase = await createClient();
  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, modules!inner(slug)")
    .eq("slug", event.chapter)
    .eq("modules.slug", event.module)
    .maybeSingle();
  if (!chapter) return new NextResponse(null, { status: 404 });

  const outcome = await recordEvent(user.id, event.type, {
    chapterId: chapter.id,
    section: "section" in event ? event.section : undefined,
    mode: "mode" in event ? event.mode : undefined,
  });
  return respond(outcome);
}

function respond(outcome: "ok" | "limited" | "error") {
  if (outcome === "limited") {
    return new NextResponse(null, {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }
  if (outcome === "error") return new NextResponse(null, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
