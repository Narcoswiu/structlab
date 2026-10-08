/**
 * Общо (двойно) огъване: огъващият момент има съставки по двете главни оси.
 *
 * Мерни единици: моменти в kN·m, I в cm⁴, W в cm³, разстояния в cm,
 * напрежения в kN/cm² (1 kN/cm² = 10 MPa).
 *
 * Знаци: оста x сочи надясно, оста y – НАДОЛУ, началото е в центъра на
 * тежестта. M_x > 0 опъва долните влакна (y > 0), M_y > 0 опъва десните
 * влакна (x > 0). σ > 0 е опън.
 */

const KNM_TO_KNCM = 100;

export type BiaxialMoments = { Mx: number; My: number };

/**
 * Разлага момент M, чиято товарна равнина е наклонена на ъгъл α (в градуси)
 * спрямо оста y: M_x = M·cos α, M_y = M·sin α.
 */
export function resolveMoment(M: number, alphaDegrees: number): BiaxialMoments {
  const alpha = (alphaDegrees * Math.PI) / 180;
  return { Mx: M * Math.cos(alpha), My: M * Math.sin(alpha) };
}

/** σ = M_x·y/I_x + M_y·x/I_y в точка (x, y). */
export function biaxialStress(
  moments: BiaxialMoments,
  section: { Ix: number; Iy: number },
  x: number,
  y: number,
): number {
  if (!(section.Ix > 0) || !(section.Iy > 0)) {
    throw new Error("Инерционните моменти трябва да са положителни.");
  }
  return (
    (moments.Mx * KNM_TO_KNCM * y) / section.Ix +
    (moments.My * KNM_TO_KNCM * x) / section.Iy
  );
}

/**
 * Най-голямото напрежение (по големина) в сечение с две оси на симетрия и
 * изпъкнали ъгли (правоъгълник, „I“): σ_max = |M_x|/W_x + |M_y|/W_y.
 */
export function maxBiaxialStress(
  moments: BiaxialMoments,
  moduli: { Wx: number; Wy: number },
): number {
  if (!(moduli.Wx > 0) || !(moduli.Wy > 0)) {
    throw new Error("Съпротивителните моменти трябва да са положителни.");
  }
  return (
    (Math.abs(moments.Mx) * KNM_TO_KNCM) / moduli.Wx +
    (Math.abs(moments.My) * KNM_TO_KNCM) / moduli.Wy
  );
}

export type CornerStresses = {
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
};

/** Напреженията в четирите ъгъла на правоъгълник b×h. */
export function rectangleCornerStresses(
  moments: BiaxialMoments,
  b: number,
  h: number,
): CornerStresses {
  const section = { Ix: (b * h ** 3) / 12, Iy: (h * b ** 3) / 12 };
  const at = (x: number, y: number) => biaxialStress(moments, section, x, y);
  return {
    topLeft: at(-b / 2, -h / 2),
    topRight: at(b / 2, -h / 2),
    bottomLeft: at(-b / 2, h / 2),
    bottomRight: at(b / 2, h / 2),
  };
}

/**
 * Ъгъл β между неутралната ос и оста x, в градуси (0…90):
 * tg β = (I_x / I_y) · |M_y / M_x|. При M_x = 0 неутралната ос е оста y (90°).
 */
export function neutralAxisAngle(
  moments: BiaxialMoments,
  section: { Ix: number; Iy: number },
): number {
  if (moments.Mx === 0) return moments.My === 0 ? 0 : 90;
  const tan = (section.Ix / section.Iy) * Math.abs(moments.My / moments.Mx);
  return (Math.atan(tan) * 180) / Math.PI;
}
