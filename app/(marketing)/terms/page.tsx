import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getContactEmail } from "@/lib/email/send";

export const metadata: Metadata = {
  title: "Общи условия",
  description: "Условия за ползване на StructLab по време на бета версията.",
};

// Условията описват само безплатния бета достъп. Преди да започнат плащания,
// се заменят с пълни общи условия за платено цифрово съдържание.
const LAST_UPDATED = "8 октомври 2026 г.";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-extrabold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

const listClass = "flex list-disc flex-col gap-2 pl-5";

export default function TermsPage() {
  const contactEmail = getContactEmail();

  return (
    <Container>
      <SiteHeader />
      <article className="flex max-w-[720px] flex-col gap-8 py-10 text-[17px] leading-[1.7] text-muted-foreground lg:py-16">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-[clamp(26px,6vw,40px)] leading-[1.1] font-bold text-foreground">
            Общи условия
          </h1>
          <p className="text-sm text-dim">
            За бета версията · последна промяна: {LAST_UPDATED}
          </p>
          <p>
            StructLab е учебна платформа в бета версия. Тези условия важат за
            безплатния достъп с покана. С приемането на поканата се съгласяваш с
            тях.
          </p>
        </header>

        <Section title="Какво получаваш">
          <ul className={listClass}>
            <li>
              Достъп до учебните материали в платформата според плана в поканата
              ти. Достъпът е безплатен и не изисква банкова карта.
            </li>
            <li>
              Платформата се развива: главите и функциите се добавят постепенно
              и могат да се променят.
            </li>
          </ul>
        </Section>

        <Section title="Твоят акаунт">
          <ul className={listClass}>
            <li>Акаунтът е личен. Не давай паролата си на друг.</li>
            <li>Поканата важи само за адреса, на който е изпратена.</li>
            <li>
              Ако подозираш, че някой друг ползва акаунта ти, смени паролата и
              ни пиши.
            </li>
          </ul>
        </Section>

        <Section title="Как може да се ползва съдържанието">
          <ul className={listClass}>
            <li>
              Текстовете, фигурите и примерите са за твоя лична подготовка.
            </li>
            <li>
              Не ги публикувай, не ги разпространявай и не ги продавай – изцяло
              или на части – без писмено съгласие.
            </li>
            <li>
              Автоматичното сваляне на съдържанието с програми не е позволено.
            </li>
          </ul>
        </Section>

        <Section title="За какво служи платформата и за какво – не">
          <ul className={listClass}>
            <li>
              Материалите помагат да разбереш дисциплината. Те не заместват
              лекциите, упражненията и изискванията на твоя преподавател.
            </li>
            <li>
              StructLab не е свързана с университет и не е официален учебен
              материал на университет.
            </li>
            <li>
              Примерите са учебни. Не ги използвай като основа за проектиране на
              реални конструкции – това става по действащите норми и от
              правоспособен проектант.
            </li>
            <li>
              Стараем се всичко да е вярно и проверяваме изчисленията, но грешки
              са възможни. Ако забележиш такава, пиши ни през бутона „Обратна
              връзка“.
            </li>
          </ul>
        </Section>

        <Section title="Достъпност на услугата">
          <p>
            В бета версията не гарантираме, че сайтът ще работи без прекъсване.
            Може да го спираме за поддръжка и да променяме или премахваме
            функции.
          </p>
        </Section>

        <Section title="Спиране на достъпа">
          <ul className={listClass}>
            <li>Можеш да поискаш закриване на акаунта си по всяко време.</li>
            <li>
              Можем да спрем достъп при нарушение на тези условия, например при
              споделяне на акаунт или разпространение на съдържанието.
            </li>
          </ul>
        </Section>

        <Section title="Лични данни">
          <p>
            Как обработваме данните ти е описано в{" "}
            <Link
              href="/privacy"
              className="font-bold text-link hover:text-link-hover"
            >
              Политиката за поверителност
            </Link>
            .
          </p>
        </Section>

        <Section title="Промени и връзка">
          <p>
            При промяна на условията ще обновим тази страница и датата най-горе.
            Преди да бъде въведен платен достъп, ще публикуваме нови общи
            условия и ще те уведомим.
            {contactEmail ? (
              <>
                {" "}
                Въпроси:{" "}
                <a
                  href={`mailto:${contactEmail}`}
                  className="font-bold break-all text-link hover:text-link-hover"
                >
                  {contactEmail}
                </a>
                .
              </>
            ) : null}
          </p>
        </Section>

        <Link
          href="/"
          className="inline-flex min-h-11 items-center self-start font-bold text-link hover:text-link-hover"
        >
          ← Към началото
        </Link>
      </article>
    </Container>
  );
}
