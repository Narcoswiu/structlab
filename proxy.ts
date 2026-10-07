import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// В Next.js 16 „middleware“ се казва „proxy“: код, който се изпълнява преди
// всяка заявка.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
