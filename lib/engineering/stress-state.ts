/**
 * Двумерно (равнинно) напрегнато състояние в точка: напрежения върху наклонена
 * площадка, главни напрежения, най-голямо тангенциално напрежение и окръжност
 * на Мор.
 *
 * Мерни единици: напреженията са в една и съща единица (MPa или kN/cm²) –
 * функциите не я променят. Ъглите се подават и се връщат в ГРАДУСИ.
 *
 * Знаци и оси (както в Глава 11):
 *  - оста x е надясно, оста y е нагоре;
 *  - σ > 0 е опън;
 *  - τ_xy > 0, когато върху стената с външна нормала +x напрежението сочи
 *    към +y (тогава върху стената с нормала +y то сочи към +x);
 *  - ъгълът α е между оста x и външната нормала n на площадката, положителен
 *    обратно на часовниковата стрелка: n = (cos α, sin α);
 *  - τ_α > 0, когато сочи по t = (−sin α, cos α) – нормалата, завъртяна на 90°
 *    обратно на часовниковата стрелка. При α = 0: σ_0 = σ_x и τ_0 = τ_xy.
 *
 * Формулите следват само от равновесието на безкрайно малък клин и не зависят
 * от материала.
 */

export type PlaneStress = {
  /** σ_x – нормално напрежение върху стените с нормала ±x */
  sx: number;
  /** σ_y – нормално напрежение върху стените с нормала ±y */
  sy: number;
  /** τ_xy – тангенциално напрежение (знак: виж началото на файла) */
  txy: number;
};

export type PlaneStressOnPlane = {
  /** σ_α – нормално напрежение върху площадката */
  sigma: number;
  /** τ_α – тангенциално напрежение върху площадката */
  tau: number;
};

export type MohrCircle = {
  /** абсциса на центъра: (σ_x + σ_y) / 2 */
  center: number;
  /** радиус: √(((σ_x − σ_y)/2)² + τ_xy²) */
  radius: number;
};

export type PrincipalStresses = {
  /** σ_1 ≥ σ_2 */
  sigma1: number;
  sigma2: number;
  /**
   * α_1 – ъгъл между оста x и посоката на σ_1, в градуси, в интервала
   * (−90°; 90°]. Посоката на σ_2 е α_1 + 90°. Когато всяка площадка е главна
   * (σ_x = σ_y и τ_xy = 0), се връща 0.
   */
  alpha1: number;
  /** най-голямо тангенциално напрежение в равнината: (σ_1 − σ_2) / 2 */
  tauMax: number;
  /**
   * ъгъл на площадката, върху която τ_α = +τ_max: α_1 − 45°. Нормалното
   * напрежение върху нея е (σ_x + σ_y) / 2.
   */
  alphaTauMax: number;
};

const DEG = Math.PI / 180;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} трябва да е крайно число.`);
  }
}

function assertState(state: PlaneStress): void {
  assertFinite(state.sx, "σ_x");
  assertFinite(state.sy, "σ_y");
  assertFinite(state.txy, "τ_xy");
}

/**
 * Напрежения върху площадка, чиято външна нормала сключва ъгъл α с оста x:
 *   σ_α = (σ_x + σ_y)/2 + (σ_x − σ_y)/2 · cos 2α + τ_xy · sin 2α
 *   τ_α = −(σ_x − σ_y)/2 · sin 2α + τ_xy · cos 2α
 */
export function stressOnPlane(
  state: PlaneStress,
  alphaDeg: number,
): PlaneStressOnPlane {
  assertState(state);
  assertFinite(alphaDeg, "Ъгълът");
  const mean = (state.sx + state.sy) / 2;
  const half = (state.sx - state.sy) / 2;
  const cos2 = Math.cos(2 * alphaDeg * DEG);
  const sin2 = Math.sin(2 * alphaDeg * DEG);
  return {
    sigma: mean + half * cos2 + state.txy * sin2,
    tau: -half * sin2 + state.txy * cos2,
  };
}

/**
 * Същото напрегнато състояние, записано в оси x′, y′, завъртени на ъгъл α
 * обратно на часовниковата стрелка: σ_x′ = σ_α, σ_y′ = σ_(α+90°), τ_x′y′ = τ_α.
 */
export function rotateStressState(
  state: PlaneStress,
  alphaDeg: number,
): PlaneStress {
  const first = stressOnPlane(state, alphaDeg);
  const second = stressOnPlane(state, alphaDeg + 90);
  return { sx: first.sigma, sy: second.sigma, txy: first.tau };
}

/** Център и радиус на окръжността на Мор. */
export function mohrCircle(state: PlaneStress): MohrCircle {
  assertState(state);
  return {
    center: (state.sx + state.sy) / 2,
    radius: Math.hypot((state.sx - state.sy) / 2, state.txy),
  };
}

/**
 * Главни напрежения σ_1,2 = (σ_x + σ_y)/2 ± √(((σ_x − σ_y)/2)² + τ_xy²),
 * посоката на σ_1 (от tg 2α_0 = 2τ_xy / (σ_x − σ_y), с правилния квадрант)
 * и най-голямото тангенциално напрежение в равнината.
 */
export function principalStresses(state: PlaneStress): PrincipalStresses {
  const { center, radius } = mohrCircle(state);
  // atan2 избира онзи от двата корена на tg 2α_0, при който действа σ_1
  const alpha1 =
    radius === 0
      ? 0
      : (0.5 * Math.atan2(2 * state.txy, state.sx - state.sy)) / DEG;
  return {
    sigma1: center + radius,
    sigma2: center - radius,
    alpha1,
    tauMax: radius,
    alphaTauMax: alpha1 - 45,
  };
}

/**
 * Напрегнато състояние в точка от греда при огъване с напречна сила:
 * σ_x = σ (по Навие, със знака си), σ_y = 0, а τ_xy идва от големината на τ
 * по Журавски и от знака на напречната сила.
 *
 * Оста x е по оста на гредата, надясно; y е нагоре. По правилото на модула
 * Q > 0 върти отрязаната част по часовниковата стрелка, тоест върху стената с
 * външна нормала +x тангенциалното напрежение сочи надолу: τ_xy = −|τ|.
 * При Q < 0 е τ_xy = +|τ|.
 */
export function beamPointState(
  sigma: number,
  tauMagnitude: number,
  Q: number,
): PlaneStress {
  assertFinite(sigma, "σ");
  assertFinite(Q, "Q");
  if (!(tauMagnitude >= 0) || !Number.isFinite(tauMagnitude)) {
    throw new Error("Големината на τ не може да е отрицателна.");
  }
  if (Q === 0 && tauMagnitude !== 0) {
    throw new Error("При Q = 0 няма тангенциално напрежение от огъването.");
  }
  // без „−0“, когато няма тангенциално напрежение
  const txy = tauMagnitude === 0 ? 0 : Q > 0 ? -tauMagnitude : tauMagnitude;
  return { sx: sigma, sy: 0, txy };
}
