/**
 * Релативно (сложно) движение на точка (Теоретична механика – II част, Глава 3).
 *
 * Мерни единици: дължини в m, време в s, ъгли в rad, скорости в m/s,
 * ускорения в m/s², ъглова скорост в rad/s, ъглово ускорение в rad/s².
 * (Останалите файлове в lib/engineering работят в kN – тук сили няма.)
 *
 * Знаци (както в целия модул): оста x е надясно, оста y е НАГОРЕ, оста z е
 * към наблюдателя. Ъгълът, ъгловата скорост ω_e и ъгловото ускорение ε_e на
 * преносното движение са положителни ОБРАТНО на часовниковата стрелка
 * (вектор по +z).
 *
 * Индекси: r – релативно, e – преносно, a – абсолютно, c – Кориолисово.
 *   v_a = v_r + v_e,   a_a = a_r + a_e + a_c,   a_c = 2·ω_e × v_r.
 * Преносните величини са тези на точката от тялото, с която движещата се
 * точка съвпада в момента:
 *   v_e = v_A + ω_e × ρ,   a_e = a_A + ε_e × ρ − ω_e²·ρ   (равнинна задача),
 * където A е полюсът на тялото, а ρ е векторът от A до точката.
 *
 * Всички вектори на едно извикване трябва да са в ЕДНИ И СЪЩИ оси – или
 * неподвижните x, y, или подвижните ξ, η в разглеждания момент. Формулите
 * са еднакви и в двата случая, защото са векторни.
 *
 * Файлът е самостоятелен – не ползва други модули от lib/engineering.
 */

/** Вектор в равнината (проекции по двете оси). */
export type Vec2 = { x: number; y: number };

/** Вектор в пространството (проекции по трите оси). */
export type Vec3 = { x: number; y: number; z: number };

export type TransportInput = {
  /** скорост на полюса A, m/s (по подразбиране нула – неподвижна ос през A) */
  vPole?: Vec2;
  /** ускорение на полюса A, m/s² (по подразбиране нула) */
  aPole?: Vec2;
  /** ъглова скорост на тялото, rad/s (плюс – обратно на часовниковата стрелка) */
  omegaE: number;
  /** ъглово ускорение на тялото, rad/s² (плюс – обратно на часовниковата стрелка) */
  epsilonE: number;
  /** векторът от полюса A до точката, m */
  rho: Vec2;
};

export type TransportKinematics = {
  /** преносна скорост, m/s */
  vE: Vec2;
  /** преносно ускорение, m/s² */
  aE: Vec2;
};

export type AbsoluteMotionInput = TransportInput & {
  /** релативна скорост, m/s */
  vR: Vec2;
  /** релативно ускорение, m/s² */
  aR: Vec2;
};

export type AbsoluteMotion = {
  /** преносна скорост, m/s */
  vE: Vec2;
  /** преносно ускорение, m/s² */
  aE: Vec2;
  /** Кориолисово ускорение, m/s² */
  aC: Vec2;
  /** абсолютна скорост v_a = v_r + v_e, m/s */
  vAbs: Vec2;
  /** абсолютно ускорение a_a = a_r + a_e + a_c, m/s² */
  aAbs: Vec2;
};

export type RadialSlotInput = {
  /** разстояние от оста до точката, m (≥ 0) */
  r: number;
  /** релативна скорост по радиуса dr/dt, m/s (плюс – навън) */
  rDot: number;
  /** релативно ускорение по радиуса d²r/dt², m/s² (плюс – навън) */
  rDdot: number;
  /** ъглова скорост на тялото, rad/s */
  omega: number;
  /** ъглово ускорение на тялото, rad/s² */
  epsilon: number;
};

export type RadialSlotResult = {
  /** скорост по радиуса (плюс – навън), m/s */
  vRho: number;
  /** скорост напречно на радиуса (плюс – обратно на часовниковата стрелка), m/s */
  vPhi: number;
  /** ускорение по радиуса (плюс – навън), m/s² */
  aRho: number;
  /** ускорение напречно на радиуса (плюс – обратно на часовниковата стрелка), m/s² */
  aPhi: number;
};

export type RiverCrossing = {
  /** абсолютна скорост (спрямо брега), m/s */
  vAbs: number;
  /** ъгъл между курса на лодката и правата през реката, градуси (плюс – срещу течението) */
  headingDeg: number;
  /** ъгъл между абсолютната скорост и правата през реката, градуси (плюс – по течението) */
  driftAngleDeg: number;
  /** време за пресичане, s */
  time: number;
  /** отнасяне по течението, m */
  drift: number;
};

