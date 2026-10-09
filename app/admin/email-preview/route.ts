import { render } from "@react-email/render";
import { InviteEmail } from "@/emails/InviteEmail";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format-date";
import { computeAccessExpiry } from "@/lib/invites";
import { sampleReminder } from "@/lib/reminders/samples";
import { isSampleTemplate } from "@/lib/reminders/templates";
import { absoluteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const htmlHeaders = {
  "content-type": "text/html; charset=utf-8",
  "x-robots-tag": "noindex",
};

// Показва как изглежда имейл, без да изпраща нищо. Без параметър – поканата;
// с ?template=review|continue|weekly|new-chapter – напомняне с примерни данни.
export async function GET(request: Request) {
  await requireAdmin();
  const template = new URL(request.url).searchParams.get("template");
  if (isSampleTemplate(template)) {
    const sample = sampleReminder(template, {
      firstName: "Мария",
      url: absoluteUrl,
    });
    return new Response(await render(sample.element), { headers: htmlHeaders });
  }

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
  return new Response(html, { headers: htmlHeaders });
}
