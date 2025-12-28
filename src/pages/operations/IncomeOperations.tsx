import Grid from '@mui/material/Grid'
import { Typography } from '@mui/material'
import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'
import { useRef } from 'react'
import { 
  Search, 
  Plus, 
  Trash2, 
  Pencil, 
  Check, 
  X 
} from 'lucide-react'
import { addIncome, deleteIncome, fetchIncomeByMonth, fetchIncomeByRange, updateIncome } from '../../api'
import type { Income, PagedResponse } from '../../types/app'
import { useAppDataContext } from '../../context/AppDataContext'
import { formatDate, parseAmount, friendlyErrorMessage } from '../../utils/format'
import { usePreferences } from '../../context/PreferencesContext'
import styles from './IncomeOperations.module.css'
import Skeleton from '../../components/Skeleton'
import Pagination from '../../components/Pagination'

const DEFAULT_PAGE_SIZE = 20

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
  monthYear: string
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
  const { formatCurrency } = usePreferences()
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
    monthYear: '',
  })
  const [addingInline, setAddingInline] = useState<boolean>(false)
  const [inlineAddDraft, setInlineAddDraft] = useState<IncomeFormState | null>(null)
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(0)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [totalElements, setTotalElements] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  const initialLoadRef = useRef<boolean>(false)

  useEffect(() => {
    if (!session) return
    if (initialLoadRef.current) return
    initialLoadRef.current = true
    // Avoid duplicate loads: only call paged load once on mount
    void loadIncomes('current-year', undefined, 0, DEFAULT_PAGE_SIZE)
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

  const loadIncomes = async (mode: IncomeViewMode, payload?: Record<string, unknown>, page: number = 0, size: number = pageSize) => {
    if (!session) return
    const userId = session.userId
    setLoading(true)
    setStatus({ type: 'loading', message: 'Fetching income records...' })
    try {
      let response: PagedResponse<Income>
      if (mode === 'current-year') {
        const currentYear = new Date().getFullYear()
        response = await fetchIncomeByRange({
          userId,
          fromMonth: '01',
          fromYear: String(currentYear),
          toMonth: '12',
          toYear: String(currentYear),
          page,
          size,
        })
        setLastQuery({ mode })
      } else if (mode === 'month') {
        const monthPayload = payload as { month: number; year: number } | undefined
        const month = monthPayload?.month ?? monthFilter
        const year = monthPayload?.year ?? yearFilter
        response = await fetchIncomeByMonth({ userId, month, year, page, size })
        setLastQuery({ mode, payload: { month, year } })
      } else {
        const rangePayload = payload as { start: string; end: string } | undefined
        const start = rangePayload?.start ?? rangeStart
        const end = rangePayload?.end ?? rangeEnd
        if (!start || !end) {
          throw new Error('Provide both start and end dates to fetch by range.')
        }
        // enforce maximum range of 1 year (365 days)
        const from = new Date(start)
        const to = new Date(end)
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
          throw new Error('Invalid date provided for range.')
        }
        if (to < from) {
          throw new Error('End date must be the same or after start date.')
        }
        const diffDays = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays > 365) {
          throw new Error('Range cannot exceed 1 year.')
        }
        response = await fetchIncomeByRange({ userId, fromMonth: start.slice(5, 7), fromYear: start.slice(0, 4), toMonth: end.slice(5, 7), toYear: end.slice(0, 4), page, size })
        setLastQuery({ mode, payload: { start, end } })
      }
      setResults(response.content)
      setCurrentPage(response.page)
      setTotalElements(response.totalElements)
      setTotalPages(response.totalPages)
      setStatus(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'fetching income records') })
    } finally {
      setLoading(false)
    }
  }

  const filteredResults = useMemo(() => {
    const sourceQuery = tableFilters.source.trim().toLowerCase()
    const amountQuery = tableFilters.amount.trim().toLowerCase()
    const dateQuery = tableFilters.date.trim().toLowerCase()
    const monthYearQuery = tableFilters.monthYear.trim().toLowerCase()

    if (!sourceQuery && !amountQuery && !dateQuery && !monthYearQuery) {
      return results
    }

    return results.filter((income) => {
      const sourceValue = (income.source ?? '').toString().toLowerCase()

      const numericAmount = typeof income.amount === 'number' ? income.amount : Number(income.amount ?? 0)
      const amountString = Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : ''
      const formattedAmount = formatCurrency(numericAmount).toLowerCase()

      const rawDate = (income.receivedDate ?? '').toString().toLowerCase()
      const formattedDate = formatDate(income.receivedDate).toLowerCase()

      const derived = income.receivedDate ? deriveMonthYear(String(income.receivedDate)) : null
      const normalizedMonth =
        typeof income.month === 'number' ? MONTHS[income.month - 1] ?? String(income.month) : income.month
      const monthDisplay = (normalizedMonth ?? derived?.monthName ?? '').toString().toLowerCase()
      const yearDisplay = String(income.year ?? derived?.year ?? '').toLowerCase()
      const monthYearDisplay = `${monthDisplay}, ${yearDisplay}`.toLowerCase()

      if (sourceQuery && !sourceValue.includes(sourceQuery)) {
        return false
      }
      if (amountQuery && !amountString.includes(amountQuery) && !formattedAmount.includes(amountQuery)) {
        return false
      }
      if (dateQuery && !rawDate.includes(dateQuery) && !formattedDate.includes(dateQuery)) {
        return false
      }
      if (monthYearQuery && !monthYearDisplay.includes(monthYearQuery)) {
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
        userId: session.userId,
        source: editingRowDraft.source,
        amount: numericAmount,
        receivedDate: editingRowDraft.receivedDate,
        month: monthName || monthNumber,
        year,
      })
      setStatus({ type: 'success', message: 'Income updated.' })
      await reloadIncomesCache(session.userId)
      if (lastQuery) {
        await loadIncomes(lastQuery.mode, lastQuery.payload, currentPage, pageSize)
      }
      cancelInlineEdit()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'updating income') })
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
        userId: session.userId,
        source,
        amount: numericAmount,
        receivedDate,
        month: monthName,
        year,
      })
      setStatus({ type: 'success', message: 'Income added.' })
      await reloadIncomesCache(session.userId)
      if (lastQuery) {
        await loadIncomes(lastQuery.mode, lastQuery.payload, currentPage, pageSize)
      }
      setFormState(initialForm)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'adding income') })
    }
  }

  const beginInlineAdd = () => {
    setAddingInline(true)
    setInlineAddDraft({ source: '', amount: '', receivedDate: new Date().toISOString().slice(0, 10) })
    setEditingRowId(null)
  }

  const cancelInlineAdd = () => {
    setAddingInline(false)
    setInlineAddDraft(null)
  }

  const updateInlineAddDraft = (field: keyof IncomeFormState, value: string) => {
    setInlineAddDraft((previous) => (previous ? { ...previous, [field]: value } : previous))
  }

  const confirmInlineAdd = async () => {
    if (!session || !inlineAddDraft) return
    const { source, amount, receivedDate } = inlineAddDraft
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
        userId: session.userId,
        source,
        amount: numericAmount,
        receivedDate,
        month: monthName,
        year,
      })
      setStatus({ type: 'success', message: 'Income added.' })
      await reloadIncomesCache(session.userId)
      if (lastQuery) {
        await loadIncomes(lastQuery.mode, lastQuery.payload, currentPage, pageSize)
      }
      cancelInlineAdd()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'adding income') })
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
      await deleteIncome({ userId: session.userId, incomeId: income.incomeId })
      setStatus({ type: 'success', message: 'Income deleted.' })
      if (editingRowId === rowKey) {
        cancelInlineEdit()
      }
      await reloadIncomesCache(session.userId)
      if (lastQuery) {
        await loadIncomes(lastQuery.mode, lastQuery.payload, currentPage, pageSize)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'deleting income') })
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
    setTableFilters({ source: '', amount: '', date: '', monthYear: '' })
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    if (lastQuery) {
      void loadIncomes(lastQuery.mode, lastQuery.payload, page, pageSize)
    }
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(0) // Reset to first page when page size changes
    if (lastQuery) {
      void loadIncomes(lastQuery.mode, lastQuery.payload, 0, size)
    }
  }

  return (
    <Grid container component="section" className={styles.page} spacing={3}>
      <Grid size={{ xs: 12, xl: 8 }}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div className={styles.headerWithIcon}>
              <span className={styles.emojiIcon}>💰</span>
              <div>
                <Typography variant="h5" component="h2" className={styles.title}>
                  Income Overview
                </Typography>
                <Typography variant="body2" component="p" className={styles.subtitle}>
                  Review and manage income entries.
                </Typography>
              </div>
            </div>
            <span className={styles.badge}>{filteredResults.length} records</span>
          </header>

          <form
            className={styles.filterRow}
            onSubmit={(event) => {
              event.preventDefault()
              setCurrentPage(0) // Reset to first page on new search
              void loadIncomes(viewMode, undefined, 0, pageSize)
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
              <Search size={16} />
              {loading ? 'Loading…' : 'Load Income'}
            </button>
          </form>

          <div className={styles.tableContainer}>
            {results.length === 0 ? (
              loading ? (
                <div style={{padding:16}}>
                  {[0,1,2,3].map((i) => (
                    <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 120px 120px 120px 80px',gap:12,alignItems:'center',marginBottom:12}}>
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
                    <th scope="col">Month &amp; Year</th>
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
                        placeholder="Filter month & year"
                        value={tableFilters.monthYear}
                        onChange={(event) => handleFilterChange('monthYear', event.target.value)}
                      />
                    </th>
                    <th scope="col">
                      <div style={{display:'flex',gap:8,justifyContent:'center',alignItems:'center'}}>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => (addingInline ? cancelInlineAdd() : beginInlineAdd())}
                        >
                          {addingInline ? 'Close' : 'Add Income'}
                        </button>
                        {filtersApplied && (
                          <button type="button" onClick={clearFilters}>
                            Clear
                          </button>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {addingInline && inlineAddDraft && (
                    <tr key="__inline_add">
                      <td>
                        <input
                          className={styles.inlineInput}
                          type="text"
                          value={inlineAddDraft.source}
                          onChange={(e) => updateInlineAddDraft('source', e.target.value)}
                          placeholder="Source"
                        />
                      </td>
                      <td className={styles.numeric}>
                        <input
                          className={styles.inlineInput}
                          type="number"
                          min="0"
                          step="0.01"
                          value={inlineAddDraft.amount}
                          onChange={(e) => updateInlineAddDraft('amount', e.target.value)}
                        />
                      </td>
                      <td className={styles.date}>
                        <input
                          className={styles.inlineInput}
                          type="date"
                          value={inlineAddDraft.receivedDate}
                          onChange={(e) => updateInlineAddDraft('receivedDate', e.target.value)}
                        />
                      </td>
                      <td />
                      <td className={styles.actions}>
                        <button type="button" onClick={() => void confirmInlineAdd()}>
                          Confirm
                        </button>
                        <button type="button" onClick={cancelInlineAdd}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                  )}
                  {filteredResults.length === 0 ? (
                    <tr className={styles.emptyRow}>
                      <td colSpan={5}>No income entries match the current filters.</td>
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
                              formatCurrency(Number(income.amount ?? 0))
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
                          <td>{monthDisplay}, {yearDisplay}</td>
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
                      <span className={styles.totalPill}>{formatCurrency(totalIncome)}</span>
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalElements={totalElements}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            loading={loading}
          />

          
        </section>
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div className={styles.headerWithIcon}>
              <span className={styles.emojiIcon}>➕</span>
              <div>
                <Typography variant="h5" component="h2" className={styles.title}>
                  Add Income
                </Typography>
                <Typography variant="body2" component="p" className={styles.subtitle}>
                  Capture a new income item.
                </Typography>
              </div>
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
