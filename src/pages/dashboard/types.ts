export type TrendDeltaDirection = 'up' | 'down' | 'flat'
export type TrendTone = 'positive' | 'negative' | 'neutral'

export type TrendSummary = {
  deltaDirection: TrendDeltaDirection
  tone: TrendTone
  percentage: number | null
}
