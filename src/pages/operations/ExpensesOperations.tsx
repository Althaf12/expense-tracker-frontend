import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'
import {
  addExpense,
  deleteExpense,
  fetchExpenses,
  fetchExpensesByMonth,
  fetchExpensesByRange,
  updateExpense,
} from '../../api'
import type { Expense } from '../../types/app'
import { useAppDataContext } from '../../context/AppDataContext'
import { formatAmount, formatDate, parseAmount } from '../../utils/format'
import styles from './ExpensesOperations.module.css'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const ensureId = (expense: Expense): string =>
  String(expense.expensesId ?? expense.expenseId ?? `${expense.description ?? 'expense'}-${expense.expenseDate ?? ''}`)

const getAmount = (expense: Expense): number => {
  const value = expense.amount ?? expense.expenseAmount
  return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0
}

type ViewMode = 'month' | 'range' | 'all'

type ExpenseFormState = {
  expenseCategoryId: string
  categoryName: string
  amount: string
  expenseDate: string
  description: string
}

const initialFormState: ExpenseFormState = {
  expenseCategoryId: '',
  categoryName: '',
  amount: '',
  expenseDate: '',
  description: '',
}

export default function ExpensesOperations(): ReactElement {
  const {
    session,
    setStatus,
    ensureExpenseCategories,
    expenseCategories,
    expensesCache,
    reloadExpensesCache,
  } = useAppDataContext()
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [rangeStart, setRangeStart] = useState<string>('')
  const [rangeEnd, setRangeEnd] = useState<string>('')
  const [results, setResults] = useState<Expense[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [formState, setFormState] = useState<ExpenseFormState>(initialFormState)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [lastQuery, setLastQuery] = useState<{ mode: ViewMode; payload?: Record<string, unknown> } | null>(null)

  useEffect(() => {
    if (!session) return
    void ensureExpenseCategories()
    void reloadExpensesCache(session.username)
  }, [session, ensureExpenseCategories, reloadExpensesCache])

  useEffect(() => {
    if (!session) return
    void loadExpenses('month', {
      username: session.username,
      month: selectedMonth,
      year: selectedYear,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const categorySuggestions = useMemo(() => {
    const query = formState.categoryName.trim().toLowerCase()
    const base = query
      ? expenseCategories.filter((category) =>
          category.expenseCategoryName.toLowerCase().includes(query),
        )
      : expenseCategories
    return base.slice(0, 10)
  }, [formState.categoryName, expenseCategories])

  const descriptionSuggestions = useMemo(() => {
    const query = formState.description.trim().toLowerCase()
    const unique = new Set<string>()
    expensesCache.forEach((expense) => {
      const candidate = (expense.description ?? expense.expenseName ?? '').trim()
      if (candidate.length === 0) return
      if (query && !candidate.toLowerCase().includes(query)) return
      unique.add(candidate)
    })
    return Array.from(unique).slice(0, 10)
  }, [formState.description, expensesCache])

  const loadExpenses = async (mode: ViewMode, payload?: Record<string, unknown>) => {
    if (!session) return
    const username = session.username
    setLoading(true)
    setStatus({ type: 'loading', message: 'Fetching expenses...' })

    try {
      let data: Expense[] = []
      if (mode === 'month') {
        const monthPayload = payload as { month: number; year: number } | undefined
        const month = monthPayload?.month ?? selectedMonth
        const year = monthPayload?.year ?? selectedYear
        data = await fetchExpensesByMonth({ username, month, year })
        setLastQuery({ mode, payload: { month, year } })
      } else if (mode === 'range') {
        const range = payload as { start: string; end: string } | undefined
        const start = range?.start ?? rangeStart
        const end = range?.end ?? rangeEnd
        if (!start || !end) {
          throw new Error('Please provide both start and end dates for range search.')
        }
        data = await fetchExpensesByRange({ username, start, end })
        setLastQuery({ mode, payload: { start, end } })
      } else {
        data = await fetchExpenses(username)
        setLastQuery({ mode })
      }
      setResults(data)
      setStatus(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode)
  }

  const syncFormCategory = (value: string) => {
    setFormState((previous) => ({ ...previous, categoryName: value }))
    const match = expenseCategories.find(
      (category) => category.expenseCategoryName.toLowerCase() === value.toLowerCase(),
    )
    if (match) {
      setFormState((previous) => ({
        ...previous,
        categoryName: match.expenseCategoryName,
        expenseCategoryId: String(match.expenseCategoryId),
      }))
    }
  }

  const resetForm = () => {
    setEditingExpense(null)
    setFormState(initialFormState)
  }

  const handleEdit = (expense: Expense) => {
    const category = expenseCategories.find(
      (entry) => String(entry.expenseCategoryId) === String(expense.expenseCategoryId),
    )
    setEditingExpense(expense)
    setFormState({
      expenseCategoryId: String(expense.expenseCategoryId ?? ''),
      categoryName: category?.expenseCategoryName ?? '',
      amount: String(expense.amount ?? expense.expenseAmount ?? ''),
      expenseDate: (expense.expenseDate ?? '').slice(0, 10),
      description: (expense.description ?? expense.expenseName ?? '') as string,
    })
  }

  const refreshAfterMutation = async () => {
    if (!session) return
    await reloadExpensesCache(session.username)
    if (lastQuery) {
      await loadExpenses(lastQuery.mode, lastQuery.payload)
    }
  }

  const handleDelete = async (expense: Expense) => {
    if (!session) return
    const expensesId = expense.expensesId ?? expense.expenseId
    if (!expensesId) {
      setStatus({ type: 'error', message: 'Cannot delete expense without an identifier.' })
      return
    }
    const confirmed = window.confirm('Delete this expense?')
    if (!confirmed) return
    setStatus({ type: 'loading', message: 'Deleting expense...' })
    try {
      await deleteExpense({ username: session.username, expensesId })
      setStatus({ type: 'success', message: 'Expense deleted.' })
      await refreshAfterMutation()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session) return

    const { expenseCategoryId, amount, expenseDate, description } = formState
    if (!expenseCategoryId) {
      setStatus({ type: 'error', message: 'Please select an expense category.' })
      return
    }
    const numericAmount = parseAmount(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setStatus({ type: 'error', message: 'Enter a valid amount greater than zero.' })
      return
    }
    if (!expenseDate) {
      setStatus({ type: 'error', message: 'Please select a date.' })
      return
    }

    setStatus({ type: 'loading', message: editingExpense ? 'Updating expense...' : 'Adding expense...' })
    try {
      if (editingExpense) {
        const expensesId = editingExpense.expensesId ?? editingExpense.expenseId
        if (!expensesId) {
          throw new Error('Unable to update expense without identifier.')
        }
        await updateExpense({
          expensesId,
          username: session.username,
          amount: numericAmount,
          description,
          expenseDate,
          expenseCategoryId,
        })
        setStatus({ type: 'success', message: 'Expense updated.' })
      } else {
        await addExpense({
          username: session.username,
          expenseCategoryId,
          amount: numericAmount,
          expenseDate,
          description,
        })
        setStatus({ type: 'success', message: 'Expense added.' })
      }
      await refreshAfterMutation()
      resetForm()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    }
  }

  const totalAmount = useMemo(
    () => results.reduce((sum, expense) => sum + getAmount(expense), 0),
    [results],
  )

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <h2 className={styles.title}>Expense Explorer</h2>
            <p className={styles.subtitle}>View expenses by month, date range, or all history.</p>
          </div>
          <span className={styles.badge}>{results.length} records</span>
        </header>

        <form
          className={styles.filterRow}
          onSubmit={(event) => {
            event.preventDefault()
            void loadExpenses(viewMode)
          }}
        >
          <div className={styles.modeSelector}>
            <label className={styles.modeOption}>
              <input
                type="radio"
                name="viewMode"
                value="month"
                checked={viewMode === 'month'}
                onChange={() => handleModeChange('month')}
              />
              <span>Month</span>
            </label>
            <label className={styles.modeOption}>
              <input
                type="radio"
                name="viewMode"
                value="range"
                checked={viewMode === 'range'}
                onChange={() => handleModeChange('range')}
              />
              <span>Range</span>
            </label>
            <label className={styles.modeOption}>
              <input
                type="radio"
                name="viewMode"
                value="all"
                checked={viewMode === 'all'}
                onChange={() => handleModeChange('all')}
              />
              <span>All</span>
            </label>
          </div>

          {viewMode === 'month' && (
            <div className={styles.monthInputs}>
              <label className={styles.inlineField}>
                <span>Month</span>
                <select
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(Number(event.target.value))}
                >
                  {MONTHS.map((label, index) => (
                    <option key={label} value={index + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.inlineField}>
                <span>Year</span>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(Number(event.target.value))}
                  min={2000}
                  max={2100}
                />
              </label>
            </div>
          )}

          {viewMode === 'range' && (
            <div className={styles.rangeInputs}>
              <label className={styles.inlineField}>
                <span>Start</span>
                <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
              </label>
              <label className={styles.inlineField}>
                <span>End</span>
                <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
              </label>
            </div>
          )}

          <button className={styles.primaryButton} type="submit" disabled={loading}>
            {loading ? 'Loading…' : 'Load Expenses'}
          </button>
        </form>

        <div className={styles.tableContainer}>
          {results.length === 0 ? (
            <p className={styles.placeholder}>{loading ? 'Loading data…' : 'No expenses to display.'}</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col">Category</th>
                  <th scope="col" className={styles.numeric}>Amount</th>
                  <th scope="col">Date</th>
                  <th scope="col" className={styles.actions}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((expense) => {
                  const key = ensureId(expense)
                  const category = expenseCategories.find(
                    (entry) => String(entry.expenseCategoryId) === String(expense.expenseCategoryId),
                  )
                  return (
                    <tr key={key}>
                      <td>{expense.description ?? expense.expenseName ?? '-'}</td>
                      <td>{category?.expenseCategoryName ?? 'Uncategorised'}</td>
                      <td className={styles.numeric}>{formatAmount(expense.amount ?? expense.expenseAmount)}</td>
                      <td>{formatDate(expense.expenseDate)}</td>
                      <td className={styles.actions}>
                        <button type="button" onClick={() => handleEdit(expense)}>
                          Edit
                        </button>
                        <button type="button" onClick={() => void handleDelete(expense)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  <td className={styles.numeric}>{formatAmount(totalAmount)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <h2 className={styles.title}>{editingExpense ? 'Update Expense' : 'Add Expense'}</h2>
            <p className={styles.subtitle}>
              {editingExpense ? 'Modify the selected expense entry.' : 'Record a new expense entry.'}
            </p>
          </div>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Category</span>
            <input
              list="expense-category-options"
              value={formState.categoryName}
              onChange={(event) => syncFormCategory(event.target.value)}
              placeholder="Start typing to search categories"
              autoComplete="off"
              required
            />
            <datalist id="expense-category-options">
              {categorySuggestions.map((category) => (
                <option key={category.expenseCategoryId} value={category.expenseCategoryName} />
              ))}
            </datalist>
          </label>

          <label className={styles.field}>
            <span>Amount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formState.amount}
              onChange={(event) => setFormState((previous) => ({ ...previous, amount: event.target.value }))}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Date</span>
            <input
              type="date"
              value={formState.expenseDate}
              onChange={(event) => setFormState((previous) => ({ ...previous, expenseDate: event.target.value }))}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Description</span>
            <input
              list="expense-description-options"
              value={formState.description}
              onChange={(event) => setFormState((previous) => ({ ...previous, description: event.target.value }))}
              placeholder="Enter description"
              autoComplete="off"
            />
            <datalist id="expense-description-options">
              {descriptionSuggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </label>

          <div className={styles.formActions}>
            <button className={styles.primaryButton} type="submit">
              {editingExpense ? 'Update Expense' : 'Add Expense'}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={resetForm}
            >
              Clear
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
