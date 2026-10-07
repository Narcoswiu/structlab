import { Button, Link, Section, Text } from "@react-email/components";
import { EmailLayout, emailColors, emailText } from "./EmailLayout";

export type LoginLinkEmailProps = {
  kind: "recovery" | "magiclink";
  url: string;
};

const copy = {
  recovery: {
    preview: "Линк за нова парола в StructLab.",
    title: "Нова парола",
    text: "Поиска смяна на паролата си в StructLab. Натисни бутона и въведи нова парола.",
    button: "Смени паролата",
  },
  magiclink: {
    preview: "Линк за вход в StructLab.",
    title: "Вход в StructLab",
    text: "Натисни бутона, за да влезеш в StructLab без парола.",
    button: "Влез",
  },
} as const;

export function LoginLinkEmail({ kind, url }: LoginLinkEmailProps) {
  const c = copy[kind];
  return (
    <EmailLayout preview={c.preview}>
      <Text style={emailText.h1}>{c.title}</Text>
      <Text style={emailText.p}>{c.text}</Text>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <Button href={url} style={emailText.button}>
          {c.button}
        </Button>
      </Section>
      <Text style={emailText.small}>
        Линкът важи 1 час и може да се използва само веднъж. Ако не си го
        поискал ти, не прави нищо – паролата ти остава същата.
      </Text>
      <Text style={emailText.small}>
        Ако бутонът не работи, копирай този адрес в браузъра:
        <br />
        <Link
          href={url}
          style={{ color: emailColors.blue, wordBreak: "break-all" }}
        >
          {url}
        </Link>
      </Text>
    </EmailLayout>
  );
}
