import "server-only";
import { solveBar, type Segment } from "./engineering/axial.ts";
import {
  internalForces,
  maxMoment,
  solveReactions,
  type Beam,
} from "./engineering/beam.ts";
import { extremeStresses, navierStress } from "./engineering/bending.ts";
import { sectionProperties, type Rect } from "./engineering/section.ts";

/**
 * Лични задания: една и съща задача, но с числа според факултетния номер.
 *
 * Самият номер не се пази никъде. От него се вземат само последните три
 * цифри (a, b, c) – „вариантът“. Числата в задачите и верните отговори се
 * смятат от тях със същите функции, с които са проверени примерите в учебника.
 *
 * Модулът е само за сървъра: верните отговори никога не се изпращат в браузъра.
 */
export type Variant = { a: number; b: number; c: number };

/** Последните три цифри на номера; null, ако цифрите са под 4 или над 12. */
export function variantFromFacultyNumber(input: string): Variant | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 4 || digits.length > 12) return null;
  const [a, b, c] = digits.slice(-3).split("").map(Number);
  return { a: a!, b: b!, c: c! };
}

export function isVariant(value: Variant): boolean {
  return [value.a, value.b, value.c].every(
    (digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9,
  );
}

export type TaskQuestion = {
  id: string;
  /** какво се търси, с думи */
  label: string;
  /** означение, напр. „M_max“ */
  symbol: string;
  unit: string;
  /** насока какво да се провери при грешен отговор – без да издава числото */
  hint: string;
};

export type TaskFigure =
  | { kind: "beam"; beam: Beam }
  | { kind: "section"; rects: Rect[] }
  | { kind: "bar"; segments: Segment[]; forces: number[] };

export type PersonalTask = {
  slug: string;
  title: string;
  /** главата от учебника, в която е теорията */
  chapter: { slug: string; number: number };
  /** условието, по един абзац на ред */
  statement: string[];
  given: { symbol: string; value: number; unit: string; decimals?: number }[];
  figure: TaskFigure;
  figureTitle: string;
  questions: TaskQuestion[];
  /** верните отговори по id на въпроса – САМО за сървъра */
  answers: Record<string, number>;
};

type TaskTemplate = {
  slug: string;
  title: string;
  build: (variant: Variant) => Omit<PersonalTask, "slug" | "title">;
};

/** E на стоманата, kN/cm² (EN 1993-1-1, т. 3.2.6: 210 000 N/mm²). */
const E_STEEL = 21_000;

const templates: TaskTemplate[] = [
  {
    slug: "prosta-greda",
    title: "Проста греда: реакции и огъващ момент",
    build({ a, b, c }) {
      const L = 6 + 0.5 * a;
      const F = 20 + 2 * b;
      const q = 4 + c;
      const beam: Beam = {
        length: L,
        supports: { type: "simple", xA: 0, xB: L },
        loads: [
          { type: "distributed", x1: 0, x2: L, value: q },
          { type: "force", x: 2, value: F },
        ],
      };
      const reactions = solveReactions(beam);
      return {
        chapter: { slug: "razrezni-usiliya", number: 1 },
        statement: [
          "Проста греда е натоварена с равномерно разпределен товар по цялата дължина и със съсредоточена сила на 2 m от лявата опора.",
          "Определи опорните реакции и огъващите моменти.",
        ],
        given: [
          { symbol: "l", value: L, unit: "m", decimals: 1 },
          { symbol: "q", value: q, unit: "kN/m" },
          { symbol: "F", value: F, unit: "kN" },
        ],
        figure: { kind: "beam", beam },
        figureTitle: "Проста греда с равномерен товар и съсредоточена сила",
        questions: [
          {
            id: "A",
            label: "Реакция в лявата опора",
            symbol: "A",
            unit: "kN",
            hint: "Моментово уравнение спрямо дясната опора. Равнодействащата на разпределения товар е q·l и действа в средата.",
          },
          {
            id: "B",
            label: "Реакция в дясната опора",
            symbol: "B",
            unit: "kN",
            hint: "Моментово уравнение спрямо лявата опора. Провери със сбора на вертикалните сили: A + B = q·l + F.",
          },
          {
            id: "MF",
            label: "Огъващ момент под силата",
            symbol: "M(2)",
            unit: "kN·m",
            hint: "Сечение на 2 m от лявата опора, лявата част: M = A·2 − q·2·1.",
          },
          {
            id: "Mmax",
            label: "Най-голям огъващ момент",
            symbol: "M_max",
            unit: "kN·m",
            hint: "Моментът е най-голям там, където напречната сила минава през нулата. Провери от коя страна на силата е това сечение.",
          },
        ],
        answers: {
          A: reactions.forces[0]!.value,
          B: reactions.forces[1]!.value,
          MF: internalForces(beam, 2).M,
          Mmax: maxMoment(beam).M,
        },
      };
    },
  },
  {
    slug: "konzola",
    title: "Конзола: реакции и разрезни усилия",
    build({ a, b, c }) {
      const L = 3 + 0.2 * a;
      const F = 10 + b;
      const q = 5 + c;
      const beam: Beam = {
        length: L,
        supports: { type: "cantilever", fixedAt: "left" },
        loads: [
          { type: "distributed", x1: 0, x2: L, value: q },
          { type: "force", x: L, value: F },
        ],
      };
      const reactions = solveReactions(beam);
      const middle = internalForces(beam, L / 2);
      return {
        chapter: { slug: "razrezni-usiliya", number: 1 },
        statement: [
          "Конзола е запъната в левия край. Натоварена е с равномерно разпределен товар по цялата дължина и със съсредоточена сила в свободния край.",
          "Определи реакциите в запъването и разрезните усилия в средата на конзолата. Въведи ги по абсолютна стойност.",
        ],
        given: [
          { symbol: "l", value: L, unit: "m", decimals: 1 },
          { symbol: "q", value: q, unit: "kN/m" },
          { symbol: "F", value: F, unit: "kN" },
        ],
        figure: { kind: "beam", beam },
        figureTitle: "Конзола с равномерен товар и сила в свободния край",
        questions: [
          {
            id: "A",
            label: "Вертикална реакция в запъването",
            symbol: "A",
            unit: "kN",
            hint: "Сбор на вертикалните сили: A = q·l + F.",
          },
          {
            id: "MA",
            label: "Момент в запъването (абсолютна стойност)",
            symbol: "|M_A|",
            unit: "kN·m",
            hint: "Моменти спрямо запъването: рамото на q·l е l/2, а на F е l.",
          },
          {
            id: "Qmid",
            label: "Напречна сила в средата (абсолютна стойност)",
            symbol: "|Q(l/2)|",
            unit: "kN",
            hint: "Тръгни от свободния край: дясната част носи F и половината от разпределения товар.",
          },
          {
            id: "Mmid",
            label: "Огъващ момент в средата (абсолютна стойност)",
            symbol: "|M(l/2)|",
            unit: "kN·m",
            hint: "Дясната част: F с рамо l/2 и товар q·l/2 с рамо l/4.",
          },
        ],
        answers: {
          A: reactions.forces[0]!.value,
          MA: Math.abs(reactions.moment!.value),
          Qmid: Math.abs(middle.Q),
          Mmid: Math.abs(middle.M),
        },
      };
    },
  },
  {
    slug: "t-sechenie",
    title: "Сечение „Т“: център на тежестта и инерционни моменти",
    build({ a, b, c }) {
      const flangeWidth = 10 + a;
      const flangeThickness = 2 + (c % 3);
      const webHeight = 10 + b;
      const webWidth = 2;
      const rects: Rect[] = [
        { b: webWidth, h: webHeight, x: (flangeWidth - webWidth) / 2, y: 0 },
        { b: flangeWidth, h: flangeThickness, x: 0, y: webHeight },
      ];
      const props = sectionProperties(rects);
      return {
        chapter: { slug: "inertsionni-momenti", number: 2 },
        statement: [
          "Сечение „Т“ е съставено от вертикално стебло и хоризонтален пояс върху него. Сечението е симетрично спрямо вертикалната ос.",
          "Определи площта, положението на центъра на тежестта и инерционните моменти спрямо централните оси.",
        ],
        given: [
          { symbol: "пояс, ширина", value: flangeWidth, unit: "cm" },
          { symbol: "пояс, дебелина", value: flangeThickness, unit: "cm" },
          { symbol: "стебло, ширина", value: webWidth, unit: "cm" },
          { symbol: "стебло, височина", value: webHeight, unit: "cm" },
        ],
        figure: { kind: "section", rects },
        figureTitle: "Сечение „Т“ с размерите на пояса и стеблото",
        questions: [
          {
            id: "A",
            label: "Площ на сечението",
            symbol: "A",
            unit: "cm²",
            hint: "Сбор от площите на двата правоъгълника.",
          },
          {
            id: "yc",
            label: "Център на тежестта, от долния ръб",
            symbol: "y_c",
            unit: "cm",
            hint: "y_c = (A₁·y₁ + A₂·y₂) / A. Разстоянията y₁ и y₂ са от долния ръб до центъра на всеки правоъгълник.",
          },
          {
            id: "Ix",
            label: "Инерционен момент спрямо хоризонталната централна ос",
            symbol: "I_x",
            unit: "cm⁴",
            hint: "Теорема на Щайнер за всеки правоъгълник: b·h³/12 + A·d², където d е разстоянието от неговия център до общия.",
          },
          {
            id: "Iy",
            label: "Инерционен момент спрямо вертикалната централна ос",
            symbol: "I_y",
            unit: "cm⁴",
            hint: "Оста y минава през центровете и на двата правоъгълника – няма преносен член. Внимавай кой размер е на трета степен.",
          },
        ],
        answers: { A: props.A, yc: props.yc, Ix: props.Ix, Iy: props.Iy },
      };
    },
  },
  {
    slug: "stapalovidan-prat",
    title: "Стъпаловиден прът: напрежения и удължение",
    build({ a, b, c }) {
      const A1 = 6 + a;
      const A2 = 3 + (a % 3);
      const F1 = 20 + 2 * b;
      const F2 = 10 + c;
      const segments: Segment[] = [
        { length: 120, area: A1, E: E_STEEL },
        { length: 80, area: A2, E: E_STEEL },
      ];
      const forces = [F1, F2];
      const result = solveBar(segments, forces);
      return {
        chapter: { slug: "opan-i-natisk", number: 3 },
        statement: [
          "Стоманен прът е запънат в левия край и има два участъка с различна площ. На границата между тях и в свободния край действат сили по оста, насочени навън (опъват пръта).",
          "Определи нормалната сила и напреженията в участъците и преместването на свободния край.",
        ],
        given: [
          { symbol: "l₁", value: 1.2, unit: "m", decimals: 1 },
          { symbol: "l₂", value: 0.8, unit: "m", decimals: 1 },
          { symbol: "A₁", value: A1, unit: "cm²" },
          { symbol: "A₂", value: A2, unit: "cm²" },
          { symbol: "F₁", value: F1, unit: "kN" },
          { symbol: "F₂", value: F2, unit: "kN" },
          { symbol: "E", value: 210_000, unit: "MPa" },
        ],
        figure: { kind: "bar", segments, forces },
        figureTitle: "Стъпаловиден прът, запънат вляво, с две сили по оста",
        questions: [
          {
            id: "N1",
            label: "Нормална сила в участък 1",
            symbol: "N₁",
            unit: "kN",
            hint: "Сечение в участък 1, дясната част: тя носи и двете сили.",
          },
          {
            id: "s1",
            label: "Напрежение в участък 1",
            symbol: "σ₁",
            unit: "MPa",
            hint: "σ = N/A. Резултатът в kN/cm² се умножава по 10, за да стане в MPa.",
          },
          {
            id: "s2",
            label: "Напрежение в участък 2",
            symbol: "σ₂",
            unit: "MPa",
            hint: "Участък 2 носи само силата в свободния край. 1 kN/cm² = 10 MPa.",
          },
          {
            id: "dl",
            label: "Преместване на свободния край",
            symbol: "Δl",
            unit: "mm",
            hint: "Сбор от удълженията на двата участъка: Δl = N·l/(E·A). Дължините в cm, E = 21 000 kN/cm²; накрая превърни в mm.",
          },
        ],
        answers: {
          N1: result.N[0]!,
          s1: result.sigma[0]! * 10,
          s2: result.sigma[1]! * 10,
          dl: result.displacement[1]! * 10,
        },
      };
    },
  },
  {
    slug: "ogavane",
    title: "Огъване: нормални напрежения в греда",
    build({ a, b, c }) {
      const L = 4 + 0.2 * a;
      const q = 3 + 0.5 * c;
      const width = 10 + (b % 4);
      const height = 18 + 2 * (b % 5);
      const beam: Beam = {
        length: L,
        supports: { type: "simple", xA: 0, xB: L },
        loads: [{ type: "distributed", x1: 0, x2: L, value: q }],
      };
      const props = sectionProperties([{ b: width, h: height, x: 0, y: 0 }]);
      const M = maxMoment(beam).M;
      return {
        chapter: { slug: "spetsialno-ogavane", number: 4 },
        statement: [
          "Проста греда с правоъгълно сечение е натоварена с равномерно разпределен товар по цялата дължина. Сечението е поставено с по-дългата страна вертикално.",
          "Определи най-големия огъващ момент, съпротивителния момент на сечението и нормалните напрежения в средното сечение.",
        ],
        given: [
          { symbol: "l", value: L, unit: "m", decimals: 1 },
          { symbol: "q", value: q, unit: "kN/m", decimals: 1 },
          { symbol: "b", value: width, unit: "cm" },
          { symbol: "h", value: height, unit: "cm" },
        ],
        figure: { kind: "beam", beam },
        figureTitle: "Проста греда с равномерно разпределен товар",
        questions: [
          {
            id: "Mmax",
            label: "Най-голям огъващ момент",
            symbol: "M_max",
            unit: "kN·m",
            hint: "За проста греда с равномерен товар: q·l²/8, в средата на отвора.",
          },
          {
            id: "W",
            label: "Съпротивителен момент на сечението",
            symbol: "W_x",
            unit: "cm³",
            hint: "За правоъгълник: b·h²/6. Височината h е размерът, перпендикулярен на неутралната ос.",
          },
          {
            id: "smax",
            label: "Най-голямо нормално напрежение",
            symbol: "σ_max",
            unit: "MPa",
            hint: "σ = M/W. Преди да делиш, превърни момента в kN·cm (×100). 1 kN/cm² = 10 MPa.",
          },
          {
            id: "s5",
            label: "Напрежение на 5 cm под неутралната ос",
            symbol: "σ(5)",
            unit: "MPa",
            hint: "σ = M·y/I_x с y = 5 cm, където I_x = b·h³/12. Напрежението расте линейно от оста към ръба.",
          },
        ],
        answers: {
          Mmax: M,
          W: props.WxBottom,
          smax: extremeStresses(M, props).maxTension * 10,
          s5: navierStress(M, props.Ix, 5) * 10,
        },
      };
    },
  },
];

export const TASK_LIST: { slug: string; title: string }[] = templates.map(
  ({ slug, title }) => ({ slug, title }),
);

export function buildTask(slug: string, variant: Variant): PersonalTask | null {
  const template = templates.find((item) => item.slug === slug);
  if (!template || !isVariant(variant)) return null;
  return {
    slug: template.slug,
    title: template.title,
    ...template.build(variant),
  };
}

/** Допуск при проверката: 0,5 % от верния отговор (SPEC, т. 7). */
export const TOLERANCE = 0.005;

/**
 * Близо ли е въведеното число до вярното. Освен относителния допуск има и
 * малък абсолютен, за да не се наказва закръгляне до втория знак при малки
 * стойности (напр. 0,82 вместо 0,819).
 */
export function isClose(expected: number, actual: number): boolean {
  if (!Number.isFinite(actual)) return false;
  return (
    Math.abs(actual - expected) <=
    Math.max(TOLERANCE * Math.abs(expected), 0.006)
  );
}

/** Проверява въведените отговори; липсващ отговор се брои за грешен. */
export function checkAnswers(
  task: PersonalTask,
  given: Record<string, number | null | undefined>,
): Record<string, boolean> {
  return Object.fromEntries(
    task.questions.map((question) => {
      const value = given[question.id];
      return [
        question.id,
        typeof value === "number" && isClose(task.answers[question.id]!, value),
      ];
    }),
  );
}
