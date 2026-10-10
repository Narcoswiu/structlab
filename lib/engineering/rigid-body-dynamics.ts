/**
 * Динамика на твърдо тяло и метод на кинетостатиката
 * (Теоретична механика – II част, Глава 10).
 *
 * Мерни единици: дължини в m, време в s, маса в kg, сили в N, моменти в N·m,
 * масови инерционни моменти в kg·m², ъглова скорост в rad/s, ъглово ускорение
 * в rad/s². Ъглите на входа са в ГРАДУСИ (вътре се обръщат в радиани).
 * ВНИМАНИЕ: останалите файлове в lib/engineering работят в kN. Тук силата е
 * в N, защото в m·a = ΣF масата е в kg: 1 N = 1 kg·m/s², 1 kN = 1000 N.
 *
 * Знаци: оста x е надясно, оста y е НАГОРЕ, оста z сочи към наблюдателя.
 * Ъгълът φ, ъгловата скорост ω, ъгловото ускорение ε и моментите са
 * положителни ОБРАТНО на часовниковата стрелка. Схемите в главата са избрани
 * така, че тялото да се върти в положителната посока: наклонът слиза наляво,
 * прътът е наляво от ставата, въжето слиза от лявата страна на барабана.
 * Функциите, които връщат големини (без знак), го казват изрично.
 *
 * Инерционни товари (принцип на Даламбер): главен вектор Φ = −m·a_C, приложен
 * в масовия център C, и главен момент M^Φ = −J_C·ε.
 *
 * Файлът е самостоятелен – не ползва други модули от lib/engineering.
 */

/** Земно ускорение, m/s². */
export const G_ACCELERATION = 9.81;

