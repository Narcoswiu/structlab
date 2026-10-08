import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

/**
 * Общ вид на напомнянията и отчетите към студентите.
 *
 * Имейл клиентите (Gmail, abv.bg, Outlook) не четат външни шрифтове, CSS
 * променливи, SVG и flex/grid. Затова всичко тук е с таблици, вградени
 * стилове и изписани цветове; „графиките“ са оцветени клетки.
 */
export const mail = {
  page: "#E9EEF5",
  card: "#FFFFFF",
  ink: "#101827",
  text: "#33405A",
  muted: "#66738C",
  line: "#DDE4EF",
  tile: "#F3F6FB",
  navy: "#0A0F1C",
  navySoft: "#15213A",
  onNavy: "#EAF0F8",
  onNavyMuted: "#A9B7CF",
  blue: "#2F6FE0",
  blueLight: "#6EA8FF",
  blueSoft: "#EAF1FF",
  orange: "#F08A3C",
  green: "#1F9D6B",
  greenSoft: "#E3F6EE",
} as const;

const fontFamily =
  "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const mono = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

type ReminderLayoutProps = {
  /** текстът, който се вижда в списъка с писма до темата */
  preview: string;
  /** малък надпис над заглавието, с главни букви */
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
  /** защо човекът получава това писмо */
  reason: string;
  unsubscribeUrl: string;
  settingsUrl: string;
};

export function ReminderLayout({
  preview,
  eyebrow,
  title,
  lead,
  children,
  reason,
  unsubscribeUrl,
  settingsUrl,
}: ReminderLayoutProps) {
  return (
    <Html lang="bg">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: "28px 12px",
          backgroundColor: mail.page,
          fontFamily,
          color: mail.ink,
        }}
      >
        <Container
          style={{
            maxWidth: 580,
            backgroundColor: mail.card,
            borderRadius: 20,
            overflow: "hidden",
            border: `1px solid ${mail.line}`,
          }}
        >
          {/* цветна лента: синьо → оранжево, с плътен цвят за стари клиенти */}
          <Section
            style={{
              height: 6,
              lineHeight: "6px",
              fontSize: 1,
              backgroundColor: mail.blue,
              backgroundImage: `linear-gradient(90deg, ${mail.blueLight} 0%, ${mail.blue} 55%, ${mail.orange} 100%)`,
            }}
          >
            &nbsp;
          </Section>

          <Section
            style={{ backgroundColor: mail.navy, padding: "26px 36px 34px" }}
          >
            <Row>
              <Column>
                <Text
                  style={{
                    margin: 0,
                    color: mail.onNavy,
                    fontSize: 18,
                    fontWeight: 800,
                    letterSpacing: 0.4,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 30,
                      height: 30,
                      lineHeight: "30px",
                      textAlign: "center",
                      borderRadius: 9,
                      backgroundColor: mail.navySoft,
                      color: mail.blueLight,
                      fontFamily: mono,
                      fontWeight: 700,
                      marginRight: 10,
                    }}
                  >
                    I
                  </span>
                  StructLab
                </Text>
              </Column>
            </Row>
            <Text
              style={{
                margin: "30px 0 10px",
                color: mail.blueLight,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 1.6,
                textTransform: "uppercase",
              }}
            >
              {eyebrow}
            </Text>
            <Text
              style={{
                margin: "0 0 12px",
                color: "#FFFFFF",
                fontSize: 30,
                lineHeight: "38px",
                fontWeight: 800,
                letterSpacing: -0.4,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                margin: 0,
                color: mail.onNavyMuted,
                fontSize: 16,
                lineHeight: "25px",
              }}
            >
              {lead}
            </Text>
          </Section>

          <Section style={{ padding: "30px 36px 34px" }}>{children}</Section>

          <Section
            style={{
              padding: "20px 36px 26px",
              backgroundColor: mail.tile,
              borderTop: `1px solid ${mail.line}`,
            }}
          >
            <Text
              style={{
                margin: "0 0 8px",
                fontSize: 12,
                lineHeight: "19px",
                color: mail.muted,
              }}
            >
              {reason}
            </Text>
            <Text
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: "19px",
                color: mail.muted,
              }}
            >
              <Link
                href={unsubscribeUrl}
                style={{ color: mail.muted, textDecoration: "underline" }}
              >
                Спри напомнянията
              </Link>
              {"  ·  "}
              <Link
                href={settingsUrl}
                style={{ color: mail.muted, textDecoration: "underline" }}
              >
                Настройки на профила
              </Link>
            </Text>
          </Section>
        </Container>
        <Text
          style={{
            margin: "16px 0 0",
            textAlign: "center",
            fontSize: 11,
            color: mail.muted,
          }}
        >
          StructLab – инженерството, обяснено ясно
        </Text>
      </Body>
    </Html>
  );
}

