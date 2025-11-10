import Grid from '@mui/material/Grid'
import { Typography } from '@mui/material'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react'
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

type ViewMode = 'month' | 'range' | 'all'

type ExpenseFormState = {
  expenseCategoryId: string
  categoryName: string
  amount: string
  expenseDate: string
  expenseName: string
}

type InlineEditDraft = {
  expenseName: string
  expenseCategoryId: string
  expenseAmount: string
  expenseDate: string
}

type TableFilters = {
  expenseName: string
  category: string
  amount: string
  date: string
}

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

const initialFormState: ExpenseFormState = {
  expenseCategoryId: '',
  categoryName: '',
  amount: '',
  expenseDate: '',
  expenseName: '',
}

const ensureId = (expense: Expense): string =>
  String(
    expense.expensesId ??
      expense.expenseId ??
      `${expense.expenseName ?? expense.description ?? 'expense'}-${expense.expenseDate ?? ''}`,
  )

const getAmount = (expense: Expense): number => {
  const value = expense.amount ?? expense.expenseAmount
  return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0
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
  const [lastQuery, setLastQuery] = useState<{ mode: ViewMode; payload?: Record<string, unknown> } | null>(null)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingRowDraft, setEditingRowDraft] = useState<InlineEditDraft | null>(null)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState<boolean>(false)
  const categoryFieldRef = useRef<HTMLLabelElement | null>(null)
  const [tableFilters, setTableFilters] = useState<TableFilters>({ expenseName: '', category: '', amount: '', date: '' })

  useEffect(() => {
    if (!session) return
    void ensureExpenseCategories()
    void reloadExpensesCache(session.username)
  }, [session, ensureExpenseCategories, reloadExpensesCache])

  useEffect(() => {
    if (!categoryDropdownOpen) return

    const handleClickAway = (event: MouseEvent) => {
      if (categoryFieldRef.current && !categoryFieldRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickAway)
    return () => {
      document.removeEventListener('mousedown', handleClickAway)
    }
  }, [categoryDropdownOpen])

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
    if (!query) return expenseCategories
    return expenseCategories.filter((category) =>
      category.expenseCategoryName.toLowerCase().includes(query),
    )
  }, [formState.categoryName, expenseCategories])

  const expenseSuggestions = useMemo(() => {
    const query = formState.expenseName.trim().toLowerCase()
    const unique = new Set<string>()
    expensesCache.forEach((expense) => {
      const candidate = (expense.expenseName ?? expense.description ?? '').trim()
      if (candidate.length === 0) return
      if (query && !candidate.toLowerCase().includes(query)) return
      unique.add(candidate)
    })
    return Array.from(unique).slice(0, 10)
  }, [formState.expenseName, expensesCache])

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
        const rangePayload = payload as { start: string; end: string } | undefined
        const start = rangePayload?.start ?? rangeStart
        const end = rangePayload?.end ?? rangeEnd
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
    const match = expenseCategories.find(
      (category) => category.expenseCategoryName.toLowerCase() === value.toLowerCase(),
    )
    setFormState((previous) => ({
      ...previous,
      categoryName: match ? match.expenseCategoryName : value,
      expenseCategoryId: match ? String(match.expenseCategoryId) : '',
    }))
  }

  const resetForm = () => {
    setFormState(initialFormState)
    setCategoryDropdownOpen(false)
  }

  const refreshAfterMutation = async () => {
    if (!session) return
    await reloadExpensesCache(session.username)
    if (lastQuery) {
      await loadExpenses(lastQuery.mode, lastQuery.payload)
    }
  }

  const filteredResults = useMemo(() => {
    const nameQuery = tableFilters.expenseName.trim().toLowerCase()
    const categoryQuery = tableFilters.category.trim().toLowerCase()
    const amountQuery = tableFilters.amount.trim().toLowerCase()
    const dateQuery = tableFilters.date.trim().toLowerCase()

    if (!nameQuery && !categoryQuery && !amountQuery && !dateQuery) {
      return results
    }

    return results.filter((expense) => {
      const expenseName = (expense.expenseName ?? expense.description ?? '').toString().toLowerCase()
      const explicitCategory = (expense as Expense & { expenseCategoryName?: string }).expenseCategoryName
      const categoryMatch = expenseCategories.find(
        (entry) => String(entry.expenseCategoryId) === String(expense.expenseCategoryId),
      )
      const categoryName = (explicitCategory ?? categoryMatch?.expenseCategoryName ?? 'Uncategorised').toLowerCase()

      const numericAmount = getAmount(expense)
      const amountString = Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : ''
      const formattedAmount = formatAmount(numericAmount).toLowerCase()

      const rawDate = (expense.expenseDate ?? '').toString().toLowerCase()
      const prettyDate = formatDate(expense.expenseDate).toLowerCase()

      if (nameQuery && !expenseName.includes(nameQuery)) {
        return false
      }
      if (categoryQuery && !categoryName.includes(categoryQuery)) {
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
  }, [results, tableFilters, expenseCategories])

  const filtersApplied = useMemo(
    () => Object.values(tableFilters).some((value) => value.trim().length > 0),
    [tableFilters],
  )

  const startInlineEdit = (expense: Expense) => {
    const key = ensureId(expense)
    let derivedCategoryId = String(expense.expenseCategoryId ?? '')
    if (!derivedCategoryId) {
      const explicitName = (expense as Expense & { expenseCategoryName?: string }).expenseCategoryName
      if (explicitName) {
        const match = expenseCategories.find((category) => category.expenseCategoryName === explicitName)
        if (match) {
          derivedCategoryId = String(match.expenseCategoryId)
        }
      }
    }

    setEditingRowId(key)
    setEditingRowDraft({
      expenseName: (expense.expenseName ?? expense.description ?? '').toString(),
      expenseCategoryId: derivedCategoryId,
      expenseAmount: String(expense.amount ?? expense.expenseAmount ?? ''),
      expenseDate: (expense.expenseDate ?? '').slice(0, 10),
    })
  }

  const cancelInlineEdit = () => {
    setEditingRowId(null)
    setEditingRowDraft(null)
  }

  const updateInlineDraft = (
    field: keyof InlineEditDraft,
    value: string,
  ) => {
    setEditingRowDraft((previous) => (previous ? { ...previous, [field]: value } : previous))
  }

  const confirmInlineEdit = async (expense: Expense) => {
    if (!session || !editingRowDraft) return
    const expensesId = expense.expensesId ?? expense.expenseId
    if (!expensesId) {
      setStatus({ type: 'error', message: 'Unable to update expense without identifier.' })
      return
    }

    const numericAmount = parseAmount(editingRowDraft.expenseAmount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setStatus({ type: 'error', message: 'Enter a valid amount greater than zero.' })
      return
    }
    if (!editingRowDraft.expenseCategoryId) {
      setStatus({ type: 'error', message: 'Select a category before confirming.' })
      return
    }
    if (!editingRowDraft.expenseDate) {
      setStatus({ type: 'error', message: 'Select a date before confirming.' })
      return
    }

    setStatus({ type: 'loading', message: 'Updating expense...' })
    try {
      await updateExpense({
        expensesId,
        username: session.username,
        expenseAmount: numericAmount,
        expenseName: editingRowDraft.expenseName,
        expenseDate: editingRowDraft.expenseDate,
        expenseCategoryId: editingRowDraft.expenseCategoryId,
      })
      setStatus({ type: 'success', message: 'Expense updated.' })
      await refreshAfterMutation()
      cancelInlineEdit()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
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
      if (editingRowId === ensureId(expense)) {
        cancelInlineEdit()
      }
      await refreshAfterMutation()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session) return

    const { expenseCategoryId, amount, expenseDate, expenseName } = formState
    if (!expenseName.trim()) {
      setStatus({ type: 'error', message: 'Please provide an expense name.' })
      return
    }
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

    setStatus({ type: 'loading', message: 'Adding expense...' })
    try {
      await addExpense({
        username: session.username,
        expenseCategoryId,
        expenseAmount: numericAmount,
        expenseDate,
        expenseName,
      })
      setStatus({ type: 'success', message: 'Expense added.' })
      await refreshAfterMutation()
      resetForm()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    }
  }

  const totalAmount = useMemo(
    () => filteredResults.reduce((sum, expense) => sum + getAmount(expense), 0),
    [filteredResults],
  )

  const handleFilterChange = (field: keyof TableFilters, value: string) => {
    setTableFilters((previous) => ({ ...previous, [field]: value }))
  }

  const clearFilters = () => {
    setTableFilters({ expenseName: '', category: '', amount: '', date: '' })
  }

  return (
    <Grid container component="section" className={styles.page} spacing={3}>
      <Grid size={{ xs: 12, xl: 8 }}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <Typography variant="h5" component="h2" className={styles.title}>
                Expense Explorer
              </Typography>
              <Typography variant="body2" component="p" className={styles.subtitle}>
                View expenses by month, date range, or all history.
              </Typography>
            </div>
            <span className={styles.badge}>{filteredResults.length} records</span>
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
                  <select value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))}>
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
              <Typography variant="body2" component="p" className={styles.placeholder}>
                {loading ? 'Loading data…' : 'No expenses to display.'}
              </Typography>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Expense</th>
                    <th scope="col">Category</th>
                    <th scope="col" className={styles.numeric}>Amount</th>
                    <th scope="col" className={styles.date}>Date</th>
                    <th scope="col" className={styles.actions}>Actions</th>
                  </tr>
                  <tr className={styles.tableFilterRow}>
                    <th scope="col">
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter expense"
                        value={tableFilters.expenseName}
                        onChange={(event) => handleFilterChange('expenseName', event.target.value)}
                      />
                    </th>
                    <th scope="col">
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter category"
                        value={tableFilters.category}
                        onChange={(event) => handleFilterChange('category', event.target.value)}
                      />
                    </th>
                    <th scope="col">
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter amount"
                        value={tableFilters.amount}
                        onChange={(event) => handleFilterChange('amount', event.target.value)}
                      />
                    </th>
                    <th scope="col">
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter date"
                        value={tableFilters.date}
                        onChange={(event) => handleFilterChange('date', event.target.value)}
                      />
                    </th>
                    <th scope="col">
                      {filtersApplied && (
                        <button type="button" onClick={clearFilters}>
                          Clear
                        </button>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.length === 0 ? (
                    <tr className={styles.emptyRow}>
                      <td colSpan={5}>No expenses match the current filters.</td>
                    </tr>
                  ) : (
                    filteredResults.map((expense) => {
                      const key = ensureId(expense)
                      const category = expenseCategories.find(
                        (entry) => String(entry.expenseCategoryId) === String(expense.expenseCategoryId),
                      )
                      const displayCategory =
                        (expense as Expense & { expenseCategoryName?: string }).expenseCategoryName ??
                        category?.expenseCategoryName ??
                        'Uncategorised'
                      const isEditing = editingRowId === key
                      const draft = isEditing ? editingRowDraft : null

                      return (
                        <tr key={key}>
                          <td>
                            {isEditing ? (
                              <input
                                className={styles.inlineInput}
                                value={draft?.expenseName ?? ''}
                                onChange={(event) => updateInlineDraft('expenseName', event.target.value)}
                                placeholder="Expense"
                              />
                            ) : (
                              expense.expenseName ?? expense.description ?? '-'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <select
                                className={styles.inlineSelect}
                                value={draft?.expenseCategoryId ?? ''}
                                onChange={(event) => updateInlineDraft('expenseCategoryId', event.target.value)}
                              >
                                <option value="">Select…</option>
                                {expenseCategories.map((entry) => (
                                  <option key={entry.expenseCategoryId} value={entry.expenseCategoryId}>
                                    {entry.expenseCategoryName}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              displayCategory
                            )}
                          </td>
                          <td className={styles.numeric}>
                            {isEditing ? (
                              <input
                                className={styles.inlineInput}
                                type="number"
                                min="0"
                                step="0.01"
                                value={draft?.expenseAmount ?? ''}
                                onChange={(event) => updateInlineDraft('expenseAmount', event.target.value)}
                              />
                            ) : (
                              formatAmount(expense.amount ?? expense.expenseAmount)
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className={styles.inlineInput}
                                type="date"
                                value={draft?.expenseDate ?? ''}
                                onChange={(event) => updateInlineDraft('expenseDate', event.target.value)}
                              />
                            ) : (
                              formatDate(expense.expenseDate)
                            )}
                          </td>
                          <td className={styles.actions}>
                            {isEditing ? (
                              <>
                                <button type="button" onClick={() => void confirmInlineEdit(expense)}>
                                  Confirm
                                </button>
                                <button type="button" onClick={cancelInlineEdit}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => startInlineEdit(expense)}>
                                  Edit
                                </button>
                                <button type="button" onClick={() => void handleDelete(expense)}>
                                  Delete
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Total</td>
                    <td className={styles.numeric}>
                      <span className={styles.totalPill}>{formatAmount(totalAmount)}</span>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </section>
      </Grid>
      <Grid size={{ xs: 12, xl: 4 }}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <Typography variant="h5" component="h2" className={styles.title}>
                Add Expense
              </Typography>
              <Typography variant="body2" component="p" className={styles.subtitle}>
                Record a new expense entry.
              </Typography>
            </div>
          </header>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Expense</span>
              <input
                list="expense-name-options"
                value={formState.expenseName}
                onChange={(event) => setFormState((previous) => ({ ...previous, expenseName: event.target.value }))}
                placeholder="What did you spend on?"
                autoComplete="off"
                required
              />
              <datalist id="expense-name-options">
                {expenseSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </label>

            <label className={`${styles.field} ${styles.dropdownField}`} ref={categoryFieldRef}>
              <span>Category</span>
              <input
                type="text"
                value={formState.categoryName}
                placeholder="Select or search category"
                onChange={(event) => {
                  syncFormCategory(event.target.value)
                  setCategoryDropdownOpen(true)
                }}
                onFocus={() => setCategoryDropdownOpen(true)}
                onClick={() => setCategoryDropdownOpen(true)}
                autoComplete="off"
                required
              />
              {categoryDropdownOpen && (
                <ul className={styles.dropdownList} role="listbox">
                  {categorySuggestions.length === 0 ? (
                    <li className={styles.dropdownEmpty}>No categories found</li>
                  ) : (
                    categorySuggestions.map((category) => (
                      <li
                        key={category.expenseCategoryId}
                        className={styles.dropdownItem}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          syncFormCategory(category.expenseCategoryName)
                          setCategoryDropdownOpen(false)
                        }}
                      >
                        {category.expenseCategoryName}
                      </li>
                    ))
                  )}
                </ul>
              )}
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

            <div className={styles.formActions}>
              <button className={styles.primaryButton} type="submit">
                Add Expense
              </button>
              <button className={styles.secondaryButton} type="button" onClick={resetForm}>
                Clear
              </button>
            </div>
          </form>
        </section>
      </Grid>
    </Grid>
  )
}
