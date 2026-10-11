// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";
import {
  LESSON_EXCERPTS,
  buildSynonymIndex,
  rankChunks,
  splitChapter,
  suggestQuestions,
  type ChapterSource,
  type GlossaryTerm,
} from "@/lib/ai/retrieval";

// Измерване на търсенето върху ИСТИНСКИТЕ глави: въпроси, каквито би задал
// студент, с главата, в която е отговорът, и въпроси извън учебника, на които
// помощникът трябва да замълчи. Главите не са в публичното репо – без тях
// тестът се пропуска. Числата се печатат с: EVAL_REPORT=1 pnpm exec vitest run
// tests/ai/retrieval-eval.test.ts

const ROOT = path.resolve(import.meta.dirname, "..", "..", "content");

function loadSources(): ChapterSource[] {
  const sources: ChapterSource[] = [];
  if (!existsSync(ROOT)) return sources;
  for (const moduleSlug of readdirSync(ROOT)) {
    const dir = path.join(ROOT, moduleSlug, "chapters");
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      try {
        const read = (file: string) =>
          readFileSync(path.join(dir, name, file), "utf8");
        const meta = JSON.parse(read("meta.json")) as {
          slug: string;
          number: number;
          title: string;
          summary: string;
        };
        for (const mode of ["easy", "detailed"] as const) {
          sources.push({
            moduleSlug,
            chapterSlug: meta.slug,
            number: meta.number,
            title: meta.title,
            summary: meta.summary,
            mode,
            body: read(`${mode}.md`),
          });
        }
      } catch {
        // недовършена глава (липсва файл или meta.json е счупен) се пропуска
      }
    }
  }
  return sources;
}

function loadGlossary(): GlossaryTerm[] {
  try {
    const parsed: unknown = parseYaml(
      readFileSync(path.join(ROOT, "glossary.yml"), "utf8"),
    );
    return Array.isArray(parsed) ? (parsed as GlossaryTerm[]) : [];
  } catch {
    return [];
  }
}

const SM = "saprotivlenie-na-materialite";
const TM1 = "teoretichna-mehanika-1";
const TM2 = "teoretichna-mehanika-2";
const GEO = "inzhenerna-geologiya";
const MACH = "stroitelni-mashini";

/** Въпрос и главите, в които отговорът е на място („модул/глава“). */
type Case = [question: string, ...expected: string[]];

