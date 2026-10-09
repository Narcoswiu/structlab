/**
 * Енергийни методи: работа на външните сили, потенциална енергия на
 * деформацията, теореми на Клапейрон и Кастилияно, интеграл на Максвел–Мор и
 * правило на Верешчагин.
 *
 * Мерни единици – функциите не превръщат нищо, подават се съгласувани величини:
 *   греди:  сили в kN, дължини в m, моменти в kN·m, E·I в kN·m²
 *           → енергия в kN·m, преместване в m, ъгъл в rad;
 *   пръти и валове: сили в kN, дължини в cm, моменти в kN·cm, E и G в kN/cm²,
 *           A в cm², I_p в cm⁴ → енергия в kN·cm, преместване в cm, ъгъл в rad.
 *   1 kN·m = 1000 J; 1 kN·cm = 10 J.
 *
 * Знаци (както в целия учебник): N > 0 при опън; M > 0 опъва долните влакна.
 * Единичната сила е безразмерна: M̄ е в m (или в cm), N̄ е число.
 * Положително преместване значи преместване ПО посоката на единичната сила.
 * Произведението Ω·η е положително, когато двете диаграми са от една и съща
 * страна на оста (ординатите се подават със знака си).
 *
 * Влиянието на напречната сила върху преместванията е пренебрегнато.
 */

