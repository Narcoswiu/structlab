/**
 * Кинематика на твърдо тяло (Теоретична механика – II част, Глава 2):
 * ротация около неподвижна ос, предавки и равнинно движение.
 *
 * Мерни единици: дължини в m, време в s, ъгли в rad (само където името на
 * полето завършва на „Deg“ – в градуси), скорости в m/s, ускорения в m/s²,
 * ъглова скорост в rad/s, ъглово ускорение в rad/s², обороти в min⁻¹.
 * Тук няма сили; останалите файлове в lib/engineering работят в kN.
 *
 * Знаци (както в целия модул): оста x е надясно, оста y е НАГОРЕ, оста z е
 * към наблюдателя. Ъгълът φ, ъгловата скорост ω и ъгловото ускорение ε са
 * положителни ОБРАТНО на часовниковата стрелка (вектор по +z). Колело, което
 * се търкаля надясно, има ω < 0.
 *
 * В равнината векторното произведение на ω (по z) с вектора (x; y) е
 * (−ω·y; ω·x) – същата подредба като при момента M = x·F_y − y·F_x.
 *
 * Файлът е самостоятелен – не ползва други модули от lib/engineering.
 */

/** Вектор или точка в равнината (проекции по x и y). */
export type Vec2 = { x: number; y: number };

export type RotationPoint = {
  /** скорост v = ω·r, m/s; със знак – плюс по обратната на часовниковата посока */
  v: number;
  /** тангенциално ускорение a_τ = ε·r, m/s²; със същия знак като ε */
  aTau: number;
  /** нормално ускорение a_n = ω²·r, m/s² (≥ 0), насочено към оста */
  aN: number;
  /** пълно ускорение a = r·√(ε² + ω⁴), m/s² (≥ 0) */
  a: number;
  /** ъгъл между пълното ускорение и радиуса, rad: tg β = |ε|/ω²; π/2 при ω = 0 */
  beta: number;
};

export type RotationState = {
  /** ъглова скорост в момента t, rad/s */
  omega: number;
  /** ъгъл на завъртане, отчетен от началното положение, rad */
  phi: number;
  /** брой обороти N = φ/2π (със знака на φ) */
  revolutions: number;
};

export type RollingWheel = {
  /** ъглова скорост, rad/s: ω = −v_C/R (търкаляне надясно → по часовниковата) */
  omega: number;
  /** ъглово ускорение, rad/s²: ε = −a_C/R */
  epsilon: number;
  /** точката на допиране – моментният център на скоростите */
  contact: Vec2;
};

