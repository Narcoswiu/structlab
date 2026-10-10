/**
 * Аналитична механика (Теоретична механика – II част, Глава 11): принцип на
 * възможните премествания, обобщени сили и уравнения на Лагранж от II род.
 *
 * Мерни единици: дължини в m, време в s, маса в kg, сили в N, моменти в N·m,
 * работа и енергия в J. Ъглите на входа са в ГРАДУСИ, когато името на полето
 * завършва на „Deg“; обобщените координати и техните производни са в rad
 * (или в m). ВНИМАНИЕ: останалите файлове в lib/engineering работят в kN.
 * Функциите за греди са линейни по товара – ако товарите са в kN, реакцията
 * също излиза в kN.
 *
 * Знаци: оста x е надясно, оста y е НАГОРЕ; ъглите и моментите са положителни
 * обратно на часовниковата стрелка. Възможната работа е положителна, когато
 * силата и преместването са в една посока. Товарите върху греда са
 * положителни НАДОЛУ, реакциите и възможните премествания – НАГОРЕ. Ъгълът на
 * махало се мери от отвеса надолу.
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

// ---------------------------------------------------------------------------
// Възможна работа и прости машини
// ---------------------------------------------------------------------------

export type WorkTerm = {
  /** проекция на силата върху избраната посока, N (или момент, N·m) */
  force: number;
  /** възможно преместване по същата посока, m (или завъртане, rad) */
  displacement: number;
};

/**
 * Сбор от възможните работи δA = Σ F·δs, J. Всяко събираемо е положително,
 * когато силата и преместването са в една посока.
 */
export function virtualWork(terms: WorkTerm[]): number {
  let sum = 0;
  for (const term of terms) {
    assertFinite(term.force, "сила");
    assertFinite(term.displacement, "преместване");
    sum += term.force * term.displacement;
  }
  return sum;
}

/**
 * Лост върху неподвижна опора. Товарът G е на рамо a от опората, силата F –
 * на рамо b от другата страна; двете сили са надолу. При завъртане на δφ
 * точката на F слиза с b·δφ, товарът се качва с a·δφ:
 * F·b·δφ − G·a·δφ = 0, значи F = G·a / b.
 * `pathRatio` е отношението на пътищата (ръка : товар) = b / a.
 */
export function leverForce(input: {
  load: number;
  loadArm: number;
  forceArm: number;
}): { force: number; pathRatio: number } {
  assertNonNegative(input.load, "товар");
  assertPositive(input.loadArm, "рамо на товара");
  assertPositive(input.forceArm, "рамо на силата");
  return {
    force: (input.load * input.loadArm) / input.forceArm,
    pathRatio: input.forceArm / input.loadArm,
  };
}

/**
 * Полиспаст (система от макари) с n носещи клона на въжето, без триене и без
 * тегло на макарите. Ако товарът се качи с δs, всеки носещ клон се скъсява с
 * δs и свободният край изминава n·δs: F·n·δs − G·δs = 0, значи F = G / n.
 * `ropePerLift` е дължината въже за единица вдигане (= n).
 */
export function pulleyBlockForce(input: { load: number; strands: number }): {
  force: number;
  ropePerLift: number;
} {
  assertNonNegative(input.load, "товар");
  if (!Number.isInteger(input.strands) || input.strands < 1) {
    throw new Error("Броят на носещите клонове трябва да е цяло число ≥ 1.");
  }
  return { force: input.load / input.strands, ropePerLift: input.strands };
}

/**
 * Момент върху барабана на лебедка, който държи товар G на въже, навито на
 * радиус r: M·δφ − G·r·δφ = 0, значи M = G·r, N·m.
 */
export function winchMoment(input: { load: number; radius: number }): number {
  assertNonNegative(input.load, "товар");
  assertPositive(input.radius, "радиус");
  return input.load * input.radius;
}

// ---------------------------------------------------------------------------
// Реакции на греди чрез възможни премествания
// ---------------------------------------------------------------------------

