import {
  Callout,
  Cta,
  DayBars,
  MailColumn,
  MailRow,
  MailSection,
  MailText,
  ProgressBar,
  ReminderLayout,
  StatTiles,
  mail,
  mailText,
  type DayBar,
} from "./ReminderLayout";

/** Общото за всички напомняния. */
type Common = {
  firstName: string;
  unsubscribeUrl: string;
  settingsUrl: string;
};

const hello = (firstName: string) =>
  firstName.trim() ? `Здравей, ${firstName.trim()}!` : "Здравей!";
const questions = (count: number) =>
  count === 1 ? "1 въпрос" : `${count} въпроса`;
const minutesFor = (count: number) => Math.max(1, Math.round(count * 0.75));

// ---------------------------------------------------------------------------
// 1. Днес за повторение
// ---------------------------------------------------------------------------
export type ReviewDueEmailProps = Common & {
  dueCount: number;
  /** научени въпроси досега */
  masteredCount: number;
  /** поредни дни с учене, включително вчера; 0 = няма серия */
  streakDays: number;
  /** по глави: колко въпроса чакат */
  chapters: { number: number; title: string; count: number }[];
  reviewUrl: string;
};

export function reviewDueSubject(props: Pick<ReviewDueEmailProps, "dueCount">) {
  return `${questions(props.dueCount)} за днес – около ${minutesFor(props.dueCount)} мин`;
}

export function ReviewDueEmail(props: ReviewDueEmailProps) {
  const minutes = minutesFor(props.dueCount);
  return (
    <ReminderLayout
      preview={`${questions(props.dueCount)} чакат повторение. Отнема около ${minutes} минути.`}
      eyebrow="Днес за повторение"
      title={`${questions(props.dueCount)} ${props.dueCount === 1 ? "те чака" : "те чакат"}`}
      lead={`${hello(props.firstName)} Точно сега е моментът да ги повториш – малко преди да започнеш да ги забравяш.`}
      reason="Получаваш това писмо, защото имаш въпроси за повторение в StructLab и напомнянията ти са включени."
      unsubscribeUrl={props.unsubscribeUrl}
      settingsUrl={props.settingsUrl}
    >
      <StatTiles
        stats={[
          { value: String(props.dueCount), label: "въпроса за днес" },
          { value: `${minutes}`, label: "минути", tone: "orange" },
          props.streakDays > 1
            ? {
                value: String(props.streakDays),
                label: "дни подред",
                tone: "green",
              }
            : {
                value: String(props.masteredCount),
                label: "вече научени",
                tone: "green",
              },
        ]}
      />

      {props.chapters.length > 0 ? (
        <>
          <MailText style={mailText.h2}>От кои глави са</MailText>
          {props.chapters.map((chapter) => (
            <MailRow
              key={chapter.number}
              style={{ borderTop: `1px solid ${mail.line}` }}
            >
              <MailColumn style={{ padding: "11px 0", width: 44 }}>
                <MailText
                  style={{
                    margin: 0,
                    fontFamily: "Consolas, Menlo, monospace",
                    fontSize: 13,
                    color: mail.muted,
                  }}
                >
                  {String(chapter.number).padStart(2, "0")}
                </MailText>
              </MailColumn>
              <MailColumn style={{ padding: "11px 0" }}>
                <MailText
                  style={{
                    margin: 0,
                    fontSize: 15,
                    lineHeight: "22px",
                    fontWeight: 700,
                    color: mail.ink,
                  }}
                >
                  {chapter.title}
                </MailText>
              </MailColumn>
              <MailColumn
                style={{ padding: "11px 0", width: 90, textAlign: "right" }}
              >
                <MailText
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: mail.blue,
                    fontWeight: 700,
                  }}
                >
                  {questions(chapter.count)}
                </MailText>
              </MailColumn>
            </MailRow>
          ))}
        </>
      ) : null}

      <Cta href={props.reviewUrl}>Започни повторението</Cta>
      <MailText style={mailText.small}>
        Сгрешен въпрос се връща още утре. Верен – след 3, 7 и 14 дни.
      </MailText>
    </ReminderLayout>
  );
}