const IN_SCOPE: Case[] = [
  // Съпротивление на материалите
  ["Какво са разрезни усилия?", `${SM}/razrezni-usiliya`],
  ["Как работи методът на сечението?", `${SM}/razrezni-usiliya`],
  ["Какво са вътрешни усилия в греда?", `${SM}/razrezni-usiliya`],
  [
    "Какво гласи теоремата на Щайнер?",
    `${SM}/inertsionni-momenti`,
    `${TM2}/masovi-inertsionni-momenti`,
  ],
  [
    "Как се смята инерционният момент на правоъгълник?",
    `${SM}/inertsionni-momenti`,
  ],
  [
    "Къде е тежището на сечението?",
    `${SM}/inertsionni-momenti`,
    `${TM1}/tsentar-na-tezhestta`,
  ],
  [
    "Какво е закон на Хук?",
    `${SM}/opan-i-natisk`,
    `${SM}/deformatsii-i-zakon-na-huk`,
  ],
  ["Как се намира удължението на прът?", `${SM}/opan-i-natisk`],
  ["Какво е съпротивителен момент?", `${SM}/spetsialno-ogavane`],
  ["Каква е формулата на Навие?", `${SM}/spetsialno-ogavane`],
  [
    "Какво представлява формулата на Журавски?",
    `${SM}/tangentsialni-naprezheniya`,
  ],
  [
    "Откъде идват тангенциалните напрежения при огъване?",
    `${SM}/tangentsialni-naprezheniya`,
  ],
  ["Какво е двойно огъване?", `${SM}/obshto-ogavane`],
  ["Как се завърта неутралната ос при общо огъване?", `${SM}/obshto-ogavane`],
  [
    "Какво е еластична линия?",
    `${SM}/elastichna-liniya`,
    `${SM}/analogiya-na-mor`,
  ],
  ["Какво е условието за коравина на греда?", `${SM}/elastichna-liniya`],
  [
    "Как се смята ъгълът на усукване?",
    `${SM}/usukvane`,
    `${SM}/staticheski-neopredelimo-usukvane`,
  ],
  ["Какво е ядро на сечението?", `${SM}/ogavane-s-opan-ili-natisk`],
  ["Какво е изкълчване?", `${SM}/izkalchvane`],
  ["Какво е бъклинг?", `${SM}/izkalchvane`],
  ["Каква е формулата на Ойлер за критичната сила?", `${SM}/izkalchvane`],
  ["Какво е гъвкавост на прът?", `${SM}/izkalchvane`],
  ["Какво са главни напрежения?", `${SM}/napregnato-sastoyanie`],
  ["Как се чертае окръжността на Мор?", `${SM}/napregnato-sastoyanie`],
  ["Какво е коефициент на Поасон?", `${SM}/deformatsii-i-zakon-na-huk`],
  ["Как се проверява болт на срязване?", `${SM}/chisto-sryazvane`],
  ["Какво е смачкване при болтовете?", `${SM}/chisto-sryazvane`],
  ["Какво е правилото на Верешчагин?", `${SM}/energiyni-metodi`],
  ["Какво е еквивалентно напрежение?", `${SM}/teorii-za-yakost`],
  ["Каква е разликата между теориите за якост?", `${SM}/teorii-za-yakost`],
  ["Какво е фиктивна греда?", `${SM}/analogiya-na-mor`],
  [
    "Как се решава вал, запънат в двата края?",
    `${SM}/staticheski-neopredelimo-usukvane`,
  ],
  ["Как се намира най-голямата сила във въжето?", `${SM}/gavkavi-vazheta`],
  // Теоретична механика 1
  ["Какво е момент на сила?", `${TM1}/sila-i-moment`],
  ["Какво е двоица сили?", `${TM1}/sila-i-moment`],
  [
    "Какво е редукция на система сили?",
    `${TM1}/reduktsiya-ravninna-sistema`,
    `${TM1}/reduktsiya-prostranstvena-sistema`,
  ],
  ["Как се намират опорните реакции?", `${TM1}/oporni-reaktsii`],
  ["Какво е герберова греда?", `${TM1}/gerberova-greda`],
  ["Какво е триставна система?", `${TM1}/tristavni-sistemi`],
  ["Какво са нулеви пръти във ферма?", `${TM1}/fermi`],
  ["Как се прави Ритеров разрез?", `${TM1}/fermi`],
  [
    "Как се намира центърът на тежестта на съставна фигура?",
    `${TM1}/tsentar-na-tezhestta`,
  ],
  [
    "Какво е главен вектор и главен момент?",
    `${TM1}/reduktsiya-prostranstvena-sistema`,
    `${TM1}/reduktsiya-ravninna-sistema`,
  ],
  [
    "Колко са условията за равновесие в пространството?",
    `${TM1}/ravnovesie-v-prostranstvoto`,
  ],
  // Теоретична механика 2
  [
    "Каква е разликата между нормално и тангенциално ускорение?",
    `${TM2}/kinematika-na-tochka`,
  ],
  [
    "Какво е моментен център на скоростите?",
    `${TM2}/kinematika-na-tvardo-tyalo`,
  ],
  ["Какво е кориолисово ускорение?", `${TM2}/relativno-dvizhenie`],
  ["Какво гласи основният закон на динамиката?", `${TM2}/dinamika-na-tochka`],
  [
    "Какво е кориолисова инерционна сила?",
    `${TM2}/dinamika-na-relativnoto-dvizhenie`,
  ],
  [
    "Как се смята работата на пружина?",
    `${TM2}/rabota-i-potentsialna-energiya`,
  ],
  ["Какво е мощност?", `${TM2}/rabota-i-potentsialna-energiya`],
  [
    "Какво е масов инерционен момент?",
    `${TM2}/masovi-inertsionni-momenti`,
    `${TM2}/dinamika-na-tvardo-tyalo`,
  ],
  [
    "Какво е импулс на сила?",
    `${TM2}/kolichestvo-na-dvizhenie-i-kinetichen-moment`,
  ],
  [
    "Какво гласи теоремата за кинетичната енергия?",
    `${TM2}/kinetichna-energiya`,
  ],
  ["Какво е метод на кинетостатиката?", `${TM2}/dinamika-na-tvardo-tyalo`],
  [
    "Какво е принцип на възможните премествания?",
    `${TM2}/analitichna-mehanika`,
  ],
  ["Какво е резонанс?", `${TM2}/ustoychivost-i-malki-trepteniya`],
  ["Кога равновесието е устойчиво?", `${TM2}/ustoychivost-i-malki-trepteniya`],
  // Инженерна геология
  ["Какви видове земна кора има?", `${GEO}/stroezh-na-zemyata`],
  ["Какво е разлом?", `${GEO}/tektonski-dvizheniya-i-strukturi`],
  [
    "Каква е разликата между гънка и разлом?",
    `${GEO}/tektonski-dvizheniya-i-strukturi`,
  ],
  ["Какво е водоупор?", `${GEO}/podzemni-vodi`],
  ["Какво е артезиански кладенец?", `${GEO}/podzemni-vodi`],
  ["Какво гласи законът на Дарси?", `${GEO}/zakon-na-darsi-i-filtratsiya`],
  ["Какво е напорен градиент?", `${GEO}/zakon-na-darsi-i-filtratsiya`],
  ["Каква е формулата на Дюпюи?", `${GEO}/kladentsi-pritok-i-vodoponizhenie`],
  ["Какво е изветряне?", `${GEO}/izvetryane-i-deynost-na-vodite`],
  // Строителни машини
  [
    "Как се смята производителността на багер?",
    `${MACH}/bageri-tovarachi-i-transporten-tsikal`,
  ],
  [
    "Колко самосвала трябват за един багер?",
    `${MACH}/bageri-tovarachi-i-transporten-tsikal`,
  ],
  ["Кой валяк за коя почва се използва?", `${MACH}/uplatnitelni-mashini`],
  // втора партида – писана след настройката на правилата, за проверка
  ["Защо армировката на балкона е горе?", `${SM}/razrezni-usiliya`],
  [
    "Кога напречната сила е положителна?",
    `${SM}/razrezni-usiliya`,
    `${SM}/tangentsialni-naprezheniya`,
  ],
  ["Как се чертае диаграмата на огъващия момент?", `${SM}/razrezni-usiliya`],
  ["Как се оразмерява греда на огъване?", `${SM}/spetsialno-ogavane`],
  [
    "Какво е неутрална ос?",
    `${SM}/spetsialno-ogavane`,
    `${SM}/obshto-ogavane`,
    `${SM}/ogavane-s-opan-ili-natisk`,
  ],
  [
    "Как се смята провисването на проста греда?",
    `${SM}/elastichna-liniya`,
    `${SM}/analogiya-na-mor`,
    `${SM}/energiyni-metodi`,
  ],
  [
    "Какво е полярен инерционен момент?",
    `${SM}/usukvane`,
    `${SM}/inertsionni-momenti`,
  ],
  ["Какво е критична сила?", `${SM}/izkalchvane`],
  ["Какво е стройност на колона?", `${SM}/izkalchvane`],
  ["Как се оразмерява заваръчен шев?", `${SM}/chisto-sryazvane`],
  [
    "Каква е разликата между опън и натиск?",
    `${SM}/opan-i-natisk`,
    `${TM1}/fermi`,
  ],
  [
    "не разбирам как се намира ядрото на сечението",
    `${SM}/ogavane-s-opan-ili-natisk`,
  ],
  [
    "обясни ми накратко закона на хук",
    `${SM}/opan-i-natisk`,
    `${SM}/deformatsii-i-zakon-na-huk`,
  ],
  ["формула на ойлер", `${SM}/izkalchvane`],
  ["щайнер", `${SM}/inertsionni-momenti`, `${TM2}/masovi-inertsionni-momenti`],
  ["Какво е W?", `${SM}/spetsialno-ogavane`],
  [
    "Каква е разликата между подвижна и неподвижна опора?",
    `${TM1}/oporni-reaktsii`,
  ],
  [
    "Какво е разпределен товар?",
    `${TM1}/reduktsiya-ravninna-sistema`,
    `${TM1}/oporni-reaktsii`,
    `${SM}/razrezni-usiliya`,
  ],
  ["Какво е разпор?", `${TM1}/tristavni-sistemi`, `${SM}/gavkavi-vazheta`],
  ["Как се решава ферма по метода на възлите?", `${TM1}/fermi`],
  ["Какво е траектория?", `${TM2}/kinematika-na-tochka`],
  ["Какво е ъглова скорост?", `${TM2}/kinematika-na-tvardo-tyalo`],
  [
    "Какво е сила на триене?",
    `${TM2}/dinamika-na-tochka`,
    `${TM2}/rabota-i-potentsialna-energiya`,
  ],
  [
    "Какво е количество на движение?",
    `${TM2}/kolichestvo-na-dvizhenie-i-kinetichen-moment`,
  ],
  [
    "Какво е кинетичен момент?",
    `${TM2}/kolichestvo-na-dvizhenie-i-kinetichen-moment`,
  ],
  ["Какво са степени на свобода?", `${TM2}/analitichna-mehanika`],
  ["Какво е собствена честота?", `${TM2}/ustoychivost-i-malki-trepteniya`],
  ["Какво е мантия?", `${GEO}/stroezh-na-zemyata`],
  ["гънки", `${GEO}/tektonski-dvizheniya-i-strukturi`],
  [
    "Каква е разликата между напорни и безнапорни води?",
    `${GEO}/podzemni-vodi`,
  ],
  [
    "Какво е коефициент на филтрация?",
    `${GEO}/zakon-na-darsi-i-filtratsiya`,
    `${GEO}/kladentsi-pritok-i-vodoponizhenie`,
  ],
  ["Какво е депресионна фуния?", `${GEO}/kladentsi-pritok-i-vodoponizhenie`],
  [
    "Какъв е цикълът на багера?",
    `${MACH}/bageri-tovarachi-i-transporten-tsikal`,
  ],
  [
    "Какво е коефициент на разбухване?",
    `${MACH}/bageri-tovarachi-i-transporten-tsikal`,
    `${MACH}/uplatnitelni-mashini`,
  ],
];

