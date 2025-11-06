import { useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  fetchExpensesByMonth,
  fetchIncomeByMonth,
} from '../../api'
import type { Expense, ExpenseCategory, Income } from '../../types/app'
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

const buildCategorySummary = (expenses: Expense[], categories: ExpenseCategory[]) => {
  const categoryMap = new Map<string | number, string>()
  categories.forEach((category) => {
    categoryMap.set(category.expenseCategoryId, category.expenseCategoryName)
  })

  const totals = new Map<string, { name: string; total: number }>()

  expenses.forEach((expense) => {
    const key = expense.expenseCategoryId ?? 'uncategorised'
    const name = categoryMap.get(key) ?? 'Uncategorised'
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
  } = useAppDataContext()
  const [monthlyExpenses, setMonthlyExpenses] = useState<Expense[]>([])
  const [categorySummary, setCategorySummary] = useState<{ name: string; total: number }[]>([])
  const [previousMonthIncome, setPreviousMonthIncome] = useState<Income[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  const { month, year, label } = useMemo(() => getCurrentMonthContext(), [])
  const previousContext = useMemo(() => getPreviousMonth(month, year), [month, year])

  useEffect(() => {
    if (!session) {
      setMonthlyExpenses([])
      setCategorySummary([])
      setPreviousMonthIncome([])
      return
    }

    const username = session.username
    setLoading(true)
    setStatus({ type: 'loading', message: 'Loading dashboard...' })

    void (async () => {
      try {
        const categories = await ensureExpenseCategories()
        const expenses = await fetchExpensesByMonth({ username, month, year })
        setMonthlyExpenses(expenses)
        setCategorySummary(buildCategorySummary(expenses, categories))

        const incomes = await fetchIncomeByMonth({
          username,
          month: previousContext.month,
          year: previousContext.year,
        })
        setPreviousMonthIncome(incomes)
        setStatus(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus({ type: 'error', message })
      } finally {
        setLoading(false)
      }
    })()
  }, [session, ensureExpenseCategories, month, year, previousContext.month, previousContext.year, setStatus])

  const categoryTotal = useMemo(
    () => categorySummary.reduce((sum, entry) => sum + entry.total, 0),
    [categorySummary],
  )

  const incomeMonthLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
    return formatter.format(new Date(previousContext.year, previousContext.month - 1))
  }, [previousContext.month, previousContext.year])

  return (
    <div className={styles.dashboard}>
      <section className={styles.card} aria-busy={loading}>
        <header className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Current Month Expenses</h2>
            <p className={styles.cardSubtitle}>{label}</p>
          </div>
          <span className={styles.cardBadge}>{monthlyExpenses.length} items</span>
        </header>
        {loading && monthlyExpenses.length === 0 ? (
          <p className={styles.placeholder}>Loading data…</p>
        ) : monthlyExpenses.length === 0 ? (
          <p className={styles.placeholder}>No expenses recorded this month.</p>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col" className={styles.numeric}>Amount</th>
                  <th scope="col">Date</th>
                </tr>
              </thead>
              <tbody>
                {monthlyExpenses.map((expense) => {
                  const key = String(expense.expenseId ?? expense.expensesId ?? expense.description ?? expense.expenseDate)
                  return (
                    <tr key={key}>
                      <td>{expense.description ?? expense.expenseName ?? '-'}</td>
                      <td className={styles.numeric}>{formatAmount(expense.amount ?? expense.expenseAmount)}</td>
                      <td>{formatDate(expense.expenseDate)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Spend by Category</h2>
            <p className={styles.cardSubtitle}>{label}</p>
          </div>
          <span className={styles.cardBadge}>{formatAmount(categoryTotal)}</span>
        </header>
        {categorySummary.length === 0 ? (
          <p className={styles.placeholder}>No category spend recorded.</p>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col" className={styles.numeric}>Total</th>
                </tr>
              </thead>
              <tbody>
                {categorySummary.map((entry) => (
                  <tr key={entry.name}>
                    <td>{entry.name}</td>
                    <td className={styles.numeric}>{formatAmount(entry.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Previous Month Income</h2>
            <p className={styles.cardSubtitle}>{incomeMonthLabel}</p>
          </div>
          <span className={styles.cardBadge}>{previousMonthIncome.length} items</span>
        </header>
        {previousMonthIncome.length === 0 ? (
          <p className={styles.placeholder}>No income recorded for {incomeMonthLabel}.</p>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Source</th>
                  <th scope="col" className={styles.numeric}>Amount</th>
                  <th scope="col">Received</th>
                </tr>
              </thead>
              <tbody>
                {previousMonthIncome.map((income) => {
                  const key = String(income.incomeId ?? `${income.source ?? 'income'}-${income.receivedDate ?? ''}`)
                  return (
                    <tr key={key}>
                      <td>{income.source ?? '-'}</td>
                      <td className={styles.numeric}>{formatAmount(income.amount)}</td>
                      <td>{formatDate(income.receivedDate)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
