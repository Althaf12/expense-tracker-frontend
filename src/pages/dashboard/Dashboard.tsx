import Grid from '@mui/material/Grid'
import { Typography } from '@mui/material'
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  fetchExpensesByMonth,
  fetchIncomeByMonth,
} from '../../api'
import { Link } from 'react-router-dom'
import type { Expense, UserExpenseCategory, Income } from '../../types/app'
import { useAppDataContext } from '../../context/AppDataContext'
import { formatAmount, formatDate } from '../../utils/format'
import styles from './Dashboard.module.css'

const getCurrentMonthContext = () => {
  const current = new Date()
  const month = current.getMonth() + 1
  const year = current.getFullYear()
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
  return {
    month,
    year,
    label: formatter.format(current),
  }
}

const getPreviousMonth = (month: number, year: number) => {
  if (month === 1) {
    return { month: 12, year: year - 1 }
  }
  return { month: month - 1, year }
}

const amountFromExpense = (expense: Expense): number => {
  const value = expense.amount ?? expense.expenseAmount
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const amountFromIncome = (income: Income): number => {
  const value = income.amount
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

type TrendDeltaDirection = 'up' | 'down' | 'flat'
type TrendTone = 'positive' | 'negative' | 'neutral'

type TrendSummary = {
  deltaDirection: TrendDeltaDirection
  tone: TrendTone
  percentage: number | null
}

const calculateTrend = (current: number, previous: number, preferHigher: boolean): TrendSummary => {
  const safeCurrent = Number.isFinite(current) ? current : 0
  const safePrevious = Number.isFinite(previous) ? previous : 0

  if (!Number.isFinite(previous) || previous === 0) {
    const delta = safeCurrent - safePrevious
    if (delta === 0) {
      return { deltaDirection: 'flat', tone: 'neutral', percentage: 0 }
    }
    const improvement = preferHigher ? delta > 0 : delta < 0
    return {
      deltaDirection: delta > 0 ? 'up' : 'down',
      tone: improvement ? 'positive' : 'negative',
      percentage: null,
    }
  }

  const difference = safeCurrent - safePrevious
  if (difference === 0) {
    return { deltaDirection: 'flat', tone: 'neutral', percentage: 0 }
  }

  const percentage = Math.abs(difference) / Math.abs(safePrevious) * 100
  const improvement = preferHigher ? difference > 0 : difference < 0

  return {
    deltaDirection: difference > 0 ? 'up' : 'down',
    tone: improvement ? 'positive' : 'negative',
    percentage,
  }
}

const buildCategorySummary = (expenses: Expense[], categories: UserExpenseCategory[]) => {
  const categoryMap = new Map<string | number, string>()
  categories.forEach((category) => {
    categoryMap.set(category.userExpenseCategoryId, category.userExpenseCategoryName)
  })

  const totals = new Map<string, { name: string; total: number }>()

  expenses.forEach((expense) => {
    // Prefer the category name supplied on the expense record itself (some APIs return it)
  const explicitName = (expense as Expense & { expenseCategoryName?: string }).expenseCategoryName
  const key = expense.expenseCategoryId ?? 'uncategorised'
  const name = explicitName ?? categoryMap.get(key) ?? 'Uncategorised'
    const amount = amountFromExpense(expense)
    if (!totals.has(name)) {
      totals.set(name, { name, total: 0 })
    }
    const entry = totals.get(name)
    if (entry) {
      entry.total += amount
    }
  })

  return Array.from(totals.values()).sort((a, b) => b.total - a.total)
}

export default function Dashboard(): ReactElement {
  const {
    session,
    setStatus,
    ensureExpenseCategories,
    expenseCategories,
  } = useAppDataContext()
  const [monthlyExpenses, setMonthlyExpenses] = useState<Expense[]>([])
  const [previousMonthExpenses, setPreviousMonthExpenses] = useState<Expense[]>([])
  const [currentMonthIncome, setCurrentMonthIncome] = useState<Income[]>([])
  const [previousMonthIncome, setPreviousMonthIncome] = useState<Income[]>([])
  const [twoMonthsAgoIncome, setTwoMonthsAgoIncome] = useState<Income[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [expenseTableFilters, setExpenseTableFilters] = useState({ name: '', amount: '', date: '' })
  const [categoryTableFilters, setCategoryTableFilters] = useState({ name: '', total: '' })

  const { month, year, label } = useMemo(() => getCurrentMonthContext(), [])
  const previousContext = useMemo(() => getPreviousMonth(month, year), [month, year])
  const twoMonthsAgoContext = useMemo(
    () => getPreviousMonth(previousContext.month, previousContext.year),
    [previousContext.month, previousContext.year],
  )

  useEffect(() => {
    if (!session) {
      setMonthlyExpenses([])
      setPreviousMonthExpenses([])
      setCurrentMonthIncome([])
      setPreviousMonthIncome([])
      setTwoMonthsAgoIncome([])
      return
    }

    const username = session.username
    setLoading(true)
    setStatus({ type: 'loading', message: 'Loading dashboard...' })

    void (async () => {
      try {
        const categoriesPromise = ensureExpenseCategories()
        const [
          currentExpenses,
          previousExpenses,
          currentIncomeData,
          previousIncomeData,
          twoMonthsAgoIncomeData,
        ] = await Promise.all([
          fetchExpensesByMonth({ username, month, year }),
          fetchExpensesByMonth({ username, month: previousContext.month, year: previousContext.year }),
          fetchIncomeByMonth({ username, month, year }),
          fetchIncomeByMonth({ username, month: previousContext.month, year: previousContext.year }),
          fetchIncomeByMonth({ username, month: twoMonthsAgoContext.month, year: twoMonthsAgoContext.year }),
        ])
        await categoriesPromise

        setMonthlyExpenses(currentExpenses)
        setPreviousMonthExpenses(previousExpenses)
        setCurrentMonthIncome(currentIncomeData)
        setPreviousMonthIncome(previousIncomeData)
        setTwoMonthsAgoIncome(twoMonthsAgoIncomeData)
        setStatus(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus({ type: 'error', message })
      } finally {
        setLoading(false)
      }
    })()
  }, [
    session,
    ensureExpenseCategories,
    month,
    year,
    previousContext.month,
    previousContext.year,
    twoMonthsAgoContext.month,
    twoMonthsAgoContext.year,
    setStatus,
  ])

  const filteredMonthlyExpenses = useMemo(() => {
    const nameQuery = expenseTableFilters.name.trim().toLowerCase()
    const amountQuery = expenseTableFilters.amount.trim().toLowerCase()
    const dateQuery = expenseTableFilters.date.trim().toLowerCase()

    if (!nameQuery && !amountQuery && !dateQuery) {
      return monthlyExpenses
    }

    return monthlyExpenses.filter((expense) => {
      const expenseName = (expense.expenseName ?? expense.description ?? '').toString().toLowerCase()
      const numericAmount = amountFromExpense(expense)
      const amountString = Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : ''
      const formattedAmount = formatAmount(numericAmount).toLowerCase()
      const rawDate = (expense.expenseDate ?? '').toString().toLowerCase()
      const prettyDate = formatDate(expense.expenseDate).toLowerCase()

      if (nameQuery && !expenseName.includes(nameQuery)) {
        return false
      }
      if (amountQuery && !amountString.includes(amountQuery) && !formattedAmount.includes(amountQuery)) {
        return false
      }
      if (dateQuery && !rawDate.includes(dateQuery) && !prettyDate.includes(dateQuery)) {
        return false
      }
      return true
    })
  }, [monthlyExpenses, expenseTableFilters])

  const categorySummary = useMemo(
    () => buildCategorySummary(monthlyExpenses, expenseCategories),
    [monthlyExpenses, expenseCategories],
  )

  const filteredCategorySummary = useMemo(() => {
    const nameQuery = categoryTableFilters.name.trim().toLowerCase()
    const totalQuery = categoryTableFilters.total.trim().toLowerCase()

    if (!nameQuery && !totalQuery) {
      return categorySummary
    }

    return categorySummary.filter((entry) => {
      const nameValue = entry.name.toLowerCase()
      const totalString = entry.total.toFixed(2)
      const formattedTotal = formatAmount(entry.total).toLowerCase()

      if (nameQuery && !nameValue.includes(nameQuery)) {
        return false
      }
      if (totalQuery && !totalString.includes(totalQuery) && !formattedTotal.includes(totalQuery)) {
        return false
      }
      return true
    })
  }, [categorySummary, categoryTableFilters])

  const expenseFiltersApplied = useMemo(
    () => Object.values(expenseTableFilters).some((value) => value.trim().length > 0),
    [expenseTableFilters],
  )

  const categoryFiltersApplied = useMemo(
    () => Object.values(categoryTableFilters).some((value) => value.trim().length > 0),
    [categoryTableFilters],
  )

  const handleExpenseFilterChange = (field: 'name' | 'amount' | 'date', value: string) => {
    setExpenseTableFilters((previous) => ({ ...previous, [field]: value }))
  }

  const handleCategoryFilterChange = (field: 'name' | 'total', value: string) => {
    setCategoryTableFilters((previous) => ({ ...previous, [field]: value }))
  }

  const clearExpenseFilters = () => {
    setExpenseTableFilters({ name: '', amount: '', date: '' })
  }

  const clearCategoryFilters = () => {
    setCategoryTableFilters({ name: '', total: '' })
  }

  const incomeMonthLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
    return formatter.format(new Date(previousContext.year, previousContext.month - 1))
  }, [previousContext.month, previousContext.year])

  const monthlyTotal = useMemo(
    () => filteredMonthlyExpenses.reduce((sum, e) => sum + amountFromExpense(e), 0),
    [filteredMonthlyExpenses],
  )

  const currentMonthExpenseTotal = useMemo(
    () => monthlyExpenses.reduce((sum, expense) => sum + amountFromExpense(expense), 0),
    [monthlyExpenses],
  )

  const previousMonthExpenseTotal = useMemo(
    () => previousMonthExpenses.reduce((sum, expense) => sum + amountFromExpense(expense), 0),
    [previousMonthExpenses],
  )

  const currentMonthIncomeTotal = useMemo(
    () => currentMonthIncome.reduce((sum, income) => sum + amountFromIncome(income), 0),
    [currentMonthIncome],
  )

  const previousMonthIncomeTotal = useMemo(
    () => previousMonthIncome.reduce((sum, income) => sum + amountFromIncome(income), 0),
    [previousMonthIncome],
  )

  const twoMonthsAgoIncomeTotal = useMemo(
    () => twoMonthsAgoIncome.reduce((sum, income) => sum + amountFromIncome(income), 0),
    [twoMonthsAgoIncome],
  )

  const totalBalance = useMemo(
    () => previousMonthIncomeTotal - currentMonthExpenseTotal,
    [previousMonthIncomeTotal, currentMonthExpenseTotal],
  )

  const previousBalance = useMemo(
    () => previousMonthIncomeTotal - previousMonthExpenseTotal,
    [previousMonthIncomeTotal, previousMonthExpenseTotal],
  )

  const balanceTrend = useMemo(
    () => calculateTrend(totalBalance, previousBalance, true),
    [totalBalance, previousBalance],
  )

  const incomeTrend = useMemo(
    () => calculateTrend(previousMonthIncomeTotal, twoMonthsAgoIncomeTotal, true),
    [previousMonthIncomeTotal, twoMonthsAgoIncomeTotal],
  )

  const expenseTrend = useMemo(
    () => calculateTrend(currentMonthExpenseTotal, previousMonthExpenseTotal, false),
    [currentMonthExpenseTotal, previousMonthExpenseTotal],
  )

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }),
    [],
  )

  const formatCurrency = (value: number) => currencyFormatter.format(value)

  const getTrendHint = (trend: TrendSummary | null) =>
    trend && trend.percentage !== null ? 'vs previous month' : 'Insufficient data'

  const renderTrend = (trend: TrendSummary | null) => {
    if (!trend || trend.percentage === null) {
      return (
        <span className={`${styles.trendIndicator} ${styles.trendIndicatorFlat} ${styles.trendNeutral}`}>
          No previous data
        </span>
      )
    }

    const orientationClass =
      trend.deltaDirection === 'up'
        ? styles.trendIndicatorUp
        : trend.deltaDirection === 'down'
          ? styles.trendIndicatorDown
          : styles.trendIndicatorFlat

    const toneClass =
      trend.tone === 'positive'
        ? styles.trendPositive
        : trend.tone === 'negative'
          ? styles.trendNegative
          : styles.trendNeutral

    const prefix = trend.deltaDirection === 'up' ? '+' : trend.deltaDirection === 'down' ? '-' : ''

    return (
      <span className={`${styles.trendIndicator} ${orientationClass} ${toneClass}`}>
        {`${prefix}${trend.percentage.toFixed(1)}%`}
      </span>
    )
  }

  return (
    <Grid container component="section" className={styles.dashboard} spacing={3}>
      <Grid size={{ xs: 12 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <section className={`${styles.card} ${styles.summaryCard}`} aria-live="polite">
              <div className={styles.summaryHeader}>
                <Typography variant="subtitle2" component="h3" className={styles.metricLabel}>
                  Total Balance
                </Typography>
                <Typography variant="body2" component="p" className={styles.metricSubtitle}>
                  {label}
                </Typography>
              </div>
              <Typography variant="h4" component="p" className={styles.metricValue}>
                {formatCurrency(totalBalance)}
              </Typography>
              
            </section>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <section className={`${styles.card} ${styles.summaryCard}`} aria-live="polite">
              <div className={styles.summaryHeader}>
                <Typography variant="subtitle2" component="h3" className={styles.metricLabel}>
                  Total Income
                </Typography>
                <Typography variant="body2" component="p" className={styles.metricSubtitle}>
                  {incomeMonthLabel}
                </Typography>
              </div>
              <Typography variant="h4" component="p" className={styles.metricValue}>
                {formatCurrency(previousMonthIncomeTotal)}
              </Typography>
              <div className={styles.metricFooter}>
                {renderTrend(incomeTrend)}
                <span className={styles.metricHint}>{getTrendHint(incomeTrend)}</span>
              </div>
            </section>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <section className={`${styles.card} ${styles.summaryCard}`} aria-live="polite">
              <div className={styles.summaryHeader}>
                <Typography variant="subtitle2" component="h3" className={styles.metricLabel}>
                  Total Expenses
                </Typography>
                <Typography variant="body2" component="p" className={styles.metricSubtitle}>
                  {label}
                </Typography>
              </div>
              <Typography variant="h4" component="p" className={styles.metricValue}>
                {formatCurrency(currentMonthExpenseTotal)}
              </Typography>
              <div className={styles.metricFooter}>
                {renderTrend(expenseTrend)}
                <span className={styles.metricHint}>{getTrendHint(expenseTrend)}</span>
              </div>
            </section>
          </Grid>
        </Grid>
      </Grid>
      <Grid size={{ xs: 12, lg: 8 }}>
        <section className={styles.card} aria-busy={loading}>
          <header className={styles.cardHeader}>
            <div>
              <Typography variant="h5" component="h2" className={styles.cardTitle}>
                Current Month Expenses
              </Typography>
              <Typography variant="body2" component="p" className={styles.cardSubtitle}>
                {label}
              </Typography>
            </div>
            <div className={styles.headerActions}>
              <span className={styles.cardBadge}>{filteredMonthlyExpenses.length} items</span>
              <Link to="/operations/expenses" className={styles.addButton} aria-label="Add expense">
                Add Expense
              </Link>
            </div>
          </header>
          {loading && monthlyExpenses.length === 0 ? (
            <Typography variant="body2" component="p" className={styles.placeholder}>
              Loading data…
            </Typography>
          ) : monthlyExpenses.length === 0 ? (
            <Typography variant="body2" component="p" className={styles.placeholder}>
              No expenses recorded this month.
            </Typography>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Expense</th>
                    <th scope="col" className={styles.numeric}>Amount</th>
                    <th scope="col">Date</th>
                  </tr>
                  <tr className={styles.tableFilterRow}>
                    <th scope="col">
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter expense"
                        value={expenseTableFilters.name}
                        onChange={(event) => handleExpenseFilterChange('name', event.target.value)}
                      />
                    </th>
                    <th scope="col">
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter amount"
                        value={expenseTableFilters.amount}
                        onChange={(event) => handleExpenseFilterChange('amount', event.target.value)}
                      />
                    </th>
                    <th scope="col">
                      <div className={styles.filterControls}>
                        <input
                          className={styles.tableFilterInput}
                          type="search"
                          placeholder="Filter date"
                          value={expenseTableFilters.date}
                          onChange={(event) => handleExpenseFilterChange('date', event.target.value)}
                        />
                        {expenseFiltersApplied && (
                          <button type="button" className={styles.clearButton} onClick={clearExpenseFilters}>
                            Clear
                          </button>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMonthlyExpenses.length === 0 ? (
                    <tr className={styles.emptyRow}>
                      <td colSpan={3}>No expenses match the current filters.</td>
                    </tr>
                  ) : (
                    filteredMonthlyExpenses.map((expense) => {
                      const key = String(
                        expense.expenseId ??
                          expense.expensesId ??
                          expense.expenseName ??
                          expense.description ??
                          expense.expenseDate,
                      )
                      return (
                        <tr key={key}>
                          <td>{expense.expenseName ?? expense.description ?? '-'}</td>
                          <td className={styles.numeric}>{formatAmount(expense.amount ?? expense.expenseAmount)}</td>
                          <td>{formatDate(expense.expenseDate)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className={styles.numeric}>
                      <span className={styles.totalPill}>{formatAmount(monthlyTotal)}</span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </Grid>
      <Grid size={{ xs: 12, lg: 4 }}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <Typography variant="h5" component="h2" className={styles.cardTitle}>
                Spend by Category
              </Typography>
              <Typography variant="body2" component="p" className={styles.cardSubtitle}>
                {label}
              </Typography>
            </div>
            <span className={styles.cardBadge}>{filteredCategorySummary.length} items</span>
          </header>
          {categorySummary.length === 0 ? (
            <Typography variant="body2" component="p" className={styles.placeholder}>
              No category spend recorded.
            </Typography>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col" className={styles.numeric}>Total</th>
                  </tr>
                  <tr className={styles.tableFilterRow}>
                    <th scope="col">
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter category"
                        value={categoryTableFilters.name}
                        onChange={(event) => handleCategoryFilterChange('name', event.target.value)}
                      />
                    </th>
                    <th scope="col">
                      <div className={styles.filterControls}>
                        <input
                          className={styles.tableFilterInput}
                          type="search"
                          placeholder="Filter total"
                          value={categoryTableFilters.total}
                          onChange={(event) => handleCategoryFilterChange('total', event.target.value)}
                        />
                        {categoryFiltersApplied && (
                          <button type="button" className={styles.clearButton} onClick={clearCategoryFilters}>
                            Clear
                          </button>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategorySummary.length === 0 ? (
                    <tr className={styles.emptyRow}>
                      <td colSpan={2}>No categories match the current filters.</td>
                    </tr>
                  ) : (
                    filteredCategorySummary.map((entry) => (
                      <tr key={entry.name}>
                        <td>{entry.name}</td>
                        <td className={styles.numeric}>{formatAmount(entry.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </Grid>
    </Grid>
  )
}
