const pad = (n: number) => String(n).padStart(2, '0')

export const toDDMMYYYY = (date: Date): string =>
  `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`

export const formatDate = (value: unknown): string => {
  if (value == null) return '-'

  if (value instanceof Date) {
    const timestamp = value.getTime()
    return Number.isFinite(timestamp) ? toDDMMYYYY(value) : '-'
  }

  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isFinite(parsed.getTime()) ? toDDMMYYYY(parsed) : value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const asMillis = value < 1e12 ? value * 1000 : value
    const parsed = new Date(asMillis)
    return Number.isFinite(parsed.getTime()) ? toDDMMYYYY(parsed) : String(value)
  }

  return '-'
}

export const formatAmount = (value: unknown): string => {
  const parsed = parseAmount(value)
  if (!Number.isFinite(parsed)) {
    return typeof value === 'string' ? value : '-'
  }
  return parsed.toFixed(2)
}

export const parseAmount = (value: unknown): number => {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : Number.NaN
  }
  return Number.NaN
}
