/**
 * Кинетична енергия и теорема за изменението ѝ
 * (Теоретична механика – II част, Глава 9).
 *
 * Мерни единици: дължини в m, време в s, маса в kg, сили в N, моменти в N·m,
 * работа и енергия в J (1 J = 1 N·m), ъглова скорост в rad/s, масов
 * инерционен момент в kg·m². Ъгълът на наклон е на входа в ГРАДУСИ.
 * ВНИМАНИЕ: останалите файлове в lib/engineering работят в kN. Тук силата е
 * в N; 1 kN = 1000 N и 1 kJ = 1 kN·m.
 *
 * Знаци: оста x е надясно, оста y е НАГОРЕ; ъгловата скорост е положителна
 * обратно на часовниковата стрелка. В кинетичната енергия влиза ω², затова
 * функциите за търкаляне връщат ГОЛЕМИНАТА на ω – знакът зависи от посоката
 * на търкаляне (надясно: ω < 0). Работата е положителна, когато силата е по
 * посоката на преместването.
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

function assertInclineAngle(angleDeg: number): void {
  assertFinite(angleDeg, "ъгъл на наклона");
  if (angleDeg <= 0 || angleDeg >= 90) {
    throw new Error("Ъгълът на наклона трябва да е между 0° и 90°.");
  }
}

/** Кинетична енергия на материална точка (или на тяло при транслация): T = m·v²/2, J. */
export function kineticEnergyPoint(mass: number, speed: number): number {
  assertPositive(mass, "маса");
  assertFinite(speed, "скорост");
  return (mass * speed * speed) / 2;
}

/** Кинетична енергия при ротация около неподвижна ос: T = J·ω²/2, J. */
export function kineticEnergyRotation(inertia: number, omega: number): number {
  assertPositive(inertia, "масов инерционен момент");
  assertFinite(omega, "ъглова скорост");
  return (inertia * omega * omega) / 2;
}

export type PlaneEnergy = {
  /** дял на движението на масовия център m·v_C²/2, J */
  translational: number;
  /** дял на въртенето около масовия център J_C·ω²/2, J */
  rotational: number;
  /** T = m·v_C²/2 + J_C·ω²/2, J */
  total: number;
};

/**
 * Кинетична енергия на тяло при равнинно движение (теорема на Кьониг):
 * T = m·v_C²/2 + J_C·ω²/2. v_C е скоростта на масовия център, J_C е масовият
 * инерционен момент спрямо оста през него.
 */
export function kineticEnergyPlane(input: {
  mass: number;
  centreSpeed: number;
  centralInertia: number;
  omega: number;
}): PlaneEnergy {
  const translational = kineticEnergyPoint(input.mass, input.centreSpeed);
  const rotational = kineticEnergyRotation(input.centralInertia, input.omega);
  return { translational, rotational, total: translational + rotational };
}

/** Плътен еднороден диск (цилиндър), ос през центъра: J = m·r²/2, kg·m². */
export function solidDiscInertia(mass: number, radius: number): number {
  assertPositive(mass, "маса");
  assertPositive(radius, "радиус");
  return (mass * radius * radius) / 2;
}

/** Тънък пръстен (тънкостенна тръба), ос през центъра: J = m·r², kg·m². */
export function thinRingInertia(mass: number, radius: number): number {
  assertPositive(mass, "маса");
  assertPositive(radius, "радиус");
  return mass * radius * radius;
}

/** Тънък еднороден прът, ос през края, перпендикулярна на него: J = m·l²/3, kg·m². */
export function rodAboutEndInertia(mass: number, length: number): number {
  assertPositive(mass, "маса");
  assertPositive(length, "дължина");
  return (mass * length * length) / 3;
}

/** Обороти в минута → rad/s: ω = π·n/30. */
export function rpmToRadPerSec(rpm: number): number {
  assertFinite(rpm, "обороти в минута");
  return (Math.PI * rpm) / 30;
}

/**
 * Теорема за кинетичната енергия за система с една степен на свобода, чиято
 * енергия е T = m_пр·v²/2: m_пр·v²/2 − m_пр·v0²/2 = ΣA. Връща v ≥ 0 в m/s.
 * Ако работата е толкова отрицателна, че системата спира преди края, хвърля
 * грешка.
 */
export function speedFromWork(input: {
  reducedMass: number;
  work: number;
  v0?: number;
}): number {
  const v0 = input.v0 ?? 0;
  assertPositive(input.reducedMass, "приведена маса");
  assertFinite(input.work, "работа");
  assertNonNegative(v0, "начална скорост");
  const squared = v0 * v0 + (2 * input.work) / input.reducedMass;
  if (squared < -1e-12) {
    throw new Error("Системата спира, преди да измине зададения път.");
  }
  return Math.sqrt(Math.max(0, squared));
}

