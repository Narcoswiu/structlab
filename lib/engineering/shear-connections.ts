/**
 * Чисто срязване и класически (учебни) проверки на болтови, нитови и
 * заваръчни съединения с ДОПУСТИМИ напрежения.
 *
 * Мерни единици: сили в kN; диаметри, дебелини, ширини и дължини в cm;
 * площи в cm²; напрежения и модули в kN/cm² (1 kN/cm² = 10 MPa); ъгли в rad.
 *
 * Знаци: силата F в съединението и всички напрежения тук са по големина
 * (положителни числа). Напречната сила Q в `averageShearStress` е със знак
 * (Q > 0, когато върти отрязаната част по часовниковата стрелка) и
 * тангенциалното напрежение следва знака ѝ.
 *
 * Допустимите напрежения са дадени на задачата. Функциите не съдържат
 * нормативни стойности и не заместват проверките по действащите норми.
 */

/** 1 kN/cm² = 10 MPa */
const MPA_PER_KN_CM2 = 10;

/** Приетото в учебните задачи отношение a/k за ъглов шев (≈ cos 45° = 0,707). */
export const WELD_THROAT_FACTOR = 0.7;

function requirePositive(value: number, name: string): void {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new Error(`${name} трябва да е положително число.`);
  }
}

function requireCount(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} трябва да е цяло число, поне 1.`);
  }
}

/** kN/cm² → MPa */
export function toMPa(stress: number): number {
  return stress * MPA_PER_KN_CM2;
}

/** MPa → kN/cm² */
export function fromMPa(stress: number): number {
  return stress / MPA_PER_KN_CM2;
}

/** Площ на напречното сечение на стеблото: A = π·d²/4, cm². */
export function boltArea(d: number): number {
  requirePositive(d, "Диаметърът");
  return (Math.PI * d * d) / 4;
}

/**
 * Средно тангенциално напрежение при срязване: τ = Q / A, kN/cm².
 * Запазва знака на Q.
 */
export function averageShearStress(Q: number, A: number): number {
  if (!Number.isFinite(Q)) throw new Error("Силата трябва да е число.");
  requirePositive(A, "Площта");
  return Q / A;
}

/** Модул на срязване от E и коефициента на Поасон: G = E / (2·(1 + ν)). */
export function shearModulus(E: number, nu: number): number {
  requirePositive(E, "Модулът на еластичност");
  if (!(nu >= 0) || !(nu <= 0.5)) {
    throw new Error("Коефициентът на Поасон трябва да е между 0 и 0,5.");
  }
  return E / (2 * (1 + nu));
}

/** Закон на Хук при срязване: γ = τ / G, rad (със знака на τ). */
export function shearStrain(tau: number, G: number): number {
  if (!Number.isFinite(tau)) throw new Error("Напрежението трябва да е число.");
  requirePositive(G, "Модулът на срязване");
  return tau / G;
}

/**
 * Взаимно преместване на две успоредни сечения на разстояние h (cm):
 * Δs = γ·h = Q·h / (G·A), cm.
 */
export function shearDisplacement(
  Q: number,
  h: number,
  G: number,
  A: number,
): number {
  requirePositive(h, "Разстоянието между сеченията");
  return shearStrain(averageShearStress(Q, A), G) * h;
}

/**
 * Срязване на болтовете (нитовете): τ = F / (n·m·π·d²/4), kN/cm².
 * n – брой болтове; m – брой срезове на един болт (1 или 2).
 */
export function boltShearStress(
  F: number,
  n: number,
  m: number,
  d: number,
): number {
  requirePositive(F, "Силата");
  requireCount(n, "Броят на болтовете");
  requireCount(m, "Броят на срезовете");
  return F / (n * m * boltArea(d));
}

/**
 * Дебелината, която влиза в проверката на смачкване при двусрезно
 * съединение: по-малката от дебелината на средната планка и сбора от
 * дебелините на двете накладки.
 */
export function bearingThickness(tMiddle: number, tCover: number): number {
  requirePositive(tMiddle, "Дебелината на средната планка");
  requirePositive(tCover, "Дебелината на накладката");
  return Math.min(tMiddle, 2 * tCover);
}

/**
 * Смачкване на стената на отвора: σ_см = F / (n·d·t), kN/cm².
 * Площта d·t е условна – проекцията на допирната повърхност.
 */
export function bearingStress(
  F: number,
  n: number,
  d: number,
  t: number,
): number {
  requirePositive(F, "Силата");
  requireCount(n, "Броят на болтовете");
  requirePositive(d, "Диаметърът");
  requirePositive(t, "Дебелината");
  return F / (n * d * t);
}

/**
 * Площ на отслабеното сечение на планка: A_нето = (b − n₁·d₀)·t, cm².
 * `holes` е броят на отворите в едно напречно сечение, d₀ – диаметърът им.
 */
export function netArea(
  b: number,
  t: number,
  holes: number,
  d0: number,
): number {
  requirePositive(b, "Ширината");
  requirePositive(t, "Дебелината");
  if (!Number.isInteger(holes) || holes < 0) {
    throw new Error("Броят на отворите трябва да е цяло неотрицателно число.");
  }
  if (holes > 0) requirePositive(d0, "Диаметърът на отвора");
  const width = b - holes * d0;
  if (!(width > 0)) {
    throw new Error("Отворите заемат цялата ширина на планката.");
  }
  return width * t;
}

/** Опън в отслабеното сечение: σ = F / A_нето, kN/cm². */
export function netSectionStress(
  F: number,
  b: number,
  t: number,
  holes: number,
  d0: number,
): number {
  requirePositive(F, "Силата");
  return F / netArea(b, t, holes, d0);
}

export type JointCheckName = "shear" | "bearing" | "net";

export type BoltedJoint = {
  /** сила в съединението, kN */
  F: number;
  /** брой болтове */
  n: number;
  /** брой срезове на един болт: 1 или 2 */
  m: number;
  /** диаметър на стеблото, cm */
  d: number;
  /** дебелина за смачкването, cm (виж `bearingThickness`) */
  tBearing: number;
  /** ширина на проверяваната планка, cm */
  b: number;
  /** дебелина на проверяваната планка (или сбор от накладките), cm */
  tPlate: number;
  /** брой отвори в едно напречно сечение */
  holes: number;
  /** диаметър на отвора, cm */
  d0: number;
  /** допустимо напрежение на срязване на болта, kN/cm² */
  tauAllow: number;
  /** допустимо напрежение на смачкване, kN/cm² */
  bearingAllow: number;
  /** допустимо напрежение на опън на планката, kN/cm² */
  sigmaAllow: number;
};

export type JointCheck = {
  /** напрежения, kN/cm² */
  stress: Record<JointCheckName, number>;
  /** степен на използване = напрежение / допустимо */
  utilization: Record<JointCheckName, number>;
  /** допустима сила по всяка проверка, kN */
  capacity: Record<JointCheckName, number>;
  /** проверката с най-голяма степен на използване */
  governing: JointCheckName;
  /** най-малката от трите допустими сили, kN */
  allowableForce: number;
  /** изпълнени ли са и трите условия */
  ok: boolean;
};

/**
 * Трите проверки на болтово съединение: срязване на болтовете, смачкване
 * на стената на отвора и опън в отслабеното сечение. Приема се, че всички
 * болтове поемат силата по равно.
 */
export function checkBoltedJoint(joint: BoltedJoint): JointCheck {
  requirePositive(joint.tauAllow, "Допустимото напрежение на срязване");
  requirePositive(joint.bearingAllow, "Допустимото напрежение на смачкване");
  requirePositive(joint.sigmaAllow, "Допустимото напрежение на опън");
  const stress: Record<JointCheckName, number> = {
    shear: boltShearStress(joint.F, joint.n, joint.m, joint.d),
    bearing: bearingStress(joint.F, joint.n, joint.d, joint.tBearing),
    net: netSectionStress(
      joint.F,
      joint.b,
      joint.tPlate,
      joint.holes,
      joint.d0,
    ),
  };
  const allow: Record<JointCheckName, number> = {
    shear: joint.tauAllow,
    bearing: joint.bearingAllow,
    net: joint.sigmaAllow,
  };
  const names: JointCheckName[] = ["shear", "bearing", "net"];
  const utilization = {} as Record<JointCheckName, number>;
  const capacity = {} as Record<JointCheckName, number>;
  for (const name of names) {
    utilization[name] = stress[name] / allow[name];
    // напрежението е пропорционално на силата
    capacity[name] = joint.F / utilization[name];
  }
  const governing = names.reduce((worst, name) =>
    utilization[name] > utilization[worst] ? name : worst,
  );
  return {
    stress,
    utilization,
    capacity,
    governing,
    allowableForce: capacity[governing],
    // малък допуск срещу грешки от закръгляване при равенство
    ok: utilization[governing] <= 1 + 1e-12,
  };
}

export type RequiredBolts = {
  /** силата, която един болт носи на срязване, kN */
  shearPerBolt: number;
  /** силата, която един болт носи на смачкване, kN */
  bearingPerBolt: number;
  /** необходим (дробен) брой по срязване */
  byShear: number;
  /** необходим (дробен) брой по смачкване */
  byBearing: number;
  /** приет брой – по-големият, закръглен нагоре */
  n: number;
  governing: "shear" | "bearing";
};

/**
 * Необходим брой болтове по срязване и по смачкване:
 * n ≥ F / (m·A_б·τ_доп) и n ≥ F / (d·t·σ_см,доп).
 * Отслабеното сечение се проверява отделно, след подреждането на болтовете.
 */
export function requiredBolts(
  F: number,
  m: number,
  d: number,
  tBearing: number,
  tauAllow: number,
  bearingAllow: number,
): RequiredBolts {
  requirePositive(F, "Силата");
  requireCount(m, "Броят на срезовете");
  requirePositive(tBearing, "Дебелината");
  requirePositive(tauAllow, "Допустимото напрежение на срязване");
  requirePositive(bearingAllow, "Допустимото напрежение на смачкване");
  const shearPerBolt = m * boltArea(d) * tauAllow;
  const bearingPerBolt = d * tBearing * bearingAllow;
  const byShear = F / shearPerBolt;
  const byBearing = F / bearingPerBolt;
  const needed = Math.max(byShear, byBearing);
  return {
    shearPerBolt,
    bearingPerBolt,
    byShear,
    byBearing,
    // допускът пази от 3,0000000001 → 4
    n: Math.max(1, Math.ceil(needed - 1e-9)),
    governing: byShear >= byBearing ? "shear" : "bearing",
  };
}

/**
 * Изчислителна дебелина на ъглов шев с катет k: a = 0,7·k, cm.
 * Коефициентът 0,7 е приемане на учебната задача.
 */
export function weldThroat(k: number, factor = WELD_THROAT_FACTOR): number {
  requirePositive(k, "Катетът на шева");
  if (!(factor > 0) || !(factor <= 1)) {
    throw new Error("Коефициентът a/k трябва да е между 0 и 1.");
  }
  return factor * k;
}

/** Срязване на ъглов шев: τ_ш = F / (a·Σl), kN/cm². */
export function weldStress(F: number, a: number, totalLength: number): number {
  requirePositive(F, "Силата");
  requirePositive(a, "Дебелината на шева");
  requirePositive(totalLength, "Дължината на шева");
  return F / (a * totalLength);
}

/** Необходима обща дължина на шевовете: Σl ≥ F / (a·τ_доп,ш), cm. */
export function requiredWeldLength(
  F: number,
  a: number,
  tauAllow: number,
): number {
  requirePositive(F, "Силата");
  requirePositive(a, "Дебелината на шева");
  requirePositive(tauAllow, "Допустимото напрежение на шева");
  return F / (a * tauAllow);
}

/** Допустима сила на шевовете: F_доп = a·Σl·τ_доп,ш, kN. */
export function weldCapacity(
  a: number,
  totalLength: number,
  tauAllow: number,
): number {
  requirePositive(a, "Дебелината на шева");
  requirePositive(totalLength, "Дължината на шева");
  requirePositive(tauAllow, "Допустимото напрежение на шева");
  return a * totalLength * tauAllow;
}

/**
 * Сила за пробиване на кръгъл отвор с диаметър d в лист с дебелина t:
 * F = π·d·t·τ_в, kN. Срязва се цилиндричната повърхност π·d·t;
 * τ_в е якостта на срязване на материала (дадена).
 */
export function punchingForce(
  d: number,
  t: number,
  tauStrength: number,
): number {
  requirePositive(d, "Диаметърът");
  requirePositive(t, "Дебелината");
  requirePositive(tauStrength, "Якостта на срязване");
  return Math.PI * d * t * tauStrength;
}
