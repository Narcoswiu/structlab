/**
 * Чист опън и натиск на прав прът от няколко участъка.
 *
 * Мерни единици: сили в kN, дължини в cm, площи в cm², E в kN/cm².
 * Тогава напреженията са в kN/cm² (1 kN/cm² = 10 MPa), а удълженията в cm.
 * N > 0 означава опън.
 */
export type Segment = {
  length: number;
  area: number;
  /** модул на еластичност, kN/cm² */
  E: number;
};

export type AxialResult = {
  /** нормална сила във всеки участък */
  N: number[];
  /** нормално напрежение във всеки участък, kN/cm² */
  sigma: number[];
  /** удължение на всеки участък, cm (отрицателно = скъсяване) */
  deltaL: number[];
  /** преместване на края на всеки участък спрямо запъването, cm */
  displacement: number[];
};

function validate(segments: Segment[], forces: number[]) {
  if (segments.length === 0 || forces.length !== segments.length) {
    throw new Error("Трябва по една сила за края на всеки участък.");
  }
  for (const s of segments) {
    if (!(s.length > 0) || !(s.area > 0) || !(s.E > 0)) {
      throw new Error("Дължината, площта и E трябва да са положителни.");
    }
  }
}

function fromNormalForces(segments: Segment[], N: number[]): AxialResult {
  const sigma = N.map((n, i) => n / segments[i]!.area);
  const deltaL = N.map(
    (n, i) => (n * segments[i]!.length) / (segments[i]!.E * segments[i]!.area),
  );
  let sum = 0;
  const displacement = deltaL.map((d) => (sum += d));
  return { N, sigma, deltaL, displacement };
}

/**
 * Прът, запънат в началото и свободен в края. `forces[i]` е външната сила,
 * приложена в края на участък i; положителна, когато сочи навън от запъването
 * (опъва участъците преди нея).
 */
export function solveBar(segments: Segment[], forces: number[]): AxialResult {
  validate(segments, forces);
  // Нормалната сила в участък i е сборът на силите от него до свободния край.
  const N = segments.map((_, i) =>
    forces.slice(i).reduce((sum, f) => sum + f, 0),
  );
  return fromNormalForces(segments, N);
}

/**
 * Прът, запънат в двата края (статически неопределим). `forces[i]` е силата
 * в края на участък i за i < n−1; последната стойност трябва да е 0.
 * Допълнителното уравнение е: общото удължение е нула.
 */
export function solveFixedFixedBar(
  segments: Segment[],
  forces: number[],
): AxialResult & { reactionStart: number; reactionEnd: number } {
  validate(segments, forces);
  if (forces[forces.length - 1] !== 0) {
    throw new Error("В запънатия край не се задава външна сила.");
  }
  // Освобождаваме втория край и прилагаме там неизвестна реакция X (опън > 0).
  const free = solveBar(segments, forces);
  const flexibility = segments.reduce(
    (sum, s) => sum + s.length / (s.E * s.area),
    0,
  );
  const totalFree = free.displacement[free.displacement.length - 1]!;
  const X = -totalFree / flexibility;
  const result = fromNormalForces(
    segments,
    free.N.map((n) => n + X),
  );
  return { ...result, reactionStart: result.N[0]!, reactionEnd: X };
}

/**
 * Абсолютно корава греда на шарнир, окачена на вертикални пръти.
 * Натоварена е със сила F на разстояние `loadArm` от шарнира.
 * Прътите са на разстояния `arm` от шарнира. Връща силите в прътите.
 *
 * Условие за съвместимост: гредата се завърта като кораво тяло, затова
 * удълженията са пропорционални на рамената: Δl_i = φ · arm_i.
 */
export function solveRigidBeamOnRods(
  rods: (Segment & { arm: number })[],
  load: { F: number; arm: number },
): { N: number[]; sigma: number[]; deltaL: number[]; rotation: number } {
  if (rods.length === 0) throw new Error("Нужен е поне един прът.");
  // N_i = k_i · Δl_i = k_i · φ · arm_i, където k_i = E·A/l
  const stiffness = rods.map((rod) => (rod.E * rod.area) / rod.length);
  // ΣM спрямо шарнира: Σ N_i · arm_i = F · loadArm
  const denominator = rods.reduce(
    (sum, rod, i) => sum + stiffness[i]! * rod.arm * rod.arm,
    0,
  );
  const rotation = (load.F * load.arm) / denominator;
  const deltaL = rods.map((rod) => rotation * rod.arm);
  const N = deltaL.map((d, i) => stiffness[i]! * d);
  return { N, sigma: N.map((n, i) => n / rods[i]!.area), deltaL, rotation };
}
