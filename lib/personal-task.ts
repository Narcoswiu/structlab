export type PersonalTaskParams = {
  k2: number;
  k3: number;
  k4: number;
  /** сила, kN */
  F: number;
  /** момент, kN·m */
  M: number;
  /** разпределен товар, kN/m */
  q: number;
  /** дължина, m */
  a: number;
};

/**
 * Демо на началната страница: параметри на Курсова №1 (схема 1) от цифрите
 * на факултетния номер. Формулите са от прототипа; пълните лични задания
 * идват в Етап 9. Връща null, ако цифрите са по-малко от 4.
 */
export function derivePersonalTask(
  facultyNumber: string,
): PersonalTaskParams | null {
  const digits = facultyNumber.replace(/\D/g, "").split("").map(Number);
  const [, k2, k3, k4] = digits;
  if (k2 === undefined || k3 === undefined || k4 === undefined) return null;

  return {
    k2,
    k3,
    k4,
    F: 30 + k3,
    M: 45 + k4,
    q: 5 + k4,
    a: 6 + 0.2 * k2,
  };
}
