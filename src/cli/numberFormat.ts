function isIndexField(key: string): boolean {
  const normalized = key.toLowerCase()
  return normalized === 'index' || normalized.endsWith('index')
}

export function formatCliNumber(key: string, value: number): string {
  if (!Number.isFinite(value)) return String(value)
  if (isIndexField(key)) return String(Math.trunc(value))
  return value.toFixed(1)
}
