/**
 * Устойчивост на равновесието и малки трептения на система с една степен на
 * свобода (Теоретична механика – II част, Глава 12).
 *
 * Мерни единици: дължини в m, време в s, маса в kg, сили в N, коравина c в
 * N/m, демпфер b в N·s/m, кръгови честоти в rad/s, ъгли в РАДИАНИ (освен
 * където името на полето завършва на „Deg“). ВНИМАНИЕ: останалите файлове в
 * lib/engineering работят в kN. Тук силата е в N: 1 N = 1 kg·m/s²,
 * 1 kN = 1000 N.
 *
 * Знаци: координатата x се мери от положението на статично равновесие;
 * пружината действа със сила −c·x, демпферът със сила −b·ẋ. Уравнението е
 *   m·ẍ + b·ẋ + c·x = F(t),   F(t) = F0·sin(θ·t).
 * Свободните трептения са записани като x = A·sin(k·t + α), установените
 * принудени – като x = B·sin(θ·t − γ), тоест γ е ИЗОСТАВАНЕ на
 * преместването спрямо силата (0 ≤ γ ≤ π).
 *
 * Означения: k = √(c/m), n = b/(2m), k1 = √(k² − n²), период T0 = 2π/k,
 * период на затихващите трептения τ1 = 2π/k1, логаритмичен декремент
 * δ = n·τ1 (за две поредни отклонения в ЕДНА посока).
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

// ---------------------------------------------------------------------------
// Пружини
// ---------------------------------------------------------------------------

/**
 * Успоредно свързани пружини: преместването е общо, силите се събират.
 * c = c1 + c2 + …, N/m.
 */
export function springsParallel(...stiffnesses: number[]): number {
  if (stiffnesses.length === 0) {
    throw new Error("Нужна е поне една пружина.");
  }
  stiffnesses.forEach((c) => assertPositive(c, "коравина"));
  return stiffnesses.reduce((sum, c) => sum + c, 0);
}

/**
 * Последователно свързани пружини: силата е обща, удълженията се събират.
 * 1/c = 1/c1 + 1/c2 + …, N/m.
 */
export function springsSeries(...stiffnesses: number[]): number {
  if (stiffnesses.length === 0) {
    throw new Error("Нужна е поне една пружина.");
  }
  stiffnesses.forEach((c) => assertPositive(c, "коравина"));
  return 1 / stiffnesses.reduce((sum, c) => sum + 1 / c, 0);
}

// ---------------------------------------------------------------------------
// Свободни трептения без затихване
// ---------------------------------------------------------------------------

/** Кръгова честота на собствените трептения k = √(c/m), rad/s. */
export function naturalFrequency(stiffness: number, mass: number): number {
  assertPositive(stiffness, "коравина");
  assertPositive(mass, "маса");
  return Math.sqrt(stiffness / mass);
}

/** Период 2π/k в s за кръгова честота k в rad/s. */
export function period(angularFrequency: number): number {
  assertPositive(angularFrequency, "кръгова честота");
  return (2 * Math.PI) / angularFrequency;
}

/** Статично преместване под собственото тегло x_ст = m·g/c, m. */
export function staticDeflection(mass: number, stiffness: number): number {
  assertPositive(mass, "маса");
  assertPositive(stiffness, "коравина");
  return (mass * G_ACCELERATION) / stiffness;
}

/** Кръгова честота от статичното преместване: k = √(g/x_ст), rad/s. */
export function frequencyFromStaticDeflection(deflection: number): number {
  assertPositive(deflection, "статично преместване");
  return Math.sqrt(G_ACCELERATION / deflection);
}

export type FreeVibration = {
  /** кръгова честота k, rad/s */
  k: number;
  /** период T0 = 2π/k, s */
  period: number;
  /** честота f = 1/T0, Hz */
  frequencyHz: number;
  /** амплитуда A = √(x0² + (v0/k)²), m */
  amplitude: number;
  /** начална фаза α в x = A·sin(k·t + α), rad; tg α = k·x0/v0 */
  phase: number;
  /** най-голяма скорост k·A, m/s */
  maxSpeed: number;
  /** механична енергия ½·c·A², J (нулата на Π е в равновесното положение) */
  energy: number;
  /** преместване в момента t, m */
  x: (t: number) => number;
  /** скорост в момента t, m/s */
  v: (t: number) => number;
};

