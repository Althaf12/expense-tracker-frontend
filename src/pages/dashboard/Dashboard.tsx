import { useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  fetchExpensesByMonth,
  fetchIncomeByMonth,
} from '../../api'
import { Link } from 'react-router-dom'
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
  } = useAppDataContext()
  const [monthlyExpenses, setMonthlyExpenses] = useState<Expense[]>([])
  const [categorySummary, setCategorySummary] = useState<{ name: string; total: number }[]>([])
  const [previousMonthIncome, setPreviousMonthIncome] = useState<Income[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [expenseTableFilters, setExpenseTableFilters] = useState({ name: '', amount: '', date: '' })
  const [categoryTableFilters, setCategoryTableFilters] = useState({ name: '', total: '' })
  const [incomeTableFilters, setIncomeTableFilters] = useState({ source: '', amount: '', date: '' })

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

    const filteredCategoryTotal = useMemo(
      () => filteredCategorySummary.reduce((sum, entry) => sum + entry.total, 0),
      [filteredCategorySummary],
    )

    // total based on the currently filtered monthly expenses (updated below after filters)

  const filteredPreviousMonthIncome = useMemo(() => {
    const sourceQuery = incomeTableFilters.source.trim().toLowerCase()
    const amountQuery = incomeTableFilters.amount.trim().toLowerCase()
    const dateQuery = incomeTableFilters.date.trim().toLowerCase()

    if (!sourceQuery && !amountQuery && !dateQuery) {
      return previousMonthIncome
    }

    return previousMonthIncome.filter((income) => {
      const sourceValue = (income.source ?? '').toString().toLowerCase()
      const numericAmount = typeof income.amount === 'number' ? income.amount : Number(income.amount ?? 0)
      const amountString = Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : ''
      const formattedAmount = formatAmount(numericAmount).toLowerCase()
      const rawDate = (income.receivedDate ?? '').toString().toLowerCase()
      const prettyDate = formatDate(income.receivedDate).toLowerCase()

      if (sourceQuery && !sourceValue.includes(sourceQuery)) {
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
  }, [previousMonthIncome, incomeTableFilters])

  const incomeTotal = useMemo(
    () => filteredPreviousMonthIncome.reduce((sum, inc) => sum + (typeof inc.amount === 'number' ? inc.amount : Number(inc.amount ?? 0)), 0),
    [filteredPreviousMonthIncome],
  )

  const expenseFiltersApplied = useMemo(
    () => Object.values(expenseTableFilters).some((value) => value.trim().length > 0),
    [expenseTableFilters],
  )

  const categoryFiltersApplied = useMemo(
    () => Object.values(categoryTableFilters).some((value) => value.trim().length > 0),
    [categoryTableFilters],
  )

  const incomeFiltersApplied = useMemo(
    () => Object.values(incomeTableFilters).some((value) => value.trim().length > 0),
    [incomeTableFilters],
  )

  const handleExpenseFilterChange = (field: 'name' | 'amount' | 'date', value: string) => {
    setExpenseTableFilters((previous) => ({ ...previous, [field]: value }))
  }

  const handleCategoryFilterChange = (field: 'name' | 'total', value: string) => {
    setCategoryTableFilters((previous) => ({ ...previous, [field]: value }))
  }

  const handleIncomeFilterChange = (field: 'source' | 'amount' | 'date', value: string) => {
    setIncomeTableFilters((previous) => ({ ...previous, [field]: value }))
  }

  const clearExpenseFilters = () => {
    setExpenseTableFilters({ name: '', amount: '', date: '' })
  }

  const clearCategoryFilters = () => {
    setCategoryTableFilters({ name: '', total: '' })
  }

  const clearIncomeFilters = () => {
    setIncomeTableFilters({ source: '', amount: '', date: '' })
  }

  const incomeMonthLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
    return formatter.format(new Date(previousContext.year, previousContext.month - 1))
  }, [previousContext.month, previousContext.year])

  const monthlyTotal = useMemo(
    () => filteredMonthlyExpenses.reduce((sum, e) => sum + amountFromExpense(e), 0),
    [filteredMonthlyExpenses],
  )

  return (
    <div className={styles.dashboard}>
      <section className={styles.card} aria-busy={loading}>
        <header className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Current Month Expenses</h2>
            <p className={styles.cardSubtitle}>{label}</p>
          </div>
          <div className={styles.headerActions}>
            <span className={styles.cardBadge}>{filteredMonthlyExpenses.length} items</span>
            <Link to="/operations/expenses" className={styles.addButton} aria-label="Add expense">
              Add Expense
            </Link>
          </div>
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
              <td className={styles.numeric}><span className={styles.totalPill}>{formatAmount(monthlyTotal)}</span></td>
                  <td />
                </tr>
              </tfoot>
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
          <span className={styles.cardBadge}>{filteredCategorySummary.length} items</span>
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

      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Previous Month Income</h2>
            <p className={styles.cardSubtitle}>{incomeMonthLabel}</p>
          </div>
          <span className={styles.cardBadge}>{filteredPreviousMonthIncome.length} items</span>
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
                <tr className={styles.tableFilterRow}>
                  <th scope="col">
                    <input
                      className={styles.tableFilterInput}
                      type="search"
                      placeholder="Filter source"
                      value={incomeTableFilters.source}
                      onChange={(event) => handleIncomeFilterChange('source', event.target.value)}
                    />
                  </th>
                  <th scope="col">
                    <input
                      className={styles.tableFilterInput}
                      type="search"
                      placeholder="Filter amount"
                      value={incomeTableFilters.amount}
                      onChange={(event) => handleIncomeFilterChange('amount', event.target.value)}
                    />
                  </th>
                  <th scope="col">
                    <div className={styles.filterControls}>
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter date"
                        value={incomeTableFilters.date}
                        onChange={(event) => handleIncomeFilterChange('date', event.target.value)}
                      />
                      {incomeFiltersApplied && (
                        <button type="button" className={styles.clearButton} onClick={clearIncomeFilters}>
                          Clear
                        </button>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPreviousMonthIncome.length === 0 ? (
                  <tr className={styles.emptyRow}>
                    <td colSpan={3}>No income entries match the current filters.</td>
                  </tr>
                ) : (
                  filteredPreviousMonthIncome.map((income) => {
                    const key = String(income.incomeId ?? `${income.source ?? 'income'}-${income.receivedDate ?? ''}`)
                    return (
                      <tr key={key}>
                        <td>{income.source ?? '-'}</td>
                        <td className={styles.numeric}>{formatAmount(income.amount)}</td>
                        <td>{formatDate(income.receivedDate)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className={styles.numeric}><span className={styles.totalPill}>{formatAmount(incomeTotal)}</span></td>
                <td />
              </tr>
            </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
