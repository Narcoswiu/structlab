import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isEmailConfigured } from "@/lib/email/send";
import { serverEnv } from "@/lib/env.server";
import { runReminders } from "@/lib/reminders/run";
import { getRemindersSwitch } from "@/lib/reminders/settings";
import { createAdminClient } from "@/lib/supabase/admin";

// изпращането на много писма отнема време; runReminders спира само преди срока
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = serverEnv.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  // сравнение за постоянно време – не издава колко знака съвпадат
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Дневна задача (Vercel Cron, виж vercel.json): напомнянията по имейл.
//
// На безплатния план на Vercel всяка cron задача се пуска ВЕДНЪЖ на ден (и то
// по някое време в рамките на зададения час). Затова всичко тръгва в това едно
// пускане в 07:10 UTC (10:10 лятно / 09:10 зимно българско време): и
// седмичният отчет в понеделник, и дневните напомняния. Правилата кой какво
// получава са в lib/reminders/decide.ts.
//
// Докато главният ключ в админ панела е изключен, задачата не прави нищо.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return new NextResponse(null, { status: 401 });

  if (!(await getRemindersSwitch(createAdminClient())).enabled) {
    return NextResponse.json({ ok: true, status: "изключено", sent: 0 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({
      ok: true,
      status: "пощата не е настроена",
      sent: 0,
    });
  }

  try {
    // runReminders проверява ключа още веднъж сам
    const result = await runReminders();
    if (result.status !== "done") {
      return NextResponse.json({ ok: true, status: "изключено", sent: 0 });
    }
    // само числа – без адреси и имена
    return NextResponse.json({
      ok: true,
      status: "изпратено",
      considered: result.considered,
      sent: result.sent,
      failed: result.failed,
      deferred: result.deferred,
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
