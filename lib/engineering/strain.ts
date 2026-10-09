/**
 * Деформирано състояние и обобщен закон на Хук за изотропен, линейно
 * еластичен материал при малки деформации.
 *
 * Мерни единици: напрежения и модули (E, G, K) в kN/cm² (1 kN/cm² = 10 MPa);
 * дължини в cm; деформациите са безразмерни; ъгловата деформация γ е в rad.
 *
 * Знаци: σ > 0 е опън; ε > 0 е удължение; обемна деформация θ > 0 е
 * увеличаване на обема. γ е инженерната ъглова деформация – цялото изменение
 * на първоначално правия ъгъл (не половината от него).
 */
import { G_STEEL } from "./torsion.ts";

/** Модул на еластичност на стоманата, kN/cm² (БДС EN 1993-1-1, т. 3.2.6: 210 000 N/mm²). */
export const E_STEEL = 21000;

/** Коефициент на Поасон на стоманата в еластичната област (БДС EN 1993-1-1, т. 3.2.6). */
export const NU_STEEL = 0.3;

export { G_STEEL };

/** Нормални напрежения по трите оси, kN/cm². */
export type Stress3 = { x: number; y: number; z: number };

/** Линейни деформации по трите оси. */
export type Strain3 = { x: number; y: number; z: number };

function assertModulus(E: number): void {
  if (!(E > 0)) {
    throw new Error("Модулът на еластичност трябва да е положителен.");
  }
}

/** Допустими стойности: −1 < ν ≤ 0,5 (за обичайните материали 0 ≤ ν ≤ 0,5). */
function assertPoisson(nu: number): void {
  if (!(nu > -1) || !(nu <= 0.5)) {
    throw new Error("Коефициентът на Поасон трябва да е между −1 и 0,5.");
  }
}

/** Напречна деформация при едноосно напрежение: ε′ = −ν·ε. */
export function lateralStrain(eps: number, nu: number): number {
  assertPoisson(nu);
  return -nu * eps;
}

/** Модул на срязване: G = E / (2·(1 + ν)), kN/cm². */
export function shearModulus(E: number, nu: number): number {
  assertModulus(E);
  assertPoisson(nu);
  return E / (2 * (1 + nu));
}

/** Коефициент на Поасон от двата модула: ν = E / (2·G) − 1. */
export function poissonFromModuli(E: number, G: number): number {
  assertModulus(E);
  if (!(G > 0)) {
    throw new Error("Модулът на срязване трябва да е положителен.");
  }
  const nu = E / (2 * G) - 1;
  assertPoisson(nu);
  return nu;
}

/** Обемен модул: K = E / (3·(1 − 2ν)), kN/cm². При ν = 0,5 не е определен. */
export function bulkModulus(E: number, nu: number): number {
  assertModulus(E);
  assertPoisson(nu);
  if (!(nu < 0.5)) {
    throw new Error("При ν = 0,5 материалът е несвиваем и K не е определен.");
  }
  return E / (3 * (1 - 2 * nu));
}

/**
 * Обобщен закон на Хук (тримерно напрегнато състояние):
 * ε_x = [σ_x − ν·(σ_y + σ_z)] / E и аналогично за другите две оси.
 */
export function hookeStrains(stress: Stress3, E: number, nu: number): Strain3 {
  assertModulus(E);
  assertPoisson(nu);
  const { x, y, z } = stress;
  return {
    x: (x - nu * (y + z)) / E,
    y: (y - nu * (z + x)) / E,
    z: (z - nu * (x + y)) / E,
  };
}

/**
 * Обратният обобщен закон на Хук: напреженията от трите линейни деформации.
 * σ_x = 2G·ε_x + λ·θ, където λ = E·ν / ((1 + ν)·(1 − 2ν)) и θ = ε_x + ε_y + ε_z.
 * При ν = 0,5 не е определен (несвиваем материал).
 */
export function hookeStresses(strain: Strain3, E: number, nu: number): Stress3 {
  assertModulus(E);
  assertPoisson(nu);
  if (!(nu < 0.5)) {
    throw new Error(
      "При ν = 0,5 напреженията не се определят от деформациите.",
    );
  }
  const twoG = E / (1 + nu);
  const lambda = (E * nu) / ((1 + nu) * (1 - 2 * nu));
  const theta = strain.x + strain.y + strain.z;
  return {
    x: twoG * strain.x + lambda * theta,
    y: twoG * strain.y + lambda * theta,
    z: twoG * strain.z + lambda * theta,
  };
}

