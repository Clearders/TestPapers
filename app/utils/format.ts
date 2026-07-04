export function formatScoreWeight (weight: number): string {
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1)
}

export function formatShortTimestamp (value: string | null | undefined): string {
  if (!value) return 'just now'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'just now'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