export type InclineSlide = {
  /** слизане по височина h = l·sin α, m */
  height: number;
  /** нормална реакция N = m·g·cos α, N */
  normal: number;
  /** големина на силата на триене μ·N, N */
  friction: number;
  /** работа на теглото +m·g·h, J */
  workGravity: number;
  /** работа на триенето −μ·N·l, J */
  workFriction: number;
  /** сбор от работите, J (нормалната реакция не върши работа) */
  workTotal: number;
  /** скорост в края на наклона, m/s */
  speed: number;
};

/**
 * Тяло (материална точка) се плъзга НАДОЛУ по грапав наклон на път l с
 * начална скорост v0 ≥ 0. Теоремата: m·v²/2 − m·v0²/2 = m·g·h − μ·N·l.
 */
export function slideOnIncline(input: {
  mass: number;
  angleDeg: number;
  length: number;
  mu: number;
  v0?: number;
}): InclineSlide {
  const { mass, angleDeg, length, mu } = input;
  assertPositive(mass, "маса");
  assertInclineAngle(angleDeg);
  assertPositive(length, "дължина на наклона");
  assertNonNegative(mu, "коефициент на триене");
  const G = mass * G_ACCELERATION;
  const height = length * Math.sin(angleDeg * RAD);
  const normal = G * Math.cos(angleDeg * RAD);
  const friction = mu * normal;
  const workGravity = G * height;
  const workFriction = -friction * length;
  const workTotal = workGravity + workFriction;
  const speed = speedFromWork({
    reducedMass: mass,
    work: workTotal,
    v0: input.v0,
  });
  return {
    height,
    normal,
    friction,
    workGravity,
    workFriction,
    workTotal,
    speed,
  };
}

/**
 * Път до спиране при плъзгане по хоризонтална грапава равнина:
 * 0 − m·v0²/2 = −μ·m·g·d, значи d = v0²/(2·μ·g), m. Масата се съкращава.
 */
export function stoppingDistance(v0: number, mu: number): number {
  assertNonNegative(v0, "начална скорост");
  assertPositive(mu, "коефициент на триене");
  return (v0 * v0) / (2 * mu * G_ACCELERATION);
}

export type LoadAndDrum = {
  /** приведена маса m + J/r², kg */
  reducedMass: number;
  /** сбор от работите m·g·h − M_тр·h/r, J */
  work: number;
  /** скорост на товара след път h, m/s */
  speed: number;
  /** големина на ъгловата скорост на барабана v/r, rad/s */
  omega: number;
  /** ускорение на товара, m/s² */
  acceleration: number;
  /** сила във въжето S = m·(g − a), N */
  tension: number;
};

/**
 * Товар с маса m виси на неразтегливо въже, навито на барабан с масов
 * инерционен момент J и радиус r, и тръгва от покой надолу. В оста може да
 * действа постоянен момент на триене M_тр ≥ 0.
 *   T = (m + J/r²)·v²/2,  ΣA = m·g·h − M_тр·h/r.
 */
export function loadAndDrum(input: {
  loadMass: number;
  drumInertia: number;
  drumRadius: number;
  drop: number;
  frictionMoment?: number;
}): LoadAndDrum {
  const { loadMass, drumInertia, drumRadius, drop } = input;
  const frictionMoment = input.frictionMoment ?? 0;
  assertPositive(loadMass, "маса на товара");
  assertPositive(drumInertia, "масов инерционен момент на барабана");
  assertPositive(drumRadius, "радиус на барабана");
  assertPositive(drop, "път на товара");
  assertNonNegative(frictionMoment, "момент на триене");
  const drive = loadMass * G_ACCELERATION - frictionMoment / drumRadius;
  if (drive <= 0) {
    throw new Error("Моментът на триене задържа товара – движение няма.");
  }
  const reducedMass = loadMass + drumInertia / (drumRadius * drumRadius);
  const work = drive * drop;
  const speed = speedFromWork({ reducedMass, work });
  const acceleration = drive / reducedMass;
  return {
    reducedMass,
    work,
    speed,
    omega: speed / drumRadius,
    acceleration,
    tension: loadMass * (G_ACCELERATION - acceleration),
  };
}

