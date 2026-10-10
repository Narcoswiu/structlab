/**
 * Масов център и масови инерционни моменти (Теоретична механика – II част,
 * Глава 7).
 *
 * Мерни единици: дължини в m, маса в kg, масов инерционен момент в kg·m²,
 * тегло в N. ВНИМАНИЕ: останалите файлове в lib/engineering работят в kN и
 * cm⁴. Тук J е МАСОВ инерционен момент (kg·m²), а не геометричният I (cm⁴)
 * на сечение от „Съпротивление на материалите“.
 *
 * Оси: x надясно, y нагоре, z към наблюдателя. „Спрямо ос z“ означава ос,
 * успоредна на z, през посочената точка от равнината xy. Инерционният момент
 * няма знак – винаги е положителен. Разстоянията между оси са големини (≥ 0).
 *
 * Телата са идеално твърди и еднородни. „Тънък“ прът и „тънка“ плоча значи,
 * че дебелината се пренебрегва.
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

/** Тегло G = m·g в N; масата е в kg. За kN резултатът се дели на 1000. */
export function weight(massKg: number): number {
  assertPositive(massKg, "маса");
  return massKg * G_ACCELERATION;
}

/** Материална точка или масов център на тяло: маса в kg, координати в m. */
export type MassPoint = {
  /** маса, kg (> 0) */
  mass: number;
  /** координата x, m */
  x: number;
  /** координата y, m */
  y: number;
  /** координата z, m (по подразбиране 0) */
  z?: number;
};

export type MassCentre = {
  /** обща маса m = Σ m_i, kg */
  mass: number;
  /** x_C = Σ m_i·x_i / m, m */
  x: number;
  /** y_C = Σ m_i·y_i / m, m */
  y: number;
  /** z_C = Σ m_i·z_i / m, m */
  z: number;
};

/**
 * Масов център на система от материални точки или от тела (за тяло се подават
 * масата му и координатите на неговия масов център): r_C = Σ m_i·r_i / m.
 */
export function massCentre(parts: MassPoint[]): MassCentre {
  if (parts.length === 0) {
    throw new Error("Системата трябва да има поне една маса.");
  }
  let mass = 0;
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (const part of parts) {
    assertPositive(part.mass, "маса");
    assertFinite(part.x, "x");
    assertFinite(part.y, "y");
    const z = part.z ?? 0;
    assertFinite(z, "z");
    mass += part.mass;
    sx += part.mass * part.x;
    sy += part.mass * part.y;
    sz += part.mass * z;
  }
  return { mass, x: sx / mass, y: sy / mass, z: sz / mass };
}

/** Материална точка на разстояние r от оста: J = m·r², kg·m². */
export function pointInertia(mass: number, r: number): number {
  assertPositive(mass, "маса");
  assertNonNegative(r, "разстояние до оста");
  return mass * r * r;
}

/** Тънък прът с дължина l, ос през средата, перпендикулярна на пръта: m·l²/12. */
export function rodInertiaCentre(mass: number, length: number): number {
  assertPositive(mass, "маса");
  assertPositive(length, "дължина");
  return (mass * length * length) / 12;
}

/** Тънък прът с дължина l, ос през края, перпендикулярна на пръта: m·l²/3. */
export function rodInertiaEnd(mass: number, length: number): number {
  assertPositive(mass, "маса");
  assertPositive(length, "дължина");
  return (mass * length * length) / 3;
}

/** Тънък пръстен с радиус R, ос през центъра, перпендикулярна на равнината му: m·R². */
export function ringInertia(mass: number, radius: number): number {
  assertPositive(mass, "маса");
  assertPositive(radius, "радиус");
  return mass * radius * radius;
}

/** Диск с радиус R, ос през центъра, перпендикулярна на равнината му: m·R²/2. */
export function discInertia(mass: number, radius: number): number {
  assertPositive(mass, "маса");
  assertPositive(radius, "радиус");
  return (mass * radius * radius) / 2;
}

/** Тънък диск спрямо свой диаметър: m·R²/4. */
export function discInertiaDiameter(mass: number, radius: number): number {
  assertPositive(mass, "маса");
  assertPositive(radius, "радиус");
  return (mass * radius * radius) / 4;
}

export type PlateInertia = {
  /** спрямо централната ос x (успоредна на страната a): m·b²/12 */
  jx: number;
  /** спрямо централната ос y (успоредна на страната b): m·a²/12 */
  jy: number;
  /** спрямо централната ос z, перпендикулярна на плочата: m·(a² + b²)/12 */
  jz: number;
};

/**
 * Тънка правоъгълна плоча със страна a по x и страна b по y; осите минават
 * през масовия център. Всички резултати са в kg·m².
 */
export function plateInertia(mass: number, a: number, b: number): PlateInertia {
  assertPositive(mass, "маса");
  assertPositive(a, "страна a");
  assertPositive(b, "страна b");
  const jx = (mass * b * b) / 12;
  const jy = (mass * a * a) / 12;
  return { jx, jy, jz: jx + jy };
}

/** Плътен кръгов цилиндър спрямо собствената си ос: m·R²/2 (височината не влиза). */
export function cylinderInertia(mass: number, radius: number): number {
  return discInertia(mass, radius);
}

/**
 * Кух цилиндър (тръба) с външен радиус R и вътрешен r спрямо собствената си
 * ос: m·(R² + r²)/2. При r = 0 е плътен цилиндър, при r → R е тънък пръстен.
 */
