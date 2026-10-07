import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { dismissIntro } from "@/app/(app)/actions";
import { changeEnrollment } from "@/app/admin/actions";
import { InviteCreateForm } from "@/components/admin/InviteCreateForm";
import { InviteRowActions } from "@/components/admin/InviteRowActions";
import { PlanDurationForm } from "@/components/admin/PlanDurationForm";
import { WaitlistInviteForm } from "@/components/admin/WaitlistInviteForm";
import { PageIntro } from "@/components/PageIntro";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/form";
import { requireAdmin } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email/send";
import { daysUntil, formatDate } from "@/lib/format-date";
import { getInviteStatus, type InviteStatus } from "@/lib/invites";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getDismissedIntros } from "@/lib/user-settings";

export const metadata: Metadata = { title: "Админ" };

const inviteStatusLabel: Record<InviteStatus, string> = {
  pending: "ЧАКА",
  accepted: "ПРИЕТА",
  revoked: "ОТМЕНЕНА",
  expired: "ИЗТЕКЛА",
};

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <h2 className="text-xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [
    plans,
    invites,
    profiles,
    enrollments,
    feedback,
    dismissed,
    authUsers,
    waitlist,
    contactMessages,
  ] = await Promise.all([
    supabase
      .from("access_plans")
      .select("id, name, duration_days, is_beta, is_lifetime")
      .order("created_at"),
    supabase
      .from("invites")
      .select(
        "id, email, created_at, expires_at, email_sent_at, accepted_at, revoked_at, access_plans(name)",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("enrollments")
      .select(
        "id, user_id, expires_at, revoked_at, access_plans(name, is_lifetime)",
      )
      .order("expires_at", { ascending: false }),
    supabase
      .from("feedback")
      .select("id, user_id, page, message, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    getDismissedIntros(),
    // Имейлите са в auth.users, докъдето RLS не стига – след requireAdmin()
    // ги четем със secret key.
    createAdminClient().auth.admin.listUsers({ perPage: 200 }),
    supabase
      .from("waitlist")
      .select("id, email, university, specialty, year, created_at, invited_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("contact_messages")
      .select("id, name, email, message, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const waiting = (waitlist.data ?? []).filter((entry) => !entry.invited_at);

  const emailById = new Map(
    (authUsers.data?.users ?? []).map((user) => [user.id, user.email ?? ""]),
  );
  const enrollmentByUser = new Map<
    string,
    NonNullable<typeof enrollments.data>[number]
  >();
  for (const enrollment of enrollments.data ?? []) {
    if (!enrollmentByUser.has(enrollment.user_id)) {
      enrollmentByUser.set(enrollment.user_id, enrollment);
    }
  }
  const emailConfigured = isEmailConfigured();
  const now = new Date();

  return (
    <>
      <PageIntro
        id="admin"
        title="Админ – достъп и покани"
        icon={<ShieldCheck aria-hidden="true" className="size-6" />}
        dismissed={dismissed.has("admin")}
        onDismiss={dismissIntro}
      >
        Тук каниш хора, виждаш кой е приел и докога има достъп, и спираш или
        удължаваш достъпа. Регистрация без покана няма.
      </PageIntro>

      <h1 className="font-display text-[clamp(24px,5vw,36px)] leading-[1.15] font-bold">
        Админ
      </h1>

      <Panel title="Нова покана">
        <InviteCreateForm
          plans={plans.data ?? []}
          emailConfigured={emailConfigured}
        />
        <Link
          href="/admin/email-preview"
          target="_blank"
          className="inline-flex min-h-11 items-center self-start text-sm font-bold text-link hover:text-link-hover"
        >
          Виж как изглежда имейлът с поканата →
        </Link>
      </Panel>

      <Panel title={`Покани (${invites.data?.length ?? 0})`}>
        {invites.data?.length ? (
          <ul className="flex flex-col">
            {invites.data.map((invite) => {
              const status = getInviteStatus(invite, now);
              return (
                <li
                  key={invite.id}
                  className="flex flex-col gap-3 border-t border-line py-4 first:border-0 first:pt-0"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-bold break-all">{invite.email}</span>
                    <Badge
                      variant={
                        status === "accepted"
                          ? "success"
                          : status === "pending"
                            ? "default"
                            : "soon"
                      }
                    >
                      {inviteStatusLabel[status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-dim">
                    {invite.access_plans?.name} · създадена{" "}
                    {formatDate(invite.created_at)}
                    {status === "pending"
                      ? ` · важи до ${formatDate(invite.expires_at)}`
                      : ""}
                    {invite.email_sent_at
                      ? ` · имейл на ${formatDate(invite.email_sent_at)}`
                      : " · без изпратен имейл"}
                  </p>
                  {status !== "accepted" ? (
                    <InviteRowActions
                      inviteId={invite.id}
                      canRevoke={status === "pending"}
                      emailConfigured={emailConfigured}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground">Още няма покани.</p>
        )}
      </Panel>

      <Panel title={`Потребители (${profiles.data?.length ?? 0})`}>
        <ul className="flex flex-col">
          {(profiles.data ?? []).map((profile) => {
            const enrollment = enrollmentByUser.get(profile.id);
            const active =
              enrollment &&
              !enrollment.revoked_at &&
              new Date(enrollment.expires_at) > now;
            return (
              <li
                key={profile.id}
                className="flex flex-col gap-2 border-t border-line py-4 first:border-0 first:pt-0"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-bold break-all">
                    {emailById.get(profile.id) || "—"}
                  </span>
                  {profile.role === "admin" ? <Badge>ADMIN</Badge> : null}
                  {enrollment ? (
                    <Badge variant={active ? "success" : "soon"}>
                      {active
                        ? "АКТИВЕН"
                        : enrollment.revoked_at
                          ? "СПРЯН"
                          : "ИЗТЕКЪЛ"}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm text-dim">
                  {profile.full_name || "без име"} · от{" "}
                  {formatDate(profile.created_at)}
                  {enrollment
                    ? enrollment.access_plans?.is_lifetime
                      ? ` · ${enrollment.access_plans.name} (без срок)`
                      : ` · ${enrollment.access_plans?.name} до ${formatDate(enrollment.expires_at)}${
                          active
                            ? ` (още ${daysUntil(enrollment.expires_at, now)} дни)`
                            : ""
                        }`
                    : profile.role === "admin"
                      ? ""
                      : " · без план"}
                </p>
                {enrollment ? (
                  <form
                    action={changeEnrollment}
                    className="flex flex-wrap gap-2"
                  >
                    <input
                      type="hidden"
                      name="enrollmentId"
                      value={enrollment.id}
                    />
                    {enrollment.access_plans?.is_lifetime ? null : (
                      <SubmitButton
                        variant="outline"
                        name="intent"
                        value="extend"
                      >
                        Удължи
                      </SubmitButton>
                    )}
                    {enrollment.revoked_at ? (
                      <SubmitButton
                        variant="outline"
                        name="intent"
                        value="restore"
                      >
                        Върни достъпа
                      </SubmitButton>
                    ) : (
                      <SubmitButton
                        variant="ghost"
                        name="intent"
                        value="revoke"
                      >
                        Спри достъпа
                      </SubmitButton>
                    )}
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Срок на плановете">
        {(plans.data ?? [])
          .filter((plan) => !plan.is_lifetime)
          .map((plan) => (
            <PlanDurationForm key={plan.id} plan={plan} />
          ))}
        <p className="text-sm text-dim">
          Плановете „без срок“ не изтичат и нямат настройка за дни.
        </p>
      </Panel>

      <Panel title={`Чакащи за покана (${waiting.length})`}>
        {waitlist.data?.length ? (
          <ul className="flex flex-col">
            {waitlist.data.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-3 border-t border-line py-4 first:border-0 first:pt-0"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-bold break-all">{entry.email}</span>
                  <Badge variant={entry.invited_at ? "success" : "default"}>
                    {entry.invited_at ? "ПОКАНЕН" : "ЧАКА"}
                  </Badge>
                </div>
                <p className="text-sm text-dim">
                  {entry.university} · {entry.specialty} · {entry.year} курс ·
                  записан на {formatDate(entry.created_at)}
                  {entry.invited_at
                    ? ` · поканен на ${formatDate(entry.invited_at)}`
                    : ""}
                </p>
                {entry.invited_at ? null : (
                  <WaitlistInviteForm
                    waitlistId={entry.id}
                    plans={plans.data ?? []}
                    emailConfigured={emailConfigured}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Още няма записани.</p>
        )}
      </Panel>

      <Panel title="Съобщения от „Контакт“ (последните 20)">
        {contactMessages.data?.length ? (
          <ul className="flex flex-col">
            {contactMessages.data.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1 border-t border-line py-4 first:border-0 first:pt-0"
              >
                <p className="leading-[1.6] whitespace-pre-wrap">
                  {item.message}
                </p>
                <p className="text-sm break-all text-dim">
                  {item.name} · {item.email} · {formatDate(item.created_at)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Още няма съобщения.</p>
        )}
      </Panel>

      <Panel title="Обратна връзка (последните 20)">
        {feedback.data?.length ? (
          <ul className="flex flex-col">
            {feedback.data.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1 border-t border-line py-4 first:border-0 first:pt-0"
              >
                <p className="leading-[1.6] whitespace-pre-wrap">
                  {item.message}
                </p>
                <p className="text-sm text-dim">
                  {emailById.get(item.user_id) || "—"} · {item.page} ·{" "}
                  {formatDate(item.created_at)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Още няма съобщения.</p>
        )}
      </Panel>
    </>
  );
}