const ZERO: Vec2 = { x: 0, y: 0 };

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Величината „${name}“ трябва да е крайно число.`);
  }
}

function assertVec2(vector: Vec2, name: string): void {
  assertFinite(vector.x, `${name}.x`);
  assertFinite(vector.y, `${name}.y`);
}

function assertVec3(vector: Vec3, name: string): void {
  assertFinite(vector.x, `${name}.x`);
  assertFinite(vector.y, `${name}.y`);
  assertFinite(vector.z, `${name}.z`);
}

function assertPositive(value: number, name: string): void {
  assertFinite(value, name);
  if (!(value > 0)) {
    throw new Error(`Величината „${name}“ трябва да е положителна.`);
  }
}

/** Сбор на вектори в равнината. */
export function addVectors(...vectors: Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const vector of vectors) {
    assertVec2(vector, "вектор");
    x += vector.x;
    y += vector.y;
  }
  return { x, y };
}

/** Големина на вектор в равнината: √(x² + y²). */
export function magnitude2(vector: Vec2): number {
  assertVec2(vector, "вектор");
  return Math.hypot(vector.x, vector.y);
}

/**
 * Завъртане на вектор на ъгъл angle (rad, плюс – обратно на часовниковата
 * стрелка). С него проекции по подвижните оси ξ, η се обръщат в проекции по
 * неподвижните x, y: angle е ъгълът φ_e между оста x и оста ξ.
 */
export function rotateVector(vector: Vec2, angle: number): Vec2 {
  assertVec2(vector, "вектор");
  assertFinite(angle, "ъгъл");
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: vector.x * c - vector.y * s, y: vector.x * s + vector.y * c };
}

/**
 * Кориолисово ускорение в равнинна задача: a_c = 2·ω_e × v_r с ω_e по оста z,
 *   a_cx = −2·ω_e·v_ry,   a_cy = 2·ω_e·v_rx.
 * Това е векторът v_r, завъртян на 90° по посока на въртенето на тялото и
 * умножен по 2·|ω_e|.
 */
export function coriolisAcceleration(omegaE: number, vR: Vec2): Vec2 {
  assertFinite(omegaE, "ω_e");
  assertVec2(vR, "v_r");
  // „+ 0“ превръща −0 в 0, за да няма отрицателна нула в резултата
  return { x: -2 * omegaE * vR.y + 0, y: 2 * omegaE * vR.x + 0 };
}

/**
 * Кориолисово ускорение в пространствена задача: a_c = 2·ω_e × v_r.
 * Големината му е 2·ω_e·v_r·sin(ъгъла между двата вектора).
 */
export function coriolisAcceleration3(omegaE: Vec3, vR: Vec3): Vec3 {
  assertVec3(omegaE, "ω_e");
  assertVec3(vR, "v_r");
  return {
    x: 2 * (omegaE.y * vR.z - omegaE.z * vR.y) + 0,
    y: 2 * (omegaE.z * vR.x - omegaE.x * vR.z) + 0,
    z: 2 * (omegaE.x * vR.y - omegaE.y * vR.x) + 0,
  };
}

/**
 * Големина на Кориолисовото ускорение: a_c = 2·|ω_e|·|v_r|·sin(ъгъла).
 * Ъгълът между ω_e и v_r е в градуси, от 0 до 180; по подразбиране е 90°
 * (равнинна задача).
 */
export function coriolisMagnitude(
  omegaE: number,
  vR: number,
  angleDeg = 90,
): number {
  assertFinite(omegaE, "ω_e");
  assertFinite(vR, "v_r");
  assertFinite(angleDeg, "ъгъл");
  if (angleDeg < 0 || angleDeg > 180) {
    throw new Error("Ъгълът между ω_e и v_r трябва да е между 0° и 180°.");
  }
  return (
    2 * Math.abs(omegaE) * Math.abs(vR) * Math.sin((angleDeg * Math.PI) / 180)
  );
}

/**
 * Преносна скорост и преносно ускорение – на точката от тялото, с която
 * движещата се точка съвпада в момента:
 *   v_e = v_A + ω_e × ρ          = (v_Ax − ω_e·ρ_y;  v_Ay + ω_e·ρ_x),
 *   a_e = a_A + ε_e × ρ − ω_e²·ρ = (a_Ax − ε_e·ρ_y − ω_e²·ρ_x;
 *                                   a_Ay + ε_e·ρ_x − ω_e²·ρ_y).
 * При транслация ω_e = ε_e = 0 и остават само v_A и a_A.
 */
export function transportKinematics(
  input: TransportInput,
): TransportKinematics {
  const vPole = input.vPole ?? ZERO;
  const aPole = input.aPole ?? ZERO;
  assertVec2(vPole, "v_A");
  assertVec2(aPole, "a_A");
  assertFinite(input.omegaE, "ω_e");
  assertFinite(input.epsilonE, "ε_e");
  assertVec2(input.rho, "ρ");
  const { omegaE, epsilonE, rho } = input;
  return {
    vE: { x: vPole.x - omegaE * rho.y + 0, y: vPole.y + omegaE * rho.x + 0 },
    aE: {
      x: aPole.x - epsilonE * rho.y - omegaE * omegaE * rho.x + 0,
      y: aPole.y + epsilonE * rho.x - omegaE * omegaE * rho.y + 0,
    },
  };
}

/**
 * Абсолютна скорост и абсолютно ускорение (теорема на Кориолис):
 *   v_a = v_r + v_e,   a_a = a_r + a_e + a_c.
 * Всички вектори са в едни и същи оси.
 */
export function absoluteMotion(input: AbsoluteMotionInput): AbsoluteMotion {
  assertVec2(input.vR, "v_r");
  assertVec2(input.aR, "a_r");
  const { vE, aE } = transportKinematics(input);
  const aC = coriolisAcceleration(input.omegaE, input.vR);
  return {
    vE,
    aE,
    aC,
    vAbs: addVectors(input.vR, vE),
    aAbs: addVectors(input.aR, aE, aC),
  };
}

/**
 * Точка в радиален канал на тяло, което се върти около неподвижна ос.
 * Проекции по радиуса навън (ρ) и напречно на него, по посока на
 * положителното въртене (φ):
 *   v_ρ = ṙ,           v_φ = ω·r,
 *   a_ρ = r̈ − ω²·r,   a_φ = ε·r + 2·ω·ṙ.
 */
export function radialSlot(input: RadialSlotInput): RadialSlotResult {
  assertFinite(input.r, "r");
  if (input.r < 0) {
    throw new Error("Разстоянието r не може да е отрицателно.");
  }
  assertFinite(input.rDot, "dr/dt");
  assertFinite(input.rDdot, "d²r/dt²");
  assertFinite(input.omega, "ω");
  assertFinite(input.epsilon, "ε");
  const { r, rDot, rDdot, omega, epsilon } = input;
  return {
    vRho: rDot,
    vPhi: omega * r + 0,
    aRho: rDdot - omega * omega * r,
    aPhi: epsilon * r + 2 * omega * rDot + 0,
  };
}

/**
 * Лодка, която държи курс ПЕРПЕНДИКУЛЯРНО на брега. Реката (преносното
 * движение) е транслация със скорост vE, лодката има скорост vR спрямо водата.
 *   v_a = √(v_r² + v_e²),  време = ширина / v_r,  отнасяне = v_e · време.
 */
export function crossRiverHeadingAcross(
  width: number,
  vR: number,
  vE: number,
): RiverCrossing {
  assertPositive(width, "ширина");
  assertPositive(vR, "v_r");
  assertFinite(vE, "v_e");
  if (vE < 0) {
    throw new Error("Скоростта на течението не може да е отрицателна.");
  }
  const time = width / vR;
  return {
    vAbs: Math.hypot(vR, vE),
    headingDeg: 0,
    driftAngleDeg: (Math.atan2(vE, vR) * 180) / Math.PI,
    time,
    drift: vE * time,
  };
}

/**
 * Лодка, която трябва да пресече реката ПО ПРАВА, перпендикулярна на брега.
 * Курсът е под ъгъл β срещу течението: sin β = v_e / v_r;
 *   v_a = √(v_r² − v_e²),  време = ширина / v_a.
 * Възможно е само при v_r > v_e.
 */
export function crossRiverStraight(
  width: number,
  vR: number,
  vE: number,
): RiverCrossing {
  assertPositive(width, "ширина");
  assertPositive(vR, "v_r");
  assertFinite(vE, "v_e");
  if (vE < 0) {
    throw new Error("Скоростта на течението не може да е отрицателна.");
  }
  if (!(vR > vE)) {
    throw new Error(
      "Лодката не може да пресече право: скоростта ѝ спрямо водата трябва да е по-голяма от тази на течението.",
    );
  }
  const vAbs = Math.sqrt(vR * vR - vE * vE);
  return {
    vAbs,
    headingDeg: (Math.asin(vE / vR) * 180) / Math.PI,
    driftAngleDeg: 0,
    time: width / vAbs,
    drift: 0,
  };
}
