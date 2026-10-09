/** Лабораториите, чието отваряне се отбелязва (събитие „lab_open“). */
export const LAB_IDS = [
  "beam",
  "section",
  "stresses",
  "deflection",
  "buckling",
] as const;

export type LabId = (typeof LAB_IDS)[number];
