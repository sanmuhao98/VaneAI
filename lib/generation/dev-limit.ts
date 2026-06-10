// Dev guardrail (docs/03-environments.md): caps real provider calls per day so a
// runaway loop can't burn API spend. Unset = no limit (production); 0 = hard off.
export function devCallLimitExceeded(todayCount: number, limit: number | undefined): boolean {
  return limit !== undefined && todayCount >= limit
}
