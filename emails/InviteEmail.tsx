import { Button, Link, Section, Text } from "@react-email/components";
import { EmailLayout, emailColors, emailText } from "./EmailLayout";

export type InviteEmailProps = {
  /** може да е празно – тогава поздравът е без име */
  fullName: string;
  inviteUrl: string;
  planName: string;
  /** null = достъп без срок */
  durationDays: number | null;
  /** до кога важи самата покана, вече форматирано: „21.10.2026“ */
  inviteExpiresOn: string;
  contactEmail: string;
};

const steps = [
  {
    title: "Натисни бутона „Приеми поканата“",
    text: "Ще се отвори страница на StructLab с твоя имейл.",
  },
  {
    title: "Избери си парола",
    text: "Поне 10 знака. Нужна ти е само тя и този имейл адрес.",
  },
  {
    title: "Започни от таблото",
    text: "Там виждаш модулите си. Главите на учебника и лабораториите се добавят една по една през следващите седмици.",
  },
];

export function InviteEmail({
  fullName,
  inviteUrl,
  planName,
  durationDays,
  inviteExpiresOn,
  contactEmail,
}: InviteEmailProps) {
  const greeting = fullName.trim()
    ? `Здравей, ${fullName.trim()}!`
    : "Здравей!";
  const lifetime = durationDays === null;

  return (
    <EmailLayout
      preview={
        lifetime
          ? "Имаш покана за StructLab – пълен безплатен достъп без срок."
          : `Имаш покана за StructLab – ${durationDays} дни пълен безплатен достъп.`
      }
    >
      <Text style={emailText.h1}>{greeting}</Text>
      <Text style={emailText.p}>
        Каним те сред първите потребители на <strong>StructLab</strong> –
        платформа, която обяснява Съпротивление на материалите ясно: с примери
        от живота, решени задачи стъпка по стъпка и интерактивни лаборатории.
      </Text>

      <Section
        style={{
          backgroundColor: emailColors.blueSoft,
          borderRadius: 12,
          padding: "16px 20px",
          margin: "0 0 24px",
        }}
      >
        <Text
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1,
            color: emailColors.blue,
          }}
        >
          ТВОЯТ ДОСТЪП
        </Text>
        <Text
          style={{
            margin: "6px 0 0",
            fontSize: 16,
            lineHeight: "24px",
            color: emailColors.ink,
          }}
        >
          <strong>{planName}</strong> – пълен достъп до всичко в платформата,{" "}
          <strong>{lifetime ? "без срок" : `за ${durationDays} дни`}</strong>.
          Безплатно, без банкова карта.
        </Text>
      </Section>

      <Text style={{ ...emailText.p, fontWeight: 700, margin: "0 0 12px" }}>
        Какво да направиш:
      </Text>
      {steps.map((step, index) => (
        <table
          key={step.title}
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          style={{ width: "100%", marginBottom: 12 }}
        >
          <tbody>
            <tr>
              <td style={{ width: 40, verticalAlign: "top" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    lineHeight: "28px",
                    borderRadius: 14,
                    backgroundColor: emailColors.navy,
                    color: "#FFFFFF",
                    fontSize: 14,
                    fontWeight: 700,
                    textAlign: "center",
                  }}
                >
                  {index + 1}
                </div>
              </td>
              <td style={{ verticalAlign: "top" }}>
                <Text
                  style={{
                    margin: 0,
                    fontSize: 16,
                    lineHeight: "24px",
                    fontWeight: 700,
                    color: emailColors.ink,
                  }}
                >
                  {step.title}
                </Text>
                <Text
                  style={{
                    margin: "2px 0 0",
                    fontSize: 14,
                    lineHeight: "22px",
                    color: emailColors.muted,
                  }}
                >
                  {step.text}
                </Text>
              </td>
            </tr>
          </tbody>
        </table>
      ))}

      <Section style={{ textAlign: "center", margin: "28px 0 24px" }}>
        <Button href={inviteUrl} style={emailText.button}>
          Приеми поканата
        </Button>
      </Section>

      <Text style={emailText.small}>
        Поканата е лична и трябва да се приеме до{" "}
        <strong>{inviteExpiresOn}</strong>.{" "}
        {lifetime
          ? "След това достъпът ти остава без срок."
          : `${durationDays}-те дни достъп започват да текат от момента, в който я приемеш.`}
      </Text>
      <Text style={emailText.small}>
        Ако бутонът не работи, копирай този адрес в браузъра:
        <br />
        <Link
          href={inviteUrl}
          style={{ color: emailColors.blue, wordBreak: "break-all" }}
        >
          {inviteUrl}
        </Link>
      </Text>
      <Text style={{ ...emailText.small, margin: "16px 0 0" }}>
        Платформата е в бета версия. На всяка страница има бутон „Обратна
        връзка“ – всяко твое мнение ни помага. Въпроси:{" "}
        <Link
          href={`mailto:${contactEmail}`}
          style={{ color: emailColors.blue }}
        >
          {contactEmail}
        </Link>
      </Text>
    </EmailLayout>
  );
}
