import { Typography } from '@mui/material'
import type { ReactElement } from 'react'
import styles from './Dashboard.shared.module.css'
import localStyles from './SummaryGrid.module.css'
import type { TrendSummary } from './types'

type Props = {
  label: string
  totalBalance: number
  totalAfterDueBalance: number
  unpaidTemplatesTotal: number
  previousMonthIncomeTotal: number
  currentMonthExpenseTotal: number
  incomeMonthLabel: string
  balanceTrend: TrendSummary | null
  incomeTrend: TrendSummary | null
  expenseTrend: TrendSummary | null
  formatCurrency: (v: number) => string
  getTrendHint: (t: TrendSummary | null) => string
  renderTrend: (t: TrendSummary | null) => ReactElement | null
}

export default function SummaryGrid({
  label,
  totalBalance,
  totalAfterDueBalance,
  unpaidTemplatesTotal,
  previousMonthIncomeTotal,
  currentMonthExpenseTotal,
  incomeMonthLabel,
  balanceTrend,
  incomeTrend,
  expenseTrend,
  formatCurrency,
  getTrendHint,
  renderTrend,
}: Props): ReactElement {
  return (
    <div className={styles.summaryGrid}>
      <section className={`${styles.card} ${localStyles.summaryCard}`} aria-live="polite">
        <div className={localStyles.summaryHeader}>
          <Typography variant="subtitle2" component="h3" className={localStyles.metricLabel}>
            Total Balance
          </Typography>
          <Typography variant="body2" component="p" className={localStyles.metricSubtitle}>
            {label}
          </Typography>
        </div>
        <Typography variant="h4" component="p" className={localStyles.metricValue} sx={{ fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
          {formatCurrency(totalBalance)}
        </Typography>
        <div className={localStyles.metricFooter}>
          {renderTrend(balanceTrend)}
          <span className={localStyles.metricHint}>{getTrendHint(balanceTrend)}</span>
        </div>
      </section>
      <section className={`${styles.card} ${localStyles.summaryCard}`} aria-live="polite">
        <div className={localStyles.summaryHeader}>
          <Typography variant="subtitle2" component="h3" className={localStyles.metricLabel}>
            Total After Due Balance
          </Typography>
          <Typography variant="body2" component="p" className={localStyles.metricSubtitle}>
            {label}
          </Typography>
        </div>
        <Typography variant="h4" component="p" className={localStyles.metricValue} sx={{ fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
          {formatCurrency(totalAfterDueBalance)}
        </Typography>
        <div className={localStyles.metricFooter}>
          <span className={localStyles.metricHint}>Unpaid templates: {formatCurrency(unpaidTemplatesTotal)}</span>
        </div>
      </section>
      <section className={`${styles.card} ${localStyles.summaryCard}`} aria-live="polite">
        <div className={localStyles.summaryHeader}>
          <Typography variant="subtitle2" component="h3" className={localStyles.metricLabel}>
            Total Income
          </Typography>
          <Typography variant="body2" component="p" className={localStyles.metricSubtitle}>
            {incomeMonthLabel}
          </Typography>
        </div>
        <Typography variant="h4" component="p" className={localStyles.metricValue} sx={{ fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
          {formatCurrency(previousMonthIncomeTotal)}
        </Typography>
        <div className={localStyles.metricFooter}>
          {renderTrend(incomeTrend)}
          <span className={localStyles.metricHint}>{getTrendHint(incomeTrend)}</span>
        </div>
      </section>
      <section className={`${styles.card} ${localStyles.summaryCard}`} aria-live="polite">
        <div className={localStyles.summaryHeader}>
          <Typography variant="subtitle2" component="h3" className={localStyles.metricLabel}>
            Total Expenses
          </Typography>
          <Typography variant="body2" component="p" className={localStyles.metricSubtitle}>
            {label}
          </Typography>
        </div>
        <Typography variant="h4" component="p" className={localStyles.metricValue} sx={{ fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
          {formatCurrency(currentMonthExpenseTotal)}
        </Typography>
        <div className={localStyles.metricFooter}>
          {renderTrend(expenseTrend)}
          <span className={localStyles.metricHint}>{getTrendHint(expenseTrend)}</span>
        </div>
      </section>
    </div>
  )
}
