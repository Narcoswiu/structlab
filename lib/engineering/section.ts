/**
 * Геометрични характеристики на сечение, съставено от правоъгълници.
 *
 * Оста x е хоризонтална, оста y – вертикална. Размерите са в cm, площите в cm²,
 * инерционните моменти в cm⁴. Правоъгълник с `hole: true` се изважда (отвор).
 */
export type Rect = {
  /** ширина по x */
  b: number;
  /** височина по y */
  h: number;
  /** координати на долния ляв ъгъл в произволна начална система */
  x: number;
  y: number;
  hole?: boolean;
};

export type SectionProperties = {
  A: number;
  /** център на тежестта в началната система */
  xc: number;
  yc: number;
  /** инерционни моменти спрямо централните оси, успоредни на x и y */
  Ix: number;
  Iy: number;
  /** центробежен инерционен момент спрямо същите оси */
  Ixy: number;
  /** полярен инерционен момент спрямо центъра на тежестта */
  Ip: number;
  /** главни централни инерционни моменти, I1 ≥ I2 */
  I1: number;
  I2: number;
  /**
   * ъгъл от оста x до главната ос 1, в градуси, положителен обратно на
   * часовниковата стрелка; в интервала (−90°, 90°]
   */
  alpha: number;
  /** радиуси на инерция */
  ix: number;
  iy: number;
  /** разстояния от центъра на тежестта до най-отдалечените влакна */
  yTop: number;
  yBottom: number;
  xLeft: number;
  xRight: number;
  /** съпротивителни моменти спрямо оста x: за горното и за долното влакно */
  WxTop: number;
  WxBottom: number;
};

/** Ред от таблицата на Щайнер за един правоъгълник. */
export type SteinerRow = {
  A: number;
  /** собствен център на тежестта */
  x: number;
  y: number;
  /** собствени инерционни моменти */
  IxOwn: number;
  IyOwn: number;
  /** разстояния от собствения до общия център на тежестта */
  dx: number;
  dy: number;
  /** преносни членове A·d² и A·dx·dy */
  AdY2: number;
  AdX2: number;
  AdXdY: number;
};

function signedArea(rect: Rect): number {
  if (!(rect.b > 0) || !(rect.h > 0)) {
    throw new Error("Размерите на правоъгълника трябва да са положителни.");
  }
  return (rect.hole ? -1 : 1) * rect.b * rect.h;
}

export function centroid(rects: Rect[]): { A: number; xc: number; yc: number } {
  let A = 0;
  let Sx = 0; // статичен момент спрямо оста x: Σ A·y
  let Sy = 0;
  for (const rect of rects) {
    const a = signedArea(rect);
    A += a;
    Sx += a * (rect.y + rect.h / 2);
    Sy += a * (rect.x + rect.b / 2);
  }
  if (!(A > 0)) throw new Error("Площта на сечението трябва да е положителна.");
  return { A, xc: Sy / A, yc: Sx / A };
}

export function steinerTable(rects: Rect[]): SteinerRow[] {
  const { xc, yc } = centroid(rects);
  return rects.map((rect) => {
    const A = signedArea(rect);
    const sign = rect.hole ? -1 : 1;
    const x = rect.x + rect.b / 2;
    const y = rect.y + rect.h / 2;
    const dx = x - xc;
    const dy = y - yc;
    return {
      A,
      x,
      y,
      IxOwn: (sign * rect.b * rect.h ** 3) / 12,
      IyOwn: (sign * rect.h * rect.b ** 3) / 12,
      dx,
      dy,
      AdY2: A * dy * dy,
      AdX2: A * dx * dx,
      AdXdY: A * dx * dy,
    };
  });
}

export function sectionProperties(rects: Rect[]): SectionProperties {
  const { A, xc, yc } = centroid(rects);
  let Ix = 0;
  let Iy = 0;
  let Ixy = 0;
  for (const row of steinerTable(rects)) {
    // теорема на Щайнер; собственият центробежен момент на правоъгълник е нула
    Ix += row.IxOwn + row.AdY2;
    Iy += row.IyOwn + row.AdX2;
    Ixy += row.AdXdY;
  }

  const mean = (Ix + Iy) / 2;
  const radius = Math.hypot((Ix - Iy) / 2, Ixy);
  // tg 2α = −2·Ixy / (Ix − Iy); atan2 избира ъгъла на оста с по-големия момент
  const rawAlpha = (0.5 * Math.atan2(-2 * Ixy, Ix - Iy) * 180) / Math.PI;
  const alpha = Math.abs(rawAlpha) < 1e-9 ? 0 : rawAlpha;

  const solid = rects.filter((rect) => !rect.hole);
  const yTop = Math.max(...solid.map((r) => r.y + r.h)) - yc;
  const yBottom = yc - Math.min(...solid.map((r) => r.y));
  const xRight = Math.max(...solid.map((r) => r.x + r.b)) - xc;
  const xLeft = xc - Math.min(...solid.map((r) => r.x));

  return {
    A,
    xc,
    yc,
    Ix,
    Iy,
    Ixy,
    Ip: Ix + Iy,
    I1: mean + radius,
    I2: mean - radius,
    alpha,
    ix: Math.sqrt(Ix / A),
    iy: Math.sqrt(Iy / A),
    yTop,
    yBottom,
    xLeft,
    xRight,
    WxTop: Ix / yTop,
    WxBottom: Ix / yBottom,
  };
}

/**
 * Инерционни моменти спрямо централни оси, завъртени на ъгъл `degrees`
 * обратно на часовниковата стрелка.
 */
export function rotatedMoments(
  props: Pick<SectionProperties, "Ix" | "Iy" | "Ixy">,
  degrees: number,
): { Iu: number; Iv: number; Iuv: number } {
  const a = (degrees * Math.PI) / 180;
  const c2 = Math.cos(2 * a);
  const s2 = Math.sin(2 * a);
  const mean = (props.Ix + props.Iy) / 2;
  const half = (props.Ix - props.Iy) / 2;
  return {
    Iu: mean + half * c2 - props.Ixy * s2,
    Iv: mean - half * c2 + props.Ixy * s2,
    Iuv: half * s2 + props.Ixy * c2,
  };
}
