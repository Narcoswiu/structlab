/**
 * Аналогия на Мор за еластичната линия (метод на фиктивната, спрегнатата греда)
 * и влияние на напречната сила върху провисването.
 *
 * Идеята: E·I·w″ = −M има същия вид като M″ = −q. Затова, ако една фиктивна
 * греда се натовари с разпределен товар q_f = M/(E·I), то
 *   напречната ѝ сила  Q_f(x) = φ(x)  – ъгълът на завъртане на действителната греда,
 *   огъващият ѝ момент M_f(x) = w(x)  – провисването на действителната греда,
 * стига опорите на фиктивната греда да отговарят на граничните условия:
 *   шарнирна опора в края ↔ шарнирна опора в края; запъване ↔ свободен край;
 *   междинна опора ↔ става.
 *
 * Мерни единици:
 *   дължини по оста в m, моменти в kN·m, коравина E·I в kN·m²;
 *   фиктивният товар M/(E·I) е в 1/m, Q_f = φ е в радиани, M_f = w е в МЕТРИ.
 *   За срязването: сили в kN, G в kN/cm², A в cm² (G·A е в kN) → провисване в m.
 *
 * Знаци (както в целия учебник, Глава 7):
 *   M > 0 опъва долните влакна; провисването w е положително НАДОЛУ;
 *   φ = w′ е положителен по часовниковата стрелка; Q > 0 върти отрязаната част
 *   по часовниковата стрелка.
 *   Фиктивният товар е положителен НАДОЛУ: където M > 0 (диаграмата е под оста),
 *   той сочи надолу; където M < 0, сочи нагоре.
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

/** Характерна точка от греда – за правилата за спрегнатата греда. */
export type BeamPoint =
  /** шарнирна опора в края на гредата: w = 0, φ ≠ 0 */
  | "end-support"
  /** запъване: w = 0, φ = 0 */
  | "fixed-end"
  /** свободен край: w ≠ 0, φ ≠ 0 */
  | "free-end"
  /** междинна опора: w = 0, φ е еднакъв отляво и отдясно */
  | "inner-support"
  /** междинна става: w ≠ 0, φ има скок */
  | "inner-hinge";

/**
 * Правило за спрегнатата (фиктивната) греда: какво стои на мястото на дадена
 * точка от действителната греда. Правилото е взаимно – приложено два пъти,
 * връща изходната точка.
 */
export function conjugatePoint(real: BeamPoint): BeamPoint {
  switch (real) {
    case "end-support":
      return "end-support";
    case "fixed-end":
      return "free-end";
    case "free-end":
      return "fixed-end";
    case "inner-support":
      return "inner-hinge";
    case "inner-hinge":
      return "inner-support";
    default:
      throw new Error("Непозната точка от гредата.");
  }
}

/**
 * Участък от диаграмата M на действителната греда с постоянна коравина.
 * В участъка M е полином най-много от втора степен: права (без `mMid`) или
 * квадратна парабола, зададена с ординатата в средата на участъка.
 */
export type MomentPiece = {
  /** начало и край на участъка, m */
  x1: number;
  x2: number;
  /** M в началото и в края, kN·m (със знака си) */
  m1: number;
  m2: number;
  /** M в средата на участъка, kN·m; ако липсва – права линия */
  mMid?: number;
  /** коравина на огъване в участъка, kN·m² */
  EI: number;
};

/** Как е подпряна ДЕЙСТВИТЕЛНАТА греда. */
export type RealSupport =
  /** проста греда с опори в двата края → фиктивната също е проста греда */
  | "simple"
  /** конзола, запъната в левия край → фиктивната е запъната в десния */
  | "fixed-left"
  /** конзола, запъната в десния край → фиктивната е запъната в левия */
  | "fixed-right";

export type MohrBeam = {
  /** дължина, m */
  length: number;
  support: RealSupport;
  pieces: MomentPiece[];
};

/** Приведена ордината при стъпаловидна коравина: M·(E·I)₀/(E·I). */
export function reducedMoment(M: number, EI: number, EIref: number): number {
  requireFinite(M, "Моментът");
  requirePositive(EI, "Коравината E·I");
  requirePositive(EIref, "Основната коравина");
  return (M * EIref) / EI;
}

/** Коефициенти на q_f(t) = c0 + c1·t + c2·t², t = x − x1. */
function coefficients(piece: MomentPiece) {
  const L = piece.x2 - piece.x1;
  const q1 = piece.m1 / piece.EI;
  const q2 = piece.m2 / piece.EI;
  const qm = piece.mMid === undefined ? (q1 + q2) / 2 : piece.mMid / piece.EI;
  return {
    c0: q1,
    c1: (-3 * q1 + 4 * qm - q2) / L,
    c2: (2 * (q1 - 2 * qm + q2)) / L ** 2,
  };
}

