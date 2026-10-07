import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: NextRequest): boolean {
  const secret = serverEnv.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  // сравнение за постоянно време – не издава колко знака съвпадат
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Нощна задача (Vercel Cron, виж vercel.json): изтрива събитията, по-стари от
// 12 месеца, и преизчислява прогреса и активността от суровите събития.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return new NextResponse(null, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rebuild_aggregates");
  if (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const summary = data?.[0];
  return NextResponse.json({
    ok: true,
    purged: Number(summary?.purged ?? 0),
    progressRows: Number(summary?.progress_rows ?? 0),
    activityRows: Number(summary?.activity_rows ?? 0),
  });
}