export type PointLoad = {
  /** абсциса на силата, m */
  x: number;
  /** големина, положителна НАДОЛУ (N или kN) */
  force: number;
};

function assertLoads(loads: PointLoad[]): void {
  for (const load of loads) {
    assertFinite(load.x, "абсциса на сила");
    assertFinite(load.force, "сила");
  }
}

/**
 * Отвесна реакция на греда върху две опори (може и с конзоли) чрез принципа на
 * възможните премествания. Опората `removed` се премахва и се заменя с
 * реакцията си R (нагоре); гредата се завърта като твърдо тяло около другата
 * опора така, че премахнатата опора да се качи с 1. Тогава
 * R·1 − Σ F_k·δy(x_k) = 0. Резултатът е положителен нагоре.
 */
export function beamReactionByVirtualWork(input: {
  supportA: number;
  supportB: number;
  loads: PointLoad[];
  removed: "A" | "B";
}): number {
  const { supportA, supportB, loads, removed } = input;
  assertFinite(supportA, "опора A");
  assertFinite(supportB, "опора B");
  if (supportB <= supportA) {
    throw new Error("Опората B трябва да е вдясно от опората A.");
  }
  assertLoads(loads);
  const span = supportB - supportA;
  let reaction = 0;
  for (const load of loads) {
    const displacement =
      removed === "A" ? (supportB - load.x) / span : (load.x - supportA) / span;
    reaction += load.force * displacement;
  }
  return reaction;
}

export type GerberLayout = {
  /** неподвижна шарнирна опора A, m */
  supportA: number;
  /** подвижна опора B (на основната част), m */
  supportB: number;
  /** става C, вдясно от B, m */
  hinge: number;
  /** подвижна опора D (на второстепенната част), m */
  supportD: number;
  /** край на гредата, ако има конзола след D (по подразбиране = D), m */
  end?: number;
};

function assertGerber(layout: GerberLayout): void {
  const { supportA, supportB, hinge, supportD } = layout;
  for (const [value, name] of [
    [supportA, "опора A"],
    [supportB, "опора B"],
    [hinge, "става C"],
    [supportD, "опора D"],
  ] as const) {
    assertFinite(value, name);
  }
  if (!(supportA < supportB && supportB < hinge && hinge < supportD)) {
    throw new Error("Редът по оста трябва да е A < B < C < D.");
  }
}

/**
 * Възможно преместване (нагоре) на точката с абсциса x от герберова греда
 * A – B – става C – D, когато отвесната връзка `removed` е премахната и тази
 * опора се качва с 1. Основната част ABC се върти около останалата си опора,
 * второстепенната част CD – около D (или около C, когато е премахната D).
 * Резултатът е безразмерен (преместване за единица преместване на опората).
 */
export function gerberVirtualDisplacement(
  layout: GerberLayout,
  removed: "A" | "B" | "D",
  x: number,
): number {
  assertGerber(layout);
  assertFinite(x, "абсциса");
  const { supportA, supportB, hinge, supportD } = layout;
  const mainSpan = supportB - supportA;
  const secondarySpan = supportD - hinge;
  if (removed === "D") {
    return x <= hinge ? 0 : (x - hinge) / secondarySpan;
  }
  const main = (position: number) =>
    removed === "A"
      ? (supportB - position) / mainSpan
      : (position - supportA) / mainSpan;
  if (x <= hinge) return main(x);
  return (main(hinge) * (supportD - x)) / secondarySpan;
}

/**
 * Отвесна реакция на герберова греда чрез възможни премествания:
 * R·1 − Σ F_k·δy(x_k) = 0. Положителна нагоре; в единицата на товарите.
 */
export function gerberReaction(
  layout: GerberLayout,
  loads: PointLoad[],
  removed: "A" | "B" | "D",
): number {
  assertLoads(loads);
  let reaction = 0;
  for (const load of loads) {
    reaction += load.force * gerberVirtualDisplacement(layout, removed, load.x);
  }
  return reaction;
}

