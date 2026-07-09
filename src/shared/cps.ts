export const DEFAULT_MAX_CPS = 16
export const DEFAULT_MIN_CPS = 5

export function roundCpsToOneDecimal(cps: number): number {
  if (!Number.isFinite(cps)) return cps
  return Math.round(cps * 10) / 10
}