/**
 * Свободни трептения m·ẍ + c·x = 0 с начални условия x(0) = x0, ẋ(0) = v0:
 * x = x0·cos kt + (v0/k)·sin kt.
 */
export function freeVibration(input: {
  mass: number;
  stiffness: number;
  x0: number;
  v0: number;
}): FreeVibration {
  const { mass, stiffness, x0, v0 } = input;
  assertFinite(x0, "начално преместване");
  assertFinite(v0, "начална скорост");
  const k = naturalFrequency(stiffness, mass);
  const amplitude = Math.hypot(x0, v0 / k);
  return {
    k,
    period: period(k),
    frequencyHz: k / (2 * Math.PI),
    amplitude,
    phase: Math.atan2(x0, v0 / k),
    maxSpeed: k * amplitude,
    energy: 0.5 * stiffness * amplitude * amplitude,
    x: (t) => x0 * Math.cos(k * t) + (v0 / k) * Math.sin(k * t),
    v: (t) => -x0 * k * Math.sin(k * t) + v0 * Math.cos(k * t),
  };
}

// ---------------------------------------------------------------------------
// Свободни трептения със затихване
// ---------------------------------------------------------------------------

/** Гранично (критично) затихване b_кр = 2·√(c·m), N·s/m. */
export function criticalDamping(mass: number, stiffness: number): number {
  assertPositive(mass, "маса");
  assertPositive(stiffness, "коравина");
  return 2 * Math.sqrt(stiffness * mass);
}

export type DampedVibration = {
  /** кръгова честота без затихване k, rad/s */
  k: number;
  /** коефициент на затихване n = b/(2m), s⁻¹ */
  n: number;
  /** „small“: n < k (трептения); „critical“: n = k; „large“: n > k (без трептения) */
  regime: "small" | "critical" | "large";
  /** кръгова честота на затихващите трептения k1 = √(k² − n²), rad/s; NaN извън „small“ */
  k1: number;
  /** период τ1 = 2π/k1, s; NaN извън „small“ */
  period: number;
  /** логаритмичен декремент δ = n·τ1; NaN извън „small“ */
  decrement: number;
  /** отношение на две поредни отклонения в една посока e^δ; NaN извън „small“ */
  ratio: number;
  /** начална амплитуда A в x = A·e^(−nt)·sin(k1·t + α), m; NaN извън „small“ */
  amplitude: number;
  /** начална фаза α, rad; NaN извън „small“ */
  phase: number;
  /** преместване в момента t, m */
  x: (t: number) => number;
  /** скорост в момента t, m/s */
  v: (t: number) => number;
};

/**
 * Свободни трептения m·ẍ + b·ẋ + c·x = 0, x(0) = x0, ẋ(0) = v0.
 * При n < k: x = e^(−nt)·(x0·cos k1t + ((v0 + n·x0)/k1)·sin k1t).
 * При n = k: x = e^(−nt)·(x0 + (v0 + n·x0)·t).
 * При n > k: x = C1·e^(λ1·t) + C2·e^(λ2·t), λ = −n ± √(n² − k²).
 */
export function dampedVibration(input: {
  mass: number;
  stiffness: number;
  damping: number;
  x0: number;
  v0: number;
}): DampedVibration {
  const { mass, stiffness, damping, x0, v0 } = input;
  assertNonNegative(damping, "коефициент на демпфера");
  assertFinite(x0, "начално преместване");
  assertFinite(v0, "начална скорост");
  const k = naturalFrequency(stiffness, mass);
  const n = damping / (2 * mass);
  const difference = k * k - n * n;
  const scale = k * k * 1e-12;

  if (difference > scale) {
    const k1 = Math.sqrt(difference);
    const c1 = x0;
    const c2 = (v0 + n * x0) / k1;
    const tau = (2 * Math.PI) / k1;
    return {
      k,
      n,
      regime: "small",
      k1,
      period: tau,
      decrement: n * tau,
      ratio: Math.exp(n * tau),
      amplitude: Math.hypot(c1, c2),
      phase: Math.atan2(c1, c2),
      x: (t) =>
        Math.exp(-n * t) * (c1 * Math.cos(k1 * t) + c2 * Math.sin(k1 * t)),
      v: (t) =>
        Math.exp(-n * t) *
        ((c2 * k1 - n * c1) * Math.cos(k1 * t) -
          (c1 * k1 + n * c2) * Math.sin(k1 * t)),
    };
  }

  const none = {
    k,
    n,
    k1: Number.NaN,
    period: Number.NaN,
    decrement: Number.NaN,
    ratio: Number.NaN,
    amplitude: Number.NaN,
    phase: Number.NaN,
  };

  if (difference >= -scale) {
    const slope = v0 + n * x0;
    return {
      ...none,
      regime: "critical",
      x: (t) => Math.exp(-n * t) * (x0 + slope * t),
      v: (t) => Math.exp(-n * t) * (slope - n * (x0 + slope * t)),
    };
  }

  const root = Math.sqrt(-difference);
  const lambda1 = -n + root;
  const lambda2 = -n - root;
  const c1 = (v0 - lambda2 * x0) / (lambda1 - lambda2);
  const c2 = x0 - c1;
  return {
    ...none,
    regime: "large",
    x: (t) => c1 * Math.exp(lambda1 * t) + c2 * Math.exp(lambda2 * t),
    v: (t) =>
      c1 * lambda1 * Math.exp(lambda1 * t) +
      c2 * lambda2 * Math.exp(lambda2 * t),
  };
}