// ---------------------------------------------------------------------------
// Обобщени сили и уравнение на Лагранж за една обобщена координата
// ---------------------------------------------------------------------------

export type AppliedForce = {
  /** проекции на силата по x и y, N */
  force: [number, number];
  /** положение на приложната точка като функция на координатата q, m */
  position: (q: number) => [number, number];
};

/**
 * Обобщена сила Q = Σ F_i · ∂r_i/∂q за една обобщена координата. Производната
 * на положението се смята числено с централна разлика със стъпка h.
 * Единица: N, ако q е дължина; N·m, ако q е ъгъл в rad.
 */
export function generalizedForce(
  forces: AppliedForce[],
  q: number,
  h = 1e-6,
): number {
  assertFinite(q, "обобщена координата");
  assertPositive(h, "стъпка");
  let sum = 0;
  for (const item of forces) {
    const [x1, y1] = item.position(q - h);
    const [x2, y2] = item.position(q + h);
    sum +=
      (item.force[0] * (x2 - x1)) / (2 * h) +
      (item.force[1] * (y2 - y1)) / (2 * h);
  }
  return sum;
}

/**
 * Обобщена сила на потенциални сили: Q = −dΠ/dq (числено, централна разлика).
 * Π е в J.
 */
export function generalizedForceFromPotential(
  potential: (q: number) => number,
  q: number,
  h = 1e-6,
): number {
  assertFinite(q, "обобщена координата");
  assertPositive(h, "стъпка");
  return -(potential(q + h) - potential(q - h)) / (2 * h);
}

/**
 * Уравнение на Лагранж от II род за ЕДНА обобщена координата, решено спрямо
 * обобщеното ускорение. От d/dt(∂T/∂q̇) − ∂T/∂q = Q следва
 *   q̈ = (Q + ∂T/∂q − (∂²T/∂q̇∂q)·q̇) / (∂²T/∂q̇²).
 * Производните на кинетичната енергия T(q, q̇) [J] се смятат числено. Q е
 * обобщената сила в текущото състояние.
 */
export function lagrangeAcceleration(
  system: {
    kinetic: (q: number, qDot: number) => number;
    force: (q: number, qDot: number) => number;
  },
  q: number,
  qDot: number,
  h = 1e-3,
): number {
  assertFinite(q, "обобщена координата");
  assertFinite(qDot, "обобщена скорост");
  assertPositive(h, "стъпка");
  const T = system.kinetic;
  const dTdq = (T(q + h, qDot) - T(q - h, qDot)) / (2 * h);
  const d2Tdv2 = (T(q, qDot + h) - 2 * T(q, qDot) + T(q, qDot - h)) / (h * h);
  const d2Tdqdv =
    (T(q + h, qDot + h) -
      T(q + h, qDot - h) -
      T(q - h, qDot + h) +
      T(q - h, qDot - h)) /
    (4 * h * h);
  if (!(d2Tdv2 > 0)) {
    throw new Error("Кинетичната енергия трябва да расте с квадрата на q̇.");
  }
  return (system.force(q, qDot) + dTdq - d2Tdqdv * qDot) / d2Tdv2;
}

// ---------------------------------------------------------------------------
// Примерите от главата
// ---------------------------------------------------------------------------

export type BlockPulleyResult = {
  /** приведена маса m₁ + m₂/2 + m₃, kg (T = ½·M·ṡ²) */
  reducedMass: number;
  /** сила на триене върху тялото при плъзгане, N */
  friction: number;
  /** обобщена сила Q_s = m₁·g − μ·m₃·g, N */
  generalizedForce: number;
  /** ускорение на товара (надолу) и на тялото, m/s²; 0, ако системата не тръгва */
  acceleration: number;
  /** сила в отвесния клон на нишката, N */
  tensionHanging: number;
  /** сила в хоризонталния клон на нишката, N */
  tensionBlock: number;
  /** тръгва ли системата от покой (m₁ > μ·m₃) */
  moves: boolean;
};

