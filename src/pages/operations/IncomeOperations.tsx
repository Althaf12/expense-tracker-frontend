import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'
import {
  addIncome,
  deleteIncome,
  fetchIncomeByMonth,
  fetchIncomeByRange,
  fetchIncomeLastYear,
  updateIncome,
} from '../../api'
import type { Income } from '../../types/app'
import { useAppDataContext } from '../../context/AppDataContext'
import { formatAmount, formatDate, parseAmount } from '../../utils/format'
import styles from './IncomeOperations.module.css'

type IncomeViewMode = 'last-year' | 'month' | 'range'

type IncomeFormState = {
  source: string
  amount: string
  receivedDate: string
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
  const [viewMode, setViewMode] = useState<IncomeViewMode>('last-year')
  const [results, setResults] = useState<Income[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [formState, setFormState] = useState<IncomeFormState>(initialForm)
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [lastQuery, setLastQuery] = useState<{ mode: IncomeViewMode; payload?: Record<string, unknown> } | null>(null)
  const [monthFilter, setMonthFilter] = useState<number>(new Date().getMonth() + 1)
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear())
  const [rangeStart, setRangeStart] = useState<string>('')
  const [rangeEnd, setRangeEnd] = useState<string>('')

  useEffect(() => {
    if (!session) return
    void reloadIncomesCache(session.username)
    void loadIncomes('last-year')
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
      if (mode === 'last-year') {
        const currentYear = new Date().getFullYear()
        data = await fetchIncomeLastYear(username, currentYear)
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
    setStatus({ type: 'loading', message: editingIncome ? 'Updating income...' : 'Adding income...' })
    try {
      if (editingIncome) {
        const incomeId = editingIncome.incomeId
        if (!incomeId) {
          throw new Error('Missing income identifier for update.')
        }
        await updateIncome({
          incomeId,
          username: session.username,
          source,
          amount: numericAmount,
          receivedDate,
          month: monthNumber,
          year,
        })
        setStatus({ type: 'success', message: 'Income updated.' })
      } else {
        await addIncome({
          username: session.username,
          source,
          amount: numericAmount,
          receivedDate,
          month: monthName,
          year,
        })
        setStatus({ type: 'success', message: 'Income added.' })
      }
      await reloadIncomesCache(session.username)
      if (lastQuery) {
        await loadIncomes(lastQuery.mode, lastQuery.payload)
      }
      setFormState(initialForm)
      setEditingIncome(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    }
  }

  const handleEdit = (income: Income) => {
    setEditingIncome(income)
    setFormState({
      source: income.source ?? '',
      amount: String(income.amount ?? ''),
      receivedDate: (income.receivedDate ?? '').slice(0, 10),
    })
  }

  const handleDelete = async (income: Income) => {
    if (!session) return
    if (!income.incomeId) {
      setStatus({ type: 'error', message: 'Cannot delete income without identifier.' })
      return
    }
    const confirmed = window.confirm('Delete this income entry?')
    if (!confirmed) return
    setStatus({ type: 'loading', message: 'Deleting income...' })
    try {
      await deleteIncome({ username: session.username, incomeId: income.incomeId })
      setStatus({ type: 'success', message: 'Income deleted.' })
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
    () => results.reduce((sum, income) => sum + (typeof income.amount === 'number' ? income.amount : Number(income.amount ?? 0)), 0),
    [results],
  )

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <h2 className={styles.title}>Income Overview</h2>
            <p className={styles.subtitle}>Review and manage income entries.</p>
          </div>
          <span className={styles.badge}>{results.length} records</span>
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
                value="last-year"
                checked={viewMode === 'last-year'}
                onChange={() => setViewMode('last-year')}
              />
              Last year
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
            <p className={styles.placeholder}>{loading ? 'Loading data…' : 'No income entries to display.'}</p>
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
              </thead>
              <tbody>
                {results.map((income) => (
                  <tr key={ensureIncomeId(income)}>
                    <td>{income.source ?? '-'}</td>
                    <td className={styles.numeric}>{formatAmount(income.amount)}</td>
                    <td>{formatDate(income.receivedDate)}</td>
                    <td>{income.month ?? deriveMonthYear(String(income.receivedDate ?? '')).monthName}</td>
                    <td>{income.year ?? deriveMonthYear(String(income.receivedDate ?? '')).year}</td>
                    <td className={styles.actions}>
                      <button type="button" onClick={() => handleEdit(income)}>
                        Edit
                      </button>
                      <button type="button" onClick={() => void handleDelete(income)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className={styles.numeric}>{formatAmount(totalIncome)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <h2 className={styles.title}>{editingIncome ? 'Update Income' : 'Add Income'}</h2>
            <p className={styles.subtitle}>
              {editingIncome ? 'Modify the selected income entry.' : 'Capture a new income item.'}
            </p>
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
              {editingIncome ? 'Update Income' : 'Add Income'}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => {
                setEditingIncome(null)
                setFormState(initialForm)
              }}
            >
              Clear
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
