/**
 * Теореми за количеството на движение и кинетичния момент
 * (Теоретична механика – II част, Глава 8).
 *
 * Мерни единици: дължини в m, време в s, маса в kg, сили в N, ъгли в rad.
 * Количество на движение – kg·m/s; импулс на сила – N·s (1 N·s = 1 kg·m/s);
 * масов инерционен момент – kg·m²; кинетичен момент – kg·m²/s; момент на
 * сила – N·m; енергия – J. ВНИМАНИЕ: останалите файлове в lib/engineering
 * работят в kN. Тук силата е в N, защото масата е в kg: 1 kN = 1000 N.
 *
 * Знаци: оста x е надясно, оста y е нагоре, оста z е към наблюдателя.
 * Скоростите и силите по права са положителни по +x. Ъгловата скорост ω,
 * ъгловото ускорение ε, моментите и кинетичният момент са положителни
 * ОБРАТНО на часовниковата стрелка.
 *
 * Файлът е самостоятелен – не ползва други модули от lib/engineering.
 */

/** Земно ускорение, m/s². */
export const G_ACCELERATION = 9.81;

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

/** Количество на движение по една ос: Q = m·v, kg·m/s. Знакът е този на v. */
export function momentum(massKg: number, velocity: number): number {
  assertPositive(massKg, "маса");
  assertFinite(velocity, "скорост");
  return massKg * velocity;
}

export type MovingBody = {
  /** маса, kg */
  mass: number;
  /** скорост по оста x, m/s (със знак) */
  velocity: number;
};

export type SystemMomentum = {
  /** обща маса, kg */
  mass: number;
  /** количество на движение на системата Q = Σ mᵢ·vᵢ, kg·m/s */
  momentum: number;
  /** скорост на масовия център v_C = Q / m, m/s */
  centreVelocity: number;
  /** кинетична енергия Σ ½·mᵢ·vᵢ², J */
  kineticEnergy: number;
};

/** Количество на движение на система от тела по една ос: Q = Σ mᵢ·vᵢ = m·v_C. */
export function systemMomentum(bodies: MovingBody[]): SystemMomentum {
  if (bodies.length === 0) {
    throw new Error("Системата трябва да има поне едно тяло.");
  }
  let mass = 0;
  let total = 0;
  let kineticEnergy = 0;
  for (const body of bodies) {
    assertPositive(body.mass, "маса");
    assertFinite(body.velocity, "скорост");
    mass += body.mass;
    total += body.mass * body.velocity;
    kineticEnergy += 0.5 * body.mass * body.velocity ** 2;
  }
  return {
    mass,
    momentum: total,
    centreVelocity: total / mass,
    kineticEnergy,
  };
}

/** Координата на масовия център по една ос: x_C = Σ mᵢ·xᵢ / Σ mᵢ, m. */
export function massCentre(bodies: { mass: number; x: number }[]): number {
  if (bodies.length === 0) {
    throw new Error("Системата трябва да има поне едно тяло.");
  }
  let mass = 0;
  let moment = 0;
  for (const body of bodies) {
    assertPositive(body.mass, "маса");
    assertFinite(body.x, "координата");
    mass += body.mass;
    moment += body.mass * body.x;
  }
  return moment / mass;
}

/** Импулс на постоянна сила: S = F·t, N·s. Знакът е този на силата. */
export function constantForceImpulse(force: number, duration: number): number {
  assertFinite(force, "сила");
  assertNonNegative(duration, "време");
  return force * duration;
}

/**
 * Импулс на променлива сила S = ∫ F(t) dt от t0 до t1, N·s – числено, по
 * правилото на Симпсон. Това е лицето под графиката F(t). Броят на
 * интервалите steps трябва да е четно положително число.
 */
export function forceImpulse(
  force: (t: number) => number,
  t0: number,
  t1: number,
  steps = 1000,
): number {
  assertFinite(t0, "начално време");
  assertFinite(t1, "крайно време");
  if (t1 < t0) {
    throw new Error("Крайното време не може да е преди началното.");
  }
  if (!Number.isInteger(steps) || steps <= 0 || steps % 2 !== 0) {
    throw new Error(
      "Броят на интервалите трябва да е четно положително число.",
    );
  }
  const h = (t1 - t0) / steps;
  let sum = force(t0) + force(t1);
  for (let i = 1; i < steps; i++) {
    sum += force(t0 + i * h) * (i % 2 === 0 ? 2 : 4);
  }
  return (sum * h) / 3;
}

/**
 * Теорема за импулсите по една ос: m·v₂ − m·v₁ = S. Връща v₂ в m/s.
 * impulse е сборът от импулсите на всички външни сили по оста, N·s.
 */
export function velocityAfterImpulse(input: {
  mass: number;
  v1: number;
  impulse: number;
}): number {
  assertPositive(input.mass, "маса");
  assertFinite(input.v1, "начална скорост");
  assertFinite(input.impulse, "импулс");
  return input.v1 + input.impulse / input.mass;
}

/**
 * Време, за което постоянна спирачна сила спира тяло: 0 − m·v = −F·t,
 * значи t = m·v / F. Скоростта и силата се подават като големини.
 */
