import { NextResponse, type NextRequest } from "next/server";
import {
  unsubscribeByToken,
  unsubscribePageUrl,
} from "@/lib/reminders/unsubscribe";

// „Отписване с едно натискане“ (RFC 8058): пощенският клиент (Gmail, Outlook)
// праща POST към адреса от заглавката „List-Unsubscribe“ – без вход и без
// бисквитки. Отговорът е един и същ за всеки код, съществуващ или не.
export async function POST(
  _request: NextRequest,
  context: RouteContext<"/api/unsubscribe/[token]">,
) {
  const { token } = await context.params;
  await unsubscribeByToken(token);
  return NextResponse.json(
    { ok: true },
    { headers: { "x-robots-tag": "noindex" } },
  );
}

// GET НЕ отписва: скенерите на пощите отварят линковете предварително.
// Човек, отворил адреса в браузър, отива на страницата с бутона.
export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/unsubscribe/[token]">,
) {
  const { token } = await context.params;
  const safe = /^[0-9a-f-]{1,40}$/i.test(token) ? token : "x";
  return NextResponse.redirect(unsubscribePageUrl(safe));
}
