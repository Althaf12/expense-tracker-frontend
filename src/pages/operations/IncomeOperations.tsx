import Grid from '@mui/material/Grid'
import { Typography } from '@mui/material'
import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'
import { addIncome, deleteIncome, fetchIncomeByMonth, fetchIncomeByRange, updateIncome } from '../../api'
import type { Income } from '../../types/app'
import { useAppDataContext } from '../../context/AppDataContext'
import { formatAmount, formatDate, parseAmount } from '../../utils/format'
import styles from './IncomeOperations.module.css'
import Skeleton from '../../components/Skeleton'

type IncomeViewMode = 'current-year' | 'month' | 'range'

type IncomeFormState = {
  source: string
  amount: string
  receivedDate: string
}

type TableFilters = {
  source: string
  amount: string
  date: string
  month: string
  year: string
}

const initialForm: IncomeFormState = {
  source: '',
  amount: '',
  receivedDate: '',
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

const deriveMonthYear = (isoDate: string): { monthName: string; monthNumber: number; year: number } => {
  const parsed = new Date(isoDate)
  const monthNumber = parsed.getMonth() + 1
  const year = parsed.getFullYear()
  const monthName = MONTHS[monthNumber - 1] ?? ''
  return { monthName, monthNumber, year }
}

const ensureIncomeId = (income: Income): string =>
  String(income.incomeId ?? `${income.source ?? 'income'}-${income.receivedDate ?? ''}`)

export default function IncomeOperations(): ReactElement {
  const {
    session,
    setStatus,
    incomesCache,
    reloadIncomesCache,
  } = useAppDataContext()
  const [viewMode, setViewMode] = useState<IncomeViewMode>('current-year')
  const [results, setResults] = useState<Income[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [formState, setFormState] = useState<IncomeFormState>(initialForm)
  const [lastQuery, setLastQuery] = useState<{ mode: IncomeViewMode; payload?: Record<string, unknown> } | null>(null)
  const [monthFilter, setMonthFilter] = useState<number>(new Date().getMonth() + 1)
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear())
  const [rangeStart, setRangeStart] = useState<string>('')
  const [rangeEnd, setRangeEnd] = useState<string>('')
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingRowDraft, setEditingRowDraft] = useState<IncomeFormState | null>(null)
  const [tableFilters, setTableFilters] = useState<TableFilters>({
    source: '',
    amount: '',
    date: '',
    month: '',
    year: '',
  })

  useEffect(() => {
    if (!session) return
  void reloadIncomesCache(session.username)
  void loadIncomes('current-year')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const sourceSuggestions = useMemo(() => {
    const query = formState.source.trim().toLowerCase()
    const unique = new Set<string>()
    incomesCache.forEach((income) => {
      const source = (income.source ?? '').trim()
      if (!source) return
      if (query && !source.toLowerCase().includes(query)) return
      unique.add(source)
    })
    return Array.from(unique).slice(0, 10)
  }, [formState.source, incomesCache])

  const loadIncomes = async (mode: IncomeViewMode, payload?: Record<string, unknown>) => {
    if (!session) return
    const username = session.username
    setLoading(true)
    setStatus({ type: 'loading', message: 'Fetching income records...' })
    try {
      let data: Income[] = []
      if (mode === 'current-year') {
        const currentYear = new Date().getFullYear()
        data = await fetchIncomeByRange({
          username,
          fromMonth: '01',
          fromYear: String(currentYear),
          toMonth: '12',
          toYear: String(currentYear),
        })
        setLastQuery({ mode })
      } else if (mode === 'month') {
        const monthPayload = payload as { month: number; year: number } | undefined
        const month = monthPayload?.month ?? monthFilter
        const year = monthPayload?.year ?? yearFilter
        data = await fetchIncomeByMonth({ username, month, year })
        setLastQuery({ mode, payload: { month, year } })
      } else {
        const rangePayload = payload as { start: string; end: string } | undefined
        const start = rangePayload?.start ?? rangeStart
        const end = rangePayload?.end ?? rangeEnd
        if (!start || !end) {
          throw new Error('Provide both start and end dates to fetch by range.')
        }
        data = await fetchIncomeByRange({ username, fromMonth: start.slice(5, 7), fromYear: start.slice(0, 4), toMonth: end.slice(5, 7), toYear: end.slice(0, 4) })
        setLastQuery({ mode, payload: { start, end } })
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

  const filteredResults = useMemo(() => {
    const sourceQuery = tableFilters.source.trim().toLowerCase()
    const amountQuery = tableFilters.amount.trim().toLowerCase()
    const dateQuery = tableFilters.date.trim().toLowerCase()
    const monthQuery = tableFilters.month.trim().toLowerCase()
    const yearQuery = tableFilters.year.trim().toLowerCase()

    if (!sourceQuery && !amountQuery && !dateQuery && !monthQuery && !yearQuery) {
      return results
    }

    return results.filter((income) => {
      const sourceValue = (income.source ?? '').toString().toLowerCase()

      const numericAmount = typeof income.amount === 'number' ? income.amount : Number(income.amount ?? 0)
      const amountString = Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : ''
      const formattedAmount = formatAmount(numericAmount).toLowerCase()

      const rawDate = (income.receivedDate ?? '').toString().toLowerCase()
      const formattedDate = formatDate(income.receivedDate).toLowerCase()

      const derived = income.receivedDate ? deriveMonthYear(String(income.receivedDate)) : null
      const normalizedMonth =
        typeof income.month === 'number' ? MONTHS[income.month - 1] ?? String(income.month) : income.month
      const monthDisplay = (normalizedMonth ?? derived?.monthName ?? '').toString().toLowerCase()
      const yearDisplay = String(income.year ?? derived?.year ?? '').toLowerCase()

      if (sourceQuery && !sourceValue.includes(sourceQuery)) {
        return false
      }
      if (amountQuery && !amountString.includes(amountQuery) && !formattedAmount.includes(amountQuery)) {
        return false
      }
      if (dateQuery && !rawDate.includes(dateQuery) && !formattedDate.includes(dateQuery)) {
        return false
      }
      if (monthQuery && !monthDisplay.includes(monthQuery)) {
        return false
      }
      if (yearQuery && !yearDisplay.includes(yearQuery)) {
        return false
      }

      return true
    })
  }, [results, tableFilters])

  const filtersApplied = useMemo(
    () => Object.values(tableFilters).some((value) => value.trim().length > 0),
    [tableFilters],
  )

  const startInlineEdit = (income: Income) => {
    const key = ensureIncomeId(income)
    setEditingRowId(key)
    setEditingRowDraft({
      source: income.source ?? '',
      amount: String(income.amount ?? ''),
      receivedDate: (income.receivedDate ?? '').slice(0, 10),
    })
  }

  const cancelInlineEdit = () => {
    setEditingRowId(null)
    setEditingRowDraft(null)
  }

  const updateInlineDraft = (field: keyof IncomeFormState, value: string) => {
    setEditingRowDraft((previous) => (previous ? { ...previous, [field]: value } : previous))
  }

  const confirmInlineEdit = async (income: Income) => {
    if (!session || !editingRowDraft) return
    const incomeId = income.incomeId
    if (!incomeId) {
      setStatus({ type: 'error', message: 'Unable to update income without identifier.' })
      return
    }

    if (!editingRowDraft.source.trim()) {
      setStatus({ type: 'error', message: 'Provide an income source.' })
      return
    }
    const numericAmount = parseAmount(editingRowDraft.amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setStatus({ type: 'error', message: 'Provide a valid income amount.' })
      return
    }
    if (!editingRowDraft.receivedDate) {
      setStatus({ type: 'error', message: 'Select a received date.' })
      return
    }

  const { monthName, monthNumber, year } = deriveMonthYear(editingRowDraft.receivedDate)

    setStatus({ type: 'loading', message: 'Updating income...' })
    try {
      await updateIncome({
        incomeId,
        username: session.username,
        source: editingRowDraft.source,
        amount: numericAmount,
        receivedDate: editingRowDraft.receivedDate,
        month: monthName || monthNumber,
        year,
      })
      setStatus({ type: 'success', message: 'Income updated.' })
      await reloadIncomesCache(session.username)
      if (lastQuery) {
        await loadIncomes(lastQuery.mode, lastQuery.payload)
      }
      cancelInlineEdit()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session) return
    const { source, amount, receivedDate } = formState
    if (!source.trim()) {
      setStatus({ type: 'error', message: 'Provide an income source.' })
      return
    }
    const numericAmount = parseAmount(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setStatus({ type: 'error', message: 'Provide a valid income amount.' })
      return
    }
    if (!receivedDate) {
      setStatus({ type: 'error', message: 'Select a received date.' })
      return
    }

    const { monthName, monthNumber, year } = deriveMonthYear(receivedDate)
    setStatus({ type: 'loading', message: 'Adding income...' })
    try {
      await addIncome({
        username: session.username,
        source,
        amount: numericAmount,
        receivedDate,
        month: monthName,
        year,
      })
      setStatus({ type: 'success', message: 'Income added.' })
      await reloadIncomesCache(session.username)
      if (lastQuery) {
        await loadIncomes(lastQuery.mode, lastQuery.payload)
      }
      setFormState(initialForm)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    }
  }

  const handleDelete = async (income: Income) => {
    if (!session) return
    if (!income.incomeId) {
      setStatus({ type: 'error', message: 'Cannot delete income without identifier.' })
      return
    }
    const rowKey = ensureIncomeId(income)
    const confirmed = window.confirm('Delete this income entry?')
    if (!confirmed) return
    setStatus({ type: 'loading', message: 'Deleting income...' })
    try {
      await deleteIncome({ username: session.username, incomeId: income.incomeId })
      setStatus({ type: 'success', message: 'Income deleted.' })
      if (editingRowId === rowKey) {
        cancelInlineEdit()
      }
      await reloadIncomesCache(session.username)
      if (lastQuery) {
        await loadIncomes(lastQuery.mode, lastQuery.payload)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    }
  }

  const totalIncome = useMemo(
    () =>
      filteredResults.reduce(
        (sum, income) => sum + (typeof income.amount === 'number' ? income.amount : Number(income.amount ?? 0)),
        0,
      ),
    [filteredResults],
  )

  const handleFilterChange = (field: keyof TableFilters, value: string) => {
    setTableFilters((previous) => ({ ...previous, [field]: value }))
  }

  const clearFilters = () => {
    setTableFilters({ source: '', amount: '', date: '', month: '', year: '' })
  }

  return (
    <Grid container component="section" className={styles.page} spacing={3}>
      <Grid size={{ xs: 12, xl: 8 }}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <Typography variant="h5" component="h2" className={styles.title}>
                Income Overview
              </Typography>
              <Typography variant="body2" component="p" className={styles.subtitle}>
                Review and manage income entries.
              </Typography>
            </div>
            <span className={styles.badge}>{filteredResults.length} records</span>
          </header>

          <form
            className={styles.filterRow}
            onSubmit={(event) => {
              event.preventDefault()
              void loadIncomes(viewMode)
            }}
          >
            <div className={styles.modeSelector}>
              <label>
                <input
                  type="radio"
                  name="incomeMode"
                  value="current-year"
                  checked={viewMode === 'current-year'}
                  onChange={() => setViewMode('current-year')}
                />
                Current year
              </label>
              <label>
                <input
                  type="radio"
                  name="incomeMode"
                  value="month"
                  checked={viewMode === 'month'}
                  onChange={() => setViewMode('month')}
                />
                Month
              </label>
              <label>
                <input
                  type="radio"
                  name="incomeMode"
                  value="range"
                  checked={viewMode === 'range'}
                  onChange={() => setViewMode('range')}
                />
                Range
              </label>
            </div>

            {viewMode === 'month' && (
              <div className={styles.monthInputs}>
                <label>
                  <span>Month</span>
                  <select value={monthFilter} onChange={(event) => setMonthFilter(Number(event.target.value))}>
                    {MONTHS.map((monthName, index) => (
                      <option key={monthName} value={index + 1}>
                        {monthName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Year</span>
                  <input
                    type="number"
                    value={yearFilter}
                    min={2000}
                    max={2100}
                    onChange={(event) => setYearFilter(Number(event.target.value))}
                  />
                </label>
              </div>
            )}

            {viewMode === 'range' && (
              <div className={styles.rangeInputs}>
                <label>
                  <span>Start</span>
                  <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
                </label>
                <label>
                  <span>End</span>
                  <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
                </label>
              </div>
            )}

            <button className={styles.primaryButton} type="submit" disabled={loading}>
              {loading ? 'Loading…' : 'Load Income'}
            </button>
          </form>

          <div className={styles.tableContainer}>
            {results.length === 0 ? (
              loading ? (
                <div style={{padding:16}}>
                  {[0,1,2,3].map((i) => (
                    <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 120px 120px 120px 80px 80px',gap:12,alignItems:'center',marginBottom:12}}>
                      <div><Skeleton /></div>
                      <div><Skeleton /></div>
                      <div><Skeleton /></div>
                      <div><Skeleton /></div>
                      <div><Skeleton /></div>
                      <div><Skeleton /></div>
                    </div>
                  ))}
                </div>
              ) : (
                <Typography variant="body2" component="p" className={styles.placeholder}>
                  No income entries to display.
                </Typography>
              )
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Source</th>
                    <th scope="col" className={styles.numeric}>Amount</th>
                    <th scope="col">Received</th>
                    <th scope="col">Month</th>
                    <th scope="col">Year</th>
                    <th scope="col" className={styles.actions}>Actions</th>
                  </tr>
                  <tr className={styles.tableFilterRow}>
                    <th scope="col">
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter source"
                        value={tableFilters.source}
                        onChange={(event) => handleFilterChange('source', event.target.value)}
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
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter month"
                        value={tableFilters.month}
                        onChange={(event) => handleFilterChange('month', event.target.value)}
                      />
                    </th>
                    <th scope="col">
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter year"
                        value={tableFilters.year}
                        onChange={(event) => handleFilterChange('year', event.target.value)}
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
                      <td colSpan={6}>No income entries match the current filters.</td>
                    </tr>
                  ) : (
                    filteredResults.map((income) => {
                      const key = ensureIncomeId(income)
                      const isEditing = editingRowId === key
                      const draft = isEditing ? editingRowDraft : null
                      const draftSource = draft?.source ?? income.source ?? ''
                      const draftAmount = draft?.amount ?? String(income.amount ?? '')
                      const draftDate =
                        draft?.receivedDate ?? (income.receivedDate ? String(income.receivedDate).slice(0, 10) : '')
                      const derived = draftDate ? deriveMonthYear(draftDate) : null
                      const fallbackDerived = income.receivedDate ? deriveMonthYear(String(income.receivedDate)) : null
                      const normalizedMonth =
                        typeof income.month === 'number'
                          ? MONTHS[income.month - 1] ?? String(income.month)
                          : income.month
                      const monthDisplay = derived?.monthName ?? normalizedMonth ?? fallbackDerived?.monthName ?? '-'
                      const yearDisplay = derived?.year ?? income.year ?? fallbackDerived?.year ?? ''

                      return (
                        <tr key={key}>
                          <td>
                            {isEditing ? (
                              <input
                                className={styles.inlineInput}
                                type="text"
                                value={draftSource}
                                onChange={(event) => updateInlineDraft('source', event.target.value)}
                              />
                            ) : (
                              draftSource || '-'
                            )}
                          </td>
                          <td className={styles.numeric}>
                            {isEditing ? (
                              <input
                                className={styles.inlineInput}
                                type="number"
                                min="0"
                                step="0.01"
                                value={draftAmount}
                                onChange={(event) => updateInlineDraft('amount', event.target.value)}
                              />
                            ) : (
                              formatAmount(income.amount)
                            )}
                          </td>
                          <td className={styles.date}>
                            {isEditing ? (
                              <input
                                className={styles.inlineInput}
                                type="date"
                                value={draftDate}
                                onChange={(event) => updateInlineDraft('receivedDate', event.target.value)}
                              />
                            ) : (
                              formatDate(income.receivedDate)
                            )}
                          </td>
                          <td>{monthDisplay}</td>
                          <td>{yearDisplay}</td>
                          <td className={styles.actions}>
                            {isEditing ? (
                              <>
                                <button type="button" onClick={() => void confirmInlineEdit(income)}>
                                  Confirm
                                </button>
                                <button type="button" onClick={cancelInlineEdit}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => startInlineEdit(income)}>
                                  Edit
                                </button>
                                <button type="button" onClick={() => void handleDelete(income)}>
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
                    <td>Total</td>
                    <td className={styles.numeric}>
                      <span className={styles.totalPill}>{formatAmount(totalIncome)}</span>
                    </td>
                    <td colSpan={4} />
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
                Add Income
              </Typography>
              <Typography variant="body2" component="p" className={styles.subtitle}>
                Capture a new income item.
              </Typography>
            </div>
          </header>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Source</span>
              <input
                list="income-source-suggestions"
                value={formState.source}
                onChange={(event) => setFormState((previous) => ({ ...previous, source: event.target.value }))}
                placeholder="Salary, Freelance, Rent..."
                autoComplete="off"
                required
              />
              <datalist id="income-source-suggestions">
                {sourceSuggestions.map((source) => (
                  <option key={source} value={source} />
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
              <span>Received Date</span>
              <input
                type="date"
                value={formState.receivedDate}
                onChange={(event) => setFormState((previous) => ({ ...previous, receivedDate: event.target.value }))}
                required
              />
            </label>

            <div className={styles.formActions}>
              <button className={styles.primaryButton} type="submit">
                Add Income
              </button>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => {
                  setFormState(initialForm)
                }}
              >
                Clear
              </button>
            </div>
          </form>
        </section>
      </Grid>
    </Grid>
  )
}