/**
 * Логаритмичен декремент от две измерени отклонения в една посока:
 * δ = ln(A_i / A_(i+j)) / j, където j е броят цели периоди между тях.
 */
export function logDecrement(
  earlier: number,
  later: number,
  periodsBetween = 1,
): number {
  assertPositive(earlier, "по-ранно отклонение");
  assertPositive(later, "по-късно отклонение");
  if (!Number.isInteger(periodsBetween) || periodsBetween < 1) {
    throw new Error("Броят периоди между отклоненията е цяло число ≥ 1.");
  }
  return Math.log(earlier / later) / periodsBetween;
}

// ---------------------------------------------------------------------------
// Принудени трептения
// ---------------------------------------------------------------------------

/**
 * Динамичен коефициент η = B/x_ст за отношение на честотите r = θ/k и
 * относително затихване n/k (по подразбиране 0):
 *   η = 1 / √((1 − r²)² + (2·(n/k)·r)²);  без затихване η = 1/|1 − r²|.
 * При r = 1 без затихване връща Infinity (резонанс).
 */
export function dynamicFactor(
  frequencyRatio: number,
  dampingRatio = 0,
): number {
  assertNonNegative(frequencyRatio, "отношение на честотите");
  assertNonNegative(dampingRatio, "относително затихване");
  const r2 = frequencyRatio * frequencyRatio;
  const denominator = Math.hypot(1 - r2, 2 * dampingRatio * frequencyRatio);
  return denominator === 0 ? Number.POSITIVE_INFINITY : 1 / denominator;
}

export type ForcedVibration = {
  /** кръгова честота на собствените трептения k, rad/s */
  k: number;
  /** коефициент на затихване n = b/(2m), s⁻¹ */
  n: number;
  /** h = F0/m, m/s² */
  h: number;
  /** статично преместване от амплитудата на силата x_ст = F0/c, m */
  staticDisplacement: number;
  /** отношение на честотите θ/k */
  frequencyRatio: number;
  /** динамичен коефициент η = B/x_ст */
  dynamicFactor: number;
  /** амплитуда на установените принудени трептения B, m (Infinity при резонанс без затихване) */
  amplitude: number;
  /** изоставане γ в x = B·sin(θ·t − γ), rad: 0 при θ < k и π при θ > k без затихване */
  phaseLag: number;
  /** установеното принудено преместване в момента t, m */
  steady: (t: number) => number;
};

/**
 * Установени принудени трептения на m·ẍ + b·ẋ + c·x = F0·sin(θ·t):
 *   B = h / √((k² − θ²)² + 4·n²·θ²),  tg γ = 2·n·θ / (k² − θ²).
 */
export function forcedVibration(input: {
  mass: number;
  stiffness: number;
  damping?: number;
  forceAmplitude: number;
  forcingFrequency: number;
}): ForcedVibration {
  const { mass, stiffness, forceAmplitude, forcingFrequency: theta } = input;
  const damping = input.damping ?? 0;
  assertNonNegative(damping, "коефициент на демпфера");
  assertNonNegative(forceAmplitude, "амплитуда на силата");
  assertPositive(theta, "честота на смущението");
  const k = naturalFrequency(stiffness, mass);
  const n = damping / (2 * mass);
  const h = forceAmplitude / mass;
  const staticDisplacement = forceAmplitude / stiffness;
  const eta = dynamicFactor(theta / k, n / k);
  const amplitude = staticDisplacement * eta;
  const phaseLag = Math.atan2(2 * n * theta, k * k - theta * theta);
  return {
    k,
    n,
    h,
    staticDisplacement,
    frequencyRatio: theta / k,
    dynamicFactor: eta,
    amplitude,
    phaseLag,
    steady: (t) => amplitude * Math.sin(theta * t - phaseLag),
  };
}

