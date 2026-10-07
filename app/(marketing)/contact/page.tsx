import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/public/ContactForm";
import { PublicHeading, PublicPage } from "@/components/public/PublicPage";
import { getContactEmail } from "@/lib/email/send";

export const metadata: Metadata = {
  title: "Контакт",
  description:
    "Пиши ни с въпрос, предложение или забелязана грешка в StructLab.",
};

export default function ContactPage() {
  const contactEmail = getContactEmail();
  return (
    <PublicPage>
      <PublicHeading title="Контакт">
        Въпрос, предложение или грешка в учебника – пиши ни. Отговаряме на
        имейла, който посочиш.
      </PublicHeading>
      <ContactForm />
      <p className="max-w-[520px] text-sm leading-[1.6] text-dim">
        {contactEmail ? (
          <>
            Можеш да пишеш и директно на{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-bold break-all text-link hover:text-link-hover"
            >
              {contactEmail}
            </a>
            .{" "}
          </>
        ) : null}
        Как пазим съобщението ти е описано в{" "}
        <Link
          href="/privacy"
          className="font-bold text-link hover:text-link-hover"
        >
          Политиката за поверителност
        </Link>
        .
      </p>
    </PublicPage>
  );
}