// ---------------------------------------------------------------------------
// 2. Продължи откъдето спря
// ---------------------------------------------------------------------------
export type ContinueEmailProps = Common & {
  daysAway: number;
  chapterNumber: number;
  chapterTitle: string;
  /** докъде е стигнал: „Решен пример“; null, ако не се знае */
  sectionTitle: string | null;
  sectionsSeen: number;
  sectionsTotal: number;
  /** въпрос от същата глава като закачка; null, ако няма подходящ */
  teaser: string | null;
  continueUrl: string;
};

export function continueSubject(
  props: Pick<ContinueEmailProps, "chapterTitle">,
) {
  return `Остават ти няколко секции от „${props.chapterTitle}“`;
}

export function ContinueEmail(props: ContinueEmailProps) {
  const percent = (props.sectionsSeen / props.sectionsTotal) * 100;
  const left = props.sectionsTotal - props.sectionsSeen;
  return (
    <ReminderLayout
      preview={`Спря на Глава ${props.chapterNumber}. Остават ${left} секции – около 10 минути.`}
      eyebrow="Продължи откъдето спря"
      title={`Глава ${props.chapterNumber} те чака`}
      lead={`${hello(props.firstName)} Няма те от ${props.daysAway} дни. Запазихме мястото ти – продължаваш с едно натискане.`}
      reason="Получаваш това писмо, защото от няколко дни няма активност в профила ти в StructLab и напомнянията ти са включени."
      unsubscribeUrl={props.unsubscribeUrl}
      settingsUrl={props.settingsUrl}
    >
      <MailSection
        style={{
          border: `1px solid ${mail.line}`,
          borderRadius: 16,
          padding: "20px 22px 22px",
        }}
      >
        <MailText
          style={{
            margin: "0 0 4px",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: mail.muted,
          }}
        >
          Глава {props.chapterNumber}
        </MailText>
        <MailText
          style={{
            margin: "0 0 6px",
            fontSize: 20,
            lineHeight: "27px",
            fontWeight: 800,
            color: mail.ink,
          }}
        >
          {props.chapterTitle}
        </MailText>
        <MailText
          style={{ margin: "0 0 14px", fontSize: 14, color: mail.muted }}
        >
          {props.sectionTitle
            ? `Стигна до „${props.sectionTitle}“`
            : "Започна я, но не я довърши"}
          {" · "}
          {props.sectionsSeen} от {props.sectionsTotal} секции
        </MailText>
        <ProgressBar percent={percent} />
      </MailSection>

      {props.teaser ? (
        <Callout label="Можеш ли да отговориш?">{props.teaser}</Callout>
      ) : null}

      <Cta href={props.continueUrl}>Продължи главата</Cta>
      {props.teaser ? (
        <MailText style={mailText.small}>
          Отговорът на въпроса е в края на главата, в „Провери се“.
        </MailText>
      ) : null}
    </ReminderLayout>
  );
}

// ---------------------------------------------------------------------------
// 3. Твоята седмица
// ---------------------------------------------------------------------------
export type WeeklyEmailProps = Common & {
  /** „29.09 – 05.10“ */
  weekLabel: string;
  /** точно седем дни, от понеделник до неделя */
  days: DayBar[];
  minutesTotal: number;
  sectionsRead: number;
  questionsAnswered: number;
  tasksSolved: number;
  tasksTotal: number;
  /** следващата препоръчана стъпка */
  next: { label: string; url: string; note: string };
};

export function weeklySubject(props: Pick<WeeklyEmailProps, "minutesTotal">) {
  return props.minutesTotal > 0
    ? `Твоята седмица: ${props.minutesTotal} минути учене`
    : "Твоята седмица в StructLab";
}

