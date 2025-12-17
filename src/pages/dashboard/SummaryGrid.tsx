import { Typography } from '@mui/material'
import type { ReactElement } from 'react'
import styles from './Dashboard.shared.module.css'
import localStyles from './SummaryGrid.module.css'
import type { TrendSummary } from './types'
import Skeleton from '../../components/Skeleton'

type Props = {
  loading?: boolean
  label: string
  totalBalance: number
  totalAfterDueBalance: number
  unpaidPlannedExpensesTotal: number
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
  unpaidPlannedExpensesTotal,
  previousMonthIncomeTotal,
  currentMonthExpenseTotal,
  incomeMonthLabel,
  balanceTrend,
  incomeTrend,
  expenseTrend,
  formatCurrency,
  getTrendHint,
  renderTrend,
  loading = false,
}: Props): ReactElement {
  // show simple skeletons when loading
  if (loading) {
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
          <div>
            <Skeleton size="large" />
          </div>
          <div className={localStyles.metricFooter}>
            <span className={localStyles.metricHint}>Current Bank Balance</span>
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
          <div>
            <Skeleton size="large" />
          </div>
          <div className={localStyles.metricFooter}>
            <span className={localStyles.metricHint}>Unpaid templates: —</span>
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
          <div>
            <Skeleton size="large" />
          </div>
          <div className={localStyles.metricFooter}>
            <span className={localStyles.metricHint}>—</span>
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
          <div>
            <Skeleton size="large" />
          </div>
          <div className={localStyles.metricFooter}>
            <span className={localStyles.metricHint}>—</span>
          </div>
        </section>
      </div>
    )
  }
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
        <Typography variant="h4" component="p" className={localStyles.metricValue} sx={{ fontSize: { xs: '1.8rem', md: '1.8rem' } }}>
          {formatCurrency(totalBalance)}
        </Typography>
        <div className={localStyles.metricFooter}>
          <span className={localStyles.metricHint}>Current Bank Balance</span>
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
        <Typography variant="h4" component="p" className={localStyles.metricValue} sx={{ fontSize: { xs: '1.8rem', md: '1.8rem' } }}>
          {formatCurrency(totalAfterDueBalance)}
        </Typography>
        <div className={localStyles.metricFooter}>
            <span className={localStyles.metricHint}>Unpaid planned expenses: {formatCurrency(unpaidPlannedExpensesTotal)}</span>
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
        <Typography variant="h4" component="p" className={localStyles.metricValue} sx={{ fontSize: { xs: '1.8rem', md: '1.8rem' } }}>
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
        <Typography variant="h4" component="p" className={localStyles.metricValue} sx={{ fontSize: { xs: '1.8rem', md: '1.8rem' } }}>
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