/**
 * Товар 1 (маса m₁) виси на нишка, която минава през макара 2 – еднороден
 * диск с маса m₂ (J = ½·m₂·r²; радиусът се съкращава) – и дърпа тяло 3 (маса
 * m₃) по грапава хоризонтална равнина с коефициент на триене μ. Обобщената
 * координата s е пътят на товара надолу.
 *   T = ½·(m₁ + m₂/2 + m₃)·ṡ²,   Q_s = m₁·g − μ·m₃·g,
 *   (m₁ + m₂/2 + m₃)·s̈ = Q_s.
 * Силите в нишката са от уравненията на отделните тела:
 *   S₁ = m₁·(g − a),   S₃ = m₃·a + F_тр.
 */
export function blockPulleySystem(input: {
  hangingMass: number;
  pulleyMass: number;
  blockMass: number;
  mu: number;
}): BlockPulleyResult {
  const { hangingMass, pulleyMass, blockMass, mu } = input;
  assertPositive(hangingMass, "маса на товара");
  assertNonNegative(pulleyMass, "маса на макарата");
  assertPositive(blockMass, "маса на тялото");
  assertNonNegative(mu, "коефициент на триене");
  const g = G_ACCELERATION;
  const reducedMass = hangingMass + pulleyMass / 2 + blockMass;
  const slidingFriction = mu * blockMass * g;
  const drive = hangingMass * g - slidingFriction;
  if (drive <= 0) {
    // системата остава в покой; триенето е колкото изисква равновесието
    return {
      reducedMass,
      friction: hangingMass * g,
      generalizedForce: 0,
      acceleration: 0,
      tensionHanging: hangingMass * g,
      tensionBlock: hangingMass * g,
      moves: false,
    };
  }
  const acceleration = drive / reducedMass;
  return {
    reducedMass,
    friction: slidingFriction,
    generalizedForce: drive,
    acceleration,
    tensionHanging: hangingMass * (g - acceleration),
    tensionBlock: blockMass * acceleration + slidingFriction,
    moves: true,
  };
}

/**
 * Равноускорително движение от покой: скорост v = √(2·a·s) и време t = v / a
 * след път s.
 */
export function motionFromRest(input: { acceleration: number; path: number }): {
  speed: number;
  time: number;
} {
  assertPositive(input.acceleration, "ускорение");
  assertNonNegative(input.path, "път");
  const speed = Math.sqrt(2 * input.acceleration * input.path);
  return { speed, time: speed / input.acceleration };
}

/**
 * Еднороден прът с маса m и дължина l, окачен на неподвижна ос в края си.
 *   J_O = m·l²/3,  T = ½·J_O·φ̇²,  Π = −m·g·(l/2)·cos φ,
 *   φ̈ + (3g / 2l)·sin φ = 0.
 * Връща J_O [kg·m²], k² = 3g/(2l) [s⁻²], k [rad/s] и периода на малките
 * трептения T₀ = 2π/k [s].
 */
export function rodPendulum(input: { mass: number; length: number }): {
  inertia: number;
  kSquared: number;
  k: number;
  smallPeriod: number;
} {
  assertPositive(input.mass, "маса");
  assertPositive(input.length, "дължина");
  const inertia = (input.mass * input.length ** 2) / 3;
  const kSquared = (3 * G_ACCELERATION) / (2 * input.length);
  const k = Math.sqrt(kSquared);
  return { inertia, kSquared, k, smallPeriod: (2 * Math.PI) / k };
}

/** Ъглово ускорение на пръта-махало при ъгъл φ [rad]: φ̈ = −(3g/2l)·sin φ. */
export function rodPendulumAcceleration(length: number, phi: number): number {
  assertPositive(length, "дължина");
  assertFinite(phi, "ъгъл");
  return -((3 * G_ACCELERATION) / (2 * length)) * Math.sin(phi);
}