const OUT_OF_SCOPE = [
  "Колко е часът в Токио?",
  "Кой спечели футболното първенство?",
  "Кога е следващият мач на Левски?",
  "Как се готви мусака?",
  "Каква е рецептата за баница?",
  "Как да напиша цикъл на Python?",
  "Как да си направя сайт с JavaScript?",
  "Здравей!",
  "Как си?",
  "благодаря",
  "Благодаря ти много, беше полезно",
  "ок",
  "час",
  "добре",
  "пример",
  "Каква е столицата на Франция?",
  "Кой е президент на България?",
  "Какво ще е времето утре?",
  "Препоръчай ми филм за вечерта",
  "Колко струва биткойн днес?",
  "Кога тръгва влакът за Варна?",
  "Колко калории има една ябълка?",
  "Разкажи ми виц",
  "Напиши ми есе за Иван Вазов",
  // обикновени думи, които ги има и в учебника
  "Колко тежи един слон?",
  "Как се сменя гума на кола?",
  "Колко часа сън са нужни на ден?",
  "Колко струва един балкон?",
  "Къде да отида на почивка през лятото?",
  "Кой е най-високият връх в България?",
  "Как се прави домашен хляб?",
  "Каква музика слушаш?",
  "Имам ли домашно за утре?",
  "Колко е 2 + 2?",
  "Как да сваля 5 килограма за месец?",
  "Какъв е инерционният момент на Токио?",
  "Коя е най-дългата река в Европа?",
  "Как се играе шах?",
  "Кога е изпитът по математика?",
  "Какво да подаря на майка ми?",
  // втора партида
  "Какъв е смисълът на живота?",
  "Как да вляза в акаунта си?",
  "Колко струва абонаментът?",
  "Кога излиза новият айфон?",
  "Преведи ми това на английски",
  "Кой е написал „Под игото“?",
  "Колко е висока Айфеловата кула?",
  "Как се връзва вратовръзка?",
  "Какво е фотосинтеза?",
  "Кой е открил Америка?",
  "Колко планети има в Слънчевата система?",
  "Кажи ми нещо интересно",
  "Харесваш ли пица?",
  "Реши ми курсовата",
  "Колко е часът?",
  "добър ден",
  "лека нощ",
  "хаха",
  "asdf qwerty",
  "hello",
  "?",
];

