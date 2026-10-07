import { render } from "@react-email/render";
import { InviteEmail } from "@/emails/InviteEmail";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format-date";
import { computeAccessExpiry } from "@/lib/invites";
import { absoluteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

// Показва как изглежда имейлът с покана, без да изпраща нищо.
export async function GET() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("access_plans")
    .select("name, duration_days, is_lifetime")
    .eq("is_beta", true)
    // показваме плана без срок, ако има такъв – той е за първите потребители
    .order("is_lifetime", { ascending: false })
    .limit(1)
    .maybeSingle();

  const html = await render(
    InviteEmail({
      fullName: "Мария",
      inviteUrl: absoluteUrl("/invite/primeren-kod-samo-za-pregled"),
      planName: plan?.name ?? "Безплатен достъп",
      durationDays: plan?.is_lifetime ? null : (plan?.duration_days ?? 14),
      inviteExpiresOn: formatDate(computeAccessExpiry(new Date(), 14)),
      contactEmail: "kontakt@example.com",
    }),
  );
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex",
    },
  });
}