export type CrankSlider = {
  /** краят на коляното, m */
  A: Vec2;
  /** плъзгачът (лежи на оста x), m */
  B: Vec2;
  /** скорост на A, m/s */
  vA: Vec2;
  /** ускорение на A, m/s² */
  aA: Vec2;
  /** ъглова скорост на мотовилката, rad/s */
  omega2: number;
  /** ъглово ускорение на мотовилката, rad/s² */
  epsilon2: number;
  /** скорост на плъзгача по оста x, m/s (плюс надясно) */
  vB: number;
  /** ускорение на плъзгача по оста x, m/s² (плюс надясно) */
  aB: number;
};

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Величината „${name}“ трябва да е крайно число.`);
  }
}

function assertPositive(value: number, name: string): void {
  assertFinite(value, name);
  if (!(value > 0)) {
    throw new Error(`Величината „${name}“ трябва да е положителна.`);
  }
}

function assertVec(vector: Vec2, name: string): void {
  assertFinite(vector.x, `${name}.x`);
  assertFinite(vector.y, `${name}.y`);
}

/** Ъглова скорост от обороти в минута: ω = 2π·n/60 = π·n/30, rad/s. */
export function rpmToRadPerSec(rpm: number): number {
  assertFinite(rpm, "обороти в минута");
  return (Math.PI * rpm) / 30;
}

/** Обороти в минута от ъглова скорост: n = 30·ω/π, min⁻¹. */
export function radPerSecToRpm(omega: number): number {
  assertFinite(omega, "ъглова скорост");
  return (30 * omega) / Math.PI;
}

/**
 * Точка на разстояние r (m, ≥ 0) от неподвижна ос на въртене:
 * v = ω·r, a_τ = ε·r, a_n = ω²·r, a = √(a_τ² + a_n²).
 */
export function rotationPoint(input: {
  r: number;
  omega: number;
  epsilon: number;
}): RotationPoint {
  const { r, omega, epsilon } = input;
  assertFinite(r, "разстояние до оста");
  assertFinite(omega, "ъглова скорост");
  assertFinite(epsilon, "ъглово ускорение");
  if (r < 0) {
    throw new Error("Разстоянието до оста не може да е отрицателно.");
  }
  const aTau = epsilon * r;
  const aN = omega * omega * r;
  return {
    v: omega * r,
    aTau,
    aN,
    a: Math.hypot(aTau, aN),
    beta: Math.atan2(Math.abs(epsilon), omega * omega),
  };
}

/**
 * Равнопроменлива ротация (ε = const) след време t (s, ≥ 0):
 * ω = ω₀ + ε·t;  φ = ω₀·t + ε·t²/2 (отчетен от началното положение);  N = φ/2π.
 * При ε = 0 това е равномерна ротация.
 */
export function uniformlyAcceleratedRotation(input: {
  omega0: number;
  epsilon: number;
  t: number;
}): RotationState {
  const { omega0, epsilon, t } = input;
  assertFinite(omega0, "начална ъглова скорост");
  assertFinite(epsilon, "ъглово ускорение");
  assertFinite(t, "време");
  if (t < 0) {
    throw new Error("Времето не може да е отрицателно.");
  }
  const phi = omega0 * t + (epsilon * t * t) / 2;
  return {
    omega: omega0 + epsilon * t,
    phi,
    revolutions: phi / (2 * Math.PI),
  };
}

/**
 * Предавка без плъзгане (зъбни колела или ремък): общата точка има една
 * скорост, затова ω₁·r₁ = |ω₂|·r₂. Връща ω₂ в rad/s със знак:
 * при външно зацепване (`external: true`) колелата се въртят в обратни посоки
 * и знакът се обръща; при вътрешно зацепване и при некръстосан ремък
 * (`external: false`) посоката е същата.
 * Вместо радиуси може да се подадат диаметри – влиза само отношението им.
 */
export function gearRatio(input: {
  omega1: number;
  r1: number;
  r2: number;
  external: boolean;
}): number {
  const { omega1, r1, r2, external } = input;
  assertFinite(omega1, "ъглова скорост на първото колело");
  assertPositive(r1, "радиус на първото колело");
  assertPositive(r2, "радиус на второто колело");
  const magnitude = (omega1 * r1) / r2;
  return external ? -magnitude : magnitude;
}

/**
 * Теорема за скоростите при равнинно движение (полюс A):
 * v_B = v_A + ω × AB, тоест
 * v_Bx = v_Ax − ω·(y_B − y_A),  v_By = v_Ay + ω·(x_B − x_A).
 * С v_A = 0 това е скоростта на точка от тяло, въртящо се около оста през A.
 */
export function planeVelocity(vA: Vec2, omega: number, A: Vec2, B: Vec2): Vec2 {
  assertVec(vA, "скорост на полюса");
  assertFinite(omega, "ъглова скорост");
  assertVec(A, "полюс");
  assertVec(B, "точка");
  return {
    x: vA.x - omega * (B.y - A.y),
    y: vA.y + omega * (B.x - A.x),
  };
}

/**
 * Теорема за ускоренията при равнинно движение (полюс A):
 * a_B = a_A + ε × AB − ω²·AB, тоест
 * a_Bx = a_Ax − ε·(y_B − y_A) − ω²·(x_B − x_A),
 * a_By = a_Ay + ε·(x_B − x_A) − ω²·(y_B − y_A).
 * Членът с ε е въртеливата съставка (⊥ AB), членът с ω² – центростремителната
 * (от B към A).
 */
export function planeAcceleration(
  aA: Vec2,
  omega: number,
  epsilon: number,
  A: Vec2,
  B: Vec2,
): Vec2 {
  assertVec(aA, "ускорение на полюса");
  assertFinite(omega, "ъглова скорост");
  assertFinite(epsilon, "ъглово ускорение");
  assertVec(A, "полюс");
  assertVec(B, "точка");
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  return {
    x: aA.x - epsilon * dy - omega * omega * dx,
    y: aA.y + epsilon * dx - omega * omega * dy,
  };
}

/**
 * Моментен център на скоростите (МЦС) – точката P с v_P = 0:
 * x_P = x_A − v_Ay/ω,  y_P = y_A + v_Ax/ω.
 * При ω = 0 такава точка няма (моментна транслация) – грешка.
 */
export function instantCentre(A: Vec2, vA: Vec2, omega: number): Vec2 {
  assertVec(A, "точка");
  assertVec(vA, "скорост");
  assertFinite(omega, "ъглова скорост");
  if (omega === 0) {
    throw new Error(
      "Ъгловата скорост е нула – моментна транслация: моментният център на скоростите е в безкрайност.",
    );
  }
  return { x: A.x - vA.y / omega, y: A.y + vA.x / omega };
}

/**
 * Проекция на вектор v върху правата AB (посока от A към B), със знак.
 * За две точки от едно твърдо тяло проекциите на скоростите им върху правата,
 * която ги свързва, са равни (теорема за проектираните скорости).
 */
export function projectionOnLine(v: Vec2, A: Vec2, B: Vec2): number {
  assertVec(v, "вектор");
  assertVec(A, "A");
  assertVec(B, "B");
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    throw new Error("Двете точки съвпадат – правата не е определена.");
  }
  return (v.x * dx + v.y * dy) / length;
}

/**
 * Колело с радиус R (m), което се търкаля без плъзгане по хоризонтална права
 * под него. Центърът има скорост v_C (m/s) и ускорение a_C (m/s²) по оста x
 * (плюс надясно). Точката на допиране е МЦС, затова ω = −v_C/R и ε = −a_C/R:
 * при движение надясно колелото се върти по часовниковата стрелка (ω < 0).
 * `centre` е положението на центъра; по подразбиране (0; R), така че точката
 * на допиране е в началото.
 */
export function rollingWheel(input: {
  R: number;
  vC: number;
  aC?: number;
  centre?: Vec2;
}): RollingWheel {
  const { R, vC, aC = 0 } = input;
  assertPositive(R, "радиус на колелото");
  assertFinite(vC, "скорост на центъра");
  assertFinite(aC, "ускорение на центъра");
  const centre = input.centre ?? { x: 0, y: R };
  assertVec(centre, "център на колелото");
  // «+ 0» превръща −0 в 0 при покой
  return {
    omega: -vC / R + 0,
    epsilon: -aC / R + 0,
    contact: { x: centre.x, y: centre.y - R },
  };
}

/**
 * Коляно-мотовилков механизъм. Коляното OA = r се върти около O(0; 0) с
 * ъглова скорост ω₁ и ъглово ускорение ε₁ (по подразбиране 0); ъгълът му с
 * оста x е φ (в градуси). Мотовилката AB = l свързва A с плъзгача B, който се
 * движи по оста x вдясно от A.
 *
 * Геометрия: A = (r·cos φ; r·sin φ),  x_B = x_A + √(l² − y_A²).
 * Скорости:  v_A = ω₁ × OA;  от v_By = 0 → ω₂ = −v_Ay/(x_B − x_A).
 * Ускорения: a_A = ε₁ × OA − ω₁²·OA;  от a_By = 0 →
 *            ε₂ = (−a_Ay + ω₂²·(y_B − y_A))/(x_B − x_A).
 *
 * Грешка при l ≤ r·|sin φ| – мотовилката не стига до оста x или е
 * перпендикулярна на нея (тогава ω₂ не се определя от това уравнение).
 */
export function crankSlider(input: {
  r: number;
  l: number;
  phiDeg: number;
  omega1: number;
  epsilon1?: number;
}): CrankSlider {
  const { r, l, phiDeg, omega1, epsilon1 = 0 } = input;
  assertPositive(r, "дължина на коляното");
  assertPositive(l, "дължина на мотовилката");
  assertFinite(phiDeg, "ъгъл на коляното");
  assertFinite(omega1, "ъглова скорост на коляното");
  assertFinite(epsilon1, "ъглово ускорение на коляното");
  const phi = (phiDeg * Math.PI) / 180;
  const O: Vec2 = { x: 0, y: 0 };
  const A: Vec2 = { x: r * Math.cos(phi), y: r * Math.sin(phi) };
  if (l <= Math.abs(A.y)) {
    throw new Error(
      "Мотовилката е твърде къса за това положение: трябва l > r·|sin φ|.",
    );
  }
  const dx = Math.sqrt(l * l - A.y * A.y);
  const B: Vec2 = { x: A.x + dx, y: 0 };

  const vA = planeVelocity(O, omega1, O, A);
  const omega2 = -vA.y / dx;
  const vB = planeVelocity(vA, omega2, A, B);

  const aA = planeAcceleration(O, omega1, epsilon1, O, A);
  const epsilon2 = (-aA.y + omega2 * omega2 * (B.y - A.y)) / dx;
  const aB = planeAcceleration(aA, omega2, epsilon2, A, B);

  return { A, B, vA, aA, omega2, epsilon2, vB: vB.x, aB: aB.x };
}
