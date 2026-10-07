import { Text } from "@react-email/components";
import { EmailLayout, emailColors, emailText } from "./EmailLayout";

export type ContactNotificationEmailProps = {
  name: string;
  email: string;
  message: string;
};

/** Известие до собственика за ново съобщение от формата „Контакт“. */
export function ContactNotificationEmail({
  name,
  email,
  message,
}: ContactNotificationEmailProps) {
  return (
    <EmailLayout preview={`Ново съобщение от ${name}`}>
      <Text style={emailText.h1}>Ново съобщение от сайта</Text>
      <Text style={emailText.small}>От</Text>
      <Text style={emailText.p}>
        {name} · {email}
      </Text>
      <Text style={emailText.small}>Съобщение</Text>
      <Text
        style={{
          ...emailText.p,
          whiteSpace: "pre-wrap",
          padding: "14px 16px",
          borderRadius: 10,
          backgroundColor: emailColors.blueSoft,
        }}
      >
        {message}
      </Text>
      <Text style={emailText.small}>
        Отговори направо на този имейл – отговорът отива при подателя.
      </Text>
    </EmailLayout>
  );
}
