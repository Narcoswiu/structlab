# StructLab – платформа за обучение по Съпротивление на материалите

Работно име: StructLab (може да се смени). Платен онлайн учебен център за студенти по строителство:
учебници в два режима (леки обяснения и подробни), решени примери, интерактивни лаборатории,
проследяване на напредъка и имейл напомняния. Пълната спецификация е тук: @docs/SPEC.md
Правилата за писане на учебното съдържание са тук: @docs/CONTENT_GUIDE.md

## Как работим (задължително)
- Работим **етап по етап** (виж „Етапи“ в SPEC.md). Преди всеки етап: напиши кратък план
  (какво ще направиш, кои файлове, какви таблици), **изчакай моето одобрение** и чак тогава пиши код.
- След всеки етап: пусни `pnpm lint`, `pnpm typecheck`, `pnpm test`; покажи какво е готово и как да го пробвам.
- Ако нещо в спецификацията е неясно – **питай**, не предполагай.
- Обяснявай ми на български, кратко и ясно. Аз уча в движение (C#/.NET опит, нов съм в Next.js).

## Технологии
- Next.js (App Router) + TypeScript (strict) + pnpm
- Tailwind CSS + shadcn/ui + Framer Motion + lucide-react
- MDX за съдържанието + remark-math / rehype-katex (формули) + SVG фигури
- Supabase: Postgres, Auth, Storage (private buckets), Row Level Security; регион EU (Frankfurt)
- Stripe (Checkout + webhooks) за плащания, валута EUR
- Resend + React Email за имейли; Vercel Cron за планирани задачи
- Zod за валидация; Vitest (unit) + Playwright (e2e)
- Хостинг: Vercel (за платен сайт – платен план)

## Команди
- `pnpm dev` – локален сървър
- `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm e2e`
- `pnpm supabase:types` – генерира TypeScript типове от базата
- Миграции: `supabase migration new <name>` → SQL файл в `supabase/migrations/`

## Структура
```
app/                 # маршрути (App Router)
  (marketing)/       # публични страници: начало, цени, вход
  (app)/             # защитена зона: библиотека, четец, лаборатории, профил
  admin/             # админ панел (само роля admin)
  api/               # route handlers: webhooks, cron, watermark, events
components/          # UI компоненти (ui/ = shadcn)
components/mdx/      # MDX компоненти: Stage, Why, Real, Remember, Quiz, BeamLab...
content/             # MDX учебници и примери (виж CONTENT_GUIDE.md)
lib/                 # supabase клиенти, auth helpers, analytics, email, stripe
lib/engineering/     # чисти функции: греди, сечения (с unit тестове!)
emails/              # React Email шаблони
supabase/migrations/ # SQL миграции + RLS политики
scripts/             # verify-content, verify-examples, seed
```

## Правила за код
- TypeScript strict, без `any`. Server Components по подразбиране; `"use client"` само при нужда.
- Всички входни данни се валидират със Zod (форми, API, webhooks).
- Имена в кода – на английски; целият интерфейс за потребителя – на **български**.
- Числа в интерфейса: десетична **запетая** (5,4 m), мерни единици с интервал (34 kN, 52 kN·m).
- Инженерните изчисления (`lib/engineering`) са чисти функции с тестове. Тестовете включват
  резултатите от Курсова №1 и №2 (виж SPEC.md, „Контролни примери“).

## Сигурност (никога не нарушавай)
- **RLS е включен на всяка таблица.** Нова таблица = миграция + RLS политики + тест.
- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY` – само на сървъра, никога в клиента.
- Файловете (PDF) са в private bucket; достъп само през сървъра с проверка на правата,
  воден знак и кратко валидни signed URLs.
- Stripe webhooks: проверка на подписа; правата се дават **само** от webhook-а, не от клиента.
- Cron маршрутите са защитени с `CRON_SECRET`.
- Не логвай лични данни в конзолата. Спазвай GDPR правилата от SPEC.md.

## Дизайн (еталон: прототипът в Claude Design – начало, въведение, табло, учебник, лаборатория, админ)
- Тъмен интерфейс: фон #0A0F1C, повърхности #101A2E / #15213A, линии #1F2C47; акценти синьо #6EA8FF и оранжево #FFA45C, успех #5EE0A8.
- Шрифтове с кирилица: Unbounded (лого и големи заглавия), Manrope (интерфейс), Literata (четене), JetBrains Mono (числа).
- 3D ефекти: наклон на картите при hover, „плаващи“ 3D елементи, 3D мрежа-под в началото, въртяща се 3D греда „I“.
  Всички анимации се изключват при `prefers-reduced-motion`.
- Всеки вътрешен екран има каре „Какво е тази страница“ (скрива се с „Разбрах“) и линк към обиколката „Въведение“.
- Учебникът: светла, сепия и тъмна тема, 4 размера на шрифта, ширина на реда около 65–70 знака, бутон „Изтегли PDF“.
- Mobile-first, достъпност WCAG AA, бутони и връзки поне 44 px.
- Пътна карта и задачи: @docs/ROADMAP.md
- Правила за Next.js 16 (добавени от `next dev`): @AGENTS.md
