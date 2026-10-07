import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Само POST: изход не бива да може да се предизвика с обикновен линк.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(
    new URL("/login?notice=signed-out", request.nextUrl.origin),
    { status: 303 },
  );
}