function requirePositive(value: number, name: string): void {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new Error(`${name} трябва да е положително число.`);
  }
}

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} трябва да е число.`);
  }
}

function requireSteps(steps: number): void {
  if (!Number.isInteger(steps) || steps < 1) {
    throw new Error("Броят на деленията трябва да е цяло положително число.");
  }
}

/** kN·m → J */
export function kNmToJoule(energy: number): number {
  return energy * 1000;
}

/** kN·cm → J */
export function kNcmToJoule(energy: number): number {
  return energy * 10;
}

/**
 * Работа на статично приложена сила (расте бавно от 0 до F), чиято точка се
 * премества с δ по посоката ѝ: A_e = F·δ/2. Същото важи за момент и ъгъл.
 */
export function externalWork(F: number, delta: number): number {
  requireFinite(F, "Силата");
  requireFinite(delta, "Преместването");
  return (F * delta) / 2;
}

/**
 * Теорема на Клапейрон: U = ½·Σ F_i·δ_i. Всяко δ_i е преместването на точката
 * на F_i по нейната посока от всички товари заедно.
 */
export function clapeyronEnergy(
  forces: number[],
  displacements: number[],
): number {
  if (forces.length === 0 || forces.length !== displacements.length) {
    throw new Error("Броят на силите и на преместванията трябва да съвпада.");
  }
  return forces.reduce(
    (sum, F, i) => sum + externalWork(F, displacements[i]!),
    0,
  );
}

/** Енергия при опън/натиск с постоянна N: U = N²·l / (2·E·A). */
export function axialStrainEnergy(
  N: number,
  l: number,
  E: number,
  A: number,
): number {
  requireFinite(N, "Нормалната сила");
  requirePositive(l, "Дължината");
  requirePositive(E, "Модулът на еластичност");
  requirePositive(A, "Площта");
  return (N * N * l) / (2 * E * A);
}

/** Енергия при усукване с постоянен T: U = T²·l / (2·G·I_p). */
export function torsionStrainEnergy(
  T: number,
  l: number,
  G: number,
  Ip: number,
): number {
  requireFinite(T, "Усукващият момент");
  requirePositive(l, "Дължината");
  requirePositive(G, "Модулът на срязване");
  requirePositive(Ip, "Полярният инерционен момент");
  return (T * T * l) / (2 * G * Ip);
}

/** ∫ f(x) dx от a до b по съставната формула на Симпсън с `steps` двойни стъпки. */
function simpson(
  f: (x: number) => number,
  a: number,
  b: number,
  steps: number,
): number {
  const h = (b - a) / steps;
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const x0 = a + i * h;
    const x1 = i === steps - 1 ? b : x0 + h;
    sum += ((x1 - x0) / 6) * (f(x0) + 4 * f((x0 + x1) / 2) + f(x1));
  }
  return sum;
}

/**
 * Интеграл на Максвел–Мор за един участък, сметнат числено:
 * ∫ M(x)·M̄(x) dx от a до b (без делението на E·I).
 * Двете функции трябва да са гладки в участъка – при чупка се дели на участъци.
 */
export function mohrIntegral(
  M: (x: number) => number,
  Mbar: (x: number) => number,
  a: number,
  b: number,
  steps = 200,
): number {
  requireFinite(a, "Началото на участъка");
  requireFinite(b, "Краят на участъка");
  if (!(b > a)) throw new Error("Краят на участъка трябва да е след началото.");
  requireSteps(steps);
  return simpson((x) => M(x) * Mbar(x), a, b, steps);
}

/**
 * Енергия при огъване: U = ∫ M² dx / (2·E·I) от a до b, числено.
 * Напречната сила не се отчита.
 */
export function bendingStrainEnergy(
  M: (x: number) => number,
  a: number,
  b: number,
  EI: number,
  steps = 200,
): number {
  requirePositive(EI, "Коравината E·I");
  return mohrIntegral(M, M, a, b, steps) / (2 * EI);
}

/**
 * Теорема на Кастилияно: δ = ∂U/∂F, с числена (централна) производна.
 * `energy` връща U като функция на силата, по която се диференцира.
 * За квадратична U(F) централната разлика е точна до закръглението.
 */
export function castiglianoDisplacement(
  energy: (F: number) => number,
  F: number,
  step = 1e-3,
): number {
  requireFinite(F, "Силата");
  requirePositive(step, "Стъпката");
  return (energy(F + step) - energy(F - step)) / (2 * step);
}

export type DiagramShape =
  /** правоъгълник с височина h */
  | "rectangle"
  /** триъгълник: h в единия край, нула в другия */
  | "triangle"
  /**
   * квадратна парабола с връх (хоризонтална допирателна) в НУЛЕВИЯ край –
   * диаграмата M на конзола с равномерен товар
   */
  | "parabola-vertex-at-zero"
  /**
   * квадратна парабола с връх при НАЙ-ГОЛЯМАТА ордината – половината от
   * диаграмата M на проста греда с равномерен товар
   */
  | "parabola-vertex-at-peak";

export type DiagramArea = {
  /** площ на диаграмата Ω */
  area: number;
  /** разстояние от края с най-голямата ордината до центъра на тежестта */
  centroid: number;
};

/**
 * Площ и център на тежестта на типова диаграма с дължина l и най-голяма
 * ордината h (h може да е отрицателна – площта запазва знака ѝ).
 * Центърът се мери от края с най-голямата ордината; за правоъгълника – l/2.
 */
export function diagramShape(
  shape: DiagramShape,
  l: number,
  h: number,
): DiagramArea {
  requirePositive(l, "Дължината на участъка");
  requireFinite(h, "Ординатата");
  switch (shape) {
    case "rectangle":
      return { area: l * h, centroid: l / 2 };
    case "triangle":
      return { area: (l * h) / 2, centroid: l / 3 };
    case "parabola-vertex-at-zero":
      return { area: (l * h) / 3, centroid: l / 4 };
    case "parabola-vertex-at-peak":
      return { area: (2 * l * h) / 3, centroid: (3 * l) / 8 };
    default:
      throw new Error("Непозната форма на диаграмата.");
  }
}

/**
 * Ордината на ПРАВА диаграма в сечение x от участък с дължина l:
 * `left` е ординатата при x = 0, `right` – при x = l.
 */
export function linearOrdinate(
  left: number,
  right: number,
  l: number,
  x: number,
): number {
  requireFinite(left, "Лявата ордината");
  requireFinite(right, "Дясната ордината");
  requirePositive(l, "Дължината на участъка");
  if (!(x >= 0 && x <= l)) throw new Error("Сечение извън участъка.");
  return left + ((right - left) * x) / l;
}

/**
 * Правило на Верешчагин за един участък: ∫ M·M̄ dx = Ω·η_c, където Ω е площта
 * на едната диаграма, а η_c – ординатата на другата (ПРАВА в участъка) диаграма
 * под центъра на тежестта на първата.
 */
export function vereshchagin(area: number, ordinate: number): number {
  requireFinite(area, "Площта");
  requireFinite(ordinate, "Ординатата");
  return area * ordinate;
}

/**
 * Произведение на две прави диаграми (трапеци) в участък с дължина l:
 * първата има ординати a (ляво) и b (дясно), втората – c и d.
 * ∫ = l/6 · (2·a·c + 2·b·d + a·d + b·c). Триъгълник е трапец с нулева ордината.
 */
export function trapezoidProduct(
  l: number,
  a: number,
  b: number,
  c: number,
  d: number,
): number {
  requirePositive(l, "Дължината на участъка");
  for (const value of [a, b, c, d]) requireFinite(value, "Ординатата");
  return (l / 6) * (2 * a * c + 2 * b * d + a * d + b * c);
}

export type MohrPart = {
  /** площ Ω на диаграмата M в участъка */
  area: number;
  /** ордината η_c на правата диаграма M̄ под центъра на тежестта на Ω */
  ordinate: number;
};

/**
 * Преместване при огъване по Максвел–Мор и Верешчагин при E·I = const:
 * δ = Σ Ω·η_c / (E·I).
 */
export function maxwellMohrBending(parts: MohrPart[], EI: number): number {
  requirePositive(EI, "Коравината E·I");
  if (parts.length === 0) throw new Error("Няма участъци.");
  return (
    parts.reduce((sum, p) => sum + vereshchagin(p.area, p.ordinate), 0) / EI
  );
}

export type MohrBar = {
  /** нормална сила от действителния товар (опън положителен) */
  N: number;
  /** нормална сила от единичната сила */
  Nbar: number;
  /** дължина */
  l: number;
  /** модул на еластичност */
  E: number;
  /** площ на сечението */
  A: number;
};

/**
 * Преместване на възел на прътова система по Максвел–Мор:
 * δ = Σ N_i·N̄_i·l_i / (E_i·A_i).
 */
export function maxwellMohrAxial(bars: MohrBar[]): number {
  if (bars.length === 0) throw new Error("Няма пръти.");
  return bars.reduce((sum, bar) => {
    requireFinite(bar.N, "Нормалната сила");
    requireFinite(bar.Nbar, "Нормалната сила от единичната сила");
    requirePositive(bar.l, "Дължината");
    requirePositive(bar.E, "Модулът на еластичност");
    requirePositive(bar.A, "Площта");
    return sum + (bar.N * bar.Nbar * bar.l) / (bar.E * bar.A);
  }, 0);
}

export type Vector = { x: number; y: number };

/**
 * Нормалните сили в два пръта, които се събират във възел, натоварен със сила
 * `load` (оста x е надясно, оста y – нагоре). `toEnd1` и `toEnd2` са векторите
 * от възела към другия край на всеки прът (дължината им няма значение).
 * Опънът е положителен: опънатият прът дърпа възела към другия си край.
 */
export function twoBarForces(
  toEnd1: Vector,
  toEnd2: Vector,
  load: Vector,
): { N1: number; N2: number } {
  const l1 = Math.hypot(toEnd1.x, toEnd1.y);
  const l2 = Math.hypot(toEnd2.x, toEnd2.y);
  requirePositive(l1, "Дължината на прът 1");
  requirePositive(l2, "Дължината на прът 2");
  requireFinite(load.x, "Силата");
  requireFinite(load.y, "Силата");
  const e1 = { x: toEnd1.x / l1, y: toEnd1.y / l1 };
  const e2 = { x: toEnd2.x / l2, y: toEnd2.y / l2 };
  // N1·e1 + N2·e2 + load = 0
  const det = e1.x * e2.y - e1.y * e2.x;
  if (Math.abs(det) < 1e-12) {
    throw new Error("Двата пръта лежат на една права.");
  }
  return {
    N1: (-load.x * e2.y + load.y * e2.x) / det,
    N2: (-e1.x * load.y + e1.y * load.x) / det,
  };
}