const RAD = Math.PI / 180;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Величината „${name}“ трябва да е крайно число.`);
  }
}

function assertPositive(value: number, name: string): void {
  assertFinite(value, name);
  if (value <= 0) {
    throw new Error(`Величината „${name}“ трябва да е положителна.`);
  }
}

function assertNonNegative(value: number, name: string): void {
  assertFinite(value, name);
  if (value < 0) {
    throw new Error(`Величината „${name}“ не може да е отрицателна.`);
  }
}

/** Плътен хомогенен диск (цилиндър) спрямо оста си: J_C = m·R²/2, kg·m². */
export function discInertia(mass: number, radius: number): number {
  assertPositive(mass, "маса");
  assertPositive(radius, "радиус");
  return (mass * radius * radius) / 2;
}

/** Тънък пръстен (тънкостенна тръба) спрямо оста си: J_C = m·R², kg·m². */
export function ringInertia(mass: number, radius: number): number {
  assertPositive(mass, "маса");
  assertPositive(radius, "радиус");
  return mass * radius * radius;
}

/** Тънък хомогенен прът спрямо ос през края му: J_O = m·l²/3, kg·m². */
export function rodInertiaAboutEnd(mass: number, length: number): number {
  assertPositive(mass, "маса");
  assertPositive(length, "дължина");
  return (mass * length * length) / 3;
}

/** Тънък хомогенен прът спрямо ос през средата му: J_C = m·l²/12, kg·m². */
export function rodInertiaAboutCentre(mass: number, length: number): number {
  assertPositive(mass, "маса");
  assertPositive(length, "дължина");
  return (mass * length * length) / 12;
}

/** Обороти в минута → ъглова скорост в rad/s: ω = π·n/30. */
export function rpmToRadPerSec(rpm: number): number {
  assertNonNegative(rpm, "обороти в минута");
  return (Math.PI * rpm) / 30;
}

export type InertiaLoads = {
  /** проекции на главния вектор Φ = −m·a_C, N (приложен в C) */
  phiX: number;
  phiY: number;
  /** главен момент спрямо C: M^Φ = −J_C·ε, N·m (+ обратно на часовниковата стрелка) */
  moment: number;
};

/**
 * Инерционни товари на тяло при равнинно движение, редуцирани в масовия
 * център C. Ускорението на C е (aCx; aCy) в m/s², ε е положително обратно на
 * часовниковата стрелка. С тези товари тялото е в „динамично равновесие“:
 * ΣF + Φ = 0, ΣM + M^Φ = 0 спрямо коя да е точка.
 */
export function inertiaLoads(input: {
  mass: number;
  aCx: number;
  aCy: number;
  inertiaC: number;
  epsilon: number;
}): InertiaLoads {
  const { mass, aCx, aCy, inertiaC, epsilon } = input;
  assertPositive(mass, "маса");
  assertFinite(aCx, "ускорение по x");
  assertFinite(aCy, "ускорение по y");
  assertNonNegative(inertiaC, "масов инерционен момент");
  assertFinite(epsilon, "ъглово ускорение");
  // „+ 0“ превръща −0 в 0, за да не излиза „минус нула“ при покой
  return {
    phiX: -mass * aCx + 0,
    phiY: -mass * aCy + 0,
    moment: -inertiaC * epsilon + 0,
  };
}

export type RollingInput = {
  /** маса, kg */
  mass: number;
  /** радиус, m */
  radius: number;
  /** ъгъл на наклона спрямо хоризонталата, градуси, 0 ≤ α < 90 */
  angleDeg: number;
  /** коефициент на триене при плъзгане (≥ 0) */
  mu: number;
  /** масов инерционен момент спрямо оста през C, kg·m² (по подразбиране плътен цилиндър m·R²/2) */
  inertiaC?: number;
};

export type RollingResult = {
  /** масов инерционен момент спрямо C, kg·m² */
  inertiaC: number;
  /** нормална реакция N = m·g·cos α, N */
  normal: number;
  /** съставка на теглото по наклона m·g·sin α, N */
  gravityAlong: number;
  /** най-малкият μ, при който тялото се търкаля без плъзгане */
  muRequired: number;
  /** true: търкаляне без плъзгане; false: търкаляне с плъзгане */
  rolls: boolean;
  /** ускорение на масовия център надолу по наклона, m/s² */
  acceleration: number;
  /** ГОЛЕМИНА на ъгловото ускорение, rad/s² */
  epsilon: number;
  /** ГОЛЕМИНА на силата на триене, N (насочена нагоре по наклона) */
  friction: number;
};

/**
 * Кръгло тяло (цилиндър, тръба), пуснато от покой по грапава наклонена равнина.
 * Ос s надолу по наклона, ос n перпендикулярно на него:
 *   n:        N = m·g·cos α
 *   s:        m·a_C = m·g·sin α − F_тр
 *   въртене:  J_C·ε = F_тр·R
 * Без плъзгане a_C = ε·R, откъдето a_C = g·sin α / (1 + J_C/(m·R²)) и
 * F_тр = J_C·a_C/R². Това е възможно само при F_тр ≤ μ·N, тоест
 * tg α ≤ μ·(1 + m·R²/J_C). Иначе тялото се плъзга: F_тр = μ·N.
 * При α = 0 тялото остава в покой.
 */
export function rollingOnIncline(input: RollingInput): RollingResult {
  const { mass, radius, angleDeg, mu } = input;
  assertPositive(mass, "маса");
  assertPositive(radius, "радиус");
  assertFinite(angleDeg, "ъгъл на наклона");
  assertNonNegative(mu, "коефициент на триене");
  if (angleDeg < 0 || angleDeg >= 90) {
    throw new Error("Ъгълът на наклона трябва да е от 0° до 90° (без 90°).");
  }
  const inertiaC = input.inertiaC ?? (mass * radius * radius) / 2;
  assertPositive(inertiaC, "масов инерционен момент");
  const G = mass * G_ACCELERATION;
  const normal = G * Math.cos(angleDeg * RAD);
  const gravityAlong = G * Math.sin(angleDeg * RAD);
  const ratio = inertiaC / (mass * radius * radius);
  const aRolling = gravityAlong / mass / (1 + ratio);
  const frictionRolling = (inertiaC * aRolling) / (radius * radius);
  const muRequired = frictionRolling / normal;
  if (muRequired <= mu) {
    return {
      inertiaC,
      normal,
      gravityAlong,
      muRequired,
      rolls: true,
      acceleration: aRolling,
      epsilon: aRolling / radius,
      friction: frictionRolling,
    };
  }
  const friction = mu * normal;
  return {
    inertiaC,
    normal,
    gravityAlong,
    muRequired,
    rolls: false,
    acceleration: (gravityAlong - friction) / mass,
    epsilon: (friction * radius) / inertiaC,
    friction,
  };
}

/**
 * Най-големият наклон (в градуси), при който кръгло тяло се търкаля без
 * плъзгане: tg α = μ·(1 + m·R²/J_C). За плътен цилиндър tg α = 3·μ.
 */
export function maxRollingAngleDeg(input: {
  mass: number;
  radius: number;
  mu: number;
  inertiaC?: number;
}): number {
  const { mass, radius, mu } = input;
  assertPositive(mass, "маса");
  assertPositive(radius, "радиус");
  assertNonNegative(mu, "коефициент на триене");
  const inertiaC = input.inertiaC ?? (mass * radius * radius) / 2;
  assertPositive(inertiaC, "масов инерционен момент");
  return Math.atan(mu * (1 + (mass * radius * radius) / inertiaC)) / RAD;
}

export type DrumResult = {
  /** масов инерционен момент на барабана спрямо оста, kg·m² */
  inertia: number;
  /** ускорение на товара надолу, m/s² */
  acceleration: number;
  /** ГОЛЕМИНА на ъгловото ускорение на барабана, rad/s² */
  epsilon: number;
  /** сила във въжето, N */
  tension: number;
  /** отвесна реакция на оста при движение, N (нагоре) */
  axleReaction: number;
  /** отвесна реакция на оста, когато товарът е задържан в покой, N */
  axleReactionStatic: number;
};

/**
 * Барабан на неподвижна хоризонтална ос, на който е навито въже с товар.
 *   товар (надолу):   m·a = m·g − S
 *   барабан:          J·ε = S·R,   a = ε·R
 * Оттук a = m·g / (m + J/R²). Оста носи теглото на барабана и силата S.
 * По подразбиране барабанът е плътен диск, J = M·R²/2.
 */
export function drumWithLoad(input: {
  drumMass: number;
  radius: number;
  loadMass: number;
  inertia?: number;
}): DrumResult {
  const { drumMass, radius, loadMass } = input;
  assertPositive(drumMass, "маса на барабана");
  assertPositive(radius, "радиус");
  assertPositive(loadMass, "маса на товара");
  const inertia = input.inertia ?? (drumMass * radius * radius) / 2;
  assertPositive(inertia, "масов инерционен момент");
  const g = G_ACCELERATION;
  const acceleration =
    (loadMass * g) / (loadMass + inertia / (radius * radius));
  const tension = loadMass * (g - acceleration);
  return {
    inertia,
    acceleration,
    epsilon: acceleration / radius,
    tension,
    axleReaction: drumMass * g + tension,
    axleReactionStatic: (drumMass + loadMass) * g,
  };
}

export type HingedRodState = {
  /** масов инерционен момент спрямо ставата, J_O = m·l²/3, kg·m² */
  inertiaO: number;
  /** ъглово ускорение, rad/s² (+ обратно на часовниковата стрелка) */
  epsilon: number;
  /** ъглова скорост, rad/s (+ обратно на часовниковата стрелка) */
  omega: number;
  /** проекции на ускорението на масовия център, m/s² (x надясно, y нагоре) */
  aCx: number;
  aCy: number;
  /** големина на ускорението на свободния край, m/s² */
  tipAcceleration: number;
  /** проекции на реакцията в ставата, N (x надясно, y нагоре) */
  reactionX: number;
  reactionY: number;
};

/**
 * Тънък хомогенен прът със става O в ДЕСНИЯ си край, пуснат от покой в
 * хоризонтално положение (прътът е наляво от O). φ е ъгълът на завъртане от
 * хоризонталата, положителен обратно на часовниковата стрелка, 0° ≤ φ ≤ 180°;
 * при φ = 90° прътът виси отвесно.
 *   J_O·ε = m·g·(l/2)·cos φ        →  ε = 3·g·cos φ / (2·l)
 *   първи интеграл (от покой)      →  ω² = 3·g·sin φ / l
 *   m·a_C = R_O + G                →  реакцията в ставата
 * Масовият център е в C = (l/2)·(−cos φ; −sin φ); тангенциалното му ускорение
 * ε·l/2 е по (sin φ; −cos φ), нормалното ω²·l/2 е към O, по (cos φ; sin φ).
 */
export function hingedRodRelease(input: {
  mass: number;
  length: number;
  phiDeg: number;
}): HingedRodState {
  const { mass, length, phiDeg } = input;
  assertPositive(mass, "маса");
  assertPositive(length, "дължина");
  assertFinite(phiDeg, "ъгъл на завъртане");
  if (phiDeg < 0 || phiDeg > 180) {
    throw new Error("Ъгълът на завъртане трябва да е от 0° до 180°.");
  }
  const g = G_ACCELERATION;
  const phi = phiDeg * RAD;
  const sin = Math.sin(phi);
  const cos = Math.cos(phi);
  const inertiaO = (mass * length * length) / 3;
  const epsilon = (mass * g * (length / 2) * cos) / inertiaO;
  const omegaSquared = Math.max(0, (3 * g * sin) / length);
  const aTau = (epsilon * length) / 2;
  const aN = (omegaSquared * length) / 2;
  const aCx = aTau * sin + aN * cos;
  const aCy = -aTau * cos + aN * sin;
  return {
    inertiaO,
    epsilon,
    omega: Math.sqrt(omegaSquared),
    aCx,
    aCy,
    tipAcceleration: 2 * Math.hypot(aTau, aN),
    reactionX: mass * aCx,
    reactionY: mass * (aCy + g),
  };
}

/**
 * Физично махало: тяло с маса m на хоризонтална ос O, масовият център е на
 * разстояние d от оста, J_O е масовият инерционен момент спрямо оста.
 * Малки трептения: J_O·φ'' = −m·g·d·φ, период T₀ = 2π·√(J_O/(m·g·d)).
 * Приведената дължина l_пр = J_O/(m·d) е дължината на математично махало със
 * същия период.
 */
export function physicalPendulum(input: {
  inertiaO: number;
  mass: number;
  distance: number;
}): { period: number; reducedLength: number } {
  const { inertiaO, mass, distance } = input;
  assertPositive(inertiaO, "масов инерционен момент");
  assertPositive(mass, "маса");
  assertPositive(distance, "разстояние до масовия център");
  return {
    period:
      2 * Math.PI * Math.sqrt(inertiaO / (mass * G_ACCELERATION * distance)),
    reducedLength: inertiaO / (mass * distance),
  };
}

export type ShaftReactions = {
  /** тегло на ротора, N */
  weight: number;
  /** статични реакции в лагерите A и B, N (нагоре) */
  staticA: number;
  staticB: number;
  /** големина на инерционната сила Φ = m·e·ω², N (върти се с вала) */
  inertiaForce: number;
  /** големини на динамичните реакции (добавките от Φ), N */
  dynamicA: number;
  dynamicB: number;
  /** най-голяма и най-малка отвесна реакция в A за един оборот, N (+ нагоре) */
  maxA: number;
  minA: number;
  /** най-голяма и най-малка отвесна реакция в B за един оборот, N (+ нагоре) */
  maxB: number;
  minB: number;
};

/**
 * Ротор с маса m върху хоризонтален вал на два лагера A и B (разстояние span).
 * Роторът е на разстояние position от A; масовият му център е на разстояние
 * eccentricity от оста на въртене; ъгловата скорост omega е постоянна (ε = 0).
 * Статичните реакции са от теглото (правилото на лоста). Инерционната сила
 * Φ = m·e·ω² е насочена от оста към масовия център и се върти с вала; тя се
 * разпределя между лагерите по същото правило – това са динамичните реакции.
 * При ω = 0 или e = 0 остават само статичните. Масата на вала се пренебрегва.
 */
export function shaftReactions(input: {
  mass: number;
  eccentricity: number;
  omega: number;
  span: number;
  position: number;
}): ShaftReactions {
  const { mass, eccentricity, omega, span, position } = input;
  assertPositive(mass, "маса");
  assertNonNegative(eccentricity, "разстояние на масовия център от оста");
  assertFinite(omega, "ъглова скорост");
  assertPositive(span, "разстояние между лагерите");
  assertFinite(position, "положение на ротора");
  if (position < 0 || position > span) {
    throw new Error("Роторът трябва да е между двата лагера.");
  }
  const weight = mass * G_ACCELERATION;
  const shareA = (span - position) / span;
  const shareB = position / span;
  const inertiaForce = mass * eccentricity * omega * omega;
  const staticA = weight * shareA;
  const staticB = weight * shareB;
  const dynamicA = inertiaForce * shareA;
  const dynamicB = inertiaForce * shareB;
  return {
    weight,
    staticA,
    staticB,
    inertiaForce,
    dynamicA,
    dynamicB,
    maxA: staticA + dynamicA,
    minA: staticA - dynamicA,
    maxB: staticB + dynamicB,
    minB: staticB - dynamicB,
  };
}

export type TranslatingBlock = {
  /** тегло, N */
  weight: number;
  /** големина на инерционната сила Φ = m·a, N (обратно на ускорението) */
  inertiaForce: number;
  /** нормална реакция, N */
  normal: number;
  /** нужна сила на триене, N */
  frictionNeeded: number;
  /** най-голямата възможна сила на триене μ·N, N */
  frictionLimit: number;
  /** изместване на нормалната реакция от средата на основата, m (обратно на ускорението) */
  normalShift: number;
  /** ускорение, над което тялото се плъзга: μ·g, m/s² */
  slideAcceleration: number;
  /** ускорение, над което тялото се преобръща: g·b/h, m/s² */
  tipAcceleration: number;
  slides: boolean;
  tips: boolean;
};

/**
 * Правоъгълно хомогенно тяло (височина height, основа width) върху
 * хоризонтална платформа, която се движи транслационно с ускорение с големина
 * acceleration (потегляне или спиране). Докато тялото стои върху платформата,
 * то има същото ускорение – транслация, ε = 0:
 *   m·a = F_тр,   N = m·g,   ΣM_C = 0  →  N·x = F_тр·h/2.
 * x е изместването на N от средата на основата. Тялото се плъзга при
 * F_тр > μ·N (a > μ·g) и се преобръща при x > b/2 (a > g·b/h).
 */
export function translatingBlock(input: {
  mass: number;
  height: number;
  width: number;
  acceleration: number;
  mu: number;
}): TranslatingBlock {
  const { mass, height, width, acceleration, mu } = input;
  assertPositive(mass, "маса");
  assertPositive(height, "височина");
  assertPositive(width, "ширина на основата");
  assertNonNegative(acceleration, "ускорение");
  assertNonNegative(mu, "коефициент на триене");
  const g = G_ACCELERATION;
  const weight = mass * g;
  const inertiaForce = mass * acceleration;
  const normalShift = (inertiaForce * height) / 2 / weight;
  return {
    weight,
    inertiaForce,
    normal: weight,
    frictionNeeded: inertiaForce,
    frictionLimit: mu * weight,
    normalShift,
    slideAcceleration: mu * g,
    tipAcceleration: (g * width) / height,
    slides: inertiaForce > mu * weight,
    tips: normalShift > width / 2,
  };
}