/** Площта на фиктивния товар от началото на участъка до t и статичният ѝ момент спрямо началото. */
function partial(piece: MomentPiece, t: number) {
  const { c0, c1, c2 } = coefficients(piece);
  return {
    area: c0 * t + (c1 * t ** 2) / 2 + (c2 * t ** 3) / 3,
    moment: (c0 * t ** 2) / 2 + (c1 * t ** 3) / 3 + (c2 * t ** 4) / 4,
  };
}

function validate(beam: MohrBeam): void {
  requirePositive(beam.length, "Дължината");
  if (beam.pieces.length === 0) {
    throw new Error("Диаграмата M трябва да има поне един участък.");
  }
  for (const piece of beam.pieces) {
    requireFinite(piece.m1, "Моментът");
    requireFinite(piece.m2, "Моментът");
    if (piece.mMid !== undefined) requireFinite(piece.mMid, "Моментът");
    requirePositive(piece.EI, "Коравината E·I");
    if (!(piece.x1 >= 0 && piece.x2 <= beam.length && piece.x1 < piece.x2)) {
      throw new Error("Участъкът трябва да е вътре в гредата и x1 < x2.");
    }
  }
}

function requireSection(beam: MohrBeam, x: number): void {
  if (!(x >= 0 && x <= beam.length)) throw new Error("Сечение извън гредата.");
}

/**
 * Фиктивният товар M/(E·I) в сечение x, 1/m (положителен надолу).
 * На граница между участъци `side` избира лявата или дясната стойност.
 */
export function fictitiousLoadAt(
  beam: MohrBeam,
  x: number,
  side: "left" | "right" = "right",
): number {
  validate(beam);
  requireSection(beam, x);
  const piece = beam.pieces.find((p) =>
    side === "right" ? x >= p.x1 && x < p.x2 : x > p.x1 && x <= p.x2,
  );
  if (!piece) return 0;
  const { c0, c1, c2 } = coefficients(piece);
  const t = x - piece.x1;
  return c0 + c1 * t + c2 * t ** 2;
}

/**
 * Равнодействащата на фиктивния товар вляво от сечение x (положителна надолу,
 * в радиани) и моментът ѝ спрямо сечението (в m).
 */
function leftOf(beam: MohrBeam, x: number) {
  let area = 0;
  let moment = 0;
  for (const piece of beam.pieces) {
    if (x <= piece.x1) continue;
    const t = Math.min(x, piece.x2) - piece.x1;
    const part = partial(piece, t);
    area += part.area;
    // рамото на площта спрямо сечението: (x − x1) − разстоянието на центъра от x1
    moment += part.area * (x - piece.x1) - part.moment;
  }
  return { area, moment };
}

export type FictitiousResultant = {
  /** площта на фиктивния товар ∫M/(E·I)dx, rad (положителна надолу) */
  omega: number;
  /** абсциса на центъра на тежестта ѝ от левия край, m (NaN при нулева площ) */
  xc: number;
};

/** Равнодействаща на целия фиктивен товар и мястото ѝ. */
export function fictitiousResultant(beam: MohrBeam): FictitiousResultant {
  validate(beam);
  const all = leftOf(beam, beam.length);
  const omega = all.area;
  return {
    omega,
    xc: omega === 0 ? Number.NaN : beam.length - all.moment / omega,
  };
}

/**
 * Опорни реакции на фиктивната греда, когато действителната е проста греда
 * (положителни НАГОРЕ, в радиани). A_f е ъгълът φ при лявата опора,
 * а −B_f – ъгълът при дясната.
 */
export function fictitiousReactions(beam: MohrBeam): { A: number; B: number } {
  validate(beam);
  if (beam.support !== "simple") {
    throw new Error("Опорни реакции в двата края има само простата греда.");
  }
  const all = leftOf(beam, beam.length);
  // Σ моменти спрямо десния край: A_f·l = моментът на товара спрямо десния край
  const A = all.moment / beam.length;
  return { A, B: all.area - A };
}

/**
 * Ъгъл на завъртане φ(x) = Q_f(x), rad (по часовниковата стрелка положителен).
 */
export function slopeAt(beam: MohrBeam, x: number): number {
  validate(beam);
  requireSection(beam, x);
  const left = leftOf(beam, x);
  if (beam.support === "simple") {
    return fictitiousReactions(beam).A - left.area;
  }
  if (beam.support === "fixed-left") {
    // фиктивната греда е свободна вляво: вляво от сечението е само товарът
    return -left.area;
  }
  // фиктивната греда е свободна вдясно: гледа се дясната част
  return leftOf(beam, beam.length).area - left.area;
}

/**
 * Провисване w(x) = M_f(x), m (надолу положително).
 */