/**
 * Пълното решение на m·ẍ + b·ẋ + c·x = F0·sin(θ·t) с начални условия
 * x(0) = x0, ẋ(0) = v0 – собствени плюс принудени трептения. Връща x(t), m.
 *
 * Без затихване и θ ≠ k: x = C1·cos kt + C2·sin kt + B·sin θt,
 *   B = h/(k² − θ²) (със знак), C1 = x0, C2 = (v0 − B·θ)/k.
 * Без затихване и θ = k (резонанс):
 *   x = x0·cos kt + ((v0 + h/(2k))/k)·sin kt − (h/(2k))·t·cos kt.
 * С малко затихване (n < k): затихващи собствени плюс установени принудени.
 * При n ≥ k функцията хвърля грешка – случаят не се ползва в главата.
 */
export function forcedResponse(input: {
  mass: number;
  stiffness: number;
  damping?: number;
  forceAmplitude: number;
  forcingFrequency: number;
  x0?: number;
  v0?: number;
}): (t: number) => number {
  const x0 = input.x0 ?? 0;
  const v0 = input.v0 ?? 0;
  assertFinite(x0, "начално преместване");
  assertFinite(v0, "начална скорост");
  const steady = forcedVibration(input);
  const { k, n, h } = steady;
  const theta = input.forcingFrequency;

  if (n === 0) {
    if (Math.abs(theta - k) <= k * 1e-12) {
      const growth = h / (2 * k);
      const c2 = (v0 + growth) / k;
      return (t) =>
        x0 * Math.cos(k * t) +
        c2 * Math.sin(k * t) -
        growth * t * Math.cos(k * t);
    }
    const signedAmplitude = h / (k * k - theta * theta);
    const c2 = (v0 - signedAmplitude * theta) / k;
    return (t) =>
      x0 * Math.cos(k * t) +
      c2 * Math.sin(k * t) +
      signedAmplitude * Math.sin(theta * t);
  }

  if (n >= k) {
    throw new Error(
      "Пълното решение е реализирано само за малко затихване (n < k).",
    );
  }
  const k1 = Math.sqrt(k * k - n * n);
  const B = steady.amplitude;
  const gamma = steady.phaseLag;
  // установената част в t = 0: x = −B·sin γ, ẋ = B·θ·cos γ
  const c1 = x0 + B * Math.sin(gamma);
  const c2 = (v0 - B * theta * Math.cos(gamma) + n * c1) / k1;
  return (t) =>
    Math.exp(-n * t) * (c1 * Math.cos(k1 * t) + c2 * Math.sin(k1 * t)) +
    B * Math.sin(theta * t - gamma);
}

/**
 * Кинематично смущение: опората на пружината се движи по закона
 * ξ = ξ0·sin(θ·t). Уравнението m·ẍ + c·x = c·ξ е същото като при сила с
 * амплитуда F0 = c·ξ0, N.
 */
export function kinematicEquivalentForce(
  stiffness: number,
  supportAmplitude: number,
): number {
  assertPositive(stiffness, "коравина");
  assertNonNegative(supportAmplitude, "амплитуда на опората");
  return stiffness * supportAmplitude;
}

// ---------------------------------------------------------------------------
// Устойчивост на равновесието (теорема на Лагранж–Дирихле)
// ---------------------------------------------------------------------------

export type EquilibriumKind = "stable" | "unstable" | "undecided";

/**
 * Вид на равновесието на консервативна система с една обобщена координата
 * по втората производна на потенциалната енергия в равновесното положение:
 * Π″ > 0 – устойчиво (минимум); Π″ < 0 – неустойчиво; Π″ = 0 – решават
 * членовете от по-висок ред („undecided“).
 */
export function classifyEquilibrium(secondDerivative: number): EquilibriumKind {
  assertFinite(secondDerivative, "втора производна на Π");
  if (secondDerivative > 0) return "stable";
  if (secondDerivative < 0) return "unstable";
  return "undecided";
}

/**
 * Потенциална енергия на тяло, окачено на отвесна пружина. Оста x е НАДОЛУ,
 * с начало при ненапрегната пружина: Π = ½·c·x² − m·g·x, J.
 * Минимумът е при x = m·g/c – положението на статично равновесие.
 */
