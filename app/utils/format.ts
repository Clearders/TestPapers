export function formatScoreWeight (weight: number): string {
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1)
}