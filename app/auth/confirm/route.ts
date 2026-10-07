import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  token_hash: z.string().min(10).max(200),
  type: z.enum(["recovery", "magiclink"]),
});

// Тук води линкът от имейла. Разменяме еднократния код за сесия (бисквитка).
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const parsed = querySchema.safeParse({
    token_hash: url.searchParams.get("token_hash"),
    type: url.searchParams.get("type"),
  });

  if (parsed.success) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp(parsed.data);
    if (!error) {
      const target =
        parsed.data.type === "recovery" ? "/account/password" : "/dashboard";
      return NextResponse.redirect(new URL(target, url.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/login?notice=link-invalid", url.origin),
  );
}
