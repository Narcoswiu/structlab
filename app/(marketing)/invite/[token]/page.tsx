import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInviteForm } from "@/components/auth/AcceptInviteForm";
import { AuthCard } from "@/components/auth/AuthCard";
import { buttonClass } from "@/components/ui/button";
import {
  describePlanDuration,
  getInviteStatus,
  hashInviteToken,
  isValidInviteTokenFormat,
} from "@/lib/invites";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Покана",
  robots: { index: false, follow: false },
  // Кодът е в адреса – не го пращаме като „referrer“ към други сайтове.
  referrer: "no-referrer",
};

const problems = {
  accepted: "Тази покана вече е използвана. Влез с имейла и паролата си.",
  revoked: "Тази покана е отменена. Пиши на човека, който ти я е изпратил.",
  expired: "Срокът на тази покана е изтекъл. Поискай нова.",
  invalid: "Линкът е непълен или грешен. Копирай го отново от имейла.",
} as const;

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;

  let problem: keyof typeof problems | null = "invalid";
  let invite: { email: string; full_name: string; plan_id: string } | null =
    null;
  let plan: {
    name: string;
    duration_days: number;
    is_lifetime: boolean;
  } | null = null;

  if (isValidInviteTokenFormat(token)) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("invites")
      .select("email, full_name, plan_id, accepted_at, revoked_at, expires_at")
      .eq("token_hash", hashInviteToken(token))
      .maybeSingle();
    if (data) {
      const status = getInviteStatus(data);
      problem = status === "pending" ? null : status;
      invite = data;
      const planResult = await admin
        .from("access_plans")
        .select("name, duration_days, is_lifetime")
        .eq("id", data.plan_id)
        .single();
      plan = planResult.data;
    }
  }

  if (problem || !invite || !plan) {
    return (
      <AuthCard
        title="Поканата не е активна"
        subtitle={problems[problem ?? "invalid"]}
      >
        <Link href="/login" className={buttonClass({ size: "block" })}>
          Към входа
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Покана за StructLab"
      subtitle={
        <>
          Получаваш план{" "}
          <strong className="text-foreground">{plan.name}</strong> – пълен
          достъп,{" "}
          <strong className="text-foreground">
            {plan.is_lifetime ? "без срок" : `за ${describePlanDuration(plan)}`}
          </strong>
          . Остава само да си избереш парола.
        </>
      }
    >
      <AcceptInviteForm
        token={token}
        email={invite.email}
        fullName={invite.full_name}
      />
    </AuthCard>
  );
}
