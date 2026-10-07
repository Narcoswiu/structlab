import { figureNumber as f } from "../content/beam-figure.ts";
import {
  internalForces,
  keyPoints,
  maxMoment,
  shearZeros,
  solveReactions,
  type Beam,
} from "./beam.ts";

/**
 * Решението на греда, разписано стъпка по стъпка – така, както се пише на лист:
 * равнодействащи, уравнения на равновесието с числата, проверка, характерни
 * стойности и най-голям момент.
 */
export type SolutionStep = {
  title: string;
  /** редове с текст и сметки */
  lines: string[];
  /** по избор: таблица с характерните стойности */
  table?: { head: string[]; rows: string[][] };
};

type Term = { text: string; down: number; x: number; couple: number };

/** Всеки товар като принос към ΣF (надолу) и към ΣM спрямо точка. */
function loadTerms(beam: Beam): Term[] {
  return beam.loads.map((load, i) => {
    const k = i + 1;
    if (load.type === "force") {
      return {
        text: `сила F${k} = ${f(load.value)} kN при x = ${f(load.x)} m`,
        down: load.value,
        x: load.x,
        couple: 0,
      };
    }
    if (load.type === "distributed") {
      const resultant = load.value * (load.x2 - load.x1);
      const center = (load.x1 + load.x2) / 2;
      return {
        text:
          `разпределен товар q${k} = ${f(load.value)} kN/m от ${f(load.x1)} до ${f(load.x2)} m: ` +
          `равнодействаща R${k} = ${f(load.value)} · ${f(load.x2 - load.x1)} = ${f(resultant)} kN при x = ${f(center)} m`,
        down: resultant,
        x: center,
        couple: 0,
      };
    }
    return {
      text: `момент M${k} = ${f(Math.abs(load.value))} kN·m ${load.value >= 0 ? "по" : "обратно на"} часовниковата стрелка при x = ${f(load.x)} m`,
      down: 0,
      x: load.x,
      couple: load.value,
    };
  });
}

/** „30 · 2,4 + 40 · 2“ – сборът на моментите на товарите спрямо точка x0. */
function momentExpression(terms: Term[], x0: number): string {
  const parts: string[] = [];
  for (const term of terms) {
    if (term.down !== 0 && term.x !== x0) {
      const arm = term.x - x0;
      const sign = term.down * arm < 0 ? "−" : "+";
      parts.push(`${sign} ${f(Math.abs(term.down))} · ${f(Math.abs(arm))}`);
    }
    if (term.couple !== 0) {
      parts.push(`${term.couple < 0 ? "−" : "+"} ${f(Math.abs(term.couple))}`);
    }
  }
  if (parts.length === 0) return "0";
  return parts.join(" ").replace(/^\+ /, "").replace(/^− /, "−");
}

export function explainBeam(beam: Beam): SolutionStep[] {
  const reactions = solveReactions(beam);
  const terms = loadTerms(beam);
  const steps: SolutionStep[] = [];
  const totalDown = terms.reduce((sum, term) => sum + term.down, 0);

  steps.push({
    title: "Товари",
    lines:
      terms.length > 0
        ? terms.map((term) => term.text)
        : ["Няма товари – всички реакции и разрезни усилия са нула."],
  });

  if (beam.supports.type === "simple") {
    const { xA, xB } = beam.supports;
    const span = xB - xA;
    const [A, B] = reactions.forces;
    const sumAboutA = terms.reduce(
      (sum, term) => sum + term.down * (term.x - xA) + term.couple,
      0,
    );
    steps.push({
      title: "Опорни реакции",
      lines: [
        `Моменти спрямо A (за да отпадне неизвестната A): B · ${f(span)} = ${momentExpression(terms, xA)} = ${f(sumAboutA)}`,
        `B = ${f(sumAboutA)} / ${f(span)} = ${f(B!.value)} kN${B!.value < 0 ? " (насочена надолу)" : ""}`,
        `Сбор на вертикалните сили: A = ${f(totalDown)} − ${B!.value < 0 ? `(${f(B!.value)})` : f(B!.value)} = ${f(A!.value)} kN${A!.value < 0 ? " (насочена надолу)" : ""}`,
      ],
    });
    // проверка с уравнение, което не е използвано: моменти спрямо B
    const residual =
      A!.value * span -
      terms.reduce(
        (sum, term) => sum + term.down * (xB - term.x) - term.couple,
        0,
      );
    steps.push({
      title: "Проверка",
      lines: [
        `Моменти спрямо B – уравнение, което не е използвано досега: A · ${f(span)} − (моментите на товарите спрямо B) = ${f(residual)}`,
        Math.abs(residual) < 1e-6
          ? "Резултатът е нула – реакциите са верни."
          : "Резултатът не е нула – има грешка.",
      ],
    });
  } else {
    const A = reactions.forces[0]!;
    const M = reactions.moment!;
    const side = beam.supports.fixedAt === "left" ? "левия" : "десния";
    steps.push({
      title: "Реакции в запъването",
      lines: [
        `Запъването е в ${side} край, при x = ${f(A.x)} m.`,
        `Сбор на вертикалните сили: A = ${f(totalDown)} kN${A.value < 0 ? " (насочена надолу)" : ""}`,
        `Моменти спрямо запъването: M_A = −(${momentExpression(terms, A.x)}) = ${f(M.value)} kN·m`,
        M.value < 0
          ? "Знакът минус означава, че в запъването са опънати горните нишки."
          : M.value > 0
            ? "Знакът плюс означава, че в запъването са опънати долните нишки."
            : "Реактивният момент е нула.",
      ],
    });
  }

  const rows: string[][] = [];
  for (const x of keyPoints(beam)) {
    const left = x > 0 ? internalForces(beam, x, "left") : null;
    const right = x < beam.length ? internalForces(beam, x, "right") : null;
    const pair = (a?: number, b?: number) => {
      if (a === undefined) return f(b!);
      if (b === undefined) return f(a);
      return Math.abs(a - b) < 1e-9 ? f(a) : `${f(a)} | ${f(b)}`;
    };
    rows.push([f(x), pair(left?.Q, right?.Q), pair(left?.M, right?.M)]);
  }
  steps.push({
    title: "Характерни стойности",
    lines: [
      "Q е сборът на силите вляво от сечението (нагоре с плюс), а M – сборът на моментите им спрямо сечението.",
      "Където има две стойности, първата е непосредствено вляво от точката, а втората – непосредствено вдясно (скок).",
    ],
    table: { head: ["x, m", "Q, kN", "M, kN·m"], rows },
  });

  const peak = maxMoment(beam);
  const zeros = shearZeros(beam);
  const lines: string[] = [];
  if (zeros.length > 0) {
    lines.push(
      `Q става нула вътре в участък с разпределен товар при x = ${zeros.map(f).join(" m и x = ")} m. Там M има екстремум.`,
    );
  }
  if (Math.abs(peak.M) < 1e-9) {
    lines.push("Огъващият момент е нула по цялата дължина.");
  } else {
    lines.push(
      `Най-големият по абсолютна стойност момент е ${f(Math.abs(peak.M))} kN·m при x = ${f(peak.x)} m.`,
      peak.M > 0
        ? "Той е положителен: опънати са долните нишки и диаграмата е под оста."
        : "Той е отрицателен: опънати са горните нишки и диаграмата е над оста.",
    );
  }
  steps.push({ title: "Най-голям огъващ момент", lines });

  return steps;
}