/** Двумерно (равнинно) напрегнато състояние, σ_z = 0: трите линейни деформации. */
export function planeStressStrains(
  sigmaX: number,
  sigmaY: number,
  E: number,
  nu: number,
): Strain3 {
  return hookeStrains({ x: sigmaX, y: sigmaY, z: 0 }, E, nu);
}

/**
 * Двумерно напрегнато състояние, обратно: σ_x = E·(ε_x + ν·ε_y) / (1 − ν²),
 * σ_y = E·(ε_y + ν·ε_x) / (1 − ν²).
 */
export function planeStressStresses(
  epsX: number,
  epsY: number,
  E: number,
  nu: number,
): { x: number; y: number } {
  assertModulus(E);
  assertPoisson(nu);
  const k = E / (1 - nu * nu);
  return { x: k * (epsX + nu * epsY), y: k * (epsY + nu * epsX) };
}

/** Равнинно деформирано състояние (ε_z = 0): σ_z = ν·(σ_x + σ_y). */
export function planeStrainSigmaZ(
  sigmaX: number,
  sigmaY: number,
  nu: number,
): number {
  assertPoisson(nu);
  return nu * (sigmaX + sigmaY);
}

/** Обемна деформация като сбор на трите линейни: θ = ε_x + ε_y + ε_z. */
export function volumetricStrain(strain: Strain3): number {
  return strain.x + strain.y + strain.z;
}

/** Обемна деформация от напреженията: θ = (1 − 2ν)·(σ_x + σ_y + σ_z) / E. */
export function volumetricStrainFromStress(
  stress: Stress3,
  E: number,
  nu: number,
): number {
  assertModulus(E);
  assertPoisson(nu);
  return ((1 - 2 * nu) * (stress.x + stress.y + stress.z)) / E;
}

/** Закон на Хук при срязване: γ = τ / G, rad (знакът следва знака на τ). */
export function shearStrain(tau: number, G: number): number {
  if (!(G > 0)) {
    throw new Error("Модулът на срязване трябва да е положителен.");
  }
  return tau / G;
}

/** Промяна на размер с начална дължина `length`: Δl = ε·l (в единиците на l). */
export function sizeChange(length: number, eps: number): number {
  if (!(length > 0)) {
    throw new Error("Дължината трябва да е положителна.");
  }
  return eps * length;
}

/**
 * Линейна деформация по направление под ъгъл α (в градуси, от оста x към оста y):
 * ε_α = ε_x·cos²α + ε_y·sin²α + γ_xy·sinα·cosα.
 * γ_xy > 0, когато правият ъгъл между положителните оси x и y намалява.
 */
export function strainAtAngle(
  epsX: number,
  epsY: number,
  gammaXY: number,
  alphaDeg: number,
): number {
  const a = (alphaDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return epsX * c * c + epsY * s * s + gammaXY * s * c;
}

/**
 * Едноосно напрежение σ при възпрепятствана напречна деформация.
 * `confined` = 1: една напречна посока е спряна (ε = 0), другата е свободна;
 * `confined` = 2: и двете напречни посоки са спрени.
 * Връща напрежението в спряната посока (или посоки), деформацията по посоката
 * на σ и деформацията в свободната напречна посока (0 при `confined` = 2).
 */
export function confinedCompression(
  sigma: number,
  E: number,
  nu: number,
  confined: 1 | 2,
): { lateralStress: number; axialStrain: number; freeLateralStrain: number } {
  assertModulus(E);
  assertPoisson(nu);
  if (confined === 1) {
    // ε_спряна = (σ_с − ν·σ)/E = 0  →  σ_с = ν·σ
    const lateralStress = nu * sigma;
    return {
      lateralStress,
      axialStrain: (sigma - nu * lateralStress) / E,
      freeLateralStrain: (-nu * (sigma + lateralStress)) / E,
    };
  }
  if (!(nu < 0.5)) {
    throw new Error(
      "При ν = 0,5 напълно обхванатият материал не се деформира.",
    );
  }
  // ε_с = (σ_с − ν·(σ_с + σ))/E = 0  →  σ_с = ν·σ / (1 − ν)
  const lateralStress = (nu * sigma) / (1 - nu);
  return {
    lateralStress,
    axialStrain: (sigma - 2 * nu * lateralStress) / E,
    freeLateralStrain: 0,
  };
}