/** Голям бутон по средата. */
export function Cta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ textAlign: "center", margin: "28px 0 6px" }}>
      <Button
        href={href}
        style={{
          display: "inline-block",
          backgroundColor: mail.blue,
          color: "#FFFFFF",
          fontSize: 17,
          fontWeight: 800,
          textDecoration: "none",
          padding: "16px 34px",
          borderRadius: 14,
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

export type Stat = {
  value: string;
  label: string;
  tone?: "blue" | "green" | "orange";
};

const toneColor = { blue: mail.blue, green: mail.green, orange: "#C2570C" };

/** До три плочки с голямо число и надпис под него. */
export function StatTiles({ stats }: { stats: Stat[] }) {
  const width = `${Math.floor(100 / stats.length)}%`;
  return (
    <Row>
      {stats.map((stat, index) => (
        <Column
          key={stat.label}
          style={{
            width,
            paddingLeft: index === 0 ? 0 : 6,
            paddingRight: index === stats.length - 1 ? 0 : 6,
            verticalAlign: "top",
          }}
        >
          <Section
            style={{
              backgroundColor: mail.tile,
              borderRadius: 14,
              padding: "16px 8px 14px",
              textAlign: "center",
            }}
          >
            <Text
              style={{
                margin: 0,
                fontFamily: mono,
                fontSize: 30,
                lineHeight: "36px",
                fontWeight: 700,
                color: toneColor[stat.tone ?? "blue"],
              }}
            >
              {stat.value}
            </Text>
            <Text
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                lineHeight: "17px",
                color: mail.muted,
              }}
            >
              {stat.label}
            </Text>
          </Section>
        </Column>
      ))}
    </Row>
  );
}

/** Лента на напредъка: запълнена част и остатък, като две клетки. */
export function ProgressBar({ percent }: { percent: number }) {
  const done = Math.max(0, Math.min(100, Math.round(percent)));
  const cell: CSSProperties = { height: 10, lineHeight: "10px", fontSize: 1 };
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{
        borderCollapse: "separate",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <tbody>
        <tr>
          {done > 0 ? (
            <td
              width={`${done}%`}
              style={{ ...cell, backgroundColor: mail.green }}
            >
              &nbsp;
            </td>
          ) : null}
          {done < 100 ? (
            <td
              width={`${100 - done}%`}
              style={{ ...cell, backgroundColor: mail.line }}
            >
              &nbsp;
            </td>
          ) : null}
        </tr>
      </tbody>
    </table>
  );
}

export type DayBar = { label: string; minutes: number };

/** Стълбчета за седемте дни от седмицата (височината е според минутите). */
export function DayBars({ days }: { days: DayBar[] }) {
  const peak = Math.max(...days.map((day) => day.minutes), 1);
  const maxHeight = 72;
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{ tableLayout: "fixed" }}
    >
      <tbody>
        <tr>
          {days.map((day, index) => {
            const height =
              day.minutes > 0
                ? Math.max(6, Math.round((maxHeight * day.minutes) / peak))
                : 3;
            return (
              <td
                key={index}
                style={{
                  verticalAlign: "bottom",
                  textAlign: "center",
                  height: maxHeight + 18,
                  padding: "0 5px",
                }}
              >
                <div
                  style={{
                    fontFamily: mono,
                    fontSize: 11,
                    lineHeight: "16px",
                    color: day.minutes > 0 ? mail.text : mail.line,
                  }}
                >
                  {day.minutes > 0 ? day.minutes : "·"}
                </div>
                <div
                  style={{
                    height,
                    lineHeight: `${height}px`,
                    fontSize: 1,
                    borderRadius: 5,
                    backgroundColor: day.minutes > 0 ? mail.blue : mail.line,
                  }}
                >
                  &nbsp;
                </div>
              </td>
            );
          })}
        </tr>
        <tr>
          {days.map((day, index) => (
            <td
              key={index}
              style={{
                textAlign: "center",
                paddingTop: 6,
                fontSize: 11,
                color: mail.muted,
              }}
            >
              {day.label}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/** Каре с цветна лента отляво – за въпрос или за следваща стъпка. */
export function Callout({
  label,
  children,
  tone = "blue",
}: {
  label: string;
  children: ReactNode;
  tone?: "blue" | "green";
}) {
  const color = tone === "green" ? mail.green : mail.blue;
  const background = tone === "green" ? mail.greenSoft : mail.blueSoft;
  return (
    <Section
      style={{
        backgroundColor: background,
        borderLeft: `4px solid ${color}`,
        borderRadius: 12,
        padding: "16px 18px",
        margin: "22px 0 0",
      }}
    >
      <Text
        style={{
          margin: "0 0 6px",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1.3,
          textTransform: "uppercase",
          color,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          margin: 0,
          fontSize: 16,
          lineHeight: "25px",
          color: mail.ink,
        }}
      >
        {children}
      </Text>
    </Section>
  );
}

export const mailText = {
  h2: {
    margin: "26px 0 12px",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: mail.muted,
  },
  p: {
    margin: "0 0 14px",
    fontSize: 16,
    lineHeight: "26px",
    color: mail.text,
  },
  small: {
    margin: "14px 0 0",
    fontSize: 13,
    lineHeight: "20px",
    color: mail.muted,
    textAlign: "center",
  },
} as const satisfies Record<string, CSSProperties>;

export {
  Column as MailColumn,
  Row as MailRow,
  Section as MailSection,
  Text as MailText,
};