export type LoadPulleyRoller = {
  /** J на макарата (плътен диск), kg·m² */
  pulleyInertia: number;
  /** J_C на цилиндъра (плътен), kg·m² */
  rollerInertia: number;
  /** приведена маса m1 + m2/2 + 3·m3/2, kg */
  reducedMass: number;
  /** работа на теглото на товара, J */
  workGravity: number;
  /** ъгъл на завъртане на макарата s/r2, rad */
  pulleyAngle: number;
  /** работа на момента на триене −M_тр·φ, J */
  workFriction: number;
  /** сбор от работите, J */
  workTotal: number;
  /** скорост на товара и на оста на цилиндъра, m/s */
  speed: number;
  /** големина на ъгловата скорост на макарата, rad/s */
  pulleyOmega: number;
  /** големина на ъгловата скорост на цилиндъра, rad/s */
  rollerOmega: number;
  /** ускорение на товара, m/s² */
  acceleration: number;
  /** сила в отвесния клон на нишката (при товара), N */
  tensionLoad: number;
  /** сила в хоризонталния клон на нишката (при цилиндъра), N */
  tensionRoller: number;
  /** сила на триене под цилиндъра, нужна за търкаляне без плъзгане, N */
  rollerFriction: number;
  /** най-малък коефициент на триене под цилиндъра */
  muRequired: number;
  /** дялове на кинетичната енергия: товар, макара, цилиндър, J */
  energies: { load: number; pulley: number; roller: number };
};

/**
 * Система „товар – макара – търкалящ се цилиндър“. Товарът (m1) виси и слиза
 * на път s от покой. Нишката минава през макара – плътен диск (m2, r2) на
 * неподвижна ос с момент на триене M_тр – и е закачена за оста на плътен
 * цилиндър (m3, r3), който се търкаля без плъзгане по хоризонтална равнина.
 *   T = v²/2 · (m1 + m2/2 + m3 + m3/2),  ΣA = m1·g·s − M_тр·s/r2.
 */
export function loadPulleyRoller(input: {
  loadMass: number;
  pulleyMass: number;
  pulleyRadius: number;
  rollerMass: number;
  rollerRadius: number;
  distance: number;
  frictionMoment?: number;
}): LoadPulleyRoller {
  const {
    loadMass,
    pulleyMass,
    pulleyRadius,
    rollerMass,
    rollerRadius,
    distance,
  } = input;
  const frictionMoment = input.frictionMoment ?? 0;
  assertPositive(loadMass, "маса на товара");
  assertPositive(distance, "път на товара");
  assertNonNegative(frictionMoment, "момент на триене");
  const pulleyInertia = solidDiscInertia(pulleyMass, pulleyRadius);
  const rollerInertia = solidDiscInertia(rollerMass, rollerRadius);
  const drive = loadMass * G_ACCELERATION - frictionMoment / pulleyRadius;
  if (drive <= 0) {
    throw new Error("Моментът на триене задържа товара – движение няма.");
  }
  const reducedMass =
    loadMass +
    pulleyInertia / (pulleyRadius * pulleyRadius) +
    rollerMass +
    rollerInertia / (rollerRadius * rollerRadius);
  const workGravity = loadMass * G_ACCELERATION * distance;
  const pulleyAngle = distance / pulleyRadius;
  const workFriction = -frictionMoment * pulleyAngle;
  const workTotal = workGravity + workFriction;
  const speed = speedFromWork({ reducedMass, work: workTotal });
  const acceleration = drive / reducedMass;
  const pulleyOmega = speed / pulleyRadius;
  const rollerOmega = speed / rollerRadius;
  const rollerFriction =
    (rollerInertia * acceleration) / (rollerRadius * rollerRadius);
  return {
    pulleyInertia,
    rollerInertia,
    reducedMass,
    workGravity,
    pulleyAngle,
    workFriction,
    workTotal,
    speed,
    pulleyOmega,
    rollerOmega,
    acceleration,
    tensionLoad: loadMass * (G_ACCELERATION - acceleration),
    tensionRoller: rollerMass * acceleration + rollerFriction,
    rollerFriction,
    muRequired: rollerFriction / (rollerMass * G_ACCELERATION),
    energies: {
      load: kineticEnergyPoint(loadMass, speed),
      pulley: kineticEnergyRotation(pulleyInertia, pulleyOmega),
      roller: kineticEnergyPlane({
        mass: rollerMass,
        centreSpeed: speed,
        centralInertia: rollerInertia,
        omega: rollerOmega,
      }).total,
    },
  };
}

/**
 * Ускорение на центъра при търкаляне без плъзгане надолу по наклон:
 * a_C = g·sin α / (1 + J_C/(m·r²)). Параметърът inertiaRatio е J_C/(m·r²):
 * 1/2 за плътен цилиндър, 1 за тънък пръстен, 0 за плъзгане без триене.
 */