export function timeToStop(input: {
  mass: number;
  speed: number;
  brakingForce: number;
}): number {
  assertPositive(input.mass, "маса");
  assertNonNegative(input.speed, "скорост");
  assertPositive(input.brakingForce, "спирачна сила");
  return (input.mass * input.speed) / input.brakingForce;
}

export type CommonVelocityResult = {
  /** обща скорост след сцепването v = Q / Σ m, m/s */
  velocity: number;
  /** кинетична енергия преди, J */
  kineticBefore: number;
  /** кинетична енергия след, J */
  kineticAfter: number;
  /** загубена кинетична енергия (≥ 0), J */
  kineticLoss: number;
};

/**
 * Тела, които се сцепват и продължават заедно по една права. Външни сили по
 * оста няма, затова количеството на движение се запазва: Σ mᵢ·vᵢ = (Σ mᵢ)·v.
 * Кинетичната енергия НЕ се запазва – част от нея се губи.
 */
export function commonVelocity(bodies: MovingBody[]): CommonVelocityResult {
  const before = systemMomentum(bodies);
  const velocity = before.centreVelocity;
  const kineticAfter = 0.5 * before.mass * velocity ** 2;
  return {
    velocity,
    kineticBefore: before.kineticEnergy,
    kineticAfter,
    kineticLoss: before.kineticEnergy - kineticAfter,
  };
}

export type WalkOnPlatformResult = {
  /** преместване на платформата спрямо земята, m (обратно на човека) */
  platformShift: number;
  /** преместване на човека спрямо земята, m */
  personShift: number;
  /** скорост на платформата спрямо земята, m/s */
  platformVelocity: number;
  /** скорост на човека спрямо земята, m/s */
  personVelocity: number;
};

/**
 * Човек върви по платформа (лодка, количка), която може да се движи свободно
 * по хоризонталата; в началото всичко е в покой. Външни сили по x няма:
 * m₁·(u + v₂) + m₂·v₂ = 0, значи v₂ = −m₁·u / (m₁ + m₂). Същото отношение
 * важи за преместванията. relativeDistance и relativeSpeed са спрямо
 * платформата и са положителни по +x.
 */
export function walkOnPlatform(input: {
  personMass: number;
  platformMass: number;
  relativeDistance: number;
  relativeSpeed?: number;
}): WalkOnPlatformResult {
  const { personMass, platformMass, relativeDistance } = input;
  const relativeSpeed = input.relativeSpeed ?? 0;
  assertPositive(personMass, "маса на човека");
  assertPositive(platformMass, "маса на платформата");
  assertFinite(relativeDistance, "релативно преместване");
  assertFinite(relativeSpeed, "релативна скорост");
  const share = personMass / (personMass + platformMass);
  const platformShift = -share * relativeDistance;
  const platformVelocity = -share * relativeSpeed;
  return {
    platformShift,
    personShift: relativeDistance + platformShift,
    platformVelocity,
    personVelocity: relativeSpeed + platformVelocity,
  };
}

export type SpringImpulseInput = {
  /** маса, kg */
  mass: number;
  /** коравина на пружината c, N/m */
  stiffness: number;
  /** импулс на удара S по оста на пружината, N·s */
  impulse: number;
};

export type SpringImpulseResponse = {
  /** скорост веднага след удара v₀ = S / m, m/s */
  initialVelocity: number;
  /** кръгова честота k = √(c/m), rad/s */
  circularFrequency: number;
  /** амплитуда |S| / (m·k), m */
  amplitude: number;
  /** период T₀ = 2π / k, s */
  period: number;
  /** най-голяма сила в пружината c·амплитуда, N */
  maxSpringForce: number;
};

/**
 * Система пружина – маса под действие на единичен импулс. Тялото е в покой
 * при ненапрегната пружина; ударът само променя скоростта със S/m, без
 * преместване. След това m·ẍ + c·x = 0 и x = (S / (m·k))·sin kt.
 */
export function springImpulseResponse(
  input: SpringImpulseInput,
): SpringImpulseResponse {
  assertPositive(input.mass, "маса");
  assertPositive(input.stiffness, "коравина");
  assertFinite(input.impulse, "импулс");
  const initialVelocity = input.impulse / input.mass;
  const circularFrequency = Math.sqrt(input.stiffness / input.mass);
  const amplitude = Math.abs(initialVelocity) / circularFrequency;
  return {
    initialVelocity,
    circularFrequency,
    amplitude,
    period: (2 * Math.PI) / circularFrequency,
    maxSpringForce: input.stiffness * amplitude,
  };
}

/** Отклонение x(t) = (S / (m·k))·sin kt след единичен импулс, m; t ≥ 0. */
export function springImpulseDisplacement(
  input: SpringImpulseInput,
  t: number,
): number {
  assertNonNegative(t, "време");
  const { initialVelocity, circularFrequency } = springImpulseResponse(input);
  return (
    (initialVelocity / circularFrequency) * Math.sin(circularFrequency * t)
  );
}

