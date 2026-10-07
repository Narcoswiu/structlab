import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// Имейл клиентите (Gmail, abv.bg) не четат CSS променливи и външни шрифтове,
// затова тук цветовете са изписани директно.
export const emailColors = {
  page: "#EEF2F7",
  card: "#FFFFFF",
  ink: "#141C2B",
  muted: "#55627A",
  line: "#DCE3EE",
  navy: "#0A0F1C",
  blue: "#2F6FE0",
  blueSoft: "#EAF1FF",
  orange: "#C2570C",
};

const fontFamily =
  "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

type EmailLayoutProps = {
  preview: string;
  children: React.ReactNode;
};

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="bg">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: "24px 12px",
          backgroundColor: emailColors.page,
          fontFamily,
          color: emailColors.ink,
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            backgroundColor: emailColors.card,
            borderRadius: 16,
            overflow: "hidden",
            border: `1px solid ${emailColors.line}`,
          }}
        >
          <Section
            style={{ backgroundColor: emailColors.navy, padding: "22px 32px" }}
          >
            <Text
              style={{
                margin: 0,
                color: "#EAF0F8",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 0.3,
              }}
            >
              <span style={{ color: "#6EA8FF" }}>⌶</span>&nbsp; StructLab
            </Text>
          </Section>
          <Section style={{ padding: "32px 32px 28px" }}>{children}</Section>
          <Section
            style={{
              padding: "18px 32px 24px",
              borderTop: `1px solid ${emailColors.line}`,
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: "18px",
                color: emailColors.muted,
              }}
            >
              StructLab – учебна платформа по Съпротивление на материалите.
              Получаваш този имейл, защото адресът ти беше въведен в
              платформата. Ако не очакваш такова съобщение, просто го
              пренебрегни.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const emailText = {
  h1: {
    margin: "0 0 16px",
    fontSize: 24,
    lineHeight: "32px",
    fontWeight: 700,
    color: emailColors.ink,
  },
  p: {
    margin: "0 0 16px",
    fontSize: 16,
    lineHeight: "26px",
    color: emailColors.ink,
  },
  small: {
    margin: "0 0 8px",
    fontSize: 13,
    lineHeight: "20px",
    color: emailColors.muted,
  },
  button: {
    display: "inline-block",
    backgroundColor: emailColors.blue,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: 700,
    textDecoration: "none",
    padding: "14px 28px",
    borderRadius: 12,
  },
} as const;