// Известни граници на търсенето по думи (не се проверяват): термин, който е
// и всекидневна дума, дава откъс – „Как да си намеря работа?“ (работа на
// сила), „Каква е скоростта на интернета ми?“, „Как се решава квадратно
// уравнение?“ (подсекция „Уравнения“).

const sources = loadSources();
const chunks = sources.flatMap(splitChapter);
const synonyms = buildSynonymIndex(loadGlossary());
const present = new Set(
  sources.map((source) => `${source.moduleSlug}/${source.chapterSlug}`),
);
// въпрос за глава, която още не е написана тук, не се брои
const cases = IN_SCOPE.filter(([, ...expected]) =>
  expected.some((key) => present.has(key)),
);

const ask = (question: string) =>
  rankChunks(question, chunks, { synonyms }).slice(0, LESSON_EXCERPTS);
const keyOf = (chunk: { moduleSlug: string; chapterSlug: string }) =>
  `${chunk.moduleSlug}/${chunk.chapterSlug}`;

describe.skipIf(cases.length < 40)("търсене върху истинските глави", () => {
  it("въпросите са достатъчно и покриват и петте модула", () => {
    expect(IN_SCOPE.length).toBeGreaterThanOrEqual(40);
    expect(OUT_OF_SCOPE.length).toBeGreaterThanOrEqual(15);
    for (const moduleSlug of [SM, TM1, TM2, GEO, MACH]) {
      expect(
        IN_SCOPE.some(([, first]) => first!.startsWith(`${moduleSlug}/`)),
      ).toBe(true);
    }
  });

  // EVAL_DEBUG="въпрос" показва първите пет парчета с оценките им
  it.runIf(process.env.EVAL_DEBUG)("оценките за един въпрос", () => {
    const ranked = rankChunks(process.env.EVAL_DEBUG!, chunks, { synonyms });
    console.log(
      ranked
        .slice(0, 5)
        .map(
          (chunk) =>
            `${chunk.score.toFixed(1)}  ${keyOf(chunk)} [${chunk.mode}] ${chunk.sectionTitle} / ${chunk.subsectionTitle ?? "-"}`,
        )
        .join("\n") || "нищо",
    );
  });

  it("намира правилната глава, а извън учебника мълчи", () => {
    const misses1: string[] = [];
    const misses3: string[] = [];
    for (const [question, ...expected] of cases) {
      const got = ask(question).map(keyOf);
      const line = `${question} → ${got.join(", ") || "нищо"}`;
      if (!expected.includes(got[0] ?? "")) misses1.push(line);
      if (!got.some((key) => expected.includes(key))) misses3.push(line);
    }
    const falseAnswers = OUT_OF_SCOPE.filter(
      (question) => ask(question).length > 0,
    ).map((question) => {
      const top = ask(question)[0]!;
      return `${question} → ${keyOf(top)} (${top.subsectionTitle ?? top.sectionTitle})`;
    });

    const top1 = 1 - misses1.length / cases.length;
    const top3 = 1 - misses3.length / cases.length;
    if (process.env.EVAL_REPORT) {
      console.log(
        [
          `въпроси: ${cases.length} в учебника, ${OUT_OF_SCOPE.length} извън него`,
          `top-1: ${(top1 * 100).toFixed(1)} %  top-3: ${(top3 * 100).toFixed(1)} %`,
          `грешни отговори извън учебника: ${falseAnswers.length}`,
          ...misses1.map((line) => `  не е първа: ${line}`),
          ...misses3.map((line) => `  не е в първите три: ${line}`),
          ...falseAnswers.map((line) => `  излишен отговор: ${line}`),
        ].join("\n"),
      );
    }

    expect(falseAnswers).toEqual([]);
    expect(top1).toBeGreaterThanOrEqual(0.95);
    expect(top3).toBeGreaterThanOrEqual(0.98);
  }, 120_000);

  it("предложените въпроси са от учебника и намират главата си", () => {
    const suggestions = suggestQuestions(chunks, { limit: 200 });
    if (process.env.EVAL_REPORT) {
      console.log(suggestions.map((item) => item.question).join("\n"));
    }
    expect(suggestions.length).toBeGreaterThanOrEqual(20);
    for (const { question, moduleSlug, chapterSlug } of suggestions) {
      expect(ask(question).map(keyOf), question).toContain(
        `${moduleSlug}/${chapterSlug}`,
      );
    }
  }, 120_000);
});