/**
 * Сила на струя върху стена, перпендикулярна на струята (теорема на Ойлер
 * за установено течение): за 1 s стената отнема количеството на движение на
 * massFlow килограма течност, F = ṁ·v. massFlow в kg/s, speed в m/s, F в N.
 */
export function jetForce(input: { massFlow: number; speed: number }): number {
  assertNonNegative(input.massFlow, "масов разход");
  assertNonNegative(input.speed, "скорост");
  return input.massFlow * input.speed;
}

/**
 * Кинетичен момент на материална точка спрямо началото O в равнината xy:
 * K_O = m·(x·v_y − y·v_x), kg·m²/s. Положителен обратно на часовниковата
 * стрелка.
 */
export function pointAngularMomentum(input: {
  mass: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}): number {
  assertPositive(input.mass, "маса");
  assertFinite(input.x, "x");
  assertFinite(input.y, "y");
  assertFinite(input.vx, "v_x");
  assertFinite(input.vy, "v_y");
  return input.mass * (input.x * input.vy - input.y * input.vx);
}

/** Масов инерционен момент на еднороден диск спрямо оста му: J = m·R²/2. */
export function discInertia(massKg: number, radius: number): number {
  assertPositive(massKg, "маса");
  assertPositive(radius, "радиус");
  return (massKg * radius ** 2) / 2;
}

/** Масов инерционен момент на материална точка на разстояние r от оста: m·r². */
export function pointInertia(massKg: number, distance: number): number {
  assertPositive(massKg, "маса");
  assertNonNegative(distance, "разстояние до оста");
  return massKg * distance ** 2;
}

/** Ъглово ускорение при въртене около неподвижна ос: ε = M_z / J_z, rad/s². */
export function angularAcceleration(inertia: number, moment: number): number {
  assertPositive(inertia, "масов инерционен момент");
  assertFinite(moment, "момент");
  return moment / inertia;
}

/**
 * Въртене около неподвижна ос под действие на постоянен момент M_z за време
 * t: J·(ω − ω₀) = M_z·t. Връща ω и ъгъла на завъртане φ = ω₀·t + ε·t²/2.
 */
export function rotationUnderConstantMoment(input: {
  inertia: number;
  omega0: number;
  moment: number;
  t: number;
}): { epsilon: number; omega: number; phi: number } {
  assertFinite(input.omega0, "начална ъглова скорост");
  assertNonNegative(input.t, "време");
  const epsilon = angularAcceleration(input.inertia, input.moment);
  return {
    epsilon,
    omega: input.omega0 + epsilon * input.t,
    phi: input.omega0 * input.t + (epsilon * input.t ** 2) / 2,
  };
}

/**
 * Спиране на въртящо се тяло с постоянен спирачен момент (подава се
 * големината му): t = J·|ω₀| / M, ъгъл до спирането |ω₀|·t / 2.
 */
export function brakingRotation(input: {
  inertia: number;
  omega0: number;
  brakingMoment: number;
}): { time: number; angle: number; turns: number } {
  assertPositive(input.inertia, "масов инерционен момент");
  assertFinite(input.omega0, "начална ъглова скорост");
  assertPositive(input.brakingMoment, "спирачен момент");
  const speed = Math.abs(input.omega0);
  const time = (input.inertia * speed) / input.brakingMoment;
  const angle = (speed * time) / 2;
  return { time, angle, turns: angle / (2 * Math.PI) };
}

export type AngularConservationResult = {
  /** кинетичен момент K_z = J₁·ω₁, kg·m²/s (запазва се) */
  angularMomentum: number;
  /** ъглова скорост след промяната ω₂ = J₁·ω₁ / J₂, rad/s */
  omega2: number;
  /** кинетична енергия преди T₁ = ½·J₁·ω₁², J */
  kineticBefore: number;
  /** кинетична енергия след T₂ = ½·J₂·ω₂², J */
  kineticAfter: number;
  /** T₂ − T₁, J: положително, когато J намалява (работа на вътрешните сили) */
  kineticChange: number;
};

/**
 * Запазване на кинетичния момент при промяна на масовия инерционен момент
 * (няма външен момент спрямо оста): J₁·ω₁ = J₂·ω₂. Кинетичната енергия се
 * променя: T₂ / T₁ = J₁ / J₂.
 */
export function conserveAngularMomentum(input: {
  inertia1: number;
  omega1: number;
  inertia2: number;
}): AngularConservationResult {
  assertPositive(input.inertia1, "масов инерционен момент J₁");
  assertPositive(input.inertia2, "масов инерционен момент J₂");
  assertFinite(input.omega1, "ъглова скорост");
  const angularMomentum = input.inertia1 * input.omega1;
  const omega2 = angularMomentum / input.inertia2;
  const kineticBefore = 0.5 * input.inertia1 * input.omega1 ** 2;
  const kineticAfter = 0.5 * input.inertia2 * omega2 ** 2;
  return {
    angularMomentum,
    omega2,
    kineticBefore,
    kineticAfter,
    kineticChange: kineticAfter - kineticBefore,
  };
}