export function hangingSpringPotential(
  input: { mass: number; stiffness: number },
  x: number,
): number {
  assertPositive(input.mass, "маса");
  assertPositive(input.stiffness, "коравина");
  assertFinite(x, "преместване");
  return 0.5 * input.stiffness * x * x - input.mass * G_ACCELERATION * x;
}

export type InvertedPendulumInput = {
  /** маса на точката на върха, kg */
  mass: number;
  /** дължина на безтегловния прът, m */
  length: number;
  /** коравина на хоризонталната пружина, N/m */
  stiffness: number;
  /** височина на пружината над шарнира d, m (0 < d ≤ l) */
  springHeight: number;
};

function assertPendulum(input: InvertedPendulumInput): void {
  assertPositive(input.mass, "маса");
  assertPositive(input.length, "дължина на пръта");
  assertPositive(input.stiffness, "коравина");
  assertPositive(input.springHeight, "височина на пружината");
  if (input.springHeight > input.length) {
    throw new Error("Пружината не може да е над върха на пръта.");
  }
}

/**
 * Потенциална енергия на обърнато махало с хоризонтална пружина:
 * безтегловен прът с шарнир долу и точка с маса m на върха; пружината е на
 * височина d и остава хоризонтална. Ъгълът φ е от отвеса, rad.
 *   Π(φ) = m·g·l·cos φ + ½·c·(d·sin φ)², J (нулата на теглото е в шарнира).
 */
export function invertedPendulumPotential(
  input: InvertedPendulumInput,
  phi: number,
): number {
  assertPendulum(input);
  assertFinite(phi, "ъгъл");
  const { mass, length, stiffness, springHeight } = input;
  const stretch = springHeight * Math.sin(phi);
  return (
    mass * G_ACCELERATION * length * Math.cos(phi) +
    0.5 * stiffness * stretch * stretch
  );
}

/** Π″(φ) = c·d²·cos 2φ − m·g·l·cos φ за обърнатото махало, N·m. */
export function invertedPendulumSecondDerivative(
  input: InvertedPendulumInput,
  phi: number,
): number {
  assertPendulum(input);
  assertFinite(phi, "ъгъл");
  const { mass, length, stiffness, springHeight } = input;
  return (
    stiffness * springHeight * springHeight * Math.cos(2 * phi) -
    mass * G_ACCELERATION * length * Math.cos(phi)
  );
}

export type InvertedPendulumStability = {
  /** m·g·l, N·m */
  weightTerm: number;
  /** c·d², N·m */
  springTerm: number;
  /** Π″(0) = c·d² − m·g·l, N·m */
  secondDerivative: number;
  /** вид на отвесното равновесие φ = 0 */
  kind: EquilibriumKind;
  /** гранична коравина c_кр = m·g·l/d², N/m */
  criticalStiffness: number;
  /** обобщен инерционен коефициент a = m·l², kg·m² */
  inertia: number;
  /** кръгова честота на малките трептения около φ = 0, rad/s; NaN, ако не е устойчиво */
  k: number;
  /** период T0, s; NaN, ако не е устойчиво */
  period: number;
  /** наклонено равновесие cos φ = m·g·l/(c·d²), градуси; NaN, ако няма такова */
  tiltedEquilibriumDeg: number;
};

/** Устойчивост на отвесното положение на обърнатото махало и малки трептения около него. */
export function invertedPendulumStability(
  input: InvertedPendulumInput,
): InvertedPendulumStability {
  assertPendulum(input);
  const { mass, length, stiffness, springHeight } = input;
  const weightTerm = mass * G_ACCELERATION * length;
  const springTerm = stiffness * springHeight * springHeight;
  const secondDerivative = springTerm - weightTerm;
  const kind = classifyEquilibrium(secondDerivative);
  const inertia = mass * length * length;
  const k = kind === "stable" ? Math.sqrt(secondDerivative / inertia) : NaN;
  return {
    weightTerm,
    springTerm,
    secondDerivative,
    kind,
    criticalStiffness: weightTerm / (springHeight * springHeight),
    inertia,
    k,
    period: kind === "stable" ? (2 * Math.PI) / k : NaN,
    tiltedEquilibriumDeg:
      weightTerm < springTerm
        ? (Math.acos(weightTerm / springTerm) * 180) / Math.PI
        : NaN,
  };
}
