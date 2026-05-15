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
  X,
  Download,
  Upload,
  ChevronDown,
} from 'lucide-react'
import { addIncome, deleteIncome, fetchIncomeByMonth, fetchIncomeByRange, updateIncome, fetchAnalyticsSummaryByMonth, fetchAnalyticsSummaryByRange, fetchAnalyticsSummaryByYear } from '../../api'
import type { Income, PagedResponse } from '../../types/app'
import { useAppDataContext } from '../../context/AppDataContext'
import { formatDate, parseAmount, friendlyErrorMessage } from '../../utils/format'
import { FilterDropdown } from './FilterDropdown'
import { usePreferences } from '../../context/PreferencesContext'
import styles from './IncomeOperations.module.css'
import Skeleton from '../../components/Skeleton'
import Pagination from '../../components/Pagination'
import ExportModal from '../../components/ExportModal'
import ImportStatementModal from '../../components/ImportStatementModal'

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
  amountOperator: 'contains' | 'gt' | 'lt'
  date: string
  dateFilterMode: 'contains' | 'month' | 'year'
  dateMonth: string
  dateYear: string
  monthYear: string
}

type SortConfig = {
  field: 'source' | 'amount' | 'date' | 'monthYear' | null
  direction: 'asc' | 'desc' | null
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

// Helper to compute default month and year based on income preference
const getPreferredMonthYear = (preference: 'P' | 'C'): { month: number; year: number } => {
  const now = new Date()
  if (preference === 'P') {
    // Previous month
    const prevMonth = now.getMonth() // 0-indexed, so getMonth() gives previous month number (1-indexed)
    const year = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const month = prevMonth === 0 ? 12 : prevMonth
    return { month, year }
  }
  // Current month
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export default function IncomeOperations(): ReactElement {
  const {
    session,
    setStatus,
    incomesCache,
    reloadIncomesCache,
  } = useAppDataContext()
  const { formatCurrency, incomeMonth } = usePreferences()
  
  // Compute default month/year based on user preference
  const { month: defaultMonth, year: defaultYear } = useMemo(
    () => getPreferredMonthYear(incomeMonth),
    [incomeMonth]
  )

  const [viewMode, setViewMode] = useState<IncomeViewMode>('month')
  const [results, setResults] = useState<Income[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [formState, setFormState] = useState<IncomeFormState>(initialForm)
  const [lastQuery, setLastQuery] = useState<{ mode: IncomeViewMode; payload?: Record<string, unknown> } | null>(null)
  const [monthFilter, setMonthFilter] = useState<number>(defaultMonth)
  const [yearFilter, setYearFilter] = useState<number>(defaultYear)
  const [rangeStart, setRangeStart] = useState<string>('')
  const [rangeEnd, setRangeEnd] = useState<string>('')
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingRowDraft, setEditingRowDraft] = useState<IncomeFormState | null>(null)
  const [tableFilters, setTableFilters] = useState<TableFilters>({
    source: '',
    amount: '',
    amountOperator: 'contains',
    date: '',
    dateFilterMode: 'contains',
    dateMonth: '',
    dateYear: '',
    monthYear: '',
  })
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: null, direction: null })
  const [allResultsForFilter, setAllResultsForFilter] = useState<Income[]>([])
  const [loadingAllResults, setLoadingAllResults] = useState(false)
  const fetchingAllResultsRef = useRef(false)
  const [addingInline, setAddingInline] = useState<boolean>(false)
  const [inlineAddDraft, setInlineAddDraft] = useState<IncomeFormState | null>(null)
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(0)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [totalElements, setTotalElements] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  const initialLoadRef = useRef<boolean>(false)
  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false)
  const [exportModalDates, setExportModalDates] = useState<{ start?: string; end?: string }>({})
  // Import statement modal state
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false)
  // All-pages total (fetched from API when pagination is active)
  const [allPagesTotal, setAllPagesTotal] = useState<number | null>(null)
  // Month dropdown state
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false)
  const monthDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!session) return
    if (initialLoadRef.current) return
    initialLoadRef.current = true
    // Load income for the preferred month based on user preference
    void loadIncomes('month', { month: defaultMonth, year: defaultYear }, 0, DEFAULT_PAGE_SIZE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, defaultMonth, defaultYear])

  // Click outside to close month dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(target)) {
        setMonthDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      let resolvedYear: number | undefined
      let resolvedMonth: number | undefined
      let resolvedStart: string | undefined
      let resolvedEnd: string | undefined
      if (mode === 'current-year') {
        resolvedYear = new Date().getFullYear()
        response = await fetchIncomeByRange({
          userId,
          fromMonth: '01',
          fromYear: String(resolvedYear),
          toMonth: '12',
          toYear: String(resolvedYear),
          page,
          size,
        })
        setLastQuery({ mode })
      } else if (mode === 'month') {
        const monthPayload = payload as { month: number; year: number } | undefined
        resolvedMonth = monthPayload?.month ?? monthFilter
        resolvedYear = monthPayload?.year ?? yearFilter
        response = await fetchIncomeByMonth({ userId, month: resolvedMonth, year: resolvedYear, page, size })
        setLastQuery({ mode, payload: { month: resolvedMonth, year: resolvedYear } })
      } else {
        const rangePayload = payload as { start: string; end: string } | undefined
        resolvedStart = rangePayload?.start ?? rangeStart
        resolvedEnd = rangePayload?.end ?? rangeEnd
        if (!resolvedStart || !resolvedEnd) {
          throw new Error('Provide both start and end dates to fetch by range.')
        }
        // enforce maximum range of 1 year (365 days)
        const from = new Date(resolvedStart)
        const to = new Date(resolvedEnd)
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
        response = await fetchIncomeByRange({ userId, fromMonth: resolvedStart.slice(5, 7), fromYear: resolvedStart.slice(0, 4), toMonth: resolvedEnd.slice(5, 7), toYear: resolvedEnd.slice(0, 4), page, size })
        setLastQuery({ mode, payload: { start: resolvedStart, end: resolvedEnd } })
      }
      setResults(response.content)
      setCurrentPage(response.page)
      setTotalElements(response.totalElements)
      setTotalPages(response.totalPages)
      setStatus(null)
      // Background fetch of all-pages total when paginated
      if (response.totalPages > 1) {
        setAllPagesTotal(null)
        const uid = userId
        const rm = resolvedMonth
        const ry = resolvedYear
        const rs = resolvedStart
        const re = resolvedEnd
        void (async () => {
          try {
            let total: number
            if (mode === 'current-year' && ry !== undefined) {
              const summary = await fetchAnalyticsSummaryByYear({ userId: uid, year: ry })
              total = summary.totalIncome
            } else if (mode === 'month' && rm !== undefined && ry !== undefined) {
              const summary = await fetchAnalyticsSummaryByMonth({ userId: uid, year: ry, month: rm })
              total = summary.totalIncome
            } else if (rs && re) {
              const summary = await fetchAnalyticsSummaryByRange({ userId: uid, start: rs, end: re })
              total = summary.totalIncome
            } else {
              return
            }
            setAllPagesTotal(total)
          } catch {
            setAllPagesTotal(null)
          }
        })()
      } else {
        setAllPagesTotal(null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'fetching income records') })
    } finally {
      setLoading(false)
    }
  }

  const filteredResults = useMemo(() => {
    const sourceQuery = tableFilters.source.trim().toLowerCase()
    const amountQuery = tableFilters.amount.trim()
    const dateQuery = tableFilters.date.trim().toLowerCase()
    const dateMonth = tableFilters.dateMonth.trim()
    const dateYear = tableFilters.dateYear.trim()
    const monthYearQuery = tableFilters.monthYear.trim().toLowerCase()

    const hasFilters = !!(sourceQuery || amountQuery || dateQuery || dateMonth || dateYear || monthYearQuery)

    // Use all-pages data when available and filters are active
    const baseResults = (hasFilters && allResultsForFilter.length > 0) ? allResultsForFilter : results

    let filtered: Income[]
    if (!hasFilters) {
      filtered = baseResults
    } else {
      filtered = baseResults.filter((income) => {
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

        if (sourceQuery && !sourceValue.includes(sourceQuery)) return false

        // Amount filter with operator
        if (amountQuery) {
          const filterNum = parseFloat(amountQuery)
          if (!isNaN(filterNum)) {
            if (tableFilters.amountOperator === 'gt' && numericAmount <= filterNum) return false
            if (tableFilters.amountOperator === 'lt' && numericAmount >= filterNum) return false
            if (tableFilters.amountOperator === 'contains' && !amountString.includes(amountQuery) && !formattedAmount.includes(amountQuery.toLowerCase())) return false
          } else if (!amountString.includes(amountQuery) && !formattedAmount.includes(amountQuery.toLowerCase())) {
            return false
          }
        }

        // Date filter based on mode
        if (tableFilters.dateFilterMode === 'month' && dateMonth) {
          const d = income.receivedDate ? new Date(income.receivedDate) : null
          const expMonth = d ? d.getMonth() + 1 : null
          if (expMonth === null || String(expMonth) !== dateMonth) return false
        } else if (tableFilters.dateFilterMode === 'year' && dateYear) {
          const d = income.receivedDate ? new Date(income.receivedDate) : null
          const expYear = d ? d.getFullYear() : null
          if (expYear === null || String(expYear) !== dateYear) return false
        } else if (tableFilters.dateFilterMode === 'contains' && dateQuery) {
          if (!rawDate.includes(dateQuery) && !formattedDate.includes(dateQuery)) return false
        }

        if (monthYearQuery && !monthYearDisplay.includes(monthYearQuery)) return false

        return true
      })
    }

    // Apply sorting
    if (sortConfig.field && sortConfig.direction) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number = ''
        let bVal: string | number = ''
        switch (sortConfig.field) {
          case 'source':
            aVal = (a.source ?? '').toLowerCase()
            bVal = (b.source ?? '').toLowerCase()
            break
          case 'amount':
            aVal = typeof a.amount === 'number' ? a.amount : Number(a.amount ?? 0)
            bVal = typeof b.amount === 'number' ? b.amount : Number(b.amount ?? 0)
            break
          case 'date':
            aVal = a.receivedDate ? new Date(a.receivedDate).getTime() : 0
            bVal = b.receivedDate ? new Date(b.receivedDate).getTime() : 0
            break
          case 'monthYear': {
            const da = a.receivedDate ? deriveMonthYear(String(a.receivedDate)) : null
            const db = b.receivedDate ? deriveMonthYear(String(b.receivedDate)) : null
            aVal = da ? da.year * 100 + da.monthNumber : 0
            bVal = db ? db.year * 100 + db.monthNumber : 0
            break
          }
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [results, allResultsForFilter, tableFilters, sortConfig])

  const filtersApplied = useMemo(
    () =>
      tableFilters.source.trim().length > 0 ||
      tableFilters.amount.trim().length > 0 ||
      tableFilters.date.trim().length > 0 ||
      tableFilters.dateMonth.trim().length > 0 ||
      tableFilters.dateYear.trim().length > 0 ||
      tableFilters.monthYear.trim().length > 0,
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

  const exportDateRange = useMemo<{ start: string; end: string } | null>(() => {
    if (!lastQuery) return null
    if (lastQuery.mode === 'current-year') {
      const y = new Date().getFullYear()
      return { start: `${y}-01-01`, end: `${y}-12-31` }
    }
    if (lastQuery.mode === 'month') {
      const p = lastQuery.payload as { month: number; year: number } | undefined
      if (!p) return null
      const lastDay = new Date(p.year, p.month, 0).getDate()
      const mm = String(p.month).padStart(2, '0')
      const dd = String(lastDay).padStart(2, '0')
      return { start: `${p.year}-${mm}-01`, end: `${p.year}-${mm}-${dd}` }
    }
    const p = lastQuery.payload as { start: string; end: string } | undefined
    if (!p) return null
    return { start: p.start, end: p.end }
  }, [lastQuery])

  const handleFilterChange = (field: keyof TableFilters, value: string) => {
    setTableFilters((previous) => ({ ...previous, [field]: value }))
  }

  const clearFilters = () => {
    setTableFilters({ source: '', amount: '', amountOperator: 'contains', date: '', dateFilterMode: 'contains', dateMonth: '', dateYear: '', monthYear: '' })
  }

  const handleSort = (field: NonNullable<SortConfig['field']>) => {
    setSortConfig((prev) => {
      if (prev.field !== field) return { field, direction: 'asc' }
      if (prev.direction === 'asc') return { field, direction: 'desc' }
      return { field: null, direction: null }
    })
  }

  // Clear all-results cache whenever the active query changes
  useEffect(() => {
    setAllResultsForFilter([])
    fetchingAllResultsRef.current = false
  }, [lastQuery])

  // Fetch ALL records for the current query when filters are active and results span multiple pages
  useEffect(() => {
    const hasFilters =
      tableFilters.source.trim().length > 0 ||
      tableFilters.amount.trim().length > 0 ||
      tableFilters.date.trim().length > 0 ||
      tableFilters.dateMonth.trim().length > 0 ||
      tableFilters.dateYear.trim().length > 0 ||
      tableFilters.monthYear.trim().length > 0
    if (!hasFilters || totalPages <= 1 || !lastQuery || !session) return
    if (allResultsForFilter.length > 0) return
    if (fetchingAllResultsRef.current) return

    fetchingAllResultsRef.current = true
    setLoadingAllResults(true)
    const userId = session.userId
    const query = lastQuery
    const size = Math.min(totalElements, 5000)
    ;(async () => {
      try {
        let response: PagedResponse<Income>
        if (query.mode === 'current-year') {
          const y = new Date().getFullYear()
          response = await fetchIncomeByRange({ userId, fromMonth: '01', fromYear: String(y), toMonth: '12', toYear: String(y), page: 0, size })
        } else if (query.mode === 'month') {
          const p = query.payload as { month: number; year: number }
          response = await fetchIncomeByMonth({ userId, month: p.month, year: p.year, page: 0, size })
        } else {
          const p = query.payload as { start: string; end: string }
          response = await fetchIncomeByRange({ userId, fromMonth: p.start.slice(5, 7), fromYear: p.start.slice(0, 4), toMonth: p.end.slice(5, 7), toYear: p.end.slice(0, 4), page: 0, size })
        }
        setAllResultsForFilter(response.content)
      } catch {
        fetchingAllResultsRef.current = false
      } finally {
        setLoadingAllResults(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableFilters, totalPages, lastQuery, session, totalElements, allResultsForFilter.length])

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
        <section className={`${styles.card} ${styles.cardWithDropdown}`}>
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
            <div className={styles.headerActions}>
              <span className={styles.badge}>{filteredResults.length} records</span>
              <button
                type="button"
                className={styles.exportButton}
                onClick={() => setImportModalOpen(true)}
                title="Import HDFC bank statement"
              >
                <Upload size={16} />
                Import
              </button>
              <button
                type="button"
                className={styles.exportButton}
                onClick={() => { setExportModalDates({}); setExportModalOpen(true) }}
                title="Export data"
              >
                <Download size={16} />
                Export
              </button>
            </div>
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
                  <div ref={monthDropdownRef} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className={styles.dropdownTrigger}
                      onClick={() => setMonthDropdownOpen((o) => !o)}
                    >
                      <span>{MONTHS[monthFilter - 1]}</span>
                      <ChevronDown size={16} />
                    </button>
                    {monthDropdownOpen && (
                      <ul className={styles.dropdownList}>
                        {MONTHS.map((monthName, index) => (
                          <li
                            key={monthName}
                            className={`${styles.dropdownItem} ${monthFilter === index + 1 ? styles.dropdownItemActive : ''}`}
                            onClick={() => {
                              setMonthFilter(index + 1)
                              setMonthDropdownOpen(false)
                            }}
                          >
                            {monthName}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
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
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSort('source')}>
                      Source{sortConfig.field === 'source' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th scope="col" className={`${styles.numeric} ${styles.sortableHeader}`} onClick={() => handleSort('amount')}>
                      Amount{sortConfig.field === 'amount' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSort('date')}>
                      Received{sortConfig.field === 'date' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSort('monthYear')}>
                      Month &amp; Year{sortConfig.field === 'monthYear' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
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
                      <div className={styles.filterCell}>
                        <FilterDropdown
                          value={tableFilters.amountOperator}
                          options={[
                            { value: 'lt', label: '< Less than', triggerLabel: '<' },
                            { value: 'contains', label: '= Equals', triggerLabel: '=' },
                            { value: 'gt', label: '> Greater than', triggerLabel: '>' },
                          ]}
                          onChange={(v) => handleFilterChange('amountOperator', v)}
                        />
                        <input
                          className={styles.tableFilterInput}
                          type="number"
                          placeholder="Amount"
                          min="0"
                          step="0.01"
                          value={tableFilters.amount}
                          onChange={(event) => handleFilterChange('amount', event.target.value)}
                        />
                      </div>
                    </th>
                    <th scope="col">
                      <div className={styles.filterCell}>
                        <FilterDropdown
                          value={tableFilters.dateFilterMode}
                          options={[
                            { value: 'contains', label: 'Date' },
                            { value: 'month', label: 'Month' },
                            { value: 'year', label: 'Year' },
                          ]}
                          onChange={(v) => {
                            const mode = v as 'contains' | 'month' | 'year';
                            if (mode === 'contains') setTableFilters((prev) => ({ ...prev, dateFilterMode: mode, dateMonth: '', dateYear: '' }));
                            else if (mode === 'month') setTableFilters((prev) => ({ ...prev, dateFilterMode: mode, date: '', dateYear: '' }));
                            else setTableFilters((prev) => ({ ...prev, dateFilterMode: mode, date: '', dateMonth: '' }));
                          }}
                        />
                        {tableFilters.dateFilterMode === 'contains' && (
                          <input className={styles.tableFilterInput} type="search" placeholder="Filter date" value={tableFilters.date} onChange={(event) => handleFilterChange('date', event.target.value)} />
                        )}
                        {tableFilters.dateFilterMode === 'month' && (
                          <select className={styles.tableFilterInput} value={tableFilters.dateMonth} onChange={(event) => handleFilterChange('dateMonth', event.target.value)}>
                            <option value="">All months</option>
                            {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
                          </select>
                        )}
                        {tableFilters.dateFilterMode === 'year' && (
                          <input className={styles.tableFilterInput} type="number" placeholder="Year" min="2000" max="2100" value={tableFilters.dateYear} onChange={(event) => handleFilterChange('dateYear', event.target.value)} />
                        )}
                      </div>
                    </th>
                    <th scope="col">
                      <input
                        className={styles.tableFilterInput}
                        type="search"
                        placeholder="Filter month &amp; year"
                        value={tableFilters.monthYear}
                        onChange={(event) => handleFilterChange('monthYear', event.target.value)}
                      />
                    </th>
                    <th scope="col">
                      <div className={styles.filterActions}>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => (addingInline ? cancelInlineAdd() : beginInlineAdd())}
                        >
                          {addingInline ? 'Close' : 'Add Income'}
                        </button>
                        {filtersApplied && (
                          <button type="button" className={styles.clearFilterBtn} onClick={clearFilters} title="Clear all filters">
                            Clear Filters
                          </button>
                        )}
                        {sortConfig.field && (
                          <button type="button" className={styles.clearFilterBtn} onClick={() => setSortConfig({ field: null, direction: null })} title="Clear sort">
                            Clear Sort
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
                  {totalPages > 1 && !(filtersApplied && allResultsForFilter.length > 0) ? (
                    <>
                      <tr>
                        <td>Total income in this page</td>
                        <td className={styles.numeric}>
                          <span className={styles.totalPill}>{formatCurrency(totalIncome)}</span>
                        </td>
                        <td colSpan={3} />
                      </tr>
                      <tr>
                        <td>Total (all pages)</td>
                        <td className={styles.numeric}>
                          {allPagesTotal !== null ? (
                            <span className={styles.totalPill}>{formatCurrency(allPagesTotal)}</span>
                          ) : (
                            <span className={styles.totalPill}>…</span>
                          )}
                        </td>
                        <td colSpan={2} />
                        <td>
                          <button
                            type="button"
                            className={styles.exportButton}
                            onClick={() => { setExportModalDates(exportDateRange ?? {}); setExportModalOpen(true) }}
                            title="Export income for current selection"
                          >
                            <Download size={14} />
                            Export
                          </button>
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td>{filtersApplied && allResultsForFilter.length > 0 ? 'Filtered total' : 'Total'}</td>
                      <td className={styles.numeric}>
                        <span className={styles.totalPill}>{formatCurrency(totalIncome)}</span>
                      </td>
                      <td colSpan={2} />
                      <td>
                        <button
                          type="button"
                          className={styles.exportButton}
                          onClick={() => { setExportModalDates(exportDateRange ?? {}); setExportModalOpen(true) }}
                          title="Export income for current selection"
                        >
                          <Download size={14} />
                          Export
                        </button>
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            )}
          </div>

          {loadingAllResults && (
            <div className={styles.allResultsBanner}>
              Loading all records for cross-page filtering…
            </div>
          )}
          {filtersApplied && allResultsForFilter.length > 0 && (
            <div className={styles.allResultsNote}>
              Showing {filteredResults.length} of {allResultsForFilter.length} records · filters applied across all pages
            </div>
          )}

          {!(filtersApplied && allResultsForFilter.length > 0) && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalElements={totalElements}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              loading={loading}
            />
          )}

          
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

      {/* Export Modal */}
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        defaultExportType="INCOME"
        defaultStartDate={exportModalDates.start}
        defaultEndDate={exportModalDates.end}
      />

      {/* Import Statement Modal */}
      <ImportStatementModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={() => {
          if (session) void reloadIncomesCache(session.userId)
          if (lastQuery) void loadIncomes(lastQuery.mode, lastQuery.payload, currentPage, pageSize)
        }}
      />
    </Grid>
  )
}