/**
 * Големина на ъгловата скорост на пръта-махало при ъгъл φ след пускане от
 * покой при φ₀ (запазване на енергията): φ̇² = (3g/l)·(cos φ − cos φ₀).
 */
export function rodPendulumOmega(input: {
  length: number;
  phi0Deg: number;
  phiDeg: number;
}): number {
  assertPositive(input.length, "дължина");
  assertFinite(input.phi0Deg, "начален ъгъл");
  assertFinite(input.phiDeg, "ъгъл");
  const difference =
    Math.cos(input.phiDeg * RAD) - Math.cos(input.phi0Deg * RAD);
  if (difference < 0) {
    throw new Error("Прътът не достига този ъгъл при даденото пускане.");
  }
  return Math.sqrt(((3 * G_ACCELERATION) / input.length) * difference);
}

/**
 * Тяло, което се търкаля без плъзгане надолу по наклон α. Масовият инерционен
 * момент спрямо оста през масовия център е J = κ·m·r² (плътен цилиндър:
 * κ = 0,5). T = ½·(1 + κ)·m·ẋ², Q_x = m·g·sin α, значи
 * a = g·sin α / (1 + κ). `frictionShare` е F_тр / (m·g·sin α) = κ / (1 + κ).
 */
export function rollingAcceleration(input: {
  angleDeg: number;
  inertiaFactor?: number;
}): { acceleration: number; frictionShare: number } {
  const kappa = input.inertiaFactor ?? 0.5;
  assertFinite(input.angleDeg, "ъгъл на наклона");
  if (input.angleDeg < 0 || input.angleDeg >= 90) {
    throw new Error("Ъгълът на наклона трябва да е в интервала [0°, 90°).");
  }
  assertNonNegative(kappa, "коефициент на инерционния момент");
  return {
    acceleration:
      (G_ACCELERATION * Math.sin(input.angleDeg * RAD)) / (1 + kappa),
    frictionShare: kappa / (1 + kappa),
  };
}

/**
 * Равновесен ъгъл (градуси, от отвеса) на точка с тегло G на нишка под
 * хоризонтална сила F: Q_φ = l·(F·cos φ − G·sin φ) = 0, значи tg φ = F / G.
 */
export function hangingEquilibriumAngle(input: {
  weight: number;
  force: number;
}): number {
  assertPositive(input.weight, "тегло");
  assertFinite(input.force, "сила");
  return Math.atan2(input.force, input.weight) / RAD;
}

/**
 * Двойно махало (две точки на безтегловни нишки една под друга) в равновесие
 * под хоризонтална сила F върху долната точка. Две степени на свобода:
 *   Q₁ = l₁·[F·cos φ₁ − (G₁ + G₂)·sin φ₁] = 0,
 *   Q₂ = l₂·[F·cos φ₂ − G₂·sin φ₂] = 0.
 * Връща двата ъгъла в градуси; дължините не влияят.
 */
export function doublePendulumEquilibrium(input: {
  weight1: number;
  weight2: number;
  force: number;
}): { phi1Deg: number; phi2Deg: number } {
  assertPositive(input.weight1, "тегло 1");
  assertPositive(input.weight2, "тегло 2");
  assertFinite(input.force, "сила");
  return {
    phi1Deg: Math.atan2(input.force, input.weight1 + input.weight2) / RAD,
    phi2Deg: Math.atan2(input.force, input.weight2) / RAD,
  };
}

/**
 * Равновесие на товар с маса m върху отвесна пружина с коравина c [N/m].
 * Π = ½·c·x² − m·g·x (x – удължение надолу); dΠ/dx = 0 дава x = m·g / c, m.
 */
export function springEquilibrium(input: { mass: number; c: number }): number {
  assertPositive(input.mass, "маса");
  assertPositive(input.c, "коравина");
  return (input.mass * G_ACCELERATION) / input.c;
}