export function hollowCylinderInertia(
  mass: number,
  outerRadius: number,
  innerRadius: number,
): number {
  assertPositive(mass, "маса");
  assertPositive(outerRadius, "външен радиус");
  assertNonNegative(innerRadius, "вътрешен радиус");
  if (innerRadius >= outerRadius) {
    throw new Error("Вътрешният радиус трябва да е по-малък от външния.");
  }
  return (mass * (outerRadius * outerRadius + innerRadius * innerRadius)) / 2;
}

/**
 * Плътен цилиндър с радиус R и дължина l спрямо напречна ос през масовия
 * център: m·(l²/12 + R²/4). При R → 0 остава формулата за тънък прът.
 */
export function cylinderInertiaTransverse(
  mass: number,
  radius: number,
  length: number,
): number {
  assertPositive(mass, "маса");
  assertNonNegative(radius, "радиус");
  assertPositive(length, "дължина");
  return mass * ((length * length) / 12 + (radius * radius) / 4);
}

/**
 * Теорема на Щайнер: от ЦЕНТРАЛНА ос (през масовия център) към успоредна ос
 * на разстояние d: J = J_C + m·d².
 */
export function parallelAxis(
  centralInertia: number,
  mass: number,
  distance: number,
): number {
  assertNonNegative(centralInertia, "централен инерционен момент");
  assertPositive(mass, "маса");
  assertNonNegative(distance, "разстояние между осите");
  return centralInertia + mass * distance * distance;
}

/**
 * Обратната посока: от ос на разстояние d от масовия център към успоредната
 * централна ос: J_C = J − m·d². Резултатът не може да е отрицателен.
 */
export function toCentralAxis(
  inertia: number,
  mass: number,
  distance: number,
): number {
  assertNonNegative(inertia, "инерционен момент");
  assertPositive(mass, "маса");
  assertNonNegative(distance, "разстояние между осите");
  const central = inertia - mass * distance * distance;
  if (central < -1e-12 * Math.max(1, inertia)) {
    throw new Error(
      "Данните са несъвместими: централният инерционен момент излиза отрицателен.",
    );
  }
  return Math.max(0, central);
}

/**
 * Между две успоредни НЕцентрални оси се минава през масовия център:
 * J₂ = J₁ − m·d₁² + m·d₂², където d₁ и d₂ са разстоянията на двете оси до
 * масовия център (не разстоянието между самите оси).
 */
export function betweenParallelAxes(
  inertia1: number,
  mass: number,
  distance1: number,
  distance2: number,
): number {
  return parallelAxis(
    toCentralAxis(inertia1, mass, distance1),
    mass,
    distance2,
  );
}

/** Радиус на инерция i = √(J/m), m. */
export function radiusOfGyration(inertia: number, mass: number): number {
  assertNonNegative(inertia, "инерционен момент");
  assertPositive(mass, "маса");
  return Math.sqrt(inertia / mass);
}

/** Точка от равнината xy, през която минава оста z; координати в m. */
export type AxisPoint = { x: number; y: number };

/**
 * Система от материални точки в равнината xy: J спрямо ос, успоредна на z,
 * през точката axis: J = Σ m_i·[(x_i − x₀)² + (y_i − y₀)²].
 */
export function pointsInertiaZ(points: MassPoint[], axis: AxisPoint): number {
  if (points.length === 0) {
    throw new Error("Системата трябва да има поне една маса.");
  }
  assertFinite(axis.x, "x на оста");
  assertFinite(axis.y, "y на оста");
  let sum = 0;
  for (const point of points) {
    assertPositive(point.mass, "маса");
    assertFinite(point.x, "x");
    assertFinite(point.y, "y");
    sum += point.mass * ((point.x - axis.x) ** 2 + (point.y - axis.y) ** 2);
  }
  return sum;
}

/** Част от съставно тяло: маса, собствен централен J_z и масов център. */
export type CompositePart = {
  /** маса, kg (> 0) */
  mass: number;
  /** инерционен момент спрямо оста z през собствения масов център, kg·m² */
  centralInertia: number;
  /** координати на собствения масов център, m */
  x: number;
  y: number;
};

export type CompositeResult = {
  /** обща маса, kg */
  mass: number;
  /** масов център на цялото тяло, m */
  centre: AxisPoint;
  /** J спрямо оста z през зададената точка, kg·m² */
  inertia: number;
  /** J спрямо оста z през масовия център на цялото тяло, kg·m² */
  centralInertia: number;
  /** радиус на инерция спрямо зададената ос, m */
  radius: number;
};

/**
 * Съставно плоско тяло: инерционните моменти на частите спрямо ЕДНА И СЪЩА
 * ос (успоредна на z, през точката axis) се събират; всяка част се пренася с
 * теоремата на Щайнер от собствения си масов център.
 */
export function compositeInertiaZ(
  parts: CompositePart[],
  axis: AxisPoint,
): CompositeResult {
  if (parts.length === 0) {
    throw new Error("Тялото трябва да има поне една част.");
  }
  assertFinite(axis.x, "x на оста");
  assertFinite(axis.y, "y на оста");
  const sumAbout = (point: AxisPoint) =>
    parts.reduce(
      (sum, part) =>
        sum +
        parallelAxis(
          part.centralInertia,
          part.mass,
          Math.hypot(part.x - point.x, part.y - point.y),
        ),
      0,
    );
  const centre = massCentre(parts);
  const inertia = sumAbout(axis);
  return {
    mass: centre.mass,
    centre: { x: centre.x, y: centre.y },
    inertia,
    centralInertia: sumAbout(centre),
    radius: Math.sqrt(inertia / centre.mass),
  };
}