export function rollingAcceleration(
  angleDeg: number,
  inertiaRatio: number,
): number {
  assertInclineAngle(angleDeg);
  assertNonNegative(inertiaRatio, "отношение J_C/(m·r²)");
  return (G_ACCELERATION * Math.sin(angleDeg * RAD)) / (1 + inertiaRatio);
}

export type RollingDown = {
  /** слизане по височина h = s·sin α, m */
  height: number;
  /** работа на теглото m·g·h, J */
  work: number;
  /** скорост на центъра, m/s */
  speed: number;
  /** големина на ъгловата скорост v_C/r, rad/s */
  omega: number;
  /** ускорение на центъра, m/s² */
  acceleration: number;
  /** дялове на кинетичната енергия, J */
  energy: PlaneEnergy;
  /** нормална реакция m·g·cos α, N */
  normal: number;
  /** сила на триене, нужна за търкаляне без плъзгане (нагоре по наклона), N */
  friction: number;
  /** най-малък коефициент на триене, при който няма плъзгане */
  muRequired: number;
};

/**
 * Кръгло тяло (маса m, радиус r, J_C спрямо оста през центъра) се търкаля без
 * плъзгане надолу по наклон на път s от покой. Работа върши само теглото:
 *   m·v_C²/2 + J_C·(v_C/r)²/2 = m·g·s·sin α.
 */
export function rollingDownIncline(input: {
  mass: number;
  radius: number;
  centralInertia: number;
  angleDeg: number;
  distance: number;
}): RollingDown {
  const { mass, radius, centralInertia, angleDeg, distance } = input;
  assertPositive(mass, "маса");
  assertPositive(radius, "радиус");
  assertPositive(centralInertia, "масов инерционен момент");
  assertInclineAngle(angleDeg);
  assertPositive(distance, "път");
  const G = mass * G_ACCELERATION;
  const height = distance * Math.sin(angleDeg * RAD);
  const work = G * height;
  const reducedMass = mass + centralInertia / (radius * radius);
  const speed = speedFromWork({ reducedMass, work });
  const omega = speed / radius;
  const acceleration = rollingAcceleration(
    angleDeg,
    centralInertia / (mass * radius * radius),
  );
  const normal = G * Math.cos(angleDeg * RAD);
  const friction = G * Math.sin(angleDeg * RAD) - mass * acceleration;
  return {
    height,
    work,
    speed,
    omega,
    acceleration,
    energy: kineticEnergyPlane({
      mass,
      centreSpeed: speed,
      centralInertia,
      omega,
    }),
    normal,
    friction,
    muRequired: friction / normal,
  };
}

/** Потенциална енергия на теглото Π = m·g·y, J; y е височината над избраното ниво, m. */
export function gravityPotential(mass: number, y: number): number {
  assertPositive(mass, "маса");
  assertFinite(y, "височина");
  return mass * G_ACCELERATION * y;
}

/** Потенциална енергия на пружина Π = c·x²/2, J; x е деформацията, m. */
export function springPotential(
  stiffness: number,
  deformation: number,
): number {
  assertPositive(stiffness, "коравина");
  assertFinite(deformation, "деформация");
  return (stiffness * deformation * deformation) / 2;
}

/**
 * Скорост на тяло, изтласкано от свита пружина върху гладка хоризонтална
 * равнина: c·x²/2 = m·v²/2, значи v = x·√(c/m), m/s.
 */
export function springLaunchSpeed(input: {
  mass: number;
  stiffness: number;
  compression: number;
}): number {
  assertNonNegative(input.compression, "свиване на пружината");
  return speedFromWork({
    reducedMass: input.mass,
    work: springPotential(input.stiffness, input.compression),
  });
}

/**
 * Тънък прът с дължина l се върти около хоризонтална ос през края си и е
 * пуснат от покой в хоризонтално положение. Големина на ъгловата скорост,
 * когато е завъртян на ъгъл θ (градуси) под хоризонталата. Масовият център
 * слиза с (l/2)·sin θ: (m·l²/3)·ω²/2 = m·g·(l/2)·sin θ, ω = √(3·g·sin θ / l).
 */
export function rodSwingOmega(length: number, angleBelowDeg = 90): number {
  assertPositive(length, "дължина");
  assertFinite(angleBelowDeg, "ъгъл");
  if (angleBelowDeg < 0 || angleBelowDeg > 180) {
    throw new Error("Ъгълът под хоризонталата трябва да е от 0° до 180°.");
  }
  return Math.sqrt(
    (3 * G_ACCELERATION * Math.sin(angleBelowDeg * RAD)) / length,
  );
}