export function deflectionAt(beam: MohrBeam, x: number): number {
  validate(beam);
  requireSection(beam, x);
  const left = leftOf(beam, x);
  if (beam.support === "simple") {
    return fictitiousReactions(beam).A * x - left.moment;
  }
  if (beam.support === "fixed-left") {
    return -left.moment;
  }
  // дясната част: −∫ q_f(s)·(s − x) ds от x до l
  const all = leftOf(beam, beam.length);
  const aboutX = all.area * (x - beam.length) + all.moment; // момент на целия товар спрямо x (плюс = вляво от x)
  return aboutX - left.moment;
}

/**
 * Сечението между a и b, в което φ = Q_f = 0 – там провисването има екстремум
 * (както M има екстремум при Q = 0). Търси се с деление на две; в краищата на
 * интервала φ трябва да има различни знаци.
 */
export function zeroSlopeSection(beam: MohrBeam, a: number, b: number): number {
  validate(beam);
  requireSection(beam, a);
  requireSection(beam, b);
  let lo = a;
  let hi = b;
  let fLo = slopeAt(beam, lo);
  const fHi = slopeAt(beam, hi);
  if (fLo === 0) return lo;
  if (fHi === 0) return hi;
  if (fLo * fHi > 0) {
    throw new Error("В интервала ъгълът на завъртане не сменя знака си.");
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = slopeAt(beam, mid);
    if (fMid === 0) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/* ------------------------------------------------------------------ */
/* Влияние на напречната сила върху провисването                       */
/* ------------------------------------------------------------------ */

/** Коефициент на формата k за правоъгълно сечение: 6/5 = 1,2. */
export const SHEAR_COEFFICIENT_RECTANGLE = 1.2;

/**
 * Допълнително провисване от срязване по интеграла на Максвел–Мор:
 *   f_Q = k·∫Q·Q̄ dx / (G·A).
 * `integral` е ∫Q·Q̄ dx в kN·m (Q̄ е безразмерна), G в kN/cm², A в cm² → m.
 */
export function shearDeflection(
  k: number,
  integral: number,
  G: number,
  A: number,
): number {
  requirePositive(k, "Коефициентът k");
  requireFinite(integral, "Интегралът");
  requirePositive(G, "Модулът на срязване");
  requirePositive(A, "Площта");
  return (k * integral) / (G * A);
}

export type ShearCase =
  /** проста греда, сила F в средата: ∫Q·Q̄ dx = F·l/4 */
  | "simple-force-mid"
  /** проста греда, равномерен товар q: ∫Q·Q̄ dx = q·l²/8 */
  | "simple-distributed"
  /** конзола, сила F в края: ∫Q·Q̄ dx = F·l */
  | "cantilever-force"
  /** конзола, равномерен товар q: ∫Q·Q̄ dx = q·l²/2 */
  | "cantilever-distributed";

/**
 * Провисване от срязване за типовите случаи – в средата на простата греда или
 * в свободния край на конзолата. `load` е F [kN] или q [kN/m], `l` в m.
 */
export function standardShearDeflection(
  kind: ShearCase,
  load: number,
  l: number,
  k: number,
  G: number,
  A: number,
): number {
  requireFinite(load, "Товарът");
  requirePositive(l, "Дължината");
  const integral = {
    "simple-force-mid": (load * l) / 4,
    "simple-distributed": (load * l ** 2) / 8,
    "cantilever-force": load * l,
    "cantilever-distributed": (load * l ** 2) / 2,
  }[kind];
  if (integral === undefined) throw new Error("Непознат типов случай.");
  return shearDeflection(k, integral, G, A);
}

/**
 * Проста греда: провисването от срязване в сечение с огъващ момент M [kN·m] е
 * w_Q = k·M/(G·A), защото w_Q′ = k·Q/(G·A) = k·M′/(G·A) и в опорите M = 0.
 */
export function shearDeflectionSimpleBeam(
  k: number,
  M: number,
  G: number,
  A: number,
): number {
  return shearDeflection(k, M, G, A);
}

/**
 * Отношението f_Q / f_M за проста греда с ПРАВОЪГЪЛНО сечение и сила в средата:
 *   12·k·E·I/(G·A·l²) = k·(E/G)·(h/l)².
 * h и l са в една и съща мерна единица; E и G – също.
 */
export function rectangleShearShareMidForce(
  k: number,
  E: number,
  G: number,
  h: number,
  l: number,
): number {
  requirePositive(k, "Коефициентът k");
  requirePositive(E, "Модулът на еластичност");
  requirePositive(G, "Модулът на срязване");
  requirePositive(h, "Височината");
  requirePositive(l, "Отворът");
  return k * (E / G) * (h / l) ** 2;
}
