import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { FormMessage } from "@/components/ui/form";
import { getCurrentUser, safeNextPath } from "@/lib/auth";

export const metadata: Metadata = { title: "Вход" };

const notices: Record<string, string> = {
  "link-invalid": "Линкът е невалиден или вече е използван. Поискай нов.",
  "signed-out": "Излезе от профила си.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const next = safeNextPath(searchParams.next);
  if (await getCurrentUser()) redirect(next);

  const notice =
    typeof searchParams.notice === "string"
      ? notices[searchParams.notice]
      : undefined;

  return (
    <AuthCard
      title="Вход"
      subtitle="Достъпът е с покана. Ако имаш такава, първо я приеми от линка в имейла."
    >
      {notice ? (
        <FormMessage
          kind={searchParams.notice === "signed-out" ? "success" : "error"}
        >
          {notice}
        </FormMessage>
      ) : null}
      <LoginForm next={next} />
    </AuthCard>
  );
}