export function WeeklyEmail(props: WeeklyEmailProps) {
  const active = props.days.filter((day) => day.minutes > 0).length;
  const lead =
    props.minutesTotal > 0
      ? `${hello(props.firstName)} Учи в ${active} от 7 дни. Ето как мина седмицата ${props.weekLabel}.`
      : `${hello(props.firstName)} Тази седмица (${props.weekLabel}) не успя да влезеш. Десет минути стигат, за да не изгубиш наученото.`;
  return (
    <ReminderLayout
      preview={`${props.minutesTotal} минути, ${props.sectionsRead} секции, ${props.questionsAnswered} въпроса тази седмица.`}
      eyebrow={`Твоята седмица · ${props.weekLabel}`}
      title={
        props.minutesTotal > 0
          ? `${props.minutesTotal} минути учене`
          : "Тиха седмица"
      }
      lead={lead}
      reason="Получаваш седмичния си отчет, защото имаш акаунт в StructLab и напомнянията ти са включени."
      unsubscribeUrl={props.unsubscribeUrl}
      settingsUrl={props.settingsUrl}
    >
      <MailText style={{ ...mailText.h2, marginTop: 0 }}>
        Минути по дни
      </MailText>
      <DayBars days={props.days} />

      <MailSection style={{ marginTop: 24 }}>
        <StatTiles
          stats={[
            { value: String(props.sectionsRead), label: "прочетени секции" },
            {
              value: String(props.questionsAnswered),
              label: "отговорени въпроса",
              tone: "orange",
            },
            {
              value: `${props.tasksSolved}/${props.tasksTotal}`,
              label: "решени задания",
              tone: "green",
            },
          ]}
        />
      </MailSection>

      <Callout label="Следваща стъпка" tone="green">
        <strong>{props.next.label}</strong>
        <br />
        {props.next.note}
      </Callout>

      <Cta href={props.next.url}>Към следващата стъпка</Cta>
    </ReminderLayout>
  );
}

// ---------------------------------------------------------------------------
// 4. Нова глава
// ---------------------------------------------------------------------------
export type NewChapterEmailProps = Common & {
  moduleTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  summary: string;
  /** какво има вътре: „4 решени примера“, „9 въпроса за повторение“ */
  highlights: string[];
  chapterUrl: string;
};

export function newChapterSubject(
  props: Pick<NewChapterEmailProps, "chapterNumber" | "chapterTitle">,
) {
  return `Нова глава ${props.chapterNumber}: ${props.chapterTitle}`;
}

export function NewChapterEmail(props: NewChapterEmailProps) {
  return (
    <ReminderLayout
      preview={`${props.chapterTitle} – вече е в учебника.`}
      eyebrow={`Ново в ${props.moduleTitle}`}
      title={props.chapterTitle}
      lead={`${hello(props.firstName)} Глава ${props.chapterNumber} вече е в учебника – в „Леко“ и в „Подробно“.`}
      reason="Получаваш това писмо, защото имаш достъп до модула в StructLab и напомнянията ти са включени."
      unsubscribeUrl={props.unsubscribeUrl}
      settingsUrl={props.settingsUrl}
    >
      <MailText style={mailText.p}>{props.summary}</MailText>
      {props.highlights.length > 0 ? (
        <>
          <MailText style={mailText.h2}>Какво има вътре</MailText>
          {props.highlights.map((item) => (
            <MailRow key={item} style={{ borderTop: `1px solid ${mail.line}` }}>
              <MailColumn style={{ width: 30, padding: "10px 0" }}>
                <MailText
                  style={{
                    margin: 0,
                    width: 20,
                    height: 20,
                    lineHeight: "20px",
                    textAlign: "center",
                    borderRadius: 10,
                    backgroundColor: mail.greenSoft,
                    color: mail.green,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  ✓
                </MailText>
              </MailColumn>
              <MailColumn style={{ padding: "10px 0" }}>
                <MailText
                  style={{
                    margin: 0,
                    fontSize: 15,
                    lineHeight: "22px",
                    color: mail.text,
                  }}
                >
                  {item}
                </MailText>
              </MailColumn>
            </MailRow>
          ))}
        </>
      ) : null}
      <Cta href={props.chapterUrl}>Отвори главата</Cta>
    </ReminderLayout>
  );
}
