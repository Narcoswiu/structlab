import { internalForces, keyPoints, type Beam } from "./beam.ts";

/**
 * Деформации при огъване – еластична линия.
 *
 * Мерни единици:
 *   сили в kN, разпределен товар в kN/m, моменти в kN·m, дължини по оста в m;
 *   E в kN/cm², I в cm⁴; коравината E·I се подава на функциите в kN·m²
 *   (виж `flexuralRigidity`);
 *   провисванията се връщат в МЕТРИ (за сантиметри – `toCm`), ъглите – в радиани.
 *
 * Знаци (както в целия учебник):
 *   M > 0 опъва долните влакна; провисването w е положително НАДОЛУ;
 *   ъгълът на завъртане φ = w′ е положителен по часовниковата стрелка.
 *   Диференциалното уравнение е E·I·w″ = −M(x).
 */

/** kN·cm² → kN·m² */
const KNCM2_TO_KNM2 = 1e-4;

function requirePositive(value: number, name: string) {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new Error(`${name} трябва да е положително число.`);
  }
}

function requireFinite(value: number, name: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} трябва да е число.`);
  }
}

/** Метри → сантиметри. */
export function toCm(metres: number): number {
  return metres * 100;
}

/** Радиани → градуси. */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Инерционен момент на правоъгълник b×h спрямо централната ос, успоредна на b: b·h³/12, в cm⁴. */
export function rectangleInertia(b: number, h: number): number {
  requirePositive(b, "Ширината");
  requirePositive(h, "Височината");
  return (b * h ** 3) / 12;
}

/** Коравина на огъване E·I: E в kN/cm², I в cm⁴ → резултат в kN·m². */
export function flexuralRigidity(E: number, I: number): number {
  requirePositive(E, "Модулът на еластичност");
  requirePositive(I, "Инерционният момент");
  return E * I * KNCM2_TO_KNM2;
}

export type StandardCase =
  /** конзола, сила F [kN] в свободния край */
  | "cantilever-force"
  /** конзола, равномерен товар q [kN/m] по цялата дължина */
  | "cantilever-distributed"
  /** конзола, момент M [kN·m] в свободния край */
  | "cantilever-moment"
  /** проста греда, сила F [kN] в средата */
  | "simple-force-mid"
  /** проста греда, равномерен товар q [kN/m] по целия отвор */
  | "simple-distributed";

export type StandardResult = {
  /** най-голямото провисване, m */
  f: number;
  /** ъгъл на завъртане: в свободния край (конзола) или при опората (проста греда), rad */
  phi: number;
};

/**
 * Типовите случаи при E·I = const.
 * `load` е F, q или M според случая; `l` в m; `EI` в kN·m².
 */
export function standardDeflection(
  kind: StandardCase,
  load: number,
  l: number,
  EI: number,
): StandardResult {
  requireFinite(load, "Товарът");
  requirePositive(l, "Дължината");
  requirePositive(EI, "Коравината E·I");
  switch (kind) {
    case "cantilever-force":
      return { f: (load * l ** 3) / (3 * EI), phi: (load * l ** 2) / (2 * EI) };
    case "cantilever-distributed":
      return { f: (load * l ** 4) / (8 * EI), phi: (load * l ** 3) / (6 * EI) };
    case "cantilever-moment":
      return { f: (load * l ** 2) / (2 * EI), phi: (load * l) / EI };
    case "simple-force-mid":
      return {
        f: (load * l ** 3) / (48 * EI),
        phi: (load * l ** 2) / (16 * EI),
      };
    case "simple-distributed":
      return {
        f: (5 * load * l ** 4) / (384 * EI),
        phi: (load * l ** 3) / (24 * EI),
      };
    default:
      throw new Error("Непознат типов случай.");
  }
}

/**
 * Проста греда с равномерен товар q по целия отвор: провисването в сечение x,
 * w(x) = q·(x⁴ − 2·l·x³ + l³·x) / (24·E·I), в m.
 */
export function simpleBeamDistributedAt(
  q: number,
  l: number,
  EI: number,
  x: number,
): number {
  requireFinite(q, "Товарът");
  requirePositive(l, "Отворът");
  requirePositive(EI, "Коравината E·I");
  if (!(x >= 0 && x <= l)) throw new Error("Сечение извън гредата.");
  return (q * (x ** 4 - 2 * l * x ** 3 + l ** 3 * x)) / (24 * EI);
}

export type OffCentreResult = {
  /** провисване под силата, m */
  underLoad: number;
  /** най-голямото провисване, m */
  max: number;
  /** разстояние от опора A до сечението с най-голямо провисване, m */
  xMax: number;
  /** ъгъл на завъртане при опора A (по часовниковата стрелка), rad */
  phiA: number;
  /** ъгъл на завъртане при опора B (отрицателен = обратно на часовниковата), rad */
  phiB: number;
};

/**
 * Проста греда с отвор l и сила F на разстояние a от лявата опора A (b = l − a).
 * Под силата: F·a²·b²/(3·E·I·l). Най-голямото провисване е в по-дългия участък.
 */
export function simpleBeamOffCentreForce(
  F: number,
  a: number,
  l: number,
  EI: number,
): OffCentreResult {
  requireFinite(F, "Силата");
  requirePositive(l, "Отворът");
  requirePositive(EI, "Коравината E·I");
  if (!(a > 0 && a < l)) {
    throw new Error("Силата трябва да е вътре в отвора (0 < a < l).");
  }
  const b = l - a;
  const underLoad = (F * a ** 2 * b ** 2) / (3 * EI * l);
  // по-късото рамо s; максимумът е на √((l² − s²)/3) от опората в края на по-дългия участък
  const s = Math.min(a, b);
  const fromFarSupport = Math.sqrt((l ** 2 - s ** 2) / 3);
  const max = (F * s * (l ** 2 - s ** 2) ** 1.5) / (9 * Math.sqrt(3) * EI * l);
  const xMax = a <= b ? l - fromFarSupport : fromFarSupport;
  return {
    underLoad,
    max,
    xMax,
    phiA: (F * a * b * (l + b)) / (6 * EI * l),
    phiB: -(F * a * b * (l + a)) / (6 * EI * l),
  };
}

/**
 * Проста греда с отвор l и момент M в дясната опора B, който опъва долните влакна
 * (M(x) = M·x/l). Най-голямото провисване M·l²/(9·√3·E·I) е на l/√3 от A.
 */
export function simpleBeamEndMoment(
  M: number,
  l: number,
  EI: number,
): { max: number; xMax: number; phiA: number; phiB: number } {
  requireFinite(M, "Моментът");
  requirePositive(l, "Отворът");
  requirePositive(EI, "Коравината E·I");
  return {
    max: (M * l ** 2) / (9 * Math.sqrt(3) * EI),
    xMax: l / Math.sqrt(3),
    phiA: (M * l) / (6 * EI),
    phiB: -(M * l) / (3 * EI),
  };
}

export type CurvePoint = {
  /** сечение, m */
  x: number;
  /** провисване (надолу положително), m */
  w: number;
  /** ъгъл на завъртане (по часовниковата положителен), rad */
  phi: number;
};

/**
 * Еластичната линия на статически определима греда с постоянна коравина –
 * числено двойно интегриране на E·I·w″ = −M(x).
 *
 * Между две съседни характерни точки M(x) е полином най-много от втора степен.
 * Затова формулата на Симпсън дава интегралите точно (до закръглението), стига
 * характерните точки да са възли на мрежата – което е осигурено.
 *
 * Гранични условия: проста греда – w = 0 в двете опори; конзола – w = 0 и φ = 0
 * в запъването. `steps` е броят на деленията на всеки участък.
 */
export function elasticCurve(
  beam: Beam,
  EI: number,
  steps: number = 40,
): CurvePoint[] {
  requirePositive(EI, "Коравината E·I");
  if (!Number.isInteger(steps) || steps < 1) {
    throw new Error("Броят на деленията трябва да е цяло положително число.");
  }
  const points = keyPoints(beam);

  // Първо се интегрира с нулеви начални стойности в x = 0 (φ₀ = 0, w₀ = 0).
  const raw: CurvePoint[] = [{ x: 0, w: 0, phi: 0 }];
  let phi = 0;
  let w = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const h = (b - a) / steps;
    for (let k = 0; k < steps; k++) {
      const x0 = a + k * h;
      const x1 = k === steps - 1 ? b : x0 + h;
      const m0 = internalForces(beam, x0, "right").M;
      const mm = internalForces(beam, (x0 + x1) / 2, "right").M;
      const m1 = internalForces(beam, x1, "left").M;
      const step = x1 - x0;
      // ∫M до средата и до края на стъпката (точно за парабола)
      const toMid = (step / 24) * (5 * m0 + 8 * mm - m1);
      const toEnd = (step / 6) * (m0 + 4 * mm + m1);
      const phiMid = phi - toMid / EI;
      const phiEnd = phi - toEnd / EI;
      // ∫φ по Симпсън (точно за полином от трета степен)
      w += (step / 6) * (phi + 4 * phiMid + phiEnd);
      phi = phiEnd;
      raw.push({ x: x1, w, phi });
    }
  }

  // Общото решение е w̃(x) + C·x + D; C и D се намират от граничните условия.
  let C: number;
  let D: number;
  const at = (x: number): CurvePoint => {
    const found = raw.find((p) => Math.abs(p.x - x) < 1e-12);
    if (!found) throw new Error("Опората не е възел на мрежата.");
    return found;
  };
  if (beam.supports.type === "cantilever") {
    const x0 = beam.supports.fixedAt === "left" ? 0 : beam.length;
    const fixed = at(x0);
    C = -fixed.phi;
    D = -fixed.w - C * x0;
  } else {
    const A = at(beam.supports.xA);
    const B = at(beam.supports.xB);
    if (A.x === B.x) throw new Error("Двете опори съвпадат.");
    C = -(B.w - A.w) / (B.x - A.x);
    D = -A.w - C * A.x;
  }
  return raw.map((p) => ({ x: p.x, w: p.w + C * p.x + D, phi: p.phi + C }));
}

/** Най-голямото по абсолютна стойност провисване и мястото му (по мрежата на `elasticCurve`). */
export function maxDeflection(
  beam: Beam,
  EI: number,
  steps: number = 400,
): { x: number; w: number } {
  const curve = elasticCurve(beam, EI, steps);
  const best = curve.reduce((a, b) => (Math.abs(b.w) > Math.abs(a.w) ? b : a));
  return { x: best.x, w: best.w };
}

/**
 * Условие за коравина f ≤ f_доп. Връща и запаса f_доп/f.
 * Двете стойности са в една и съща мерна единица.
 */
export function stiffnessCheck(
  f: number,
  fAllow: number,
): { ok: boolean; ratio: number } {
  requirePositive(fAllow, "Допустимото провисване");
  requireFinite(f, "Провисването");
  const abs = Math.abs(f);
  return { ok: abs <= fAllow, ratio: abs === 0 ? Infinity : fAllow / abs };
}

/**
 * Най-малкият инерционен момент на проста греда с равномерен товар, за да е
 * f ≤ l/`ratio`: I ≥ 5·q·l³·ratio / (384·E).
 * q в kN/m, l в m, E в kN/cm²; резултатът е в cm⁴.
 */
export function requiredInertiaForDeflection(
  q: number,
  l: number,
  E: number,
  ratio: number,
): number {
  requirePositive(q, "Товарът");
  requirePositive(l, "Отворът");
  requirePositive(E, "Модулът на еластичност");
  requirePositive(ratio, "Отношението l/f");
  const qCm = q / 100; // kN/m → kN/cm
  const lCm = l * 100; // m → cm
  return (5 * qCm * lCm ** 3 * ratio) / (384 * E);
}
